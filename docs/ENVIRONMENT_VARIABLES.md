# 🔐 Guia de Variáveis de Ambiente

Referência completa das opções de configuração do **W-AZAP**. O modelo comentado fica em [`.env.example`](../.env.example). Comece com:

```bash
cp .env.example .env
```

> [!WARNING]
> Nunca faça commit do arquivo `.env` no Git. Ele contém credenciais que, se vazarem, comprometem todo o sistema e as contas do WhatsApp conectadas.

> [!NOTE]
> Variáveis com prefixo `NEXT_PUBLIC_` são embutidas no JavaScript enviado ao navegador e podem ser vistas por qualquer visitante. **Nunca coloque segredos nelas.**

---

## 🎯 1. Configurações essenciais

Variáveis indispensáveis para a aplicação funcionar.

| Variável | Tipo | Padrão | Descrição |
| :--- | :--- | :--- | :--- |
| `PORT` | número | `3030` (`.env.example`: `3000`) | Porta em que o servidor escuta. Confirme que ela está livre. |
| `DATABASE_URL` | string | — | String de conexão do banco (ex.: `mysql://usuario:senha@localhost:3306/w_azap` ou `postgresql://usuario:senha@localhost:5432/w_azap?schema=public`). |
| `AUTH_SECRET` | string | — | Chave criptográfica que assina os logins (JWT). **O servidor não inicia sem ela.** Gere com `openssl rand -base64 32`. |
| `BASE_URL` | string | `http://localhost:3000` | URL pública da aplicação. É usada nos redirecionamentos de login, na geração de URLs e na lista de origens permitidas no Socket.IO. |
| `NODE_ENV` | string | `development` | Modo de execução (`development` \| `production` \| `test`). `npm start` já define `production`. |
| `HOSTNAME` | string | `localhost` | Nome do host repassado ao Next.js. **Não** controla em que interface o servidor escuta (para isso, veja `BIND_HOST`). |

---

## 🔗 2. NextAuth e proxy reverso

| Variável | Tipo | Padrão | Descrição |
| :--- | :--- | :--- | :--- |
| `NEXTAUTH_URL` | string | `${BASE_URL}` | URL do serviço de autenticação. Deve ser igual a `BASE_URL`. |
| `AUTH_TRUST_HOST` | booleano | `true` | Faz o NextAuth confiar no cabeçalho `Host`. Necessário atrás de proxy reverso (Nginx, Cloudflare, Apache). |
| `NEXT_PUBLIC_APP_URL` | string | `${BASE_URL}` | URL pública usada no navegador. |
| `NEXT_PUBLIC_API_URL` | string | `${BASE_URL}/api` | URL base da API mostrada no Swagger e na documentação. |

> [!TIP]
> Se o site for servido em `https://`, o cookie de login passa a se chamar `__Secure-authjs.session-token` e o cabeçalho HSTS é ativado automaticamente.

---

## 🎨 3. Marca e opções gerais

| Variável | Tipo | Padrão | Descrição |
| :--- | :--- | :--- | :--- |
| `NEXT_PUBLIC_CHAT_PAGE_SIZE` | número | `50` | Quantidade de conversas carregadas por página no chat. |
| `NEXT_PUBLIC_ALLOW_INDEXING` | booleano | `false` | `true` permite que buscadores indexem as páginas públicas (útil para landing pages). |
| `APP_NAME` | string | `W-AZAP` | ⚠️ **Reservada.** O nome exibido é definido em **Painel › Configurações** e fica salvo no banco. |
| `LOGO_URL` | string | — | ⚠️ **Reservada.** Configure em **Painel › Configurações**. |
| `FAVICON_URL` | string | — | ⚠️ **Reservada.** Configure em **Painel › Configurações**. |

---

## 📚 4. Documentação da API (`/swagger` e `/docs`)

| Variável | Tipo | Padrão | Descrição |
| :--- | :--- | :--- | :--- |
| `NEXT_PUBLIC_SWAGGER_ENABLED` | booleano | `true` | `false` desativa o Swagger UI (`/swagger`) e a especificação (`/api/docs`). |

O Swagger UI e a especificação exigem **login normal no painel**. As antigas `NEXT_PUBLIC_SWAGGER_USERNAME` e `NEXT_PUBLIC_SWAGGER_PASSWORD` foram removidas: por serem `NEXT_PUBLIC_`, iam parar no navegador e não protegiam nada. Pode apagá-las do seu `.env`.

---

## 🔌 5. Núcleo do WhatsApp (motor Baileys)

| Variável | Tipo | Padrão | Descrição |
| :--- | :--- | :--- | :--- |
| `BAILEYS_LOG_LEVEL` | string | `error` | Nível de log do socket do WhatsApp: `trace` \| `debug` \| `info` \| `warn` \| `error` \| `fatal`. Em produção, use `error` para reduzir o ruído. |

---

## 🔧 6. Integrações e recursos opcionais

| Variável | Tipo | Padrão | Descrição |
| :--- | :--- | :--- | :--- |
| `REMOVE_BG_API_KEY` | string | — | ⚠️ **Reservada.** A chave do [remove.bg](https://www.remove.bg) é configurada **por sessão** em **Painel › Configurações do bot**. |
| `ENABLE_NOTIFICATIONS` | booleano | `true` | ⚠️ **Reservada**, sem efeito atualmente. |
| `ENABLE_AUTO_UPDATE_CHECK` | booleano | `true` | ⚠️ **Reservada.** A verificação de atualizações é manual, pela página **Configurações** (somente Super Admin). |
| `ENABLE_EXPERIMENTAL_FEATURES` | booleano | `false` | ⚠️ **Reservada**, sem efeito atualmente. |

---

## 🛡️ 7. Segurança e limites

| Variável | Tipo | Padrão | Descrição |
| :--- | :--- | :--- | :--- |
| `BIND_HOST` | string | `127.0.0.1` | Interface de rede em que o servidor escuta. `127.0.0.1` aceita só conexões da própria máquina (ideal com proxy reverso no mesmo host). Use `0.0.0.0` apenas no Docker ou quando a rede precisar acessar diretamente. |
| `DATA_ENCRYPTION_KEY` | string | derivada do `AUTH_SECRET` | Chave de 32 bytes (base64 ou hex de 64 caracteres) que criptografa as chaves de sessão do WhatsApp no banco (AES-256-GCM). Gere com `openssl rand -base64 32`. **Guarde com cuidado:** perdê-la obriga a escanear todos os QR codes de novo. Se ficar vazia, a chave é derivada do `AUTH_SECRET`, e trocar o `AUTH_SECRET` também invalida as sessões. |
| `SESSION_TIMEOUT_HOURS` | número | `24` | Horas até o login expirar e o usuário ter de entrar de novo. |
| `MAX_UPLOAD_SIZE_MB` | número | `50` | Tamanho máximo de upload e de download de mídia, em MB. Requisições maiores recebem `413`. |
| `ENABLE_RATE_LIMITING` | booleano | `true` | Limita requisições à API contra abuso e força bruta. |
| `RATE_LIMIT_PER_MINUTE` | número | `60` | Máximo de requisições por minuto por chave de API ou IP. Sessões logadas no navegador recebem 10× esse valor, porque o painel faz consultas periódicas. Respostas acima do limite recebem `429` com `Retry-After`. |
| `TRUST_PROXY` | booleano | `false` | `true` faz o sistema usar o IP do cabeçalho `X-Forwarded-For` no rate limit. Ative **somente** atrás de um proxy reverso que defina esse cabeçalho; caso contrário, qualquer cliente pode forjar o próprio IP. |
| `ALLOW_PRIVATE_WEBHOOK_URLS` | booleano | `false` | Webhooks e URLs de mídia para endereços internos (`localhost`, `192.168.x.x`, `10.x.x.x`, metadados de nuvem…) são bloqueados contra SSRF. Use `true` se você envia webhooks de propósito para um serviço da sua rede (ex.: n8n local). Vale também para o servidor SMTP do **Encaminhar por e-mail** (ex.: um relay na rede local). |
| `SOCKET_ALLOWED_ORIGINS` | string | — | Origens extras autorizadas a abrir o socket de tempo real, separadas por vírgula (ex.: `https://painel.exemplo.com,https://app.exemplo.com`). `BASE_URL`, `NEXT_PUBLIC_APP_URL`, `NEXTAUTH_URL`, `http://localhost:PORT` e `http://127.0.0.1:PORT` já são permitidas. |

Além disso, há limites fixos, sem variável:

- login: 5 tentativas por conta e 20 por IP a cada 15 minutos;
- cadastro: 10 por IP por hora;
- senha: mínimo de 8 caracteres.

---

## 🌍 8. Localização e armazenamento

| Variável | Tipo | Padrão | Descrição |
| :--- | :--- | :--- | :--- |
| `TZ` | string | `America/Sao_Paulo` | Fuso horário do processo Node.js (ex.: `America/Sao_Paulo`, `UTC`). O fuso usado pelo **agendador** é o definido em **Painel › Configurações**. |
| `LOCALE` | string | `id-ID` | ⚠️ **Reservada.** O idioma da interface é escolhido por usuário no seletor do canto superior direito (14 idiomas) ou detectado pelo navegador. |
| `MEDIA_STORAGE_PATH` | string | `uploads` | ⚠️ **Reservada.** A mídia baixada é sempre gravada em `data/media/`, na raiz do projeto (no Docker, fica no volume `app_data`). |
| `NEXT_PUBLIC_GA_ID` | string | — | ⚠️ **Reservada**, sem efeito atualmente. |

---

## 🐳 9. Variáveis do Docker Compose

Necessárias **somente** ao usar o `docker-compose.yml`.

| Variável | Obrigatória | Padrão | Descrição |
| :--- | :--- | :--- | :--- |
| `MYSQL_ROOT_PASSWORD` | **Sim** | — | Senha do root no container do MySQL. |
| `MYSQL_DATABASE` | Não | `w_azap` | Nome do banco de dados. |
| `ADMIN_EMAIL` | Recomendada | — | E-mail do Super Admin criado na primeira inicialização. |
| `ADMIN_PASSWORD` | Recomendada | — | Senha do Super Admin criado na primeira inicialização (mínimo de 8 caracteres). |

No Docker, `BIND_HOST=0.0.0.0` já vem definido (é necessário dentro do container), e a porta do MySQL é publicada apenas em `127.0.0.1`. Também repasse `AUTH_SECRET`, `DATA_ENCRYPTION_KEY` e `BASE_URL` pelo `.env`.

---

## ✅ Checklist para produção

- [ ] `AUTH_SECRET` e `DATA_ENCRYPTION_KEY` gerados com `openssl rand -base64 32` e guardados em local seguro (cofre de senhas).
- [ ] `BASE_URL`, `NEXTAUTH_URL` e `NEXT_PUBLIC_APP_URL` com o domínio real em `https://`.
- [ ] `BIND_HOST="127.0.0.1"` com proxy reverso (Nginx/Caddy) fazendo o HTTPS.
- [ ] `TRUST_PROXY="true"` somente se o proxy definir `X-Forwarded-For`.
- [ ] Nenhuma senha de exemplo (`change-this-in-production`) no `.env`.
- [ ] Cadastro público desativado em **Configurações** (padrão).

---

<div align="center">

**Atualizado em**: outubro de 2026 | **Versão**: 1.6.4

</div>
