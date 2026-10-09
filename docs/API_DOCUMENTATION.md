# Documentação da API do W-AZAP

> Arquivo gerado automaticamente a partir de `src/lib/swagger.ts`: não edite à mão. Para atualizar, rode `npx tsx scripts/generate-swagger.ts && node scripts/generate-docs.js`.

**Versão 1.6.4** · **84 rotas** · URL base: `http://localhost:3000/api`

API REST do gateway de WhatsApp W-AZAP para automação completa: sessões, mensagens, grupos, contatos, etiquetas, agendamentos, respostas automáticas e webhooks. Para explorar de forma interativa, use o Swagger UI em `/swagger` (exige login no painel).

## 🔐 Autenticação

Todos os endpoints exigem uma das formas de autenticação abaixo:

| Método | Cabeçalho / Cookie | Exemplo |
| :--- | :--- | :--- |
| **Chave de API** | `X-API-Key` (cabeçalho) | `X-API-Key: wag_sua-chave` |
| **Cookie de login** | `authjs.session-token` (em HTTPS: `__Secure-authjs.session-token`) | Enviado automaticamente pelo navegador |

- Gere a chave em **Painel › Webhooks e API**. Ela é exibida **uma única vez** e fica guardada só como hash; se perder, gere outra.
- Rotas administrativas (gestão de usuários, geração de chave) aceitam apenas o cookie de login.
- Cada usuário só acessa as próprias sessões ou as compartilhadas com ele; o `SUPERADMIN` acessa todas. Sem permissão, a resposta é `403`.

## 📋 Parâmetros comuns

| Parâmetro | Formato | Exemplo |
| :--- | :--- | :--- |
| `sessionId` | Identificador da sessão (3 a 50 letras, números, `-` ou `_`) | `vendas-01` |
| `jid` (contato) | `{DDI}{DDD}{número}@s.whatsapp.net` | `5511987654321@s.whatsapp.net` |
| `jid` (grupo) | `{idDoGrupo}@g.us` | `120363123456789@g.us` |

> Codifique o JID ao usá-lo na URL: `@` vira `%40` (ex.: `5511987654321%40s.whatsapp.net`).

## 📊 Limites e respostas

| Situação | Código | Observação |
| :--- | :--- | :--- |
| Muitas requisições | `429` | Limite de `RATE_LIMIT_PER_MINUTE` por minuto (padrão: 60). Veja os cabeçalhos `X-RateLimit-Remaining` e `Retry-After`. |
| Corpo grande demais | `413` | Limite de `MAX_UPLOAD_SIZE_MB` (padrão: 50 MB). |
| URL de mídia/webhook interna | `400` | Endereços privados (`localhost`, `192.168.x.x`…) são bloqueados contra SSRF. |
| Sessão desconectada | `503` | Inicie a sessão ou leia o QR code de novo. |

Todas as respostas seguem o formato `{ "status": true|false, "message": "...", "data": ... }`.

> **Webhooks**: cada entrega é assinada com HMAC-SHA256 no cabeçalho `X-Webhook-Signature`. Veja a seção *Verificação HMAC dos webhooks*, logo após os endpoints de Webhooks, com exemplos em Node.js, Python, PHP e Go.

---

## 📂 Mídia

### \[GET\] /media/{filename}

**Baixar arquivo de mídia**

#### Parâmetros

| Nome | Local | Obrigatório | Tipo | Descrição |
| :--- | :--- | :--- | :--- | :--- |
| `filename` | caminho | ✅ Sim | string | — |

#### Respostas

| Código | Descrição |
| :--- | :--- |
| `200` | Conteúdo do arquivo |

#### Exemplo em cURL

```bash
curl -X GET "http://localhost:3000/api/media/image.jpg" \
  -H "X-API-Key: sua-chave"
```

---

### \[GET\] /media

**Listar arquivos de mídia**

Lista os arquivos de mídia baixados das sessões do usuário, com dados do remetente. O SUPERADMIN vê os arquivos de todas as sessões.

#### Respostas

| Código | Descrição |
| :--- | :--- |
| `200` | Arquivos de mídia |
| `401` | Não autenticado: chave de API ausente ou inválida |

**Campos da resposta (`200`):**

| Campo | Tipo | Obrigatório | Descrição |
| :--- | :--- | :--- | :--- |
| `status` | boolean | Não | — |
| `message` | string | Não | — |
| `data` | object | Não | — |

**Exemplo de resposta (`200`):**

```json
{
  "status": true,
  "message": "Media files fetched successfully",
  "data": {
    "files": [
      {
        "name": "vendas-01-3EB0B78A.jpg",
        "size": 52341,
        "type": "image",
        "sessionId": "vendas-01",
        "from": "5511987654321@s.whatsapp.net",
        "fromMe": false,
        "createdAt": "2026-01-15T08:00:00.000Z",
        "url": "/api/media/vendas-01-3EB0B78A.jpg"
      }
    ],
    "totalSize": 52341,
    "totalCount": 1
  }
}
```

#### Exemplo em cURL

```bash
curl -X GET "http://localhost:3000/api/media" \
  -H "X-API-Key: sua-chave"
```

---

### \[DELETE\] /media

**Excluir arquivos de mídia**

Exclui vários arquivos de uma vez. Cada arquivo é conferido: só é possível excluir mídia das sessões às quais você tem acesso. Arquivos sem sessão identificável exigem SUPERADMIN.

#### Cabeçalhos

```
X-API-Key: sua-chave
Content-Type: application/json
```

#### Corpo da requisição (`application/json`)

| Campo | Tipo | Obrigatório | Descrição |
| :--- | :--- | :--- | :--- |
| `filenames` | array de string | ✅ Sim | Nomes dos arquivos (sem caminho) |

**Exemplo:**

```json
{
  "filenames": [
    "vendas-01-3EB0B78A.jpg"
  ]
}
```

#### Respostas

| Código | Descrição |
| :--- | :--- |
| `200` | Resultado da exclusão (`deleted`, `failed`, `errors`) |
| `400` | Requisição inválida: parâmetros incorretos |
| `401` | Não autenticado: chave de API ausente ou inválida |

#### Exemplo em cURL

```bash
curl -X DELETE "http://localhost:3000/api/media" \
  -H "X-API-Key: sua-chave" \
  -H "Content-Type: application/json" \
  -d '{"filenames":["vendas-01-3EB0B78A.jpg"]}'
```

---

## 📂 Grupos

### \[POST\] /groups/{sessionId}/{jid}/leave

**Sair de um grupo**

#### Parâmetros

| Nome | Local | Obrigatório | Tipo | Descrição |
| :--- | :--- | :--- | :--- | :--- |
| `sessionId` | caminho | ✅ Sim | string | — |
| `jid` | caminho | ✅ Sim | string | — |

#### Respostas

| Código | Descrição |
| :--- | :--- |
| `200` | Saiu do grupo com sucesso |

#### Exemplo em cURL

```bash
curl -X POST "http://localhost:3000/api/groups/vendas-01/5511987654321%40s.whatsapp.net/leave" \
  -H "X-API-Key: sua-chave"
```

---

### \[GET\] /groups/{sessionId}

**Listar grupos**

Lista todos os grupos de que a sessão participa

#### Parâmetros

| Nome | Local | Obrigatório | Tipo | Descrição |
| :--- | :--- | :--- | :--- | :--- |
| `sessionId` | caminho | ✅ Sim | string | — |

#### Respostas

| Código | Descrição |
| :--- | :--- |
| `200` | Lista de grupos |
| `401` | Não autenticado: chave de API ausente ou inválida |
| `403` | Proibido: acesso negado |
| `404` | Recurso não encontrado |
| `500` | Falha ao obter os grupos |

**Exemplo de resposta (`200`):**

```json
[
  {
    "id": "string",
    "subject": "string",
    "desc": "string",
    "owner": "string",
    "size": 0,
    "isCommunity": true,
    "linkedParentJid": "string",
    "participants": [
      {
        "id": "string",
        "admin": "string"
      }
    ]
  }
]
```

#### Exemplo em cURL

```bash
curl -X GET "http://localhost:3000/api/groups/vendas-01" \
  -H "X-API-Key: sua-chave"
```

---

### \[POST\] /groups/{sessionId}/create

**Criar grupo**

Cria um grupo com os participantes informados

#### Parâmetros

| Nome | Local | Obrigatório | Tipo | Descrição |
| :--- | :--- | :--- | :--- | :--- |
| `sessionId` | caminho | ✅ Sim | string | — |

#### Cabeçalhos

```
X-API-Key: sua-chave
Content-Type: application/json
```

#### Corpo da requisição (`application/json`)

| Campo | Tipo | Obrigatório | Descrição |
| :--- | :--- | :--- | :--- |
| `subject` | string | ✅ Sim | — |
| `participants` | array de string | ✅ Sim | — |

**Exemplo:**

```json
{
  "subject": "VIP Customers",
  "participants": [
    "5511987654321@s.whatsapp.net"
  ]
}
```

#### Respostas

| Código | Descrição |
| :--- | :--- |
| `200` | Grupo criado |
| `401` | Não autenticado: chave de API ausente ou inválida |
| `403` | Proibido: acesso negado |
| `500` | Falha ao criar o grupo |
| `503` | Sessão desconectada ou ainda não pronta |

**Campos da resposta (`200`):**

| Campo | Tipo | Obrigatório | Descrição |
| :--- | :--- | :--- | :--- |
| `success` | boolean | Não | — |
| `group` | object | Não | — |

**Exemplo de resposta (`200`):**

```json
{
  "success": true,
  "group": {
    "id": "string",
    "subject": "string",
    "desc": "string",
    "owner": "string",
    "size": 0,
    "isCommunity": true,
    "linkedParentJid": "string",
    "participants": [
      {
        "id": "string",
        "admin": "string"
      }
    ]
  }
}
```

#### Exemplo em cURL

```bash
curl -X POST "http://localhost:3000/api/groups/vendas-01/create" \
  -H "X-API-Key: sua-chave" \
  -H "Content-Type: application/json" \
  -d '{"subject":"VIP Customers","participants":["5511987654321@s.whatsapp.net"]}'
```

---

### \[PUT\] /groups/{sessionId}/{jid}/subject

**Alterar o nome do grupo**

#### Parâmetros

| Nome | Local | Obrigatório | Tipo | Descrição |
| :--- | :--- | :--- | :--- | :--- |
| `sessionId` | caminho | ✅ Sim | string | — |
| `jid` | caminho | ✅ Sim | string | — |

#### Cabeçalhos

```
X-API-Key: sua-chave
Content-Type: application/json
```

#### Corpo da requisição (`application/json`)

| Campo | Tipo | Obrigatório | Descrição |
| :--- | :--- | :--- | :--- |
| `subject` | string | ✅ Sim | — |

**Exemplo:**

```json
{
  "subject": "string"
}
```

#### Respostas

| Código | Descrição |
| :--- | :--- |
| `200` | Nome alterado |
| `400` | Nome inválido |
| `401` | Não autenticado: chave de API ausente ou inválida |
| `403` | Proibido: acesso negado |
| `500` | Falha ao alterar o nome |

**Campos da resposta (`200`):**

| Campo | Tipo | Obrigatório | Descrição |
| :--- | :--- | :--- | :--- |
| `success` | boolean | Não | — |
| `message` | string | Não | — |
| `subject` | string | Não | — |

**Exemplo de resposta (`200`):**

```json
{
  "success": true,
  "message": "string",
  "subject": "string"
}
```

#### Exemplo em cURL

```bash
curl -X PUT "http://localhost:3000/api/groups/vendas-01/5511987654321%40s.whatsapp.net/subject" \
  -H "X-API-Key: sua-chave" \
  -H "Content-Type: application/json" \
  -d '{"subject":"string"}'
```

---

### \[PUT\] /groups/{sessionId}/{jid}/members

**Gerenciar participantes**

#### Parâmetros

| Nome | Local | Obrigatório | Tipo | Descrição |
| :--- | :--- | :--- | :--- | :--- |
| `sessionId` | caminho | ✅ Sim | string | — |
| `jid` | caminho | ✅ Sim | string | — |

#### Cabeçalhos

```
X-API-Key: sua-chave
Content-Type: application/json
```

#### Corpo da requisição (`application/json`)

| Campo | Tipo | Obrigatório | Descrição |
| :--- | :--- | :--- | :--- |
| `action` | string | ✅ Sim | **Opções:** `add`, `remove`, `promote`, `demote` |
| `participants` | array de string | ✅ Sim | — |

**Exemplo:**

```json
{
  "action": "add",
  "participants": [
    "string"
  ]
}
```

#### Respostas

| Código | Descrição |
| :--- | :--- |
| `200` | Participantes atualizados |
| `400` | Ação inválida |
| `401` | Não autenticado: chave de API ausente ou inválida |
| `403` | Proibido: acesso negado |
| `500` | Falha ao atualizar os participantes |

**Campos da resposta (`200`):**

| Campo | Tipo | Obrigatório | Descrição |
| :--- | :--- | :--- | :--- |
| `success` | boolean | Não | — |
| `message` | string | Não | — |
| `result` | array de object | Não | — |

**Exemplo de resposta (`200`):**

```json
{
  "success": true,
  "message": "string",
  "result": [
    {
      "text": "Olá do W-AZAP!"
    }
  ]
}
```

#### Exemplo em cURL

```bash
curl -X PUT "http://localhost:3000/api/groups/vendas-01/5511987654321%40s.whatsapp.net/members" \
  -H "X-API-Key: sua-chave" \
  -H "Content-Type: application/json" \
  -d '{"action":"add","participants":["string"]}'
```

---

### \[PUT\] /groups/{sessionId}/{jid}/invite

**Revogar o link de convite**

#### Parâmetros

| Nome | Local | Obrigatório | Tipo | Descrição |
| :--- | :--- | :--- | :--- | :--- |
| `sessionId` | caminho | ✅ Sim | string | — |
| `jid` | caminho | ✅ Sim | string | — |

#### Respostas

| Código | Descrição |
| :--- | :--- |
| `200` | Convite revogado |
| `401` | Não autenticado: chave de API ausente ou inválida |
| `403` | Proibido: acesso negado |
| `500` | Falha ao revogar o convite |

**Campos da resposta (`200`):**

| Campo | Tipo | Obrigatório | Descrição |
| :--- | :--- | :--- | :--- |
| `success` | boolean | Não | — |
| `message` | string | Não | — |
| `newInviteCode` | string | Não | — |
| `inviteUrl` | string | Não | — |

**Exemplo de resposta (`200`):**

```json
{
  "success": true,
  "message": "string",
  "newInviteCode": "string",
  "inviteUrl": "string"
}
```

#### Exemplo em cURL

```bash
curl -X PUT "http://localhost:3000/api/groups/vendas-01/5511987654321%40s.whatsapp.net/invite" \
  -H "X-API-Key: sua-chave"
```

---

### \[GET\] /groups/{sessionId}/{jid}/invite

**Obter o link de convite**

#### Parâmetros

| Nome | Local | Obrigatório | Tipo | Descrição |
| :--- | :--- | :--- | :--- | :--- |
| `sessionId` | caminho | ✅ Sim | string | — |
| `jid` | caminho | ✅ Sim | string | — |

#### Respostas

| Código | Descrição |
| :--- | :--- |
| `200` | Código de convite |
| `401` | Não autenticado: chave de API ausente ou inválida |
| `403` | Proibido: acesso negado |
| `500` | Falha ao obter o código |

**Campos da resposta (`200`):**

| Campo | Tipo | Obrigatório | Descrição |
| :--- | :--- | :--- | :--- |
| `success` | boolean | Não | — |
| `inviteCode` | string | Não | — |
| `inviteUrl` | string | Não | — |

**Exemplo de resposta (`200`):**

```json
{
  "success": true,
  "inviteCode": "string",
  "inviteUrl": "string"
}
```

#### Exemplo em cURL

```bash
curl -X GET "http://localhost:3000/api/groups/vendas-01/5511987654321%40s.whatsapp.net/invite" \
  -H "X-API-Key: sua-chave"
```

---

### \[GET\] /groups/{sessionId}/{jid}

**Detalhes do grupo**

Informações detalhadas do grupo

#### Parâmetros

| Nome | Local | Obrigatório | Tipo | Descrição |
| :--- | :--- | :--- | :--- | :--- |
| `sessionId` | caminho | ✅ Sim | string | — |
| `jid` | caminho | ✅ Sim | string | — |

#### Respostas

| Código | Descrição |
| :--- | :--- |
| `200` | Detalhes do grupo |
| `401` | Não autenticado: chave de API ausente ou inválida |
| `403` | Proibido: acesso negado |
| `404` | Recurso não encontrado |
| `500` | Falha ao obter os detalhes |

**Campos da resposta (`200`):**

| Campo | Tipo | Obrigatório | Descrição |
| :--- | :--- | :--- | :--- |
| `id` | string | Não | — |
| `subject` | string | Não | — |
| `subjectOwner` | string | Não | — |
| `subjectTime` | number | Não | — |
| `desc` | string | Não | — |
| `descOwner` | string | Não | — |
| `descId` | string | Não | — |
| `owner` | string | Não | — |

**Exemplo de resposta (`200`):**

```json
{
  "id": "string",
  "subject": "string",
  "subjectOwner": "string",
  "subjectTime": 0,
  "desc": "string",
  "descOwner": "string",
  "descId": "string",
  "owner": "string"
}
```

#### Exemplo em cURL

```bash
curl -X GET "http://localhost:3000/api/groups/vendas-01/5511987654321%40s.whatsapp.net" \
  -H "X-API-Key: sua-chave"
```

---

### \[POST\] /groups/{sessionId}/invite/accept

**Aceitar convite de grupo**

Entra em um grupo usando um código de convite

#### Parâmetros

| Nome | Local | Obrigatório | Tipo | Descrição |
| :--- | :--- | :--- | :--- | :--- |
| `sessionId` | caminho | ✅ Sim | string | — |

#### Cabeçalhos

```
X-API-Key: sua-chave
Content-Type: application/json
```

#### Corpo da requisição (`application/json`)

| Campo | Tipo | Obrigatório | Descrição |
| :--- | :--- | :--- | :--- |
| `inviteCode` | string | ✅ Sim | — |

**Exemplo:**

```json
{
  "inviteCode": "string"
}
```

#### Respostas

| Código | Descrição |
| :--- | :--- |
| `200` | Convite aceito |
| `400` | Código inválido ou expirado |
| `401` | Não autenticado: chave de API ausente ou inválida |
| `403` | Proibido: acesso negado |
| `500` | Falha ao aceitar o convite |
| `503` | Sessão desconectada ou ainda não pronta |

**Campos da resposta (`200`):**

| Campo | Tipo | Obrigatório | Descrição |
| :--- | :--- | :--- | :--- |
| `success` | boolean | Não | — |
| `message` | string | Não | — |
| `groupJid` | string | Não | — |

**Exemplo de resposta (`200`):**

```json
{
  "success": true,
  "message": "string",
  "groupJid": "string"
}
```

#### Exemplo em cURL

```bash
curl -X POST "http://localhost:3000/api/groups/vendas-01/invite/accept" \
  -H "X-API-Key: sua-chave" \
  -H "Content-Type: application/json" \
  -d '{"inviteCode":"string"}'
```

---

### \[DELETE\] /groups/{sessionId}/{jid}/picture

**Remover a foto do grupo**

#### Parâmetros

| Nome | Local | Obrigatório | Tipo | Descrição |
| :--- | :--- | :--- | :--- | :--- |
| `sessionId` | caminho | ✅ Sim | string | — |
| `jid` | caminho | ✅ Sim | string | — |

#### Respostas

| Código | Descrição |
| :--- | :--- |
| `200` | Foto removida |

#### Exemplo em cURL

```bash
curl -X DELETE "http://localhost:3000/api/groups/vendas-01/5511987654321%40s.whatsapp.net/picture" \
  -H "X-API-Key: sua-chave"
```

---

### \[PUT\] /groups/{sessionId}/{jid}/picture

**Alterar a foto do grupo**

#### Parâmetros

| Nome | Local | Obrigatório | Tipo | Descrição |
| :--- | :--- | :--- | :--- | :--- |
| `sessionId` | caminho | ✅ Sim | string | — |
| `jid` | caminho | ✅ Sim | string | — |

#### Cabeçalhos

```
X-API-Key: sua-chave
Content-Type: application/json
```

#### Corpo da requisição (`multipart/form-data`)

| Campo | Tipo | Obrigatório | Descrição |
| :--- | :--- | :--- | :--- |
| `file` | string (binary) | ✅ Sim | — |

**Exemplo:**

```json
{
  "file": "(binary)"
}
```

#### Respostas

| Código | Descrição |
| :--- | :--- |
| `200` | Foto alterada |

#### Exemplo em cURL

```bash
curl -X PUT "http://localhost:3000/api/groups/vendas-01/5511987654321%40s.whatsapp.net/picture" \
  -H "X-API-Key: sua-chave" \
  -F "file=@/caminho/para/arquivo.jpg" \
  -F "type=image" \
  -F "caption=Olá"
```

---

### \[PUT\] /groups/{sessionId}/{jid}/settings

**Alterar as configurações do grupo**

#### Parâmetros

| Nome | Local | Obrigatório | Tipo | Descrição |
| :--- | :--- | :--- | :--- | :--- |
| `sessionId` | caminho | ✅ Sim | string | — |
| `jid` | caminho | ✅ Sim | string | — |

#### Cabeçalhos

```
X-API-Key: sua-chave
Content-Type: application/json
```

#### Corpo da requisição (`application/json`)

| Campo | Tipo | Obrigatório | Descrição |
| :--- | :--- | :--- | :--- |
| `setting` | string | ✅ Sim | `announcement` (só admins enviam), `not_announcement` (todos enviam), `locked` (só admins editam os dados), `unlocked` (todos editam) **Opções:** `announcement`, `not_announcement`, `locked`, `unlocked` |
| `value` | boolean | Não | Ignorado, mas obrigatório |

**Exemplo:**

```json
{
  "setting": "announcement",
  "value": true
}
```

#### Respostas

| Código | Descrição |
| :--- | :--- |
| `200` | Configurações atualizadas |

#### Exemplo em cURL

```bash
curl -X PUT "http://localhost:3000/api/groups/vendas-01/5511987654321%40s.whatsapp.net/settings" \
  -H "X-API-Key: sua-chave" \
  -H "Content-Type: application/json" \
  -d '{"setting":"announcement","value":true}'
```

---

### \[PUT\] /groups/{sessionId}/{jid}/description

**Alterar a descrição do grupo**

#### Parâmetros

| Nome | Local | Obrigatório | Tipo | Descrição |
| :--- | :--- | :--- | :--- | :--- |
| `sessionId` | caminho | ✅ Sim | string | — |
| `jid` | caminho | ✅ Sim | string | — |

#### Cabeçalhos

```
X-API-Key: sua-chave
Content-Type: application/json
```

#### Corpo da requisição (`application/json`)

| Campo | Tipo | Obrigatório | Descrição |
| :--- | :--- | :--- | :--- |
| `description` | string | Não | — |

**Exemplo:**

```json
{
  "description": "string"
}
```

#### Respostas

| Código | Descrição |
| :--- | :--- |
| `200` | Descrição alterada |
| `400` | Dados inválidos |
| `401` | Não autenticado: chave de API ausente ou inválida |
| `403` | Proibido: acesso negado |
| `500` | Falha ao atualizar |

**Campos da resposta (`200`):**

| Campo | Tipo | Obrigatório | Descrição |
| :--- | :--- | :--- | :--- |
| `success` | boolean | Não | — |
| `description` | string | Não | — |

**Exemplo de resposta (`200`):**

```json
{
  "success": true,
  "description": "string"
}
```

#### Exemplo em cURL

```bash
curl -X PUT "http://localhost:3000/api/groups/vendas-01/5511987654321%40s.whatsapp.net/description" \
  -H "X-API-Key: sua-chave" \
  -H "Content-Type: application/json" \
  -d '{"description":"string"}'
```

---

### \[PUT\] /groups/{sessionId}/{jid}/ephemeral

**Ativar/desativar mensagens temporárias**

#### Parâmetros

| Nome | Local | Obrigatório | Tipo | Descrição |
| :--- | :--- | :--- | :--- | :--- |
| `sessionId` | caminho | ✅ Sim | string | — |
| `jid` | caminho | ✅ Sim | string | — |

#### Cabeçalhos

```
X-API-Key: sua-chave
Content-Type: application/json
```

#### Corpo da requisição (`application/json`)

| Campo | Tipo | Obrigatório | Descrição |
| :--- | :--- | :--- | :--- |
| `expiration` | integer | ✅ Sim | **Opções:** `0`, `86400`, `604800`, `7776000` |

**Exemplo:**

```json
{
  "expiration": 0
}
```

#### Respostas

| Código | Descrição |
| :--- | :--- |
| `200` | Mensagens temporárias alteradas |
| `400` | Duração inválida |
| `401` | Não autenticado: chave de API ausente ou inválida |
| `403` | Proibido: acesso negado |
| `500` | Falha ao alterar |

**Campos da resposta (`200`):**

| Campo | Tipo | Obrigatório | Descrição |
| :--- | :--- | :--- | :--- |
| `success` | boolean | Não | — |
| `expiration` | integer | Não | — |

**Exemplo de resposta (`200`):**

```json
{
  "success": true,
  "expiration": 0
}
```

#### Exemplo em cURL

```bash
curl -X PUT "http://localhost:3000/api/groups/vendas-01/5511987654321%40s.whatsapp.net/ephemeral" \
  -H "X-API-Key: sua-chave" \
  -H "Content-Type: application/json" \
  -d '{"expiration":0}'
```

---

## 📂 Documentação

### \[GET\] /docs

**Obter a especificação OpenAPI (JSON)**

#### Respostas

| Código | Descrição |
| :--- | :--- |
| `200` | Especificação OpenAPI em JSON |

#### Exemplo em cURL

```bash
curl -X GET "http://localhost:3000/api/docs" \
  -H "X-API-Key: sua-chave"
```

---

## 📂 Autenticação web

### \[POST\] /auth/register

**Cadastrar novo usuário**

Cadastra um usuário pelo navegador. Fica desativado por padrão: só a primeira conta de uma instalação nova (que vira SUPERADMIN) pode se cadastrar sem que o administrador ative o cadastro em Configurações. Senha com no mínimo 8 caracteres; limite de 10 cadastros por IP por hora.

#### Cabeçalhos

```
X-API-Key: sua-chave
Content-Type: application/json
```

#### Corpo da requisição (`application/json`)

| Campo | Tipo | Obrigatório | Descrição |
| :--- | :--- | :--- | :--- |
| `name` | string | ✅ Sim | — |
| `email` | string | ✅ Sim | — |
| `password` | string | ✅ Sim | — |

**Exemplo:**

```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "password123"
}
```

#### Respostas

| Código | Descrição |
| :--- | :--- |
| `200` | Usuário cadastrado |

#### Exemplo em cURL

```bash
curl -X POST "http://localhost:3000/api/auth/register" \
  -H "X-API-Key: sua-chave" \
  -H "Content-Type: application/json" \
  -d '{"name":"John Doe","email":"john@example.com","password":"password123"}'
```

---

### \[GET\] /auth/session

**Obter a sessão de login atual**

Verifica se o usuário está logado no painel (rota do NextAuth)

#### Respostas

| Código | Descrição |
| :--- | :--- |
| `200` | Sessão atual |

**Campos da resposta (`200`):**

| Campo | Tipo | Obrigatório | Descrição |
| :--- | :--- | :--- | :--- |
| `user` | object | Não | — |
| `expires` | string | Não | — |

**Exemplo de resposta (`200`):**

```json
{
  "user": {
    "name": "string",
    "email": "string",
    "image": "string"
  },
  "expires": "string"
}
```

#### Exemplo em cURL

```bash
curl -X GET "http://localhost:3000/api/auth/session" \
  -H "X-API-Key: sua-chave"
```

---

### \[GET\] /auth/csrf

**Obter token CSRF**

Obtém o token CSRF usado nos formulários de login (rota do NextAuth)

#### Respostas

| Código | Descrição |
| :--- | :--- |
| `200` | Token CSRF |

**Campos da resposta (`200`):**

| Campo | Tipo | Obrigatório | Descrição |
| :--- | :--- | :--- | :--- |
| `csrfToken` | string | Não | — |

**Exemplo de resposta (`200`):**

```json
{
  "csrfToken": "string"
}
```

#### Exemplo em cURL

```bash
curl -X GET "http://localhost:3000/api/auth/csrf" \
  -H "X-API-Key: sua-chave"
```

---

## 📂 Sessões

### \[GET\] /sessions

**Listar as sessões acessíveis**

Lista todas as sessões que o usuário autenticado pode acessar: as próprias e as compartilhadas com ele (o SUPERADMIN vê todas). Segredos de webhook não são incluídos.

#### Respostas

| Código | Descrição |
| :--- | :--- |
| `200` | Lista de sessões |
| `401` | Não autenticado: chave de API ausente ou inválida |

**Exemplo de resposta (`200`):**

```json
[
  {
    "id": "clx123abc",
    "name": "Marketing Bot",
    "sessionId": "marketing-1",
    "status": "Connected",
    "userId": "string",
    "botConfig": {
      "text": "Olá do W-AZAP!"
    },
    "webhooks": [
      {
        "text": "Olá do W-AZAP!"
      }
    ],
    "_count": {
      "contacts": 0,
      "messages": 0,
      "groups": 0,
      "autoReplies": 0,
      "scheduledMessages": 0
    },
    "createdAt": "2026-01-15T08:00:00.000Z",
    "updatedAt": "2026-01-15T08:00:00.000Z"
  }
]
```

#### Exemplo em cURL

```bash
curl -X GET "http://localhost:3000/api/sessions" \
  -H "X-API-Key: sua-chave"
```

---

### \[POST\] /sessions

**Criar sessão do WhatsApp**

Cria uma sessão do WhatsApp para pareamento por QR code ou código de pareamento

#### Cabeçalhos

```
X-API-Key: sua-chave
Content-Type: application/json
```

#### Corpo da requisição (`application/json`)

| Campo | Tipo | Obrigatório | Descrição |
| :--- | :--- | :--- | :--- |
| `name` | string | ✅ Sim | Nome de exibição da sessão (até 100 caracteres) |
| `sessionId` | string | Não | ID único da sessão: de 3 a 50 letras, números, `-` ou `_`. Se omitido, um ID aleatório é gerado. |

**Exemplo:**

```json
{
  "name": "Marketing Bot",
  "sessionId": "marketing-1"
}
```

#### Respostas

| Código | Descrição |
| :--- | :--- |
| `200` | Sessão criada com sucesso |
| `400` | Corpo da requisição inválido |
| `401` | Não autenticado: chave de API ausente ou inválida |

**Campos da resposta (`200`):**

| Campo | Tipo | Obrigatório | Descrição |
| :--- | :--- | :--- | :--- |
| `id` | string | Não | — |
| `name` | string | Não | — |
| `sessionId` | string | Não | — |
| `status` | string | Não | **Opções:** `Connected`, `Disconnected`, `Connecting` |
| `userId` | string | Não | — |
| `botConfig` | object, nullable | Não | — |
| `webhooks` | array de object | Não | — |
| `_count` | object, nullable | Não | — |
| `createdAt` | string (date-time) | Não | — |
| `updatedAt` | string (date-time) | Não | — |

**Exemplo de resposta (`200`):**

```json
{
  "id": "clx123abc",
  "name": "Marketing Bot",
  "sessionId": "marketing-1",
  "status": "Connected",
  "userId": "string",
  "botConfig": {
    "text": "Olá do W-AZAP!"
  },
  "webhooks": [
    {
      "text": "Olá do W-AZAP!"
    }
  ],
  "_count": {
    "contacts": 0,
    "messages": 0,
    "groups": 0,
    "autoReplies": 0,
    "scheduledMessages": 0
  },
  "createdAt": "2026-01-15T08:00:00.000Z",
  "updatedAt": "2026-01-15T08:00:00.000Z"
}
```

#### Exemplo em cURL

```bash
curl -X POST "http://localhost:3000/api/sessions" \
  -H "X-API-Key: sua-chave" \
  -H "Content-Type: application/json" \
  -d '{"name":"Marketing Bot","sessionId":"marketing-1"}'
```

---

### \[GET\] /sessions/{id}/qr

**Obter o QR code de pareamento**

Obtém o QR code (texto e imagem em base64) para conectar o WhatsApp

#### Parâmetros

| Nome | Local | Obrigatório | Tipo | Descrição |
| :--- | :--- | :--- | :--- | :--- |
| `id` | caminho | ✅ Sim | string | ID da sessão |

#### Respostas

| Código | Descrição |
| :--- | :--- |
| `200` | QR code gerado |
| `400` | Sessão já conectada |
| `404` | QR code ainda não disponível |

**Campos da resposta (`200`):**

| Campo | Tipo | Obrigatório | Descrição |
| :--- | :--- | :--- | :--- |
| `success` | boolean | Não | — |
| `qr` | string | Não | Conteúdo do QR code |
| `base64` | string | Não | Imagem do QR code como data URL em base64 |

**Exemplo de resposta (`200`):**

```json
{
  "status": true,
  "message": "QR code generated",
  "data": {
    "success": true,
    "qr": "2@AbCdEfGhIjKlMnOp...",
    "base64": "data:image/png;base64,iVBORw0KGgo..."
  }
}
```

#### Exemplo em cURL

```bash
curl -X GET "http://localhost:3000/api/sessions/sales-01/qr" \
  -H "X-API-Key: sua-chave"
```

---

### \[GET\] /sessions/{id}/bot-config

**Obter a configuração do bot**

#### Parâmetros

| Nome | Local | Obrigatório | Tipo | Descrição |
| :--- | :--- | :--- | :--- | :--- |
| `id` | caminho | ✅ Sim | string | — |

#### Respostas

| Código | Descrição |
| :--- | :--- |
| `200` | Configuração do bot obtida |

#### Exemplo em cURL

```bash
curl -X GET "http://localhost:3000/api/sessions/abc123/bot-config" \
  -H "X-API-Key: sua-chave"
```

---

### \[POST\] /sessions/{id}/bot-config

**Atualizar a configuração do bot**

#### Parâmetros

| Nome | Local | Obrigatório | Tipo | Descrição |
| :--- | :--- | :--- | :--- | :--- |
| `id` | caminho | ✅ Sim | string | — |

#### Cabeçalhos

```
X-API-Key: sua-chave
Content-Type: application/json
```

#### Corpo da requisição (`application/json`)

| Campo | Tipo | Obrigatório | Descrição |
| :--- | :--- | :--- | :--- |
| `enabled` | boolean | Não | — |
| `botMode` | string | Não | **Opções:** `OWNER`, `SPECIFIC`, `BLACKLIST`, `ALL` |
| `botAllowedJids` | array de string | Não | — |
| `botBlockedJids` | array de string | Não | — |
| `autoReplyMode` | string | Não | **Opções:** `OWNER`, `SPECIFIC`, `BLACKLIST`, `ALL` |
| `autoReplyAllowedJids` | array de string | Não | — |
| `autoReplyBlockedJids` | array de string | Não | — |
| `botName` | string | Não | — |
| `enableSticker` | boolean | Não | — |
| `enableVideoSticker` | boolean | Não | — |
| `maxStickerDuration` | integer | Não | — |
| `enablePing` | boolean | Não | — |
| `enableUptime` | boolean | Não | — |
| `removeBgApiKey` | string, nullable | Não | — |

**Exemplo:**

```json
{
  "enabled": true,
  "botMode": "BLACKLIST",
  "botBlockedJids": [
    "5511987654321@s.whatsapp.net"
  ],
  "autoReplyMode": "SPECIFIC",
  "autoReplyAllowedJids": [
    "5511987654321@s.whatsapp.net"
  ],
  "botName": "My Assistant",
  "enableSticker": true
}
```

#### Respostas

| Código | Descrição |
| :--- | :--- |
| `200` | Configuração atualizada |
| `401` | Não autenticado: chave de API ausente ou inválida |
| `403` | Proibido: acesso negado |
| `404` | Sessão não encontrada |
| `500` | Erro interno do servidor |

**Campos da resposta (`200`):**

| Campo | Tipo | Obrigatório | Descrição |
| :--- | :--- | :--- | :--- |
| `id` | string | Não | — |
| `sessionId` | string | Não | — |
| `enabled` | boolean | Não | — |
| `botMode` | string | Não | — |
| `botAllowedJids` | array de string | Não | — |
| `autoReplyMode` | string | Não | — |
| `autoReplyAllowedJids` | array de string | Não | — |
| `botName` | string | Não | — |
| `enableSticker` | boolean | Não | — |
| `enableVideoSticker` | boolean | Não | — |
| `maxStickerDuration` | integer | Não | — |
| `enablePing` | boolean | Não | — |
| `enableUptime` | boolean | Não | — |
| `removeBgApiKey` | string, nullable | Não | — |
| `createdAt` | string (date-time) | Não | — |
| `updatedAt` | string (date-time) | Não | — |

**Exemplo de resposta (`200`):**

```json
{
  "id": "string",
  "sessionId": "string",
  "enabled": true,
  "botMode": "string",
  "botAllowedJids": [
    "string"
  ],
  "autoReplyMode": "string",
  "autoReplyAllowedJids": [
    "string"
  ],
  "botName": "string",
  "enableSticker": true,
  "enableVideoSticker": true,
  "maxStickerDuration": 0,
  "enablePing": true,
  "enableUptime": true,
  "removeBgApiKey": "string",
  "createdAt": "2026-01-15T08:00:00.000Z",
  "updatedAt": "2026-01-15T08:00:00.000Z"
}
```

#### Exemplo em cURL

```bash
curl -X POST "http://localhost:3000/api/sessions/abc123/bot-config" \
  -H "X-API-Key: sua-chave" \
  -H "Content-Type: application/json" \
  -d '{"enabled":true,"botMode":"BLACKLIST","botBlockedJids":["5511987654321@s.whatsapp.net"],"autoReplyMode":"SPECIFIC","autoReplyAllowedJids":["5511987654321@s.whatsapp.net"],"botName":"My Assistant","enableSticker":true}'
```

---

### \[GET\] /sessions/{id}

**Detalhes da sessão**

Informações detalhadas de uma sessão, incluindo status e tempo conectado

#### Parâmetros

| Nome | Local | Obrigatório | Tipo | Descrição |
| :--- | :--- | :--- | :--- | :--- |
| `id` | caminho | ✅ Sim | string | — |

#### Respostas

| Código | Descrição |
| :--- | :--- |
| `200` | Detalhes da sessão |
| `404` | Sessão não encontrada |

**Exemplo de resposta (`200`):**

```json
{
  "id": "clx123abc",
  "name": "Marketing Bot",
  "sessionId": "marketing-1",
  "status": "Connected",
  "userId": "string",
  "botConfig": {
    "text": "Olá do W-AZAP!"
  },
  "webhooks": [
    {
      "text": "Olá do W-AZAP!"
    }
  ],
  "_count": {
    "contacts": 0,
    "messages": 0,
    "groups": 0,
    "autoReplies": 0,
    "scheduledMessages": 0
  },
  "createdAt": "2026-01-15T08:00:00.000Z",
  "updatedAt": "2026-01-15T08:00:00.000Z",
  "uptime": 0,
  "messageCount": 0,
  "hasInstance": true,
  "me": {
    "text": "Olá do W-AZAP!"
  }
}
```

#### Exemplo em cURL

```bash
curl -X GET "http://localhost:3000/api/sessions/abc123" \
  -H "X-API-Key: sua-chave"
```

---

### \[POST\] /sessions/{id}/{action}

**Executar ação na sessão**

Inicia, para, reinicia ou desconecta (logout) uma sessão

#### Parâmetros

| Nome | Local | Obrigatório | Tipo | Descrição |
| :--- | :--- | :--- | :--- | :--- |
| `id` | caminho | ✅ Sim | string | — |
| `action` | caminho | ✅ Sim | string | **Opções:** `start`, `stop`, `restart`, `logout` |

#### Respostas

| Código | Descrição |
| :--- | :--- |
| `200` | Ação executada com sucesso |
| `400` | Ação inválida |
| `500` | Falha ao executar a ação |

**Campos da resposta (`200`):**

| Campo | Tipo | Obrigatório | Descrição |
| :--- | :--- | :--- | :--- |
| `status` | boolean | Não | — |
| `message` | string | Não | — |
| `data` | object, nullable | Não | — |

**Exemplo de resposta (`200`):**

```json
{
  "status": true,
  "message": "Operation successful",
  "data": {
    "text": "Olá do W-AZAP!"
  }
}
```

#### Exemplo em cURL

```bash
curl -X POST "http://localhost:3000/api/sessions/abc123/start" \
  -H "X-API-Key: sua-chave"
```

---

### \[PATCH\] /sessions/{id}/settings

**Atualizar as configurações da sessão**

#### Parâmetros

| Nome | Local | Obrigatório | Tipo | Descrição |
| :--- | :--- | :--- | :--- | :--- |
| `id` | caminho | ✅ Sim | string | — |

#### Cabeçalhos

```
X-API-Key: sua-chave
Content-Type: application/json
```

#### Corpo da requisição (`application/json`)

| Campo | Tipo | Obrigatório | Descrição |
| :--- | :--- | :--- | :--- |
| `config` | object | Não | — |

**Exemplo:**

```json
{
  "config": {
    "readReceipts": true,
    "rejectCalls": true
  }
}
```

#### Respostas

| Código | Descrição |
| :--- | :--- |
| `200` | Configurações atualizadas |

#### Exemplo em cURL

```bash
curl -X PATCH "http://localhost:3000/api/sessions/abc123/settings" \
  -H "X-API-Key: sua-chave" \
  -H "Content-Type: application/json" \
  -d '{"config":{"readReceipts":true,"rejectCalls":true}}'
```

---

### \[DELETE\] /sessions/{id}/settings

**Excluir a sessão e desconectar**

Exclui a sessão permanentemente e desconecta a conta do WhatsApp

#### Parâmetros

| Nome | Local | Obrigatório | Tipo | Descrição |
| :--- | :--- | :--- | :--- | :--- |
| `id` | caminho | ✅ Sim | string | — |

#### Respostas

| Código | Descrição |
| :--- | :--- |
| `200` | Sessão excluída |

**Campos da resposta (`200`):**

| Campo | Tipo | Obrigatório | Descrição |
| :--- | :--- | :--- | :--- |
| `status` | boolean | Não | — |
| `message` | string | Não | — |
| `data` | object, nullable | Não | — |

**Exemplo de resposta (`200`):**

```json
{
  "status": true,
  "message": "Operation successful",
  "data": {
    "text": "Olá do W-AZAP!"
  }
}
```

#### Exemplo em cURL

```bash
curl -X DELETE "http://localhost:3000/api/sessions/abc123/settings" \
  -H "X-API-Key: sua-chave"
```

---

## 📂 Acesso às sessões

### \[GET\] /sessions/{sessionId}/access

**Listar usuários com acesso compartilhado**

Lista todos os usuários que receberam acesso à sessão. Somente o dono da sessão ou um SUPERADMIN pode usar este endpoint.

#### Parâmetros

| Nome | Local | Obrigatório | Tipo | Descrição |
| :--- | :--- | :--- | :--- | :--- |
| `sessionId` | caminho | ✅ Sim | string | ID da sessão (identificador textual ou CUID) |

#### Respostas

| Código | Descrição |
| :--- | :--- |
| `200` | Lista de acessos obtida |
| `401` | Não autenticado: chave de API ausente ou inválida |
| `403` | Proibido: só o dono da sessão pode gerenciar os acessos |
| `404` | Sessão não encontrada |

**Campos da resposta (`200`):**

| Campo | Tipo | Obrigatório | Descrição |
| :--- | :--- | :--- | :--- |
| `status` | boolean | Não | — |
| `message` | string | Não | — |
| `data` | array de object | Não | — |

**Exemplo de resposta (`200`):**

```json
{
  "status": true,
  "message": "Access list retrieved successfully",
  "data": [
    {
      "id": "string",
      "sessionId": "string",
      "userId": "string",
      "createdAt": "2026-01-15T08:00:00.000Z",
      "user": {
        "id": "string",
        "name": "string",
        "email": "string",
        "role": "string"
      }
    }
  ]
}
```

#### Exemplo em cURL

```bash
curl -X GET "http://localhost:3000/api/sessions/marketing-1/access" \
  -H "X-API-Key: sua-chave"
```

---

### \[POST\] /sessions/{sessionId}/access

**Conceder acesso a outro usuário**

Concede acesso à sessão a outro usuário cadastrado, pelo e-mail. Somente o dono da sessão ou um SUPERADMIN pode usar este endpoint. Não é possível conceder acesso ao próprio dono nem a SUPERADMINs.

#### Parâmetros

| Nome | Local | Obrigatório | Tipo | Descrição |
| :--- | :--- | :--- | :--- | :--- |
| `sessionId` | caminho | ✅ Sim | string | ID da sessão (identificador textual ou CUID) |

#### Cabeçalhos

```
X-API-Key: sua-chave
Content-Type: application/json
```

#### Corpo da requisição (`application/json`)

| Campo | Tipo | Obrigatório | Descrição |
| :--- | :--- | :--- | :--- |
| `email` | string (email) | ✅ Sim | E-mail do usuário que vai receber o acesso |

**Exemplo:**

```json
{
  "email": "staff@example.com"
}
```

#### Respostas

| Código | Descrição |
| :--- | :--- |
| `201` | Acesso concedido com sucesso |
| `400` | Erro de validação / não é possível conceder ao dono / o SUPERADMIN já tem acesso |
| `401` | Não autenticado: chave de API ausente ou inválida |
| `403` | Proibido: só o dono da sessão pode gerenciar os acessos |
| `404` | Sessão ou usuário não encontrado |
| `409` | O usuário já tem acesso a esta sessão |

#### Exemplo em cURL

```bash
curl -X POST "http://localhost:3000/api/sessions/marketing-1/access" \
  -H "X-API-Key: sua-chave" \
  -H "Content-Type: application/json" \
  -d '{"email":"staff@example.com"}'
```

---

### \[DELETE\] /sessions/{sessionId}/access

**Revogar o acesso de um usuário**

Remove o acesso compartilhado de um usuário à sessão. Somente o dono da sessão ou um SUPERADMIN pode usar este endpoint.

#### Parâmetros

| Nome | Local | Obrigatório | Tipo | Descrição |
| :--- | :--- | :--- | :--- | :--- |
| `sessionId` | caminho | ✅ Sim | string | ID da sessão (identificador textual ou CUID) |

#### Cabeçalhos

```
X-API-Key: sua-chave
Content-Type: application/json
```

#### Corpo da requisição (`application/json`)

| Campo | Tipo | Obrigatório | Descrição |
| :--- | :--- | :--- | :--- |
| `userId` | string | ✅ Sim | CUID do usuário que vai perder o acesso |

**Exemplo:**

```json
{
  "userId": "clx456ghi"
}
```

#### Respostas

| Código | Descrição |
| :--- | :--- |
| `200` | Acesso revogado com sucesso |
| `400` | Erro de validação |
| `401` | Não autenticado: chave de API ausente ou inválida |
| `403` | Proibido: só o dono da sessão pode gerenciar os acessos |
| `404` | Sessão ou registro de acesso não encontrado |

**Campos da resposta (`200`):**

| Campo | Tipo | Obrigatório | Descrição |
| :--- | :--- | :--- | :--- |
| `status` | boolean | Não | — |
| `message` | string | Não | — |
| `data` | object, nullable | Não | — |

**Exemplo de resposta (`200`):**

```json
{
  "status": true,
  "message": "Operation successful",
  "data": {
    "text": "Olá do W-AZAP!"
  }
}
```

#### Exemplo em cURL

```bash
curl -X DELETE "http://localhost:3000/api/sessions/marketing-1/access" \
  -H "X-API-Key: sua-chave" \
  -H "Content-Type: application/json" \
  -d '{"userId":"clx456ghi"}'
```

---

## 📂 Mensagens

### \[POST\] /messages/{sessionId}/{jid}/send

**Enviar mensagem (texto/mídia/figurinha)**

Endpoint universal para enviar texto, imagens, vídeos, documentos e figurinhas. Aceita menções e todos os tipos de mensagem do WhatsApp. URLs de mídia precisam ser públicas (`http`/`https`): endereços internos e caminhos de arquivos locais são recusados.

#### Parâmetros

| Nome | Local | Obrigatório | Tipo | Descrição |
| :--- | :--- | :--- | :--- | :--- |
| `sessionId` | caminho | ✅ Sim | string | Identificador da sessão |
| `jid` | caminho | ✅ Sim | string | JID do destinatário |

#### Cabeçalhos

```
X-API-Key: sua-chave
Content-Type: application/json
```

#### Corpo da requisição (`application/json`)

| Campo | Tipo | Obrigatório | Descrição |
| :--- | :--- | :--- | :--- |
| `message` | object | ✅ Sim | Conteúdo da mensagem (texto, imagem, figurinha etc.) |
| `mentions` | array de string | Não | Lista de JIDs a mencionar (em mensagens de grupo) |

**Exemplo:**

```json
{
  "message": {
    "text": "Olá do W-AZAP!"
  },
  "mentions": [
    "5511987654321@s.whatsapp.net"
  ]
}
```

#### Respostas

| Código | Descrição |
| :--- | :--- |
| `200` | Mensagem enviada com sucesso |
| `400` | Requisição inválida: `jid` e `message` são obrigatórios |
| `401` | Não autenticado: chave de API ausente ou inválida |
| `403` | Proibido: acesso negado |
| `404` | Sessão não encontrada ou desconectada |
| `500` | Falha ao enviar a mensagem |
| `503` | Sessão desconectada ou ainda não pronta |

**Campos da resposta (`200`):**

| Campo | Tipo | Obrigatório | Descrição |
| :--- | :--- | :--- | :--- |
| `status` | boolean | Não | — |
| `message` | string | Não | — |
| `data` | object, nullable | Não | — |

**Exemplo de resposta (`200`):**

```json
{
  "status": true,
  "message": "Message sent successfully",
  "data": {
    "key": {
      "remoteJid": "5511987654321@s.whatsapp.net",
      "fromMe": true,
      "id": "3EB01234567890"
    },
    "message": {
      "conversation": "Hello from W-AZAP!"
    },
    "messageTimestamp": "1678901234"
  }
}
```

#### Exemplo em cURL

```bash
curl -X POST "http://localhost:3000/api/messages/sales-01/5511987654321@s.whatsapp.net/send" \
  -H "X-API-Key: sua-chave" \
  -H "Content-Type: application/json" \
  -d '{"message":{"text":"Olá do W-AZAP!"},"mentions":["5511987654321@s.whatsapp.net"]}'
```

---

### \[POST\] /messages/{sessionId}/{jid}/media

**Enviar mídia (imagem/vídeo/áudio/documento)**

Envia um arquivo via `multipart/form-data` (campos `file`, `type` e `caption`). Tamanho máximo: `MAX_UPLOAD_SIZE_MB`.

#### Parâmetros

| Nome | Local | Obrigatório | Tipo | Descrição |
| :--- | :--- | :--- | :--- | :--- |
| `sessionId` | caminho | ✅ Sim | string | Identificador da sessão |
| `jid` | caminho | ✅ Sim | string | JID do destinatário |

#### Cabeçalhos

```
X-API-Key: sua-chave
Content-Type: application/json
```

#### Corpo da requisição (`multipart/form-data`)

| Campo | Tipo | Obrigatório | Descrição |
| :--- | :--- | :--- | :--- |
| `file` | string (binary) | ✅ Sim | — |
| `type` | string | ✅ Sim | **Opções:** `image`, `video`, `audio`, `voice`, `document`, `sticker` **Padrão:** `image` |
| `caption` | string | Não | — |

**Exemplo:**

```json
{
  "file": "(binary)",
  "type": "image",
  "caption": "string"
}
```

#### Respostas

| Código | Descrição |
| :--- | :--- |
| `200` | Mídia enviada com sucesso |
| `400` | Requisição inválida: arquivo ausente |
| `401` | Não autenticado: chave de API ausente ou inválida |
| `403` | Proibido: acesso negado |
| `500` | Falha ao enviar a mídia |
| `503` | Sessão desconectada ou ainda não pronta |

**Campos da resposta (`200`):**

| Campo | Tipo | Obrigatório | Descrição |
| :--- | :--- | :--- | :--- |
| `status` | boolean | Não | — |
| `message` | string | Não | — |
| `data` | object, nullable | Não | — |

**Exemplo de resposta (`200`):**

```json
{
  "status": true,
  "message": "Operation successful",
  "data": {
    "text": "Olá do W-AZAP!"
  }
}
```

#### Exemplo em cURL

```bash
curl -X POST "http://localhost:3000/api/messages/vendas-01/5511987654321%40s.whatsapp.net/media" \
  -H "X-API-Key: sua-chave" \
  -F "file=@/caminho/para/arquivo.jpg" \
  -F "type=image" \
  -F "caption=Olá"
```

---

### \[POST\] /messages/{sessionId}/broadcast

**Transmitir mensagem para vários destinatários**

Envia a mesma mensagem para vários contatos em segundo plano, com intervalos aleatórios contra banimento. O progresso é emitido pelo Socket.IO (`broadcast.progress`) e fica registrado no histórico.

#### Parâmetros

| Nome | Local | Obrigatório | Tipo | Descrição |
| :--- | :--- | :--- | :--- | :--- |
| `sessionId` | caminho | ✅ Sim | string | — |

#### Cabeçalhos

```
X-API-Key: sua-chave
Content-Type: application/json
```

#### Corpo da requisição (`application/json`)

| Campo | Tipo | Obrigatório | Descrição |
| :--- | :--- | :--- | :--- |
| `recipients` | array de string | ✅ Sim | — |
| `message` | string | ✅ Sim | — |
| `delay` | number | Não | Intervalo base entre os envios, em ms (padrão: 2000). A cada envio é somado um acréscimo aleatório de até 50%. |

**Exemplo:**

```json
{
  "recipients": [
    "5511987654321@s.whatsapp.net",
    "5521912345678@s.whatsapp.net"
  ],
  "message": "Flash Sale! 50% off",
  "delay": 0
}
```

#### Respostas

| Código | Descrição |
| :--- | :--- |
| `200` | Transmissão iniciada |
| `401` | Não autenticado: chave de API ausente ou inválida |
| `403` | Proibido: acesso negado |
| `500` | Falha ao iniciar a transmissão |
| `503` | Sessão desconectada ou ainda não pronta |

**Campos da resposta (`200`):**

| Campo | Tipo | Obrigatório | Descrição |
| :--- | :--- | :--- | :--- |
| `success` | boolean | Não | — |
| `message` | string | Não | — |

**Exemplo de resposta (`200`):**

```json
{
  "success": true,
  "message": "Broadcast started in background"
}
```

#### Exemplo em cURL

```bash
curl -X POST "http://localhost:3000/api/messages/vendas-01/broadcast" \
  -H "X-API-Key: sua-chave" \
  -H "Content-Type: application/json" \
  -d '{"recipients":["5511987654321@s.whatsapp.net","5521912345678@s.whatsapp.net"],"message":"Flash Sale! 50% off","delay":0}'
```

---

### \[GET\] /messages/{sessionId}/broadcast/history

**Histórico de transmissões**

Lista as transmissões anteriores com status e contagem de enviadas e com falha (salvas no banco)

#### Parâmetros

| Nome | Local | Obrigatório | Tipo | Descrição |
| :--- | :--- | :--- | :--- | :--- |
| `sessionId` | caminho | ✅ Sim | string | — |
| `limit` | query | Não | integer | Quantidade de resultados (máx. 50) **Padrão:** `20` |
| `offset` | query | Não | integer | Deslocamento da paginação **Padrão:** `0` |

#### Respostas

| Código | Descrição |
| :--- | :--- |
| `200` | Histórico de transmissões |
| `401` | Não autenticado: chave de API ausente ou inválida |
| `403` | Proibido: acesso negado |

**Campos da resposta (`200`):**

| Campo | Tipo | Obrigatório | Descrição |
| :--- | :--- | :--- | :--- |
| `status` | boolean | Não | — |
| `data` | array de object | Não | — |
| `total` | integer | Não | — |
| `limit` | integer | Não | — |
| `offset` | integer | Não | — |

**Exemplo de resposta (`200`):**

```json
{
  "status": true,
  "data": [
    {
      "id": "string",
      "sessionId": "string",
      "message": "string",
      "total": 0,
      "sent": 0,
      "failed": 0,
      "status": "running",
      "delay": 0,
      "startedAt": "2026-01-15T08:00:00.000Z",
      "completedAt": "2026-01-15T08:00:00.000Z"
    }
  ],
  "total": 0,
  "limit": 0,
  "offset": 0
}
```

#### Exemplo em cURL

```bash
curl -X GET "http://localhost:3000/api/messages/vendas-01/broadcast/history?limit=value&offset=value" \
  -H "X-API-Key: sua-chave"
```

---

### \[GET\] /messages/{sessionId}/broadcast/history/{logId}

**Detalhes de uma transmissão**

Detalhes completos de uma transmissão, incluindo o status de cada destinatário

#### Parâmetros

| Nome | Local | Obrigatório | Tipo | Descrição |
| :--- | :--- | :--- | :--- | :--- |
| `sessionId` | caminho | ✅ Sim | string | — |
| `logId` | caminho | ✅ Sim | string | — |

#### Respostas

| Código | Descrição |
| :--- | :--- |
| `200` | Detalhes da transmissão |
| `401` | Não autenticado: chave de API ausente ou inválida |
| `403` | Proibido: acesso negado |
| `404` | Transmissão não encontrada |

**Campos da resposta (`200`):**

| Campo | Tipo | Obrigatório | Descrição |
| :--- | :--- | :--- | :--- |
| `status` | boolean | Não | — |
| `data` | object | Não | — |

**Exemplo de resposta (`200`):**

```json
{
  "status": true,
  "data": {
    "id": "string",
    "sessionId": "string",
    "message": "string",
    "total": 0,
    "sent": 0,
    "failed": 0,
    "status": "string",
    "delay": 0,
    "startedAt": "2026-01-15T08:00:00.000Z",
    "completedAt": "2026-01-15T08:00:00.000Z",
    "recipients": [
      {
        "id": "string",
        "jid": "string",
        "status": "pending",
        "error": "string",
        "sentAt": "2026-01-15T08:00:00.000Z"
      }
    ]
  }
}
```

#### Exemplo em cURL

```bash
curl -X GET "http://localhost:3000/api/messages/vendas-01/broadcast/history/value" \
  -H "X-API-Key: sua-chave"
```

---

### \[POST\] /messages/{sessionId}/{jid}/poll

**Enviar enquete**

Cria uma enquete interativa (de 2 a 12 opções, escolha única ou múltipla)

#### Parâmetros

| Nome | Local | Obrigatório | Tipo | Descrição |
| :--- | :--- | :--- | :--- | :--- |
| `sessionId` | caminho | ✅ Sim | string | — |
| `jid` | caminho | ✅ Sim | string | — |

#### Cabeçalhos

```
X-API-Key: sua-chave
Content-Type: application/json
```

#### Corpo da requisição (`application/json`)

| Campo | Tipo | Obrigatório | Descrição |
| :--- | :--- | :--- | :--- |
| `question` | string | ✅ Sim | — |
| `options` | array de string | ✅ Sim | — |
| `selectableCount` | integer | Não | — |

**Exemplo:**

```json
{
  "question": "What's your favorite product?",
  "options": [
    "Product A",
    "Product B",
    "Product C"
  ],
  "selectableCount": 1
}
```

#### Respostas

| Código | Descrição |
| :--- | :--- |
| `200` | Enquete enviada |
| `401` | Não autenticado: chave de API ausente ou inválida |
| `403` | Proibido: acesso negado |
| `500` | Falha ao enviar a enquete |
| `503` | Sessão desconectada ou ainda não pronta |

**Campos da resposta (`200`):**

| Campo | Tipo | Obrigatório | Descrição |
| :--- | :--- | :--- | :--- |
| `success` | boolean | Não | — |

**Exemplo de resposta (`200`):**

```json
{
  "success": true
}
```

#### Exemplo em cURL

```bash
curl -X POST "http://localhost:3000/api/messages/vendas-01/5511987654321%40s.whatsapp.net/poll" \
  -H "X-API-Key: sua-chave" \
  -H "Content-Type: application/json" \
  -d '{"question":"What's your favorite product?","options":["Product A","Product B","Product C"],"selectableCount":1}'
```

---

### \[POST\] /messages/{sessionId}/{jid}/location

**Enviar localização**

Compartilha coordenadas GPS, com nome e endereço opcionais

#### Parâmetros

| Nome | Local | Obrigatório | Tipo | Descrição |
| :--- | :--- | :--- | :--- | :--- |
| `sessionId` | caminho | ✅ Sim | string | — |
| `jid` | caminho | ✅ Sim | string | — |

#### Cabeçalhos

```
X-API-Key: sua-chave
Content-Type: application/json
```

#### Corpo da requisição (`application/json`)

| Campo | Tipo | Obrigatório | Descrição |
| :--- | :--- | :--- | :--- |
| `latitude` | number | ✅ Sim | — |
| `longitude` | number | ✅ Sim | — |
| `name` | string | Não | — |
| `address` | string | Não | — |

**Exemplo:**

```json
{
  "latitude": -6.2088,
  "longitude": 106.8456,
  "name": "Central Park",
  "address": "Jakarta, Indonesia"
}
```

#### Respostas

| Código | Descrição |
| :--- | :--- |
| `200` | Localização enviada |
| `401` | Não autenticado: chave de API ausente ou inválida |
| `403` | Proibido: acesso negado |
| `500` | Falha ao enviar a localização |
| `503` | Sessão desconectada ou ainda não pronta |

**Campos da resposta (`200`):**

| Campo | Tipo | Obrigatório | Descrição |
| :--- | :--- | :--- | :--- |
| `success` | boolean | Não | — |

**Exemplo de resposta (`200`):**

```json
{
  "success": true
}
```

#### Exemplo em cURL

```bash
curl -X POST "http://localhost:3000/api/messages/vendas-01/5511987654321%40s.whatsapp.net/location" \
  -H "X-API-Key: sua-chave" \
  -H "Content-Type: application/json" \
  -d '{"latitude":-6.2088,"longitude":106.8456,"name":"Central Park","address":"Jakarta, Indonesia"}'
```

---

### \[POST\] /messages/{sessionId}/{jid}/contact

**Enviar cartão de contato**

Compartilha um ou mais contatos em formato vCard

#### Parâmetros

| Nome | Local | Obrigatório | Tipo | Descrição |
| :--- | :--- | :--- | :--- | :--- |
| `sessionId` | caminho | ✅ Sim | string | — |
| `jid` | caminho | ✅ Sim | string | — |

#### Cabeçalhos

```
X-API-Key: sua-chave
Content-Type: application/json
```

#### Corpo da requisição (`application/json`)

| Campo | Tipo | Obrigatório | Descrição |
| :--- | :--- | :--- | :--- |
| `contacts` | array de object | ✅ Sim | — |

**Exemplo:**

```json
{
  "contacts": [
    {
      "displayName": "John Doe",
      "vcard": "BEGIN:VCARD..."
    }
  ]
}
```

#### Respostas

| Código | Descrição |
| :--- | :--- |
| `200` | Contato enviado |
| `401` | Não autenticado: chave de API ausente ou inválida |
| `403` | Proibido: acesso negado |
| `500` | Falha ao enviar o contato |
| `503` | Sessão desconectada ou ainda não pronta |

**Campos da resposta (`200`):**

| Campo | Tipo | Obrigatório | Descrição |
| :--- | :--- | :--- | :--- |
| `success` | boolean | Não | — |

**Exemplo de resposta (`200`):**

```json
{
  "success": true
}
```

#### Exemplo em cURL

```bash
curl -X POST "http://localhost:3000/api/messages/vendas-01/5511987654321%40s.whatsapp.net/contact" \
  -H "X-API-Key: sua-chave" \
  -H "Content-Type: application/json" \
  -d '{"contacts":[{"displayName":"John Doe","vcard":"BEGIN:VCARD..."}]}'
```

---

### \[GET\] /messages/{sessionId}/download/{messageId}/media

**Baixar a mídia de uma mensagem**

Baixa a mídia de uma mensagem (arquivo binário direto ou redirecionamento)

#### Parâmetros

| Nome | Local | Obrigatório | Tipo | Descrição |
| :--- | :--- | :--- | :--- | :--- |
| `sessionId` | caminho | ✅ Sim | string | — |
| `messageId` | caminho | ✅ Sim | string | — |

#### Respostas

| Código | Descrição |
| :--- | :--- |
| `200` | Arquivo de mídia binário |
| `401` | Não autenticado: chave de API ausente ou inválida |
| `403` | Proibido: sem acesso à sessão ou à mensagem |
| `404` | Mensagem não encontrada ou sem mídia |

#### Exemplo em cURL

```bash
curl -X GET "http://localhost:3000/api/messages/vendas-01/download/MSG_ID_123/media" \
  -H "X-API-Key: sua-chave"
```

---

### \[POST\] /messages/{sessionId}/{jid}/{messageId}/react

**Reagir a uma mensagem com emoji**

Adiciona uma reação com emoji a uma mensagem (texto vazio remove a reação)

#### Parâmetros

| Nome | Local | Obrigatório | Tipo | Descrição |
| :--- | :--- | :--- | :--- | :--- |
| `sessionId` | caminho | ✅ Sim | string | — |
| `jid` | caminho | ✅ Sim | string | — |
| `messageId` | caminho | ✅ Sim | string | — |

#### Cabeçalhos

```
X-API-Key: sua-chave
Content-Type: application/json
```

#### Corpo da requisição (`application/json`)

| Campo | Tipo | Obrigatório | Descrição |
| :--- | :--- | :--- | :--- |
| `emoji` | string | ✅ Sim | Emoji, ou texto vazio para remover |

**Exemplo:**

```json
{
  "emoji": "👍"
}
```

#### Respostas

| Código | Descrição |
| :--- | :--- |
| `200` | Reação enviada |
| `401` | Não autenticado: chave de API ausente ou inválida |
| `403` | Proibido: acesso negado |
| `500` | Falha ao enviar a reação |
| `503` | Sessão desconectada ou ainda não pronta |

**Campos da resposta (`200`):**

| Campo | Tipo | Obrigatório | Descrição |
| :--- | :--- | :--- | :--- |
| `success` | boolean | Não | — |
| `message` | string | Não | — |

**Exemplo de resposta (`200`):**

```json
{
  "success": true,
  "message": "string"
}
```

#### Exemplo em cURL

```bash
curl -X POST "http://localhost:3000/api/messages/vendas-01/5511987654321%40s.whatsapp.net/MSG_ID_123/react" \
  -H "X-API-Key: sua-chave" \
  -H "Content-Type: application/json" \
  -d '{"emoji":"👍"}'
```

---

### \[POST\] /messages/{sessionId}/{jid}/{messageId}/reply

**Responder a uma mensagem (com citação)**

Envia uma resposta citando uma mensagem específica pelo ID. Usa o mesmo formato do `/send`: envie um objeto de mensagem do Baileys.

#### Parâmetros

| Nome | Local | Obrigatório | Tipo | Descrição |
| :--- | :--- | :--- | :--- | :--- |
| `sessionId` | caminho | ✅ Sim | string | — |
| `jid` | caminho | ✅ Sim | string | — |
| `messageId` | caminho | ✅ Sim | string | ID da mensagem a responder |

#### Cabeçalhos

```
X-API-Key: sua-chave
Content-Type: application/json
```

#### Corpo da requisição (`application/json`)

| Campo | Tipo | Obrigatório | Descrição |
| :--- | :--- | :--- | :--- |
| `message` | object | ✅ Sim | Conteúdo da mensagem, no mesmo formato do `/send` (texto, imagem, vídeo etc.) |
| `mentions` | array de string | Não | JIDs a mencionar |
| `fromMe` | boolean | Não | Indica se a mensagem citada foi enviada por você **Padrão:** `false` |

**Exemplo:**

```json
{
  "message": {
    "text": "Thanks for your message!"
  },
  "mentions": [
    "5511987654321@s.whatsapp.net"
  ],
  "fromMe": true
}
```

#### Respostas

| Código | Descrição |
| :--- | :--- |
| `200` | Resposta enviada com sucesso |
| `400` | `message` é obrigatório |
| `401` | Não autenticado: chave de API ausente ou inválida |
| `403` | Proibido: acesso negado |
| `500` | Falha ao enviar a resposta |
| `503` | Sessão desconectada ou ainda não pronta |

**Campos da resposta (`200`):**

| Campo | Tipo | Obrigatório | Descrição |
| :--- | :--- | :--- | :--- |
| `success` | boolean | Não | — |
| `message` | string | Não | — |

**Exemplo de resposta (`200`):**

```json
{
  "success": true,
  "message": "Message sent successfully"
}
```

#### Exemplo em cURL

```bash
curl -X POST "http://localhost:3000/api/messages/sales-01/5511987654321@s.whatsapp.net/3EB0ABCD1234567890/reply" \
  -H "X-API-Key: sua-chave" \
  -H "Content-Type: application/json" \
  -d '{"message":{"text":"Thanks for your message!"},"mentions":["5511987654321@s.whatsapp.net"],"fromMe":true}'
```

---

### \[POST\] /messages/{sessionId}/{jid}/reply

**Responder a uma mensagem (ID no corpo)**

Envia uma resposta com citação informando o `messageId` no corpo da requisição. Mesmo formato do `/send`, com o campo `messageId` a mais.

#### Parâmetros

| Nome | Local | Obrigatório | Tipo | Descrição |
| :--- | :--- | :--- | :--- | :--- |
| `sessionId` | caminho | ✅ Sim | string | — |
| `jid` | caminho | ✅ Sim | string | — |

#### Cabeçalhos

```
X-API-Key: sua-chave
Content-Type: application/json
```

#### Corpo da requisição (`application/json`)

| Campo | Tipo | Obrigatório | Descrição |
| :--- | :--- | :--- | :--- |
| `messageId` | string | ✅ Sim | ID da mensagem a responder |
| `message` | object | ✅ Sim | Conteúdo da mensagem, no mesmo formato do `/send` (texto, imagem, vídeo etc.) |
| `mentions` | array de string | Não | JIDs a mencionar |
| `fromMe` | boolean | Não | Indica se a mensagem citada foi enviada por você **Padrão:** `false` |

**Exemplo:**

```json
{
  "messageId": "3EB0ABCD1234567890",
  "message": {
    "text": "Sure, let me check that for you!"
  }
}
```

#### Respostas

| Código | Descrição |
| :--- | :--- |
| `200` | Resposta enviada com sucesso |
| `400` | `messageId` e `message` são obrigatórios |
| `401` | Não autenticado: chave de API ausente ou inválida |
| `403` | Proibido: acesso negado |
| `500` | Falha ao enviar a resposta |
| `503` | Sessão desconectada ou ainda não pronta |

**Campos da resposta (`200`):**

| Campo | Tipo | Obrigatório | Descrição |
| :--- | :--- | :--- | :--- |
| `status` | boolean | Não | — |
| `message` | string | Não | — |
| `data` | object, nullable | Não | — |

**Exemplo de resposta (`200`):**

```json
{
  "status": true,
  "message": "Operation successful",
  "data": {
    "text": "Olá do W-AZAP!"
  }
}
```

#### Exemplo em cURL

```bash
curl -X POST "http://localhost:3000/api/messages/sales-01/5511987654321@s.whatsapp.net/reply" \
  -H "X-API-Key: sua-chave" \
  -H "Content-Type: application/json" \
  -d '{"messageId":"3EB0ABCD1234567890","message":{"text":"Sure, let me check that for you!"}}'
```

---

### \[POST\] /messages/{sessionId}/{jid}/{messageId}/star

**Favoritar ou desfavoritar mensagem**

Marca uma mensagem com estrela (favorita) ou remove a estrela. As mensagens favoritas aparecem na seção "Mensagens favoritas" do WhatsApp.

#### Parâmetros

| Nome | Local | Obrigatório | Tipo | Descrição |
| :--- | :--- | :--- | :--- | :--- |
| `sessionId` | caminho | ✅ Sim | string | — |
| `jid` | caminho | ✅ Sim | string | — |
| `messageId` | caminho | ✅ Sim | string | — |

#### Cabeçalhos

```
X-API-Key: sua-chave
Content-Type: application/json
```

#### Corpo da requisição (`application/json`)

| Campo | Tipo | Obrigatório | Descrição |
| :--- | :--- | :--- | :--- |
| `star` | boolean | Não | `true` para favoritar, `false` para desfavoritar **Padrão:** `true` |
| `fromMe` | boolean | Não | Indica se a mensagem foi enviada por você **Padrão:** `false` |

**Exemplo:**

```json
{
  "star": true,
  "fromMe": false
}
```

#### Respostas

| Código | Descrição |
| :--- | :--- |
| `200` | Estrela atualizada |
| `401` | Não autenticado: chave de API ausente ou inválida |
| `403` | Proibido: acesso negado |
| `500` | Falha ao favoritar/desfavoritar a mensagem |
| `503` | Sessão desconectada ou ainda não pronta |

**Campos da resposta (`200`):**

| Campo | Tipo | Obrigatório | Descrição |
| :--- | :--- | :--- | :--- |
| `success` | boolean | Não | — |
| `message` | string | Não | — |

**Exemplo de resposta (`200`):**

```json
{
  "success": true,
  "message": "Message starred"
}
```

#### Exemplo em cURL

```bash
curl -X POST "http://localhost:3000/api/messages/vendas-01/5511987654321%40s.whatsapp.net/MSG_ID_123/star" \
  -H "X-API-Key: sua-chave" \
  -H "Content-Type: application/json" \
  -d '{"star":true,"fromMe":false}'
```

---

### \[GET\] /messages/{sessionId}/search

**Buscar mensagens**

Busca as mensagens da sessão salvas no banco. Aceita busca em texto e filtros por JID, tipo e remetente.

#### Parâmetros

| Nome | Local | Obrigatório | Tipo | Descrição |
| :--- | :--- | :--- | :--- | :--- |
| `sessionId` | caminho | ✅ Sim | string | — |
| `q` | query | Não | string | Texto a procurar no conteúdo das mensagens |
| `jid` | query | Não | string | Filtrar pelo JID da conversa |
| `type` | query | Não | string | Filtrar pelo tipo de mensagem **Opções:** `TEXT`, `IMAGE`, `VIDEO`, `AUDIO`, `DOCUMENT`, `STICKER`, `LOCATION`, `CONTACT` |
| `fromMe` | query | Não | boolean | Filtrar pelo remetente (`true` = enviadas, `false` = recebidas) |
| `page` | query | Não | integer | **Padrão:** `1` |
| `limit` | query | Não | integer | **Padrão:** `20` |

#### Respostas

| Código | Descrição |
| :--- | :--- |
| `200` | Resultados da busca |
| `400` | `q` ou `jid` é obrigatório |
| `401` | Não autenticado: chave de API ausente ou inválida |
| `403` | Proibido: acesso negado |
| `404` | Sessão não encontrada |
| `500` | Falha ao buscar mensagens |

**Campos da resposta (`200`):**

| Campo | Tipo | Obrigatório | Descrição |
| :--- | :--- | :--- | :--- |
| `success` | boolean | Não | — |
| `data` | array de object | Não | — |
| `pagination` | object | Não | — |

**Exemplo de resposta (`200`):**

```json
{
  "success": true,
  "data": [
    {
      "id": "string",
      "remoteJid": "string",
      "fromMe": true,
      "keyId": "string",
      "pushName": "string",
      "type": "string",
      "content": "string",
      "status": "string",
      "timestamp": "2026-01-15T08:00:00.000Z",
      "quoteId": "string"
    }
  ],
  "pagination": {
    "total": 0,
    "page": 0,
    "limit": 0,
    "pages": 0
  }
}
```

#### Exemplo em cURL

```bash
curl -X GET "http://localhost:3000/api/messages/sales-01/search?q=invoice&jid=5511987654321@s.whatsapp.net&type=value&fromMe=value&page=value&limit=value" \
  -H "X-API-Key: sua-chave"
```

---

### \[POST\] /messages/{sessionId}/{jid}/list

**Enviar mensagem em lista**

Envia uma mensagem formatada como lista numerada

#### Parâmetros

| Nome | Local | Obrigatório | Tipo | Descrição |
| :--- | :--- | :--- | :--- | :--- |
| `sessionId` | caminho | ✅ Sim | string | — |
| `jid` | caminho | ✅ Sim | string | — |

#### Cabeçalhos

```
X-API-Key: sua-chave
Content-Type: application/json
```

#### Corpo da requisição (`application/json`)

| Campo | Tipo | Obrigatório | Descrição |
| :--- | :--- | :--- | :--- |
| `title` | string | ✅ Sim | — |
| `options` | array de string | ✅ Sim | — |
| `footer` | string | Não | — |

**Exemplo:**

```json
{
  "title": "Our Services",
  "options": [
    "Web Dev",
    "App Dev",
    "UI/UX"
  ],
  "footer": "Choose one"
}
```

#### Respostas

| Código | Descrição |
| :--- | :--- |
| `200` | Mensagem enviada |
| `401` | Não autenticado: chave de API ausente ou inválida |
| `403` | Proibido: acesso negado |
| `500` | Falha ao enviar a mensagem |
| `503` | Sessão desconectada ou ainda não pronta |

**Campos da resposta (`200`):**

| Campo | Tipo | Obrigatório | Descrição |
| :--- | :--- | :--- | :--- |
| `success` | boolean | Não | — |

**Exemplo de resposta (`200`):**

```json
{
  "success": true
}
```

#### Exemplo em cURL

```bash
curl -X POST "http://localhost:3000/api/messages/vendas-01/5511987654321%40s.whatsapp.net/list" \
  -H "X-API-Key: sua-chave" \
  -H "Content-Type: application/json" \
  -d '{"title":"Our Services","options":["Web Dev","App Dev","UI/UX"],"footer":"Choose one"}'
```

---

### \[POST\] /messages/{sessionId}/{jid}/spam

**Envio repetido (spam)**

Envia a mesma mensagem várias vezes seguidas, em segundo plano. Use com cuidado: envios repetidos aumentam o risco de banimento da conta.

#### Parâmetros

| Nome | Local | Obrigatório | Tipo | Descrição |
| :--- | :--- | :--- | :--- | :--- |
| `sessionId` | caminho | ✅ Sim | string | — |
| `jid` | caminho | ✅ Sim | string | — |

#### Cabeçalhos

```
X-API-Key: sua-chave
Content-Type: application/json
```

#### Corpo da requisição (`application/json`)

| Campo | Tipo | Obrigatório | Descrição |
| :--- | :--- | :--- | :--- |
| `message` | string | ✅ Sim | — |
| `count` | integer | Não | **Padrão:** `10` |
| `delay` | integer | Não | Intervalo em ms **Padrão:** `500` |

**Exemplo:**

```json
{
  "message": "Check our new catalog!",
  "count": 5,
  "delay": 1000
}
```

#### Respostas

| Código | Descrição |
| :--- | :--- |
| `200` | Envio repetido iniciado |
| `401` | Não autenticado: chave de API ausente ou inválida |
| `403` | Proibido: acesso negado |
| `500` | Falha ao iniciar o envio repetido |
| `503` | Sessão desconectada ou ainda não pronta |

**Campos da resposta (`200`):**

| Campo | Tipo | Obrigatório | Descrição |
| :--- | :--- | :--- | :--- |
| `success` | boolean | Não | — |
| `message` | string | Não | — |

**Exemplo de resposta (`200`):**

```json
{
  "success": true,
  "message": "string"
}
```

#### Exemplo em cURL

```bash
curl -X POST "http://localhost:3000/api/messages/vendas-01/5511987654321%40s.whatsapp.net/spam" \
  -H "X-API-Key: sua-chave" \
  -H "Content-Type: application/json" \
  -d '{"message":"Check our new catalog!","count":5,"delay":1000}'
```

---

### \[POST\] /messages/{sessionId}/{jid}/sticker

**Enviar figurinha**

Converte uma imagem em figurinha e a envia

#### Parâmetros

| Nome | Local | Obrigatório | Tipo | Descrição |
| :--- | :--- | :--- | :--- | :--- |
| `sessionId` | caminho | ✅ Sim | string | — |
| `jid` | caminho | ✅ Sim | string | — |

#### Cabeçalhos

```
X-API-Key: sua-chave
Content-Type: application/json
```

#### Corpo da requisição (`multipart/form-data`)

| Campo | Tipo | Obrigatório | Descrição |
| :--- | :--- | :--- | :--- |
| `file` | string (binary) | ✅ Sim | — |
| `pack` | string | Não | Nome do pacote de figurinhas (padrão: W-AZAP) |
| `author` | string | Não | Nome do autor da figurinha (padrão: User) |
| `type` | string | Não | Tipo de recorte da figurinha (padrão: full) **Opções:** `full`, `crop`, `circle` |
| `quality` | integer | Não | Qualidade da imagem (padrão: 50) |

**Exemplo:**

```json
{
  "file": "(binary)",
  "pack": "string",
  "author": "string",
  "type": "full",
  "quality": 0
}
```

#### Respostas

| Código | Descrição |
| :--- | :--- |
| `200` | Figurinha enviada |
| `401` | Não autenticado: chave de API ausente ou inválida |
| `403` | Proibido: acesso negado |
| `500` | Falha ao criar a figurinha |
| `503` | Sessão desconectada ou ainda não pronta |

**Campos da resposta (`200`):**

| Campo | Tipo | Obrigatório | Descrição |
| :--- | :--- | :--- | :--- |
| `success` | boolean | Não | — |

**Exemplo de resposta (`200`):**

```json
{
  "success": true
}
```

#### Exemplo em cURL

```bash
curl -X POST "http://localhost:3000/api/messages/vendas-01/5511987654321%40s.whatsapp.net/sticker" \
  -H "X-API-Key: sua-chave" \
  -F "file=@/caminho/para/arquivo.jpg" \
  -F "type=image" \
  -F "caption=Olá"
```

---

### \[POST\] /messages/{sessionId}/forward

**Encaminhar mensagem**

Encaminha uma mensagem para uma ou mais conversas

#### Parâmetros

| Nome | Local | Obrigatório | Tipo | Descrição |
| :--- | :--- | :--- | :--- | :--- |
| `sessionId` | caminho | ✅ Sim | string | — |

#### Cabeçalhos

```
X-API-Key: sua-chave
Content-Type: application/json
```

#### Corpo da requisição (`application/json`)

| Campo | Tipo | Obrigatório | Descrição |
| :--- | :--- | :--- | :--- |
| `fromJid` | string | ✅ Sim | JID da conversa de origem |
| `messageId` | string | ✅ Sim | — |
| `toJids` | array de string | ✅ Sim | JIDs dos destinatários |

**Exemplo:**

```json
{
  "fromJid": "5511987654321@s.whatsapp.net",
  "messageId": "3EB0ABCD1234567890",
  "toJids": [
    "5521912345678@s.whatsapp.net"
  ]
}
```

#### Respostas

| Código | Descrição |
| :--- | :--- |
| `200` | Mensagem encaminhada |
| `401` | Não autenticado: chave de API ausente ou inválida |
| `403` | Proibido: acesso negado |
| `500` | Falha ao encaminhar a mensagem |
| `503` | Sessão desconectada ou ainda não pronta |

**Campos da resposta (`200`):**

| Campo | Tipo | Obrigatório | Descrição |
| :--- | :--- | :--- | :--- |
| `success` | boolean | Não | — |
| `message` | string | Não | — |

**Exemplo de resposta (`200`):**

```json
{
  "success": true,
  "message": "string"
}
```

#### Exemplo em cURL

```bash
curl -X POST "http://localhost:3000/api/messages/vendas-01/forward" \
  -H "X-API-Key: sua-chave" \
  -H "Content-Type: application/json" \
  -d '{"fromJid":"5511987654321@s.whatsapp.net","messageId":"3EB0ABCD1234567890","toJids":["5521912345678@s.whatsapp.net"]}'
```

---

### \[DELETE\] /messages/{sessionId}/{jid}/{messageId}

**Apagar mensagem para todos**

Apaga a mensagem para todos (o WhatsApp só permite em mensagens recentes)

#### Parâmetros

| Nome | Local | Obrigatório | Tipo | Descrição |
| :--- | :--- | :--- | :--- | :--- |
| `sessionId` | caminho | ✅ Sim | string | — |
| `jid` | caminho | ✅ Sim | string | — |
| `messageId` | caminho | ✅ Sim | string | — |

#### Respostas

| Código | Descrição |
| :--- | :--- |
| `200` | Mensagem apagada |
| `401` | Não autenticado: chave de API ausente ou inválida |
| `403` | Proibido: acesso negado |
| `500` | Falha ao apagar a mensagem |
| `503` | Sessão desconectada ou ainda não pronta |

**Campos da resposta (`200`):**

| Campo | Tipo | Obrigatório | Descrição |
| :--- | :--- | :--- | :--- |
| `success` | boolean | Não | — |
| `message` | string | Não | — |

**Exemplo de resposta (`200`):**

```json
{
  "success": true,
  "message": "Message deleted for everyone"
}
```

#### Exemplo em cURL

```bash
curl -X DELETE "http://localhost:3000/api/messages/vendas-01/5511987654321%40s.whatsapp.net/MSG_ID_123" \
  -H "X-API-Key: sua-chave"
```

---

### \[PATCH\] /messages/{sessionId}/{jid}/{messageId}

**Editar mensagem enviada**

Edita o texto de uma mensagem já enviada

#### Parâmetros

| Nome | Local | Obrigatório | Tipo | Descrição |
| :--- | :--- | :--- | :--- | :--- |
| `sessionId` | caminho | ✅ Sim | string | — |
| `jid` | caminho | ✅ Sim | string | — |
| `messageId` | caminho | ✅ Sim | string | — |

#### Cabeçalhos

```
X-API-Key: sua-chave
Content-Type: application/json
```

#### Corpo da requisição (`application/json`)

| Campo | Tipo | Obrigatório | Descrição |
| :--- | :--- | :--- | :--- |
| `text` | string | ✅ Sim | — |

**Exemplo:**

```json
{
  "text": "Updated text message"
}
```

#### Respostas

| Código | Descrição |
| :--- | :--- |
| `200` | Mensagem editada |
| `400` | Requisição inválida |
| `401` | Não autenticado: chave de API ausente ou inválida |
| `403` | Proibido: acesso negado |
| `500` | Falha ao editar a mensagem |
| `503` | Sessão desconectada ou ainda não pronta |

**Campos da resposta (`200`):**

| Campo | Tipo | Obrigatório | Descrição |
| :--- | :--- | :--- | :--- |
| `status` | boolean | Não | — |
| `message` | string | Não | — |

**Exemplo de resposta (`200`):**

```json
{
  "status": true,
  "message": "Message edited successfully"
}
```

#### Exemplo em cURL

```bash
curl -X PATCH "http://localhost:3000/api/messages/vendas-01/5511987654321%40s.whatsapp.net/MSG_ID_123" \
  -H "X-API-Key: sua-chave" \
  -H "Content-Type: application/json" \
  -d '{"text":"Updated text message"}'
```

---

## 📂 Chat

### \[GET\] /chat/{sessionId}

**Listar conversas**

Lista as conversas da sessão com a última mensagem de cada uma

#### Parâmetros

| Nome | Local | Obrigatório | Tipo | Descrição |
| :--- | :--- | :--- | :--- | :--- |
| `sessionId` | caminho | ✅ Sim | string | — |

#### Respostas

| Código | Descrição |
| :--- | :--- |
| `200` | Lista de conversas |

**Exemplo de resposta (`200`):**

```json
[
  {
    "jid": "5511987654321@s.whatsapp.net",
    "name": "John Doe",
    "notify": "string",
    "profilePic": "string"
  }
]
```

#### Exemplo em cURL

```bash
curl -X GET "http://localhost:3000/api/chat/vendas-01" \
  -H "X-API-Key: sua-chave"
```

---

### \[GET\] /chat/{sessionId}/{jid}

**Histórico de mensagens**

Busca até 100 mensagens de uma conversa (com dados dos participantes, em grupos)

#### Parâmetros

| Nome | Local | Obrigatório | Tipo | Descrição |
| :--- | :--- | :--- | :--- | :--- |
| `sessionId` | caminho | ✅ Sim | string | — |
| `jid` | caminho | ✅ Sim | string | JID codificado para URL |

#### Respostas

| Código | Descrição |
| :--- | :--- |
| `200` | Histórico de mensagens (máx. 100) |

#### Exemplo em cURL

```bash
curl -X GET "http://localhost:3000/api/chat/vendas-01/5511987654321%40s.whatsapp.net" \
  -H "X-API-Key: sua-chave"
```

---

### \[PUT\] /chat/{sessionId}/{jid}/read

**Marcar mensagens como lidas**

Marca mensagens específicas, ou a conversa inteira, como lidas

#### Parâmetros

| Nome | Local | Obrigatório | Tipo | Descrição |
| :--- | :--- | :--- | :--- | :--- |
| `sessionId` | caminho | ✅ Sim | string | Identificador da sessão |
| `jid` | caminho | ✅ Sim | string | JID do WhatsApp codificado para URL |

#### Cabeçalhos

```
X-API-Key: sua-chave
Content-Type: application/json
```

#### Corpo da requisição (`application/json`)

| Campo | Tipo | Obrigatório | Descrição |
| :--- | :--- | :--- | :--- |
| `messageIds` | array de string | Não | Opcional: IDs das mensagens a marcar como lidas. Se omitido, marca a conversa inteira |

**Exemplo:**

```json
{
  "messageIds": [
    "string"
  ]
}
```

#### Respostas

| Código | Descrição |
| :--- | :--- |
| `200` | Mensagens marcadas como lidas |
| `401` | Não autenticado: chave de API ausente ou inválida |
| `403` | Proibido: acesso negado |
| `500` | Falha ao marcar as mensagens como lidas |
| `503` | Sessão desconectada ou ainda não pronta |

**Campos da resposta (`200`):**

| Campo | Tipo | Obrigatório | Descrição |
| :--- | :--- | :--- | :--- |
| `success` | boolean | Não | — |
| `message` | string | Não | — |

**Exemplo de resposta (`200`):**

```json
{
  "success": true,
  "message": "Messages marked as read"
}
```

#### Exemplo em cURL

```bash
curl -X PUT "http://localhost:3000/api/chat/vendas-01/5511987654321%40s.whatsapp.net/read" \
  -H "X-API-Key: sua-chave" \
  -H "Content-Type: application/json" \
  -d '{"messageIds":["string"]}'
```

---

### \[PUT\] /chat/{sessionId}/{jid}/archive

**Arquivar/desarquivar conversa**

Arquiva ou desarquiva uma conversa

#### Parâmetros

| Nome | Local | Obrigatório | Tipo | Descrição |
| :--- | :--- | :--- | :--- | :--- |
| `sessionId` | caminho | ✅ Sim | string | — |
| `jid` | caminho | ✅ Sim | string | JID codificado para URL |

#### Cabeçalhos

```
X-API-Key: sua-chave
Content-Type: application/json
```

#### Corpo da requisição (`application/json`)

| Campo | Tipo | Obrigatório | Descrição |
| :--- | :--- | :--- | :--- |
| `archive` | boolean | ✅ Sim | `true` para arquivar, `false` para desarquivar |

**Exemplo:**

```json
{
  "archive": true
}
```

#### Respostas

| Código | Descrição |
| :--- | :--- |
| `200` | Conversa arquivada/desarquivada |
| `400` | Campos obrigatórios ausentes |
| `401` | Não autenticado: chave de API ausente ou inválida |
| `403` | Proibido: acesso negado |
| `500` | Falha ao arquivar/desarquivar a conversa |
| `503` | Sessão desconectada ou ainda não pronta |

**Campos da resposta (`200`):**

| Campo | Tipo | Obrigatório | Descrição |
| :--- | :--- | :--- | :--- |
| `success` | boolean | Não | — |
| `message` | string | Não | — |

**Exemplo de resposta (`200`):**

```json
{
  "success": true,
  "message": "Chat archived"
}
```

#### Exemplo em cURL

```bash
curl -X PUT "http://localhost:3000/api/chat/vendas-01/5511987654321%40s.whatsapp.net/archive" \
  -H "X-API-Key: sua-chave" \
  -H "Content-Type: application/json" \
  -d '{"archive":true}'
```

---

### \[PUT\] /chat/{sessionId}/{jid}/mute

**Silenciar/reativar conversa**

Silencia a conversa por um tempo opcional (padrão: 8 horas)

#### Parâmetros

| Nome | Local | Obrigatório | Tipo | Descrição |
| :--- | :--- | :--- | :--- | :--- |
| `sessionId` | caminho | ✅ Sim | string | — |
| `jid` | caminho | ✅ Sim | string | JID codificado para URL |

#### Cabeçalhos

```
X-API-Key: sua-chave
Content-Type: application/json
```

#### Corpo da requisição (`application/json`)

| Campo | Tipo | Obrigatório | Descrição |
| :--- | :--- | :--- | :--- |
| `mute` | boolean | ✅ Sim | — |
| `duration` | integer | Não | Duração em segundos (padrão: 8 horas) |

**Exemplo:**

```json
{
  "mute": true,
  "duration": 3600
}
```

#### Respostas

| Código | Descrição |
| :--- | :--- |
| `200` | Conversa silenciada/reativada |
| `400` | Campos obrigatórios ausentes |
| `401` | Não autenticado: chave de API ausente ou inválida |
| `403` | Proibido: acesso negado |
| `500` | Falha ao silenciar/reativar a conversa |
| `503` | Sessão desconectada ou ainda não pronta |

**Campos da resposta (`200`):**

| Campo | Tipo | Obrigatório | Descrição |
| :--- | :--- | :--- | :--- |
| `success` | boolean | Não | — |
| `message` | string | Não | — |

**Exemplo de resposta (`200`):**

```json
{
  "success": true,
  "message": "Chat muted"
}
```

#### Exemplo em cURL

```bash
curl -X PUT "http://localhost:3000/api/chat/vendas-01/5511987654321%40s.whatsapp.net/mute" \
  -H "X-API-Key: sua-chave" \
  -H "Content-Type: application/json" \
  -d '{"mute":true,"duration":3600}'
```

---

### \[PUT\] /chat/{sessionId}/{jid}/pin

**Fixar/desafixar conversa**

Fixa ou desafixa uma conversa

#### Parâmetros

| Nome | Local | Obrigatório | Tipo | Descrição |
| :--- | :--- | :--- | :--- | :--- |
| `sessionId` | caminho | ✅ Sim | string | — |
| `jid` | caminho | ✅ Sim | string | JID codificado para URL |

#### Cabeçalhos

```
X-API-Key: sua-chave
Content-Type: application/json
```

#### Corpo da requisição (`application/json`)

| Campo | Tipo | Obrigatório | Descrição |
| :--- | :--- | :--- | :--- |
| `pin` | boolean | ✅ Sim | — |

**Exemplo:**

```json
{
  "pin": true
}
```

#### Respostas

| Código | Descrição |
| :--- | :--- |
| `200` | Conversa fixada/desafixada |
| `400` | Campos obrigatórios ausentes |
| `401` | Não autenticado: chave de API ausente ou inválida |
| `403` | Proibido: acesso negado |
| `500` | Falha ao fixar/desafixar a conversa |
| `503` | Sessão desconectada ou ainda não pronta |

**Campos da resposta (`200`):**

| Campo | Tipo | Obrigatório | Descrição |
| :--- | :--- | :--- | :--- |
| `success` | boolean | Não | — |
| `message` | string | Não | — |

**Exemplo de resposta (`200`):**

```json
{
  "success": true,
  "message": "Chat pinned"
}
```

#### Exemplo em cURL

```bash
curl -X PUT "http://localhost:3000/api/chat/vendas-01/5511987654321%40s.whatsapp.net/pin" \
  -H "X-API-Key: sua-chave" \
  -H "Content-Type: application/json" \
  -d '{"pin":true}'
```

---

### \[POST\] /chat/{sessionId}/{jid}/presence

**Enviar presença (digitando/gravando)**

Envia um status de presença (digitando, gravando, online etc.) para uma conversa

#### Parâmetros

| Nome | Local | Obrigatório | Tipo | Descrição |
| :--- | :--- | :--- | :--- | :--- |
| `sessionId` | caminho | ✅ Sim | string | — |
| `jid` | caminho | ✅ Sim | string | JID codificado para URL |

#### Cabeçalhos

```
X-API-Key: sua-chave
Content-Type: application/json
```

#### Corpo da requisição (`application/json`)

| Campo | Tipo | Obrigatório | Descrição |
| :--- | :--- | :--- | :--- |
| `presence` | string | ✅ Sim | **Opções:** `composing`, `recording`, `paused`, `available`, `unavailable` |

**Exemplo:**

```json
{
  "presence": "composing"
}
```

#### Respostas

| Código | Descrição |
| :--- | :--- |
| `200` | Presença enviada |
| `400` | Campos obrigatórios ausentes ou presença inválida |
| `401` | Não autenticado: chave de API ausente ou inválida |
| `403` | Proibido: acesso negado |
| `500` | Falha ao enviar a presença |
| `503` | Sessão desconectada ou ainda não pronta |

**Campos da resposta (`200`):**

| Campo | Tipo | Obrigatório | Descrição |
| :--- | :--- | :--- | :--- |
| `success` | boolean | Não | — |
| `message` | string | Não | — |

**Exemplo de resposta (`200`):**

```json
{
  "success": true,
  "message": "Presence 'composing' sent to 5511987654321@s.whatsapp.net"
}
```

#### Exemplo em cURL

```bash
curl -X POST "http://localhost:3000/api/chat/vendas-01/5511987654321%40s.whatsapp.net/presence" \
  -H "X-API-Key: sua-chave" \
  -H "Content-Type: application/json" \
  -d '{"presence":"composing"}'
```

---

### \[POST\] /chat/{sessionId}/{jid}/profile-picture

**Obter a foto de perfil**

Obtém a URL da foto de perfil de um contato ou grupo

#### Parâmetros

| Nome | Local | Obrigatório | Tipo | Descrição |
| :--- | :--- | :--- | :--- | :--- |
| `sessionId` | caminho | ✅ Sim | string | — |
| `jid` | caminho | ✅ Sim | string | JID codificado para URL |

#### Respostas

| Código | Descrição |
| :--- | :--- |
| `200` | URL da foto de perfil |
| `401` | Não autenticado: chave de API ausente ou inválida |
| `403` | Proibido: acesso negado |
| `500` | Falha ao obter a foto de perfil |
| `503` | Sessão desconectada ou ainda não pronta |

**Campos da resposta (`200`):**

| Campo | Tipo | Obrigatório | Descrição |
| :--- | :--- | :--- | :--- |
| `success` | boolean | Não | — |
| `jid` | string | Não | — |
| `profilePicUrl` | string, nullable | Não | — |
| `message` | string | Não | — |

**Exemplo de resposta (`200`):**

```json
{
  "success": true,
  "jid": "5511987654321@s.whatsapp.net",
  "profilePicUrl": "https://pps.whatsapp.net/...",
  "message": "No profile picture found"
}
```

#### Exemplo em cURL

```bash
curl -X POST "http://localhost:3000/api/chat/vendas-01/5511987654321%40s.whatsapp.net/profile-picture" \
  -H "X-API-Key: sua-chave"
```

---

### \[POST\] /chat/{sessionId}/check

**Verificar números no WhatsApp**

Verifica se os números têm WhatsApp (máx. 50 por requisição)

#### Parâmetros

| Nome | Local | Obrigatório | Tipo | Descrição |
| :--- | :--- | :--- | :--- | :--- |
| `sessionId` | caminho | ✅ Sim | string | — |

#### Cabeçalhos

```
X-API-Key: sua-chave
Content-Type: application/json
```

#### Corpo da requisição (`application/json`)

| Campo | Tipo | Obrigatório | Descrição |
| :--- | :--- | :--- | :--- |
| `numbers` | array de string | ✅ Sim | — |

**Exemplo:**

```json
{
  "numbers": [
    "5511987654321",
    "5521912345678"
  ]
}
```

#### Respostas

| Código | Descrição |
| :--- | :--- |
| `200` | Resultado da verificação |
| `400` | Campos obrigatórios ausentes |
| `401` | Não autenticado: chave de API ausente ou inválida |
| `403` | Proibido: acesso negado |
| `500` | Falha ao verificar os números |
| `503` | Sessão desconectada ou ainda não pronta |

**Campos da resposta (`200`):**

| Campo | Tipo | Obrigatório | Descrição |
| :--- | :--- | :--- | :--- |
| `success` | boolean | Não | — |
| `results` | array de object | Não | — |

**Exemplo de resposta (`200`):**

```json
{
  "success": true,
  "results": [
    {
      "number": "string",
      "exists": true,
      "jid": "string",
      "error": "string"
    }
  ]
}
```

#### Exemplo em cURL

```bash
curl -X POST "http://localhost:3000/api/chat/vendas-01/check" \
  -H "X-API-Key: sua-chave" \
  -H "Content-Type: application/json" \
  -d '{"numbers":["5511987654321","5521912345678"]}'
```

---

## 📂 Perfil

### \[GET\] /profile/{sessionId}

**Obter o próprio perfil**

Obtém os dados de perfil da conta do WhatsApp conectada

#### Parâmetros

| Nome | Local | Obrigatório | Tipo | Descrição |
| :--- | :--- | :--- | :--- | :--- |
| `sessionId` | caminho | ✅ Sim | string | — |

#### Respostas

| Código | Descrição |
| :--- | :--- |
| `200` | Dados do perfil |
| `401` | Não autenticado: chave de API ausente ou inválida |
| `403` | Proibido: acesso negado |
| `503` | Sessão desconectada ou ainda não pronta |

**Campos da resposta (`200`):**

| Campo | Tipo | Obrigatório | Descrição |
| :--- | :--- | :--- | :--- |
| `success` | boolean | Não | — |
| `jid` | string | Não | — |
| `status` | object | Não | — |

**Exemplo de resposta (`200`):**

```json
{
  "success": true,
  "jid": "string",
  "status": {
    "text": "Olá do W-AZAP!"
  }
}
```

#### Exemplo em cURL

```bash
curl -X GET "http://localhost:3000/api/profile/vendas-01" \
  -H "X-API-Key: sua-chave"
```

---

### \[PUT\] /profile/{sessionId}/name

**Alterar o nome de exibição**

Altera o nome de exibição no WhatsApp (máx. 25 caracteres)

#### Parâmetros

| Nome | Local | Obrigatório | Tipo | Descrição |
| :--- | :--- | :--- | :--- | :--- |
| `sessionId` | caminho | ✅ Sim | string | — |

#### Cabeçalhos

```
X-API-Key: sua-chave
Content-Type: application/json
```

#### Corpo da requisição (`application/json`)

| Campo | Tipo | Obrigatório | Descrição |
| :--- | :--- | :--- | :--- |
| `name` | string | ✅ Sim | — |

**Exemplo:**

```json
{
  "name": "string"
}
```

#### Respostas

| Código | Descrição |
| :--- | :--- |
| `200` | Nome alterado |
| `401` | Não autenticado: chave de API ausente ou inválida |
| `403` | Proibido: acesso negado |
| `503` | Sessão desconectada ou ainda não pronta |

**Campos da resposta (`200`):**

| Campo | Tipo | Obrigatório | Descrição |
| :--- | :--- | :--- | :--- |
| `status` | boolean | Não | — |
| `message` | string | Não | — |
| `data` | object, nullable | Não | — |

**Exemplo de resposta (`200`):**

```json
{
  "status": true,
  "message": "Operation successful",
  "data": {
    "text": "Olá do W-AZAP!"
  }
}
```

#### Exemplo em cURL

```bash
curl -X PUT "http://localhost:3000/api/profile/vendas-01/name" \
  -H "X-API-Key: sua-chave" \
  -H "Content-Type: application/json" \
  -d '{"name":"string"}'
```

---

### \[PUT\] /profile/{sessionId}/status

**Alterar o recado**

Altera o recado ("sobre") do WhatsApp (máx. 139 caracteres)

#### Parâmetros

| Nome | Local | Obrigatório | Tipo | Descrição |
| :--- | :--- | :--- | :--- | :--- |
| `sessionId` | caminho | ✅ Sim | string | — |

#### Cabeçalhos

```
X-API-Key: sua-chave
Content-Type: application/json
```

#### Corpo da requisição (`application/json`)

| Campo | Tipo | Obrigatório | Descrição |
| :--- | :--- | :--- | :--- |
| `status` | string | ✅ Sim | — |

**Exemplo:**

```json
{
  "status": "string"
}
```

#### Respostas

| Código | Descrição |
| :--- | :--- |
| `200` | Recado alterado |
| `401` | Não autenticado: chave de API ausente ou inválida |
| `403` | Proibido: acesso negado |
| `503` | Sessão desconectada ou ainda não pronta |

**Campos da resposta (`200`):**

| Campo | Tipo | Obrigatório | Descrição |
| :--- | :--- | :--- | :--- |
| `status` | boolean | Não | — |
| `message` | string | Não | — |
| `data` | object, nullable | Não | — |

**Exemplo de resposta (`200`):**

```json
{
  "status": true,
  "message": "Operation successful",
  "data": {
    "text": "Olá do W-AZAP!"
  }
}
```

#### Exemplo em cURL

```bash
curl -X PUT "http://localhost:3000/api/profile/vendas-01/status" \
  -H "X-API-Key: sua-chave" \
  -H "Content-Type: application/json" \
  -d '{"status":"string"}'
```

---

### \[DELETE\] /profile/{sessionId}/picture

**Remover a foto de perfil**

#### Parâmetros

| Nome | Local | Obrigatório | Tipo | Descrição |
| :--- | :--- | :--- | :--- | :--- |
| `sessionId` | caminho | ✅ Sim | string | — |

#### Respostas

| Código | Descrição |
| :--- | :--- |
| `200` | Foto removida |
| `401` | Não autenticado: chave de API ausente ou inválida |
| `403` | Proibido: acesso negado |
| `503` | Sessão desconectada ou ainda não pronta |

**Campos da resposta (`200`):**

| Campo | Tipo | Obrigatório | Descrição |
| :--- | :--- | :--- | :--- |
| `status` | boolean | Não | — |
| `message` | string | Não | — |
| `data` | object, nullable | Não | — |

**Exemplo de resposta (`200`):**

```json
{
  "status": true,
  "message": "Operation successful",
  "data": {
    "text": "Olá do W-AZAP!"
  }
}
```

#### Exemplo em cURL

```bash
curl -X DELETE "http://localhost:3000/api/profile/vendas-01/picture" \
  -H "X-API-Key: sua-chave"
```

---

### \[PUT\] /profile/{sessionId}/picture

**Alterar a foto de perfil**

Envia uma nova foto de perfil

#### Parâmetros

| Nome | Local | Obrigatório | Tipo | Descrição |
| :--- | :--- | :--- | :--- | :--- |
| `sessionId` | caminho | ✅ Sim | string | — |

#### Cabeçalhos

```
X-API-Key: sua-chave
Content-Type: application/json
```

#### Corpo da requisição (`multipart/form-data`)

| Campo | Tipo | Obrigatório | Descrição |
| :--- | :--- | :--- | :--- |
| `file` | string (binary) | ✅ Sim | — |

**Exemplo:**

```json
{
  "file": "(binary)"
}
```

#### Respostas

| Código | Descrição |
| :--- | :--- |
| `200` | Foto alterada |
| `401` | Não autenticado: chave de API ausente ou inválida |
| `403` | Proibido: acesso negado |
| `503` | Sessão desconectada ou ainda não pronta |

**Campos da resposta (`200`):**

| Campo | Tipo | Obrigatório | Descrição |
| :--- | :--- | :--- | :--- |
| `status` | boolean | Não | — |
| `message` | string | Não | — |
| `data` | object, nullable | Não | — |

**Exemplo de resposta (`200`):**

```json
{
  "status": true,
  "message": "Operation successful",
  "data": {
    "text": "Olá do W-AZAP!"
  }
}
```

#### Exemplo em cURL

```bash
curl -X PUT "http://localhost:3000/api/profile/vendas-01/picture" \
  -H "X-API-Key: sua-chave" \
  -F "file=@/caminho/para/arquivo.jpg" \
  -F "type=image" \
  -F "caption=Olá"
```

---

## 📂 Respostas automáticas

### \[DELETE\] /autoreplies/{sessionId}

**Excluir todas as respostas automáticas**

#### Parâmetros

| Nome | Local | Obrigatório | Tipo | Descrição |
| :--- | :--- | :--- | :--- | :--- |
| `sessionId` | caminho | ✅ Sim | string | — |

#### Respostas

| Código | Descrição |
| :--- | :--- |
| `200` | Respostas automáticas excluídas |

#### Exemplo em cURL

```bash
curl -X DELETE "http://localhost:3000/api/autoreplies/vendas-01" \
  -H "X-API-Key: sua-chave"
```

---

### \[GET\] /autoreplies/{sessionId}

**Listar respostas automáticas**

#### Parâmetros

| Nome | Local | Obrigatório | Tipo | Descrição |
| :--- | :--- | :--- | :--- | :--- |
| `sessionId` | caminho | ✅ Sim | string | — |

#### Respostas

| Código | Descrição |
| :--- | :--- |
| `200` | Lista de regras de resposta automática |
| `401` | Não autenticado: chave de API ausente ou inválida |
| `403` | Proibido: acesso negado |
| `404` | Sessão não encontrada |

#### Exemplo em cURL

```bash
curl -X GET "http://localhost:3000/api/autoreplies/vendas-01" \
  -H "X-API-Key: sua-chave"
```

---

### \[POST\] /autoreplies/{sessionId}

**Criar resposta automática**

#### Parâmetros

| Nome | Local | Obrigatório | Tipo | Descrição |
| :--- | :--- | :--- | :--- | :--- |
| `sessionId` | caminho | ✅ Sim | string | — |

#### Cabeçalhos

```
X-API-Key: sua-chave
Content-Type: application/json
```

#### Corpo da requisição (`application/json`)

| Campo | Tipo | Obrigatório | Descrição |
| :--- | :--- | :--- | :--- |
| `keyword` | string | ✅ Sim | — |
| `response` | string | Não | — |
| `matchType` | string | Não | **Opções:** `EXACT`, `CONTAINS`, `STARTS_WITH`, `REGEX` |
| `isMedia` | boolean | Não | — |
| `mediaUrl` | string | Não | — |
| `mediaType` | string | Não | **Opções:** `image`, `video`, `document`, `audio` |
| `triggerType` | string | Não | **Opções:** `ALL`, `GROUP`, `PRIVATE` |

**Exemplo:**

```json
{
  "keyword": "hello",
  "response": "Hi there! How can I help?",
  "matchType": "EXACT",
  "triggerType": "ALL",
  "isMedia": false,
  "mediaUrl": null,
  "mediaType": null
}
```

#### Respostas

| Código | Descrição |
| :--- | :--- |
| `200` | Regra criada |
| `400` | Campos obrigatórios ausentes |
| `401` | Não autenticado: chave de API ausente ou inválida |
| `403` | Proibido: acesso negado |

#### Exemplo em cURL

```bash
curl -X POST "http://localhost:3000/api/autoreplies/vendas-01" \
  -H "X-API-Key: sua-chave" \
  -H "Content-Type: application/json" \
  -d '{"keyword":"hello","response":"Hi there! How can I help?","matchType":"EXACT","triggerType":"ALL","isMedia":false,"mediaUrl":null,"mediaType":null}'
```

---

### \[DELETE\] /autoreplies/{sessionId}/{replyId}

**Excluir resposta automática**

#### Parâmetros

| Nome | Local | Obrigatório | Tipo | Descrição |
| :--- | :--- | :--- | :--- | :--- |
| `sessionId` | caminho | ✅ Sim | string | — |
| `replyId` | caminho | ✅ Sim | string | — |

#### Respostas

| Código | Descrição |
| :--- | :--- |
| `200` | Regra excluída |
| `401` | Não autenticado: chave de API ausente ou inválida |
| `403` | Proibido: acesso negado |
| `404` | Regra não encontrada |

#### Exemplo em cURL

```bash
curl -X DELETE "http://localhost:3000/api/autoreplies/vendas-01/reply_01" \
  -H "X-API-Key: sua-chave"
```

---

### \[PUT\] /autoreplies/{sessionId}/{replyId}

**Atualizar resposta automática**

#### Parâmetros

| Nome | Local | Obrigatório | Tipo | Descrição |
| :--- | :--- | :--- | :--- | :--- |
| `sessionId` | caminho | ✅ Sim | string | — |
| `replyId` | caminho | ✅ Sim | string | — |

#### Cabeçalhos

```
X-API-Key: sua-chave
Content-Type: application/json
```

#### Corpo da requisição (`application/json`)

| Campo | Tipo | Obrigatório | Descrição |
| :--- | :--- | :--- | :--- |
| `keyword` | string | ✅ Sim | — |
| `response` | string | Não | — |
| `isMedia` | boolean | Não | — |
| `mediaUrl` | string | Não | — |
| `mediaType` | string | Não | **Opções:** `image`, `video`, `document`, `audio` |
| `triggerType` | string | Não | **Opções:** `ALL`, `GROUP`, `PRIVATE` |

**Exemplo:**

```json
{
  "keyword": "hello",
  "response": "Hi there! How can I help?",
  "matchType": "EXACT",
  "triggerType": "ALL",
  "isMedia": false,
  "mediaUrl": null,
  "mediaType": null
}
```

#### Respostas

| Código | Descrição |
| :--- | :--- |
| `200` | Regra atualizada |
| `401` | Não autenticado: chave de API ausente ou inválida |
| `403` | Proibido: acesso negado |
| `404` | Regra não encontrada |

#### Exemplo em cURL

```bash
curl -X PUT "http://localhost:3000/api/autoreplies/vendas-01/reply_01" \
  -H "X-API-Key: sua-chave" \
  -H "Content-Type: application/json" \
  -d '{"keyword":"hello","response":"Hi there! How can I help?","matchType":"EXACT","triggerType":"ALL","isMedia":false,"mediaUrl":null,"mediaType":null}'
```

---

## 📂 Agendador

### \[DELETE\] /scheduler/{sessionId}

**Excluir todos os agendamentos da sessão**

#### Parâmetros

| Nome | Local | Obrigatório | Tipo | Descrição |
| :--- | :--- | :--- | :--- | :--- |
| `sessionId` | caminho | ✅ Sim | string | — |

#### Respostas

| Código | Descrição |
| :--- | :--- |
| `200` | Agendamentos excluídos |

#### Exemplo em cURL

```bash
curl -X DELETE "http://localhost:3000/api/scheduler/vendas-01" \
  -H "X-API-Key: sua-chave"
```

---

### \[GET\] /scheduler/{sessionId}

**Listar agendamentos**

#### Parâmetros

| Nome | Local | Obrigatório | Tipo | Descrição |
| :--- | :--- | :--- | :--- | :--- |
| `sessionId` | caminho | ✅ Sim | string | — |

#### Respostas

| Código | Descrição |
| :--- | :--- |
| `200` | Lista de mensagens agendadas |
| `401` | Não autenticado: chave de API ausente ou inválida |
| `403` | Proibido: acesso negado |
| `404` | Sessão não encontrada |

#### Exemplo em cURL

```bash
curl -X GET "http://localhost:3000/api/scheduler/vendas-01" \
  -H "X-API-Key: sua-chave"
```

---

### \[POST\] /scheduler/{sessionId}

**Criar agendamento**

#### Parâmetros

| Nome | Local | Obrigatório | Tipo | Descrição |
| :--- | :--- | :--- | :--- | :--- |
| `sessionId` | caminho | ✅ Sim | string | — |

#### Cabeçalhos

```
X-API-Key: sua-chave
Content-Type: application/json
```

#### Corpo da requisição (`application/json`)

| Campo | Tipo | Obrigatório | Descrição |
| :--- | :--- | :--- | :--- |
| `jid` | string | ✅ Sim | — |
| `content` | string | Não | — |
| `sendAt` | string (date-time) | ✅ Sim | — |
| `mediaUrl` | string | Não | — |
| `mediaType` | string | Não | **Opções:** `image`, `video`, `document`, `audio` |
| `cronExpression` | string | Não | — |
| `recurrenceRule` | string | Não | — |

**Exemplo:**

```json
{
  "jid": "5511987654321@s.whatsapp.net",
  "content": "Reminder: Meeting in 10 mins",
  "sendAt": "2024-12-25T10:00:00.000Z",
  "mediaUrl": "https://example.com/image.jpg",
  "mediaType": "image",
  "cronExpression": "*/10 * * * *",
  "recurrenceRule": "{\"type\":\"minutes\",\"value\":10}"
}
```

#### Respostas

| Código | Descrição |
| :--- | :--- |
| `200` | Agendamento criado |
| `400` | Campos obrigatórios ausentes |
| `401` | Não autenticado: chave de API ausente ou inválida |
| `403` | Proibido: acesso negado |

#### Exemplo em cURL

```bash
curl -X POST "http://localhost:3000/api/scheduler/vendas-01" \
  -H "X-API-Key: sua-chave" \
  -H "Content-Type: application/json" \
  -d '{"jid":"5511987654321@s.whatsapp.net","content":"Reminder: Meeting in 10 mins","sendAt":"2024-12-25T10:00:00.000Z","mediaUrl":"https://example.com/image.jpg","mediaType":"image","cronExpression":"*/10 * * * *","recurrenceRule":"{\"type\":\"minutes\",\"value\":10}"}'
```

---

### \[DELETE\] /scheduler/{sessionId}/{scheduleId}

**Excluir agendamento**

#### Parâmetros

| Nome | Local | Obrigatório | Tipo | Descrição |
| :--- | :--- | :--- | :--- | :--- |
| `sessionId` | caminho | ✅ Sim | string | — |
| `scheduleId` | caminho | ✅ Sim | string | — |

#### Respostas

| Código | Descrição |
| :--- | :--- |
| `200` | Mensagem apagada |
| `401` | Não autenticado: chave de API ausente ou inválida |
| `403` | Proibido: acesso negado |
| `404` | Mensagem não encontrada |

#### Exemplo em cURL

```bash
curl -X DELETE "http://localhost:3000/api/scheduler/vendas-01/sched_01" \
  -H "X-API-Key: sua-chave"
```

---

### \[PUT\] /scheduler/{sessionId}/{scheduleId}

**Atualizar agendamento**

#### Parâmetros

| Nome | Local | Obrigatório | Tipo | Descrição |
| :--- | :--- | :--- | :--- | :--- |
| `sessionId` | caminho | ✅ Sim | string | — |
| `scheduleId` | caminho | ✅ Sim | string | — |

#### Cabeçalhos

```
X-API-Key: sua-chave
Content-Type: application/json
```

#### Corpo da requisição (`application/json`)

| Campo | Tipo | Obrigatório | Descrição |
| :--- | :--- | :--- | :--- |
| `jid` | string | ✅ Sim | — |
| `content` | string | Não | — |
| `sendAt` | string (date-time) | ✅ Sim | — |
| `mediaUrl` | string | Não | — |
| `mediaType` | string | Não | **Opções:** `image`, `video`, `document`, `audio` |
| `cronExpression` | string | Não | — |
| `recurrenceRule` | string | Não | — |

**Exemplo:**

```json
{
  "jid": "5511987654321@s.whatsapp.net",
  "content": "Updated meeting reminder",
  "sendAt": "2024-12-25T11:00:00.000Z",
  "mediaUrl": "https://example.com/image.jpg",
  "mediaType": "image",
  "cronExpression": null,
  "recurrenceRule": null
}
```

#### Respostas

| Código | Descrição |
| :--- | :--- |
| `200` | Mensagem atualizada |
| `401` | Não autenticado: chave de API ausente ou inválida |
| `403` | Proibido: acesso negado |
| `404` | Mensagem não encontrada |

#### Exemplo em cURL

```bash
curl -X PUT "http://localhost:3000/api/scheduler/vendas-01/sched_01" \
  -H "X-API-Key: sua-chave" \
  -H "Content-Type: application/json" \
  -d '{"jid":"5511987654321@s.whatsapp.net","content":"Updated meeting reminder","sendAt":"2024-12-25T11:00:00.000Z","mediaUrl":"https://example.com/image.jpg","mediaType":"image","cronExpression":null,"recurrenceRule":null}'
```

---

## 📂 Webhooks

### \[GET\] /webhooks/{sessionId}

**Listar webhooks da sessão**

#### Parâmetros

| Nome | Local | Obrigatório | Tipo | Descrição |
| :--- | :--- | :--- | :--- | :--- |
| `sessionId` | caminho | ✅ Sim | string | — |

#### Respostas

| Código | Descrição |
| :--- | :--- |
| `200` | Lista de webhooks |
| `401` | Não autenticado: chave de API ausente ou inválida |
| `403` | Proibido: acesso negado |

#### Exemplo em cURL

```bash
curl -X GET "http://localhost:3000/api/webhooks/vendas-01" \
  -H "X-API-Key: sua-chave"
```

---

### \[POST\] /webhooks/{sessionId}

**Criar webhook**

#### Parâmetros

| Nome | Local | Obrigatório | Tipo | Descrição |
| :--- | :--- | :--- | :--- | :--- |
| `sessionId` | caminho | ✅ Sim | string | — |

#### Cabeçalhos

```
X-API-Key: sua-chave
Content-Type: application/json
```

#### Corpo da requisição (`application/json`)

| Campo | Tipo | Obrigatório | Descrição |
| :--- | :--- | :--- | :--- |
| `name` | string | ✅ Sim | — |
| `url` | string | ✅ Sim | — |
| `secret` | string | Não | — |
| `events` | array de string | ✅ Sim | — |

**Exemplo:**

```json
{
  "name": "string",
  "url": "string",
  "secret": "string",
  "events": [
    "string"
  ]
}
```

#### Respostas

| Código | Descrição |
| :--- | :--- |
| `200` | Webhook criado |
| `400` | Dados inválidos |
| `401` | Não autenticado: chave de API ausente ou inválida |
| `403` | Proibido: acesso negado |

#### Exemplo em cURL

```bash
curl -X POST "http://localhost:3000/api/webhooks/vendas-01" \
  -H "X-API-Key: sua-chave" \
  -H "Content-Type: application/json" \
  -d '{"name":"string","url":"string","secret":"string","events":["string"]}'
```

---

### \[DELETE\] /webhooks/{sessionId}/{id}

**Excluir webhook**

#### Parâmetros

| Nome | Local | Obrigatório | Tipo | Descrição |
| :--- | :--- | :--- | :--- | :--- |
| `sessionId` | caminho | ✅ Sim | string | — |
| `id` | caminho | ✅ Sim | string | — |

#### Respostas

| Código | Descrição |
| :--- | :--- |
| `200` | Webhook excluído |
| `401` | Não autenticado: chave de API ausente ou inválida |
| `403` | Proibido: acesso negado |
| `404` | Webhook não encontrado |

#### Exemplo em cURL

```bash
curl -X DELETE "http://localhost:3000/api/webhooks/vendas-01/abc123" \
  -H "X-API-Key: sua-chave"
```

---

### \[PUT\] /webhooks/{sessionId}/{id}

**Atualizar webhook**

#### Parâmetros

| Nome | Local | Obrigatório | Tipo | Descrição |
| :--- | :--- | :--- | :--- | :--- |
| `sessionId` | caminho | ✅ Sim | string | — |
| `id` | caminho | ✅ Sim | string | — |

#### Cabeçalhos

```
X-API-Key: sua-chave
Content-Type: application/json
```

#### Corpo da requisição (`application/json`)

| Campo | Tipo | Obrigatório | Descrição |
| :--- | :--- | :--- | :--- |
| `name` | string | Não | — |
| `url` | string | Não | — |
| `secret` | string | Não | — |
| `events` | array de string | Não | — |
| `isActive` | boolean | Não | — |

**Exemplo:**

```json
{
  "name": "string",
  "url": "string",
  "secret": "string",
  "events": [
    "string"
  ],
  "isActive": true
}
```

#### Respostas

| Código | Descrição |
| :--- | :--- |
| `200` | Webhook atualizado |
| `401` | Não autenticado: chave de API ausente ou inválida |
| `403` | Proibido: acesso negado |
| `404` | Webhook não encontrado |

#### Exemplo em cURL

```bash
curl -X PUT "http://localhost:3000/api/webhooks/vendas-01/abc123" \
  -H "X-API-Key: sua-chave" \
  -H "Content-Type: application/json" \
  -d '{"name":"string","url":"string","secret":"string","events":["string"],"isActive":true}'
```

---

### \[DELETE\] /webhooks/{id}

**Excluir webhook**

#### Parâmetros

| Nome | Local | Obrigatório | Tipo | Descrição |
| :--- | :--- | :--- | :--- | :--- |
| `id` | caminho | ✅ Sim | string | — |

#### Respostas

| Código | Descrição |
| :--- | :--- |
| `200` | Webhook excluído |
| `401` | Não autenticado: chave de API ausente ou inválida |
| `404` | Webhook não encontrado |
| `500` | Erro interno do servidor |

**Campos da resposta (`200`):**

| Campo | Tipo | Obrigatório | Descrição |
| :--- | :--- | :--- | :--- |
| `success` | boolean | Não | — |

**Exemplo de resposta (`200`):**

```json
{
  "success": true
}
```

#### Exemplo em cURL

```bash
curl -X DELETE "http://localhost:3000/api/webhooks/abc123" \
  -H "X-API-Key: sua-chave"
```

---

### \[POST\] /webhooks/{sessionId}/{id}/test

**Testar webhook**

Envia um evento de teste para conferir se a URL do webhook está acessível e respondendo corretamente

#### Parâmetros

| Nome | Local | Obrigatório | Tipo | Descrição |
| :--- | :--- | :--- | :--- | :--- |
| `sessionId` | caminho | ✅ Sim | string | — |
| `id` | caminho | ✅ Sim | string | — |

#### Respostas

| Código | Descrição |
| :--- | :--- |
| `200` | Resultado do teste |
| `401` | Não autenticado: chave de API ausente ou inválida |
| `403` | Proibido: acesso negado |
| `404` | Webhook não encontrado |

**Campos da resposta (`200`):**

| Campo | Tipo | Obrigatório | Descrição |
| :--- | :--- | :--- | :--- |
| `status` | boolean | Não | — |
| `message` | string | Não | — |
| `data` | object | Não | — |

**Exemplo de resposta (`200`):**

```json
{
  "status": true,
  "message": "string",
  "data": {
    "success": true,
    "statusCode": 0,
    "responseBody": "string",
    "responseTimeMs": 0,
    "error": "string"
  }
}
```

#### Exemplo em cURL

```bash
curl -X POST "http://localhost:3000/api/webhooks/vendas-01/abc123/test" \
  -H "X-API-Key: sua-chave"
```

---

### \[GET\] /webhooks/{sessionId}/{id}/logs

**Logs de entrega do webhook**

Histórico de entregas de um webhook (até 500 registros, mantidos por 30 dias)

#### Parâmetros

| Nome | Local | Obrigatório | Tipo | Descrição |
| :--- | :--- | :--- | :--- | :--- |
| `sessionId` | caminho | ✅ Sim | string | — |
| `id` | caminho | ✅ Sim | string | — |
| `limit` | query | Não | integer | **Padrão:** `50` |
| `offset` | query | Não | integer | **Padrão:** `0` |

#### Respostas

| Código | Descrição |
| :--- | :--- |
| `200` | Logs de entrega do webhook |
| `401` | Não autenticado: chave de API ausente ou inválida |
| `403` | Proibido: acesso negado |
| `404` | Webhook não encontrado |

**Campos da resposta (`200`):**

| Campo | Tipo | Obrigatório | Descrição |
| :--- | :--- | :--- | :--- |
| `status` | boolean | Não | — |
| `data` | array de object | Não | — |
| `total` | integer | Não | — |
| `limit` | integer | Não | — |
| `offset` | integer | Não | — |

**Exemplo de resposta (`200`):**

```json
{
  "status": true,
  "data": [
    {
      "id": "string",
      "webhookId": "string",
      "event": "string",
      "status": "SUCCESS",
      "requestUrl": "string",
      "requestHeaders": {
        "text": "Olá do W-AZAP!"
      },
      "requestBody": {
        "text": "Olá do W-AZAP!"
      },
      "responseStatusCode": 0,
      "responseBody": "string",
      "responseTimeMs": 0,
      "errorMessage": "string",
      "createdAt": "2026-01-15T08:00:00.000Z"
    }
  ],
  "total": 0,
  "limit": 0,
  "offset": 0
}
```

#### Exemplo em cURL

```bash
curl -X GET "http://localhost:3000/api/webhooks/vendas-01/abc123/logs?limit=value&offset=value" \
  -H "X-API-Key: sua-chave"
```

---

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

## 📂 Usuários

### \[POST\] /users

**Criar usuário (somente SUPERADMIN)**

#### Cabeçalhos

```
X-API-Key: sua-chave
Content-Type: application/json
```

#### Corpo da requisição (`application/json`)

| Campo | Tipo | Obrigatório | Descrição |
| :--- | :--- | :--- | :--- |
| `name` | string | ✅ Sim | — |
| `email` | string (email) | ✅ Sim | — |
| `password` | string | ✅ Sim | — |
| `role` | string | Não | **Opções:** `SUPERADMIN`, `OWNER`, `STAFF` **Padrão:** `OWNER` |

**Exemplo:**

```json
{
  "name": "string",
  "email": "string",
  "password": "string",
  "role": "SUPERADMIN"
}
```

#### Respostas

| Código | Descrição |
| :--- | :--- |
| `200` | Usuário criado |
| `400` | Requisição inválida: parâmetros incorretos |
| `401` | Não autenticado: chave de API ausente ou inválida |
| `403` | Proibido: acesso negado |
| `500` | Erro interno do servidor |

**Campos da resposta (`200`):**

| Campo | Tipo | Obrigatório | Descrição |
| :--- | :--- | :--- | :--- |
| `id` | string | Não | — |
| `name` | string | Não | — |
| `email` | string | Não | — |
| `role` | string | Não | — |
| `createdAt` | string (date-time) | Não | — |

**Exemplo de resposta (`200`):**

```json
{
  "id": "string",
  "name": "string",
  "email": "string",
  "role": "string",
  "createdAt": "2026-01-15T08:00:00.000Z"
}
```

#### Exemplo em cURL

```bash
curl -X POST "http://localhost:3000/api/users" \
  -H "X-API-Key: sua-chave" \
  -H "Content-Type: application/json" \
  -d '{"name":"string","email":"string","password":"string","role":"SUPERADMIN"}'
```

---

### \[GET\] /users

**Listar usuários (somente SUPERADMIN)**

#### Respostas

| Código | Descrição |
| :--- | :--- |
| `200` | Lista de usuários |
| `401` | Não autenticado: chave de API ausente ou inválida |
| `403` | Proibido: acesso negado |
| `500` | Erro interno do servidor |

**Exemplo de resposta (`200`):**

```json
[
  {
    "id": "string",
    "name": "string",
    "email": "string",
    "role": "string",
    "createdAt": "2026-01-15T08:00:00.000Z",
    "_count": {
      "sessions": 0
    }
  }
]
```

#### Exemplo em cURL

```bash
curl -X GET "http://localhost:3000/api/users" \
  -H "X-API-Key: sua-chave"
```

---

### \[DELETE\] /users/{id}

**Excluir usuário (somente SUPERADMIN)**

#### Parâmetros

| Nome | Local | Obrigatório | Tipo | Descrição |
| :--- | :--- | :--- | :--- | :--- |
| `id` | caminho | ✅ Sim | string | — |

#### Respostas

| Código | Descrição |
| :--- | :--- |
| `200` | Usuário excluído |
| `401` | Não autenticado: chave de API ausente ou inválida |
| `403` | Proibido: acesso negado |
| `404` | Usuário não encontrado |
| `500` | Erro interno do servidor |

**Campos da resposta (`200`):**

| Campo | Tipo | Obrigatório | Descrição |
| :--- | :--- | :--- | :--- |
| `success` | boolean | Não | — |
| `message` | string | Não | — |

**Exemplo de resposta (`200`):**

```json
{
  "success": true,
  "message": "string"
}
```

#### Exemplo em cURL

```bash
curl -X DELETE "http://localhost:3000/api/users/abc123" \
  -H "X-API-Key: sua-chave"
```

---

### \[PATCH\] /users/{id}

**Atualizar usuário (somente SUPERADMIN)**

#### Parâmetros

| Nome | Local | Obrigatório | Tipo | Descrição |
| :--- | :--- | :--- | :--- | :--- |
| `id` | caminho | ✅ Sim | string | — |

#### Cabeçalhos

```
X-API-Key: sua-chave
Content-Type: application/json
```

#### Corpo da requisição (`application/json`)

| Campo | Tipo | Obrigatório | Descrição |
| :--- | :--- | :--- | :--- |
| `name` | string | Não | — |
| `email` | string | Não | — |
| `password` | string | Não | — |
| `role` | string | Não | **Opções:** `SUPERADMIN`, `OWNER`, `STAFF` |

**Exemplo:**

```json
{
  "name": "string",
  "email": "string",
  "password": "string",
  "role": "SUPERADMIN"
}
```

#### Respostas

| Código | Descrição |
| :--- | :--- |
| `200` | Usuário atualizado |
| `400` | Requisição inválida: parâmetros incorretos |
| `401` | Não autenticado: chave de API ausente ou inválida |
| `403` | Proibido: acesso negado |
| `404` | Usuário não encontrado |
| `500` | Erro interno do servidor |

**Campos da resposta (`200`):**

| Campo | Tipo | Obrigatório | Descrição |
| :--- | :--- | :--- | :--- |
| `success` | boolean | Não | — |
| `user` | object | Não | — |

**Exemplo de resposta (`200`):**

```json
{
  "success": true,
  "user": {
    "id": "string",
    "email": "string",
    "name": "string",
    "role": "string",
    "emailVerified": "string",
    "image": "string",
    "createdAt": "2026-01-15T08:00:00.000Z",
    "updatedAt": "2026-01-15T08:00:00.000Z"
  }
}
```

#### Exemplo em cURL

```bash
curl -X PATCH "http://localhost:3000/api/users/abc123" \
  -H "X-API-Key: sua-chave" \
  -H "Content-Type: application/json" \
  -d '{"name":"string","email":"string","password":"string","role":"SUPERADMIN"}'
```

---

### \[POST\] /user/api-key

**Gerar nova chave de API**

#### Respostas

| Código | Descrição |
| :--- | :--- |
| `200` | Nova chave de API gerada. Ela aparece só nesta resposta: guarde-a agora. |
| `401` | Não autenticado: chave de API ausente ou inválida |
| `500` | Falha ao gerar a chave de API |

**Campos da resposta (`200`):**

| Campo | Tipo | Obrigatório | Descrição |
| :--- | :--- | :--- | :--- |
| `apiKey` | string | Não | — |

**Exemplo de resposta (`200`):**

```json
{
  "apiKey": "string"
}
```

#### Exemplo em cURL

```bash
curl -X POST "http://localhost:3000/api/user/api-key" \
  -H "X-API-Key: sua-chave"
```

---

### \[DELETE\] /user/api-key

**Revogar a chave de API**

#### Respostas

| Código | Descrição |
| :--- | :--- |
| `200` | Chave de API revogada |
| `401` | Não autenticado: chave de API ausente ou inválida |
| `500` | Falha ao revogar a chave de API |

**Campos da resposta (`200`):**

| Campo | Tipo | Obrigatório | Descrição |
| :--- | :--- | :--- | :--- |
| `status` | boolean | Não | — |
| `message` | string | Não | — |
| `data` | object, nullable | Não | — |

**Exemplo de resposta (`200`):**

```json
{
  "status": true,
  "message": "Operation successful",
  "data": {
    "text": "Olá do W-AZAP!"
  }
}
```

#### Exemplo em cURL

```bash
curl -X DELETE "http://localhost:3000/api/user/api-key" \
  -H "X-API-Key: sua-chave"
```

---

### \[GET\] /user/api-key

**Status da chave de API**

#### Respostas

| Código | Descrição |
| :--- | :--- |
| `200` | Indica se existe uma chave (`hasKey`) e mostra só o início dela (`hint`). A chave completa não pode ser consultada depois de gerada. |
| `401` | Não autenticado: chave de API ausente ou inválida |

**Campos da resposta (`200`):**

| Campo | Tipo | Obrigatório | Descrição |
| :--- | :--- | :--- | :--- |
| `apiKey` | string, nullable | Não | — |

**Exemplo de resposta (`200`):**

```json
{
  "apiKey": "string"
}
```

#### Exemplo em cURL

```bash
curl -X GET "http://localhost:3000/api/user/api-key" \
  -H "X-API-Key: sua-chave"
```

---

## 📂 Etiquetas

### \[POST\] /labels/{sessionId}

**Criar etiqueta**

Cria uma etiqueta com cor (índice de 0 a 19)

#### Parâmetros

| Nome | Local | Obrigatório | Tipo | Descrição |
| :--- | :--- | :--- | :--- | :--- |
| `sessionId` | caminho | ✅ Sim | string | — |

#### Cabeçalhos

```
X-API-Key: sua-chave
Content-Type: application/json
```

#### Corpo da requisição (`application/json`)

| Campo | Tipo | Obrigatório | Descrição |
| :--- | :--- | :--- | :--- |
| `name` | string | ✅ Sim | — |
| `color` | integer | Não | Índice da cor (0 a 19) |

**Exemplo:**

```json
{
  "name": "Important",
  "color": 0
}
```

#### Respostas

| Código | Descrição |
| :--- | :--- |
| `200` | Etiqueta criada |
| `401` | Não autenticado: chave de API ausente ou inválida |
| `403` | Proibido: acesso negado |
| `500` | Falha ao criar a etiqueta |

**Campos da resposta (`200`):**

| Campo | Tipo | Obrigatório | Descrição |
| :--- | :--- | :--- | :--- |
| `success` | boolean | Não | — |
| `label` | object | Não | — |

**Exemplo de resposta (`200`):**

```json
{
  "success": true,
  "label": {
    "id": "string",
    "name": "string",
    "color": 0,
    "predefinedId": "string"
  }
}
```

#### Exemplo em cURL

```bash
curl -X POST "http://localhost:3000/api/labels/vendas-01" \
  -H "X-API-Key: sua-chave" \
  -H "Content-Type: application/json" \
  -d '{"name":"Important","color":0}'
```

---

### \[PUT\] /labels/{sessionId}

**Atualizar etiquetas em lote**

#### Parâmetros

| Nome | Local | Obrigatório | Tipo | Descrição |
| :--- | :--- | :--- | :--- | :--- |
| `sessionId` | caminho | ✅ Sim | string | — |

#### Respostas

| Código | Descrição |
| :--- | :--- |
| `200` | Etiquetas atualizadas |

#### Exemplo em cURL

```bash
curl -X PUT "http://localhost:3000/api/labels/vendas-01" \
  -H "X-API-Key: sua-chave"
```

---

### \[DELETE\] /labels/{sessionId}

**Excluir etiquetas**

#### Parâmetros

| Nome | Local | Obrigatório | Tipo | Descrição |
| :--- | :--- | :--- | :--- | :--- |
| `sessionId` | caminho | ✅ Sim | string | — |

#### Respostas

| Código | Descrição |
| :--- | :--- |
| `200` | Etiquetas excluídas |

#### Exemplo em cURL

```bash
curl -X DELETE "http://localhost:3000/api/labels/vendas-01" \
  -H "X-API-Key: sua-chave"
```

---

### \[GET\] /labels/{sessionId}

**Listar etiquetas**

Lista todas as etiquetas com a quantidade de conversas de cada uma

#### Parâmetros

| Nome | Local | Obrigatório | Tipo | Descrição |
| :--- | :--- | :--- | :--- | :--- |
| `sessionId` | caminho | ✅ Sim | string | — |

#### Respostas

| Código | Descrição |
| :--- | :--- |
| `200` | Lista de etiquetas |
| `401` | Não autenticado: chave de API ausente ou inválida |
| `403` | Proibido: acesso negado |
| `404` | Sessão não encontrada |

**Campos da resposta (`200`):**

| Campo | Tipo | Obrigatório | Descrição |
| :--- | :--- | :--- | :--- |
| `success` | boolean | Não | — |
| `labels` | array de object | Não | — |

**Exemplo de resposta (`200`):**

```json
{
  "success": true,
  "labels": [
    {
      "id": "string",
      "name": "string",
      "color": 0,
      "predefinedId": "string"
    }
  ]
}
```

#### Exemplo em cURL

```bash
curl -X GET "http://localhost:3000/api/labels/vendas-01" \
  -H "X-API-Key: sua-chave"
```

---

### \[DELETE\] /labels/{sessionId}/{labelId}

**Excluir etiqueta**

#### Parâmetros

| Nome | Local | Obrigatório | Tipo | Descrição |
| :--- | :--- | :--- | :--- | :--- |
| `sessionId` | caminho | ✅ Sim | string | — |
| `labelId` | caminho | ✅ Sim | string | — |

#### Respostas

| Código | Descrição |
| :--- | :--- |
| `200` | Etiqueta excluída |

**Campos da resposta (`200`):**

| Campo | Tipo | Obrigatório | Descrição |
| :--- | :--- | :--- | :--- |
| `status` | boolean | Não | — |
| `message` | string | Não | — |
| `data` | object, nullable | Não | — |

**Exemplo de resposta (`200`):**

```json
{
  "status": true,
  "message": "Operation successful",
  "data": {
    "text": "Olá do W-AZAP!"
  }
}
```

#### Exemplo em cURL

```bash
curl -X DELETE "http://localhost:3000/api/labels/vendas-01/label_01" \
  -H "X-API-Key: sua-chave"
```

---

### \[PUT\] /labels/{sessionId}/{labelId}

**Atualizar etiqueta**

#### Parâmetros

| Nome | Local | Obrigatório | Tipo | Descrição |
| :--- | :--- | :--- | :--- | :--- |
| `sessionId` | caminho | ✅ Sim | string | — |
| `labelId` | caminho | ✅ Sim | string | — |

#### Cabeçalhos

```
X-API-Key: sua-chave
Content-Type: application/json
```

#### Corpo da requisição (`application/json`)

| Campo | Tipo | Obrigatório | Descrição |
| :--- | :--- | :--- | :--- |
| `name` | string | Não | — |
| `color` | integer | Não | — |

**Exemplo:**

```json
{
  "name": "string",
  "color": 0
}
```

#### Respostas

| Código | Descrição |
| :--- | :--- |
| `200` | Etiqueta atualizada |

**Campos da resposta (`200`):**

| Campo | Tipo | Obrigatório | Descrição |
| :--- | :--- | :--- | :--- |
| `success` | boolean | Não | — |
| `label` | object | Não | — |

**Exemplo de resposta (`200`):**

```json
{
  "success": true,
  "label": {
    "id": "string",
    "name": "string",
    "color": 0,
    "predefinedId": "string"
  }
}
```

#### Exemplo em cURL

```bash
curl -X PUT "http://localhost:3000/api/labels/vendas-01/label_01" \
  -H "X-API-Key: sua-chave" \
  -H "Content-Type: application/json" \
  -d '{"name":"string","color":0}'
```

---

### \[GET\] /labels/{sessionId}/chat/{jid}/labels

**Etiquetas da conversa**

#### Parâmetros

| Nome | Local | Obrigatório | Tipo | Descrição |
| :--- | :--- | :--- | :--- | :--- |
| `sessionId` | caminho | ✅ Sim | string | — |
| `jid` | caminho | ✅ Sim | string | — |

#### Respostas

| Código | Descrição |
| :--- | :--- |
| `200` | Etiquetas da conversa |

**Campos da resposta (`200`):**

| Campo | Tipo | Obrigatório | Descrição |
| :--- | :--- | :--- | :--- |
| `success` | boolean | Não | — |
| `labels` | array de object | Não | — |

**Exemplo de resposta (`200`):**

```json
{
  "success": true,
  "labels": [
    {
      "id": "string",
      "name": "string",
      "color": 0,
      "predefinedId": "string"
    }
  ]
}
```

#### Exemplo em cURL

```bash
curl -X GET "http://localhost:3000/api/labels/vendas-01/chat/5511987654321%40s.whatsapp.net/labels" \
  -H "X-API-Key: sua-chave"
```

---

### \[PUT\] /labels/{sessionId}/chat/{jid}/labels

**Alterar as etiquetas da conversa**

#### Parâmetros

| Nome | Local | Obrigatório | Tipo | Descrição |
| :--- | :--- | :--- | :--- | :--- |
| `sessionId` | caminho | ✅ Sim | string | — |
| `jid` | caminho | ✅ Sim | string | — |

#### Cabeçalhos

```
X-API-Key: sua-chave
Content-Type: application/json
```

#### Corpo da requisição (`application/json`)

| Campo | Tipo | Obrigatório | Descrição |
| :--- | :--- | :--- | :--- |
| `labelIds` | array de string | ✅ Sim | — |
| `action` | string | ✅ Sim | **Opções:** `add`, `remove` |

**Exemplo:**

```json
{
  "labelIds": [
    "string"
  ],
  "action": "add"
}
```

#### Respostas

| Código | Descrição |
| :--- | :--- |
| `200` | Etiquetas da conversa alteradas |

**Campos da resposta (`200`):**

| Campo | Tipo | Obrigatório | Descrição |
| :--- | :--- | :--- | :--- |
| `success` | boolean | Não | — |
| `message` | string | Não | — |
| `labels` | array de object | Não | — |

**Exemplo de resposta (`200`):**

```json
{
  "success": true,
  "message": "string",
  "labels": [
    {
      "id": "string",
      "name": "string",
      "color": 0,
      "predefinedId": "string"
    }
  ]
}
```

#### Exemplo em cURL

```bash
curl -X PUT "http://localhost:3000/api/labels/vendas-01/chat/5511987654321%40s.whatsapp.net/labels" \
  -H "X-API-Key: sua-chave" \
  -H "Content-Type: application/json" \
  -d '{"labelIds":["string"],"action":"add"}'
```

---

### \[GET\] /labels/{sessionId}/chats

**Conversas e etiquetas**

Com `labelId`, devolve as conversas que têm aquela etiqueta (com o nome do contato). Com `jid`, devolve as etiquetas daquela conversa. Sem parâmetros, devolve todas as atribuições da sessão em uma única consulta.

#### Parâmetros

| Nome | Local | Obrigatório | Tipo | Descrição |
| :--- | :--- | :--- | :--- | :--- |
| `sessionId` | caminho | ✅ Sim | string | — |
| `labelId` | query | Não | string | ID da etiqueta |
| `jid` | query | Não | string | JID da conversa |

#### Respostas

| Código | Descrição |
| :--- | :--- |
| `200` | Atribuições de etiquetas |
| `401` | Não autenticado: chave de API ausente ou inválida |
| `403` | Proibido: acesso negado |

#### Exemplo em cURL

```bash
curl -X GET "http://localhost:3000/api/labels/vendas-01/chats?labelId=label_01&jid=5511987654321%40s.whatsapp.net" \
  -H "X-API-Key: sua-chave"
```

---

### \[GET\] /chats/{sessionId}/by-label/{labelId}

**Conversas por etiqueta**

Lista todas as conversas associadas a uma etiqueta

#### Parâmetros

| Nome | Local | Obrigatório | Tipo | Descrição |
| :--- | :--- | :--- | :--- | :--- |
| `sessionId` | caminho | ✅ Sim | string | — |
| `labelId` | caminho | ✅ Sim | string | — |

#### Respostas

| Código | Descrição |
| :--- | :--- |
| `200` | Lista de conversas com a etiqueta |
| `401` | Não autenticado: chave de API ausente ou inválida |
| `403` | Proibido: acesso negado |
| `404` | Etiqueta não encontrada |

**Campos da resposta (`200`):**

| Campo | Tipo | Obrigatório | Descrição |
| :--- | :--- | :--- | :--- |
| `success` | boolean | Não | — |
| `label` | object | Não | — |
| `chats` | array de string | Não | — |
| `count` | integer | Não | — |

**Exemplo de resposta (`200`):**

```json
{
  "success": true,
  "label": {
    "text": "Olá do W-AZAP!"
  },
  "chats": [
    "string"
  ],
  "count": 0
}
```

#### Exemplo em cURL

```bash
curl -X GET "http://localhost:3000/api/chats/vendas-01/by-label/label_01" \
  -H "X-API-Key: sua-chave"
```

---

## 📂 Notificações

### \[POST\] /notifications

**Criar notificação**

Envia uma notificação para um usuário ou para todos (somente SUPERADMIN)

#### Cabeçalhos

```
X-API-Key: sua-chave
Content-Type: application/json
```

#### Corpo da requisição (`application/json`)

| Campo | Tipo | Obrigatório | Descrição |
| :--- | :--- | :--- | :--- |
| `title` | string | ✅ Sim | — |
| `message` | string | ✅ Sim | — |
| `type` | string | Não | **Opções:** `INFO`, `SUCCESS`, `WARNING`, `ERROR` **Padrão:** `INFO` |
| `href` | string | Não | — |
| `targetUserId` | string | Não | ID do usuário de destino |
| `broadcast` | boolean | Não | **Padrão:** `false` |

**Exemplo:**

```json
{
  "title": "Maintenance",
  "message": "System update in 5 minutes",
  "type": "INFO",
  "href": "/settings",
  "targetUserId": "string",
  "broadcast": true
}
```

#### Respostas

| Código | Descrição |
| :--- | :--- |
| `200` | Notificação criada |
| `400` | Requisição inválida |
| `401` | Não autenticado: chave de API ausente ou inválida |
| `403` | Proibido: acesso negado |
| `500` | Erro ao criar a notificação |

**Campos da resposta (`200`):**

| Campo | Tipo | Obrigatório | Descrição |
| :--- | :--- | :--- | :--- |
| `success` | boolean | Não | — |
| `count` | integer | Não | Quantidade de usuários notificados, no envio para todos |

**Exemplo de resposta (`200`):**

```json
{
  "success": true,
  "count": 0
}
```

#### Exemplo em cURL

```bash
curl -X POST "http://localhost:3000/api/notifications" \
  -H "X-API-Key: sua-chave" \
  -H "Content-Type: application/json" \
  -d '{"title":"Maintenance","message":"System update in 5 minutes","type":"INFO","href":"/settings","targetUserId":"string","broadcast":true}'
```

---

### \[GET\] /notifications

**Listar notificações**

Lista as 50 notificações mais recentes do usuário autenticado

#### Respostas

| Código | Descrição |
| :--- | :--- |
| `200` | Lista de notificações |
| `401` | Não autenticado: chave de API ausente ou inválida |
| `500` | Erro ao obter as notificações |

**Exemplo de resposta (`200`):**

```json
[
  {
    "id": "string",
    "userId": "string",
    "title": "string",
    "message": "string",
    "type": "string",
    "href": "string",
    "read": true,
    "createdAt": "2026-01-15T08:00:00.000Z"
  }
]
```

#### Exemplo em cURL

```bash
curl -X GET "http://localhost:3000/api/notifications" \
  -H "X-API-Key: sua-chave"
```

---

### \[PATCH\] /notifications/read

**Marcar notificações como lidas**

Marca notificações específicas, ou todas, como lidas para o usuário autenticado

#### Cabeçalhos

```
X-API-Key: sua-chave
Content-Type: application/json
```

#### Corpo da requisição (`application/json`)

| Campo | Tipo | Obrigatório | Descrição |
| :--- | :--- | :--- | :--- |
| `ids` | array de string | Não | Lista de IDs de notificação. Se omitida ou vazia, todas são marcadas como lidas. |

**Exemplo:**

```json
{
  "ids": [
    "string"
  ]
}
```

#### Respostas

| Código | Descrição |
| :--- | :--- |
| `200` | Notificações atualizadas |
| `401` | Não autenticado: chave de API ausente ou inválida |
| `500` | Erro ao atualizar as notificações |

**Campos da resposta (`200`):**

| Campo | Tipo | Obrigatório | Descrição |
| :--- | :--- | :--- | :--- |
| `status` | boolean | Não | — |
| `message` | string | Não | — |
| `data` | object, nullable | Não | — |

**Exemplo de resposta (`200`):**

```json
{
  "status": true,
  "message": "Operation successful",
  "data": {
    "text": "Olá do W-AZAP!"
  }
}
```

#### Exemplo em cURL

```bash
curl -X PATCH "http://localhost:3000/api/notifications/read" \
  -H "X-API-Key: sua-chave" \
  -H "Content-Type: application/json" \
  -d '{"ids":["string"]}'
```

---

### \[DELETE\] /notifications/delete

**Excluir notificação**

#### Parâmetros

| Nome | Local | Obrigatório | Tipo | Descrição |
| :--- | :--- | :--- | :--- | :--- |
| `id` | query | ✅ Sim | string | ID da notificação |

#### Respostas

| Código | Descrição |
| :--- | :--- |
| `200` | Notificação excluída |
| `400` | O ID da notificação é obrigatório |
| `401` | Não autenticado: chave de API ausente ou inválida |
| `500` | Erro ao excluir a notificação |

**Campos da resposta (`200`):**

| Campo | Tipo | Obrigatório | Descrição |
| :--- | :--- | :--- | :--- |
| `status` | boolean | Não | — |
| `message` | string | Não | — |
| `data` | object, nullable | Não | — |

**Exemplo de resposta (`200`):**

```json
{
  "status": true,
  "message": "Operation successful",
  "data": {
    "text": "Olá do W-AZAP!"
  }
}
```

#### Exemplo em cURL

```bash
curl -X DELETE "http://localhost:3000/api/notifications/delete?id=abc123" \
  -H "X-API-Key: sua-chave"
```

---

## 📂 Sistema

### \[POST\] /settings/system

**Alterar as configurações do sistema**

Altera a configuração global do sistema: nome, logotipo, fuso horário e cadastro público (somente SUPERADMIN)

#### Cabeçalhos

```
X-API-Key: sua-chave
Content-Type: application/json
```

#### Corpo da requisição (`application/json`)

| Campo | Tipo | Obrigatório | Descrição |
| :--- | :--- | :--- | :--- |
| `appName` | string | Não | — |
| `logoUrl` | string | Não | — |
| `timezone` | string | Não | — |

**Exemplo:**

```json
{
  "appName": "string",
  "logoUrl": "string",
  "timezone": "string"
}
```

#### Respostas

| Código | Descrição |
| :--- | :--- |
| `200` | Configurações atualizadas |
| `401` | Não autenticado: chave de API ausente ou inválida |
| `500` | Falha ao alterar as configurações |

**Campos da resposta (`200`):**

| Campo | Tipo | Obrigatório | Descrição |
| :--- | :--- | :--- | :--- |
| `id` | string | Não | — |
| `appName` | string | Não | — |
| `logoUrl` | string | Não | — |
| `timezone` | string | Não | — |
| `updatedAt` | string (date-time) | Não | — |

**Exemplo de resposta (`200`):**

```json
{
  "id": "string",
  "appName": "string",
  "logoUrl": "string",
  "timezone": "string",
  "updatedAt": "2026-01-15T08:00:00.000Z"
}
```

#### Exemplo em cURL

```bash
curl -X POST "http://localhost:3000/api/settings/system" \
  -H "X-API-Key: sua-chave" \
  -H "Content-Type: application/json" \
  -d '{"appName":"string","logoUrl":"string","timezone":"string"}'
```

---

### \[GET\] /settings/system

**Obter as configurações do sistema**

#### Respostas

| Código | Descrição |
| :--- | :--- |
| `200` | Configurações do sistema |

**Campos da resposta (`200`):**

| Campo | Tipo | Obrigatório | Descrição |
| :--- | :--- | :--- | :--- |
| `id` | string | Não | — |
| `appName` | string | Não | — |
| `logoUrl` | string | Não | — |
| `timezone` | string | Não | — |

**Exemplo de resposta (`200`):**

```json
{
  "id": "default",
  "appName": "W-AZAP",
  "logoUrl": "https://example.com/logo.png",
  "timezone": "Asia/Jakarta"
}
```

#### Exemplo em cURL

```bash
curl -X GET "http://localhost:3000/api/settings/system" \
  -H "X-API-Key: sua-chave"
```

---

### \[POST\] /system/check-updates

**Verificar atualizações**

Procura novas versões no GitHub e cria uma notificação se houver uma mais recente. Somente SUPERADMIN; o resultado fica em cache por 1 hora.

#### Respostas

| Código | Descrição |
| :--- | :--- |
| `200` | Resultado da verificação |
| `401` | Não autenticado: chave de API ausente ou inválida |
| `500` | Erro ao verificar atualizações |

**Campos da resposta (`200`):**

| Campo | Tipo | Obrigatório | Descrição |
| :--- | :--- | :--- | :--- |
| `success` | boolean | Não | — |
| `message` | string | Não | — |
| `version` | string | Não | Tag da versão mais recente |

**Exemplo de resposta (`200`):**

```json
{
  "success": true,
  "message": "string",
  "version": "string"
}
```

#### Exemplo em cURL

```bash
curl -X POST "http://localhost:3000/api/system/check-updates" \
  -H "X-API-Key: sua-chave"
```

---

### \[GET\] /system/monitor

**Métricas do servidor**

CPU (total e por núcleo), memória, discos, rede, sistema operacional e processo Node.js. Somente SUPERADMIN.

#### Respostas

| Código | Descrição |
| :--- | :--- |
| `200` | Métricas do sistema |
| `401` | Não autenticado: chave de API ausente ou inválida |
| `403` | Proibido: acesso negado |

#### Exemplo em cURL

```bash
curl -X GET "http://localhost:3000/api/system/monitor" \
  -H "X-API-Key: sua-chave"
```

---

### \[GET\] /system/monitor/{sessionId}

**Métricas da sessão**

Status da conexão, tempo conectado (`uptimeMs`), ping do socket e contagem de contatos, conversas e mensagens da sessão.

#### Parâmetros

| Nome | Local | Obrigatório | Tipo | Descrição |
| :--- | :--- | :--- | :--- | :--- |
| `sessionId` | caminho | ✅ Sim | string | — |

#### Respostas

| Código | Descrição |
| :--- | :--- |
| `200` | Métricas da sessão |
| `401` | Não autenticado: chave de API ausente ou inválida |
| `403` | Proibido: acesso negado |

#### Exemplo em cURL

```bash
curl -X GET "http://localhost:3000/api/system/monitor/vendas-01" \
  -H "X-API-Key: sua-chave"
```

---

## 📂 Contatos

### \[POST\] /contacts/{sessionId}/{jid}/block

**Bloquear contato**

#### Parâmetros

| Nome | Local | Obrigatório | Tipo | Descrição |
| :--- | :--- | :--- | :--- | :--- |
| `sessionId` | caminho | ✅ Sim | string | — |
| `jid` | caminho | ✅ Sim | string | — |

#### Respostas

| Código | Descrição |
| :--- | :--- |
| `200` | Contato bloqueado |
| `401` | Não autenticado: chave de API ausente ou inválida |
| `403` | Proibido: acesso negado |
| `500` | Falha ao bloquear o contato |

**Campos da resposta (`200`):**

| Campo | Tipo | Obrigatório | Descrição |
| :--- | :--- | :--- | :--- |
| `success` | boolean | Não | — |
| `message` | string | Não | — |

**Exemplo de resposta (`200`):**

```json
{
  "success": true,
  "message": "string"
}
```

#### Exemplo em cURL

```bash
curl -X POST "http://localhost:3000/api/contacts/vendas-01/5511987654321%40s.whatsapp.net/block" \
  -H "X-API-Key: sua-chave"
```

---

### \[POST\] /contacts/{sessionId}/{jid}/unblock

**Desbloquear contato**

#### Parâmetros

| Nome | Local | Obrigatório | Tipo | Descrição |
| :--- | :--- | :--- | :--- | :--- |
| `sessionId` | caminho | ✅ Sim | string | — |
| `jid` | caminho | ✅ Sim | string | — |

#### Respostas

| Código | Descrição |
| :--- | :--- |
| `200` | Contato desbloqueado |
| `401` | Não autenticado: chave de API ausente ou inválida |
| `403` | Proibido: acesso negado |
| `500` | Falha ao desbloquear o contato |

**Campos da resposta (`200`):**

| Campo | Tipo | Obrigatório | Descrição |
| :--- | :--- | :--- | :--- |
| `success` | boolean | Não | — |
| `message` | string | Não | — |

**Exemplo de resposta (`200`):**

```json
{
  "success": true,
  "message": "string"
}
```

#### Exemplo em cURL

```bash
curl -X POST "http://localhost:3000/api/contacts/vendas-01/5511987654321%40s.whatsapp.net/unblock" \
  -H "X-API-Key: sua-chave"
```

---

### \[GET\] /contacts/{sessionId}

**Listar contatos**

Lista os contatos sincronizados da sessão, com paginação e busca por nome, número ou JID.

#### Parâmetros

| Nome | Local | Obrigatório | Tipo | Descrição |
| :--- | :--- | :--- | :--- | :--- |
| `sessionId` | caminho | ✅ Sim | string | — |
| `page` | query | Não | integer | Página (começa em 1) **Padrão:** `1` |
| `limit` | query | Não | string | Itens por página, ou `all` para trazer todos **Padrão:** `10` |
| `search` | query | Não | string | Filtra por nome, número ou JID |

#### Respostas

| Código | Descrição |
| :--- | :--- |
| `200` | Lista de contatos |
| `401` | Não autenticado: chave de API ausente ou inválida |
| `403` | Proibido: acesso negado |

**Campos da resposta (`200`):**

| Campo | Tipo | Obrigatório | Descrição |
| :--- | :--- | :--- | :--- |
| `status` | boolean | Não | — |
| `message` | string | Não | — |
| `data` | array de object | Não | — |
| `meta` | object | Não | — |

**Exemplo de resposta (`200`):**

```json
{
  "status": true,
  "message": "Contacts retrieved successfully",
  "data": [
    {
      "jid": "5511987654321@s.whatsapp.net",
      "name": "John Doe",
      "notify": "string",
      "profilePic": "string"
    }
  ],
  "meta": {
    "total": 120,
    "page": 1,
    "limit": 10,
    "totalPages": 12
  }
}
```

#### Exemplo em cURL

```bash
curl -X GET "http://localhost:3000/api/contacts/vendas-01?page=value&limit=value&search=value" \
  -H "X-API-Key: sua-chave"
```

---

## 📦 Schemas (modelos de dados)

### Error

| Campo | Tipo | Obrigatório | Descrição |
| :--- | :--- | :--- | :--- |
| `status` | boolean | Não | — |
| `message` | string | Não | — |
| `error` | string | Não | — |

**Exemplo:**

```json
{
  "status": false,
  "message": "Error occurred",
  "error": "Detailed error info"
}
```

### Success

| Campo | Tipo | Obrigatório | Descrição |
| :--- | :--- | :--- | :--- |
| `status` | boolean | Não | — |
| `message` | string | Não | — |
| `data` | object, nullable | Não | — |

**Exemplo:**

```json
{
  "status": true,
  "message": "Operation successful",
  "data": {
    "text": "Olá do W-AZAP!"
  }
}
```

### Session

| Campo | Tipo | Obrigatório | Descrição |
| :--- | :--- | :--- | :--- |
| `id` | string | Não | — |
| `name` | string | Não | — |
| `sessionId` | string | Não | — |
| `status` | string | Não | **Opções:** `Connected`, `Disconnected`, `Connecting` |
| `userId` | string | Não | — |
| `botConfig` | object, nullable | Não | — |
| `webhooks` | array de object | Não | — |
| `_count` | object, nullable | Não | — |
| `createdAt` | string (date-time) | Não | — |
| `updatedAt` | string (date-time) | Não | — |

**Exemplo:**

```json
{
  "id": "clx123abc",
  "name": "Marketing Bot",
  "sessionId": "marketing-1",
  "status": "Connected",
  "userId": "string",
  "botConfig": {
    "text": "Olá do W-AZAP!"
  },
  "webhooks": [
    {
      "text": "Olá do W-AZAP!"
    }
  ],
  "_count": {
    "contacts": 0,
    "messages": 0,
    "groups": 0,
    "autoReplies": 0,
    "scheduledMessages": 0
  },
  "createdAt": "2026-01-15T08:00:00.000Z",
  "updatedAt": "2026-01-15T08:00:00.000Z"
}
```

### Message

| Campo | Tipo | Obrigatório | Descrição |
| :--- | :--- | :--- | :--- |
| `text` | string | Não | — |

**Exemplo:**

```json
{
  "text": "Hello! How can I help you?"
}
```

### Contact

| Campo | Tipo | Obrigatório | Descrição |
| :--- | :--- | :--- | :--- |
| `jid` | string | Não | — |
| `name` | string | Não | — |
| `notify` | string | Não | — |
| `profilePic` | string, nullable | Não | — |

**Exemplo:**

```json
{
  "jid": "5511987654321@s.whatsapp.net",
  "name": "John Doe",
  "notify": "string",
  "profilePic": "string"
}
```

### ScheduledMessage

| Campo | Tipo | Obrigatório | Descrição |
| :--- | :--- | :--- | :--- |
| `id` | string | Não | — |
| `sessionId` | string | Não | — |
| `jid` | string | Não | — |
| `content` | string | Não | — |
| `sendAt` | string (date-time) | Não | — |
| `status` | string | Não | — |

**Exemplo:**

```json
{
  "id": "string",
  "sessionId": "string",
  "jid": "string",
  "content": "string",
  "sendAt": "2026-01-15T08:00:00.000Z",
  "status": "PENDING"
}
```

### Webhook

| Campo | Tipo | Obrigatório | Descrição |
| :--- | :--- | :--- | :--- |
| `id` | string | Não | — |
| `sessionId` | string | Não | — |
| `url` | string | Não | — |
| `events` | array de string | Não | Eventos assinados: message.received, message.sent, message.status, connection.update, group.update, contact.update, status.update, group.participant, message.deleted, message.edited ou '*' (todos) |
| `secret` | string | Não | — |

**Exemplo:**

```json
{
  "id": "string",
  "sessionId": "string",
  "url": "string",
  "events": [
    "string"
  ],
  "secret": "string"
}
```

### WebhookLog

| Campo | Tipo | Obrigatório | Descrição |
| :--- | :--- | :--- | :--- |
| `id` | string | Não | — |
| `webhookId` | string | Não | — |
| `event` | string | Não | — |
| `status` | string | Não | **Opções:** `SUCCESS`, `FAILED` |
| `requestUrl` | string | Não | — |
| `requestHeaders` | object | Não | — |
| `requestBody` | object | Não | — |
| `responseStatusCode` | integer, nullable | Não | — |
| `responseBody` | string, nullable | Não | — |
| `responseTimeMs` | integer, nullable | Não | — |
| `errorMessage` | string, nullable | Não | — |
| `createdAt` | string (date-time) | Não | — |

**Exemplo:**

```json
{
  "id": "string",
  "webhookId": "string",
  "event": "string",
  "status": "SUCCESS",
  "requestUrl": "string",
  "requestHeaders": {
    "text": "Olá do W-AZAP!"
  },
  "requestBody": {
    "text": "Olá do W-AZAP!"
  },
  "responseStatusCode": 0,
  "responseBody": "string",
  "responseTimeMs": 0,
  "errorMessage": "string",
  "createdAt": "2026-01-15T08:00:00.000Z"
}
```

### Group

| Campo | Tipo | Obrigatório | Descrição |
| :--- | :--- | :--- | :--- |
| `id` | string | Não | — |
| `subject` | string | Não | — |
| `desc` | string | Não | — |
| `owner` | string | Não | — |
| `size` | number | Não | — |
| `isCommunity` | boolean | Não | Indica se o grupo é o grupo de avisos de uma Comunidade do WhatsApp |
| `linkedParentJid` | string, nullable | Não | JID da comunidade principal, se for um subgrupo |
| `participants` | array de object | Não | — |

**Exemplo:**

```json
{
  "id": "string",
  "subject": "string",
  "desc": "string",
  "owner": "string",
  "size": 0,
  "isCommunity": true,
  "linkedParentJid": "string",
  "participants": [
    {
      "id": "string",
      "admin": "string"
    }
  ]
}
```

### Label

| Campo | Tipo | Obrigatório | Descrição |
| :--- | :--- | :--- | :--- |
| `id` | string | Não | — |
| `name` | string | Não | — |
| `color` | number, nullable | Não | — |
| `predefinedId` | string, nullable | Não | — |

**Exemplo:**

```json
{
  "id": "string",
  "name": "string",
  "color": 0,
  "predefinedId": "string"
}
```

### GroupDetails

| Campo | Tipo | Obrigatório | Descrição |
| :--- | :--- | :--- | :--- |
| `id` | string | Não | — |
| `subject` | string | Não | — |
| `subjectOwner` | string | Não | — |
| `subjectTime` | number | Não | — |
| `desc` | string | Não | — |
| `descOwner` | string | Não | — |
| `descId` | string | Não | — |
| `owner` | string | Não | — |

**Exemplo:**

```json
{
  "id": "string",
  "subject": "string",
  "subjectOwner": "string",
  "subjectTime": 0,
  "desc": "string",
  "descOwner": "string",
  "descId": "string",
  "owner": "string"
}
```

### BroadcastLog

| Campo | Tipo | Obrigatório | Descrição |
| :--- | :--- | :--- | :--- |
| `id` | string | Não | — |
| `sessionId` | string | Não | — |
| `message` | string | Não | — |
| `total` | integer | Não | — |
| `sent` | integer | Não | — |
| `failed` | integer | Não | — |
| `status` | string | Não | **Opções:** `running`, `completed`, `cancelled` |
| `delay` | integer | Não | — |
| `startedAt` | string (date-time) | Não | — |
| `completedAt` | string, nullable (date-time) | Não | — |

**Exemplo:**

```json
{
  "id": "string",
  "sessionId": "string",
  "message": "string",
  "total": 0,
  "sent": 0,
  "failed": 0,
  "status": "running",
  "delay": 0,
  "startedAt": "2026-01-15T08:00:00.000Z",
  "completedAt": "2026-01-15T08:00:00.000Z"
}
```

### BroadcastRecipient

| Campo | Tipo | Obrigatório | Descrição |
| :--- | :--- | :--- | :--- |
| `id` | string | Não | — |
| `jid` | string | Não | — |
| `status` | string | Não | **Opções:** `pending`, `sent`, `failed` |
| `error` | string, nullable | Não | — |
| `sentAt` | string, nullable (date-time) | Não | — |

**Exemplo:**

```json
{
  "id": "string",
  "jid": "string",
  "status": "pending",
  "error": "string",
  "sentAt": "2026-01-15T08:00:00.000Z"
}
```

