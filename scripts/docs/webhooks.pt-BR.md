## 🔐 Verificação HMAC dos webhooks

Quando você define um `secret` no webhook, o W-AZAP assina cada requisição com HMAC-SHA256. O receptor **deve** verificar a assinatura antes de processar o payload.

### Como funciona

Com o segredo definido, o W-AZAP envia o cabeçalho:

```
X-Webhook-Signature: sha256=<hmac-em-hexadecimal>
```

Assinatura = HMAC-SHA256(segredo-do-webhook, corpo-bruto-da-requisição).

> [!IMPORTANT]
> Calcule o HMAC sobre os **bytes brutos** do corpo, antes de qualquer `JSON.parse`. Reserializar o JSON muda espaços e ordem, e a assinatura deixa de bater. Compare sempre em tempo constante (`timingSafeEqual`, `compare_digest`, `hash_equals`, `hmac.Equal`).

### Exemplos de verificação

#### Node.js (Express)

```javascript
import crypto from "crypto";
import express from "express";

const app = express();
const WEBHOOK_SECRET = "seu-segredo-do-webhook"; // o mesmo definido no W-AZAP

app.post("/webhook", express.raw({ type: "application/json" }), (req, res) => {
  const sig = req.get("X-Webhook-Signature") || "";
  if (!sig) return res.status(401).send("Assinatura ausente");

  const esperado = "sha256=" + crypto
    .createHmac("sha256", WEBHOOK_SECRET)
    .update(req.body)
    .digest("hex");

  const ok = sig.length === esperado.length &&
    crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(esperado));
  if (!ok) return res.status(401).send("Assinatura inválida");

  const payload = JSON.parse(req.body.toString("utf8"));
  console.log("Webhook verificado:", payload.event);
  res.sendStatus(200);
});

app.listen(4000);
```

#### Node.js (HTTP puro)

```javascript
import crypto from "crypto";
import { createServer } from "http";

const WEBHOOK_SECRET = "seu-segredo-do-webhook";

createServer((req, res) => {
  if (req.method !== "POST") return res.writeHead(405).end();

  const partes = [];
  req.on("data", (chunk) => partes.push(chunk));
  req.on("end", () => {
    const body = Buffer.concat(partes);
    const sig = req.headers["x-webhook-signature"] || "";
    const esperado = "sha256=" + crypto.createHmac("sha256", WEBHOOK_SECRET).update(body).digest("hex");

    if (sig.length !== esperado.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(esperado))) {
      return res.writeHead(401).end("Assinatura inválida");
    }

    const payload = JSON.parse(body.toString("utf8"));
    console.log("Verificado:", payload.event);
    res.writeHead(200).end("OK");
  });
}).listen(4000);
```

#### Python (Flask)

```python
import hmac
import hashlib
from flask import Flask, request, abort

app = Flask(__name__)
WEBHOOK_SECRET = b"seu-segredo-do-webhook"  # o mesmo definido no W-AZAP

@app.route("/webhook", methods=["POST"])
def webhook():
    sig = request.headers.get("X-Webhook-Signature", "")
    if not sig:
        abort(401, "Assinatura ausente")

    esperado = sig.replace("sha256=", "")
    calculado = hmac.new(WEBHOOK_SECRET, request.get_data(), hashlib.sha256).hexdigest()

    if not hmac.compare_digest(esperado, calculado):
        abort(401, "Assinatura inválida")

    payload = request.get_json()
    print(f"Verificado: {payload['event']}")
    return "OK", 200
```

#### Python (FastAPI)

```python
import hmac
import hashlib
from fastapi import FastAPI, Request, HTTPException

app = FastAPI()
WEBHOOK_SECRET = b"seu-segredo-do-webhook"

@app.post("/webhook")
async def webhook(req: Request):
    sig = req.headers.get("x-webhook-signature", "")
    if not sig:
        raise HTTPException(401, "Assinatura ausente")

    body = await req.body()
    esperado = sig.replace("sha256=", "")
    calculado = hmac.new(WEBHOOK_SECRET, body, hashlib.sha256).hexdigest()

    if not hmac.compare_digest(esperado, calculado):
        raise HTTPException(401, "Assinatura inválida")

    payload = await req.json()
    print(f"Verificado: {payload['event']}")
    return "OK"
```

#### PHP

```php
<?php
$secret = 'seu-segredo-do-webhook';
$body = file_get_contents('php://input');
$sig = $_SERVER['HTTP_X_WEBHOOK_SIGNATURE'] ?? '';

$esperado = str_replace('sha256=', '', $sig);
$calculado = hash_hmac('sha256', $body, $secret);

if (!hash_equals($calculado, $esperado)) {
    http_response_code(401);
    die('Assinatura inválida');
}

$payload = json_decode($body);
error_log('Verificado: ' . $payload->event);
http_response_code(200);
echo 'OK';
```

#### Go

```go
package main

import (
    "crypto/hmac"
    "crypto/sha256"
    "encoding/hex"
    "fmt"
    "io"
    "net/http"
    "strings"
)

var secret = []byte("seu-segredo-do-webhook")

func webhookHandler(w http.ResponseWriter, r *http.Request) {
    sig := r.Header.Get("X-Webhook-Signature")
    if sig == "" {
        http.Error(w, "Assinatura ausente", 401)
        return
    }

    body, _ := io.ReadAll(r.Body)
    esperado := strings.TrimPrefix(sig, "sha256=")
    mac := hmac.New(sha256.New, secret)
    mac.Write(body)
    calculado := hex.EncodeToString(mac.Sum(nil))

    if !hmac.Equal([]byte(esperado), []byte(calculado)) {
        http.Error(w, "Assinatura inválida", 401)
        return
    }

    fmt.Println("Webhook verificado")
    w.WriteHeader(200)
}
```

### Testando o receptor

O W-AZAP tem um envio de teste embutido: `POST /webhooks/{sessionId}/{id}/test`, ou o botão **Testar** em **Painel › Webhooks e API**. O teste envia o evento `test`. Para criar um webhook com segredo:

```bash
curl -X POST "http://localhost:3000/api/webhooks/vendas-01" \
  -H "X-API-Key: sua-chave" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Teste HMAC",
    "url": "https://seu-servidor.com/webhook",
    "secret": "seu-segredo-do-webhook",
    "events": ["message.received"]
  }'
```

Depois, envie uma mensagem para o número da sessão. Os logs do seu servidor devem mostrar o payload verificado com o cabeçalho `X-Webhook-Signature`. O histórico de entregas fica em `GET /webhooks/{sessionId}/{id}/logs`.

> [!NOTE]
> A URL do webhook precisa ser pública. Endereços internos (`localhost`, `192.168.x.x`, `10.x.x.x`…) são bloqueados contra SSRF, a não ser que o administrador defina `ALLOW_PRIVATE_WEBHOOK_URLS="true"`. Não há nova tentativa automática quando a entrega falha: confira os logs.

---

## 🎯 Exemplos de payload de webhook

Quando o W-AZAP envia um POST para a URL do seu webhook, o corpo tem esta estrutura:

```json
{
  "event": "message.received",
  "sessionId": "vendas-01",
  "timestamp": "2026-06-27T12:00:00.000Z",
  "data": { }
}
```

### Lista de eventos

| Evento | Quando dispara |
| :--- | :--- |
| `message.received` | Mensagem recebida |
| `message.sent` | Mensagem enviada pelo painel ou pela API |
| `message.status` | Mudança no status de entrega/leitura |
| `message.deleted` | Mensagem apagada (revogada) |
| `message.edited` | Mensagem editada |
| `connection.update` | Mudança no estado da conexão da sessão |
| `group.update` | Mudança nos dados do grupo (nome, descrição, configurações) |
| `group.participant` | Participante entrou, saiu, foi promovido ou rebaixado |
| `contact.update` | Mudança no nome de um contato |
| `status.update` | Novo status (story) |
| `test` | Envio de teste pelo painel ou pela API |

---

### Exemplos

#### message.received: texto em conversa privada

```json
{
  "event": "message.received",
  "data": {
    "key": { "id": "AB12CD34EF", "remoteJid": "5511987654321@s.whatsapp.net", "fromMe": false },
    "pushName": "João",
    "from": "5511987654321@s.whatsapp.net",
    "sender": "5511987654321@s.whatsapp.net",
    "isGroup": false,
    "chatType": "PERSONAL",
    "type": "TEXT",
    "content": "Olá, isto é um teste",
    "fileUrl": null,
    "caption": null,
    "quoted": null
  }
}
```

#### message.received: imagem/vídeo com legenda

```json
{
  "event": "message.received",
  "data": {
    "from": "5511987654321@s.whatsapp.net",
    "isGroup": false,
    "chatType": "PERSONAL",
    "type": "IMAGE",
    "content": "Foto das férias",
    "fileUrl": "/api/media/vendas-01-GH78IJ90KL.jpg",
    "caption": "Foto das férias"
  }
}
```

> O `fileUrl` aponta para a API de mídia, que exige autenticação: baixe o arquivo com o cabeçalho `X-API-Key`.

#### message.received: texto em grupo

```json
{
  "event": "message.received",
  "data": {
    "from": "120363123456789@g.us",
    "sender": "5511987654321@s.whatsapp.net",
    "isGroup": true,
    "chatType": "GROUP",
    "type": "TEXT",
    "content": "Olá, grupo",
    "key": { "id": "AB12CD34EF", "remoteJid": "120363123456789@g.us", "fromMe": false, "participant": "5511987654321@s.whatsapp.net" }
  }
}
```

#### message.received: resposta com citação

```json
{
  "event": "message.received",
  "data": {
    "from": "5511987654321@s.whatsapp.net",
    "type": "TEXT",
    "content": "Combinado!",
    "quoted": {
      "key": { "remoteJid": "5511987654321@s.whatsapp.net", "fromMe": true, "id": "XY99ZZ00AA" },
      "type": "TEXT",
      "content": "Pode ser amanhã?"
    }
  }
}
```

#### message.received: áudio / figurinha / localização / contato

```json
{
  "event": "message.received",
  "data": { "from": "5511987654321@s.whatsapp.net", "type": "AUDIO", "fileUrl": "/api/media/vendas-01-abc.mp3" }
}
```

Os demais tipos seguem o mesmo formato:

- figurinha: `type: "STICKER"`;
- localização: `type: "LOCATION"`, com `content: "lat,lng"`;
- contato: `type: "CONTACT"`, com `content: "Nome de exibição"`.

#### message.sent: texto enviado (painel/API)

```json
{
  "event": "message.sent",
  "data": {
    "key": { "id": "BA12CD34EF", "remoteJid": "5511987654321@s.whatsapp.net", "fromMe": true },
    "from": "5511987654321@s.whatsapp.net",
    "receiver": "5511987654321@s.whatsapp.net",
    "sender": "ME",
    "isGroup": false,
    "chatType": "PERSONAL",
    "type": "TEXT",
    "content": "Mensagem de resposta",
    "fileUrl": null,
    "quoted": null
  }
}
```

#### message.sent: mídia enviada

```json
{
  "event": "message.sent",
  "data": {
    "from": "5511987654321@s.whatsapp.net",
    "type": "IMAGE",
    "content": "Foto das férias",
    "fileUrl": "/api/media/vendas-01-CD78EF90GH.jpg",
    "caption": "Foto das férias"
  }
}
```

#### message.sent: para um grupo

```json
{
  "event": "message.sent",
  "data": {
    "from": "120363123456789@g.us",
    "receiver": "120363123456789@g.us",
    "sender": "ME",
    "isGroup": true,
    "chatType": "GROUP",
    "type": "TEXT",
    "content": "Concordo",
    "key": { "participant": "5511987654321@s.whatsapp.net" }
  }
}
```

#### message.status: entrega/leitura

```json
{
  "event": "message.status",
  "data": { "keyId": "AB12CD34EF", "remoteJid": "5511987654321@s.whatsapp.net", "status": "DELIVERED" }
}
```

Sequência de status: `PENDING` → `SENT` → `DELIVERED` → `READ`

#### message.deleted: mensagem apagada

```json
{
  "event": "message.deleted",
  "data": { "keyId": "DE12LT34EF", "remoteJid": "5511987654321@s.whatsapp.net", "fromMe": false }
}
```

#### message.edited: mensagem editada

```json
{
  "event": "message.edited",
  "data": { "keyId": "ED12IT34EF", "newContent": "Mensagem corrigida", "remoteJid": "5511987654321@s.whatsapp.net" }
}
```

#### connection.update: estado da conexão

```json
{
  "event": "connection.update",
  "data": { "status": "CONNECTED", "qr": null }
}
```

Status possíveis: `SCAN_QR` (com o QR), `CONNECTED`, `DISCONNECTED`, `LOGGED_OUT`, `STOPPED`

#### group.update: dados do grupo alterados

```json
{
  "event": "group.update",
  "data": {
    "jid": "120363123456789@g.us",
    "subject": "Novo nome do grupo",
    "desc": "Descrição do grupo",
    "restrict": true,
    "announce": false,
    "owner": "5511987654321@s.whatsapp.net"
  }
}
```

#### group.participant: entrada, saída ou promoção

```json
{
  "event": "group.participant",
  "data": {
    "jid": "120363123456789@g.us",
    "action": "add",
    "participants": ["5511987654321@s.whatsapp.net"]
  }
}
```

Ações: `add`, `remove`, `promote`, `demote`

#### contact.update: nome do contato alterado

```json
{
  "event": "contact.update",
  "data": { "jid": "5511987654321@s.whatsapp.net", "name": "João da Silva", "notify": "João" }
}
```

#### status.update: novo status (story)

```json
{
  "event": "status.update",
  "data": { "from": "status@broadcast", "type": "TEXT", "content": "Bom dia, pessoal" }
}
```

---

