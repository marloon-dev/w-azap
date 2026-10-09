# 🗄️ Guia de Configuração do Banco de Dados

Este guia mostra como preparar o banco de dados do **W-AZAP**. O projeto usa o **Prisma ORM** e está configurado para **MySQL** por padrão; também é possível usar **PostgreSQL**.

## 1. Pré-requisitos

Você precisa de um servidor de banco de dados em execução. As opções:
- **PM2 (recomendado)**: MySQL/PostgreSQL instalado no próprio servidor, `.env` configurado e a aplicação gerenciada pelo PM2.
- **Docker Compose (alternativa)**: o `docker-compose.yml` sobe um MySQL 8.0 junto com a aplicação.
- **Desenvolvimento local**: MySQL ou PostgreSQL instalado na sua máquina.
- **Produção gerenciada**: um serviço de banco gerenciado (ex.: AWS RDS, PlanetScale, Neon, Supabase).

---

## 2. Docker Compose (alternativa)

O `docker-compose.yml` na raiz do projeto define dois containers: o MySQL 8.0 (`w-azap-db`) e a aplicação (`w-azap-app`).

1. **Preparar o ambiente**:
   ```bash
   cp .env.example .env
   ```
   Edite o `.env` e preencha com valores fortes:
   - `AUTH_SECRET` e `DATA_ENCRYPTION_KEY`, gerados com `openssl rand -base64 32`;
   - `MYSQL_ROOT_PASSWORD`;
   - `ADMIN_EMAIL` e `ADMIN_PASSWORD`, para a conta Super Admin inicial (mínimo de 8 caracteres).

2. **Subir a stack**:
   ```bash
   docker compose up -d
   ```

3. **O que acontece na inicialização**:
   - o banco MySQL é criado;
   - todas as tabelas são criadas automaticamente (`npx prisma db push`);
   - a conta Super Admin é criada com as credenciais `ADMIN_EMAIL`/`ADMIN_PASSWORD` do `.env`. Se o e-mail já existir, a conta só é promovida a Super Admin.

> [!NOTE]
> A porta do MySQL (`3306`) é publicada apenas em `127.0.0.1`: o banco não fica exposto na rede. A aplicação acessa o banco pela rede interna do Docker.

---

## 3. Configuração (bare-metal)

Edite o `.env` e defina a `DATABASE_URL`.

### MySQL
```env
DATABASE_URL="mysql://usuario:senha@host-do-banco:3306/wa_akg"
```

### PostgreSQL
```env
DATABASE_URL="postgresql://usuario:senha@host-do-banco:5432/wa_akg?schema=public"
```

> [!TIP]
> Se a senha tiver caracteres especiais (`@`, `:`, `/`, `#`…), codifique-os para URL. Por exemplo, `@` vira `%40`.

### Usuário dedicado (recomendado)

Não use o `root` na aplicação. No MySQL:
```sql
CREATE DATABASE wa_akg CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'wa_akg'@'localhost' IDENTIFIED BY 'uma-senha-forte';
GRANT ALL PRIVILEGES ON wa_akg.* TO 'wa_akg'@'localhost';
FLUSH PRIVILEGES;
```

---

## 4. Comandos de inicialização

Os comandos principais já estão no `package.json`.

### Sincronizar o schema
Envia o schema do Prisma para o banco, criando todas as tabelas, e gera o Prisma Client:

```bash
npm run db:push
```

### Explorar os dados
Abre uma interface web para navegar pelas tabelas:

```bash
npm run db:studio
```

### Zerar o banco (cuidado!)
Apaga **todos** os dados e recria o banco do zero:

```bash
npx prisma migrate reset
```

> [!WARNING]
> Zerar o banco apaga também as sessões do WhatsApp: todos os QR codes terão de ser escaneados de novo.

---

## 5. Trocar o provedor do banco

O projeto vem configurado para **MySQL**. Para trocar (por exemplo, para PostgreSQL):

1. **Abra `prisma/schema.prisma`**.
2. **Localize o bloco `datasource`**:
   ```prisma
   datasource db {
     provider = "mysql" // troque para "postgresql"
     url      = env("DATABASE_URL")
   }
   ```
3. **Atualize o `.env`**: ajuste a `DATABASE_URL` para o formato do novo provedor (veja a [seção 3](#3-configuração-bare-metal)).
4. **Remova as migrações** (opcional, mas recomendado): apague a pasta `prisma/migrations`, se existir, para evitar conflitos.
5. **Envie as mudanças**:
   ```bash
   npm run db:push
   ```

> [!NOTE]
> Trocar de provedor **não migra os dados**. Exporte e importe os dados por conta própria ou comece com um banco vazio.

---

## 6. Criar um usuário administrador

Você precisa de um usuário **SUPERADMIN** para acessar as configurações do painel. Existem duas formas:

**a) Pelo navegador**: em uma instalação nova, a **primeira conta** cadastrada em `/auth/register` vira Super Admin automaticamente. Depois disso, o cadastro público é fechado.

**b) Pela linha de comando**:

```bash
npm run make-admin <email> <senha>
```

Exemplo:
```bash
npm run make-admin admin@exemplo.com 'Uma-Senha-Forte-123'
```

- Se o usuário **não existir**, ele é criado com o papel `SUPERADMIN`.
- Se o usuário **já existir**, ele é promovido a `SUPERADMIN` (a senha informada é ignorada).

> [!TIP]
> Se o script não encontrar o banco, passe a URL explicitamente:
> `DATABASE_URL="mysql://..." npm run make-admin admin@exemplo.com 'senha'`

---

## 7. Solução de problemas

- **Erro de conexão**: confira se o servidor de banco está rodando e se as credenciais do `.env` estão corretas.
- **Erro do Prisma Client** / `Unknown field`: depois de mudar o schema, rode `npm run db:push` (ou `npx prisma generate`) e **reinicie o servidor**.
- **`Can't reach database server`**: verifique host e porta. No Docker, o host é `db`, não `localhost`.
- **Sessões do WhatsApp corrompidas**: se a `DATA_ENCRYPTION_KEY` mudou, as linhas da tabela `AuthState` não podem ser lidas. Restaure a chave antiga ou desconecte a sessão e escaneie o QR de novo.
