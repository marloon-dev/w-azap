# 📖 Manual do Usuário — W-AZAP

Bem-vindo ao manual do **W-AZAP**. Aqui você encontra o passo a passo para usar cada recurso do painel.

---

## 🔑 Primeiro acesso

1. Abra o endereço da sua instalação (ex.: `http://localhost:3000`) e clique em **Entrar**.
2. **Instalação nova**: a primeira conta cadastrada vira **Super Admin** automaticamente. Depois dela, o cadastro público fica **desativado**.
3. **Novos usuários**: o Super Admin cria as contas em **Usuários**. Outra opção é ativar **Permitir cadastro de usuários** em **Configurações**; nesse caso o painel mostra um aviso enquanto o cadastro estiver aberto.
4. **Senhas**: devem ter pelo menos **8 caracteres**. Depois de 5 tentativas erradas, o login daquela conta fica bloqueado por 15 minutos.

> [!TIP]
> **Idioma**: use o seletor no **canto superior direito** para trocar o idioma da interface. Estão disponíveis 14 idiomas, entre eles português (Brasil), inglês, espanhol, francês, alemão, italiano, russo, chinês, japonês, coreano, árabe, hindi, indonésio e turco. A escolha fica salva no navegador.

---

## 🚀 Início rápido: conectando o WhatsApp

Antes de usar qualquer automação, você precisa vincular uma conta do WhatsApp.

1. **Adicionar sessão**: vá em **Sessões / QR** e clique em **Adicionar sessão**.
2. **Nome e ID**: dê um nome (ex.: `Equipe de vendas`). O ID é opcional: se informar, use de 3 a 50 letras, números, `-` ou `_` (ex.: `vendas-01`); se deixar em branco, um ID aleatório é gerado.
3. **Escanear o QR**: no celular, abra o WhatsApp › **Aparelhos conectados** › **Conectar um aparelho** e escaneie o código da tela. Se preferir, use o **código de pareamento** com o número do telefone.
4. **Aguardar**: quando o status mudar para **Conectado**, está pronto!
5. **Ativar**: selecione a nova sessão na **barra superior** para controlá-la nas outras páginas.

> [!NOTE]
> As chaves da sessão ficam criptografadas no banco de dados. Se o administrador perder a `DATA_ENCRYPTION_KEY`, será preciso escanear o QR de novo.

---

## 💬 Mensagens

### 1. Chat em tempo real
- Abra **Chat** para ver as conversas recentes, atualizadas em tempo real.
- Envie texto, imagens, vídeos, documentos e áudio; responda, reaja e encaminhe mensagens.
- Use **Nova conversa** para falar com um número que ainda não está no histórico.
- Você também pode abrir uma conversa direto pela URL: `/dashboard/chat/5511999999999`.

### 2. Agendador
- Vá em **Agendador** › **Novo agendamento**.
- **Conteúdo**: aceita texto com várias linhas.
- **Mídia**: envie imagens, vídeos ou documentos por URL pública (`http`/`https`).
- **Recorrência**: agende mensagens que se repetem (expressão cron).
- **Horário**: segue o fuso horário definido em **Configurações**.

### 3. Resposta automática
- Vá em **Resposta automática** e crie regras por palavra-chave.
- **Tipos de correspondência**:
  - `EXACT` (Exata): a mensagem é idêntica à palavra-chave (sem diferenciar maiúsculas e minúsculas).
  - `CONTAINS` (Contém): a palavra-chave aparece em qualquer parte da mensagem.
  - `REGEX` (Expressão regular): para padrões avançados, como `^pedido\s+\d+`.
- **Mídia**: envie imagens ou vídeos informando uma URL pública direta.
- **Contexto**: escolha responder em **Todas as conversas**, **Somente privadas** ou **Somente grupos**.

> [!WARNING]
> A opção **Começa com** (`STARTS_WITH`) aparece no formulário, mas ainda não é aplicada pelo motor de respostas: regras desse tipo não disparam. Por enquanto, use `REGEX` com `^palavra`.

---

## 📢 Comunicação em massa

### 1. Transmissão
- Envie a mesma mensagem para vários números ou grupos.
- **Proteção contra banimento**: o sistema adiciona atrasos aleatórios entre os envios.
- **Destinatários**: cole números separados por vírgula ou selecione um grupo sincronizado.
- **Histórico**: cada transmissão fica registrada, com o resultado de cada destinatário.

### 2. Grupos
- Veja todos os grupos da sessão em **Grupos**.
- Crie grupos e gerencie participantes, nome, descrição, foto, links de convite e mensagens temporárias.
- Sincronize os participantes no banco local para usar em transmissões.

---

## 🛠️ Ferramentas

### 1. Contatos
- Pesquise instantaneamente entre milhares de contatos sincronizados.
- Filtre por nome, número ou JID.
- Veja detalhes como foto de perfil e nome verificado; bloqueie e desbloqueie contatos.

### 2. Etiquetas
- Organize conversas com etiquetas coloridas e filtre o chat por etiqueta.

### 3. Criador de figurinhas
- Envie qualquer imagem e converta em figurinha do WhatsApp.
- Ative **Remover fundo** se a chave do remove.bg estiver configurada em **Configurações do bot**.

### 4. Gerenciador de mídia
- Veja e apague os arquivos de mídia baixados pelas suas sessões.

---

## 🤖 Configurações do bot

Em **Configurações do bot** você define, por sessão:
- os comandos disponíveis (`#ping`, `#sticker`, uptime…) e o prefixo;
- **quem pode usar os comandos**: apenas o dono, todos, uma lista de permitidos (whitelist) ou todos menos uma lista de bloqueados (blacklist);
- o mesmo controle de acesso para as respostas automáticas;
- a chave do **remove.bg**. Por segurança, ela só pode ser gravada (aparece mascarada como `••••••••`) e apenas o dono da sessão pode alterá-la.

---

## 🔗 Webhooks e API

Em **Webhooks e API**:
- **Chave de API**: gere uma chave para integrar sistemas externos. Ela é exibida **apenas uma vez**; depois o painel mostra só o início dela. Se perder a chave, gere outra (a anterior para de funcionar na hora).
- **Webhooks**: cadastre URLs que vão receber os eventos (mensagem recebida, enviada, status da conexão…). Cada envio vem assinado com HMAC no cabeçalho `X-Webhook-Signature`.
- **Teste e logs**: envie um evento de teste e veja o histórico de entregas.

> [!NOTE]
> Por segurança, webhooks para endereços internos (`localhost`, `192.168.x.x`, `10.x.x.x`…) são bloqueados. Para usar um serviço da sua própria rede (ex.: n8n local), o administrador precisa definir `ALLOW_PRIVATE_WEBHOOK_URLS="true"`.

---

## 📧 Encaminhar por e-mail

Em **Automação → Encaminhar por e-mail**, o W-AZAP envia para o seu e-mail, em tempo real, cada nova mensagem das **conversas privadas** da sessão selecionada (grupos não entram). Cada e-mail traz:
- a mensagem nova (com a mídia anexada, até 10 MB);
- todos os dados do contato: nome, telefone, nome no WhatsApp, nome comercial, JID/LID, etiquetas, total de mensagens, data da primeira mensagem e demais dados que o WhatsApp informar;
- as últimas mensagens da conversa (de 0 a 20, você escolhe);
- um botão para abrir a conversa no painel.

Como configurar:
1. Informe até 5 e-mails de destino.
2. Escolha o provedor (Gmail, Outlook, Yahoo, iCloud ou outro) e preencha usuário e senha do SMTP. **No Gmail, use uma senha de app** (myaccount.google.com/apppasswords); a senha normal não funciona.
3. Clique em **Enviar e-mail de teste** e, se chegar, ative o encaminhamento e salve.

Opções: incluir também as mensagens que você envia e anexar ou não as mídias. O painel mostra quantos e-mails foram enviados e o último erro, se houver.

> [!NOTE]
> Só o dono da sessão (ou o Super Admin) pode configurar o encaminhamento; quem tem acesso compartilhado não vê nem altera o destino. A senha do SMTP fica criptografada no banco e nunca é exibida. Para não estourar o limite do provedor, são enviados no máximo 300 e-mails por hora por sessão. A conexão com o SMTP sempre usa TLS (SSL na porta 465 ou STARTTLS na 587).

---

## ⚙️ Configurações (Super Admin)

Na página **Configurações** você pode alterar:
- **Marca**: nome do aplicativo, logotipo e favicon.
- **Fuso horário**: qualquer fuso IANA, usado pelo agendador para disparar na hora local certa.
- **Cadastro de usuários**: abre ou fecha o cadastro público (fechado por padrão).
- **Atualizações**: verifica se existe uma versão mais nova no GitHub.

O **Monitor do sistema** mostra CPU, memória, disco e rede em tempo real (somente Super Admin).

---

## 🔒 Segurança

- **Papéis**:
  - `SUPERADMIN`: acesso total, gerencia usuários e configurações;
  - `OWNER`: gerencia as próprias sessões;
  - `STAFF`: acesso apenas às sessões compartilhadas com ele.
- **Compartilhamento de sessão**: em **Acesso às sessões**, o dono pode compartilhar uma sessão com outro usuário sem dar permissão para excluí-la.
- **Chave de API**: guarde em local seguro e nunca faça commit dela no Git. Ela dá acesso às mesmas sessões que a sua conta.
- **Senhas**: armazenadas com bcrypt. Ao trocar a senha, o e-mail ou o papel de alguém, todas as sessões abertas dessa pessoa são encerradas.
- **Swagger UI e documentação**: `/swagger` e `/docs` exigem login no painel. Não existe mais senha separada para o Swagger.
- **Expiração do login**: depois do tempo definido em `SESSION_TIMEOUT_HOURS` (padrão: 24 h), é preciso entrar de novo.

---
<div align="center">

**Versão**: 1.6.4 | **Suporte**: [GitHub Issues](https://github.com/marloon-dev/w-azap/issues)

</div>
