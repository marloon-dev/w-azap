# Como contribuir com o W-AZAP

Obrigado pelo interesse em contribuir! 🎉

## Ambiente de desenvolvimento

```bash
git clone https://github.com/marloon-dev/w-azap.git
cd w-azap
npm install
npx patch-package        # aplica o patch do Baileys (necessário no npm 11+, que bloqueia scripts de instalação)
cp .env.example .env
# Edite o .env: DATABASE_URL, AUTH_SECRET e DATA_ENCRYPTION_KEY
npm run db:push          # cria as tabelas e gera o Prisma Client
npm run dev              # http://localhost:3000
```

Requisitos: **Node.js 20.9+** (22 recomendado), **npm 10+** e **MySQL 8.0** (ou PostgreSQL).

Com Docker:
```bash
docker compose up -d
```

> [!IMPORTANT]
> O Baileys é fixado na versão `7.0.0-rc.9` e recebe um patch grande (`patches/`). Não atualize o pacote sem recriar o patch. Depois de qualquer `npm install`, rode `npx patch-package` e `npx prisma generate`.

## Convenção de branches e commits

| Prefixo da branch | Uso                          |
|-------------------|------------------------------|
| `feat/`           | Nova funcionalidade          |
| `fix/`            | Correção de bug              |
| `chore/`          | Manutenção / dependências    |
| `docs/`           | Documentação                 |

**Mensagens de commit** seguem o formato:
```
tipo: descrição curta

feat: adiciona resposta automática com IA
fix: corrige pareamento por QR code
chore: atualiza baileys para 7.0.0
```

## Processo de Pull Request

1. Faça um fork e crie sua branch a partir de `main` (ex.: `feat/respostas-com-ia`).
2. Implemente as mudanças e teste.
3. Garanta que `npm run lint`, `npm run typecheck` e `npm run build` terminem sem erros (o CI roda os três).
4. Abra o PR para a branch `main`.
5. Preencha o template de PR por completo.
6. Aguarde a revisão de um mantenedor.

## Estilo de código

- TypeScript em modo estrito.
- ESLint (`npm run lint`): o CI falha com qualquer **erro**. Os avisos atuais são débito técnico herdado do projeto original (principalmente `any` explícito); não adicione novos e, se puder, corrija os que encontrar pelo caminho.
- TailwindCSS utility-first: evite CSS próprio, a não ser que seja necessário.
- camelCase para variáveis e funções; PascalCase para componentes React.

### Textos da interface (i18n)

O painel é traduzido para 14 idiomas. **Não escreva textos fixos nos componentes.** Em vez disso:

1. adicione a chave em `src/lib/i18n/dictionaries/dashboard/en.ts` (a tipagem `DashboardDictionary` vem desse arquivo);
2. adicione a mesma chave nos outros 13 arquivos (`pt-BR.ts`, `es.ts`, `fr.ts`, `de.ts`, `it.ts`, `ru.ts`, `zh-CN.ts`, `ja.ts`, `ko.ts`, `ar.ts`, `hi.ts`, `id.ts`, `tr.ts`);
3. use `const { t } = useTranslation()` em componentes cliente ou `getTranslations()` em componentes de servidor.

O `tsc` acusa chaves faltando em qualquer dicionário.

### Segurança

- Toda rota nova deve chamar `getAuthenticatedUser` e, se receber `sessionId`, `canAccessSession`.
- URLs vindas do usuário (mídia, webhooks) devem passar por `assertPublicHttpUrl` / `safeFetch` (`src/lib/safe-fetch.ts`).
- Nunca devolva segredos (chave de API, segredo de webhook, chave do remove.bg) em respostas de listagem.
- Ao criar ou mudar um endpoint, atualize `src/lib/swagger.ts` e regenere a documentação:
  ```bash
  npm run docs:generate
  ```
  O CI falha se `swagger.json` ou `docs/API_DOCUMENTATION.md` estiverem desatualizados.

## Precisa de ajuda?

- Issues marcadas como `good first issue` são ótimas para começar.
- Dúvidas: [GitHub Discussions](https://github.com/marloon-dev/w-azap/discussions).
- Ao participar, você concorda com o [Código de Conduta](./CODE_OF_CONDUCT.md).
