# 🔄 Guia de Atualização — W-AZAP

Mantenha sua instância do **W-AZAP** em dia com os recursos mais novos, as correções de segurança e as melhorias de desempenho.

---

## ✅ Antes de atualizar

1. **Faça backup do banco de dados** (ex.: `mysqldump -u usuario -p w_azap > backup.sql`).
2. **Guarde o `.env`**, principalmente `AUTH_SECRET` e `DATA_ENCRYPTION_KEY`. Sem a `DATA_ENCRYPTION_KEY` original, as sessões do WhatsApp não podem ser lidas e todos os QR codes terão de ser escaneados de novo.
3. Leia a seção [O que muda na 1.6.4](#-o-que-muda-na-164) se estiver vindo de uma versão anterior.

---

## 🚀 Processo de atualização

### Opção A: atualização automática (recomendada)

Se você usa PM2 com o script [`start.sh`](../start.sh) do projeto, basta:
```bash
git pull
./start.sh
```

O script executa, em ordem:
1. confere o `.env` e avisa se ainda houver senhas padrão;
2. verifica se a porta está livre;
3. instala as dependências (`npm install`, que também aplica o patch do Baileys);
4. sincroniza o schema do banco (`npx prisma db push`) e oferece a criação de um admin, se não houver nenhum;
5. compila o Next.js (`npm run build`);
6. recarrega o processo no PM2 sem tirar o sistema do ar.

---

### Opção B: atualização manual

#### 1. Baixar as mudanças
```bash
git pull
```

#### 2. Atualizar as dependências
```bash
npm install
npx patch-package     # garante o patch do Baileys (o npm 11+ pode bloquear o postinstall)
```

#### 3. Sincronizar o schema do banco
Se a atualização incluir mudanças no banco, rode:
```bash
npm run db:push
```
> [!NOTE]
> Em produção, se você mantém histórico de migrações, use `npx prisma migrate deploy`.

#### 4. Compilar e reiniciar
```bash
# Gera o pacote de produção otimizado
npm run build

# Reinicia o processo no PM2
pm2 restart w-azap
```

> [!IMPORTANT]
> Sempre reinicie o servidor depois de mudar o schema. O processo em execução mantém o Prisma Client antigo em memória: campos novos (como `sessionVersion`) geram erro e o login falha com "E-mail ou senha inválidos".

---

### Opção C: Docker

```bash
git pull
docker compose up -d --build
```
O container executa `prisma db push` automaticamente ao iniciar.

---

## 🏷️ Controle de versão

Para mudar a versão manualmente:

1. Abra o `package.json`.
2. Altere o campo `"version"` (ex.: `"1.6.4"` → `"1.6.5"`).
3. Compile a aplicação de novo.

A versão aparece no rodapé da **barra lateral do painel** e na página `/docs`.

---

## 🛠️ Solução de problemas

| Problema | Solução |
| :--- | :--- |
| **Erros de tipo do Prisma** / `Unknown field` | Rode `npx prisma generate` e reinicie o servidor. |
| **Login falha logo após atualizar** | O servidor ficou com o Prisma Client antigo em memória: reinicie (`pm2 restart w-azap`). |
| **Falha no build** | Apague `.next` e `node_modules`, rode `npm install` e `npx patch-package`. |
| **Erros do Baileys após `npm install`** | O patch não foi aplicado: rode `npx patch-package`. |
| **Sessões pedem QR de novo** | A `DATA_ENCRYPTION_KEY` (ou o `AUTH_SECRET`, se a chave não estava definida) mudou. Restaure o valor antigo. |
| **Painel inacessível pela rede** | O servidor agora escuta só em `127.0.0.1`. Use um proxy reverso ou defina `BIND_HOST="0.0.0.0"`. |
| **Webhook para `localhost`/rede interna parou** | Bloqueado contra SSRF. Defina `ALLOW_PRIVATE_WEBHOOK_URLS="true"` se for intencional. |
| **Erros de API** | Compare seu `.env` com o [`.env.example`](../.env.example) e com o [guia de variáveis](./ENVIRONMENT_VARIABLES.md). |

---

## 🔒 O que muda na 1.6.4

Esta versão traz uma revisão completa de segurança. Algumas mudanças exigem ação de quem atualiza:

| Mudança | Antes | Agora | Ação necessária |
| :--- | :--- | :--- | :--- |
| **Endereço de escuta** | `0.0.0.0` (toda a rede) | `127.0.0.1` (`BIND_HOST`) | Use proxy reverso ou `BIND_HOST="0.0.0.0"`. O Docker já vem configurado. |
| **Chaves de API** | Texto puro no banco, exibidas sempre | Hash SHA-256, exibidas uma única vez | Nenhuma: as chaves antigas continuam funcionando e são convertidas no primeiro uso. |
| **Sessões do WhatsApp** | Chaves em texto puro (`AuthState`) | Criptografadas com AES-256-GCM | Defina `DATA_ENCRYPTION_KEY` **antes** de atualizar; as linhas antigas são criptografadas na inicialização. |
| **Cadastro público** | Aberto por padrão | Fechado por padrão (o primeiro usuário vira Super Admin) | Crie usuários em **Usuários** ou reative o cadastro em **Configurações**. |
| **Senha mínima** | 6 caracteres | 8 caracteres | Vale para senhas novas. |
| **Swagger UI / `/docs`** | Senha fixa no `.env` (`NEXT_PUBLIC_SWAGGER_*`) | Login normal do painel | Remova `NEXT_PUBLIC_SWAGGER_USERNAME`/`PASSWORD` do `.env`. |
| **Socket.IO** | Sem autenticação, qualquer origem | Login ou chave de API, só origens permitidas | Integrações externas devem enviar `auth: { apiKey }`. Outras origens vão em `SOCKET_ALLOWED_ORIGINS`. |
| **Webhooks e URLs de mídia** | Qualquer destino | Só endereços públicos (anti-SSRF) | `ALLOW_PRIVATE_WEBHOOK_URLS="true"` para destinos internos. |
| **Arquivos locais em mídia** | Aceitava caminhos do disco | Só URLs http(s) públicas ou arquivos enviados na própria requisição (multipart) | Ajuste integrações que enviavam caminhos locais. |
| **Limites** | Sem limite efetivo | `RATE_LIMIT_PER_MINUTE`, `MAX_UPLOAD_SIZE_MB` e bloqueio de login | Ajuste os valores se tiver integrações de alto volume. |
| **Revogação de login** | O JWT valia até expirar | Trocar senha, e-mail ou papel encerra as sessões | Nenhuma. |
| **Heartbeat** | Enviava dados ao servidor do autor original | Removido | Nenhuma. |
| **Cabeçalhos HTTP** | Nenhum | CSP, `X-Frame-Options`, HSTS (em HTTPS)… | Se você embutia o painel em `<iframe>`, isso não funciona mais. |

### Mudanças da 1.6.1 (ainda válidas)

| Mudança | Antes | Agora |
| :--- | :--- | :--- |
| **`AUTH_SECRET` obrigatório** | Usava `"secret"` se não estivesse definido | O servidor encerra com erro se não estiver definido |
| **Senha em texto puro** | `bcrypt.compare() \|\| password === user.password` | Apenas `bcrypt.compare()` |
| **Credenciais do Docker** | Fixas no `docker-compose.yml` | Lidas do arquivo `.env` |
| **`GET /api/settings/system`** | Sem autenticação | Exige login |
| **`generateApiKey()`** | `Math.random()` | `crypto.randomBytes()` |

> [!IMPORTANT]
> No Docker, crie o `.env` a partir do `.env.example` **antes** do `docker compose up` e preencha `AUTH_SECRET`, `DATA_ENCRYPTION_KEY` e `MYSQL_ROOT_PASSWORD`.

---
<div align="center">

**Versão**: 1.6.4 | **Última verificação**: 2026-10-09

</div>
