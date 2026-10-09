// @ts-nocheck
import { createSwaggerSpec } from "next-swagger-doc";
import pkg from "../../package.json";

export const getApiDocs = () => {
    const spec = createSwaggerSpec({
        apiFolder: "src/app/api",
        definition: {
            openapi: "3.0.0",
            info: {
                title: "Documentação da API do W-AZAP",
                version: pkg.version,
                description: `
# Gateway de WhatsApp: referência completa da API

API REST do W-AZAP para automação completa do WhatsApp: sessões, mensagens, grupos, contatos, etiquetas, agendamentos, respostas automáticas e webhooks.

## 🔐 Autenticação
Todos os endpoints exigem uma destas formas:
1. **Chave de API** no cabeçalho \`X-API-Key: sua-chave\`, gerada em **Painel › Webhooks e API** e exibida uma única vez.
2. **Cookie de login** \`authjs.session-token\` (ou \`__Secure-authjs.session-token\` em HTTPS), enviado automaticamente pelo navegador.

Rotas administrativas (usuários, geração de chave) só aceitam o cookie de login.

## 📋 Parâmetros comuns
- **sessionId**: identificador da sessão (ex.: "vendas-01"; 3 a 50 letras, números, \`-\` ou \`_\`)
- **jid**: formato de JID do WhatsApp (codifique o \`@\` como \`%40\` na URL):
  - Contato: \`5511987654321@s.whatsapp.net\`
  - Grupo: \`120363123456789@g.us\`

## 📊 Limites
- Requisições: \`RATE_LIMIT_PER_MINUTE\` por minuto por chave (padrão: 60). Acima disso, \`429\` com \`Retry-After\`.
- Corpo da requisição: até \`MAX_UPLOAD_SIZE_MB\` (padrão: 50 MB). Acima disso, \`413\`.
- Verificação de números: no máximo 50 por requisição.
- Transmissão: intervalo base configurável (padrão: 2 s) com acréscimo aleatório de até 50%.
- Histórico de mensagens: no máximo 100 por consulta.
- URLs de mídia e de webhook precisam ser públicas (bloqueio de SSRF).
                `,
            },
            servers: [
                {
                    url: process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api",
                    description: "Servidor da API",
                },
            ],
            components: {
                securitySchemes: {
                    ApiKeyAuth: {
                        type: "apiKey",
                        in: "header",
                        name: "X-API-Key",
                        description: "Chave de API gerada no painel (Webhooks e API)"
                    },
                    SessionAuth: {
                        type: "apiKey",
                        in: "cookie",
                        name: "authjs.session-token",
                        description: "Cookie de login do painel (somente navegador)"
                    }
                },
                schemas: {
                    EmailForwardInput: {
                        type: "object",
                        properties: {
                            enabled: { type: "boolean", description: "Liga ou desliga o encaminhamento" },
                            recipients: { type: "string", description: "Até 5 e-mails separados por vírgula" },
                            includeOutgoing: { type: "boolean", description: "Também encaminha as mensagens enviadas por este número" },
                            attachMedia: { type: "boolean", description: "Anexa mídias de até 10 MB" },
                            contextMessages: { type: "integer", minimum: 0, maximum: 20, description: "Mensagens anteriores da conversa em cada e-mail" },
                            smtpHost: { type: "string" },
                            smtpPort: { type: "integer", example: 587 },
                            smtpSecure: { type: "boolean", description: "true = SSL/TLS direto (465); false = STARTTLS (obrigatório)" },
                            smtpUser: { type: "string", nullable: true },
                            smtpPass: { type: "string", nullable: true, description: "Somente escrita. Omita ou envie a máscara para manter; vazio remove" },
                            fromAddress: { type: "string", nullable: true, description: "Remetente; se vazio, usa smtpUser" }
                        }
                    },
                    // Common Schemas
                    Error: {
                        type: "object",
                        properties: {
                            status: { type: "boolean", example: false },
                            message: { type: "string", example: "Error occurred" },
                            error: { type: "string", example: "Detailed error info" }
                        }
                    },
                    Success: {
                        type: "object",
                        properties: {
                            status: { type: "boolean", example: true },
                            message: { type: "string", example: "Operation successful" },
                            data: { type: "object", nullable: true }
                        }
                    },
                    Session: {
                        type: "object",
                        properties: {
                            id: { type: "string", example: "clx123abc" },
                            name: { type: "string", example: "Marketing Bot" },
                            sessionId: { type: "string", example: "marketing-1" },
                            status: { type: "string", enum: ["Connected", "Disconnected", "Connecting"], example: "Connected" },
                            userId: { type: "string" },
                            botConfig: { type: "object", nullable: true },
                            webhooks: { type: "array", items: { type: "object" }, nullable: true },
                            _count: {
                                type: "object",
                                properties: {
                                    contacts: { type: "integer" },
                                    messages: { type: "integer" },
                                    groups: { type: "integer" },
                                    autoReplies: { type: "integer" },
                                    scheduledMessages: { type: "integer" }
                                },
                                nullable: true
                            },
                            createdAt: { type: "string", format: "date-time" },
                            updatedAt: { type: "string", format: "date-time" }
                        }
                    },
                    Message: {
                        type: "object",
                        properties: {
                            text: { type: "string", example: "Hello! How can I help you?" }
                        }
                    },
                    Contact: {
                        type: "object",
                        properties: {
                            jid: { type: "string", example: "5511987654321@s.whatsapp.net" },
                            name: { type: "string", example: "John Doe" },
                            notify: { type: "string" },
                            profilePic: { type: "string", nullable: true }
                        }
                    },
                    ScheduledMessage: {
                        type: "object",
                        properties: {
                            id: { type: "string" },
                            sessionId: { type: "string" },
                            jid: { type: "string" },
                            content: { type: "string" },
                            sendAt: { type: "string", format: "date-time" },
                            status: { type: "string", example: "PENDING" }
                        }
                    },
                    Webhook: {
                        type: "object",
                        properties: {
                            id: { type: "string" },
                            sessionId: { type: "string" },
                            url: { type: "string" },
                            events: { 
                                type: "array", 
                                items: { type: "string" },
                                description: "Eventos assinados: message.received, message.sent, message.status, connection.update, group.update, contact.update, status.update, group.participant, message.deleted, message.edited ou '*' (todos)" 
                            },
                            secret: { type: "string" }
                        }
                    },
                    WebhookLog: {
                        type: "object",
                        properties: {
                            id: { type: "string" },
                            webhookId: { type: "string" },
                            event: { type: "string" },
                            status: { type: "string", enum: ["SUCCESS", "FAILED"] },
                            requestUrl: { type: "string" },
                            requestHeaders: { type: "object" },
                            requestBody: { type: "object" },
                            responseStatusCode: { type: "integer", nullable: true },
                            responseBody: { type: "string", nullable: true },
                            responseTimeMs: { type: "integer", nullable: true },
                            errorMessage: { type: "string", nullable: true },
                            createdAt: { type: "string", format: "date-time" }
                        }
                    },
                    Group: {
                        type: "object",
                        properties: {
                            id: { type: "string" },
                            subject: { type: "string" },
                            desc: { type: "string" },
                            owner: { type: "string" },
                            size: { type: "number" },
                            isCommunity: { type: "boolean", description: "Indica se o grupo é o grupo de avisos de uma Comunidade do WhatsApp" },
                            linkedParentJid: { type: "string", nullable: true, description: "JID da comunidade principal, se for um subgrupo" },
                            participants: {
                                type: "array",
                                items: {
                                    type: "object",
                                    properties: {
                                        id: { type: "string" },
                                        admin: { type: "string", nullable: true }
                                    }
                                }
                            }
                        }
                    },
                    Label: {
                        type: "object",
                        properties: {
                            id: { type: "string" },
                            name: { type: "string" },
                            color: { type: "number", nullable: true },
                            predefinedId: { type: "string", nullable: true }
                        }
                    },
                    GroupDetails: {
                        type: "object",
                        properties: {
                            id: { type: "string" },
                            subject: { type: "string" },
                            subjectOwner: { type: "string" },
                            subjectTime: { type: "number" },
                            desc: { type: "string" },
                            descOwner: { type: "string" },
                            descId: { type: "string" },
                            owner: { type: "string" }
                        }
                    },
                    BroadcastLog: {
                        type: "object",
                        properties: {
                            id: { type: "string" },
                            sessionId: { type: "string" },
                            message: { type: "string" },
                            total: { type: "integer" },
                            sent: { type: "integer" },
                            failed: { type: "integer" },
                            status: { type: "string", enum: ["running", "completed", "cancelled"] },
                            delay: { type: "integer" },
                            startedAt: { type: "string", format: "date-time" },
                            completedAt: { type: "string", format: "date-time", nullable: true }
                        }
                    },
                    BroadcastRecipient: {
                        type: "object",
                        properties: {
                            id: { type: "string" },
                            jid: { type: "string" },
                            status: { type: "string", enum: ["pending", "sent", "failed"] },
                            error: { type: "string", nullable: true },
                            sentAt: { type: "string", format: "date-time", nullable: true }
                        }
                    }
                },
                responses: {
                    Unauthorized: {
                        description: "Não autenticado: chave de API ausente ou inválida",
                        content: {
                            "application/json": {
                                schema: { $ref: "#/components/schemas/Error" },
                                example: { status: false, message: "Unauthorized", error: "Unauthorized" }
                            }
                        }
                    },
                    Forbidden: {
                        description: "Proibido: acesso negado",
                        content: {
                            "application/json": {
                                schema: { $ref: "#/components/schemas/Error" },
                                example: { status: false, message: "Forbidden - Cannot access this session", error: "Forbidden - Cannot access this session" }
                            }
                        }
                    },
                    NotFound: {
                        description: "Recurso não encontrado",
                        content: {
                            "application/json": {
                                schema: { $ref: "#/components/schemas/Error" },
                                example: { status: false, message: "Session not found", error: "Session not found" }
                            }
                        }
                    },
                    SessionNotReady: {
                        description: "Sessão desconectada ou ainda não pronta",
                        content: {
                            "application/json": {
                                schema: { $ref: "#/components/schemas/Error" },
                                example: { status: false, message: "Session not ready", error: "Session not ready" }
                            }
                        }
                    },
                    BadRequest: {
                        description: "Requisição inválida: parâmetros incorretos",
                        content: {
                            "application/json": {
                                schema: { $ref: "#/components/schemas/Error" },
                                example: { status: false, message: "Invalid request parameters", error: "Invalid request parameters" }
                            }
                        }
                    },
                    ServerError: {
                        description: "Erro interno do servidor",
                        content: {
                            "application/json": {
                                schema: { $ref: "#/components/schemas/Error" },
                                example: { status: false, message: "Internal Server Error", error: "Internal Server Error" }
                            }
                        }
                    }
                }
            },
            security: [{ ApiKeyAuth: [] }, { SessionAuth: [] }],
            paths: {
                "/media/{filename}": {
                    "get": {
                        "tags": [
                            "Mídia"
                        ],
                        "summary": "Baixar arquivo de mídia",
                        "parameters": [
                            {
                                "name": "filename",
                                "in": "path",
                                "required": true,
                                "schema": {
                                    "type": "string"
                                }
                            }
                        ],
                        "responses": {
                            "200": {
                                "description": "Conteúdo do arquivo"
                            }
                        }
                    }
                },
                "/groups/{sessionId}/{jid}/leave": {
                    "post": {
                        "tags": [
                            "Grupos"
                        ],
                        "summary": "Sair de um grupo",
                        "parameters": [
                            {
                                "name": "sessionId",
                                "in": "path",
                                "required": true,
                                "schema": {
                                    "type": "string"
                                }
                            },
                            {
                                "name": "jid",
                                "in": "path",
                                "required": true,
                                "schema": {
                                    "type": "string"
                                }
                            }
                        ],
                        "responses": {
                            "200": {
                                "description": "Saiu do grupo com sucesso"
                            }
                        }
                    }
                },
                "/docs": {
                    "get": {
                        "tags": [
                            "Documentação"
                        ],
                        "summary": "Obter a especificação OpenAPI (JSON)",
                        "responses": {
                            "200": {
                                "description": "Especificação OpenAPI em JSON"
                            }
                        }
                    }
                },
                "/auth/register": {
                    "post": {
                        "tags": [
                            "Autenticação web"
                        ],
                        "summary": "Cadastrar novo usuário",
                        "description": "Cadastra um usuário pelo navegador. Fica desativado por padrão: só a primeira conta de uma instalação nova (que vira SUPERADMIN) pode se cadastrar sem que o administrador ative o cadastro em Configurações. Senha com no mínimo 8 caracteres; limite de 10 cadastros por IP por hora.",
                        "requestBody": {
                            "required": true,
                            "content": {
                                "application/json": {
                                    "schema": {
                                        "type": "object",
                                        "required": [
                                            "name",
                                            "email",
                                            "password"
                                        ],
                                        "properties": {
                                            "name": {
                                                "type": "string",
                                                "example": "John Doe"
                                            },
                                            "email": {
                                                "type": "string",
                                                "example": "john@example.com"
                                            },
                                            "password": {
                                                "type": "string",
                                                "example": "password123"
                                            }
                                        }
                                    }
                                }
                            }
                        },
                        "responses": {
                            "200": {
                                "description": "Usuário cadastrado"
                            }
                        }
                    }
                },
                // ==================== AUTHENTICATION ====================
                "/auth/session": {
                    get: {
                        tags: ["Autenticação web"],
                        summary: "Obter a sessão de login atual",
                        description: "Verifica se o usuário está logado no painel (rota do NextAuth)",
                        responses: {
                            200: {
                                description: "Sessão atual",
                                content: {
                                    "application/json": {
                                        schema: {
                                            type: "object",
                                            properties: {
                                                user: {
                                                    type: "object",
                                                    properties: {
                                                        name: { type: "string" },
                                                        email: { type: "string" },
                                                        image: { type: "string" }
                                                    }
                                                },
                                                expires: { type: "string" }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                },
                "/auth/csrf": {
                    get: {
                        tags: ["Autenticação web"],
                        summary: "Obter token CSRF",
                        description: "Obtém o token CSRF usado nos formulários de login (rota do NextAuth)",
                        responses: {
                            200: {
                                description: "Token CSRF",
                                content: {
                                    "application/json": {
                                        schema: {
                                            type: "object",
                                            properties: {
                                                csrfToken: { type: "string" }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                },
                // ==================== SESSIONS ====================
                "/sessions": {
                    get: {
                        tags: ["Sessões"],
                        summary: "Listar as sessões acessíveis",
                        description: "Lista todas as sessões que o usuário autenticado pode acessar: as próprias e as compartilhadas com ele (o SUPERADMIN vê todas). Segredos de webhook não são incluídos.",
                        responses: {
                            200: {
                                description: "Lista de sessões",
                                content: {
                                    "application/json": {
                                        schema: {
                                            type: "array",
                                            items: { $ref: "#/components/schemas/Session" }
                                        }
                                    }
                                }
                            },
                            401: { $ref: "#/components/responses/Unauthorized" }
                        }
                    },
                    post: {
                        tags: ["Sessões"],
                        summary: "Criar sessão do WhatsApp",
                        description: "Cria uma sessão do WhatsApp para pareamento por QR code ou código de pareamento",
                        requestBody: {
                            required: true,
                            content: {
                                "application/json": {
                                    schema: {
                                        type: "object",
                                        required: ["name"],
                                        properties: {
                                            name: { type: "string", example: "Sales Bot", description: "Nome de exibição da sessão (até 100 caracteres)" },
                                            sessionId: { type: "string", example: "sales-01", description: "ID único da sessão: de 3 a 50 letras, números, `-` ou `_`. Se omitido, um ID aleatório é gerado." }
                                        }
                                    },
                                    example: {
                                        name: "Marketing Bot",
                                        sessionId: "marketing-1"
                                    }
                                }
                            }
                        },
                        responses: {
                            200: {
                                description: "Sessão criada com sucesso",
                                content: {
                                    "application/json": {
                                        schema: { $ref: "#/components/schemas/Session" }
                                    }
                                }
                            },
                            400: { description: "Corpo da requisição inválido" },
                            401: { $ref: "#/components/responses/Unauthorized" }
                        }
                    }
                },

                "/sessions/{id}/qr": {
                    get: {
                        tags: ["Sessões"],
                        summary: "Obter o QR code de pareamento",
                        description: "Obtém o QR code (texto e imagem em base64) para conectar o WhatsApp",
                        parameters: [
                            {
                                name: "id",
                                in: "path",
                                required: true,
                                schema: { type: "string" },
                                description: "ID da sessão",
                                example: "sales-01"
                            }
                        ],
                        responses: {
                            200: {
                                description: "QR code gerado",
                                content: {
                                    "application/json": {
                                        schema: {
                                            type: "object",
                                            properties: {
                                                success: { type: "boolean" },
                                                qr: { type: "string", description: "Conteúdo do QR code" },
                                                base64: { type: "string", description: "Imagem do QR code como data URL em base64" }
                                            }
                                        },
                                        example: { status: true, message: "QR code generated", data: { success: true, qr: "2@AbCdEfGhIjKlMnOp...", base64: "data:image/png;base64,iVBORw0KGgo..." } }
                                    }
                                }
                            },
                            400: { description: "Sessão já conectada" },
                            404: { description: "QR code ainda não disponível" }
                        }
                    }
                },

                "/sessions/{id}/bot-config": {
                    get: {
                        tags: ["Sessões"],
                        summary: "Obter a configuração do bot",
                        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
                        responses: { 200: { description: "Configuração do bot obtida" } }
                    },
                    post: {
                        tags: ["Sessões"],
                        summary: "Atualizar a configuração do bot",
                        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
                        requestBody: {
                            content: {
                                "application/json": {
                                    schema: {
                                        type: "object",
                                        properties: {
                                            enabled: { type: "boolean" },
                                            botMode: { type: "string", enum: ["OWNER", "SPECIFIC", "BLACKLIST", "ALL"] },
                                            botAllowedJids: { type: "array", items: { type: "string" } },
                                            botBlockedJids: { type: "array", items: { type: "string" } },
                                            autoReplyMode: { type: "string", enum: ["OWNER", "SPECIFIC", "BLACKLIST", "ALL"] },
                                            autoReplyAllowedJids: { type: "array", items: { type: "string" } },
                                            autoReplyBlockedJids: { type: "array", items: { type: "string" } },
                                            botName: { type: "string" },
                                            enableSticker: { type: "boolean" },
                                            enableVideoSticker: { type: "boolean" },
                                            maxStickerDuration: { type: "integer" },
                                            enablePing: { type: "boolean" },
                                            enableUptime: { type: "boolean" },
                                            removeBgApiKey: { type: "string", nullable: true }
                                        }
                                    },
                                    example: {
                                        enabled: true,
                                        botMode: "BLACKLIST",
                                        botBlockedJids: ["5511987654321@s.whatsapp.net"],
                                        autoReplyMode: "SPECIFIC",
                                        autoReplyAllowedJids: ["5511987654321@s.whatsapp.net"],
                                        botName: "My Assistant",
                                        enableSticker: true
                                    }
                                }
                            }
                        },
                        responses: {
                            200: {
                                description: "Configuração atualizada",
                                content: {
                                    "application/json": {
                                        schema: {
                                            type: "object",
                                            properties: {
                                                id: { type: "string" },
                                                sessionId: { type: "string" },
                                                enabled: { type: "boolean" },
                                                botMode: { type: "string" },
                                                botAllowedJids: { type: "array", items: { type: "string" } },
                                                autoReplyMode: { type: "string" },
                                                autoReplyAllowedJids: { type: "array", items: { type: "string" } },
                                                botName: { type: "string" },
                                                enableSticker: { type: "boolean" },
                                                enableVideoSticker: { type: "boolean" },
                                                maxStickerDuration: { type: "integer" },
                                                enablePing: { type: "boolean" },
                                                enableUptime: { type: "boolean" },
                                                removeBgApiKey: { type: "string", nullable: true },
                                                createdAt: { type: "string", format: "date-time" },
                                                updatedAt: { type: "string", format: "date-time" }
                                            }
                                        }
                                    }
                                }
                            },
                            401: { $ref: "#/components/responses/Unauthorized" },
                            403: { $ref: "#/components/responses/Forbidden" },
                            404: { description: "Sessão não encontrada" },
                            500: { description: "Erro interno do servidor" }
                        }
                    }
                },
                "/sessions/{id}/email-forward": {
                    get: {
                        tags: ["Sessões"],
                        summary: "Obter o encaminhamento por e-mail",
                        description: "Configuração do encaminhamento em tempo real das conversas privadas por e-mail. Só o dono da sessão (ou SUPERADMIN). A senha do SMTP nunca é devolvida: vem mascarada quando existe.",
                        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
                        responses: {
                            200: {
                                description: "Configuração obtida (valores padrão quando ainda não configurado)",
                                content: {
                                    "application/json": {
                                        example: {
                                            status: true,
                                            message: "Configuração de encaminhamento carregada",
                                            data: {
                                                enabled: true, recipients: "voce@exemplo.com", includeOutgoing: false, attachMedia: true, contextMessages: 5,
                                                smtpHost: "smtp.gmail.com", smtpPort: 587, smtpSecure: false, smtpUser: "voce@gmail.com", smtpPass: "••••••••", fromAddress: null,
                                                sentCount: 42, lastSentAt: "2026-10-09T14:31:00.000Z", lastError: null, lastErrorAt: null, configured: true
                                            }
                                        }
                                    }
                                }
                            },
                            403: { description: "Apenas o dono da sessão pode configurar o encaminhamento" }
                        }
                    },
                    post: {
                        tags: ["Sessões"],
                        summary: "Salvar o encaminhamento por e-mail",
                        description: "Exige login no navegador (não aceita chave de API). Cada nova mensagem de conversa privada vira um e-mail com os dados do contato e as últimas mensagens; grupos não são encaminhados. Limite de 300 e-mails por hora por sessão. Envie `smtpPass` mascarado ou omita para manter a senha salva; string vazia remove.",
                        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
                        requestBody: {
                            content: {
                                "application/json": {
                                    schema: { $ref: "#/components/schemas/EmailForwardInput" },
                                    example: {
                                        enabled: true, recipients: "voce@exemplo.com, equipe@exemplo.com", includeOutgoing: false, attachMedia: true, contextMessages: 5,
                                        smtpHost: "smtp.gmail.com", smtpPort: 587, smtpSecure: false, smtpUser: "voce@gmail.com", smtpPass: "senha-de-app", fromAddress: null
                                    }
                                }
                            }
                        },
                        responses: {
                            200: { description: "Encaminhamento salvo" },
                            400: { description: "Dados inválidos ou configuração incompleta para ativar" },
                            403: { description: "Apenas o dono da sessão pode configurar o encaminhamento" }
                        }
                    }
                },

                "/sessions/{id}/email-forward/test": {
                    post: {
                        tags: ["Sessões"],
                        summary: "Enviar e-mail de teste",
                        description: "Envia um e-mail de teste com as configurações do corpo (não precisam estar salvas). Sem `smtpPass`, usa a senha salva. Exige login no navegador.",
                        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
                        requestBody: {
                            content: { "application/json": { schema: { $ref: "#/components/schemas/EmailForwardInput" } } }
                        },
                        responses: {
                            200: { description: "E-mail de teste enviado" },
                            400: { description: "Dados inválidos" },
                            502: {
                                description: "O servidor SMTP recusou ou não respondeu. `code`: auth, connection, tls, recipient, private_host ou unknown",
                                content: { "application/json": { example: { status: false, message: "Invalid login: 535-5.7.8 Username and Password not accepted", code: "auth" } } }
                            }
                        }
                    }
                },

                "/sessions/{id}": {
                    get: {
                        tags: ["Sessões"],
                        summary: "Detalhes da sessão",
                        description: "Informações detalhadas de uma sessão, incluindo status e tempo conectado",
                        parameters: [
                            { name: "id", in: "path", required: true, schema: { type: "string" } }
                        ],
                        responses: {
                            200: {
                                description: "Detalhes da sessão",
                                content: {
                                    "application/json": {
                                        schema: {
                                            allOf: [
                                                { $ref: "#/components/schemas/Session" },
                                                {
                                                    type: "object",
                                                    properties: {
                                                        uptime: { type: "integer", description: "Tempo conectado, em segundos" },
                                                        messageCount: { type: "integer" },
                                                        hasInstance: { type: "boolean" },
                                                        me: { type: "object", nullable: true }
                                                    }
                                                }
                                            ]
                                        }
                                    }
                                }
                            },
                            404: { description: "Sessão não encontrada" }
                        }
                    }
                },
                "/sessions/{id}/{action}": {
                    post: {
                        tags: ["Sessões"],
                        summary: "Executar ação na sessão",
                        description: "Inicia, para, reinicia ou desconecta (logout) uma sessão",
                        parameters: [
                            { name: "id", in: "path", required: true, schema: { type: "string" } },
                            { name: "action", in: "path", required: true, schema: { type: "string", enum: ["start", "stop", "restart", "logout"] } }
                        ],
                        responses: {
                            200: {
                                description: "Ação executada com sucesso",
                                content: {
                                    "application/json": {
                                        schema: { $ref: "#/components/schemas/Success" }
                                    }
                                }
                            },
                            400: { description: "Ação inválida" },
                            500: { description: "Falha ao executar a ação" }
                        }
                    }
                },

                "/sessions/{id}/settings": {
                    patch: {
                        tags: ["Sessões"],
                        summary: "Atualizar as configurações da sessão",
                        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
                        requestBody: {
                            content: {
                                "application/json": {
                                    schema: {
                                        type: "object",
                                        properties: {
                                            config: {
                                                type: "object",
                                                properties: {
                                                    readReceipts: { type: "boolean" },
                                                    rejectCalls: { type: "boolean" }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        },
                        responses: { 200: { description: "Configurações atualizadas" } }
                    },
                    delete: {
                        tags: ["Sessões"],
                        summary: "Excluir a sessão e desconectar",
                        description: "Exclui a sessão permanentemente e desconecta a conta do WhatsApp",
                        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
                        responses: {
                            200: {
                                description: "Sessão excluída",
                                content: {
                                    "application/json": {
                                        schema: { $ref: "#/components/schemas/Success" }
                                    }
                                }
                            }
                        }
                    }
                },

                // ==================== SESSION ACCESS ====================
                "/sessions/{sessionId}/access": {
                    get: {
                        tags: ["Acesso às sessões"],
                        summary: "Listar usuários com acesso compartilhado",
                        description: "Lista todos os usuários que receberam acesso à sessão. Somente o dono da sessão ou um SUPERADMIN pode usar este endpoint.",
                        parameters: [
                            { name: "sessionId", in: "path", required: true, schema: { type: "string" }, description: "ID da sessão (identificador textual ou CUID)", example: "marketing-1" }
                        ],
                        responses: {
                            200: {
                                description: "Lista de acessos obtida",
                                content: {
                                    "application/json": {
                                        schema: {
                                            type: "object",
                                            properties: {
                                                status: { type: "boolean", example: true },
                                                message: { type: "string", example: "Access list retrieved successfully" },
                                                data: {
                                                    type: "array",
                                                    items: {
                                                        type: "object",
                                                        properties: {
                                                            id: { type: "string" },
                                                            sessionId: { type: "string" },
                                                            userId: { type: "string" },
                                                            createdAt: { type: "string", format: "date-time" },
                                                            user: {
                                                                type: "object",
                                                                properties: {
                                                                    id: { type: "string" },
                                                                    name: { type: "string" },
                                                                    email: { type: "string" },
                                                                    role: { type: "string" }
                                                                }
                                                            }
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            },
                            401: { $ref: "#/components/responses/Unauthorized" },
                            403: { description: "Proibido: só o dono da sessão pode gerenciar os acessos" },
                            404: { description: "Sessão não encontrada" }
                        }
                    },
                    post: {
                        tags: ["Acesso às sessões"],
                        summary: "Conceder acesso a outro usuário",
                        description: "Concede acesso à sessão a outro usuário cadastrado, pelo e-mail. Somente o dono da sessão ou um SUPERADMIN pode usar este endpoint. Não é possível conceder acesso ao próprio dono nem a SUPERADMINs.",
                        parameters: [
                            { name: "sessionId", in: "path", required: true, schema: { type: "string" }, description: "ID da sessão (identificador textual ou CUID)", example: "marketing-1" }
                        ],
                        requestBody: {
                            required: true,
                            content: {
                                "application/json": {
                                    schema: {
                                        type: "object",
                                        required: ["email"],
                                        properties: {
                                            email: { type: "string", format: "email", description: "E-mail do usuário que vai receber o acesso", example: "staff@example.com" }
                                        }
                                    }
                                }
                            }
                        },
                        responses: {
                            201: {
                                description: "Acesso concedido com sucesso",
                                content: {
                                    "application/json": {
                                        schema: {
                                            type: "object",
                                            properties: {
                                                status: { type: "boolean", example: true },
                                                message: { type: "string", example: "Access granted to staff@example.com" },
                                                data: {
                                                    type: "object",
                                                    properties: {
                                                        id: { type: "string" },
                                                        sessionId: { type: "string" },
                                                        userId: { type: "string" },
                                                        createdAt: { type: "string", format: "date-time" },
                                                        user: {
                                                            type: "object",
                                                            properties: {
                                                                id: { type: "string" },
                                                                name: { type: "string" },
                                                                email: { type: "string" },
                                                                role: { type: "string" }
                                                            }
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            },
                            400: { description: "Erro de validação / não é possível conceder ao dono / o SUPERADMIN já tem acesso" },
                            401: { $ref: "#/components/responses/Unauthorized" },
                            403: { description: "Proibido: só o dono da sessão pode gerenciar os acessos" },
                            404: { description: "Sessão ou usuário não encontrado" },
                            409: { description: "O usuário já tem acesso a esta sessão" }
                        }
                    },
                    delete: {
                        tags: ["Acesso às sessões"],
                        summary: "Revogar o acesso de um usuário",
                        description: "Remove o acesso compartilhado de um usuário à sessão. Somente o dono da sessão ou um SUPERADMIN pode usar este endpoint.",
                        parameters: [
                            { name: "sessionId", in: "path", required: true, schema: { type: "string" }, description: "ID da sessão (identificador textual ou CUID)", example: "marketing-1" }
                        ],
                        requestBody: {
                            required: true,
                            content: {
                                "application/json": {
                                    schema: {
                                        type: "object",
                                        required: ["userId"],
                                        properties: {
                                            userId: { type: "string", description: "CUID do usuário que vai perder o acesso", example: "clx456ghi" }
                                        }
                                    }
                                }
                            }
                        },
                        responses: {
                            200: {
                                description: "Acesso revogado com sucesso",
                                content: {
                                    "application/json": {
                                        schema: { $ref: "#/components/schemas/Success" }
                                    }
                                }
                            },
                            400: { description: "Erro de validação" },
                            401: { $ref: "#/components/responses/Unauthorized" },
                            403: { description: "Proibido: só o dono da sessão pode gerenciar os acessos" },
                            404: { description: "Sessão ou registro de acesso não encontrado" }
                        }
                    }
                },

                // ==================== MESSAGING ====================

                "/messages/{sessionId}/{jid}/send": {
                    post: {
                        tags: ["Mensagens"],
                        summary: "Enviar mensagem (texto/mídia/figurinha)",
                        description: "Endpoint universal para enviar texto, imagens, vídeos, documentos e figurinhas. Aceita menções e todos os tipos de mensagem do WhatsApp. URLs de mídia precisam ser públicas (`http`/`https`): endereços internos e caminhos de arquivos locais são recusados.",
                        parameters: [
                            {
                                name: "sessionId",
                                in: "path",
                                required: true,
                                schema: { type: "string" },
                                description: "Identificador da sessão",
                                example: "sales-01"
                            },
                            {
                                name: "jid",
                                in: "path",
                                required: true,
                                schema: { type: "string" },
                                description: "JID do destinatário",
                                example: "5511987654321@s.whatsapp.net"
                            }
                        ],
                        requestBody: {
                            required: true,
                            content: {
                                "application/json": {
                                    schema: {
                                        type: "object",
                                        required: ["message"],
                                        properties: {
                                            message: {
                                                type: "object",
                                                description: "Conteúdo da mensagem (texto, imagem, figurinha etc.)",
                                                oneOf: [
                                                    {
                                                        properties: {
                                                            text: { type: "string", example: "Hello!" }
                                                        }
                                                    },
                                                    {
                                                        properties: {
                                                            image: {
                                                                type: "object",
                                                                properties: {
                                                                    url: { type: "string", example: "https://example.com/image.jpg" }
                                                                }
                                                            },
                                                            caption: { type: "string", example: "Check this out" }
                                                        }
                                                    },
                                                    {
                                                        properties: {
                                                            sticker: {
                                                                oneOf: [
                                                                    { type: "string", description: "URL pública da imagem da figurinha" },
                                                                    {
                                                                        type: "object",
                                                                        properties: {
                                                                            url: { type: "string" },
                                                                            pack: { type: "string" },
                                                                            author: { type: "string" }
                                                                        }
                                                                    }
                                                                ]
                                                            }
                                                        }
                                                    }
                                                ]
                                            },
                                            mentions: {
                                                type: "array",
                                                items: { type: "string" },
                                                example: ["5511987654321@s.whatsapp.net"],
                                                description: "Lista de JIDs a mencionar (em mensagens de grupo)"
                                            }
                                        }
                                    },
                                    examples: {
                                        text: {
                                            summary: "Mensagem de texto",
                                            value: {
                                                jid: "5511987654321@s.whatsapp.net",
                                                message: { text: "Hello, how can I help you?" }
                                            }
                                        },
                                        image: {
                                            summary: "Imagem com legenda",
                                            value: {
                                                jid: "5511987654321@s.whatsapp.net",
                                                message: {
                                                    image: { url: "https://example.com/product.jpg" },
                                                    caption: "New product available!"
                                                }
                                            }
                                        },
                                        sticker: {
                                            summary: "Figurinha a partir de URL",
                                            value: {
                                                jid: "5511987654321@s.whatsapp.net",
                                                message: {
                                                    sticker: {
                                                        url: "https://example.com/sticker.webp",
                                                        pack: "My Stickers",
                                                        author: "W-AZAP"
                                                    }
                                                }
                                            }
                                        },
                                        withMention: {
                                            summary: "Mensagem com menção",
                                            value: {
                                                jid: "120363123456789@g.us",
                                                message: { text: "Hello @5511987654321, welcome!" },
                                                mentions: ["5511987654321@s.whatsapp.net"]
                                            }
                                        }
                                    }
                                }
                            }
                        },
                        responses: {
                            200: {
                                description: "Mensagem enviada com sucesso",
                                content: {
                                    "application/json": {
                                        schema: { $ref: "#/components/schemas/Success" },
                                        example: {
                                            status: true,
                                            message: "Message sent successfully",
                                            data: {
                                                key: {
                                                    remoteJid: "5511987654321@s.whatsapp.net",
                                                    fromMe: true,
                                                    id: "3EB01234567890"
                                                },
                                                message: {
                                                    conversation: "Hello from W-AZAP!"
                                                },
                                                messageTimestamp: "1678901234"
                                            }
                                        }
                                    }
                                }
                            },
                            400: { description: "Requisição inválida: `jid` e `message` são obrigatórios" },
                            401: { $ref: "#/components/responses/Unauthorized" },
                            403: { $ref: "#/components/responses/Forbidden" },
                            404: { description: "Sessão não encontrada ou desconectada" },
                            503: { $ref: "#/components/responses/SessionNotReady" },
                            500: { description: "Falha ao enviar a mensagem" }
                        }
                    }
                },

                "/messages/{sessionId}/{jid}/media": {
                    post: {
                        tags: ["Mensagens"],
                        summary: "Enviar mídia (imagem/vídeo/áudio/documento)",
                        description: "Envia um arquivo via `multipart/form-data` (campos `file`, `type` e `caption`). Tamanho máximo: `MAX_UPLOAD_SIZE_MB`.",
                        parameters: [
                            {
                                name: "sessionId",
                                in: "path",
                                required: true,
                                schema: { type: "string" },
                                description: "Identificador da sessão"
                            },
                            {
                                name: "jid",
                                in: "path",
                                required: true,
                                schema: { type: "string" },
                                description: "JID do destinatário"
                            }
                        ],
                        requestBody: {
                            content: {
                                "multipart/form-data": {
                                    schema: {
                                        type: "object",
                                        required: ["file", "type"],
                                        properties: {
                                            file: { type: "string", format: "binary" },
                                            type: {
                                                type: "string",
                                                enum: ["image", "video", "audio", "voice", "document", "sticker"],
                                                default: "image"
                                            },
                                            caption: { type: "string" }
                                        }
                                    }
                                }
                            }
                        },
                        responses: {
                            200: {
                                description: "Mídia enviada com sucesso",
                                content: {
                                    "application/json": {
                                        schema: { $ref: "#/components/schemas/Success" }
                                    }
                                }
                            },
                            400: { description: "Requisição inválida: arquivo ausente" },
                            401: { $ref: "#/components/responses/Unauthorized" },
                            403: { $ref: "#/components/responses/Forbidden" },
                            503: { $ref: "#/components/responses/SessionNotReady" },
                            500: { description: "Falha ao enviar a mídia" }
                        }
                    }
                },


                "/messages/{sessionId}/broadcast": {
                    post: {
                        tags: ["Mensagens"],
                        summary: "Transmitir mensagem para vários destinatários",
                        description: "Envia a mesma mensagem para vários contatos em segundo plano, com intervalos aleatórios contra banimento. O progresso é emitido pelo Socket.IO (`broadcast.progress`) e fica registrado no histórico.",
                        parameters: [
                            { name: "sessionId", in: "path", required: true, schema: { type: "string" } }
                        ],
                        requestBody: {
                            content: {
                                "application/json": {
                                    schema: {
                                        type: "object",
                                        required: ["recipients", "message"],
                                        properties: {
                                            recipients: {
                                                type: "array",
                                                items: { type: "string" },
                                                example: ["5511987654321@s.whatsapp.net", "5521912345678@s.whatsapp.net"]
                                            },
                                            message: { type: "string", example: "Flash Sale! 50% off" },
                                            delay: { type: "number", description: "Intervalo base entre os envios, em ms (padrão: 2000). A cada envio é somado um acréscimo aleatório de até 50%." }
                                        }
                                    }
                                }
                            }
                        },
                        responses: {
                            200: {
                                description: "Transmissão iniciada",
                                content: {
                                    "application/json": {
                                        schema: {
                                            type: "object",
                                            properties: {
                                                success: { type: "boolean", example: true },
                                                message: { type: "string", example: "Broadcast started in background" }
                                            }
                                        }
                                    }
                                }
                            },
                            401: { $ref: "#/components/responses/Unauthorized" },
                            403: { $ref: "#/components/responses/Forbidden" },
                            503: { $ref: "#/components/responses/SessionNotReady" },
                            500: { description: "Falha ao iniciar a transmissão" }
                        }
                    }
                },

                "/messages/{sessionId}/broadcast/history": {
                    get: {
                        tags: ["Mensagens"],
                        summary: "Histórico de transmissões",
                        description: "Lista as transmissões anteriores com status e contagem de enviadas e com falha (salvas no banco)",
                        parameters: [
                            { name: "sessionId", in: "path", required: true, schema: { type: "string" } },
                            { name: "limit", in: "query", schema: { type: "integer", default: 20 }, description: "Quantidade de resultados (máx. 50)" },
                            { name: "offset", in: "query", schema: { type: "integer", default: 0 }, description: "Deslocamento da paginação" }
                        ],
                        responses: {
                            200: {
                                description: "Histórico de transmissões",
                                content: {
                                    "application/json": {
                                        schema: {
                                            type: "object",
                                            properties: {
                                                status: { type: "boolean", example: true },
                                                data: {
                                                    type: "array",
                                                    items: { $ref: "#/components/schemas/BroadcastLog" }
                                                },
                                                total: { type: "integer" },
                                                limit: { type: "integer" },
                                                offset: { type: "integer" }
                                            }
                                        }
                                    }
                                }
                            },
                            401: { $ref: "#/components/responses/Unauthorized" },
                            403: { $ref: "#/components/responses/Forbidden" }
                        }
                    }
                },

                "/messages/{sessionId}/broadcast/history/{logId}": {
                    get: {
                        tags: ["Mensagens"],
                        summary: "Detalhes de uma transmissão",
                        description: "Detalhes completos de uma transmissão, incluindo o status de cada destinatário",
                        parameters: [
                            { name: "sessionId", in: "path", required: true, schema: { type: "string" } },
                            { name: "logId", in: "path", required: true, schema: { type: "string" } }
                        ],
                        responses: {
                            200: {
                                description: "Detalhes da transmissão",
                                content: {
                                    "application/json": {
                                        schema: {
                                            type: "object",
                                            properties: {
                                                status: { type: "boolean", example: true },
                                                data: {
                                                    type: "object",
                                                    properties: {
                                                        id: { type: "string" },
                                                        sessionId: { type: "string" },
                                                        message: { type: "string" },
                                                        total: { type: "integer" },
                                                        sent: { type: "integer" },
                                                        failed: { type: "integer" },
                                                        status: { type: "string" },
                                                        delay: { type: "integer" },
                                                        startedAt: { type: "string", format: "date-time" },
                                                        completedAt: { type: "string", format: "date-time", nullable: true },
                                                        recipients: {
                                                            type: "array",
                                                            items: { $ref: "#/components/schemas/BroadcastRecipient" }
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            },
                            401: { $ref: "#/components/responses/Unauthorized" },
                            403: { $ref: "#/components/responses/Forbidden" },
                            404: { description: "Transmissão não encontrada" }
                        }
                    }
                },

                "/messages/{sessionId}/{jid}/poll": {
                    post: {
                        tags: ["Mensagens"],
                        summary: "Enviar enquete",
                        description: "Cria uma enquete interativa (de 2 a 12 opções, escolha única ou múltipla)",
                        parameters: [
                            { name: "sessionId", in: "path", required: true, schema: { type: "string" } },
                            { name: "jid", in: "path", required: true, schema: { type: "string" } }
                        ],
                        requestBody: {
                            content: {
                                "application/json": {
                                    schema: {
                                        type: "object",
                                        required: ["question", "options"],
                                        properties: {
                                            question: { type: "string", example: "What's your favorite product?" },
                                            options: {
                                                type: "array",
                                                items: { type: "string" },
                                                minItems: 2,
                                                maxItems: 12,
                                                example: ["Product A", "Product B", "Product C"]
                                            },
                                            selectableCount: { type: "integer", minimum: 1, example: 1 }
                                        }
                                    }
                                }
                            }
                        },
                        responses: {
                            200: { description: "Enquete enviada", content: { "application/json": { schema: { type: "object", properties: { success: { type: "boolean", example: true } } } } } },
                            401: { $ref: "#/components/responses/Unauthorized" },
                            403: { $ref: "#/components/responses/Forbidden" },
                            503: { $ref: "#/components/responses/SessionNotReady" },
                            500: { description: "Falha ao enviar a enquete" }
                        }
                    }
                },

                "/messages/{sessionId}/{jid}/location": {
                    post: {
                        tags: ["Mensagens"],
                        summary: "Enviar localização",
                        description: "Compartilha coordenadas GPS, com nome e endereço opcionais",
                        parameters: [
                            { name: "sessionId", in: "path", required: true, schema: { type: "string" } },
                            { name: "jid", in: "path", required: true, schema: { type: "string" } }
                        ],
                        requestBody: {
                            content: {
                                "application/json": {
                                    schema: {
                                        type: "object",
                                        required: ["latitude", "longitude"],
                                        properties: {
                                            latitude: { type: "number", minimum: -90, maximum: 90, example: -6.2088 },
                                            longitude: { type: "number", minimum: -180, maximum: 180, example: 106.8456 },
                                            name: { type: "string", example: "Central Park" },
                                            address: { type: "string", example: "Jakarta, Indonesia" }
                                        }
                                    }
                                }
                            }
                        },
                        responses: {
                            200: { description: "Localização enviada", content: { "application/json": { schema: { type: "object", properties: { success: { type: "boolean", example: true } } } } } },
                            401: { $ref: "#/components/responses/Unauthorized" },
                            403: { $ref: "#/components/responses/Forbidden" },
                            503: { $ref: "#/components/responses/SessionNotReady" },
                            500: { description: "Falha ao enviar a localização" }
                        }
                    }
                },

                "/messages/{sessionId}/{jid}/contact": {
                    post: {
                        tags: ["Mensagens"],
                        summary: "Enviar cartão de contato",
                        description: "Compartilha um ou mais contatos em formato vCard",
                        parameters: [
                            { name: "sessionId", in: "path", required: true, schema: { type: "string" } },
                            { name: "jid", in: "path", required: true, schema: { type: "string" } }
                        ],
                        requestBody: {
                            content: {
                                "application/json": {
                                    schema: {
                                        type: "object",
                                        required: ["contacts"],
                                        properties: {
                                            contacts: {
                                                type: "array",
                                                items: {
                                                    type: "object",
                                                    required: ["displayName", "vcard"],
                                                    properties: {
                                                        displayName: { type: "string", example: "John Doe" },
                                                        vcard: { type: "string", example: "BEGIN:VCARD..." }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        },
                        responses: {
                            200: { description: "Contato enviado", content: { "application/json": { schema: { type: "object", properties: { success: { type: "boolean", example: true } } } } } },
                            401: { $ref: "#/components/responses/Unauthorized" },
                            403: { $ref: "#/components/responses/Forbidden" },
                            503: { $ref: "#/components/responses/SessionNotReady" },
                            500: { description: "Falha ao enviar o contato" }
                        }
                    }
                },

                "/messages/{sessionId}/download/{messageId}/media": {
                    get: {
                        tags: ["Mensagens"],
                        summary: "Baixar a mídia de uma mensagem",
                        description: "Baixa a mídia de uma mensagem (arquivo binário direto ou redirecionamento)",
                        parameters: [
                            { name: "sessionId", in: "path", required: true, schema: { type: "string" } },
                            { name: "messageId", in: "path", required: true, schema: { type: "string" } }
                        ],
                        responses: {
                            200: {
                                description: "Arquivo de mídia binário",
                                content: {
                                    "*/*": { schema: { type: "string", format: "binary" } }
                                }
                            },
                            401: { $ref: "#/components/responses/Unauthorized" },
                            403: { description: "Proibido: sem acesso à sessão ou à mensagem" },
                            404: { description: "Mensagem não encontrada ou sem mídia" }
                        }
                    }
                },

                "/messages/{sessionId}/{jid}/{messageId}/react": {
                    post: {
                        tags: ["Mensagens"],
                        summary: "Reagir a uma mensagem com emoji",
                        description: "Adiciona uma reação com emoji a uma mensagem (texto vazio remove a reação)",
                        parameters: [
                            { name: "sessionId", in: "path", required: true, schema: { type: "string" } },
                            { name: "jid", in: "path", required: true, schema: { type: "string" } },
                            { name: "messageId", in: "path", required: true, schema: { type: "string" } }
                        ],
                        requestBody: {
                            content: {
                                "application/json": {
                                    schema: {
                                        type: "object",
                                        required: ["emoji"],
                                        properties: {
                                            emoji: { type: "string", example: "👍", description: "Emoji, ou texto vazio para remover" }
                                        }
                                    }
                                }
                            }
                        },
                        responses: {
                            200: { description: "Reação enviada", content: { "application/json": { schema: { type: "object", properties: { success: { type: "boolean", example: true }, message: { type: "string" } } } } } },
                            401: { $ref: "#/components/responses/Unauthorized" },
                            403: { $ref: "#/components/responses/Forbidden" },
                            503: { $ref: "#/components/responses/SessionNotReady" },
                            500: { description: "Falha ao enviar a reação" }
                        }
                    }
                },

                "/messages/{sessionId}/{jid}/{messageId}/reply": {
                    post: {
                        tags: ["Mensagens"],
                        summary: "Responder a uma mensagem (com citação)",
                        description: "Envia uma resposta citando uma mensagem específica pelo ID. Usa o mesmo formato do `/send`: envie um objeto de mensagem do Baileys.",
                        parameters: [
                            { name: "sessionId", in: "path", required: true, schema: { type: "string" }, example: "sales-01" },
                            { name: "jid", in: "path", required: true, schema: { type: "string" }, example: "5511987654321@s.whatsapp.net" },
                            { name: "messageId", in: "path", required: true, schema: { type: "string" }, description: "ID da mensagem a responder", example: "3EB0ABCD1234567890" }
                        ],
                        requestBody: {
                            required: true,
                            content: {
                                "application/json": {
                                    schema: {
                                        type: "object",
                                        required: ["message"],
                                        properties: {
                                            message: {
                                                type: "object",
                                                description: "Conteúdo da mensagem, no mesmo formato do `/send` (texto, imagem, vídeo etc.)",
                                                example: { text: "Thanks for your message!" }
                                            },
                                            mentions: { type: "array", items: { type: "string" }, example: ["5511987654321@s.whatsapp.net"], description: "JIDs a mencionar" },
                                            fromMe: { type: "boolean", default: false, description: "Indica se a mensagem citada foi enviada por você" }
                                        }
                                    },
                                    examples: {
                                        textReply: {
                                            summary: "Resposta em texto",
                                            value: { message: { text: "Got it, thanks!" } }
                                        },
                                        imageReply: {
                                            summary: "Resposta com imagem",
                                            value: { message: { image: { url: "https://example.com/confirm.jpg" }, caption: "Confirmation image" } }
                                        }
                                    }
                                }
                            }
                        },
                        responses: {
                            200: {
                                description: "Resposta enviada com sucesso",
                                content: {
                                    "application/json": {
                                        schema: {
                                            type: "object",
                                            properties: {
                                                success: { type: "boolean", example: true },
                                                message: { type: "string", example: "Message sent successfully" }
                                            }
                                        }
                                    }
                                }
                            },
                            400: { description: "`message` é obrigatório" },
                            401: { $ref: "#/components/responses/Unauthorized" },
                            403: { $ref: "#/components/responses/Forbidden" },
                            503: { $ref: "#/components/responses/SessionNotReady" },
                            500: { description: "Falha ao enviar a resposta" }
                        }
                    }
                },

                "/messages/{sessionId}/{jid}/reply": {
                    post: {
                        tags: ["Mensagens"],
                        summary: "Responder a uma mensagem (ID no corpo)",
                        description: "Envia uma resposta com citação informando o `messageId` no corpo da requisição. Mesmo formato do `/send`, com o campo `messageId` a mais.",
                        parameters: [
                            { name: "sessionId", in: "path", required: true, schema: { type: "string" }, example: "sales-01" },
                            { name: "jid", in: "path", required: true, schema: { type: "string" }, example: "5511987654321@s.whatsapp.net" }
                        ],
                        requestBody: {
                            required: true,
                            content: {
                                "application/json": {
                                    schema: {
                                        type: "object",
                                        required: ["messageId", "message"],
                                        properties: {
                                            messageId: { type: "string", example: "3EB0ABCD1234567890", description: "ID da mensagem a responder" },
                                            message: {
                                                type: "object",
                                                description: "Conteúdo da mensagem, no mesmo formato do `/send` (texto, imagem, vídeo etc.)",
                                                example: { text: "Sure, let me help you!" }
                                            },
                                            mentions: { type: "array", items: { type: "string" }, description: "JIDs a mencionar" },
                                            fromMe: { type: "boolean", default: false, description: "Indica se a mensagem citada foi enviada por você" }
                                        }
                                    },
                                    example: {
                                        messageId: "3EB0ABCD1234567890",
                                        message: { text: "Sure, let me check that for you!" }
                                    }
                                }
                            }
                        },
                        responses: {
                            200: {
                                description: "Resposta enviada com sucesso",
                                content: { "application/json": { schema: { $ref: "#/components/schemas/Success" } } }
                            },
                            400: { description: "`messageId` e `message` são obrigatórios" },
                            401: { $ref: "#/components/responses/Unauthorized" },
                            403: { $ref: "#/components/responses/Forbidden" },
                            503: { $ref: "#/components/responses/SessionNotReady" },
                            500: { description: "Falha ao enviar a resposta" }
                        }
                    }
                },

                "/messages/{sessionId}/{jid}/{messageId}/star": {
                    post: {
                        tags: ["Mensagens"],
                        summary: "Favoritar ou desfavoritar mensagem",
                        description: "Marca uma mensagem com estrela (favorita) ou remove a estrela. As mensagens favoritas aparecem na seção \"Mensagens favoritas\" do WhatsApp.",
                        parameters: [
                            { name: "sessionId", in: "path", required: true, schema: { type: "string" } },
                            { name: "jid", in: "path", required: true, schema: { type: "string" } },
                            { name: "messageId", in: "path", required: true, schema: { type: "string" } }
                        ],
                        requestBody: {
                            content: {
                                "application/json": {
                                    schema: {
                                        type: "object",
                                        properties: {
                                            star: { type: "boolean", example: true, default: true, description: "`true` para favoritar, `false` para desfavoritar" },
                                            fromMe: { type: "boolean", example: false, default: false, description: "Indica se a mensagem foi enviada por você" }
                                        }
                                    },
                                    examples: {
                                        star: { summary: "Favoritar mensagem", value: { star: true } },
                                        unstar: { summary: "Desfavoritar mensagem", value: { star: false } }
                                    }
                                }
                            }
                        },
                        responses: {
                            200: {
                                description: "Estrela atualizada",
                                content: {
                                    "application/json": {
                                        schema: {
                                            type: "object",
                                            properties: {
                                                success: { type: "boolean", example: true },
                                                message: { type: "string", example: "Message starred" }
                                            }
                                        }
                                    }
                                }
                            },
                            401: { $ref: "#/components/responses/Unauthorized" },
                            403: { $ref: "#/components/responses/Forbidden" },
                            503: { $ref: "#/components/responses/SessionNotReady" },
                            500: { description: "Falha ao favoritar/desfavoritar a mensagem" }
                        }
                    }
                },

                "/messages/{sessionId}/search": {
                    get: {
                        tags: ["Mensagens"],
                        summary: "Buscar mensagens",
                        description: "Busca as mensagens da sessão salvas no banco. Aceita busca em texto e filtros por JID, tipo e remetente.",
                        parameters: [
                            { name: "sessionId", in: "path", required: true, schema: { type: "string" }, example: "sales-01" },
                            { name: "q", in: "query", schema: { type: "string" }, example: "invoice", description: "Texto a procurar no conteúdo das mensagens" },
                            { name: "jid", in: "query", schema: { type: "string" }, example: "5511987654321@s.whatsapp.net", description: "Filtrar pelo JID da conversa" },
                            { name: "type", in: "query", schema: { type: "string", enum: ["TEXT", "IMAGE", "VIDEO", "AUDIO", "DOCUMENT", "STICKER", "LOCATION", "CONTACT"] }, description: "Filtrar pelo tipo de mensagem" },
                            { name: "fromMe", in: "query", schema: { type: "boolean" }, description: "Filtrar pelo remetente (`true` = enviadas, `false` = recebidas)" },
                            { name: "page", in: "query", schema: { type: "integer", default: 1, minimum: 1 } },
                            { name: "limit", in: "query", schema: { type: "integer", default: 20, maximum: 100 } }
                        ],
                        responses: {
                            200: {
                                description: "Resultados da busca",
                                content: {
                                    "application/json": {
                                        schema: {
                                            type: "object",
                                            properties: {
                                                success: { type: "boolean", example: true },
                                                data: {
                                                    type: "array",
                                                    items: {
                                                        type: "object",
                                                        properties: {
                                                            id: { type: "string" },
                                                            remoteJid: { type: "string" },
                                                            fromMe: { type: "boolean" },
                                                            keyId: { type: "string" },
                                                            pushName: { type: "string" },
                                                            type: { type: "string" },
                                                            content: { type: "string" },
                                                            status: { type: "string" },
                                                            timestamp: { type: "string", format: "date-time" },
                                                            quoteId: { type: "string", nullable: true }
                                                        }
                                                    }
                                                },
                                                pagination: {
                                                    type: "object",
                                                    properties: {
                                                        total: { type: "integer" },
                                                        page: { type: "integer" },
                                                        limit: { type: "integer" },
                                                        pages: { type: "integer" }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            },
                            400: { description: "`q` ou `jid` é obrigatório" },
                            401: { $ref: "#/components/responses/Unauthorized" },
                            403: { $ref: "#/components/responses/Forbidden" },
                            404: { description: "Sessão não encontrada" },
                            500: { description: "Falha ao buscar mensagens" }
                        }
                    }
                },

                "/messages/{sessionId}/{jid}/list": {
                    post: {
                        tags: ["Mensagens"],
                        summary: "Enviar mensagem em lista",
                        description: "Envia uma mensagem formatada como lista numerada",
                        parameters: [
                            { name: "sessionId", in: "path", required: true, schema: { type: "string" } },
                            { name: "jid", in: "path", required: true, schema: { type: "string" } }
                        ],
                        requestBody: {
                            content: {
                                "application/json": {
                                    schema: {
                                        type: "object",
                                        required: ["title", "options"],
                                        properties: {
                                            title: { type: "string", example: "Our Services" },
                                            options: { type: "array", items: { type: "string" }, example: ["Web Dev", "App Dev", "UI/UX"] },
                                            footer: { type: "string", example: "Choose one" }
                                        }
                                    }
                                }
                            }
                        },
                        responses: {
                            200: { description: "Mensagem enviada", content: { "application/json": { schema: { type: "object", properties: { success: { type: "boolean", example: true } } } } } },
                            401: { $ref: "#/components/responses/Unauthorized" },
                            403: { $ref: "#/components/responses/Forbidden" },
                            503: { $ref: "#/components/responses/SessionNotReady" },
                            500: { description: "Falha ao enviar a mensagem" }
                        }
                    }
                },

                "/messages/{sessionId}/{jid}/spam": {
                    post: {
                        tags: ["Mensagens"],
                        summary: "Envio repetido (spam)",
                        description: "Envia a mesma mensagem várias vezes seguidas, em segundo plano. Use com cuidado: envios repetidos aumentam o risco de banimento da conta.",
                        parameters: [
                            { name: "sessionId", in: "path", required: true, schema: { type: "string" } },
                            { name: "jid", in: "path", required: true, schema: { type: "string" } }
                        ],
                        requestBody: {
                            content: {
                                "application/json": {
                                    schema: {
                                        type: "object",
                                        required: ["message"],
                                        properties: {
                                            message: { type: "string", example: "Check our new catalog!" },
                                            count: { type: "integer", default: 10, example: 5 },
                                            delay: { type: "integer", default: 500, example: 1000, description: "Intervalo em ms" }
                                        }
                                    }
                                }
                            }
                        },
                        responses: {
                            200: { description: "Envio repetido iniciado", content: { "application/json": { schema: { type: "object", properties: { success: { type: "boolean", example: true }, message: { type: "string" } } } } } },
                            401: { $ref: "#/components/responses/Unauthorized" },
                            403: { $ref: "#/components/responses/Forbidden" },
                            503: { $ref: "#/components/responses/SessionNotReady" },
                            500: { description: "Falha ao iniciar o envio repetido" }
                        }
                    }
                },

                "/messages/{sessionId}/{jid}/sticker": {
                    post: {
                        tags: ["Mensagens"],
                        summary: "Enviar figurinha",
                        description: "Converte uma imagem em figurinha e a envia",
                        parameters: [
                            { name: "sessionId", in: "path", required: true, schema: { type: "string" } },
                            { name: "jid", in: "path", required: true, schema: { type: "string" } }
                        ],
                        requestBody: {
                            content: {
                                "multipart/form-data": {
                                    schema: {
                                        type: "object",
                                        required: ["file"],
                                        properties: {
                                            file: { type: "string", format: "binary" },
                                            pack: { type: "string", description: "Nome do pacote de figurinhas (padrão: W-AZAP)" },
                                            author: { type: "string", description: "Nome do autor da figurinha (padrão: User)" },
                                            type: { type: "string", enum: ["full", "crop", "circle"], description: "Tipo de recorte da figurinha (padrão: full)" },
                                            quality: { type: "integer", minimum: 1, maximum: 100, description: "Qualidade da imagem (padrão: 50)" }
                                        }
                                    }
                                }
                            }
                        },
                        responses: {
                            200: { description: "Figurinha enviada", content: { "application/json": { schema: { type: "object", properties: { success: { type: "boolean", example: true } } } } } },
                            401: { $ref: "#/components/responses/Unauthorized" },
                            403: { $ref: "#/components/responses/Forbidden" },
                            503: { $ref: "#/components/responses/SessionNotReady" },
                            500: { description: "Falha ao criar a figurinha" }
                        }
                    }
                },

                "/messages/{sessionId}/forward": {
                    post: {
                        tags: ["Mensagens"],
                        summary: "Encaminhar mensagem",
                        description: "Encaminha uma mensagem para uma ou mais conversas",
                        parameters: [
                            { name: "sessionId", in: "path", required: true, schema: { type: "string" } }
                        ],
                        requestBody: {
                            content: {
                                "application/json": {
                                    schema: {
                                        type: "object",
                                        required: ["fromJid", "messageId", "toJids"],
                                        properties: {
                                            fromJid: { type: "string", description: "JID da conversa de origem", example: "5511987654321@s.whatsapp.net" },
                                            messageId: { type: "string", example: "3EB0ABCD1234567890" },
                                            toJids: {
                                                type: "array",
                                                items: { type: "string" },
                                                description: "JIDs dos destinatários",
                                                example: ["5521912345678@s.whatsapp.net"]
                                            }
                                        }
                                    }
                                }
                            }
                        },
                        responses: {
                            200: { description: "Mensagem encaminhada", content: { "application/json": { schema: { type: "object", properties: { success: { type: "boolean", example: true }, message: { type: "string" } } } } } },
                            401: { $ref: "#/components/responses/Unauthorized" },
                            403: { $ref: "#/components/responses/Forbidden" },
                            503: { $ref: "#/components/responses/SessionNotReady" },
                            500: { description: "Falha ao encaminhar a mensagem" }
                        }
                    }
                },
                "/messages/{sessionId}/{jid}/{messageId}": {
                    delete: {
                        tags: ["Mensagens"],
                        summary: "Apagar mensagem para todos",
                        description: "Apaga a mensagem para todos (o WhatsApp só permite em mensagens recentes)",
                        parameters: [
                            { name: "sessionId", in: "path", required: true, schema: { type: "string" } },
                            { name: "jid", in: "path", required: true, schema: { type: "string" } },
                            { name: "messageId", in: "path", required: true, schema: { type: "string" } }
                        ],
                        responses: {
                            200: {
                                description: "Mensagem apagada",
                                content: {
                                    "application/json": {
                                        schema: {
                                            type: "object",
                                            properties: {
                                                success: { type: "boolean", example: true },
                                                message: { type: "string", example: "Message deleted for everyone" }
                                            }
                                        }
                                    }
                                }
                            },
                            401: { $ref: "#/components/responses/Unauthorized" },
                            403: { $ref: "#/components/responses/Forbidden" },
                            503: { $ref: "#/components/responses/SessionNotReady" },
                            500: { description: "Falha ao apagar a mensagem" }
                        }
                    },
                    patch: {
                        tags: ["Mensagens"],
                        summary: "Editar mensagem enviada",
                        description: "Edita o texto de uma mensagem já enviada",
                        parameters: [
                            { name: "sessionId", in: "path", required: true, schema: { type: "string" } },
                            { name: "jid", in: "path", required: true, schema: { type: "string" } },
                            { name: "messageId", in: "path", required: true, schema: { type: "string" } }
                        ],
                        requestBody: {
                            required: true,
                            content: {
                                "application/json": {
                                    schema: {
                                        type: "object",
                                        required: ["text"],
                                        properties: {
                                            text: { type: "string", example: "Updated text message" }
                                        }
                                    }
                                }
                            }
                        },
                        responses: {
                            200: {
                                description: "Mensagem editada",
                                content: {
                                    "application/json": {
                                        schema: {
                                            type: "object",
                                            properties: {
                                                status: { type: "boolean", example: true },
                                                message: { type: "string", example: "Message edited successfully" }
                                            }
                                        }
                                    }
                                }
                            },
                            400: { description: "Requisição inválida" },
                            401: { $ref: "#/components/responses/Unauthorized" },
                            403: { $ref: "#/components/responses/Forbidden" },
                            503: { $ref: "#/components/responses/SessionNotReady" },
                            500: { description: "Falha ao editar a mensagem" }
                        }
                    }
                },

                // ==================== CHAT MANAGEMENT ====================
                "/chat/{sessionId}": {
                    get: {
                        tags: ["Chat"],
                        summary: "Listar conversas",
                        description: "Lista as conversas da sessão com a última mensagem de cada uma",
                        parameters: [
                            { name: "sessionId", in: "path", required: true, schema: { type: "string" } }
                        ],
                        responses: {
                            200: {
                                description: "Lista de conversas",
                                content: {
                                    "application/json": {
                                        schema: {
                                            type: "array",
                                            items: { $ref: "#/components/schemas/Contact" }
                                        }
                                    }
                                }
                            }
                        }
                    }
                },

                "/chat/{sessionId}/{jid}": {
                    get: {
                        tags: ["Chat"],
                        summary: "Histórico de mensagens",
                        description: "Busca até 100 mensagens de uma conversa (com dados dos participantes, em grupos)",
                        parameters: [
                            { name: "sessionId", in: "path", required: true, schema: { type: "string" } },
                            { name: "jid", in: "path", required: true, schema: { type: "string" }, description: "JID codificado para URL" }
                        ],
                        responses: { 200: { description: "Histórico de mensagens (máx. 100)" } }
                    }
                },

                "/chat/{sessionId}/{jid}/read": {
                    put: {
                        tags: ["Chat"],
                        summary: "Marcar mensagens como lidas",
                        description: "Marca mensagens específicas, ou a conversa inteira, como lidas",
                        parameters: [
                            { name: "sessionId", in: "path", required: true, schema: { type: "string" }, description: "Identificador da sessão" },
                            { name: "jid", in: "path", required: true, schema: { type: "string" }, description: "JID do WhatsApp codificado para URL" }
                        ],
                        requestBody: {
                            content: {
                                "application/json": {
                                    schema: {
                                        type: "object",
                                        properties: {
                                            messageIds: {
                                                type: "array",
                                                items: { type: "string" },
                                                description: "Opcional: IDs das mensagens a marcar como lidas. Se omitido, marca a conversa inteira"
                                            }
                                        }
                                    }
                                }
                            }
                        },
                        responses: {
                            200: {
                                description: "Mensagens marcadas como lidas",
                                content: {
                                    "application/json": {
                                        schema: {
                                            type: "object",
                                            properties: {
                                                success: { type: "boolean", example: true },
                                                message: { type: "string", example: "Messages marked as read" }
                                            }
                                        }
                                    }
                                }
                            },
                            401: { $ref: "#/components/responses/Unauthorized" },
                            403: { $ref: "#/components/responses/Forbidden" },
                            503: { $ref: "#/components/responses/SessionNotReady" },
                            500: { description: "Falha ao marcar as mensagens como lidas" }
                        }
                    }
                },

                "/chat/{sessionId}/{jid}/archive": {
                    put: {
                        tags: ["Chat"],
                        summary: "Arquivar/desarquivar conversa",
                        description: "Arquiva ou desarquiva uma conversa",
                        parameters: [
                            { name: "sessionId", in: "path", required: true, schema: { type: "string" } },
                            { name: "jid", in: "path", required: true, schema: { type: "string" }, description: "JID codificado para URL" }
                        ],
                        requestBody: {
                            content: {
                                "application/json": {
                                    schema: {
                                        type: "object",
                                        required: ["archive"],
                                        properties: {
                                            archive: { type: "boolean", description: "`true` para arquivar, `false` para desarquivar" }
                                        }
                                    }
                                }
                            }
                        },
                        responses: {
                            200: {
                                description: "Conversa arquivada/desarquivada",
                                content: {
                                    "application/json": {
                                        schema: {
                                            type: "object",
                                            properties: {
                                                success: { type: "boolean", example: true },
                                                message: { type: "string", example: "Chat archived" }
                                            }
                                        }
                                    }
                                }
                            },
                            400: { description: "Campos obrigatórios ausentes" },
                            401: { $ref: "#/components/responses/Unauthorized" },
                            403: { $ref: "#/components/responses/Forbidden" },
                            503: { $ref: "#/components/responses/SessionNotReady" },
                            500: { description: "Falha ao arquivar/desarquivar a conversa" }
                        }
                    }
                },

                "/chat/{sessionId}/{jid}/mute": {
                    put: {
                        tags: ["Chat"],
                        summary: "Silenciar/reativar conversa",
                        description: "Silencia a conversa por um tempo opcional (padrão: 8 horas)",
                        parameters: [
                            { name: "sessionId", in: "path", required: true, schema: { type: "string" } },
                            { name: "jid", in: "path", required: true, schema: { type: "string" }, description: "JID codificado para URL" }
                        ],
                        requestBody: {
                            content: {
                                "application/json": {
                                    schema: {
                                        type: "object",
                                        required: ["mute"],
                                        properties: {
                                            mute: { type: "boolean" },
                                            duration: { type: "integer", description: "Duração em segundos (padrão: 8 horas)", example: 3600 }
                                        }
                                    }
                                }
                            }
                        },
                        responses: {
                            200: {
                                description: "Conversa silenciada/reativada",
                                content: {
                                    "application/json": {
                                        schema: {
                                            type: "object",
                                            properties: {
                                                success: { type: "boolean", example: true },
                                                message: { type: "string", example: "Chat muted" }
                                            }
                                        }
                                    }
                                }
                            },
                            400: { description: "Campos obrigatórios ausentes" },
                            401: { $ref: "#/components/responses/Unauthorized" },
                            403: { $ref: "#/components/responses/Forbidden" },
                            503: { $ref: "#/components/responses/SessionNotReady" },
                            500: { description: "Falha ao silenciar/reativar a conversa" }
                        }
                    }
                },

                "/chat/{sessionId}/{jid}/pin": {
                    put: {
                        tags: ["Chat"],
                        summary: "Fixar/desafixar conversa",
                        description: "Fixa ou desafixa uma conversa",
                        parameters: [
                            { name: "sessionId", in: "path", required: true, schema: { type: "string" } },
                            { name: "jid", in: "path", required: true, schema: { type: "string" }, description: "JID codificado para URL" }
                        ],
                        requestBody: {
                            content: {
                                "application/json": {
                                    schema: {
                                        type: "object",
                                        required: ["pin"],
                                        properties: {
                                            pin: { type: "boolean" }
                                        }
                                    }
                                }
                            }
                        },
                        responses: {
                            200: {
                                description: "Conversa fixada/desafixada",
                                content: {
                                    "application/json": {
                                        schema: {
                                            type: "object",
                                            properties: {
                                                success: { type: "boolean", example: true },
                                                message: { type: "string", example: "Chat pinned" }
                                            }
                                        }
                                    }
                                }
                            },
                            400: { description: "Campos obrigatórios ausentes" },
                            401: { $ref: "#/components/responses/Unauthorized" },
                            403: { $ref: "#/components/responses/Forbidden" },
                            503: { $ref: "#/components/responses/SessionNotReady" },
                            500: { description: "Falha ao fixar/desafixar a conversa" }
                        }
                    }
                },

                "/chat/{sessionId}/{jid}/presence": {
                    post: {
                        tags: ["Chat"],
                        summary: "Enviar presença (digitando/gravando)",
                        description: "Envia um status de presença (digitando, gravando, online etc.) para uma conversa",
                        parameters: [
                            { name: "sessionId", in: "path", required: true, schema: { type: "string" } },
                            { name: "jid", in: "path", required: true, schema: { type: "string" }, description: "JID codificado para URL" }
                        ],
                        requestBody: {
                            content: {
                                "application/json": {
                                    schema: {
                                        type: "object",
                                        required: ["presence"],
                                        properties: {
                                            presence: {
                                                type: "string",
                                                enum: ["composing", "recording", "paused", "available", "unavailable"],
                                                example: "composing"
                                            }
                                        }
                                    }
                                }
                            }
                        },
                        responses: {
                            200: {
                                description: "Presença enviada",
                                content: {
                                    "application/json": {
                                        schema: {
                                            type: "object",
                                            properties: {
                                                success: { type: "boolean", example: true },
                                                message: { type: "string", example: "Presence 'composing' sent to 5511987654321@s.whatsapp.net" }
                                            }
                                        }
                                    }
                                }
                            },
                            400: { description: "Campos obrigatórios ausentes ou presença inválida" },
                            401: { $ref: "#/components/responses/Unauthorized" },
                            403: { $ref: "#/components/responses/Forbidden" },
                            503: { $ref: "#/components/responses/SessionNotReady" },
                            500: { description: "Falha ao enviar a presença" }
                        }
                    }
                },

                "/chat/{sessionId}/{jid}/profile-picture": {
                    post: {
                        tags: ["Chat"],
                        summary: "Obter a foto de perfil",
                        description: "Obtém a URL da foto de perfil de um contato ou grupo",
                        parameters: [
                            { name: "sessionId", in: "path", required: true, schema: { type: "string" } },
                            { name: "jid", in: "path", required: true, schema: { type: "string" }, description: "JID codificado para URL" }
                        ],
                        responses: {
                            200: {
                                description: "URL da foto de perfil",
                                content: {
                                    "application/json": {
                                        schema: {
                                            type: "object",
                                            properties: {
                                                success: { type: "boolean", example: true },
                                                jid: { type: "string", example: "5511987654321@s.whatsapp.net" },
                                                profilePicUrl: { type: "string", nullable: true, example: "https://pps.whatsapp.net/..." },
                                                message: { type: "string", example: "No profile picture found" }
                                            }
                                        }
                                    }
                                }
                            },
                            401: { $ref: "#/components/responses/Unauthorized" },
                            403: { $ref: "#/components/responses/Forbidden" },
                            503: { $ref: "#/components/responses/SessionNotReady" },
                            500: { description: "Falha ao obter a foto de perfil" }
                        }
                    }
                },

                "/chat/{sessionId}/check": {
                    post: {
                        tags: ["Chat"],
                        summary: "Verificar números no WhatsApp",
                        description: "Verifica se os números têm WhatsApp (máx. 50 por requisição)",
                        parameters: [
                            { name: "sessionId", in: "path", required: true, schema: { type: "string" } }
                        ],
                        requestBody: {
                            content: {
                                "application/json": {
                                    schema: {
                                        type: "object",
                                        required: ["numbers"],
                                        properties: {
                                            numbers: {
                                                type: "array",
                                                items: { type: "string" },
                                                maxItems: 50,
                                                example: ["5511987654321", "5521912345678"]
                                            }
                                        }
                                    }
                                }
                            }
                        },
                        responses: {
                            200: {
                                description: "Resultado da verificação",
                                content: {
                                    "application/json": {
                                        schema: {
                                            type: "object",
                                            properties: {
                                                success: { type: "boolean" },
                                                results: {
                                                    type: "array",
                                                    items: {
                                                        type: "object",
                                                        properties: {
                                                            number: { type: "string" },
                                                            exists: { type: "boolean" },
                                                            jid: { type: "string", nullable: true },
                                                            error: { type: "string", nullable: true }
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            },
                            400: { description: "Campos obrigatórios ausentes" },
                            401: { $ref: "#/components/responses/Unauthorized" },
                            403: { $ref: "#/components/responses/Forbidden" },
                            503: { $ref: "#/components/responses/SessionNotReady" },
                            500: { description: "Falha ao verificar os números" }
                        }
                    }
                },

                // ==================== GROUPS ====================
                "/groups/{sessionId}": {
                    get: {
                        tags: ["Grupos"],
                        summary: "Listar grupos",
                        description: "Lista todos os grupos de que a sessão participa",
                        parameters: [
                            { name: "sessionId", in: "path", required: true, schema: { type: "string" } }
                        ],
                        responses: {
                            200: { description: "Lista de grupos", content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/Group" } } } } },
                            401: { $ref: "#/components/responses/Unauthorized" },
                            403: { $ref: "#/components/responses/Forbidden" },
                            404: { $ref: "#/components/responses/NotFound" },
                            500: { description: "Falha ao obter os grupos" }
                        }
                    }
                },

                "/groups/{sessionId}/create": {
                    post: {
                        tags: ["Grupos"],
                        summary: "Criar grupo",
                        description: "Cria um grupo com os participantes informados",
                        parameters: [
                            { name: "sessionId", in: "path", required: true, schema: { type: "string" } }
                        ],
                        requestBody: {
                            content: {
                                "application/json": {
                                    schema: {
                                        type: "object",
                                        required: ["subject", "participants"],
                                        properties: {
                                            subject: { type: "string", maxLength: 100, example: "VIP Customers" },
                                            participants: {
                                                type: "array",
                                                items: { type: "string" },
                                                example: ["5511987654321@s.whatsapp.net"]
                                            }
                                        }
                                    }
                                }
                            }
                        },
                        responses: {
                            200: { description: "Grupo criado", content: { "application/json": { schema: { type: "object", properties: { success: { type: "boolean", example: true }, group: { $ref: "#/components/schemas/Group" } } } } } },
                            401: { $ref: "#/components/responses/Unauthorized" },
                            403: { $ref: "#/components/responses/Forbidden" },
                            503: { $ref: "#/components/responses/SessionNotReady" },
                            500: { description: "Falha ao criar o grupo" }
                        }
                    }
                },

                "/groups/{sessionId}/{jid}/subject": {
                    put: {
                        tags: ["Grupos"],
                        summary: "Alterar o nome do grupo",
                        parameters: [
                            { name: "sessionId", in: "path", required: true, schema: { type: "string" } },
                            { name: "jid", in: "path", required: true, schema: { type: "string" } }
                        ],
                        requestBody: {
                            content: {
                                "application/json": {
                                    schema: {
                                        type: "object",
                                        required: ["subject"],
                                        properties: {
                                            subject: { type: "string", maxLength: 100 }
                                        }
                                    }
                                }
                            }
                        },
                        responses: {
                            200: { description: "Nome alterado", content: { "application/json": { schema: { type: "object", properties: { success: { type: "boolean", example: true }, message: { type: "string" }, subject: { type: "string" } } } } } },
                            401: { $ref: "#/components/responses/Unauthorized" },
                            403: { $ref: "#/components/responses/Forbidden" },
                            400: { description: "Nome inválido" },
                            500: { description: "Falha ao alterar o nome" }
                        }
                    }
                },

                "/groups/{sessionId}/{jid}/members": {
                    put: {
                        tags: ["Grupos"],
                        summary: "Gerenciar participantes",
                        parameters: [
                            { name: "sessionId", in: "path", required: true, schema: { type: "string" } },
                            { name: "jid", in: "path", required: true, schema: { type: "string" } }
                        ],
                        requestBody: {
                            content: {
                                "application/json": {
                                    schema: {
                                        type: "object",
                                        required: ["action", "participants"],
                                        properties: {
                                            action: { type: "string", enum: ["add", "remove", "promote", "demote"] },
                                            participants: { type: "array", items: { type: "string" } }
                                        }
                                    }
                                }
                            }
                        },
                        responses: {
                            200: { description: "Participantes atualizados", content: { "application/json": { schema: { type: "object", properties: { success: { type: "boolean", example: true }, message: { type: "string" }, result: { type: "array", items: { type: "object" } } } } } } },
                            401: { $ref: "#/components/responses/Unauthorized" },
                            403: { $ref: "#/components/responses/Forbidden" },
                            400: { description: "Ação inválida" },
                            500: { description: "Falha ao atualizar os participantes" }
                        }
                    }
                },

                "/groups/{sessionId}/{jid}/invite": {
                    "put": {
                        "tags": [
                            "Grupos"
                        ],
                        "summary": "Update or revoke group invite link",
                        "parameters": [
                            {
                                "name": "sessionId",
                                "in": "path",
                                "required": true,
                                "schema": {
                                    "type": "string"
                                }
                            },
                            {
                                "name": "jid",
                                "in": "path",
                                "required": true,
                                "schema": {
                                    "type": "string"
                                }
                            }
                        ],
                        "responses": {
                            "200": {
                                "description": "Group invite updated"
                            }
                        }
                    }
                    ,
                    get: {
                        tags: ["Grupos"],
                        summary: "Obter o link de convite",
                        parameters: [
                            { name: "sessionId", in: "path", required: true, schema: { type: "string" } },
                            { name: "jid", in: "path", required: true, schema: { type: "string" } }
                        ],
                        responses: {
                            200: { description: "Código de convite", content: { "application/json": { schema: { type: "object", properties: { success: { type: "boolean", example: true }, inviteCode: { type: "string" }, inviteUrl: { type: "string" } } } } } },
                            401: { $ref: "#/components/responses/Unauthorized" },
                            403: { $ref: "#/components/responses/Forbidden" },
                            500: { description: "Falha ao obter o código" }
                        }
                    },
                    put: {
                        tags: ["Grupos"],
                        summary: "Revogar o link de convite",
                        parameters: [
                            { name: "sessionId", in: "path", required: true, schema: { type: "string" } },
                            { name: "jid", in: "path", required: true, schema: { type: "string" } }
                        ],
                        responses: {
                            200: { description: "Convite revogado", content: { "application/json": { schema: { type: "object", properties: { success: { type: "boolean", example: true }, message: { type: "string" }, newInviteCode: { type: "string" }, inviteUrl: { type: "string" } } } } } },
                            401: { $ref: "#/components/responses/Unauthorized" },
                            403: { $ref: "#/components/responses/Forbidden" },
                            500: { description: "Falha ao revogar o convite" }
                        }
                    }
                },



                // ==================== CONTACTS ====================

                // ==================== PROFILE ====================
                "/profile/{sessionId}": {
                    get: {
                        tags: ["Perfil"],
                        summary: "Obter o próprio perfil",
                        description: "Obtém os dados de perfil da conta do WhatsApp conectada",
                        parameters: [
                            { name: "sessionId", in: "path", required: true, schema: { type: "string" } }
                        ],
                        responses: {
                            200: {
                                description: "Dados do perfil",
                                content: {
                                    "application/json": {
                                        schema: {
                                            type: "object",
                                            properties: {
                                                success: { type: "boolean" },
                                                jid: { type: "string" },
                                                status: { type: "object" }
                                            }
                                        }
                                    }
                                }
                            },
                            401: { $ref: "#/components/responses/Unauthorized" },
                            403: { $ref: "#/components/responses/Forbidden" },
                            503: { $ref: "#/components/responses/SessionNotReady" }
                        }
                    }
                },
                "/profile/{sessionId}/name": {
                    put: {
                        tags: ["Perfil"],
                        summary: "Alterar o nome de exibição",
                        description: "Altera o nome de exibição no WhatsApp (máx. 25 caracteres)",
                        parameters: [
                            { name: "sessionId", in: "path", required: true, schema: { type: "string" } }
                        ],
                        requestBody: {
                            content: {
                                "application/json": {
                                    schema: {
                                        type: "object",
                                        required: ["name"],
                                        properties: {
                                            name: { type: "string", maxLength: 25 }
                                        }
                                    }
                                }
                            }
                        },
                        responses: {
                            200: { description: "Nome alterado", content: { "application/json": { schema: { $ref: "#/components/schemas/Success" } } } },
                            401: { $ref: "#/components/responses/Unauthorized" },
                            403: { $ref: "#/components/responses/Forbidden" },
                            503: { $ref: "#/components/responses/SessionNotReady" }
                        }
                    }
                },
                "/profile/{sessionId}/status": {
                    put: {
                        tags: ["Perfil"],
                        summary: "Alterar o recado",
                        description: "Altera o recado (\"sobre\") do WhatsApp (máx. 139 caracteres)",
                        parameters: [
                            { name: "sessionId", in: "path", required: true, schema: { type: "string" } }
                        ],
                        requestBody: {
                            content: {
                                "application/json": {
                                    schema: {
                                        type: "object",
                                        required: ["status"],
                                        properties: {
                                            status: { type: "string", maxLength: 139 }
                                        }
                                    }
                                }
                            }
                        },
                        responses: {
                            200: { description: "Recado alterado", content: { "application/json": { schema: { $ref: "#/components/schemas/Success" } } } },
                            401: { $ref: "#/components/responses/Unauthorized" },
                            403: { $ref: "#/components/responses/Forbidden" },
                            503: { $ref: "#/components/responses/SessionNotReady" }
                        }
                    }
                },
                "/profile/{sessionId}/picture": {
                    "delete": {
                        "tags": [
                            "Perfil"
                        ],
                        "summary": "Remover a foto de perfil",
                        "parameters": [
                            {
                                "name": "sessionId",
                                "in": "path",
                                "required": true,
                                "schema": {
                                    "type": "string"
                                }
                            }
                        ],
                        "responses": {
                            "200": {
                                "description": "Profile picture removed"
                            }
                        }
                    }
                    ,
                    put: {
                        tags: ["Perfil"],
                        summary: "Alterar a foto de perfil",
                        description: "Envia uma nova foto de perfil",
                        parameters: [
                            { name: "sessionId", in: "path", required: true, schema: { type: "string" } }
                        ],
                        requestBody: {
                            content: {
                                "multipart/form-data": {
                                    schema: {
                                        type: "object",
                                        required: ["file"],
                                        properties: {
                                            file: { type: "string", format: "binary" }
                                        }
                                    }
                                }
                            }
                        },
                        responses: {
                            200: { description: "Foto alterada", content: { "application/json": { schema: { $ref: "#/components/schemas/Success" } } } },
                            401: { $ref: "#/components/responses/Unauthorized" },
                            403: { $ref: "#/components/responses/Forbidden" },
                            503: { $ref: "#/components/responses/SessionNotReady" }
                        }
                    },
                    delete: {
                        tags: ["Perfil"],
                        summary: "Remover a foto de perfil",
                        parameters: [
                            { name: "sessionId", in: "path", required: true, schema: { type: "string" } }
                        ],
                        responses: {
                            200: { description: "Foto removida", content: { "application/json": { schema: { $ref: "#/components/schemas/Success" } } } },
                            401: { $ref: "#/components/responses/Unauthorized" },
                            403: { $ref: "#/components/responses/Forbidden" },
                            503: { $ref: "#/components/responses/SessionNotReady" }
                        }
                    }
                },

                // ==================== AUTO REPLY ====================
                "/autoreplies/{sessionId}": {
                    "delete": {
                        "tags": [
                            "Respostas automáticas"
                        ],
                        "summary": "Excluir todas as respostas automáticas",
                        "parameters": [
                            {
                                "name": "sessionId",
                                "in": "path",
                                "required": true,
                                "schema": {
                                    "type": "string"
                                }
                            }
                        ],
                        "responses": {
                            "200": {
                                "description": "Respostas automáticas excluídas"
                            }
                        }
                    }
                    ,
                    get: {
                        tags: ["Respostas automáticas"],
                        summary: "Listar respostas automáticas",
                        parameters: [
                            { name: "sessionId", in: "path", required: true, schema: { type: "string" } }
                        ],
                        responses: {
                            200: { description: "Lista de regras de resposta automática" },
                            401: { $ref: "#/components/responses/Unauthorized" },
                            403: { $ref: "#/components/responses/Forbidden" },
                            404: { description: "Sessão não encontrada" }
                        }
                    },
                    post: {
                        tags: ["Respostas automáticas"],
                        summary: "Criar resposta automática",
                        parameters: [
                            { name: "sessionId", in: "path", required: true, schema: { type: "string" } }
                        ],
                        requestBody: {
                            content: {
                                "application/json": {
                                    schema: {
                                        type: "object",
                                        required: ["keyword"],
                                        properties: {
                                            keyword: { type: "string" },
                                            response: { type: "string" },
                                            matchType: { type: "string", enum: ["EXACT", "CONTAINS", "STARTS_WITH", "REGEX"] },
                                            isMedia: { type: "boolean" },
                                            mediaUrl: { type: "string" },
                                            mediaType: { type: "string", enum: ["image", "video", "document", "audio"] },
                                            triggerType: { type: "string", enum: ["ALL", "GROUP", "PRIVATE"] }
                                        }
                                    },
                                    example: {
                                        keyword: "hello",
                                        response: "Hi there! How can I help?",
                                        matchType: "EXACT",
                                        triggerType: "ALL",
                                        isMedia: false,
                                        mediaUrl: null,
                                        mediaType: null
                                    }
                                }
                            }
                        },
                        responses: {
                            200: { description: "Regra criada" },
                            400: { description: "Campos obrigatórios ausentes" },
                            401: { $ref: "#/components/responses/Unauthorized" },
                            403: { $ref: "#/components/responses/Forbidden" }
                        }
                    }
                },
                "/autoreplies/{sessionId}/{replyId}": {
                    "delete": {
                        "tags": [
                            "Respostas automáticas"
                        ],
                        "summary": "Delete a specific autoreply",
                        "parameters": [
                            {
                                "name": "sessionId",
                                "in": "path",
                                "required": true,
                                "schema": {
                                    "type": "string"
                                }
                            },
                            {
                                "name": "replyId",
                                "in": "path",
                                "required": true,
                                "schema": {
                                    "type": "string"
                                }
                            }
                        ],
                        "responses": {
                            "200": {
                                "description": "Autoreply deleted"
                            }
                        }
                    }
                    ,
                    put: {
                        tags: ["Respostas automáticas"],
                        summary: "Atualizar resposta automática",
                        parameters: [
                            { name: "sessionId", in: "path", required: true, schema: { type: "string" } },
                            { name: "replyId", in: "path", required: true, schema: { type: "string" } }
                        ],
                        requestBody: {
                            content: {
                                "application/json": {
                                    schema: {
                                        type: "object",
                                        required: ["keyword"],
                                        properties: {
                                            keyword: { type: "string" },
                                            response: { type: "string" },
                                            isMedia: { type: "boolean" },
                                            mediaUrl: { type: "string" },
                                            mediaType: { type: "string", enum: ["image", "video", "document", "audio"] },
                                            triggerType: { type: "string", enum: ["ALL", "GROUP", "PRIVATE"] }
                                        }
                                    },
                                    example: {
                                        keyword: "hello",
                                        response: "Hi there! How can I help?",
                                        matchType: "EXACT",
                                        triggerType: "ALL",
                                        isMedia: false,
                                        mediaUrl: null,
                                        mediaType: null
                                    }
                                }
                            }
                        },
                        responses: {
                            200: { description: "Regra atualizada" },
                            401: { $ref: "#/components/responses/Unauthorized" },
                            403: { $ref: "#/components/responses/Forbidden" },
                            404: { description: "Regra não encontrada" }
                        }
                    },
                    delete: {
                        tags: ["Respostas automáticas"],
                        summary: "Excluir resposta automática",
                        parameters: [
                            { name: "sessionId", in: "path", required: true, schema: { type: "string" } },
                            { name: "replyId", in: "path", required: true, schema: { type: "string" } }
                        ],
                        responses: {
                            200: { description: "Regra excluída" },
                            401: { $ref: "#/components/responses/Unauthorized" },
                            403: { $ref: "#/components/responses/Forbidden" },
                            404: { description: "Regra não encontrada" }
                        }
                    }
                },

                // ==================== SCHEDULER ====================
                "/scheduler/{sessionId}": {
                    "delete": {
                        "tags": [
                            "Agendador"
                        ],
                        "summary": "Excluir todos os agendamentos da sessão",
                        "parameters": [
                            {
                                "name": "sessionId",
                                "in": "path",
                                "required": true,
                                "schema": {
                                    "type": "string"
                                }
                            }
                        ],
                        "responses": {
                            "200": {
                                "description": "Agendamentos excluídos"
                            }
                        }
                    }
                    ,
                    get: {
                        tags: ["Agendador"],
                        summary: "Listar agendamentos",
                        parameters: [
                            { name: "sessionId", in: "path", required: true, schema: { type: "string" } }
                        ],
                        responses: {
                            200: { description: "Lista de mensagens agendadas" },
                            401: { $ref: "#/components/responses/Unauthorized" },
                            403: { $ref: "#/components/responses/Forbidden" },
                            404: { description: "Sessão não encontrada" }
                        }
                    },
                    post: {
                        tags: ["Agendador"],
                        summary: "Criar agendamento",
                        parameters: [
                            { name: "sessionId", in: "path", required: true, schema: { type: "string" } }
                        ],
                        requestBody: {
                            content: {
                                "application/json": {
                                    schema: {
                                        type: "object",
                                        required: ["jid", "sendAt"],
                                        properties: {
                                            jid: { type: "string" },
                                            content: { type: "string" },
                                            sendAt: { type: "string", format: "date-time" },
                                            mediaUrl: { type: "string" },
                                            mediaType: { type: "string", enum: ["image", "video", "document", "audio"] },
                                            cronExpression: { type: "string" },
                                            recurrenceRule: { type: "string" }
                                        }
                                    },
                                    example: {
                                        jid: "5511987654321@s.whatsapp.net",
                                        content: "Reminder: Meeting in 10 mins",
                                        sendAt: "2024-12-25T10:00:00.000Z",
                                        mediaUrl: "https://example.com/image.jpg",
                                        mediaType: "image",
                                        cronExpression: "*/10 * * * *",
                                        recurrenceRule: "{\"type\":\"minutes\",\"value\":10}"
                                    }
                                }
                            }
                        },
                        responses: {
                            200: { description: "Agendamento criado" },
                            400: { description: "Campos obrigatórios ausentes" },
                            401: { $ref: "#/components/responses/Unauthorized" },
                            403: { $ref: "#/components/responses/Forbidden" }
                        }
                    }
                },
                "/scheduler/{sessionId}/{scheduleId}": {
                    "delete": {
                        "tags": [
                            "Agendador"
                        ],
                        "summary": "Delete a specific scheduled message",
                        "parameters": [
                            {
                                "name": "sessionId",
                                "in": "path",
                                "required": true,
                                "schema": {
                                    "type": "string"
                                }
                            },
                            {
                                "name": "scheduleId",
                                "in": "path",
                                "required": true,
                                "schema": {
                                    "type": "string"
                                }
                            }
                        ],
                        "responses": {
                            "200": {
                                "description": "Scheduled message deleted"
                            }
                        }
                    }
                    ,
                    put: {
                        tags: ["Agendador"],
                        summary: "Atualizar agendamento",
                        parameters: [
                            { name: "sessionId", in: "path", required: true, schema: { type: "string" } },
                            { name: "scheduleId", in: "path", required: true, schema: { type: "string" } }
                        ],
                        requestBody: {
                            content: {
                                "application/json": {
                                    schema: {
                                        type: "object",
                                        required: ["jid", "sendAt"],
                                        properties: {
                                            jid: { type: "string" },
                                            content: { type: "string" },
                                            sendAt: { type: "string", format: "date-time" },
                                            mediaUrl: { type: "string" },
                                            mediaType: { type: "string", enum: ["image", "video", "document", "audio"] },
                                            cronExpression: { type: "string" },
                                            recurrenceRule: { type: "string" }
                                        }
                                    },
                                    example: {
                                        jid: "5511987654321@s.whatsapp.net",
                                        content: "Updated meeting reminder",
                                        sendAt: "2024-12-25T11:00:00.000Z",
                                        mediaUrl: "https://example.com/image.jpg",
                                        mediaType: "image",
                                        cronExpression: null,
                                        recurrenceRule: null
                                    }
                                }
                            }
                        },
                        responses: {
                            200: { description: "Mensagem atualizada" },
                            401: { $ref: "#/components/responses/Unauthorized" },
                            403: { $ref: "#/components/responses/Forbidden" },
                            404: { description: "Mensagem não encontrada" }
                        }
                    },
                    delete: {
                        tags: ["Agendador"],
                        summary: "Excluir agendamento",
                        parameters: [
                            { name: "sessionId", in: "path", required: true, schema: { type: "string" } },
                            { name: "scheduleId", in: "path", required: true, schema: { type: "string" } }
                        ],
                        responses: {
                            200: { description: "Mensagem apagada" },
                            401: { $ref: "#/components/responses/Unauthorized" },
                            403: { $ref: "#/components/responses/Forbidden" },
                            404: { description: "Mensagem não encontrada" }
                        }
                    }
                },

                // ==================== WEBHOOKS ====================
                "/webhooks/{sessionId}": {
                    get: {
                        tags: ["Webhooks"],
                        summary: "Listar webhooks da sessão",
                        parameters: [
                            { name: "sessionId", in: "path", required: true, schema: { type: "string" } }
                        ],
                        responses: {
                            200: { description: "Lista de webhooks" },
                            401: { $ref: "#/components/responses/Unauthorized" },
                            403: { $ref: "#/components/responses/Forbidden" }
                        }
                    },
                    post: {
                        tags: ["Webhooks"],
                        summary: "Criar webhook",
                        parameters: [
                            { name: "sessionId", in: "path", required: true, schema: { type: "string" } }
                        ],
                        requestBody: {
                            content: {
                                "application/json": {
                                    schema: {
                                        type: "object",
                                        required: ["name", "url", "events"],
                                        properties: {
                                            name: { type: "string" },
                                            url: { type: "string" },
                                            secret: { type: "string" },
                                            events: { type: "array", items: { type: "string" } }
                                        }
                                    }
                                }
                            }
                        },
                        responses: {
                            200: { description: "Webhook criado" },
                            400: { description: "Dados inválidos" },
                            401: { $ref: "#/components/responses/Unauthorized" },
                            403: { $ref: "#/components/responses/Forbidden" }
                        }
                    }
                },
                "/webhooks/{sessionId}/{id}": {
                    "delete": {
                        "tags": [
                            "Webhooks"
                        ],
                        "summary": "Delete a webhook configuration",
                        "parameters": [
                            {
                                "name": "sessionId",
                                "in": "path",
                                "required": true,
                                "schema": {
                                    "type": "string"
                                }
                            },
                            {
                                "name": "id",
                                "in": "path",
                                "required": true,
                                "schema": {
                                    "type": "string"
                                }
                            }
                        ],
                        "responses": {
                            "200": {
                                "description": "Webhook excluído"
                            }
                        }
                    }
                    ,
                    put: {
                        tags: ["Webhooks"],
                        summary: "Atualizar webhook",
                        parameters: [
                            { name: "sessionId", in: "path", required: true, schema: { type: "string" } },
                            { name: "id", in: "path", required: true, schema: { type: "string" } }
                        ],
                        requestBody: {
                            content: {
                                "application/json": {
                                    schema: {
                                        type: "object",
                                        properties: {
                                            name: { type: "string" },
                                            url: { type: "string" },
                                            secret: { type: "string" },
                                            events: { type: "array", items: { type: "string" } },
                                            isActive: { type: "boolean" }
                                        }
                                    }
                                }
                            }
                        },
                        responses: {
                            200: { description: "Webhook atualizado" },
                            401: { $ref: "#/components/responses/Unauthorized" },
                            403: { $ref: "#/components/responses/Forbidden" },
                            404: { description: "Webhook não encontrado" }
                        }
                    },
                    delete: {
                        tags: ["Webhooks"],
                        summary: "Excluir webhook",
                        parameters: [
                            { name: "sessionId", in: "path", required: true, schema: { type: "string" } },
                            { name: "id", in: "path", required: true, schema: { type: "string" } }
                        ],
                        responses: {
                            200: { description: "Webhook excluído" },
                            401: { $ref: "#/components/responses/Unauthorized" },
                            403: { $ref: "#/components/responses/Forbidden" },
                            404: { description: "Webhook não encontrado" }
                        }
                    }
                },
                "/webhooks/{id}": {
                    delete: {
                        tags: ["Webhooks"],
                        summary: "Excluir webhook",
                        parameters: [
                            { name: "id", in: "path", required: true, schema: { type: "string" } }
                        ],
                        responses: {
                            200: {
                                description: "Webhook excluído",
                                content: {
                                    "application/json": {
                                        schema: {
                                            type: "object",
                                            properties: {
                                                success: { type: "boolean" }
                                            }
                                        }
                                    }
                                }
                            },
                            401: { $ref: "#/components/responses/Unauthorized" },
                            404: { description: "Webhook não encontrado" },
                            500: { $ref: "#/components/responses/ServerError" }
                        }
                    }
                },

                "/webhooks/{sessionId}/{id}/test": {
                    post: {
                        tags: ["Webhooks"],
                        summary: "Testar webhook",
                        description: "Envia um evento de teste para conferir se a URL do webhook está acessível e respondendo corretamente",
                        parameters: [
                            { name: "sessionId", in: "path", required: true, schema: { type: "string" } },
                            { name: "id", in: "path", required: true, schema: { type: "string" } }
                        ],
                        responses: {
                            200: {
                                description: "Resultado do teste",
                                content: {
                                    "application/json": {
                                        schema: {
                                            type: "object",
                                            properties: {
                                                status: { type: "boolean" },
                                                message: { type: "string" },
                                                data: {
                                                    type: "object",
                                                    properties: {
                                                        success: { type: "boolean" },
                                                        statusCode: { type: "integer" },
                                                        responseBody: { type: "string" },
                                                        responseTimeMs: { type: "integer" },
                                                        error: { type: "string" }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            },
                            401: { $ref: "#/components/responses/Unauthorized" },
                            403: { $ref: "#/components/responses/Forbidden" },
                            404: { description: "Webhook não encontrado" }
                        }
                    }
                },
                "/webhooks/{sessionId}/{id}/logs": {
                    get: {
                        tags: ["Webhooks"],
                        summary: "Logs de entrega do webhook",
                        description: "Histórico de entregas de um webhook (até 500 registros, mantidos por 30 dias)",
                        parameters: [
                            { name: "sessionId", in: "path", required: true, schema: { type: "string" } },
                            { name: "id", in: "path", required: true, schema: { type: "string" } },
                            { name: "limit", in: "query", schema: { type: "integer", default: 50 } },
                            { name: "offset", in: "query", schema: { type: "integer", default: 0 } }
                        ],
                        responses: {
                            200: {
                                description: "Logs de entrega do webhook",
                                content: {
                                    "application/json": {
                                        schema: {
                                            type: "object",
                                            properties: {
                                                status: { type: "boolean" },
                                                data: {
                                                    type: "array",
                                                    items: { $ref: "#/components/schemas/WebhookLog" }
                                                },
                                                total: { type: "integer" },
                                                limit: { type: "integer" },
                                                offset: { type: "integer" }
                                            }
                                        }
                                    }
                                }
                            },
                            401: { $ref: "#/components/responses/Unauthorized" },
                            403: { $ref: "#/components/responses/Forbidden" },
                            404: { description: "Webhook não encontrado" }
                        }
                    }
                },

                // ==================== USERS ====================
                "/users": {
                    "post": {
                        "tags": [
                            "Usuários"
                        ],
                        "summary": "Create user resource",
                        "responses": {
                            "200": {
                                "description": "Usuário criado"
                            }
                        }
                    }
                    ,
                    get: {
                        tags: ["Usuários"],
                        summary: "Listar usuários (somente SUPERADMIN)",
                        responses: {
                            200: {
                                description: "Lista de usuários",
                                content: {
                                    "application/json": {
                                        schema: {
                                            type: "array",
                                            items: {
                                                type: "object",
                                                properties: {
                                                    id: { type: "string" },
                                                    name: { type: "string" },
                                                    email: { type: "string" },
                                                    role: { type: "string" },
                                                    createdAt: { type: "string", format: "date-time" },
                                                    _count: {
                                                        type: "object",
                                                        properties: {
                                                            sessions: { type: "integer" }
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            },
                            401: { $ref: "#/components/responses/Unauthorized" },
                            403: { $ref: "#/components/responses/Forbidden" },
                            500: { $ref: "#/components/responses/ServerError" }
                        }
                    },
                    post: {
                        tags: ["Usuários"],
                        summary: "Criar usuário (somente SUPERADMIN)",
                        requestBody: {
                            content: {
                                "application/json": {
                                    schema: {
                                        type: "object",
                                        required: ["name", "email", "password"],
                                        properties: {
                                            name: { type: "string", minLength: 2 },
                                            email: { type: "string", format: "email" },
                                            password: { type: "string", minLength: 6 },
                                            role: {
                                                type: "string",
                                                enum: ["SUPERADMIN", "OWNER", "STAFF"],
                                                default: "OWNER"
                                            }
                                        }
                                    }
                                }
                            }
                        },
                        responses: {
                            200: {
                                description: "Usuário criado",
                                content: {
                                    "application/json": {
                                        schema: {
                                            type: "object",
                                            properties: {
                                                id: { type: "string" },
                                                name: { type: "string" },
                                                email: { type: "string" },
                                                role: { type: "string" },
                                                createdAt: { type: "string", format: "date-time" }
                                            }
                                        }
                                    }
                                }
                            },
                            400: { $ref: "#/components/responses/BadRequest" },
                            401: { $ref: "#/components/responses/Unauthorized" },
                            403: { $ref: "#/components/responses/Forbidden" },
                            500: { $ref: "#/components/responses/ServerError" }
                        }
                    }
                },

                "/users/{id}": {
                    "delete": {
                        "tags": [
                            "Usuários"
                        ],
                        "summary": "Delete user",
                        "parameters": [
                            {
                                "name": "id",
                                "in": "path",
                                "required": true,
                                "schema": {
                                    "type": "string"
                                }
                            }
                        ],
                        "responses": {
                            "200": {
                                "description": "Usuário excluído"
                            }
                        }
                    }
                    ,
                    patch: {
                        tags: ["Usuários"],
                        summary: "Atualizar usuário (somente SUPERADMIN)",
                        parameters: [
                            { name: "id", in: "path", required: true, schema: { type: "string" } }
                        ],
                        requestBody: {
                            content: {
                                "application/json": {
                                    schema: {
                                        type: "object",
                                        properties: {
                                            name: { type: "string" },
                                            email: { type: "string" },
                                            password: { type: "string" },
                                            role: { type: "string", enum: ["SUPERADMIN", "OWNER", "STAFF"] }
                                        }
                                    }
                                }
                            }
                        },
                        responses: {
                            200: {
                                description: "Usuário atualizado",
                                content: {
                                    "application/json": {
                                        schema: {
                                            type: "object",
                                            properties: {
                                                success: { type: "boolean" },
                                                user: {
                                                    type: "object",
                                                    properties: {
                                                        id: { type: "string" },
                                                        email: { type: "string" },
                                                        name: { type: "string" },
                                                        role: { type: "string" },
                                                        emailVerified: { type: "string", nullable: true },
                                                        image: { type: "string", nullable: true },
                                                        createdAt: { type: "string", format: "date-time" },
                                                        updatedAt: { type: "string", format: "date-time" }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            },
                            400: { $ref: "#/components/responses/BadRequest" },
                            401: { $ref: "#/components/responses/Unauthorized" },
                            403: { $ref: "#/components/responses/Forbidden" },
                            404: { description: "Usuário não encontrado" },
                            500: { $ref: "#/components/responses/ServerError" }
                        }
                    },
                    delete: {
                        tags: ["Usuários"],
                        summary: "Excluir usuário (somente SUPERADMIN)",
                        parameters: [
                            { name: "id", in: "path", required: true, schema: { type: "string" } }
                        ],
                        responses: {
                            200: {
                                description: "Usuário excluído",
                                content: {
                                    "application/json": {
                                        schema: {
                                            type: "object",
                                            properties: {
                                                success: { type: "boolean" },
                                                message: { type: "string" }
                                            }
                                        }
                                    }
                                }
                            },
                            401: { $ref: "#/components/responses/Unauthorized" },
                            403: { $ref: "#/components/responses/Forbidden" },
                            404: { description: "Usuário não encontrado" },
                            500: { $ref: "#/components/responses/ServerError" }
                        }
                    }
                },

                "/user/api-key": {
                    "post": {
                        "tags": [
                            "User"
                        ],
                        "summary": "Generate a new API Key",
                        "responses": {
                            "200": {
                                "description": "API Key created"
                            }
                        }
                    },
                    "delete": {
                        "tags": [
                            "User"
                        ],
                        "summary": "Revoke API Key",
                        "responses": {
                            "200": {
                                "description": "API Key revoked"
                            }
                        }
                    }
                    ,
                    get: {
                        tags: ["Usuários"],
                        summary: "Status da chave de API",
                        responses: {
                            200: {
                                description: "Indica se existe uma chave (`hasKey`) e mostra só o início dela (`hint`). A chave completa não pode ser consultada depois de gerada.",
                                content: {
                                    "application/json": {
                                        schema: {
                                            type: "object",
                                            properties: {
                                                apiKey: { type: "string", nullable: true }
                                            }
                                        }
                                    }
                                }
                            },
                            401: { $ref: "#/components/responses/Unauthorized" }
                        }
                    },
                    post: {
                        tags: ["Usuários"],
                        summary: "Gerar nova chave de API",
                        responses: {
                            200: {
                                description: "Nova chave de API gerada. Ela aparece só nesta resposta: guarde-a agora.",
                                content: {
                                    "application/json": {
                                        schema: {
                                            type: "object",
                                            properties: {
                                                apiKey: { type: "string" }
                                            }
                                        }
                                    }
                                }
                            },
                            401: { $ref: "#/components/responses/Unauthorized" },
                            500: { description: "Falha ao gerar a chave de API" }
                        }
                    },
                    delete: {
                        tags: ["Usuários"],
                        summary: "Revogar a chave de API",
                        responses: {
                            200: {
                                description: "Chave de API revogada",
                                content: {
                                    "application/json": {
                                        schema: { $ref: "#/components/schemas/Success" }
                                    }
                                }
                            },
                            401: { $ref: "#/components/responses/Unauthorized" },
                            500: { description: "Falha ao revogar a chave de API" }
                        }
                    }
                },

                "/groups/{sessionId}/{jid}": {
                    get: {
                        tags: ["Grupos"],
                        summary: "Detalhes do grupo",
                        description: "Informações detalhadas do grupo",
                        parameters: [
                            { name: "sessionId", in: "path", required: true, schema: { type: "string" } },
                            { name: "jid", in: "path", required: true, schema: { type: "string" } }
                        ],
                        responses: {
                            200: {
                                description: "Detalhes do grupo",
                                content: { "application/json": { schema: { $ref: "#/components/schemas/GroupDetails" } } }
                            },
                            401: { $ref: "#/components/responses/Unauthorized" },
                            403: { $ref: "#/components/responses/Forbidden" },
                            404: { $ref: "#/components/responses/NotFound" },
                            500: { description: "Falha ao obter os detalhes" }
                        }
                    }
                },
                // ==================== GROUPS ====================
                "/groups/{sessionId}/invite/accept": {
                    post: {
                        tags: ["Grupos"],
                        summary: "Aceitar convite de grupo",
                        description: "Entra em um grupo usando um código de convite",
                        parameters: [
                            { name: "sessionId", in: "path", required: true, schema: { type: "string" } }
                        ],
                        requestBody: {
                            content: {
                                "application/json": {
                                    schema: {
                                        type: "object",
                                        required: ["inviteCode"],
                                        properties: {
                                            inviteCode: { type: "string" }
                                        }
                                    }
                                }
                            }
                        },
                        responses: {
                            200: { description: "Convite aceito", content: { "application/json": { schema: { type: "object", properties: { success: { type: "boolean", example: true }, message: { type: "string" }, groupJid: { type: "string" } } } } } },
                            401: { $ref: "#/components/responses/Unauthorized" },
                            403: { $ref: "#/components/responses/Forbidden" },
                            400: { description: "Código inválido ou expirado" },
                            503: { $ref: "#/components/responses/SessionNotReady" },
                            500: { description: "Falha ao aceitar o convite" }
                        }
                    }
                },
                "/groups/{sessionId}/{jid}/picture": {
                    "delete": {
                        "tags": [
                            "Grupos"
                        ],
                        "summary": "Remover a foto do grupo",
                        "parameters": [
                            {
                                "name": "sessionId",
                                "in": "path",
                                "required": true,
                                "schema": {
                                    "type": "string"
                                }
                            },
                            {
                                "name": "jid",
                                "in": "path",
                                "required": true,
                                "schema": {
                                    "type": "string"
                                }
                            }
                        ],
                        "responses": {
                            "200": {
                                "description": "Group picture removed"
                            }
                        }
                    }
                    ,
                    put: {
                        tags: ["Grupos"],
                        summary: "Alterar a foto do grupo",
                        parameters: [
                            { name: "sessionId", in: "path", required: true, schema: { type: "string" } },
                            { name: "jid", in: "path", required: true, schema: { type: "string" } }
                        ],
                        requestBody: {
                            content: {
                                "multipart/form-data": {
                                    schema: {
                                        type: "object",
                                        required: ["file"],
                                        properties: {
                                            file: { type: "string", format: "binary" }
                                        }
                                    }
                                }
                            }
                        },
                        responses: { 200: { description: "Foto alterada" } }
                    },
                    delete: {
                        tags: ["Grupos"],
                        summary: "Remover a foto do grupo",
                        parameters: [
                            { name: "sessionId", in: "path", required: true, schema: { type: "string" } },
                            { name: "jid", in: "path", required: true, schema: { type: "string" } }
                        ],
                        responses: { 200: { description: "Foto removida" } }
                    }
                },
                "/groups/{sessionId}/{jid}/settings": {
                    put: {
                        tags: ["Grupos"],
                        summary: "Alterar as configurações do grupo",
                        parameters: [
                            { name: "sessionId", in: "path", required: true, schema: { type: "string" } },
                            { name: "jid", in: "path", required: true, schema: { type: "string" } }
                        ],
                        requestBody: {
                            content: {
                                "application/json": {
                                    schema: {
                                        type: "object",
                                        required: ["setting"],
                                        properties: {
                                            setting: {
                                                type: "string",
                                                enum: ["announcement", "not_announcement", "locked", "unlocked"],
                                                description: "`announcement` (só admins enviam), `not_announcement` (todos enviam), `locked` (só admins editam os dados), `unlocked` (todos editam)"
                                            },
                                            value: { type: "boolean", description: "Ignorado, mas obrigatório" }
                                        }
                                    }
                                }
                            }
                        },
                        responses: { 200: { description: "Configurações atualizadas" } }
                    }
                },
                "/groups/{sessionId}/{jid}/description": {
                    put: {
                        tags: ["Grupos"],
                        summary: "Alterar a descrição do grupo",
                        parameters: [
                            { name: "sessionId", in: "path", required: true, schema: { type: "string" } },
                            { name: "jid", in: "path", required: true, schema: { type: "string" } }
                        ],
                        requestBody: {
                            content: {
                                "application/json": {
                                    schema: {
                                        type: "object",
                                        properties: {
                                            description: { type: "string", maxLength: 512 }
                                        }
                                    }
                                }
                            }
                        },
                        responses: {
                            200: { description: "Descrição alterada", content: { "application/json": { schema: { type: "object", properties: { success: { type: "boolean", example: true }, description: { type: "string" } } } } } },
                            401: { $ref: "#/components/responses/Unauthorized" },
                            403: { $ref: "#/components/responses/Forbidden" },
                            400: { description: "Dados inválidos" },
                            500: { description: "Falha ao atualizar" }
                        }
                    }
                },
                "/groups/{sessionId}/{jid}/ephemeral": {
                    put: {
                        tags: ["Grupos"],
                        summary: "Ativar/desativar mensagens temporárias",
                        parameters: [
                            { name: "sessionId", in: "path", required: true, schema: { type: "string" } },
                            { name: "jid", in: "path", required: true, schema: { type: "string" } }
                        ],
                        requestBody: {
                            content: {
                                "application/json": {
                                    schema: {
                                        type: "object",
                                        required: ["expiration"],
                                        properties: {
                                            expiration: { type: "integer", enum: [0, 86400, 604800, 7776000] }
                                        }
                                    }
                                }
                            }
                        },
                        responses: {
                            200: { description: "Mensagens temporárias alteradas", content: { "application/json": { schema: { type: "object", properties: { success: { type: "boolean", example: true }, expiration: { type: "integer" } } } } } },
                            401: { $ref: "#/components/responses/Unauthorized" },
                            403: { $ref: "#/components/responses/Forbidden" },
                            400: { description: "Duração inválida" },
                            500: { description: "Falha ao alterar" }
                        }
                    }
                },
                // ==================== LABELS ====================
                "/labels/{sessionId}": {
                    "post": {
                        "tags": [
                            "Etiquetas"
                        ],
                        "summary": "Create a label",
                        "parameters": [
                            {
                                "name": "sessionId",
                                "in": "path",
                                "required": true,
                                "schema": {
                                    "type": "string"
                                }
                            }
                        ],
                        "requestBody": {
                            "content": {
                                "application/json": {
                                    "schema": {
                                        "type": "object",
                                        "required": [
                                            "name"
                                        ],
                                        "properties": {
                                            "name": {
                                                "type": "string"
                                            },
                                            "color": {
                                                "type": "integer"
                                            }
                                        }
                                    }
                                }
                            }
                        },
                        "responses": {
                            "200": {
                                "description": "Etiqueta criada"
                            }
                        }
                    },
                    "put": {
                        "tags": [
                            "Etiquetas"
                        ],
                        "summary": "Atualizar etiquetas em lote",
                        "parameters": [
                            {
                                "name": "sessionId",
                                "in": "path",
                                "required": true,
                                "schema": {
                                    "type": "string"
                                }
                            }
                        ],
                        "responses": {
                            "200": {
                                "description": "Etiquetas atualizadas"
                            }
                        }
                    },
                    "delete": {
                        "tags": [
                            "Etiquetas"
                        ],
                        "summary": "Excluir etiquetas",
                        "parameters": [
                            {
                                "name": "sessionId",
                                "in": "path",
                                "required": true,
                                "schema": {
                                    "type": "string"
                                }
                            }
                        ],
                        "responses": {
                            "200": {
                                "description": "Etiquetas excluídas"
                            }
                        }
                    }
                    ,
                    get: {
                        tags: ["Etiquetas"],
                        summary: "Listar etiquetas",
                        description: "Lista todas as etiquetas com a quantidade de conversas de cada uma",
                        parameters: [
                            { name: "sessionId", in: "path", required: true, schema: { type: "string" } }
                        ],
                        responses: {
                            200: {
                                description: "Lista de etiquetas",
                                content: {
                                    "application/json": {
                                        schema: {
                                            type: "object",
                                            properties: {
                                                success: { type: "boolean", example: true },
                                                labels: { type: "array", items: { $ref: "#/components/schemas/Label" } }
                                            }
                                        }
                                    }
                                }
                            },
                            401: { $ref: "#/components/responses/Unauthorized" },
                            403: { $ref: "#/components/responses/Forbidden" },
                            404: { description: "Sessão não encontrada" }
                        }
                    },
                    post: {
                        tags: ["Etiquetas"],
                        summary: "Criar etiqueta",
                        description: "Cria uma etiqueta com cor (índice de 0 a 19)",
                        parameters: [
                            { name: "sessionId", in: "path", required: true, schema: { type: "string" } }
                        ],
                        requestBody: {
                            content: {
                                "application/json": {
                                    schema: {
                                        type: "object",
                                        required: ["name"],
                                        properties: {
                                            name: { type: "string", example: "Important" },
                                            color: { type: "integer", minimum: 0, maximum: 19, example: 0, description: "Índice da cor (0 a 19)" }
                                        }
                                    }
                                }
                            }
                        },
                        responses: {
                            200: {
                                description: "Etiqueta criada",
                                content: {
                                    "application/json": {
                                        schema: {
                                            type: "object",
                                            properties: {
                                                success: { type: "boolean", example: true },
                                                label: { $ref: "#/components/schemas/Label" }
                                            }
                                        }
                                    }
                                }
                            },
                            401: { $ref: "#/components/responses/Unauthorized" },
                            403: { $ref: "#/components/responses/Forbidden" },
                            500: { description: "Falha ao criar a etiqueta" }
                        }
                    }
                },
                "/labels/{sessionId}/{labelId}": {
                    "delete": {
                        "tags": [
                            "Etiquetas"
                        ],
                        "summary": "Delete a specific label",
                        "parameters": [
                            {
                                "name": "sessionId",
                                "in": "path",
                                "required": true,
                                "schema": {
                                    "type": "string"
                                }
                            },
                            {
                                "name": "labelId",
                                "in": "path",
                                "required": true,
                                "schema": {
                                    "type": "string"
                                }
                            }
                        ],
                        "responses": {
                            "200": {
                                "description": "Etiqueta excluída"
                            }
                        }
                    }
                    ,
                    put: {
                        tags: ["Etiquetas"],
                        summary: "Atualizar etiqueta",
                        parameters: [
                            { name: "sessionId", in: "path", required: true, schema: { type: "string" } },
                            { name: "labelId", in: "path", required: true, schema: { type: "string" } }
                        ],
                        requestBody: {
                            content: {
                                "application/json": {
                                    schema: {
                                        type: "object",
                                        properties: {
                                            name: { type: "string" },
                                            color: { type: "integer", minimum: 0, maximum: 19 }
                                        }
                                    }
                                }
                            }
                        },
                        responses: {
                            200: {
                                description: "Etiqueta atualizada",
                                content: { "application/json": { schema: { type: "object", properties: { success: { type: "boolean", example: true }, label: { $ref: "#/components/schemas/Label" } } } } }
                            }
                        }
                    },
                    delete: {
                        tags: ["Etiquetas"],
                        summary: "Excluir etiqueta",
                        parameters: [
                            { name: "sessionId", in: "path", required: true, schema: { type: "string" } },
                            { name: "labelId", in: "path", required: true, schema: { type: "string" } }
                        ],
                        responses: {
                            200: {
                                description: "Etiqueta excluída",
                                content: { "application/json": { schema: { $ref: "#/components/schemas/Success" } } }
                            }
                        }
                    }
                },
                "/labels/{sessionId}/chat/{jid}/labels": {
                    get: {
                        tags: ["Etiquetas"],
                        summary: "Etiquetas da conversa",
                        parameters: [
                            { name: "sessionId", in: "path", required: true, schema: { type: "string" } },
                            { name: "jid", in: "path", required: true, schema: { type: "string" } }
                        ],
                        responses: {
                            200: {
                                description: "Etiquetas da conversa",
                                content: { "application/json": { schema: { type: "object", properties: { success: { type: "boolean" }, labels: { type: "array", items: { $ref: "#/components/schemas/Label" } } } } } }
                            }
                        }
                    },
                    put: {
                        tags: ["Etiquetas"],
                        summary: "Alterar as etiquetas da conversa",
                        parameters: [
                            { name: "sessionId", in: "path", required: true, schema: { type: "string" } },
                            { name: "jid", in: "path", required: true, schema: { type: "string" } }
                        ],
                        requestBody: {
                            content: {
                                "application/json": {
                                    schema: {
                                        type: "object",
                                        required: ["labelIds", "action"],
                                        properties: {
                                            labelIds: { type: "array", items: { type: "string" } },
                                            action: { type: "string", enum: ["add", "remove"] }
                                        }
                                    }
                                }
                            }
                        },
                        responses: {
                            200: {
                                description: "Etiquetas da conversa alteradas",
                                content: { "application/json": { schema: { type: "object", properties: { success: { type: "boolean" }, message: { type: "string" }, labels: { type: "array", items: { $ref: "#/components/schemas/Label" } } } } } }
                            }
                        }
                    }
                },

                // ==================== NOTIFICATIONS ====================
                "/notifications": {
                    "post": {
                        "tags": [
                            "Notificações"
                        ],
                        "summary": "Send or register a notification",
                        "responses": {
                            "200": {
                                "description": "Notification processed"
                            }
                        }
                    }
                    ,
                    get: {
                        tags: ["Notificações"],
                        summary: "Listar notificações",
                        description: "Lista as 50 notificações mais recentes do usuário autenticado",
                        responses: {
                            200: {
                                description: "Lista de notificações",
                                content: {
                                    "application/json": {
                                        schema: {
                                            type: "array",
                                            items: {
                                                type: "object",
                                                properties: {
                                                    id: { type: "string" },
                                                    userId: { type: "string" },
                                                    title: { type: "string" },
                                                    message: { type: "string" },
                                                    type: { type: "string" },
                                                    href: { type: "string", nullable: true },
                                                    read: { type: "boolean" },
                                                    createdAt: { type: "string", format: "date-time" }
                                                }
                                            }
                                        }
                                    }
                                }
                            },
                            401: { $ref: "#/components/responses/Unauthorized" },
                            500: { description: "Erro ao obter as notificações" }
                        }
                    },
                    post: {
                        tags: ["Notificações"],
                        summary: "Criar notificação",
                        description: "Envia uma notificação para um usuário ou para todos (somente SUPERADMIN)",
                        requestBody: {
                            content: {
                                "application/json": {
                                    schema: {
                                        type: "object",
                                        required: ["title", "message"],
                                        properties: {
                                            title: { type: "string", example: "Maintenance" },
                                            message: { type: "string", example: "System update in 5 minutes" },
                                            type: { type: "string", enum: ["INFO", "SUCCESS", "WARNING", "ERROR"], default: "INFO" },
                                            href: { type: "string", example: "/settings" },
                                            targetUserId: { type: "string", description: "ID do usuário de destino" },
                                            broadcast: { type: "boolean", default: false }
                                        }
                                    }
                                }
                            }
                        },
                        responses: {
                            200: {
                                description: "Notificação criada",
                                content: {
                                    "application/json": {
                                        schema: {
                                            type: "object",
                                            properties: {
                                                success: { type: "boolean", example: true },
                                                count: { type: "integer", description: "Quantidade de usuários notificados, no envio para todos" }
                                            }
                                        }
                                    }
                                }
                            },
                            400: { description: "Requisição inválida" },
                            401: { $ref: "#/components/responses/Unauthorized" },
                            403: { $ref: "#/components/responses/Forbidden" },
                            500: { description: "Erro ao criar a notificação" }
                        }
                    }
                },
                "/notifications/read": {
                    patch: {
                        tags: ["Notificações"],
                        summary: "Marcar notificações como lidas",
                        description: "Marca notificações específicas, ou todas, como lidas para o usuário autenticado",
                        requestBody: {
                            content: {
                                "application/json": {
                                    schema: {
                                        type: "object",
                                        properties: {
                                            ids: {
                                                type: "array",
                                                items: { type: "string" },
                                                description: "Lista de IDs de notificação. Se omitida ou vazia, todas são marcadas como lidas."
                                            }
                                        }
                                    }
                                }
                            }
                        },
                        responses: {
                            200: {
                                description: "Notificações atualizadas",
                                content: {
                                    "application/json": {
                                        schema: { $ref: "#/components/schemas/Success" }
                                    }
                                }
                            },
                            401: { $ref: "#/components/responses/Unauthorized" },
                            500: { description: "Erro ao atualizar as notificações" }
                        }
                    }
                },
                "/notifications/delete": {
                    delete: {
                        tags: ["Notificações"],
                        summary: "Excluir notificação",
                        parameters: [
                            {
                                name: "id",
                                in: "query",
                                required: true,
                                schema: { type: "string" },
                                description: "ID da notificação"
                            }
                        ],
                        responses: {
                            200: {
                                description: "Notificação excluída",
                                content: {
                                    "application/json": {
                                        schema: { $ref: "#/components/schemas/Success" }
                                    }
                                }
                            },
                            400: { description: "O ID da notificação é obrigatório" },
                            401: { $ref: "#/components/responses/Unauthorized" },
                            500: { description: "Erro ao excluir a notificação" }
                        }
                    }
                },

                // ==================== SYSTEM ====================
                "/settings/system": {
                    "post": {
                        "tags": [
                            "Settings"
                        ],
                        "summary": "Alterar as configurações do sistema",
                        "responses": {
                            "200": {
                                "description": "System settings updated"
                            }
                        }
                    }
                    ,
                    get: {
                        tags: ["Sistema"],
                        summary: "Obter as configurações do sistema",
                        responses: {
                            200: {
                                description: "Configurações do sistema",
                                content: {
                                    "application/json": {
                                        schema: {
                                            type: "object",
                                            properties: {
                                                id: { type: "string", example: "default" },
                                                appName: { type: "string", example: "W-AZAP" },
                                                logoUrl: { type: "string", example: "https://example.com/logo.png" },
                                                timezone: { type: "string", example: "Asia/Jakarta" }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    },
                    post: {
                        tags: ["Sistema"],
                        summary: "Alterar as configurações do sistema",
                        description: "Altera a configuração global do sistema: nome, logotipo, fuso horário e cadastro público (somente SUPERADMIN)",
                        requestBody: {
                            content: {
                                "application/json": {
                                    schema: {
                                        type: "object",
                                        properties: {
                                            appName: { type: "string" },
                                            logoUrl: { type: "string" },
                                            timezone: { type: "string" }
                                        }
                                    }
                                }
                            }
                        },
                        responses: {
                            200: {
                                description: "Configurações atualizadas",
                                content: {
                                    "application/json": {
                                        schema: {
                                            type: "object",
                                            properties: {
                                                id: { type: "string" },
                                                appName: { type: "string" },
                                                logoUrl: { type: "string" },
                                                timezone: { type: "string" },
                                                updatedAt: { type: "string", format: "date-time" }
                                            }
                                        }
                                    }
                                }
                            },
                            401: { $ref: "#/components/responses/Unauthorized" },
                            500: { description: "Falha ao alterar as configurações" }
                        }
                    }
                },
                "/system/check-updates": {
                    post: {
                        tags: ["Sistema"],
                        summary: "Verificar atualizações",
                        description: "Procura novas versões no GitHub e cria uma notificação se houver uma mais recente. Somente SUPERADMIN; o resultado fica em cache por 1 hora.",
                        responses: {
                            200: {
                                description: "Resultado da verificação",
                                content: {
                                    "application/json": {
                                        schema: {
                                            type: "object",
                                            properties: {
                                                success: { type: "boolean" },
                                                message: { type: "string" },
                                                version: { type: "string", description: "Tag da versão mais recente" }
                                            }
                                        }
                                    }
                                }
                            },
                            401: { $ref: "#/components/responses/Unauthorized" },
                            500: { description: "Erro ao verificar atualizações" }
                        }
                    }
                },
                "/contacts/{sessionId}/{jid}/block": {
                    post: {
                        tags: ["Contatos"],
                        summary: "Bloquear contato",
                        parameters: [
                            { name: "sessionId", in: "path", required: true, schema: { type: "string" } },
                            { name: "jid", in: "path", required: true, schema: { type: "string" } }
                        ],
                        responses: {
                            200: { description: "Contato bloqueado", content: { "application/json": { schema: { type: "object", properties: { success: { type: "boolean", example: true }, message: { type: "string" } } } } } },
                            401: { $ref: "#/components/responses/Unauthorized" },
                            403: { $ref: "#/components/responses/Forbidden" },
                            500: { description: "Falha ao bloquear o contato" }
                        }
                    }
                },
                "/contacts/{sessionId}/{jid}/unblock": {
                    post: {
                        tags: ["Contatos"],
                        summary: "Desbloquear contato",
                        parameters: [
                            { name: "sessionId", in: "path", required: true, schema: { type: "string" } },
                            { name: "jid", in: "path", required: true, schema: { type: "string" } }
                        ],
                        responses: {
                            200: { description: "Contato desbloqueado", content: { "application/json": { schema: { type: "object", properties: { success: { type: "boolean", example: true }, message: { type: "string" } } } } } },
                            401: { $ref: "#/components/responses/Unauthorized" },
                            403: { $ref: "#/components/responses/Forbidden" },
                            500: { description: "Falha ao desbloquear o contato" }
                        }
                    }
                },
                "/contacts/{sessionId}": {
                    get: {
                        tags: ["Contatos"],
                        summary: "Listar contatos",
                        description: "Lista os contatos sincronizados da sessão, com paginação e busca por nome, número ou JID.",
                        parameters: [
                            { name: "sessionId", in: "path", required: true, schema: { type: "string" } },
                            { name: "page", in: "query", required: false, schema: { type: "integer", default: 1 }, description: "Página (começa em 1)" },
                            { name: "limit", in: "query", required: false, schema: { type: "string", default: "10" }, description: "Itens por página, ou `all` para trazer todos" },
                            { name: "search", in: "query", required: false, schema: { type: "string" }, description: "Filtra por nome, número ou JID" }
                        ],
                        responses: {
                            200: {
                                description: "Lista de contatos",
                                content: {
                                    "application/json": {
                                        schema: {
                                            type: "object",
                                            properties: {
                                                status: { type: "boolean", example: true },
                                                message: { type: "string", example: "Contacts retrieved successfully" },
                                                data: { type: "array", items: { $ref: "#/components/schemas/Contact" } },
                                                meta: {
                                                    type: "object",
                                                    properties: {
                                                        total: { type: "integer", example: 120 },
                                                        page: { type: "integer", example: 1 },
                                                        limit: { type: "integer", example: 10 },
                                                        totalPages: { type: "integer", example: 12 }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            },
                            401: { $ref: "#/components/responses/Unauthorized" },
                            403: { $ref: "#/components/responses/Forbidden" }
                        }
                    }
                },
                "/labels/{sessionId}/chats": {
                    get: {
                        tags: ["Etiquetas"],
                        summary: "Conversas e etiquetas",
                        description: "Com `labelId`, devolve as conversas que têm aquela etiqueta (com o nome do contato). Com `jid`, devolve as etiquetas daquela conversa. Sem parâmetros, devolve todas as atribuições da sessão em uma única consulta.",
                        parameters: [
                            { name: "sessionId", in: "path", required: true, schema: { type: "string" } },
                            { name: "labelId", in: "query", required: false, schema: { type: "string" }, description: "ID da etiqueta" },
                            { name: "jid", in: "query", required: false, schema: { type: "string" }, description: "JID da conversa" }
                        ],
                        responses: {
                            200: { description: "Atribuições de etiquetas" },
                            401: { $ref: "#/components/responses/Unauthorized" },
                            403: { $ref: "#/components/responses/Forbidden" }
                        }
                    }
                },
                "/media": {
                    get: {
                        tags: ["Mídia"],
                        summary: "Listar arquivos de mídia",
                        description: "Lista os arquivos de mídia baixados das sessões do usuário, com dados do remetente. O SUPERADMIN vê os arquivos de todas as sessões.",
                        responses: {
                            200: {
                                description: "Arquivos de mídia",
                                content: {
                                    "application/json": {
                                        schema: {
                                            type: "object",
                                            properties: {
                                                status: { type: "boolean", example: true },
                                                message: { type: "string", example: "Media files fetched successfully" },
                                                data: {
                                                    type: "object",
                                                    properties: {
                                                        files: {
                                                            type: "array",
                                                            items: {
                                                                type: "object",
                                                                properties: {
                                                                    name: { type: "string", example: "vendas-01-3EB0B78A.jpg" },
                                                                    size: { type: "integer", example: 52341 },
                                                                    type: { type: "string", example: "image" },
                                                                    sessionId: { type: "string", example: "vendas-01" },
                                                                    from: { type: "string", example: "5511987654321@s.whatsapp.net" },
                                                                    fromMe: { type: "boolean", example: false },
                                                                    createdAt: { type: "string", format: "date-time" },
                                                                    url: { type: "string", example: "/api/media/vendas-01-3EB0B78A.jpg" }
                                                                }
                                                            }
                                                        },
                                                        totalSize: { type: "integer", example: 52341 },
                                                        totalCount: { type: "integer", example: 1 }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            },
                            401: { $ref: "#/components/responses/Unauthorized" }
                        }
                    },
                    delete: {
                        tags: ["Mídia"],
                        summary: "Excluir arquivos de mídia",
                        description: "Exclui vários arquivos de uma vez. Cada arquivo é conferido: só é possível excluir mídia das sessões às quais você tem acesso. Arquivos sem sessão identificável exigem SUPERADMIN.",
                        requestBody: {
                            required: true,
                            content: {
                                "application/json": {
                                    schema: {
                                        type: "object",
                                        required: ["filenames"],
                                        properties: {
                                            filenames: { type: "array", items: { type: "string" }, example: ["vendas-01-3EB0B78A.jpg"], description: "Nomes dos arquivos (sem caminho)" }
                                        }
                                    }
                                }
                            }
                        },
                        responses: {
                            200: { description: "Resultado da exclusão (`deleted`, `failed`, `errors`)" },
                            400: { $ref: "#/components/responses/BadRequest" },
                            401: { $ref: "#/components/responses/Unauthorized" }
                        }
                    }
                },
                "/system/monitor": {
                    get: {
                        tags: ["Sistema"],
                        summary: "Métricas do servidor",
                        description: "CPU (total e por núcleo), memória, discos, rede, sistema operacional e processo Node.js. Somente SUPERADMIN.",
                        responses: {
                            200: { description: "Métricas do sistema" },
                            401: { $ref: "#/components/responses/Unauthorized" },
                            403: { $ref: "#/components/responses/Forbidden" }
                        }
                    }
                },
                "/system/monitor/{sessionId}": {
                    get: {
                        tags: ["Sistema"],
                        summary: "Métricas da sessão",
                        description: "Status da conexão, tempo conectado (`uptimeMs`), ping do socket e contagem de contatos, conversas e mensagens da sessão.",
                        parameters: [
                            { name: "sessionId", in: "path", required: true, schema: { type: "string" } }
                        ],
                        responses: {
                            200: { description: "Métricas da sessão" },
                            401: { $ref: "#/components/responses/Unauthorized" },
                            403: { $ref: "#/components/responses/Forbidden" }
                        }
                    }
                },
                "/chats/{sessionId}/by-label/{labelId}": {
                    get: {
                        tags: ["Etiquetas"],
                        summary: "Conversas por etiqueta",
                        description: "Lista todas as conversas associadas a uma etiqueta",
                        parameters: [
                            { name: "sessionId", in: "path", required: true, schema: { type: "string" } },
                            { name: "labelId", in: "path", required: true, schema: { type: "string" } }
                        ],
                        responses: {
                            200: {
                                description: "Lista de conversas com a etiqueta",
                                content: {
                                    "application/json": {
                                        schema: {
                                            type: "object",
                                            properties: {
                                                success: { type: "boolean" },
                                                label: { type: "object" },
                                                chats: { type: "array", items: { type: "string" } },
                                                count: { type: "integer" }
                                            }
                                        }
                                    }
                                }
                            },
                            401: { $ref: "#/components/responses/Unauthorized" },
                            403: { $ref: "#/components/responses/Forbidden" },
                            404: { description: "Etiqueta não encontrada" }
                        }
                    }
                }
            }
        }
    });
    return spec;
};

