# Política de Segurança — W-AZAP

## Versões suportadas

| Versão  | Situação          |
|---------|-------------------|
| 1.6.x   | ✅ Suportada      |
| < 1.6   | ❌ Sem suporte    |

Recomendamos sempre usar a versão mais recente da série 1.6: várias correções de segurança (veja abaixo) só existem nela.

## Como reportar uma vulnerabilidade

**NÃO abra uma issue pública para relatar vulnerabilidades.**

Envie o relato por um destes canais:

1. **GitHub Security Advisory** (recomendado): [abrir um relato privado](https://github.com/marloon-dev/w-azap/security/advisories/new), ou **Security** › **Report a vulnerability** neste repositório.
2. **Contato direto**: pelo perfil do GitHub do mantenedor, [@marloon-dev](https://github.com/marloon-dev).

Inclua, se possível:

- versão do W-AZAP e forma de instalação (PM2, Docker, bare-metal);
- passos para reproduzir e uma prova de conceito mínima;
- impacto estimado (o que um atacante consegue fazer);
- sugestão de correção, se tiver.

## Prazos de resposta

| Etapa                 | Meta                                                       |
|-----------------------|------------------------------------------------------------|
| Confirmação           | < 48 horas                                                 |
| Investigação          | < 3 dias                                                   |
| Correção publicada    | < 7 dias                                                   |
| Divulgação            | Depois da correção publicada e de os usuários atualizarem |

## Escopo

- Vulnerabilidades no código do W-AZAP (Next.js, integração com o Baileys, API REST, Socket.IO).
- Dependências com CVEs críticas.
- Vazamento ou exposição de credenciais (chaves de API, segredos de webhook, chaves de sessão do WhatsApp).

## Fora do escopo

- Vulnerabilidades em dependências de terceiros (ainda podem ser reportadas, mas têm prioridade baixa).
- Engenharia social / phishing.
- Negação de serviço causada pela configuração do próprio usuário (por exemplo, `ENABLE_RATE_LIMITING="false"`).
- Problemas que exigem acesso de administrador ao servidor ou ao banco de dados.

## Medidas de segurança atuais

Para referência de quem for auditar o sistema:

| Área | Proteção |
|------|----------|
| **Autenticação** | Senhas com bcrypt (mínimo de 8 caracteres), sessões JWT assinadas com `AUTH_SECRET` (o servidor não inicia sem ele) e expiração definida por `SESSION_TIMEOUT_HOURS`. |
| **Revogação de sessão** | Ao trocar a senha, o e-mail ou o papel, ou ao excluir o usuário, todas as sessões abertas dele são invalidadas (`sessionVersion`). |
| **Força bruta** | Login limitado a 5 tentativas por conta e 20 por IP a cada 15 minutos; cadastro limitado a 10 por IP por hora; API limitada por `RATE_LIMIT_PER_MINUTE`. |
| **Cadastro público** | Desativado por padrão. Só o primeiro usuário (que vira `SUPERADMIN`) pode se cadastrar sem convite. As mensagens de erro não revelam se um e-mail já existe. |
| **Chaves de API** | Geradas com `crypto.randomBytes`, armazenadas apenas como hash SHA-256 e exibidas uma única vez. |
| **Dados em repouso** | Chaves de sessão do WhatsApp criptografadas com AES-256-GCM (`DATA_ENCRYPTION_KEY`). |
| **Rede** | O servidor escuta só em `127.0.0.1` por padrão (`BIND_HOST`); o MySQL do Docker fica preso a `127.0.0.1`. |
| **SSRF** | Webhooks e URLs de mídia não podem apontar para endereços internos (a menos que `ALLOW_PRIVATE_WEBHOOK_URLS="true"`). Downloads têm limite de tamanho e de tempo. |
| **Tempo real** | O Socket.IO exige login ou chave de API, aceita só origens permitidas (`SOCKET_ALLOWED_ORIGINS`) e verifica a permissão em cada sala de sessão. |
| **Navegador** | CSP, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy` e HSTS (quando em HTTPS). |
| **Isolamento** | Usuários só acessam as próprias sessões (ou as compartilhadas com eles); mídia, webhooks e respostas automáticas validam o dono. |
| **Telemetria** | Nenhuma. O envio de "heartbeat" ao servidor do autor original foi removido. |

### Riscos conhecidos

- **Baileys 7.0.0-rc.9**: há um aviso de segurança na biblioteca. A atualização exige reescrever o patch em `patches/` e ainda está pendente.
- **`file-type` (via `wa-sticker-formatter`)**: a versão corrigida é só ESM e ainda não é compatível.
- **DNS rebinding**: a proteção contra SSRF valida o endereço antes da requisição. Um domínio que troca de IP entre a validação e a conexão ainda é um risco residual pequeno.
