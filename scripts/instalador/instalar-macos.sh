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
APP="$W_HOME/app"
LOGS="$W_HOME/logs"
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
    erro "A instalação parou (código $codigo)."
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
    # valor_env CHAVE -> valor no .env do app (sem aspas)
    { grep -E "^$1=" "$APP/.env" 2>/dev/null || true; } | tail -n 1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//'
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

mkdir -p "$RUNTIME" "$LOGS" "$W_HOME/bin" "$W_HOME/mysql" "$W_HOME/downloads"
: >"$LOG_INSTALACAO"

if [ -f "$APP/.env" ]; then
    MODO="atualizar"
    ok "Instalação existente encontrada em $W_HOME: vou atualizar."
else
    MODO="instalar"
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
    # Para o servidor antes de trocar o Node e o código; o MySQL continua no ar
    descarregar_agente "$LABEL.servidor"
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
# Remove versões antigas do Node deixadas por atualizações anteriores
for antigo in "$RUNTIME"/node-v*; do
    if [ -d "$antigo" ] && [ "$antigo" != "$RUNTIME/$NODE_PASTA" ]; then rm -rf "$antigo"; fi
done
export PATH="$RUNTIME/node/bin:/usr/bin:/bin:/usr/sbin:/sbin"
export NEXT_TELEMETRY_DISABLED=1

# ------------------------------------------------------------------------------
passo "MySQL $MYSQL_VERSAO"
# ------------------------------------------------------------------------------
MYSQL_PASTA="mysql-$MYSQL_VERSAO-macos15-$MYSQL_ARQ"
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

mkdir -p "$APP"
# Mantém configuração e dados: .env, data/ (sessões), uploads/ (mídias)
rsync -a --delete \
    --exclude '/.env' --exclude '/data/' --exclude '/uploads/' --exclude '/node_modules/' \
    "$CODIGO/" "$APP/"
rm -rf "$TMP"
mkdir -p "$APP/data" "$APP/uploads"
ok "Código em $APP"

# ------------------------------------------------------------------------------
passo "Banco de dados"
# ------------------------------------------------------------------------------
cat >"$MYSQL_CNF" <<CNF
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

mkdir -p "$AGENTES_DIR"
cat >"$AGENTES_DIR/$LABEL.mysql.plist" <<PLIST
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

carregar_agente "$LABEL.mysql"
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
    cat >"$APP/.env" <<ENV
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
    ok "Mantida a configuração atual ($APP/.env)"
fi

# ------------------------------------------------------------------------------
passo "Dependências e build (pode levar alguns minutos)"
# ------------------------------------------------------------------------------
cd "$APP"
printf '  Instalando dependências…\n'
registrar npm ci --legacy-peer-deps --no-audit --no-fund
# O npm 11+ pode bloquear scripts de instalação; garante o patch do Baileys e o Prisma Client
registrar npx --no-install patch-package
registrar npx --no-install prisma generate
ok "Dependências instaladas"

printf '  Atualizando as tabelas do banco…\n'
if ! registrar npx --no-install prisma db push --skip-generate; then
    erro "O Prisma não conseguiu atualizar o banco. Se a nova versão remove colunas, veja o log antes de continuar."
    false
fi
ok "Banco atualizado"

printf '  Gerando o build de produção…\n'
registrar npm run build
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

# Comando de controle: w-azap iniciar | parar | status | log | abrir | atualizar | desinstalar
cat >"$W_HOME/bin/w-azap" <<SCRIPT
#!/bin/bash
# Controle do W-AZAP instalado em $W_HOME
W_HOME="$W_HOME"
APP="$APP"
LOGS="$LOGS"
LABEL="$LABEL"
APPS_DIR="$APPS_DIR"
AGENTES_DIR="$AGENTES_DIR"
MYSQL_PORTA="$MYSQL_PORTA"
DOMINIO="gui/\$(id -u)"
INSTALADOR_URL="https://github.com/$REPO/releases/latest/download/instalar-macos.sh"

porta() { grep -E '^PORT=' "\$APP/.env" | tail -n 1 | cut -d= -f2- | tr -d '"'; }
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
        echo "Versão:   \$(cat "\$W_HOME/versao" 2>/dev/null)" ;;
    log|logs)
        tail -n 100 -f "\$LOGS/servidor.log" ;;
    abrir|open)
        carregar "\$LABEL.mysql"; carregar "\$LABEL.servidor"
        for _ in \$(seq 1 60); do responde && break; sleep 1; done
        open "\$(url)" ;;
    reconstruir|rebuild)
        # Necessário depois de mudar variáveis NEXT_PUBLIC_* ou a porta no .env
        export PATH="\$W_HOME/runtime/node/bin:/usr/bin:/bin:/usr/sbin:/sbin" NEXT_TELEMETRY_DISABLED=1
        (cd "\$APP" && npm run build) && "\$0" reiniciar ;;
    atualizar|update)
        curl -fsSL "\$INSTALADOR_URL" | bash ;;
    desinstalar|uninstall)
        printf 'Remover o W-AZAP deste Mac? [s/N] '; { read -r r </dev/tty || read -r r; } 2>/dev/null
        case "\$r" in s|S|sim|Sim) ;; *) echo "Cancelado."; exit 0 ;; esac
        printf 'Apagar também os dados (banco, sessões do WhatsApp, mídias e .env)? [s/N] '; { read -r dados </dev/tty || read -r dados; } 2>/dev/null
        descarregar "\$LABEL.servidor"; descarregar "\$LABEL.mysql"
        rm -f "\$AGENTES_DIR/\$LABEL.servidor.plist" "\$AGENTES_DIR/\$LABEL.mysql.plist"
        rm -rf "\$APPS_DIR/W-AZAP.app"
        for atalho in /usr/local/bin/w-azap "\$HOME/.local/bin/w-azap"; do
            [ "\$(readlink "\$atalho" 2>/dev/null)" = "\$W_HOME/bin/w-azap" ] && rm -f "\$atalho"
        done
        case "\$dados" in
            s|S|sim|Sim)
                rm -rf "\$W_HOME"
                echo "W-AZAP removido por completo." ;;
            *)
                rm -rf "\$W_HOME/runtime" "\$W_HOME/bin" "\$APP/node_modules" "\$APP/.next"
                echo "W-AZAP removido. Os dados ficaram em \$W_HOME (banco em mysql/data, .env e sessões em app/)."
                echo "Reinstalar com o mesmo instalador reaproveita tudo." ;;
        esac ;;
    *)
        echo "Uso: w-azap iniciar | parar | reiniciar | status | log | abrir | reconstruir | atualizar | desinstalar" ;;
esac
SCRIPT
chmod +x "$W_HOME/bin/w-azap"

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

carregar_agente "$LABEL.servidor"
printf '  Aguardando o servidor responder…\n'
esperar 120 "o servidor do W-AZAP responder" servidor_responde "$PORTA"
echo "$VERSAO" >"$W_HOME/versao"
ok "Serviço ativo e configurado para iniciar no login"

# ------------------------------------------------------------------------------
trap - ERR
URL_PAINEL="http://localhost:$PORTA"
printf '\n%s%s✓ W-AZAP %s %s com sucesso!%s\n\n' "$NEGRITO" "$VERDE" "$VERSAO" "$([ "$MODO" = "instalar" ] && echo instalado || echo atualizado)" "$FIM"
printf '  Painel:  %s%s%s\n' "$NEGRITO" "$URL_PAINEL" "$FIM"
if [ "$MODO" = "instalar" ]; then
    printf '  %sA primeira conta cadastrada vira administrador (SUPERADMIN).%s\n' "$AMARELO" "$FIM"
fi
printf '\n  Controle: %s\n' "${ATALHO_CLI:-$W_HOME/bin/w-azap}"
printf '    w-azap status | parar | iniciar | log | atualizar | desinstalar\n'
printf '\n  Arquivos: %s (logs em %s)\n' "$W_HOME" "$LOGS"
printf '  Faça backup de %s/.env: a DATA_ENCRYPTION_KEY protege as sessões do WhatsApp.\n' "$APP"

if [ "${W_AZAP_NAO_ABRIR:-0}" != "1" ]; then
    open "$URL_PAINEL" >/dev/null 2>&1 || true
fi
pausar_se_command
