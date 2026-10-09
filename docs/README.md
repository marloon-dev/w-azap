# 📂 Índice da Documentação

Bem-vindo à documentação do **W-AZAP**. Use os links abaixo para navegar pelos guias técnicos e de uso.

---

## 📘 Guias principais

| Documento | Para que serve |
| :--- | :--- |
| **[Documentação da API](./API_DOCUMENTATION.md)** | Referência completa da API REST, gerada a partir da especificação OpenAPI. |
| **[Referência rápida da API](./API-QUICK-REFERENCE.md)** | Exemplos prontos em cURL, JavaScript e Python, além dos formatos de JID. |
| **[Manual do usuário](./USER_GUIDE.md)** | Passo a passo dos recursos do painel. |
| **[Arquitetura do projeto](./PROJECT_DOCUMENTATION.md)** | Lógica do sistema, diagramas e modelos do banco de dados. |
| **[Variáveis de ambiente](./ENVIRONMENT_VARIABLES.md)** | Todas as opções do `.env`, com foco em segurança. |

---

## 🛠️ Infraestrutura e manutenção

- **[Configuração do banco de dados](./DATABASE_SETUP.md)**: criação do schema, troca de provedor e stack Docker Compose.
- **[Guia de atualização](./UPDATE_GUIDE.md)**: como atualizar a instalação, aplicar o patch do Baileys e o que mudou em segurança.
- **[Relatório de análise da API](./API_ANALYSIS_REPORT.md)**: visão geral da arquitetura das rotas e dos controles de segurança.
- **[Política de segurança](../.github/SECURITY.md)**: como reportar vulnerabilidades.

---

## 🚦 Primeiros passos (via API)

1. **Autenticação**: gere sua chave no painel, em **Webhooks e API**. Ela aparece **uma única vez**, então copie e guarde. Envie-a no cabeçalho `X-API-Key`.
2. **Sessão**: crie uma com `POST /api/sessions` e leia o QR code (`GET /api/sessions/{id}/qr`) ou escaneie pelo painel.
3. **Automação**: registre uma URL com `POST /api/webhooks/{sessionId}` para começar a receber eventos.

> [!IMPORTANT]
> Antes de iniciar a aplicação, defina `AUTH_SECRET` no `.env`; sem ele o servidor não sobe. Em produção, defina também `DATA_ENCRYPTION_KEY`, que criptografa as chaves de sessão do WhatsApp. Gere os dois com `openssl rand -base64 32`.

> [!TIP]
> Com a aplicação rodando, a documentação interativa (Swagger UI) fica em `/swagger` e a versão em texto em `/docs`. As duas exigem login no painel.

---
<div align="center">

**Versão**: 1.6.4 | **Status**: Estável

</div>
