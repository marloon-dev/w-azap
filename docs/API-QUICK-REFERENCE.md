# Referência Rápida da API

Guia rápido das operações mais comuns da API do W-AZAP. A referência completa, com todos os campos e respostas, está em [API_DOCUMENTATION.md](./API_DOCUMENTATION.md).

> **Versão**: 1.6.4 | **Atualizado em**: outubro de 2026

## URL base

```
http://localhost:3000/api
```

Troque pelo valor do seu `BASE_URL` (ex.: `https://whatsapp.suaempresa.com/api`).

## Autenticação

### Chave de API (integrações)
Envie o cabeçalho em todas as requisições:
```
X-API-Key: wag_sua-chave-aqui
```

> [!TIP]
> Gere a chave em **Painel › Webhooks e API**. O formato é `wag_` seguido de 32 caracteres aleatórios. A chave é exibida **uma única vez**; depois o painel mostra só o início dela. Se perder a chave, gere uma nova (a anterior deixa de funcionar na hora).

### Sessão do navegador
O cookie do NextAuth (`authjs.session-token`, ou `__Secure-authjs.session-token` em HTTPS) é enviado automaticamente quando você está logado no painel.

> [!NOTE]
> Algumas rotas administrativas (gestão de usuários, geração de chave de API) **não aceitam** chave de API e exigem login no navegador.

### Limites
- `RATE_LIMIT_PER_MINUTE` requisições por minuto por chave (padrão: 60). Os cabeçalhos `X-RateLimit-Limit` e `X-RateLimit-Remaining` mostram o consumo; acima do limite, a resposta é `429` com `Retry-After`.
- Corpo da requisição de até `MAX_UPLOAD_SIZE_MB` (padrão: 50 MB); acima disso, `413`.

---

## Operações comuns

> Nos exemplos, `vendas-01` é o ID da sessão e `5511987654321` um número com DDI e DDD. Sempre **codifique o JID na URL** (`@` vira `%40`).

### 1. Criar uma sessão do WhatsApp

```bash
curl -X POST http://localhost:3000/api/sessions \
  -H "X-API-Key: sua-chave" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Equipe de vendas",
    "sessionId": "vendas-01"
  }'
```

O `sessionId` é opcional (de 3 a 50 caracteres: letras, números, `-` e `_`). Se omitido, um ID aleatório é gerado.

### 2. Obter o QR code

```bash
curl http://localhost:3000/api/sessions/vendas-01/qr \
  -H "X-API-Key: sua-chave"
```

### 3. Listar as sessões

```bash
curl http://localhost:3000/api/sessions \
  -H "X-API-Key: sua-chave"
```

### 4. Enviar uma mensagem de texto

```bash
curl -X POST http://localhost:3000/api/messages/vendas-01/5511987654321%40s.whatsapp.net/send \
  -H "X-API-Key: sua-chave" \
  -H "Content-Type: application/json" \
  -d '{
    "message": {
      "text": "Olá pela API!"
    }
  }'
```

### 5. Enviar uma imagem

```bash
curl -X POST http://localhost:3000/api/messages/vendas-01/5511987654321%40s.whatsapp.net/send \
  -H "X-API-Key: sua-chave" \
  -H "Content-Type: application/json" \
  -d '{
    "message": {
      "image": { "url": "https://exemplo.com/imagem.jpg" },
      "caption": "Dá uma olhada!"
    }
  }'
```

> [!IMPORTANT]
> A URL da mídia precisa ser **pública** (`http`/`https`). Endereços internos (`localhost`, `192.168.x.x`…) e caminhos de arquivos locais são recusados. O tamanho máximo é `MAX_UPLOAD_SIZE_MB`. Para enviar um arquivo do seu computador, use `POST /messages/{sessionId}/{jid}/media` com `multipart/form-data`.

### 6. Enviar um arquivo (upload)

```bash
curl -X POST http://localhost:3000/api/messages/vendas-01/5511987654321%40s.whatsapp.net/media \
  -H "X-API-Key: sua-chave" \
  -F "file=@/caminho/para/arquivo.pdf" \
  -F "type=document" \
  -F "caption=Segue o contrato"
```

### 7. Transmissão (broadcast)

```bash
curl -X POST http://localhost:3000/api/messages/vendas-01/broadcast \
  -H "X-API-Key: sua-chave" \
  -H "Content-Type: application/json" \
  -d '{
    "recipients": [
      "5511987654321@s.whatsapp.net",
      "5521912345678@s.whatsapp.net"
    ],
    "message": "Mensagem para todos",
    "delay": 5000
  }'
```

O `delay` (em ms, padrão 2000) recebe um acréscimo aleatório de até 50% a cada envio. Consulte o andamento em `GET /messages/{sessionId}/broadcast/history`.

### 8. Criar uma resposta automática

```bash
curl -X POST http://localhost:3000/api/autoreplies/vendas-01 \
  -H "X-API-Key: sua-chave" \
  -H "Content-Type: application/json" \
  -d '{
    "keyword": "oi",
    "response": "Olá! Como posso ajudar?",
    "matchType": "EXACT"
  }'
```

### 9. Agendar uma mensagem

```bash
curl -X POST http://localhost:3000/api/scheduler/vendas-01 \
  -H "X-API-Key: sua-chave" \
  -H "Content-Type: application/json" \
  -d '{
    "jid": "5511987654321@s.whatsapp.net",
    "content": "Mensagem agendada",
    "sendAt": "2026-12-31T23:59"
  }'
```

O `sendAt` é interpretado no **fuso horário definido em Configurações**.

### 10. Criar um webhook

```bash
curl -X POST http://localhost:3000/api/webhooks/vendas-01 \
  -H "X-API-Key: sua-chave" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Meu webhook",
    "url": "https://seu-servidor.com/webhook",
    "secret": "segredo-do-webhook",
    "events": ["message.received", "message.sent"]
  }'
```

### 11. Listar as conversas

```bash
curl http://localhost:3000/api/chat/vendas-01 \
  -H "X-API-Key: sua-chave"
```

### 12. Mensagens de uma conversa

```bash
curl http://localhost:3000/api/chat/vendas-01/5511987654321%40s.whatsapp.net \
  -H "X-API-Key: sua-chave"
```

### 13. Contatos (paginados)

```bash
curl "http://localhost:3000/api/contacts/vendas-01?page=1&limit=20&search=joao" \
  -H "X-API-Key: sua-chave"
```

Use `limit=all` para trazer todos de uma vez.

### 14. Listar os grupos

```bash
curl http://localhost:3000/api/groups/vendas-01 \
  -H "X-API-Key: sua-chave"
```

### 15. Criar um grupo

```bash
curl -X POST http://localhost:3000/api/groups/vendas-01/create \
  -H "X-API-Key: sua-chave" \
  -H "Content-Type: application/json" \
  -d '{
    "subject": "Meu grupo",
    "participants": [
      "5511987654321@s.whatsapp.net",
      "5521912345678@s.whatsapp.net"
    ]
  }'
```

### 16. Atualizar a configuração do bot

```bash
curl -X POST http://localhost:3000/api/sessions/vendas-01/bot-config \
  -H "X-API-Key: sua-chave" \
  -H "Content-Type: application/json" \
  -d '{
    "enabled": true,
    "botMode": "ALL",
    "autoReplyMode": "ALL",
    "enableSticker": true,
    "enablePing": true,
    "botName": "Meu bot"
  }'
```

### 17. Verificar números no WhatsApp

```bash
curl -X POST http://localhost:3000/api/chat/vendas-01/check \
  -H "X-API-Key: sua-chave" \
  -H "Content-Type: application/json" \
  -d '{ "numbers": ["5511987654321", "5521912345678"] }'
```

Até 50 números por requisição.

---

## Formato do JID

O WhatsApp identifica contatos e grupos por JID (Jabber ID):

- **Contato:** `5511987654321@s.whatsapp.net`
- **Grupo:** `120363123456789@g.us`
- **Status:** `status@broadcast`
- **LID (identificador oculto):** `100429287395370@lid`

> **Observação:** use o número com código do país (DDI) e DDD, sem `+`, espaços ou traços.

---

## Tipos de correspondência (resposta automática)

- `EXACT`: a mensagem é exatamente a palavra-chave (sem diferenciar maiúsculas e minúsculas).
- `CONTAINS`: a mensagem contém a palavra-chave em qualquer posição.
- `REGEX`: a palavra-chave é uma expressão regular (ex.: `^pedido\s+\d+`).

> ⚠️ `STARTS_WITH` é aceito pela API, mas ainda não é aplicado pelo motor de respostas. Use `REGEX` com `^palavra`.

---

## Modos de acesso (`botMode` e `autoReplyMode`)

- `OWNER`: apenas o dono da sessão (padrão de `botMode`).
- `ALL`: todos (padrão de `autoReplyMode`).
- `SPECIFIC`: apenas os JIDs em `botAllowedJids` / `autoReplyAllowedJids` (whitelist).
- `BLACKLIST`: todos, exceto os JIDs em `botBlockedJids` / `autoReplyBlockedJids`.

O contexto das respostas automáticas (`ALL`, `PRIVATE`, `GROUP`) é definido em cada regra.

---

## Eventos de webhook

| Evento | Quando dispara |
| :--- | :--- |
| `message.received` | Mensagem recebida |
| `message.sent` | Mensagem enviada |
| `message.status` | Mudança de status (entregue, lida…) |
| `message.deleted` | Mensagem apagada |
| `message.edited` | Mensagem editada |
| `connection.update` | Mudança no status da conexão |
| `group.update` | Alteração nos dados de um grupo |
| `group.participant` | Entrada ou saída de participantes |
| `contact.update` | Atualização de contato |
| `status.update` | Novo status (story) de um contato |
| `*` | Todos os eventos |

---

## Papéis de usuário

- `SUPERADMIN`: acesso total, gerencia todos os usuários, sessões e configurações.
- `OWNER`: gerencia as próprias sessões e recursos.
- `STAFF`: acesso apenas às sessões compartilhadas com ele.

---

## Códigos de resposta

| Código | Significado |
| :--- | :--- |
| `200` | Sucesso |
| `400` | Requisição inválida (erro de validação ou URL de mídia recusada) |
| `401` | Não autenticado (chave ausente ou inválida) |
| `403` | Sem permissão para esta sessão ou recurso |
| `404` | Não encontrado |
| `413` | Corpo da requisição maior que `MAX_UPLOAD_SIZE_MB` |
| `429` | Limite de requisições excedido (veja `Retry-After`) |
| `500` | Erro interno do servidor |
| `503` | Sessão indisponível (desconectada ou ainda conectando) |

Todas as respostas seguem o formato `{ "status": true|false, "message": "...", "data": ... }`.

---

## Dicas

1. **Confira o status da sessão** antes de enviar mensagens.
2. **Use webhooks** em vez de consultas repetidas (polling) para receber eventos em tempo real.
3. **Valide o HMAC do webhook**: toda entrega vem assinada no cabeçalho `X-Webhook-Signature: sha256=...`. Veja o [guia de verificação](#verificação-do-hmac-do-webhook).
4. **Use intervalos** em operações em massa para evitar bloqueios do WhatsApp.
5. **Guarde as chaves de API em segurança**: nunca faça commit delas no Git.
6. **Codifique os JIDs** quando usá-los na URL (`encodeURIComponent`).
7. **Verifique o campo `status`** de cada resposta e trate os erros.

---

## Verificação do HMAC do webhook

```javascript
import crypto from "crypto";
import express from "express";

const app = express();
const SECRET = process.env.WEBHOOK_SECRET;

// Use o corpo bruto: o HMAC é calculado sobre os bytes exatos enviados
app.post("/webhook", express.raw({ type: "application/json" }), (req, res) => {
  const recebido = req.get("X-Webhook-Signature") || "";
  const esperado = "sha256=" + crypto.createHmac("sha256", SECRET).update(req.body).digest("hex");

  const ok = recebido.length === esperado.length &&
    crypto.timingSafeEqual(Buffer.from(recebido), Buffer.from(esperado));
  if (!ok) return res.status(401).send("assinatura inválida");

  const evento = JSON.parse(req.body.toString("utf8"));
  console.log(evento.event, evento.data);
  res.sendStatus(200);
});

app.listen(4000);
```

---

## Exemplo em JavaScript/TypeScript

```typescript
const apiKey = 'wag_sua-chave';
const baseUrl = 'http://localhost:3000/api';

async function enviarMensagem(sessionId: string, jid: string, texto: string) {
  const jidCodificado = encodeURIComponent(jid);
  const response = await fetch(`${baseUrl}/messages/${sessionId}/${jidCodificado}/send`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': apiKey
    },
    body: JSON.stringify({
      message: { text: texto }
    })
  });

  const data = await response.json();
  if (!data.status) {
    throw new Error(`Erro da API: ${data.message || data.error}`);
  }

  return data;
}

// Uso
enviarMensagem('vendas-01', '5511987654321@s.whatsapp.net', 'Olá!')
  .then(resultado => console.log('Mensagem enviada:', resultado))
  .catch(erro => console.error('Erro:', erro));
```

---

## Exemplo em Python

```python
import requests
import urllib.parse

API_KEY = 'wag_sua-chave'
BASE_URL = 'http://localhost:3000/api'

def enviar_mensagem(session_id, jid, texto):
    headers = {
        'Content-Type': 'application/json',
        'X-API-Key': API_KEY
    }

    jid_codificado = urllib.parse.quote(jid, safe='')

    resposta = requests.post(
        f'{BASE_URL}/messages/{session_id}/{jid_codificado}/send',
        headers=headers,
        json={'message': {'text': texto}},
        timeout=30,
    )

    resultado = resposta.json()
    if not resultado.get('status'):
        raise Exception(f"Erro da API: {resultado.get('message')}")

    return resultado

# Uso
try:
    resultado = enviar_mensagem('vendas-01', '5511987654321@s.whatsapp.net', 'Olá!')
    print(f'Mensagem enviada: {resultado}')
except Exception as e:
    print(e)
```

---

## Tempo real (Socket.IO)

Integrações externas podem receber eventos ao vivo pelo Socket.IO, autenticando com a chave de API:

```javascript
import { io } from "socket.io-client";

const socket = io("http://localhost:3000", {
  path: "/api/socket/io",
  auth: { apiKey: "wag_sua-chave" },
});

socket.on("connect", () => socket.emit("join-session", "vendas-01"));
socket.on("connect_error", (err) => console.error("Falha:", err.message)); // "Unauthorized"
```

Só é possível entrar na sala de sessões às quais sua conta tem acesso. Conexões de navegador vindas de outros domínios precisam estar em `SOCKET_ALLOWED_ORIGINS`.

---

<div align="center">

**Versão**: 1.6.4 · Documentação completa em [API_DOCUMENTATION.md](./API_DOCUMENTATION.md)

</div>
