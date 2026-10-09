# Relatório de Análise da API

> **Análise original**: 17 de janeiro de 2026 · **Revisado**: outubro de 2026 (v1.6.4)
> **Escopo**: diretório `src/app/api` (82 arquivos de rota)
> **Foco**: lógica, segurança e arquitetura

## 1. Visão geral da arquitetura

A API segue o padrão **Route Handler** do Next.js 16 (App Router), executado por um servidor HTTP próprio (`src/server/index.ts`). Esse servidor também hospeda o Socket.IO.

- **Estrutura**: cada endpoint é um arquivo `route.ts` dentro de uma pasta que espelha a URL.
- **Rotas dinâmicas**: pastas `[param]` para segmentos variáveis (ex.: `/api/sessions/[sessionId]`).
- **Camada antes do Next**: o servidor próprio aplica, antes de qualquer rota:
  - limite de tamanho do corpo (`MAX_UPLOAD_SIZE_MB`, resposta `413`);
  - limite de requisições por minuto (resposta `429`);
  - registro do IP real do cliente.

## 2. Análise da lógica principal

### 🔐 Autenticação e segurança

- **Autenticação unificada**:
  - `getAuthenticatedUser(req)` (`src/lib/api-auth.ts`) aceita o cookie de sessão do NextAuth (`authjs.session-token`) ou o cabeçalho `X-API-Key`.
  - Rotas sensíveis (gestão de usuários, troca de chave) usam `{ allowApiKey: false }` e exigem login no navegador.
- **Chaves de API**: armazenadas apenas como hash SHA-256. Chaves antigas em texto puro são convertidas automaticamente no primeiro uso.
- **Acesso a sessões**: `canAccessSession(userId, role, sessionId)` (`src/lib/session-access.ts`) aplica o controle de acesso por papel (RBAC):
  - `SUPERADMIN` acessa todas as sessões;
  - `OWNER` e `STAFF` acessam apenas as próprias sessões ou as compartilhadas com eles.
- **Revogação**: a cada requisição o JWT é revalidado contra o banco (papel e `sessionVersion`). Usuários excluídos ou com senha trocada perdem o acesso imediatamente.
- **Validação**: schemas Zod (`src/lib/validations.ts`) nos corpos de requisição críticos, como `createGroupSchema` e o broadcast.
- **URLs externas**: toda URL de mídia ou de webhook passa por `assertPublicHttpUrl` / `safeFetch` (`src/lib/safe-fetch.ts`), que bloqueia endereços internos (SSRF) e limita tamanho e tempo do download.

### 📡 Módulos principais

#### A. Gestão de sessões (`/api/sessions`)
- **Fluxo**: `POST` chama `waManager.createSession()`.
- **Lógica**:
  - o ID da sessão é validado (`^[a-zA-Z0-9_-]{3,50}$`) ou gerado com `crypto.randomBytes`;
  - conecta ao motor Baileys;
  - salva as credenciais criptografadas (AES-256-GCM) na tabela `AuthState`;
  - devolve o QR code ou o status da conexão.
- **Status**: ✅ Robusto

#### B. Motor de mensagens (`/api/chat`, `/api/messages`)
- **Recursos**: texto, mídia, localização, contatos, enquetes, listas, figurinhas, reações, respostas e encaminhamento.
- **Lógica avançada**:
  - **Figurinhas**: `POST /messages/{sessionId}/{jid}/sticker` baixa a imagem com segurança e a converte em WebP com `wa-sticker-formatter`.
  - **Broadcast**: `POST /messages/{sessionId}/broadcast` percorre os JIDs com atraso aleatório e grava histórico consultável.
  - **Mídia**: `resolveMediaPayload` baixa as URLs públicas http(s) com proteção contra SSRF e as converte em buffers antes de chamar o Baileys. Assim, nenhum valor `url` enviado pelo cliente pode ser interpretado como caminho de arquivo local.
- **Status**: ✅ Completo e trata casos de borda (ex.: `503` se a sessão estiver desconectada).

#### C. Grupos (`/api/groups`)
- **Acesso direto ao socket**: usa `instance.socket.groupCreate` e as atualizações de metadados do Baileys.
- **Consistência**: as alterações aparecem no WhatsApp imediatamente.
- **Status**: ✅ Integrado corretamente ao Baileys.

#### D. Webhooks (`/api/webhooks`)
- **Disparo**: mecanismo centralizado (`src/lib/webhook.ts`) com assinatura HMAC-SHA256 no cabeçalho `X-Webhook-Signature`.
- **Filtros**: por sessão e por tipo de evento.
- **Proteções**:
  - entrega via `safeFetch`, que revalida o destino a cada redirecionamento;
  - logs limitados a 500 por webhook e 30 dias;
  - o segredo nunca é devolvido em listagens.
- **Status**: ✅ Modelo de eventos flexível.

## 3. Avaliação da qualidade do código

- **Tratamento de erros**: blocos `try/catch` consistentes, com respostas JSON padronizadas (`{ status, message, error }`). Algumas rotas de grupos, perfil e monitoramento ainda devolvem `error.message` do Baileys ao cliente. Isso é útil para depurar, mas pode revelar detalhes internos.
- **Tipagem**: TypeScript completo com interfaces explícitas.
- **Manutenibilidade**: a lógica de negócio (Manager, Store, Auth) fica separada dos Route Handlers.

## 4. Recomendações

| # | Recomendação | Situação |
|---|--------------|----------|
| 1 | **Rate limiting** nos endpoints de alto tráfego | ✅ Implementado no servidor (`ENABLE_RATE_LIMITING`, `RATE_LIMIT_PER_MINUTE`) e no login/cadastro. O limite é em memória, então com várias instâncias use um limitador compartilhado (ex.: Redis) no proxy. |
| 2 | **Sanitização de entrada**: validar a fundo objetos JSON aninhados (ex.: mensagens de lista) | ⏳ Parcial: Zod cobre os principais endpoints, mas listas, enquetes e botões ainda dependem de validação manual. |
| 3 | **Documentação sincronizada** | ✅ A especificação OpenAPI (`src/lib/swagger.ts`) foi revisada para refletir apenas rotas existentes. Ao criar uma rota nova, atualize também a especificação. |
| 4 | **Correspondência `STARTS_WITH`** nas respostas automáticas | ⚠️ O painel oferece essa opção, mas o motor (`src/modules/whatsapp/store/autoreply.ts`) só implementa `EXACT`, `CONTAINS` e `REGEX`. Regras `STARTS_WITH` hoje nunca disparam. |

## 5. Conclusão

O diretório `/api` está bem organizado e, após a revisão de segurança da versão 1.6.4, cobre autenticação, autorização por sessão, proteção contra SSRF e limites de uso. Restam dois pontos: a validação profunda de mensagens interativas e a correção do modo `STARTS_WITH`.
