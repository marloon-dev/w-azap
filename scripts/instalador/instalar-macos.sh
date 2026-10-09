#!/bin/bash
# ==============================================================================
# Instalador do W-AZAP para macOS
#
# Instala tudo dentro de ~/.w-azap, sem Homebrew, sem Docker e sem senha de
# administrador: Node.js e MySQL portáteis, o código da release, o build e dois
# serviços do launchd (MySQL e servidor) que sobem sozinhos no login.
#
# Uso:
#   curl -fsSL https://github.com/marloon-dev/w-azap/releases/latest/download/instalar-macos.sh | bash
#   ou dê dois cliques em "Instalar W-AZAP.command" (zip da release).
#
# Rodar de novo atualiza para a versão do instalador e mantém o .env, o banco,
# as sessões do WhatsApp e as mídias. Para remover: w-azap desinstalar
#
# Atualização automática: um terceiro serviço do launchd confere a cada hora se
# saiu uma release nova e roda o instalador dela sozinho. Cada versão é montada
# em versoes/<tag>-<data> enquanto a atual continua no ar; app/ é um link para a
# versão em uso e os dados (.env, data/, uploads/) ficam em dados/. Se a nova
# versão não subir, o link volta para a anterior.
# ==============================================================================
set -Eeuo pipefail
PATH_ORIGINAL="$PATH"

REPO="marloon-dev/w-azap"
# Trocado pela tag da release no workflow que publica o instalador.
# Sem a troca (rodando direto do repositório), instala a release mais recente.
VERSAO_FIXA="__W_AZAP_VERSAO__"

NODE_MAJOR="22"
MYSQL_VERSAO="8.4.8"
MYSQL_SHA256_ARM64="76e4f531afd972a14fcd31a25fa6d6befa57e1ad17b9dbc710fc66da8cfa48f9"
MYSQL_SHA256_X86_64="29ddf2312e41cf8d3cbd39ca1fc2454b2722f217e09dfa7c562cebcd7f181768"

W_HOME="${W_AZAP_HOME:-$HOME/.w-azap}"
APPS_DIR="${W_AZAP_APPS_DIR:-$HOME/Applications}"
LABEL="${W_AZAP_LABEL:-io.github.marloon-dev.w-azap}"
MYSQL_PORTA="${W_AZAP_PORTA_MYSQL:-3307}"
AGENTES_DIR="$HOME/Library/LaunchAgents"

RUNTIME="$W_HOME/runtime"
APP="$W_HOME/app"            # link para a versão em uso, dentro de versoes/
VERSOES="$W_HOME/versoes"
DADOS="$W_HOME/dados"        # .env, data/ e uploads/, compartilhados entre versões
LOGS="$W_HOME/logs"
TRAVA="$W_HOME/.instalando"
# Definido quando o instalador é chamado pelo serviço de atualização automática
AUTOMATICO="${W_AZAP_AUTOMATICO:-0}"
MYSQL_CNF="$W_HOME/mysql/my.cnf"
MYSQL_SOCK="$W_HOME/mysql/mysql.sock"
# O macOS limita o caminho de um socket Unix a 103 caracteres
if [ "${#MYSQL_SOCK}" -gt 100 ]; then
    MYSQL_SOCK="/tmp/w-azap-$(id -u).sock"
fi
LOG_INSTALACAO="$LOGS/instalacao.log"

# ------------------------------------------------------------------------------
# Saída
# ------------------------------------------------------------------------------
if [ -t 1 ]; then
    AZUL=$'\033[0;34m'; VERDE=$'\033[0;32m'; AMARELO=$'\033[1;33m'; VERMELHO=$'\033[0;31m'; NEGRITO=$'\033[1m'; FIM=$'\033[0m'
else
    AZUL=""; VERDE=""; AMARELO=""; VERMELHO=""; NEGRITO=""; FIM=""
fi

PASSO=0
TOTAL_PASSOS=8
passo() { PASSO=$((PASSO + 1)); printf '\n%s[%d/%d] %s%s\n' "$AZUL" "$PASSO" "$TOTAL_PASSOS" "$1" "$FIM"; }
ok() { printf '  %s✓%s %s\n' "$VERDE" "$FIM" "$1"; }
aviso() { printf '  %s!%s %s\n' "$AMARELO" "$FIM" "$1"; }
erro() { printf '\n%s✗ %s%s\n' "$VERMELHO" "$1" "$FIM" >&2; }

pausar_se_command() {
    # Aberto com dois cliques: segura a janela do Terminal para a pessoa ler o resultado
    case "${0:-}" in
        *.command) printf '\nPressione Enter para fechar esta janela.'; { read -r _ </dev/tty; } 2>/dev/null || true ;;
    esac
}

ao_falhar() {
    local codigo=$?
    trap - ERR
    erro "A instalação parou (código $codigo)."
    # Falhou com o servidor parado: volta para a versão anterior em vez de deixar o painel fora do ar
    if [ "${SERVIDOR_PARADO:-0}" = "1" ]; then
        voltar_versao_anterior || carregar_agente "$LABEL.servidor" || true
    fi
    if [ -f "$LOG_INSTALACAO" ]; then
        printf '\nÚltimas linhas do log (%s):\n' "$LOG_INSTALACAO" >&2
        tail -n 25 "$LOG_INSTALACAO" >&2 || true
    fi
    printf '\nCorrija o problema e rode o instalador de novo: ele continua de onde parou.\n' >&2
    pausar_se_command
    exit "$codigo"
}

# Executa um comando mandando a saída para o log da instalação
registrar() { "$@" >>"$LOG_INSTALACAO" 2>&1; }

perguntar() {
    # perguntar "Pergunta" padrao(s|n) -> retorna 0 para sim
    local resposta padrao="$2" opcoes="[s/N]"
    [ "$padrao" = "s" ] && opcoes="[S/n]"
    printf '%s %s ' "$1" "$opcoes"
    # Lê do terminal mesmo com o script vindo por "curl | bash"; sem terminal, vale o padrão
    if ! { read -r resposta </dev/tty; } 2>/dev/null; then resposta=""; echo; fi
    resposta="${resposta:-$padrao}"
    case "$resposta" in s|S|sim|Sim|SIM|y|Y) return 0 ;; *) return 1 ;; esac
}

# ------------------------------------------------------------------------------
# Utilidades
# ------------------------------------------------------------------------------
baixar() {
    # baixar URL destino
    curl -fL --retry 3 --retry-delay 2 --progress-bar -o "$2" "$1"
}

conferir_sha256() {
    # conferir_sha256 arquivo esperado
    local obtido
    obtido="$(shasum -a 256 "$1" | awk '{print $1}')"
    if [ "$obtido" != "$2" ]; then
        erro "O arquivo baixado não confere (SHA-256). Esperado $2, recebido $obtido."
        rm -f "$1"
        return 1
    fi
}

porta_ocupada() { lsof -nP -iTCP:"$1" -sTCP:LISTEN >/dev/null 2>&1; }

gerar_segredo() { openssl rand -base64 32 | tr -d '\n'; }
gerar_senha() { openssl rand -hex 16; }

valor_env() {
    # valor_env CHAVE -> valor no .env (sem aspas)
    { grep -E "^$1=" "$DADOS/.env" 2>/dev/null || true; } | tail -n 1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//'
}

substituir_se_mudou() {
    # substituir_se_mudou arquivo -> troca "arquivo" por "arquivo.novo"; retorna 0 se o conteúdo mudou
    if cmp -s "$1.novo" "$1"; then rm -f "$1.novo"; return 1; fi
    mv -f "$1.novo" "$1"
}

mysql_ativo() { "$RUNTIME/mysql/bin/mysqladmin" --no-defaults --protocol=tcp -h127.0.0.1 -P"$MYSQL_PORTA" ping >/dev/null 2>&1; }

esperar() {
    # esperar segundos descricao comando...
    local limite="$1" descricao="$2"; shift 2
    local i=0
    while ! "$@"; do
        i=$((i + 1))
        if [ "$i" -ge "$limite" ]; then
            erro "Tempo esgotado esperando $descricao."
            return 1
        fi
        sleep 1
    done
}

servidor_responde() { curl -fsS -o /dev/null --max-time 3 "http://127.0.0.1:$1/" 2>/dev/null; }

agente_carregado() { launchctl print "gui/$(id -u)/$1" >/dev/null 2>&1; }

carregar_agente() {
    local label="$1" plist="$AGENTES_DIR/$1.plist" tentativa
    descarregar_agente "$label"
    # Logo após um bootout o launchd pode recusar o bootstrap por alguns instantes
    for tentativa in 1 2 3 4 5; do
        if launchctl bootstrap "gui/$(id -u)" "$plist" >>"$LOG_INSTALACAO" 2>&1; then
            return 0
        fi
        sleep 2
    done
    erro "O launchd recusou o serviço $label."
    return 1
}

descarregar_agente() {
    if agente_carregado "$1"; then
        launchctl bootout "gui/$(id -u)/$1" 2>/dev/null || true
    fi
}

voltar_versao_anterior() {
    [ -n "${ANTERIOR:-}" ] && [ -d "$ANTERIOR" ] || return 1
    descarregar_agente "$LABEL.servidor"
    ln -sfn "$ANTERIOR" "$APP"
    SERVIDOR_PARADO=0
    carregar_agente "$LABEL.servidor"
    aviso "Voltei para a versão anterior (${ANTERIOR##*/}); ela continua no ar."
}

# ------------------------------------------------------------------------------
# Desinstalação (delegada ao comando w-azap, que fica instalado)
# ------------------------------------------------------------------------------
if [ "${1:-}" = "--desinstalar" ]; then
    if [ -x "$W_HOME/bin/w-azap" ]; then
        exec "$W_HOME/bin/w-azap" desinstalar
    fi
    echo "O W-AZAP não está instalado em $W_HOME."
    exit 0
fi

trap ao_falhar ERR

printf '\n%s%sW-AZAP%s · instalador para macOS\n' "$NEGRITO" "$VERDE" "$FIM"

# ------------------------------------------------------------------------------
passo "Verificando o sistema"
# ------------------------------------------------------------------------------
if [ "$(uname -s)" != "Darwin" ]; then
    erro "Este instalador é só para macOS."; exit 1
fi
if [ "$(id -u)" -eq 0 ]; then
    erro "Não rode com sudo: o W-AZAP é instalado na sua conta de usuário."; exit 1
fi

MACOS_VERSAO="$(sw_vers -productVersion)"
MACOS_MAJOR="${MACOS_VERSAO%%.*}"
if [ "$MACOS_MAJOR" -lt 15 ]; then
    erro "É preciso o macOS 15 (Sequoia) ou mais novo. Este Mac está no $MACOS_VERSAO."; exit 1
fi

case "$(uname -m)" in
    arm64)  NODE_ARQ="arm64"; MYSQL_ARQ="arm64";  MYSQL_SHA256="$MYSQL_SHA256_ARM64" ;;
    x86_64) NODE_ARQ="x64";   MYSQL_ARQ="x86_64"; MYSQL_SHA256="$MYSQL_SHA256_X86_64" ;;
    *) erro "Arquitetura não suportada: $(uname -m)"; exit 1 ;;
esac

for cmd in curl tar shasum openssl rsync lsof launchctl; do
    command -v "$cmd" >/dev/null 2>&1 || { erro "Comando necessário não encontrado: $cmd"; exit 1; }
done

ESPACO_LIVRE_GB=$(( $(df -k "$HOME" | awk 'NR==2 {print $4}') / 1024 / 1024 ))
if [ "$ESPACO_LIVRE_GB" -lt 3 ]; then
    erro "Espaço livre insuficiente: ${ESPACO_LIVRE_GB} GB. São necessários pelo menos 3 GB."; exit 1
fi

mkdir -p "$RUNTIME" "$LOGS" "$W_HOME/bin" "$W_HOME/mysql" "$W_HOME/downloads" "$VERSOES" "$DADOS"

# Uma instalação por vez (a manual e a automática podem coincidir)
if ! mkdir "$TRAVA" 2>/dev/null; then
    if kill -0 "$(cat "$TRAVA/pid" 2>/dev/null)" 2>/dev/null; then
        erro "Já existe uma instalação ou atualização do W-AZAP em andamento."; exit 1
    fi
    rm -rf "$TRAVA"; mkdir "$TRAVA"
fi
echo "$$" >"$TRAVA/pid"
trap 'rm -rf "$TRAVA"' EXIT
: >"$LOG_INSTALACAO"

# Até a v2.2.0, app/ era uma pasta comum com o .env, data/ e uploads/ dentro
LEGADO=0
if [ -d "$APP" ] && [ ! -L "$APP" ]; then
    LEGADO=1
    # Enquanto a versão antiga estiver no ar, o .env dela é o que vale
    if [ -f "$APP/.env" ]; then cp -p "$APP/.env" "$DADOS/.env"; fi
fi

if [ -f "$DADOS/.env" ]; then
    MODO="atualizar"
    ok "Instalação existente encontrada em $W_HOME: vou atualizar."
else
    MODO="instalar"
    if [ "$AUTOMATICO" = "1" ]; then
        erro "A atualização automática só atualiza uma instalação existente."; exit 1
    fi
fi
ok "macOS $MACOS_VERSAO ($(uname -m)), ${ESPACO_LIVRE_GB} GB livres"

# Versão a instalar
case "$VERSAO_FIXA" in
    __*) VERSAO="${W_AZAP_VERSAO:-}" ;;
    *)   VERSAO="${W_AZAP_VERSAO:-$VERSAO_FIXA}" ;;
esac
if [ -z "$VERSAO" ]; then
    VERSAO="$(curl -fsSI "https://github.com/$REPO/releases/latest" | awk -F'/' 'tolower($1) ~ /^location:/ {print $NF}' | tr -d '\r\n')"
    [ -n "$VERSAO" ] || { erro "Não consegui descobrir a versão mais recente no GitHub."; exit 1; }
fi
VERSAO_INSTALADA="$(cat "$W_HOME/versao" 2>/dev/null || true)"
ok "Versão: $VERSAO${VERSAO_INSTALADA:+ (instalada: $VERSAO_INSTALADA)}"

if [ "$MODO" = "instalar" ]; then
    printf '\nVou instalar o W-AZAP %s em %s%s%s.\n' "$VERSAO" "$NEGRITO" "$W_HOME" "$FIM"
    printf 'Serão baixados cerca de 400 MB (Node.js, MySQL e dependências).\n'
    printf 'O W-AZAP vai iniciar sozinho quando você entrar no Mac.\n\n'
    perguntar "Continuar?" s || { echo "Instalação cancelada."; exit 0; }
else
    ok "A versão atual continua no ar até a nova estar pronta."
fi

# ------------------------------------------------------------------------------
passo "Node.js $NODE_MAJOR"
# ------------------------------------------------------------------------------
NODE_SHASUMS="$(curl -fsSL "https://nodejs.org/dist/latest-v$NODE_MAJOR.x/SHASUMS256.txt")"
NODE_LINHA="$(printf '%s\n' "$NODE_SHASUMS" | grep -E " node-v[0-9.]+-darwin-$NODE_ARQ\.tar\.gz$" | head -n 1)"
NODE_SHA256="${NODE_LINHA%% *}"
NODE_ARQUIVO="${NODE_LINHA##* }"
NODE_PASTA="${NODE_ARQUIVO%.tar.gz}"

if [ -x "$RUNTIME/$NODE_PASTA/bin/node" ]; then
    ok "Já instalado (${NODE_PASTA#node-})"
else
    baixar "https://nodejs.org/dist/latest-v$NODE_MAJOR.x/$NODE_ARQUIVO" "$W_HOME/downloads/$NODE_ARQUIVO"
    conferir_sha256 "$W_HOME/downloads/$NODE_ARQUIVO" "$NODE_SHA256"
    tar -xzf "$W_HOME/downloads/$NODE_ARQUIVO" -C "$RUNTIME"
    rm -f "$W_HOME/downloads/$NODE_ARQUIVO"
    ok "Instalado (${NODE_PASTA#node-}, SHA-256 conferido)"
fi
ln -sfn "$RUNTIME/$NODE_PASTA" "$RUNTIME/node"
export PATH="$RUNTIME/node/bin:/usr/bin:/bin:/usr/sbin:/sbin"
export NEXT_TELEMETRY_DISABLED=1

# ------------------------------------------------------------------------------
passo "MySQL $MYSQL_VERSAO"
# ------------------------------------------------------------------------------
MYSQL_PASTA="mysql-$MYSQL_VERSAO-macos15-$MYSQL_ARQ"
MYSQL_LINK_ANTES="$(readlink "$RUNTIME/mysql" 2>/dev/null || true)"
if [ -x "$RUNTIME/$MYSQL_PASTA/bin/mysqld" ]; then
    ok "Já instalado"
else
    MYSQL_ARQUIVO="$MYSQL_PASTA.tar.gz"
    baixar "https://cdn.mysql.com/archives/mysql-8.4/$MYSQL_ARQUIVO" "$W_HOME/downloads/$MYSQL_ARQUIVO"
    conferir_sha256 "$W_HOME/downloads/$MYSQL_ARQUIVO" "$MYSQL_SHA256"
    tar -xzf "$W_HOME/downloads/$MYSQL_ARQUIVO" -C "$RUNTIME"
    rm -f "$W_HOME/downloads/$MYSQL_ARQUIVO"
    ok "Instalado (SHA-256 conferido)"
fi
ln -sfn "$RUNTIME/$MYSQL_PASTA" "$RUNTIME/mysql"

# ------------------------------------------------------------------------------
passo "Código do W-AZAP $VERSAO"
# ------------------------------------------------------------------------------
TMP="$(mktemp -d)"
baixar "https://github.com/$REPO/archive/refs/tags/$VERSAO.tar.gz" "$TMP/codigo.tar.gz"
tar -xzf "$TMP/codigo.tar.gz" -C "$TMP"
CODIGO="$(find "$TMP" -mindepth 1 -maxdepth 1 -type d | head -n 1)"
[ -f "$CODIGO/package.json" ] || { erro "O pacote baixado não parece ser o W-AZAP."; exit 1; }

# A versão nova é montada numa pasta própria; a atual segue no ar até a troca
NOVA="$VERSOES/$VERSAO-$(date +%Y%m%d%H%M%S)"
mkdir -p "$NOVA"
rsync -a "$CODIGO/" "$NOVA/"
rm -rf "$TMP"
# Configuração e dados ficam em dados/ e valem para todas as versões. Os links
# de data/ e uploads/ só entram depois do build: o Turbopack recusa pastas fora do projeto
rm -rf "$NOVA/.env" "$NOVA/data" "$NOVA/uploads"
ln -s "$DADOS/.env" "$NOVA/.env"
ok "Código em $NOVA"

# ------------------------------------------------------------------------------
passo "Banco de dados"
# ------------------------------------------------------------------------------
# Só reinicia o MySQL se a versão ou a configuração mudarem: numa atualização,
# a versão em uso continua conectada ao banco enquanto a nova é montada
MYSQL_MUDOU=0
[ "$MYSQL_LINK_ANTES" = "$RUNTIME/$MYSQL_PASTA" ] || MYSQL_MUDOU=1

cat >"$MYSQL_CNF.novo" <<CNF
[mysqld]
basedir=$RUNTIME/mysql
datadir=$W_HOME/mysql/data
port=$MYSQL_PORTA
bind-address=127.0.0.1
mysqlx=OFF
socket=$MYSQL_SOCK
pid-file=$W_HOME/mysql/mysqld.pid
log-error=$LOGS/mysqld.err
character-set-server=utf8mb4
collation-server=utf8mb4_unicode_ci
CNF
if substituir_se_mudou "$MYSQL_CNF"; then MYSQL_MUDOU=1; fi

mkdir -p "$AGENTES_DIR"
cat >"$AGENTES_DIR/$LABEL.mysql.plist.novo" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key><string>$LABEL.mysql</string>
    <key>ProgramArguments</key>
    <array>
        <string>$RUNTIME/mysql/bin/mysqld</string>
        <string>--defaults-file=$MYSQL_CNF</string>
    </array>
    <key>RunAtLoad</key><true/>
    <key>KeepAlive</key><true/>
    <key>ThrottleInterval</key><integer>10</integer>
    <key>StandardOutPath</key><string>$LOGS/mysqld.out</string>
    <key>StandardErrorPath</key><string>$LOGS/mysqld.out</string>
</dict>
</plist>
PLIST
if substituir_se_mudou "$AGENTES_DIR/$LABEL.mysql.plist"; then MYSQL_MUDOU=1; fi

PRIMEIRA_VEZ_BANCO=0
if [ ! -d "$W_HOME/mysql/data/mysql" ]; then
    PRIMEIRA_VEZ_BANCO=1
    if porta_ocupada "$MYSQL_PORTA"; then
        erro "A porta $MYSQL_PORTA já está em uso. Libere-a ou rode com W_AZAP_PORTA_MYSQL=<outra porta>."
        exit 1
    fi
    rm -rf "$W_HOME/mysql/data"
    registrar "$RUNTIME/mysql/bin/mysqld" --defaults-file="$MYSQL_CNF" --initialize-insecure
    ok "Banco inicializado"
fi

if [ "$MYSQL_MUDOU" = "1" ] || ! agente_carregado "$LABEL.mysql" || ! mysql_ativo; then
    carregar_agente "$LABEL.mysql"
fi
esperar 60 "o MySQL iniciar (veja $LOGS/mysqld.err)" mysql_ativo
ok "MySQL rodando em 127.0.0.1:$MYSQL_PORTA"

if [ "$MODO" = "instalar" ]; then
    # Senhas geradas uma vez e guardadas antes de usar, para uma nova execução
    # (depois de uma falha) reaproveitar as mesmas
    SENHAS="$W_HOME/mysql/senhas.txt"
    if [ ! -f "$SENHAS" ]; then
        umask 077
        printf 'root:%s\nw_azap:%s\n' "$(gerar_senha)" "$(gerar_senha)" >"$SENHAS"
        umask 022
    fi
    SENHA_ROOT="$(grep '^root:' "$SENHAS" | cut -d: -f2)"
    SENHA_APP="$(grep '^w_azap:' "$SENHAS" | cut -d: -f2)"

    MYSQL_CLI=("$RUNTIME/mysql/bin/mysql" --no-defaults -uroot -S "$MYSQL_SOCK")
    if "${MYSQL_CLI[@]}" -e 'SELECT 1' >/dev/null 2>&1; then
        # Root ainda sem senha (banco recém-inicializado)
        DEFINIR_ROOT="ALTER USER 'root'@'localhost' IDENTIFIED BY '$SENHA_ROOT';"
    else
        MYSQL_CLI+=("-p$SENHA_ROOT")
        DEFINIR_ROOT=""
    fi
    registrar "${MYSQL_CLI[@]}" <<SQL
$DEFINIR_ROOT
CREATE DATABASE IF NOT EXISTS w_azap CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'w_azap'@'localhost' IDENTIFIED BY '$SENHA_APP';
CREATE USER IF NOT EXISTS 'w_azap'@'127.0.0.1' IDENTIFIED BY '$SENHA_APP';
ALTER USER 'w_azap'@'localhost' IDENTIFIED BY '$SENHA_APP';
ALTER USER 'w_azap'@'127.0.0.1' IDENTIFIED BY '$SENHA_APP';
GRANT ALL PRIVILEGES ON w_azap.* TO 'w_azap'@'localhost';
GRANT ALL PRIVILEGES ON w_azap.* TO 'w_azap'@'127.0.0.1';
FLUSH PRIVILEGES;
SQL
    ok "Banco w_azap e usuário prontos (senhas em $SENHAS)"
fi

# ------------------------------------------------------------------------------
passo "Configuração"
# ------------------------------------------------------------------------------
if [ "$MODO" = "instalar" ]; then
    PORTA=3000
    while porta_ocupada "$PORTA"; do
        PORTA=$((PORTA + 1))
        [ "$PORTA" -le 3020 ] || { erro "Nenhuma porta livre entre 3000 e 3020."; exit 1; }
    done
    [ "$PORTA" -ne 3000 ] && aviso "A porta 3000 está ocupada; o W-AZAP vai usar a $PORTA."
    URL_BASE="http://localhost:$PORTA"
    umask 077
    cat >"$DADOS/.env" <<ENV
# Gerado pelo instalador do W-AZAP em $(date '+%Y-%m-%d %H:%M').
# Referência de todas as variáveis: docs/ENVIRONMENT_VARIABLES.md
# Depois de editar, aplique com: w-azap reconstruir

PORT="$PORTA"
DATABASE_URL="mysql://w_azap:$SENHA_APP@127.0.0.1:$MYSQL_PORTA/w_azap"
AUTH_SECRET="$(gerar_segredo)"
# Guarde esta chave: perdê-la obriga a escanear todos os QR codes de novo
DATA_ENCRYPTION_KEY="$(gerar_segredo)"

BASE_URL="$URL_BASE"
NEXTAUTH_URL="$URL_BASE"
AUTH_TRUST_HOST="true"
NEXT_PUBLIC_APP_URL="$URL_BASE"
NEXT_PUBLIC_API_URL="$URL_BASE/api"
BIND_HOST="127.0.0.1"

APP_NAME="W-AZAP"
NEXT_PUBLIC_ALLOW_INDEXING="false"
NEXT_PUBLIC_SWAGGER_ENABLED="true"
BAILEYS_LOG_LEVEL="error"
ENABLE_AUTO_UPDATE_CHECK="true"
MAX_UPLOAD_SIZE_MB="50"
ENABLE_RATE_LIMITING="true"
RATE_LIMIT_PER_MINUTE="60"
TZ="America/Sao_Paulo"
LOCALE="pt-BR"
MEDIA_STORAGE_PATH="uploads"
ENV
    umask 022
    ok "Arquivo .env criado com chaves aleatórias"
else
    PORTA="$(valor_env PORT)"; PORTA="${PORTA:-3000}"
    ok "Mantida a configuração atual ($DADOS/.env)"
fi

# ------------------------------------------------------------------------------
passo "Dependências e build (pode levar alguns minutos)"
# ------------------------------------------------------------------------------
cd "$NOVA"
printf '  Instalando dependências…\n'
registrar npm ci --legacy-peer-deps --no-audit --no-fund
# O npm 11+ pode bloquear scripts de instalação; garante o patch do Baileys e o Prisma Client
registrar npx --no-install patch-package
registrar npx --no-install prisma generate
ok "Dependências instaladas"

# Sem --accept-data-loss: uma mudança que apagaria dados para aqui, com a versão atual ainda no ar
printf '  Atualizando as tabelas do banco…\n'
if ! registrar npx --no-install prisma db push --skip-generate; then
    erro "O Prisma não conseguiu atualizar o banco. Se a nova versão remove colunas, veja o log antes de continuar."
    false
fi
ok "Banco atualizado"

printf '  Gerando o build de produção…\n'
registrar npm run build
ln -s "$DADOS/data" "$NOVA/data"
ln -s "$DADOS/uploads" "$NOVA/uploads"
ok "Build concluído"

# ------------------------------------------------------------------------------
passo "Serviço e atalhos"
# ------------------------------------------------------------------------------
cat >"$W_HOME/bin/iniciar-servidor" <<SCRIPT
#!/bin/bash
# Chamado pelo launchd. Espera o MySQL e inicia o servidor do W-AZAP.
export PATH="$RUNTIME/node/bin:/usr/bin:/bin:/usr/sbin:/sbin"
export NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
cd "$APP" || exit 1
for _ in \$(seq 1 60); do
    "$RUNTIME/mysql/bin/mysqladmin" --no-defaults --protocol=tcp -h127.0.0.1 -P$MYSQL_PORTA ping >/dev/null 2>&1 && break
    sleep 1
done
exec "$APP/node_modules/.bin/tsx" src/server/index.ts
SCRIPT
chmod +x "$W_HOME/bin/iniciar-servidor"

cat >"$AGENTES_DIR/$LABEL.servidor.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key><string>$LABEL.servidor</string>
    <key>ProgramArguments</key>
    <array>
        <string>$W_HOME/bin/iniciar-servidor</string>
    </array>
    <key>WorkingDirectory</key><string>$APP</string>
    <key>RunAtLoad</key><true/>
    <key>KeepAlive</key><true/>
    <key>ThrottleInterval</key><integer>10</integer>
    <key>StandardOutPath</key><string>$LOGS/servidor.log</string>
    <key>StandardErrorPath</key><string>$LOGS/servidor.log</string>
</dict>
</plist>
PLIST

# Comando de controle: w-azap iniciar | parar | status | log | abrir | atualizar | auto-atualizacao | desinstalar
cat >"$W_HOME/bin/w-azap" <<SCRIPT
#!/bin/bash
# Controle do W-AZAP instalado em $W_HOME
W_HOME="$W_HOME"
APP="$APP"
DADOS="$DADOS"
LOGS="$LOGS"
LABEL="$LABEL"
APPS_DIR="$APPS_DIR"
AGENTES_DIR="$AGENTES_DIR"
MYSQL_PORTA="$MYSQL_PORTA"
DOMINIO="gui/\$(id -u)"
INSTALADOR_URL="https://github.com/$REPO/releases/latest/download/instalar-macos.sh"

porta() { grep -E '^PORT=' "\$DADOS/.env" | tail -n 1 | cut -d= -f2- | tr -d '"'; }
url() { echo "http://localhost:\$(porta)"; }
carregado() { launchctl print "\$DOMINIO/\$1" >/dev/null 2>&1; }
carregar() { carregado "\$1" || launchctl bootstrap "\$DOMINIO" "\$AGENTES_DIR/\$1.plist"; }
descarregar() { carregado "\$1" && launchctl bootout "\$DOMINIO/\$1" 2>/dev/null; return 0; }
responde() { curl -fsS -o /dev/null --max-time 3 "http://127.0.0.1:\$(porta)/" 2>/dev/null; }

case "\${1:-}" in
    iniciar|start)
        carregar "\$LABEL.mysql"; carregar "\$LABEL.servidor"
        echo "Iniciando… o painel fica em \$(url)" ;;
    parar|stop)
        descarregar "\$LABEL.servidor"; descarregar "\$LABEL.mysql"
        echo "W-AZAP parado. Ele volta a iniciar no próximo login (ou com: w-azap iniciar)." ;;
    reiniciar|restart)
        carregar "\$LABEL.mysql"
        if carregado "\$LABEL.servidor"; then launchctl kickstart -k "\$DOMINIO/\$LABEL.servidor"; else carregar "\$LABEL.servidor"; fi
        echo "Reiniciado." ;;
    status)
        carregado "\$LABEL.mysql" && echo "MySQL:    ativo (porta \$MYSQL_PORTA)" || echo "MySQL:    parado"
        if responde; then echo "Servidor: no ar em \$(url)"
        elif carregado "\$LABEL.servidor"; then echo "Servidor: iniciando (veja: w-azap log)"
        else echo "Servidor: parado"; fi
        echo "Versão:   \$(cat "\$W_HOME/versao" 2>/dev/null)"
        if [ -f "\$W_HOME/sem-auto-atualizacao" ]; then echo "Atualização automática: desligada"
        else echo "Atualização automática: ligada (confere a cada hora)"; fi ;;
    log|logs)
        if [ "\${2:-}" = "atualizacao" ]; then tail -n 100 "\$LOGS/atualizacao.log"
        else tail -n 100 -f "\$LOGS/servidor.log"; fi ;;
    abrir|open)
        carregar "\$LABEL.mysql"; carregar "\$LABEL.servidor"
        for _ in \$(seq 1 60); do responde && break; sleep 1; done
        open "\$(url)" ;;
    reconstruir|rebuild)
        # Necessário depois de mudar variáveis NEXT_PUBLIC_* ou a porta no .env. O build
        # é feito numa cópia da versão em uso, que continua no ar até a troca
        export PATH="\$W_HOME/runtime/node/bin:/usr/bin:/bin:/usr/sbin:/sbin" NEXT_TELEMETRY_DISABLED=1
        atual="\$(readlink "\$APP")"
        nova="\$W_HOME/versoes/\$(cat "\$W_HOME/versao")-\$(date +%Y%m%d%H%M%S)"
        { cp -cR "\$atual" "\$nova" 2>/dev/null || cp -R "\$atual" "\$nova"; } || exit 1
        # O Turbopack recusa os links para dados/ durante o build
        rm -f "\$nova/data" "\$nova/uploads"
        if ! (cd "\$nova" && npm run build); then
            rm -rf "\$nova"
            echo "O build falhou; a versão em uso não mudou."
            exit 1
        fi
        ln -s "\$DADOS/data" "\$nova/data"
        ln -s "\$DADOS/uploads" "\$nova/uploads"
        ln -sfn "\$nova" "\$APP"
        "\$0" reiniciar
        for pasta in "\$W_HOME"/versoes/*; do
            [ "\$pasta" = "\$nova" ] || [ "\$pasta" = "\$atual" ] || rm -rf "\$pasta"
        done ;;
    atualizar|update)
        curl -fsSL "\$INSTALADOR_URL" | bash ;;
    auto-atualizacao|auto-update)
        case "\${2:-}" in
            ligar|on)
                rm -f "\$W_HOME/sem-auto-atualizacao"
                carregar "\$LABEL.atualizador"
                echo "Atualização automática ligada: o W-AZAP confere a cada hora se saiu uma versão nova." ;;
            desligar|off)
                touch "\$W_HOME/sem-auto-atualizacao"
                descarregar "\$LABEL.atualizador"
                echo "Atualização automática desligada. Atualize quando quiser com: w-azap atualizar" ;;
            *)
                echo "Uso: w-azap auto-atualizacao ligar | desligar" ;;
        esac ;;
    desinstalar|uninstall)
        printf 'Remover o W-AZAP deste Mac? [s/N] '; { read -r r </dev/tty || read -r r; } 2>/dev/null
        case "\$r" in s|S|sim|Sim) ;; *) echo "Cancelado."; exit 0 ;; esac
        printf 'Apagar também os dados (banco, sessões do WhatsApp, mídias e .env)? [s/N] '; { read -r dados </dev/tty || read -r dados; } 2>/dev/null
        descarregar "\$LABEL.atualizador"; descarregar "\$LABEL.servidor"; descarregar "\$LABEL.mysql"
        rm -f "\$AGENTES_DIR/\$LABEL.atualizador.plist" "\$AGENTES_DIR/\$LABEL.servidor.plist" "\$AGENTES_DIR/\$LABEL.mysql.plist"
        rm -rf "\$APPS_DIR/W-AZAP.app"
        for atalho in /usr/local/bin/w-azap "\$HOME/.local/bin/w-azap"; do
            [ "\$(readlink "\$atalho" 2>/dev/null)" = "\$W_HOME/bin/w-azap" ] && rm -f "\$atalho"
        done
        case "\$dados" in
            s|S|sim|Sim)
                rm -rf "\$W_HOME"
                echo "W-AZAP removido por completo." ;;
            *)
                rm -rf "\$W_HOME/runtime" "\$W_HOME/bin" "\$W_HOME/versoes" "\$APP"
                echo "W-AZAP removido. Os dados ficaram em \$W_HOME (banco em mysql/data, .env e mídias em dados/)."
                echo "Reinstalar com o mesmo instalador reaproveita tudo." ;;
        esac ;;
    *)
        echo "Uso: w-azap iniciar | parar | reiniciar | status | log [atualizacao] | abrir | reconstruir | atualizar | auto-atualizacao ligar|desligar | desinstalar" ;;
esac
SCRIPT
chmod +x "$W_HOME/bin/w-azap"

# Atualização automática: chamado pelo launchd no login e a cada hora
cat >"$W_HOME/bin/atualizar-automatico" <<SCRIPT
#!/bin/bash
# Confere se saiu uma release nova do W-AZAP e, se saiu, baixa o instalador
# dela, confere o SHA-256 e atualiza sem perguntar nada. A versão atual fica no
# ar durante o build e volta sozinha se a nova não subir.
export PATH="/usr/bin:/bin:/usr/sbin:/sbin"
W_HOME="$W_HOME"
REPO="$REPO"
FALHA="\$W_HOME/atualizacao-falhou"

notificar() { osascript -e "display notification \"\$1\" with title \"W-AZAP\"" >/dev/null 2>&1 || true; }

[ -f "\$W_HOME/sem-auto-atualizacao" ] && exit 0
# Outra instalação ou atualização em andamento
kill -0 "\$(cat "\$W_HOME/.instalando/pid" 2>/dev/null)" 2>/dev/null && exit 0

ATUAL="\$(cat "\$W_HOME/versao" 2>/dev/null)"
ULTIMA="\$(curl -fsSI --max-time 30 "https://github.com/\$REPO/releases/latest" 2>/dev/null | awk -F/ 'tolower(\$1) ~ /^location:/ {print \$NF}' | tr -d '\r\n')"
# Sem internet ou sem release publicada: tenta de novo na próxima hora
case "\$ULTIMA" in v[0-9]*) ;; *) exit 0 ;; esac
[ "\$ULTIMA" = "\$ATUAL" ] && exit 0
# Só avança: nunca troca por uma versão mais antiga
[ "\$(printf '%s\n%s\n' "\${ATUAL#v}" "\${ULTIMA#v}" | sort -V | tail -n 1)" = "\${ULTIMA#v}" ] || exit 0
# Se esta versão falhou há menos de 6 horas, espera antes de tentar de novo
if [ "\$(cut -d' ' -f1 "\$FALHA" 2>/dev/null)" = "\$ULTIMA" ] &&
   [ "\$(( \$(date +%s) - \$(cut -d' ' -f2 "\$FALHA") ))" -lt 21600 ]; then
    exit 0
fi

echo
echo "[\$(date '+%Y-%m-%d %H:%M:%S')] Nova versão: \${ATUAL:-?} -> \$ULTIMA"
TMP="\$(mktemp -d)"
trap 'rm -rf "\$TMP"' EXIT
BASE="https://github.com/\$REPO/releases/download/\$ULTIMA"
if ! curl -fsSL --retry 3 -o "\$TMP/instalar-macos.sh" "\$BASE/instalar-macos.sh" ||
   ! curl -fsSL --retry 3 -o "\$TMP/SHA256SUMS" "\$BASE/SHA256SUMS-instalador.txt"; then
    # O workflow anexa o instalador alguns minutos depois de a release sair
    echo "O instalador da \$ULTIMA ainda não está disponível; tento de novo na próxima hora."
    exit 0
fi
ESPERADO="\$(awk '\$2 == "instalar-macos.sh" {print \$1}' "\$TMP/SHA256SUMS")"
OBTIDO="\$(shasum -a 256 "\$TMP/instalar-macos.sh" | awk '{print \$1}')"
if [ -z "\$ESPERADO" ] || [ "\$ESPERADO" != "\$OBTIDO" ]; then
    echo "O instalador baixado não confere com o SHA-256 da release; atualização cancelada."
    echo "\$ULTIMA \$(date +%s)" >"\$FALHA"
    exit 1
fi

if W_AZAP_HOME="\$W_HOME" W_AZAP_LABEL="$LABEL" W_AZAP_APPS_DIR="$APPS_DIR" W_AZAP_PORTA_MYSQL="$MYSQL_PORTA" \\
   W_AZAP_AUTOMATICO=1 W_AZAP_NAO_ABRIR=1 bash "\$TMP/instalar-macos.sh" </dev/null; then
    rm -f "\$FALHA"
    notificar "Atualizado para a versão \$ULTIMA."
else
    echo "\$ULTIMA \$(date +%s)" >"\$FALHA"
    notificar "Não deu para atualizar para a \$ULTIMA; a versão \${ATUAL:-atual} continua no ar. Detalhes: w-azap log atualizacao"
    exit 1
fi
SCRIPT
chmod +x "$W_HOME/bin/atualizar-automatico"

cat >"$AGENTES_DIR/$LABEL.atualizador.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key><string>$LABEL.atualizador</string>
    <key>ProgramArguments</key>
    <array>
        <string>$W_HOME/bin/atualizar-automatico</string>
    </array>
    <key>RunAtLoad</key><true/>
    <key>StartInterval</key><integer>3600</integer>
    <key>StandardOutPath</key><string>$LOGS/atualizacao.log</string>
    <key>StandardErrorPath</key><string>$LOGS/atualizacao.log</string>
</dict>
</plist>
PLIST

# Deixa o comando w-azap no PATH quando houver uma pasta de usuário adequada
ATALHO_CLI=""
for pasta in "$HOME/.local/bin" /usr/local/bin; do
    if [ -d "$pasta" ] && [ -w "$pasta" ] && [[ ":$PATH_ORIGINAL:" == *":$pasta:"* ]]; then
        ln -sfn "$W_HOME/bin/w-azap" "$pasta/w-azap"
        ATALHO_CLI="$pasta/w-azap"
        break
    fi
done 2>/dev/null || true

# App "W-AZAP" no Launchpad/Aplicativos: inicia (se preciso) e abre o painel
if command -v osacompile >/dev/null 2>&1; then
    mkdir -p "$APPS_DIR"
    rm -rf "$APPS_DIR/W-AZAP.app"
    if osacompile -o "$APPS_DIR/W-AZAP.app" \
        -e "do shell script quoted form of \"$W_HOME/bin/w-azap\" & \" abrir > /dev/null 2>&1 &\"" \
        >>"$LOG_INSTALACAO" 2>&1; then
        ok "App W-AZAP criado em $APPS_DIR"
    else
        aviso "Não consegui criar o app W-AZAP (opcional). Use: $W_HOME/bin/w-azap abrir"
    fi
fi

# Troca de versão: o painel fica fora do ar só enquanto o servidor reinicia
ANTERIOR="$(readlink "$APP" 2>/dev/null || true)"
descarregar_agente "$LABEL.servidor"
SERVIDOR_PARADO=1
if [ "$LEGADO" = "1" ]; then
    # Instalação anterior à v2.3.0: leva os dados de app/ para dados/ e guarda a
    # versão antiga em versoes/, para poder voltar a ela
    for item in data uploads; do
        if [ -d "$APP/$item" ] && [ ! -L "$APP/$item" ]; then
            if [ -e "$DADOS/$item" ]; then
                rsync -a "$APP/$item/" "$DADOS/$item/"
                rm -rf "${APP:?}/$item"
            else
                mv "$APP/$item" "$DADOS/$item"
            fi
        fi
        ln -sfn "$DADOS/$item" "$APP/$item"
    done
    if [ -f "$APP/.env" ] && [ ! -L "$APP/.env" ]; then cp -p "$APP/.env" "$DADOS/.env"; fi
    ln -sfn "$DADOS/.env" "$APP/.env"
    ANTERIOR="$VERSOES/$(cat "$W_HOME/versao" 2>/dev/null || echo antiga)-anterior"
    mv "$APP" "$ANTERIOR"
    LEGADO=0
    ok "Dados movidos para $DADOS"
fi
mkdir -p "$DADOS/data/media" "$DADOS/uploads"
ln -sfn "$NOVA" "$APP"
carregar_agente "$LABEL.servidor"
printf '  Aguardando o servidor responder…\n'
if ! esperar 120 "o servidor do W-AZAP responder" servidor_responde "$PORTA"; then
    tail -n 25 "$LOGS/servidor.log" >>"$LOG_INSTALACAO" 2>/dev/null || true
    voltar_versao_anterior || true
    erro "A versão $VERSAO não subiu (veja $LOGS/servidor.log)."
    false
fi
SERVIDOR_PARADO=0
echo "$VERSAO" >"$W_HOME/versao"
ok "Serviço ativo e configurado para iniciar no login"

# Guarda só a versão em uso e a anterior; remove Node.js antigos
for pasta in "$VERSOES"/*; do
    [ -d "$pasta" ] || continue
    if [ "$pasta" != "$NOVA" ] && [ "$pasta" != "$ANTERIOR" ]; then rm -rf "$pasta"; fi
done
for antigo in "$RUNTIME"/node-v*; do
    if [ -d "$antigo" ] && [ "$antigo" != "$RUNTIME/$NODE_PASTA" ]; then rm -rf "$antigo"; fi
done

if [ -f "$W_HOME/sem-auto-atualizacao" ]; then
    descarregar_agente "$LABEL.atualizador"
    aviso "Atualização automática desligada (para ligar: w-azap auto-atualizacao ligar)"
elif [ "$AUTOMATICO" = "1" ] && agente_carregado "$LABEL.atualizador"; then
    # Chamado pelo próprio atualizador: recarregá-lo agora encerraria esta atualização
    ok "Atualização automática ligada"
else
    carregar_agente "$LABEL.atualizador"
    ok "Atualização automática ligada: confere a cada hora se saiu uma versão nova"
fi

# ------------------------------------------------------------------------------
trap - ERR
URL_PAINEL="http://localhost:$PORTA"
printf '\n%s%s✓ W-AZAP %s %s com sucesso!%s\n\n' "$NEGRITO" "$VERDE" "$VERSAO" "$([ "$MODO" = "instalar" ] && echo instalado || echo atualizado)" "$FIM"
printf '  Painel:  %s%s%s\n' "$NEGRITO" "$URL_PAINEL" "$FIM"
if [ "$MODO" = "instalar" ]; then
    printf '  %sA primeira conta cadastrada vira administrador (SUPERADMIN).%s\n' "$AMARELO" "$FIM"
fi
printf '\n  Controle: %s\n' "${ATALHO_CLI:-$W_HOME/bin/w-azap}"
printf '    w-azap status | parar | iniciar | log | atualizar | auto-atualizacao | desinstalar\n'
printf '\n  Arquivos: %s (logs em %s)\n' "$W_HOME" "$LOGS"
printf '  Faça backup de %s/.env: a DATA_ENCRYPTION_KEY protege as sessões do WhatsApp.\n' "$DADOS"

if [ "${W_AZAP_NAO_ABRIR:-0}" != "1" ]; then
    open "$URL_PAINEL" >/dev/null 2>&1 || true
fi
pausar_se_command
