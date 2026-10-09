# Histórico de Alterações

Todas as mudanças relevantes do projeto ficam registradas aqui. O formato segue o [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/):
- **Adicionado**: recursos novos;
- **Alterado**: mudanças em recursos existentes;
- **Corrigido**: correções de bugs;
- **Segurança**: correções de vulnerabilidades.

## [Não lançado]

### Alterado
- **Nova identidade visual ("central de linhas")**: cada sessão é tratada como uma linha com sinal. Nova marca (três barras de sinal), fonte Instrument Sans, paleta verde com neutros levemente esverdeados nos dois temas e um verde vivo usado só para status ao vivo. Bordas no lugar de sombras, contraste WCAG AA conferido em todos os pares de cor.
- **Menu lateral**: a sessão ativa saiu da barra superior e fica no topo do menu, com o status visível. A conta virou um menu (papel, documentação da API, Swagger, versão e sair), os links de desenvolvedor saíram da lista principal e o grupo Administração começa recolhido, a não ser que a página atual esteja nele. O botão de recolher foi para a barra superior.
- **Painel**: as sessões aparecem primeiro, com indicador de sinal, status, ID e o próximo passo de cada uma (abrir as conversas ou reconectar). Os quatro cartões iguais viraram uma faixa de números (conectadas, mensagens nas últimas 24 h, respostas automáticas e envios agendados). Os "Próximos passos" mostram só o que falta na sua instalação.
- **Sessões**: lista primeiro e formulário de nova sessão depois. Ao criar uma sessão, o painel abre a página dela para ler o QR code.
- **Chat**: ocupa toda a área abaixo da barra superior. Balões enviados num verde claro (no lugar do verde sólido), horário legível, linhas da lista acessíveis pelo teclado e botões com rótulo para leitores de tela.
- **Página inicial, login e cadastro** redesenhados: título em fonte condensada, exemplo real do painel no lugar das bolhas de gradiente, recursos em lista e um exemplo de chamada da API. Os textos da página inicial foram reescritos nos 14 idiomas.
- **Larguras**: todas as páginas do painel usam a mesma largura máxima, então o título não muda de lugar ao trocar de página.
- **Legibilidade**: rótulos em caixa alta e textos de 9 a 10 px foram trocados por texto normal de 11 a 12 px. Cores fixas fora da paleta viraram tokens do tema.
- **Relógio da barra superior**: mostra hora e cidade do fuso das Configurações (padrão `America/Sao_Paulo`).

### Corrigido
- **Páginas de erro em indonésio**: a página 404, a de erro inesperado e a de `/error?code=` estavam em indonésio. Agora seguem o idioma escolhido (14 idiomas), dizem o que aconteceu e o que fazer.
- **Fuso horário padrão**: o padrão era `Asia/Jakarta` (herdado do projeto original) no relógio, no agendador, nas configurações, no `docker-compose.yml` e no `.env.example`. Agora é `America/Sao_Paulo`.
- **Mensagens recorrentes no fuso errado**: o agendador calculava a próxima data das mensagens recorrentes sempre em `Asia/Jakarta`. Agora usa o fuso das Configurações.
- **Horário dos logs de webhook**: era exibido sempre no fuso de Jacarta. Agora usa o fuso do navegador.
- **Chat de grupo ao recarregar**: o endereço da conversa guardava só o número, e um grupo virava conversa privada ao recarregar a página ou voltar no navegador. O endereço agora guarda o JID completo dos grupos.
- **Número com 0 na frente**: ao abrir uma conversa nova, um número digitado com 0 recebia o código de país da Indonésia (62). Agora recebe o do Brasil (55).
- **Documentação da API**: o código em linha não mostra mais crases literais, e o índice não exibe "No subsections" nas seções sem subtópicos.
- **Tema nas páginas públicas**: a página inicial, o login, o cadastro e a documentação (`/docs`) agora têm o seletor de tema, que antes só aparecia no painel.
- **Documentação no modo escuro**: títulos, parágrafos, listas e links da `/docs` usam as cores do tema e ficam legíveis no escuro. O cabeçalho dos blocos de código ganhou contraste, e os blocos com rolagem podem ser focados pelo teclado.
- **Contraste no tema claro**: os tons de verde, vermelho, amarelo e azul ficaram um pouco mais escuros, e o texto colorido sobre o próprio fundo claro (selos e avisos) passa no WCAG AA.

### Removido
- **Referências ao projeto original (WA-AKG)**: o README não aponta mais para o repositório e o pacote n8n do autor original (a seção do n8n agora explica a integração com os nós HTTP Request e Webhook), e o `package.json` não lista mais o autor original como colaborador. O aviso de copyright continua no `LICENSE`, como exige a licença MIT.
- **Nome padrão do banco**: passou de `wa_akg` para `w_azap` no `docker-compose.yml`, no `.env.example` e na documentação. Quem já usa Docker com o banco antigo deve definir `MYSQL_DATABASE="wa_akg"` no `.env` para continuar usando os dados existentes.

## [v2.1.0] - 2026-10-09

### Adicionado
- **Encaminhar por e-mail** (Automação → Encaminhar por e-mail): cada nova mensagem das conversas privadas chega por e-mail em tempo real, com todos os dados do contato (nome, telefone, nome no WhatsApp, nome comercial, JID/LID, etiquetas, totais e demais dados do WhatsApp), as últimas mensagens da conversa e a mídia anexada (até 10 MB). Grupos e o histórico sincronizado não são encaminhados. Configuração por sessão com SMTP próprio (atalhos para Gmail, Outlook, Yahoo e iCloud), até 5 destinos, opção de incluir as mensagens enviadas, botão de e-mail de teste e status no painel (enviados, último envio, último erro). Os e-mails de uma conversa compartilham o cabeçalho `References`, e os clientes que agrupam por ele mostram tudo num só fio. Rotas `GET/POST /api/sessions/{id}/email-forward` e `POST /api/sessions/{id}/email-forward/test`.
- **Instalador para macOS** (`scripts/instalador/instalar-macos.sh`): instala o W-AZAP com um comando (`curl … | bash`) ou com dois cliques (`Instalar W-AZAP.command`), sem Homebrew, Docker ou senha de administrador. Baixa o Node.js 22 e o MySQL 8.4 portáteis (com SHA-256 conferido), gera o `.env` com chaves aleatórias, cria o banco e um usuário próprio, faz o build e registra dois serviços no `launchd` que iniciam no login. Rodar de novo atualiza e mantém a configuração e os dados. Inclui o comando `w-azap` (status, abrir, parar, iniciar, log, atualizar, desinstalar) e o app **W-AZAP** em `~/Applications`.
- **Workflow `instalador-macos.yml`**: anexa a cada release publicada o `instalar-macos.sh`, o `W-AZAP-instalador-macos.zip` e os checksums.

### Segurança
- **Encaminhar por e-mail**: só o dono da sessão (ou SUPERADMIN) lê ou altera o destino, e a gravação exige login no navegador (não aceita chave de API). A senha do SMTP é guardada com AES-256-GCM e nunca volta nas respostas. A conexão SMTP exige TLS, o servidor é resolvido uma única vez (contra DNS rebinding) e endereços internos são bloqueados, a menos que `ALLOW_PRIVATE_WEBHOOK_URLS="true"`. O conteúdo das mensagens é escapado no HTML do e-mail, e há um limite de 300 e-mails por hora por sessão.

## [v2.0.0] - 2026-10-09

Primeira versão do **W-AZAP**, fork do WA-AKG v1.6.4. A versão principal mudou porque há mudanças incompatíveis: as variáveis `NEXT_PUBLIC_SWAGGER_*` não são mais usadas, o servidor escuta só em `127.0.0.1` por padrão, as rotas de usuários deixaram de aceitar chave de API e o cadastro público vem desativado.

### Adicionado
- **Tema claro, escuro e automático**: seletor na barra superior. A escolha fica salva no navegador, vale para todas as abas abertas e, no modo automático, acompanha o sistema operacional. Um script aplica o tema antes da primeira pintura, então a página não pisca com o tema errado.
- **Novo visual do painel**: tokens de cor semânticos (`success`, `warning`, `info`) com contraste WCAG AA nos dois temas, componentes `PageHeader` e `EmptyState` compartilhados entre as páginas e menu lateral e menu móvel gerados a partir de uma única configuração (`nav-config.ts`).
- **Acessibilidade**: link "Pular para o conteúdo", rótulos nos botões de menu e de fechar e respeito a `prefers-reduced-motion` na troca de tema.
- **Seletor de idiomas**: botão no canto superior direito de todas as telas (login, cadastro, painel) com 14 idiomas: inglês, português (Brasil), espanhol, francês, alemão, italiano, russo, chinês simplificado, japonês, coreano, árabe, hindi, indonésio e turco. O idioma é detectado pelo navegador (`Accept-Language`) e a escolha fica salva no cookie `NEXT_LOCALE`.
- **Painel traduzido**: todas as páginas internas (sessões, chat, transmissão, grupos, contatos, etiquetas, agendador, respostas automáticas, webhooks, usuários, configurações, monitor do sistema etc.) usam dicionários tipados em `src/lib/i18n/dictionaries/dashboard/`. Datas são formatadas no idioma escolhido (locales do `date-fns`).
- **Página de sessão expirada** (`/auth/expired`): encerra o login de forma limpa quando a sessão é revogada ou expira.
- **Repositório próprio** ([marloon-dev/w-azap](https://github.com/marloon-dev/w-azap)):
  - CI no GitHub Actions (lint, tipagem, build e verificação da documentação da API);
  - análise de segurança com CodeQL;
  - Dependabot (com o Baileys e os majors do Prisma fixados);
  - Release Drafter, templates de issue e PR em português, `CODE_OF_CONDUCT.md`, `CODEOWNERS`, `.editorconfig`, `.gitattributes` e `.nvmrc`;
  - scripts `npm run typecheck` e `npm run docs:generate`.
- **Novas variáveis de ambiente**: `BIND_HOST`, `TRUST_PROXY`, `DATA_ENCRYPTION_KEY`, `ALLOW_PRIVATE_WEBHOOK_URLS` e `SOCKET_ALLOWED_ORIGINS` (veja `docs/ENVIRONMENT_VARIABLES.md`).

### Alterado
- **Novo nome**: o projeto passou de **WA-AKG** para **W-AZAP** em toda a interface, nos logs, no Docker (`w-azap-db`, `w-azap-app`) e no PM2 (`w-azap`). Links e créditos do projeto original foram mantidos.
- **Documentação em português**: todos os arquivos `.md` foram traduzidos para pt-BR e revisados para refletir o estado atual do sistema. A especificação OpenAPI também foi traduzida e corrigida: foram removidas as rotas inexistentes (`/status/update`, `/scheduler`, `/groups/{jid}/subject`, `/groups/{jid}/leave`, `/chats/by-label/{labelId}`) e documentadas as rotas que faltavam (monitor do sistema, mídia, contatos, etiquetas por conversa).
- **Dependências atualizadas**: Next.js 16.4, Socket.IO 4.8, NextAuth 5 beta.32 e `overrides` de segurança para `protobufjs`, `ws`, `axios`, `image-size`, `music-metadata`, `nanoid`, `postcss`, `engine.io`, `socket.io-parser` e outros.
- **Chave de API**: exibida uma única vez após a geração; depois o painel mostra apenas o início dela.
- **Cadastro público** desativado por padrão (`enableRegistration = false`). A primeira conta de uma instalação nova sempre pode se cadastrar e vira `SUPERADMIN`.
- **Senha mínima** passou de 6 para 8 caracteres.
- **Verificação de atualizações** restrita ao `SUPERADMIN`, com cache de 1 hora para a API do GitHub.

### Removido
- **Heartbeat / telemetria**: o servidor não envia mais dados de uso ao servidor do autor original (`api-wa-akg.aikeigroup.net`).
- **Senha fixa do Swagger**: `NEXT_PUBLIC_SWAGGER_USERNAME` e `NEXT_PUBLIC_SWAGGER_PASSWORD` deixaram de ser usadas. O Swagger UI (`/swagger`), a especificação (`/api/docs`) e a documentação (`/docs`) passaram a exigir login normal.

### Segurança
- **Socket.IO autenticado**: toda conexão exige o cookie de login ou uma chave de API; apenas origens permitidas são aceitas (inclusive no upgrade para WebSocket). Entrar em salas de sessão exige permissão (`canAccessSession`), e cada usuário só entra na própria sala de notificações. Antes, qualquer pessoa podia receber QR codes e mensagens de qualquer sessão.
- **Escuta local por padrão**: o servidor escuta em `127.0.0.1` (`BIND_HOST`). O MySQL do Docker foi preso a `127.0.0.1:3306`.
- **Chaves de API com hash**: armazenadas como SHA-256, com migração automática das chaves antigas no primeiro uso.
- **Sessões do WhatsApp criptografadas**: a tabela `AuthState` usa AES-256-GCM com AAD por sessão/chave; as linhas antigas são criptografadas na inicialização.
- **Revogação de login**: o JWT é revalidado no banco a cada requisição (papel e `sessionVersion`). Trocar a senha, o e-mail ou o papel, ou excluir o usuário, encerra as sessões abertas.
- **Força bruta**: login limitado (5 tentativas por conta e 20 por IP a cada 15 min), cadastro limitado (10 por IP por hora) e rate limit global da API (`RATE_LIMIT_PER_MINUTE`, com respostas `429` e `Retry-After`).
- **Sem enumeração de contas**: login e cadastro devolvem mensagens genéricas e o login leva o mesmo tempo para e-mails existentes ou não.
- **SSRF**: webhooks, teste de webhook e URLs de mídia passam por `safeFetch`, que bloqueia IPs privados, loopback, link-local e metadados de nuvem e revalida cada redirecionamento.
- **Leitura de arquivos locais**: payloads de mídia (`{ url }`) não podem mais apontar para caminhos do disco. Antes, o Baileys aceitava caminhos locais nas rotas de resposta, no cron e nas respostas automáticas.
- **Limite de upload**: `MAX_UPLOAD_SIZE_MB` agora é aplicado no servidor (resposta `413`), nos uploads multipart e nos downloads de mídia.
- **IDOR**: corrigida a edição de respostas automáticas de outras sessões. Mídia sem sessão identificável ficou restrita ao `SUPERADMIN`.
- **Segredos ocultos**: listagens de sessões não devolvem mais segredos de webhook. A chave do remove.bg passou a ser somente gravação (mascarada) e só o dono da sessão pode alterá-la.
- **IDs de sessão**: validados (`^[a-zA-Z0-9_-]{3,50}$`) e, quando gerados automaticamente, aleatórios (`crypto.randomBytes`).
- **ffmpeg**: executado via `execFile` (sem shell), com tempo limite, tamanho máximo de 20 MB e nomes temporários aleatórios.
- **Cabeçalhos HTTP**: CSP, `X-Frame-Options: DENY`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `Cross-Origin-Opener-Policy` e HSTS (em HTTPS); o cabeçalho `X-Powered-By` foi removido.
- **Gestão de usuários**: rotas de usuários não aceitam mais chave de API, só login no navegador.

### Corrigido
- **Patch do Baileys ausente no Docker**: o `.dockerignore` excluía `*.patch`, e a imagem era gerada sem o patch. Os dados de execução (`data/`, `.dev-mysql/`) também deixaram de entrar no contexto do build.
- **Verificação de atualizações**: avisava sobre "nova versão" sem comparar com a versão instalada. Agora compara as versões e consulta o repositório do W-AZAP.
- **ESLint**: o débito herdado (`any` explícito e regras do React Compiler) passou a gerar avisos, e o falso positivo de `rules-of-hooks` em `usePrismaAuthState` foi desativado. O lint termina sem erros.
- **Arquivos de depuração** herdados (logs de erro, saídas de lint, scripts de teste soltos e o `middleware.ts` antigo, substituído por `src/proxy.ts`) foram removidos do repositório.
- **Telas presas em "Carregando…" no modo de desenvolvimento**: os upgrades de WebSocket do HMR do Next.js eram descartados pelo Socket.IO; agora são repassados ao Next.
- **Admin no Docker**: corrigido um erro de sintaxe no `Dockerfile` (`[ -n "$ADMIN_EMAIL"]`, sem espaço antes do `]`) que impedia a criação automática do Super Admin.

## [v1.6.4] - 2026-07-12

### Adicionado
- **URL direta de conversa** (#85): nova rota `/dashboard/chat/[jid]` que abre uma conversa direto pelo número de telefone. A URL acompanha a conversa selecionada na lista.

### Alterado
- **Otimização dos logs de webhook**:
  - o campo `raw: message` foi removido do payload, reduzindo o armazenamento;
  - o `responseBody` é cortado em 1 KB;
  - uma limpeza automática apaga logs com mais de 30 dias e mantém no máximo 500 por webhook.

### Corrigido
- **Foco na resposta** (#84): a caixa de resposta recebe o foco automaticamente ao clicar na seta de responder ou ao usar "Responder" no menu de contexto.

## [v1.6.3] - 2026-06-30

### Adicionado
- **Implantação automatizada**: script `start.sh` que configura o PM2, verifica conflito de porta logo no início, confere se já existe um admin e avisa, ao final, sobre credenciais padrão no `.env`.
- **Agendamentos recorrentes**: o agendador passou a aceitar mensagens recorrentes a cada X minutos, a cada X horas, em dias específicos da semana ou por expressão cron personalizada.
- **Tipos de JID no agendador**: seletor para escolher conversa pessoal, grupo ou canal (newsletter) sem digitar os sufixos (`@s.whatsapp.net`, `@g.us`, `@newsletter`).
- **Respostas automáticas e agendamentos só com mídia**: os dois recursos permitem enviar apenas mídia (imagens, vídeos, documentos), sem texto.

### Alterado
- **Novo visual**: a tabela de sessões foi modernizada e as páginas de erro foram redesenhadas.
- **UX do agendador**: os campos de "Enviar em" aparecem ou mudam conforme o tipo de agendamento (único, recorrente ou em dias específicos).
- **Ambiente e PM2**: o `PORT` fixo foi removido do `ecosystem.config.js` (vale o `.env`) e o `.env.example` foi reorganizado.
- **Licença**: o projeto passou a usar a licença MIT padrão.
- **Documentação**: especificação Swagger, `API_DOCUMENTATION.md` e `UPDATE_GUIDE.md` atualizados com o fluxo do `start.sh`, as respostas da API de sessões e as novas propriedades de agendamento.

### Corrigido
- **Erro de validação da API**: a API do agendador recusava POST/PUT com `400 Bad Request` quando o texto estava vazio, mesmo havendo URL de mídia.
- **Carregamento do ambiente**: as variáveis de ambiente não eram carregadas corretamente no modo de desenvolvimento.
- **Hidratação do React**: corrigidas divergências de hidratação e erros de inferência do TypeScript nas páginas de erro.

## [v1.6.2] - 2026-06-28

### Adicionado
- **Logs e teste de webhook**: endpoints e janela próprios para testar e acompanhar as entregas em tempo real, com atualização automática e paginação "carregar mais" (#67).
- **Campo `receiver` no webhook**: adicionado aos eventos `message.received` e `onMessageReceived` (#58).
- **Templates do GitHub**: templates de issue e de PR, `SECURITY.md`, `CODEOWNERS` e `FUNDING.yml`.

### Alterado
- **Troca de conversa sem piscar**: a interface do chat continua montada enquanto as mensagens carregam.
- **Interface dos logs de webhook**: layout mestre-detalhe, área melhor para ver o JSON e correção de estouro e rolagem.
- **Build multiestágio no Docker**: `Dockerfile` refeito em vários estágios, com `.dockerignore`, limpeza de cache e remoção das dependências de desenvolvimento.
- **Versão do Node**: de 20-alpine para 26-alpine (#63, #64, #62).
- **Compatibilidade com React 19**: `--legacy-peer-deps` no `npm ci` do Dockerfile por causa do `swagger-ui-react`.
- **Visual da documentação**: blocos de código da página `/docs` em estilo minimalista (inspirado no Stripe).
- **Swagger**: atualizado para v1.6.1, com exemplos completos de payload de webhook.
- **CI**: workflows enxugados, mantendo apenas os templates e o dependabot.

### Corrigido
- **Título da aba**: passa a seguir o nome do aplicativo definido nas configurações do sistema (#71).
- **Foco automático no chat**: o campo de mensagem não recebia foco ao trocar de conversa por um conflito de desmontagem no carregamento (#70).
- **Logs de webhook**: corrigidos o fuso horário dinâmico, um bug de closure desatualizada no polling e a altura da janela.
- **Autenticação e segurança**: correções críticas de autenticação e resolução correta da sessão nos endpoints de teste e de logs.
- **Página `/docs`**: blocos de código ficavam invisíveis.
- **Sufixo do JID**: removido o sufixo de dispositivo (`:47`) do próprio JID nos campos `receiver`/`from` do webhook.
- **Webhooks do Super Admin**: webhooks criados por superadmins não disparavam nem apareciam para o dono da sessão. Agora o dono pode gerenciá-los por completo: editar, ativar ou desativar, testar, ver logs e excluir.

## [v1.6.1] - 2026-06-27

### Corrigido
- **Webhook não disparava para mensagens enviadas** (#57):
  - disparo explícito após o `sendMessage()` em `ChatService.sendTextMessage()` e `ChatService.sendMediaMessage()`;
  - o mesmo disparo foi adicionado a todas as rotas de mensagem (contato, localização, enquete, resposta, figurinha);
  - o sistema não depende mais do evento `messages.upsert` do Baileys, que era frágil.
- **Destinatário no payload** (#58): campo `receiver` explícito no webhook `message.sent`.
- **Campos de chave vazios no webhook**: corrigida a confusão de tipos entre `WAMessage` e `MessageKey` do Baileys. Agora o `MessageKey` é extraído do `WAMessage` retornado antes de ir para o webhook.

### Alterado
- **Versão do Swagger**: de v1.3.0 para v1.6.1, com a contagem de endpoints corrigida para 91.
- **Documentação**: 15 exemplos de payload de webhook no `API_DOCUMENTATION.md`, cobrindo todos os tipos de evento (`message.received`, `message.sent`, `message.status`, `message.deleted`, `message.edited`, `connection.update`, `group.update`, `group.participant`, `contact.update`, `status.update`).

## [v1.6.0] - 2026-06-23

### Adicionado
- **Caixa de entrada** (`/dashboard/inbox`): leitor de notificações do usuário com filtros (todas, não lidas, lidas), marcar como lida, excluir e navegação ao clicar.
- **Respostas a mensagens**: a barra de resposta mostra uma prévia da mensagem original, e a resposta é enviada como citação via `contextInfo` do Baileys.
- **Menu de contexto (botão direito)**:
  - nos balões de mensagem: Responder, Copiar, Excluir e Informações;
  - na lista de conversas: Abrir conversa e Copiar JID.
- **Etiquetas na lista de conversas**: pontos coloridos ao lado do nome indicam as etiquetas, sempre visíveis.
- **Atribuir etiquetas pela lista**: botão em cada conversa abre um popover para marcar e desmarcar etiquetas.
- **API de etiquetas por JID**: `GET /api/labels/[sessionId]/chats?jid=` devolve as etiquetas de uma conversa específica.
- **Atalhos de teclado** na janela de chat: `Esc` cancela a resposta e `?` mostra a ajuda.
- **Histórico de transmissões**: os envios ficam salvos no banco (`BroadcastLog` e `BroadcastRecipient`), com aba de histórico e janela de detalhes.
- **SEO**:
  - metadados completos (Open Graph, Twitter, palavras-chave, canonical);
  - `robots.ts` e `sitemap.ts` condicionados a `NEXT_PUBLIC_ALLOW_INDEXING`;
  - estrutura pronta para JSON-LD.
- **Tamanho da paginação configurável**: `NEXT_PUBLIC_CHAT_PAGE_SIZE` define quantas conversas são carregadas por página (padrão: 50).

### Alterado
- **Limite de reconexão (otimização de RAM)**: no máximo 3 tentativas por sessão; depois disso, a sessão para sozinha e sai do gerenciador de memória.
- **Sessões começam paradas**: sessões novas não abrem o socket automaticamente. O status fica `STOPPED` até o usuário clicar em Iniciar.
- **Sessões ociosas ignoradas**: `loadSessions()` não restaura sessões sem credenciais (que nunca se conectaram).
- **Limpeza de memória**: instâncias saem do `Map` do gerenciador em `LOGGED_OUT`, em `STOPPED` ou ao estourar o limite de reconexões. Não sobram instâncias órfãs.
- **Anti-exclusão**: a opção `antiDelete` passa a preservar o conteúdo original, em vez de sempre trocá-lo pelo marcador de mensagem apagada.
- **Desempenho: página de documentação**: o `react-syntax-highlighter` (mais de 200 KB) foi trocado por blocos `<pre>` leves com botão de copiar.
- **Desempenho: paginação por cursor na lista de conversas**:
  - o OFFSET, que quebrava com as atualizações em tempo real, foi trocado por cursor (`m1.timestamp < ?`);
  - a consulta SQL ganhou `LIMIT ?` e não busca mais todas as mensagens.
- **Desempenho: N+1 nas etiquetas**: os pontos de etiqueta usam uma única chamada em lote em vez de N chamadas.
- **Posição do botão de resposta**: à esquerda nas suas mensagens e à direita nas dos outros.
- **Somente inglês**: os textos que ainda estavam em indonésio nas páginas de transmissão, etiquetas e configurações do bot foram traduzidos para inglês.
- **Chat Service**:
  - o parâmetro `offset` de `getChatsList` virou `before` (cursor);
  - a busca de contatos e grupos ficou limitada aos JIDs do resultado.
- **API de etiquetas em lote**: `GET /api/labels/[sessionId]/chats` sem parâmetros devolve todas as atribuições em uma consulta.
- **Documentação da API**: endpoints de 64 para 68, incluindo os novos de histórico de transmissão.
- **Indicador de não lida**: o ponto de notificação passou a usar `h-2 w-2` com `ring`, em visual mais moderno.
- **Lista de conversas**: rolagem virtual com Virtuoso, carregamento sob demanda de mídia e `IntersectionObserver` para imagens e vídeos.

### Corrigido
- **Erro 405 nas configurações da sessão**: a interface enviava POST para uma rota que só aceita PATCH.
- **Bug "Nenhuma conversa atribuída" nas etiquetas**: endpoint errado (`/list/{id}`) corrigido para `/chats?labelId={id}`.
- **Estouro da barra de resposta**: mensagens longas empurravam o botão de fechar (X) para fora da tela; foram adicionados `overflow-hidden` e `w-full truncate`.
- **Notificações cortadas**: removido o `line-clamp-2`; o texto completo aparece na caixa de entrada e no popover.
- **`confirm()` nativo substituído**: a confirmação de exclusão na janela de chat passou a usar o `AlertDialog` do shadcn.
- **Declaração duplicada de `canAccess`**: corrigido o erro de build do TypeScript na rota de conversas por etiqueta.
- **Tabelas estourando no celular**: `whitespace-nowrap` trocado por `whitespace-normal` nas células.
- **Método errado nas configurações do bot**: a interface usava `POST` em vez de `PATCH` ao salvar.
- **Pico de CPU na lista de conversas**: a consulta SQL não tinha `LIMIT`; foi adicionado junto com a paginação por cursor.
- **Erro de build**: restaurado o import de `normalizeJid` no chat service.
- **Favicon sumido**: removidos caminhos de ícone inexistentes; o Next.js volta a gerar o ícone sozinho.
- **Lista de conversas embaralhando na rolagem**: itens trocavam de lugar ou mostravam o nome do contato errado; foi aplicado `key={chat.jid}` estável.
- **Concorrência na rolagem infinita**: trava `fetchingRef` durante a paginação, evitando buscas paralelas duplicadas.
- **Debounce da busca**: o texto digitado foi separado do estado da consulta, para que o atraso seja respeitado antes de consultar o banco.
- **Respostas não salvas**: o `quoteId` passou a ser extraído e salvo nas mensagens recebidas e enviadas. A leitura do JID do destinatário também foi corrigida (ele era serializado com domínio duplicado), e as mensagens voltaram a chegar como respostas.
- **Rolagem até a mensagem citada**: prévia da citação dentro do balão; clicar nela rola até a mensagem original e a destaca com animação.

### Desempenho
- **Tamanho do bundle**: a dependência `react-syntax-highlighter` foi removida e a página de documentação carrega bem mais rápido.
- **Memória das sessões**: sessões ociosas ou desconectadas não mantêm mais o socket na RAM.
- **Excesso de logs**: o loop infinito de reconexão foi interrompido, e as sessões desconectadas pararam de inundar o log.

### Banco de dados
- **Novos modelos**: `BroadcastLog` e `BroadcastRecipient`, para o histórico persistente de transmissões (com exclusão em cascata).
- **Índice**: `@@index([sessionId, remoteJid, timestamp])` na tabela `Message`, para acelerar consultas com GROUP BY.

---

## [v1.5.5] - 2026-06-03

### Adicionado
- **Edição de mensagens**: novo endpoint `PATCH /api/messages/[sessionId]/[jid]/[messageId]` para editar mensagens de texto enviadas.

### Alterado
- **Limpeza de endpoints obsoletos**: mais de 45 endpoints antigos foram removidos do código. A especificação Swagger e o `API_DOCUMENTATION.md` foram regenerados para refletir as 81 rotas ativas.

### Corrigido
- **Gestão de webhooks**: não era possível editar nem excluir webhooks. O backend agora localiza a sessão tanto pelo CUID interno quanto pelo identificador externo.
- **Fuso horário**: o fuso definido nas configurações não era respeitado na lista do agendador nem no relógio da barra superior, que usavam o fuso do navegador. Agora os dois seguem o fuso configurado no sistema.

---

## [v1.5.4] - 2026-05-21

### Adicionado
- **Docker**: `Dockerfile` multiestágio para empacotar e compilar a aplicação Next.js.
- **Fusos horários dinâmicos**: a lista fixa de fusos nas configurações foi trocada por uma lista gerada com a API `Intl` do navegador.
- **Edição em janelas modais**: a edição de webhooks, agendamentos, etiquetas e respostas automáticas saiu dos formulários em linha e passou para janelas `Dialog`.

### Corrigido
- **Reforço de segurança**:
  - bloqueado IDOR (referência direta insegura a objetos) em webhooks (PUT/DELETE), agendador (PUT) e monitor do sistema (GET), exigindo que o usuário seja dono da sessão;
  - removido o SQL bruto (`queryRawUnsafe`) do módulo anti-spam, trocado pela API segura e tipada do Prisma Client.
- **Mídia com legenda**: o envio de mídia pelo Baileys foi ajustado: URLs são baixadas para buffers e enviadas com a legenda normalizada.
- **Ajustes de interface**:
  - o seletor de sessão na barra superior foi redesenhado, com status da conexão e versão para celular;
  - a barra lateral passou a esconder os itens que o papel do usuário não permite;
  - corrigidas tags JSX desbalanceadas na página de configurações do bot e problemas de tipagem no filtro de navegação.

---

## [v1.5.3.3] - 2026-04-19

### Corrigido
- **Patch nativo para mídia de canais**: o script manual `patch-baileys.js` foi substituído pelo sistema padrão `patch-package`. A correção do download de mídia não criptografada de canais (newsletters), que resolvia o "HTTP 400 Bad Request" persistente ao baixar mídia de Canais do WhatsApp, passou a ser aplicada pelo gerenciador de pacotes e não se perde mais em novos `npm install` ou deploys.

---

## [v1.5.3.2] - 2026-04-19

### Corrigido
- **[CRÍTICO] Falha no endpoint de upload de mídia para canais**: bug no escopo de arrow functions do ES6 dentro do Baileys (`arguments[1].newsletter`). Ele fazia o payload de mídia dos canais pular as rotas de CDN `/newsletter/newsletter-*`. Agora todos os uploads passam pelo pipeline não criptografado do CDN de canais, em vez do caminho criptografado padrão, o que elimina os downloads com `400 Bad Request`.
- **Travamento do app com PNG**: validação rígida no servidor, na API de mídia, bloqueando PNG e outros formatos que não sejam JPEG em Canais do WhatsApp. O app do WhatsApp no celular trava ou recusa esses arquivos quando enviados direto ao CDN não criptografado; em vez de falhar em silêncio, a API agora devolve um erro claro para a interface.
- **Erro de desestruturação da conexão no webhook**: removidas as chamadas instáveis a `sock.requestMediaConn()`, que causavam `500 Server Error` no webhook quando a obtenção da mídia precisava de fallback.

---

## [v1.5.3.1] - 2026-04-18

### Corrigido
- **Webhook travando com mídia de canais**: enviar mídia não criptografada para um Canal do WhatsApp derrubava o webhook (`Cannot derive from empty media key`). Agora o arquivo é baixado com segurança direto dos servidores MMG do WhatsApp usando o `directPath`.
- **Mídia em canais (erro 479) e falhas silenciosas**: o script de patch do Baileys foi refeito para implementar por completo as correções do PR oficial `#2434` para Canais. O patch de `postinstall`, baseado em RegEx:
  - redireciona os uploads para `/newsletter/newsletter-*`;
  - acrescenta `server_thumb_gen=1`;
  - força `url: null` em objetos não criptografados;
  - mapeia os hashes de miniatura corretos;
  - define os nós `mediatype`.

  Isso resolve as recusas misteriosas de ACK com "Error 479" e as falhas silenciosas ao enviar mídia para canais.

---

## [v1.5.3] - 2026-04-08

### Adicionado
- **Comunidades do WhatsApp**: campos `isCommunity` e `linkedParentJid` nos metadados de grupo, com reconhecimento e armazenamento automático das Comunidades na sincronização de grupos.
- **Novos eventos de webhook**: `group.update`, `group.participant`, `message.edited` e `message.deleted`, para acompanhar em tempo real ações específicas do WhatsApp.
- **Arrastar e soltar mídia**: área de arrastar e soltar na janela de chat para enviar imagens, vídeos, áudios e documentos na hora.
- **Melhorias no download de mídia**: botões "Baixar" na janela de chat e aviso interativo de "Baixando...".
- **Webhooks em sessões compartilhadas**: os webhooks passam a ser disparados para todos os usuários com `SessionAccess`, e não só para o dono original da sessão.
- **Atribuição de conversas a etiquetas**: a página de Etiquetas ganhou cartões expansíveis com as conversas atribuídas e um seletor de contatos para atribuir ou remover conversas.
- **API de conversas por etiqueta**: novo endpoint `GET /api/labels/[sessionId]/chats?labelId=` que devolve as conversas de uma etiqueta com o nome do contato.

### Alterado
- **Logger colorido no console**: todos os `console.log` e `console.error` do backend foram trocados por um módulo `logger` próprio, com cores.

### Corrigido
- **Interface de webhooks**: os eventos `message.edited`, `message.deleted` e `group.participant` foram adicionados à lista de assinaturas disponíveis.
- **Mensagens iniciais sumindo na sincronização**: as primeiras mensagens de conversas novas eram ignoradas quando vinham dentro de mensagens de protocolo (como edição ou revogação).
- **Grupos sem nome na lista de conversas**: `ChatService.getChatsList` passou a buscar no modelo `Group`, e os grupos não aparecem mais como números de telefone em branco.
- **Paginação do histórico do chat**:
  - a janela de chat carregava as 100 mensagens mais antigas, em vez das mais recentes;
  - corrigida a divergência entre JIDs `.us` e `.net` nos WebSockets em tempo real.
- **Estatísticas de desconexão no painel**: o Monitor do Sistema passou a contar como desconectado tudo o que não for `CONNECTED` (ex.: `LOGGED_OUT`, `SCAN_QR`), buscando o histórico do banco quando a sessão está offline.
- **Nomes em conversas privadas**: o nome do remetente não aparece mais acima dos balões em conversas privadas, só em grupos.
- **Melhorias para celular**:
    - `<p>` trocado por `<SheetDescription>` no menu móvel, eliminando avisos de acessibilidade do Radix UI;
    - relógio e divisor ocultos em telas pequenas e seletor de sessão mais estreito;
    - cabeçalho da página de detalhes da sessão responsivo, com `flex-wrap`.
- **Paginação de contatos**: opções de limite exageradas (até 3000) substituídas por 10/25/50/100/Todos.

---

## [v1.5.3-beta.3] - 2026-04-08

### Corrigido
- **Interface de webhooks**: os eventos `message.edited`, `message.deleted` e `group.participant` foram adicionados à lista de assinaturas, igualando-a aos eventos que o backend realmente dispara.

---

## [v1.5.3-beta.2] - 2026-04-03

### Adicionado
- **Comunidades do WhatsApp**:
    - campos `isCommunity` e `linkedParentJid` no schema de metadados de grupo;
    - reconhecimento e armazenamento automático das Comunidades na sincronização de grupos.
- **Novos eventos de webhook**:
    - `group.update` (mudança de nome, descrição ou foto do grupo);
    - `group.participant` (entrada, saída, promoção ou rebaixamento de participantes);
    - `message.edited` e `message.deleted` (revogação), para acompanhar alterações em mensagens em tempo real.
- **Arrastar e soltar mídia**:
    - área de arrastar e soltar na janela de chat para enviar imagens, vídeos, áudios e documentos na hora.
- **Melhorias no download de mídia**:
    - botões "Baixar" para imagens, vídeos, áudios e documentos na janela de chat;
    - aviso interativo de "Baixando...".
- **Webhooks em sessões compartilhadas**:
    - os webhooks passam a ser disparados para todos os usuários com `SessionAccess`, e não só para o dono original da sessão.

### Corrigido
- **Mensagens iniciais sumindo na sincronização**:
    - as primeiras mensagens de conversas novas eram totalmente ignoradas porque o Baileys as embrulhava em mensagens de protocolo (como edição ou revogação).
- **Grupos sem nome na lista de conversas**:
    - os grupos apareciam como números de telefone em branco no painel. `ChatService.getChatsList` passou a buscar no modelo `Group`, mostrando o nome correto.
- **Paginação do histórico do chat**:
    - a janela de chat carregava as **100 mensagens mais antigas** em vez das mais recentes (o `orderBy` de timestamp era crescente). Agora as mais recentes carregam de forma confiável;
    - corrigidas as divergências de JID `.us` e `.net` nos WebSockets em tempo real, e as mensagens recebidas entram certinho na janela aberta.
- **Estatísticas de desconexão no painel**:
    - o Monitor do Sistema passou a agrupar como desconectado tudo o que *não* for `CONNECTED` (ex.: `LOGGED_OUT`, `SCAN_QR`).
- **Nomes em conversas privadas**:
    - o nome do remetente não aparece mais acima dos balões em conversas privadas, só em grupos.

---

## [v1.5.3-beta.1] - 2026-03-22

### Corrigido
- **Aviso de acessibilidade no `SheetContent`**: `<p>` trocado por `<SheetDescription>` no menu móvel, corrigindo o aviso de `aria-describedby` do Radix.
- **Barra superior estourando no celular**: relógio e divisor ocultos em telas pequenas e seletor de sessão mais estreito.
- **Cabeçalho da página de detalhes da sessão**: responsivo, com `flex-wrap` no celular.
- **Estatísticas de desconexão zeradas**: a API do monitor do sistema passou a consultar as contagens reais do banco mesmo com a sessão offline.
- **Paginação de contatos**: opções de limite exageradas (até 3000) substituídas por 10/25/50/100/Todos. A API passou a aceitar `limit=all`.

### Adicionado
- **Atribuição de conversas a etiquetas**: cartões expansíveis na página de Etiquetas com as conversas atribuídas e seletor de contatos para atribuir ou remover conversas.
- **API de conversas por etiqueta**: novo endpoint `GET /api/labels/[sessionId]/chats?labelId=` que devolve as conversas de uma etiqueta com o nome do contato.

### Alterado
- **Logger colorido no console**: todos os `console.log`, `console.warn` e `console.error` do motor do WhatsApp, do servidor de socket, das tarefas em segundo plano e dos utilitários foram trocados por um `logger` próprio, com cores. Os logs do servidor ficaram bem mais legíveis e a depuração, mais fácil.

---

## [v1.5.2.1] - 2026-03-22

### Corrigido
- **Menu lateral do celular desatualizado**:
    - o menu móvel (`mobile-nav.tsx`) foi sincronizado com o menu do desktop (`sidebar-nav.tsx`);
    - foram adicionadas as páginas que faltavam: **Etiquetas**, **Perfil do Bot** e **Acesso às Sessões**;
    - **Sessões / QR** saiu do grupo Administração e foi para o grupo Principal;
    - **Resposta Automática** saiu do grupo Mensagens e foi para o grupo Automação;
    - ícones corrigidos (Resposta Automática passou a usar o ícone `MessageCircleReply` no celular e no desktop).

---

## [v1.5.2] - 2026-03-20

### Adicionado
- **Compartilhamento de sessões**:
    - o dono da sessão pode dar acesso a outros usuários cadastrados, que passam a ver e usar a sessão sem ser donos dela;
    - nova página no painel (`/dashboard/sessions/access`) para gerenciar o acesso compartilhado de cada sessão;
    - botão "Compartilhar" em cada cartão de sessão no gerenciador, para acesso rápido;
    - novos endpoints da API:
        - `GET /api/sessions/{sessionId}/access`: lista os usuários com acesso compartilhado;
        - `POST /api/sessions/{sessionId}/access`: concede acesso por e-mail;
        - `DELETE /api/sessions/{sessionId}/access`: revoga o acesso pelo `userId`;
    - item "Acesso às Sessões" no menu lateral, no grupo Administração;
    - segurança: só donos de sessão e SUPERADMINs gerenciam o acesso, e não é possível conceder acesso a si mesmo, ao dono ou a um SUPERADMIN;
    - revogar o acesso exige confirmação em um `AlertDialog`.
- **Acompanhamento das transmissões**:
    - painel de progresso em tempo real na página de Transmissão, com contagem de enviadas, com falha e aguardando;
    - barra de progresso animada com porcentagem;
    - destinatário atual e log de erros das mensagens que falharam;
    - evento `broadcast.progress` do Socket.IO emitido pelas duas rotas de transmissão da API.
- **Página de perfil** (`/dashboard/profile`):
    - ver e editar o nome de exibição, o recado (status) e a foto de perfil do WhatsApp;
    - novas rotas da API: `GET /api/profile/[sessionId]`, `PUT .../name`, `PUT .../status`, `PUT/DELETE .../picture`.
- **Página de etiquetas** (`/dashboard/labels`):
    - criar, ver e excluir etiquetas do WhatsApp pelo painel.
- **Módulo Chat Service** (`src/modules/whatsapp/chat.service.ts`):
    - lógica de chat centralizada (`getChatsList`, `getMessages`, `sendTextMessage`, `sendMediaMessage`), eliminando código duplicado entre Server Actions e rotas da API.
- **Normalização de JID**:
    - nova função `normalizeJid()` em `jid-utils.ts`, que padroniza `@c.us` → `@s.whatsapp.net`;
    - aplicada de forma consistente no armazenamento de mensagens, no upsert de contatos e nas consultas do ChatService.

### Corrigido
- **Lista de conversas sem sincronizar**:
    - corrigida a divergência de JID entre a tabela de contatos (`@c.us`/`@lid`) e a de mensagens (`@s.whatsapp.net`), que fazia conversas não aparecerem;
    - o evento `message.update` do Socket.IO passou a serializar o `timestamp` como string ISO, e não como objeto `Date`;
    - controle de JIDs com `useRef` no ChatList, para detectar conversas novas pelos eventos do socket de forma confiável;
    - atraso de 800 ms antes de recarregar as mensagens após o envio, dando tempo ao Baileys de processar o `messages.upsert`.
- **Estatísticas da sessão zeradas**:
    - a API do monitor (`/api/system/monitor/[sessionId]`) passou a converter o identificador da sessão no CUID do banco antes de contar contatos, conversas e mensagens.
- **Página de perfil com "Falha ao carregar"**:
    - implementadas as rotas da API que faltavam para buscar os dados de perfil (nome, recado, foto) pelos métodos do socket do Baileys.
- **Links duplicados no menu lateral**:
    - removidas as entradas repetidas de Resposta Automática, Transmissões, Contatos e Grupos.
- **Erros de sintaxe na página de etiquetas**:
    - corrigidos crases escapadas e imports ausentes que impediam a compilação da página.

### Alterado
- **Sistema de autenticação (`api-auth.ts`)**:
    - `canAccessSession()` passou a verificar os registros de `SessionAccess`, além da posse;
    - `getAccessibleSessions()` passou a devolver as sessões próprias e as compartilhadas para usuários que não são SUPERADMIN;
    - novo helper `isSessionOwner()`, que diferencia posse de acesso compartilhado (usado para proteger os endpoints de gestão).
- **Logs de depuração do Socket.IO**: logs `[Socket]` detalhados nas emissões de `message.update`, com `keyId`, `remoteJid` e `fromMe`.
- **ChatWindow**: o envio de mídia passou a usar o mesmo padrão de atualização atrasada do envio de texto.

### Banco de dados
- **Novo modelo**: `SessionAccess`, relação muitos-para-muitos entre `User` e `Session`, com exclusão em cascata e restrição única `[sessionId, userId]`.

---

## [v1.5.2-beta.2] - 2026-03-20

### Adicionado
- **Compartilhamento de sessões**:
    - o dono da sessão pode dar acesso a outros usuários cadastrados, que passam a ver e usar a sessão sem ser donos dela;
    - nova página no painel (`/dashboard/sessions/access`) para gerenciar o acesso compartilhado de cada sessão;
    - novos endpoints da API:
        - `GET /api/sessions/{sessionId}/access`: lista os usuários com acesso compartilhado;
        - `POST /api/sessions/{sessionId}/access`: concede acesso por e-mail;
        - `DELETE /api/sessions/{sessionId}/access`: revoga o acesso pelo `userId`;
    - item "Acesso às Sessões" no menu lateral, no grupo Administração;
    - segurança: só donos de sessão e SUPERADMINs gerenciam o acesso, e não é possível conceder acesso a si mesmo, ao dono ou a um SUPERADMIN;
    - revogar o acesso exige confirmação em um `AlertDialog`.

### Alterado
- **Sistema de autenticação (`api-auth.ts`)**:
    - `canAccessSession()` passou a verificar os registros de `SessionAccess`, além da posse;
    - `getAccessibleSessions()` passou a devolver as sessões próprias e as compartilhadas para usuários que não são SUPERADMIN;
    - novo helper `isSessionOwner()`, que diferencia posse de acesso compartilhado (usado para proteger os endpoints de gestão).

### Banco de dados
- **Novo modelo**: `SessionAccess`, relação muitos-para-muitos entre `User` e `Session`, com exclusão em cascata e restrição única `[sessionId, userId]`.

---

## [v1.5.2-beta.1] - 2026-03-15

### Adicionado
- **Acompanhamento das transmissões**:
    - painel de progresso em tempo real na página de Transmissão, com contagem de enviadas, com falha e aguardando;
    - barra de progresso animada com porcentagem;
    - destinatário atual e log de erros das mensagens que falharam;
    - evento `broadcast.progress` do Socket.IO emitido pelas duas rotas de transmissão da API.
- **Página de perfil** (`/dashboard/profile`):
    - ver e editar o nome de exibição, o recado (status) e a foto de perfil do WhatsApp;
    - novas rotas da API: `GET /api/profile/[sessionId]`, `PUT .../name`, `PUT .../status`, `PUT/DELETE .../picture`.
- **Página de etiquetas** (`/dashboard/labels`):
    - criar, ver e excluir etiquetas do WhatsApp pelo painel.
- **Módulo Chat Service** (`src/modules/whatsapp/chat.service.ts`):
    - lógica de chat centralizada (`getChatsList`, `getMessages`, `sendTextMessage`, `sendMediaMessage`), eliminando código duplicado entre Server Actions e rotas da API.
- **Normalização de JID**:
    - nova função `normalizeJid()` em `jid-utils.ts`, que padroniza `@c.us` → `@s.whatsapp.net`;
    - aplicada de forma consistente no armazenamento de mensagens, no upsert de contatos e nas consultas do ChatService.

### Corrigido
- **Lista de conversas sem sincronizar**:
    - corrigida a divergência de JID entre a tabela de contatos (`@c.us`/`@lid`) e a de mensagens (`@s.whatsapp.net`), que fazia conversas não aparecerem;
    - o evento `message.update` do Socket.IO passou a serializar o `timestamp` como string ISO, e não como objeto `Date`;
    - controle de JIDs com `useRef` no ChatList, para detectar conversas novas pelos eventos do socket de forma confiável;
    - atraso de 800 ms antes de recarregar as mensagens após o envio, dando tempo ao Baileys de processar o `messages.upsert`.
- **Estatísticas da sessão zeradas**:
    - a API do monitor (`/api/system/monitor/[sessionId]`) passou a converter o identificador da sessão no CUID do banco antes de contar contatos, conversas e mensagens.
- **Página de perfil com "Falha ao carregar"**:
    - implementadas as rotas da API que faltavam para buscar os dados de perfil (nome, recado, foto) pelos métodos do socket do Baileys.
- **Links duplicados no menu lateral**:
    - removidas as entradas repetidas de Resposta Automática, Transmissões, Contatos e Grupos.
- **Erros de sintaxe na página de etiquetas**:
    - corrigidos crases escapadas e imports ausentes que impediam a compilação da página.

### Alterado
- **Logs de depuração do Socket.IO**: logs `[Socket]` detalhados nas emissões de `message.update`, com `keyId`, `remoteJid` e `fromMe`.
- **ChatWindow**: o envio de mídia passou a usar o mesmo padrão de atualização atrasada do envio de texto.

---

## [v1.5.1] - 2026-03-03

### Adicionado
- **Monitoramento global de recursos do sistema**:
    - painel "Monitor do Sistema" para Super Admins acompanharem CPU (ao vivo e por núcleo), RAM, disco e rede;
    - memória detalhada do processo Node.js (Heap/RSS).
- **Saúde de cada sessão**:
    - ping/latência do socket do Baileys e tempo de conexão direto na página de detalhes da sessão.
- **Proteção contra banimento (limite anti-spam)**:
    - fila de mensagens de alto desempenho para evitar o banimento de contas do WhatsApp;
    - limites configuráveis por sessão, atrasos aleatórios e controle da ordem das mensagens (FIFO).
- **Melhorias na administração**:
    - avisos de segurança no login e no painel quando o cadastro público está ativado;
    - menu lateral reorganizado por grupos (Mensagens, Automação, Administração);
    - novos controles no painel para o prefixo dos comandos e a duração máxima das figurinhas.
- **Conexão por código de pareamento**:
    - vínculo de contas do WhatsApp por código de pareamento de 8 caracteres, como alternativa ao QR code;
    - interface "Conectar com número de telefone" na página de detalhes da sessão, com botão de copiar;
    - identificação do navegador otimizada para máxima compatibilidade com o sistema de pareamento do WhatsApp.
- **Visualização de mensagens e download de mídia**:
    - corrigida a exibição de mensagens em conversas individuais com a padronização das respostas da API;
    - botões de download com um clique para imagens, vídeos, áudios e documentos na janela de chat.
- **Padronização**: parâmetros de rota REST padronizados com `[sessionId]` e formato de resposta consistente `{ status, message, data }`.

### Alterado
- **SEO e acessibilidade**: nova opção `NEXT_PUBLIC_ALLOW_INDEXING` para controlar a indexação por buscadores (padrão: `noindex`).
- **Alertas**: os `alert()` e `confirm()` do navegador foram trocados por toasts do Sonner e diálogos do Radix UI.
- **Responsividade para celular**: mais de 12 páginas do painel redesenhadas para funcionar bem no celular (abas, cabeçalhos e grades).
- **Confiabilidade do socket**: a detecção do status "CONNECTED" foi refeita com base no `readyState`.

### Corrigido
- **Compatibilidade com Next.js 15**: corrigidos erros críticos do TypeScript com os parâmetros de rota embrulhados em Promise.
- **Normalização de JID**: mapeamento padronizado de `@lid` (dispositivo vinculado) para o telefone `@s.whatsapp.net` nos webhooks, no store e na interface.
- **Codificação de JID**: corrigidos erros 404 causados pelo `@` sem codificação nos exemplos da documentação da API.
- **Estabilidade do anti-spam**: o wrapper do socket passou a ser preservado quando a sessão é reinicializada.

---

## [v1.5.1-beta.3] - 2026-03-03

### Alterado
- **SEO e acessibilidade**: nova opção `NEXT_PUBLIC_ALLOW_INDEXING`, que controla a indexação das páginas por robôs (padrão: `noindex/nofollow`).
- **Painel administrativo**: aviso visual para Super Admins, logo na entrada do painel, quando o cadastro público está ativado.
- **Autenticação mais consistente**: a validação de autenticação REST foi padronizada, impedindo que usuários listem dados de outros usuários ou inspecionem sessões que não são deles por endpoints como `/api/contacts/route`.

---

## [v1.5.1-beta.2] - 2026-03-02

### Adicionado
- **Monitoramento global de recursos do sistema**:
    - nova página no painel (`/dashboard/system-monitor`) para Super Admins acompanharem a saúde do servidor;
    - carga de CPU em tempo real (total e por núcleo);
    - RAM do sistema e memória do processo Node.js (Heap/RSS);
    - tráfego de rede (bytes recebidos/enviados por segundo, ao vivo);
    - uso de disco de todas as partições montadas;
    - atualização automática a cada 3 segundos.
- **Saúde de cada sessão**:
    - métricas em tempo real na página de detalhes da sessão;
    - **ping da conexão**: estado e latência do socket do Baileys;
    - **tempo conectado**: há quanto tempo exatamente a sessão está conectada;
    - **estatísticas do store**: indicadores reservados para o store em memória do Baileys (contatos, conversas, mensagens).
- **Administração e interface**:
    - "Monitor do Sistema" no menu lateral (restrito ao SUPERADMIN);
    - o cartão de ação rápida "Resposta Automática" do painel foi trocado por "Monitor do Sistema";
    - o menu do celular foi unificado para ficar idêntico ao menu lateral do desktop, inclusive nos ícones.

### Otimizado
- **Responsividade para celular**:
    - detalhes longos do sistema, como a distribuição do SO e o tempo de conexão, são cortados com reticências para não estourar a tela em aparelhos estreitos;
    - **economia de bateria e memória**: o Monitor do Sistema usa a `Visibility API` para pausar a atualização (a cada 3 s) sempre que a aba fica oculta ou minimizada.

### Corrigido
- **Compatibilidade com Next.js 15**: corrigidos erros do TypeScript com `params` embrulhados em `Promise` nas rotas dinâmicas da API.
- **Autenticação**: todos os novos endpoints de monitoramento passaram a usar `@/lib/api-auth`.
- **Confiabilidade do socket**: a detecção de sessões `CONNECTED` passou a consultar o `ws.readyState`.

### Técnico
- **Novas dependências**: `systeminformation`, para métricas do sistema operacional, e `@radix-ui/react-progress`, para componentes de interface.
- **Componentes de interface**: `src/components/ui/progress.tsx` foi implementado manualmente por causa de problemas da CLI nesse ambiente.

---

## [v1.5.1-beta.1] - 2026-03-02

### Adicionado
- **Proteção contra banimento (limite anti-spam)**:
    - fila de mensagens por sessão, para o WhatsApp não detectar spam e banir a conta;
    - **limite de mensagens**, **janela de tempo**, **atraso mínimo** e **atraso máximo** configuráveis em Configurações do Bot;
    - fila FIFO: as mensagens saem em ordem, com atrasos aleatórios entre os envios;
    - vale para **todas** as mensagens enviadas: respostas do bot, respostas automáticas, transmissões, agendamentos e chamadas da API;
    - log detalhado no console com o estado da fila, o tipo de mensagem, o atraso e o horário estimado de envio:
        - `📥 QUEUED`: a mensagem entrou na fila, com a posição;
        - `⏳ DELAY`: limite atingido, com a duração do atraso e o tamanho da fila;
        - `✅ SENDING/INSTANT`: mensagem enviada, com o tempo total de espera;
    - configuração em cache por 10 segundos, para evitar consultas excessivas ao banco;
    - consultas SQL brutas para máxima compatibilidade, sem precisar regenerar o Prisma Client.
- **Prefixo configurável dos comandos do bot**:
    - nova opção em Configurações do Bot para mudar o prefixo (padrão `#`, até 3 caracteres);
    - o `command-handler.ts` lê o prefixo do banco, em vez de um valor fixo no código;
    - o comando de menu mostra o prefixo configurado.
- **Duração máxima das figurinhas**:
    - controle deslizante (3 a 30 segundos) em Configurações do Bot para o `maxStickerDuration`;
    - antes só era possível configurar direto no banco.

### Alterado
- **Alertas**:
    - o `alert()` nativo da página de Transmissão foi trocado por `toast.error()` do Sonner;
    - o `confirm()` nativo da página de Mídia foi trocado por um `AlertDialog` na exclusão de arquivos;
    - confirmação por `AlertDialog` ao gerar uma nova chave de API na página de Webhooks.
- **Responsividade para celular**:
    - padrões responsivos aplicados a 12 páginas do painel: Grupos, Agendador, Resposta Automática, Transmissão, Figurinhas, Usuários, Notificações, Webhooks, Configurações, Configurações do Bot, Documentação da API e Contatos;
    - no celular, cabeçalhos quebram linha (`flex-col sm:flex-row`), grades de formulário viram uma coluna (`grid-cols-1 sm:grid-cols-2`), diálogos têm largura limitada e as fontes foram ajustadas.
- **Documentação da API**:
    - todos os schemas de resposta do `API_DOCUMENTATION.md` foram padronizados para o novo formato `{ status: boolean, message: string, data: object }`, no lugar do antigo `{ success: boolean }`;
    - a documentação do GET de sessões passou a mostrar os relacionamentos `botConfig`, `webhooks` e `_count`.

### Corrigido
- **Referência rápida da API**: os exemplos em Python e Node.js usavam endpoints totalmente desatualizados (ex.: `/api/chat/send` virou `/api/messages/{sessionId}/{jid}/send`).
- **Codificação de JID na documentação**: o `@` passou a ser codificado (`%40s.whatsapp.net`) nos exemplos, evitando erros 404 nas rotas.
- **Aviso no Swagger UI**: suprimido o aviso `UNSAFE_componentWillReceiveProps` do componente `ModelCollapse` no console.
- **Confiabilidade do anti-spam**: o wrapper do socket se perdia na reconexão. Agora o `sendMessage` é embrulhado direto no `init()` e se mantém entre reconexões.
- **Schema do Prisma**: campos `prefix`, `antiSpamEnabled`, `spamLimit`, `spamInterval`, `spamDelayMin` e `spamDelayMax` adicionados ao modelo `BotConfig`.

---

## [v1.5.0] - 2026-02-26

### Adicionado
- **Menu lateral recolhível**:
    - no desktop, o menu pode ser reduzido a ícones (260 px ↔ 72 px);
    - com o menu recolhido, cada item mostra uma dica (tooltip) para identificação rápida;
    - o estado fica salvo no `localStorage` entre as páginas;
    - transições suaves na largura, no logotipo e no rodapé do usuário;
    - nova arquitetura com o contexto `SidebarProvider` e o componente cliente `SidebarShell`.
- **Novo visual do chat**:
    - **barra de busca**: filtra conversas por nome ou número em tempo real;
    - **lista no estilo WhatsApp**: itens sem borda, com destaque ao passar o mouse e faixa lateral na conversa selecionada;
    - **prévias inteligentes**: até 45 caracteres da mensagem, com ícones do tipo de mídia (📎 Imagem, Vídeo etc.);
    - **horários relativos**: "Ontem", "Seg", "12 de fev." no lugar do horário bruto;
    - **separadores de data**: "Hoje", "Ontem" ou a data completa entre os grupos de mensagens;
    - **balões arredondados**: no estilo WhatsApp, com "rabinho" e horário na própria mensagem;
    - **fundo pontilhado**: padrão sutil de pontos na janela de chat;
    - **botão voltar no celular**: integrado ao cabeçalho do chat;
    - **menu de anexos colorido**: cada tipo de mídia tem um ícone de cor própria.
- **Página de gestão de mídia** (`/dashboard/media`):
    - controle de acesso por usuário: cada um vê apenas a mídia das próprias sessões;
    - arquivos agrupados por **Sessão** → **Remetente** (seções recolhíveis);
    - dados do remetente vindos do banco (`pushName` e `senderJid`, por consulta em lote do `keyId`);
    - cartões de estatísticas: espaço total, quantidade de arquivos, imagens e divisão por tipo;
    - busca e filtro por tipo, nome do arquivo, sessão ou remetente;
    - visualização em grade com miniaturas e metadados;
    - seleção múltipla e exclusão em massa, com "Selecionar tudo" por grupo;
    - visualização de imagens em tela cheia;
    - o SUPERADMIN vê a mídia de todas as sessões; os demais, só a própria.
- **API segura de mídia**:
    - `GET /api/media`: lista os arquivos com dados do remetente, filtrados pela posse da sessão;
    - `GET /api/media/[filename]`: entrega o arquivo após conferir a posse da sessão;
    - `DELETE /api/media`: exclusão em massa, verificando a posse da sessão de cada arquivo.
- **Utilitários de JID compartilhados**: novo módulo `src/lib/jid-utils.ts` com `resolveToPhoneJid()`, `batchResolveToPhoneJid()` e `isLidJid()`, para tratar JIDs de forma consistente em todo o código.
- **Componente Tooltip**: dependência `@radix-ui/react-tooltip` e o arquivo `src/components/ui/tooltip.tsx`.

### Segurança
- **Armazenamento de mídia protegido**: a mídia saiu de `public/media/` (acessível a qualquer um) e foi para `data/media/` (privada, só acessível pela API com autenticação).
- **Brecha no middleware corrigida**: removidas as regras perigosas `pathname.startsWith("/media")` e `pathname.includes(".")`, que liberavam sem login os arquivos de mídia e qualquer URL com ponto.
- **API de mídia protegida**: `GET /api/media/[filename]` passou a exigir `getAuthenticatedUser()` (sessão ou chave de API), com verificação via `path.resolve()` contra path traversal.
- **Posse da sessão na mídia**: todos os endpoints de mídia aplicam `canAccessSession()`. O usuário só vê, baixa e exclui a mídia das próprias sessões.
- **Cabeçalhos de segurança**: `X-Content-Type-Options: nosniff` e `Cache-Control: private` nas respostas de mídia.
- **Bloqueio por padrão**: o middleware passou a exigir autenticação em todas as rotas não mapeadas, em vez de liberá-las.

### Corrigido
- **Remetente errado na mídia**: colisões de `keyId` do WhatsApp entre sessões diferentes agrupavam arquivos sob o remetente errado ("Desconhecido"). Agora o agrupamento exige correspondência exata de `sessionId` e `keyId`.
- **Agrupamento de mídia na interface**: os três níveis de agrupamento (Usuário > Sessão > Remetente) passaram a usar cartões distintos, com espaçamento melhor e hierarquia visual clara, no lugar dos recuos aninhados confusos.
- **Consistência de JID (webhooks)**: os campos `from`, `sender` e `participant` passaram a usar sempre o formato `@s.whatsapp.net`, e não `@lid`. A resolução segue três etapas: `remoteJidAlt` na própria mensagem → consulta ao contato no banco → valor de reserva.
- **Consistência de JID (interface)**: a API da lista de conversas converte em lote os JIDs `@lid` em números de telefone antes de responder; a interface mostra sempre `@s.whatsapp.net`.
- **Consistência de JID (store de mensagens)**: `processAndSaveMessage` normaliza `remoteJid` e `senderJid` antes de gravar, impedindo que `@lid` vá para o banco.
- **Estouro na lista de conversas**: textos longos alargavam os itens; agora são cortados com reticências.
- **Parâmetro de rota das sessões**: a pasta `sessions/[id]` foi renomeada para `sessions/[sessionId]`, igual aos demais endpoints. Os 5 handlers e a página de documentação da API foram atualizados.

### Alterado
- **Layout do painel**: gradientes de fundo mais leves, espaçamento menor no celular (`p-3`) e visual mais limpo.
- **Refatoração dos webhooks**: as cópias de `resolveToPhoneJid` e `isLidJid` saíram de `webhook.ts`, que passou a importar de `jid-utils.ts`.
- **Página de documentação da API**: os endpoints de sessão passaram a mostrar `[sessionId]` em vez de `[id]` no caminho e nos parâmetros.

---

## [v1.4.1] - 2026-02-21

### Adicionado
- **Ativar/desativar cadastro**: Super Admins podem abrir ou fechar o cadastro de novos usuários direto nas configurações do painel.
- **Telas de login dinâmicas**: as páginas de login e cadastro refletem o estado atual do cadastro e escondem o formulário ou os links quando o administrador o desativa.

### Alterado
- A API de cadastro passou a respeitar a configuração global `enableRegistration`.

## [v1.4.0] - 2026-02-21

### Adicionado
- **Novo visual do painel**:
    - **menu lateral agrupado**: recursos organizados em seções lógicas (Mensagens, Contatos, Automação, Desenvolvedor, Administração);
    - **destaque do link ativo**: o menu passou a destacar a página atual;
    - **grupos recolhíveis**: as seções do menu podem ser recolhidas ou expandidas;
    - **nova página inicial**: 4 cartões de estatísticas, grade de ações rápidas e cartões de sessão com indicadores coloridos;
    - **layout modernizado**: desfoque de fundo (backdrop-blur) na barra superior, espaçamentos refinados e todos os skeletons de carregamento atualizados.
- **Favoritar mensagens**: `POST /api/messages/{sessionId}/{jid}/{messageId}/star` marca ou desmarca mensagens com estrela.
- **Busca de mensagens**: `GET /api/messages/{sessionId}/search` com busca em texto completo, filtros por JID, tipo e remetente e paginação.

### Corrigido
- **Respostas em grupos no WhatsApp Web**: as respostas com citação em grupos eram descartadas em silêncio pela interface do WhatsApp Web. A correção:
    - converte o `sessionId` informado pelo usuário direto no CUID do banco, para localizar a mensagem original com segurança;
    - mapeia os IDs de dispositivo vinculado (`@lid`) de volta para os JIDs de telefone (`@s.whatsapp.net`) pela tabela `Contact`;
    - atende à validação rígida do WhatsApp Web, replicando exatamente o `fromMe`, o `messageTimestamp` e o `pushName` da mensagem original;
    - monta as citações de texto sempre como `extendedTextMessage`.
- **Consistência da API**: os endpoints de resposta (`/api/messages/[sessionId]/[jid]/[messageId]/reply` e `/api/messages/[sessionId]/[jid]/reply`) passaram a usar o mesmo formato do `/send`: `{ message: { text: ... }, mentions: [] }`.
- **Bug na resposta automática**: o padrão do `matchType` no PUT era `"exact"` (minúsculo), mas o motor espera `"EXACT"` (maiúsculo), e as regras editadas paravam de funcionar sem aviso.
- **Bloquear/desbloquear contatos**: faltava `decodeURIComponent(jid)`, e os JIDs com `%40` não eram decodificados.
- **Autenticação no GET de contatos**: `auth()` foi trocado por `getAuthenticatedUser()` + `canAccessSession()`, liberando o uso de chave de API e o controle de acesso por sessão.
- **Infraestrutura**: corrigidos problemas de binary target do Prisma, para maior compatibilidade entre ambientes.

### Alterado
- **Consistência**: mensagens de erro `403` padronizadas como `"Forbidden - Cannot access this session"` em 11 arquivos de rota.
- **Consistência**: ordem de validação padronizada (autenticação → parâmetros → corpo) em todas as rotas.
- **Limpeza**: removida a rota duplicada `messages/[jid]/read` (use `chat/[jid]/read`).
- **Estilo**: o menu lateral trocou as sombras por bordas, num visual mais moderno.

## [v1.3.0] - 2026-02-01

### Adicionado
- **Controle de acesso granular**:
    - novo modo `BLACKLIST` para comandos do bot e respostas automáticas;
    - campos `botBlockedJids` e `autoReplyBlockedJids` no `BotConfig`;
    - "Configurações do Bot" no painel permite definir visualmente os JIDs bloqueados e permitidos.
- **Respostas automáticas avançadas**:
    - **contexto**: as respostas automáticas podem valer para conversas `ALL`, `GROUP` ou `PRIVATE`, pelo `triggerType`;
    - **mídia**: as respostas automáticas podem incluir anexos (imagens, vídeos, documentos) via `mediaUrl` e `isMedia`.
- **Melhorias no agendador**:
    - **mídia**: mensagens agendadas aceitam os tipos `image`, `video` e `document`;
    - **seleção de JID**: menu na interface para escolher o tipo de destinatário (`@s.whatsapp.net`, `@g.us`, `@newsletter`).
- **Documentação**:
    - revisão completa de `src/lib/swagger.ts`, com exemplos para todos os endpoints;
    - `USER_GUIDE.md` e `README.md` atualizados com as instruções dos novos recursos.

### Corrigido
- **Tipagem**: resolvidos conflitos de definição de tipos do Prisma na rota da API de respostas automáticas.
- **Estabilidade**: melhorias na lógica de filtragem de mensagens por contexto.

## [v1.2.0] - 2026-01-18

### Adicionado
- **Grande refatoração e padronização da API**:
    - **arquitetura REST**: os módulos principais passaram a usar parâmetros de rota padronizados (`/api/{recurso}/{sessionId}`), no lugar de parâmetros inconsistentes em query ou corpo;
    - **módulos afetados**:
        - **Contatos**: `/api/contacts/{sessionId}`
        - **Etiquetas**: `/api/labels/{sessionId}`
        - **Perfil**: `/api/profile/{sessionId}`
        - **Agendador**: `/api/scheduler/{sessionId}`
        - **Respostas automáticas**: `/api/autoreplies/{sessionId}`
        - **Grupos**: `/api/groups/{sessionId}`
        - **Webhooks**: `/api/webhooks/{sessionId}`
    - **painel**: todas as páginas correspondentes (Contatos, Agendador, Resposta Automática, Grupos) foram atualizadas para os novos endpoints.
- **Chat sincronizado em tempo real**:
    - integração com o Socket.IO para atualizar na hora a janela de chat e a lista de conversas;
    - removidos os mecanismos antigos de polling, melhorando o desempenho;
    - rolagem automática até o fim quando chegam mensagens novas.
- **Envio de mídia**:
    - novo menu de anexos para enviar imagens, vídeos, áudios, documentos e figurinhas;
    - novo endpoint `POST /api/messages/{sessionId}/{jid}/media`.
- **Gerenciador de sessões V2**:
    - interface redesenhada em grade moderna;
    - suporte a **IDs de sessão personalizados** na criação;
    - indicadores de status e controles de navegação melhores.
- **Nova página inicial**:
    - visual no estilo SaaS, com grade de recursos e vitrine da stack;
    - exibição dinâmica da versão e páginas de Política de Privacidade e Termos de Uso.
- **Documentação**:
    - menu lateral com acordeão e busca;
    - `API_DOCUMENTATION.md` e `swagger.ts` atualizados com o novo endpoint de mídia.
- **API pública**:
    - campos `fileUrl`, `sender` (objeto) e `remoteJidAlt` nos payloads de webhook;
    - os webhooks passaram a incluir os detalhes da mensagem citada (`quoted`), com as URLs de mídia já resolvidas.

### Corrigido
- **Ordem do histórico**: `/api/chat/[sessionId]/[jid]` passou a buscar as 100 mensagens mais recentes, em ordem cronológica.
- **Confiabilidade das sessões**: corrigidos problemas ao reiniciar e parar sessões e loops de logout.
- **Logout**: o logout explícito passou a limpar as credenciais corretamente.
- **Sintaxe do webhook**: corrigido um erro crítico (bloco de código duplicado) em `src/lib/webhook.ts` que quebrava o build.
- **Robustez**: o helper `extractQuotedMessage` passou a tratar com precisão os diferentes tipos de mensagem (grupo e privada).

## [beta-v1.1.0.1] - 2026-01-15

### Adicionado
- **Gestão de contatos**:
    - **página de contatos**: nova página no painel (`/dashboard/contacts`) para ver, filtrar e gerenciar os contatos sincronizados;
    - **recursos**: busca por nome ou JID, filtro por sessão e paginação configurável (de 5 a 3000 itens por página);
    - **banco de dados**: o modelo `Contact` passou a guardar `lid`, `verifiedName`, `remoteJidAlt`, `profilePic` e os dados brutos (`data`).
- **Motor de mensagens aprimorado**:
    - **filtro de duplicadas**: detecção robusta para evitar processar mensagens e disparar respostas automáticas em dobro;
    - **filtro de lixo**: ignora mensagens vazias e mensagens técnicas de protocolo (ex.: distribuição de chaves, reações), mantendo os logs limpos.
- **Campos melhores na interface**:
    - **várias linhas**: Resposta Automática e Agendador passaram a usar campos `Textarea`, permitindo mensagens mais longas.

### Corrigido
- **Acesso à mídia**: configuração do middleware ajustada para liberar os arquivos de mídia públicos.
- **Estabilidade do build**: corrigidos imports indevidos de módulos de interface (`Table`, `Pagination`) e tipos ausentes após mudanças no schema do Prisma.
- **Backend**: removidos imports duplicados nas páginas do painel.

## [1.1.0] - 2026-01-13

### Adicionado
- **Melhorias nos webhooks**:
    - **dados brutos**: campo `raw` no payload, com o objeto completo da mensagem do Baileys;
    - **mídia**: download automático de mídia (imagens, vídeos etc.); o webhook inclui `fileUrl`, apontando para o arquivo salvo em `public/media`;
    - **participantes detalhados**: em mensagens de grupo, `sender` e `participant` passaram a ser objetos com `id`, `phoneNumber` e `admin`;
    - **campos padronizados**: `from` (JID da conversa), `sender` (participante/usuário), `isGroup` e `remoteJidAlt` (extraído da chave da mensagem).
- **Respostas da API mais completas**:
    - **histórico de conversas**: `/api/chat/[sessionId]/[jid]` passou a devolver os detalhes de `sender` nas mensagens de grupo, no mesmo formato do webhook.

### Corrigido
- **Lógica dos webhooks**: `from` e `sender` eram ambíguos ou incorretos. Agora `from` é sempre a conversa e `sender` é quem enviou de fato.
- **Processamento assíncrono**: o store de mensagens passou a tratar as operações de webhook de forma assíncrona e segura, sem bloquear.

## [1.0.7] - 2026-01-13

### Corrigido
- **Webhooks no painel**: a lista de webhooks aparecia vazia. Agora o painel compara tanto o ID textual da sessão (`mysession`) quanto o ID interno do banco (CUID) ao filtrar.

## [1.0.6] - 2026-01-13

### Corrigido
- **Resposta automática**: não funcionava em sessões novas porque faltava o `BotConfig`, e falhava sem aviso. A configuração padrão passou a ser criada automaticamente para sessões novas e existentes.
- **`POST /api/sessions`**: o `sessionId` personalizado enviado no corpo era ignorado; agora é aceito.
- **`POST /api/webhooks`**: retornava `500 Internal Server Error` ao criar webhooks. A API passou a converter o ID textual da sessão no ID interno do banco (CUID).
- **`POST /api/system/check-updates`**: problema de autenticação. Passou a usar `getAuthenticatedUser`, permitindo acesso por chave de API, e não só pelo cookie de sessão.
- **Seletor de sessão**: só listava as sessões "CONNECTED". Agora mostra todas (desconectadas, aguardando QR etc.), para poderem ser gerenciadas.
- **Página de webhooks**: passou a respeitar a sessão selecionada na barra superior. A lista é filtrada pela sessão, e os webhooks novos são vinculados à sessão ativa.

### Adicionado
- **Verificação automática de atualizações**: ao entrar no painel, o sistema verifica se há uma versão nova e cria uma notificação só quando houver.
- **Configuração de logs**: suporte a `BAILEYS_LOG_LEVEL` no `.env` para ajustar o nível de log do Baileys (padrão: `error`).
- **Scripts**: `scripts/test_endpoints.sh`, para verificar os endpoints da API via curl.

### Documentação
- **Documentação da API**: `docs/API_DOCUMENTATION.md` foi totalmente reescrito, com todos os endpoints (Chat, Grupos, Transmissão, Spam, Figurinhas, Status, Agendador, Sistema).
- **Ambiente**: o `.env.example` passou a incluir a nova configuração de logs.
