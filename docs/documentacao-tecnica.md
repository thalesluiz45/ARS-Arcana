# Documentação técnica completa

Este documento explica o código deste repositório de ponta a ponta: bibliotecas,
estrutura de pastas, o caminho de cada requisição, quem chama quem, o modelo de
dados, as regras de negócio, o cache offline e os scripts de manutenção.

Documentos relacionados já existentes: `docs/architecture.md` (arquitetura
resumida), `docs/info.md` (visão de produto e operação), `specs/` e `plans/`
(planejamento).

---

## 1. O que é o projeto

Uma biblioteca de magias e um catálogo de equipamentos de **D&D 5.5e** com
contas de usuário:

- **Catálogo público** de 391 magias, servido pelo servidor a partir de
  PostgreSQL (busca, filtros, ordenação e paginação em SQL).
- **Catálogo público** de 174 equipamentos (armas, armaduras, ferramentas e
  itens de aventura), com filtros ortogonais, facetas reais e detalhe por slug.
- **Login exclusivamente com Google** (Auth.js / `next-auth` v5) com sessões de
  banco revogáveis.
- **Grimórios por conta**: coleções nomeadas + a coleção reservada
  `Sem grimório`, persistidas no PostgreSQL e isoladas por usuário.
- **Arsenal por conta**: lista de equipamentos salvos, sem quantidades,
  personagens ou loadouts.
- **Cache offline** apenas dos _detalhes_ de magias (IndexedDB), para leitura
  quando a conexão falha.

Tudo no produto é em português (copy, rotas, colunas do banco); os tipos e
funções TypeScript usam nomes em inglês.

---

## 2. Stack e bibliotecas

### Runtime e framework

| Biblioteca            | Versão | Papel no projeto                                                                                                                        |
| --------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| `next`                | 16.4.6 | App Router, Server Components, Route Handlers, Turbopack. Regras específicas desta versão ficam em `AGENTS.md` (gerado por `next dev`). |
| `react` / `react-dom` | 19.3   | UI; `use`, `cache`, Server Components.                                                                                                  |
| `typescript`          | 5.x    | Tipagem estrita (`strict: true`), alias `@/* → ./src/*`.                                                                                |

### Dados e persistência

| Biblioteca                 | Tipo              | Onde é usada                | Por quê                                                                                                 |
| -------------------------- | ----------------- | --------------------------- | ------------------------------------------------------------------------------------------------------- |
| `@neondatabase/serverless` | dep               | `src/lib/db/factory.ts`     | Driver HTTP para NeonDB (produção).                                                                     |
| `pg` (node-postgres)       | dep               | `factory.ts`, `migrate.ts`  | Pool PostgreSQL comum (Neon, local, testes).                                                            |
| `@electric-sql/pglite`     | **devDependency** | `src/lib/db/pglite.ts`      | PostgreSQL embutido para desenvolvimento/testes; importado dinamicamente (`pglite:` em `DATABASE_URL`). |
| `zod`                      | dep               | `src/lib/validation/*`      | Validação de entrada, parsing de respostas e dos dados importados.                                      |
| `idb`                      | dep               | `src/lib/local/database.ts` | Wrapper de IndexedDB usado só para snapshots de magias e limpeza legada.                                |

`next.config.ts` marca `pg` e `@electric-sql/pglite` como
`serverExternalPackages` (não são empacotados pelo bundler).

### Autenticação

| Biblioteca               | Papel                                                                       |
| ------------------------ | --------------------------------------------------------------------------- |
| `next-auth` ^5 (Auth.js) | Configuração do provider Google, sessões de banco e `signIn`/`signOut`.     |
| `server-only`            | Marcador que impede importação de módulos de servidor no bundle do cliente. |

O Auth.js usa um **adapter customizado** (`src/lib/auth/adapter.ts`) porque as
tabelas têm nomes em português e o cadastro cria também a coleção reservada.

### UI

| Biblioteca                                                    | Papel                                                                            |
| ------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `tailwindcss` 4 + `@tailwindcss/turbopack` + `tw-animate-css` | Estilos (CSS-first, sem `tailwind.config`; tema em `src/app/globals.css`).       |
| `@base-ui/react`                                              | Primitivas _headless_ por trás de todos os componentes de `src/components/ui/`.  |
| `shadcn` + `components.json` (style `base-nova`)              | Gerador/configuração dos componentes `ui/`.                                      |
| `class-variance-authority`                                    | Variantes de `button`, `badge` etc.                                              |
| `cn` (pacote)                                                 | `src/lib/utils.ts` apenas reexporta `cn`, que combina `clsx` + `tailwind-merge`. |
| `lucide-react`                                                | Ícones da interface.                                                             |
| `react-icons`                                                 | Apenas o ícone do GitHub no rodapé (`react-icons/fa6`).                          |
| `sonner` (+`next-themes` no wrapper)                          | Toasts de sucesso/erro.                                                          |
| `next/font/google`                                            | Fontes Inter e Cormorant Garamond.                                               |

### Qualidade

| Biblioteca                                                         | Papel                                                                              |
| ------------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| `vitest` 5 + `@testing-library/react` + `jsdom` + `fake-indexeddb` | Testes unitários/de integração (`tests/`).                                         |
| `playwright-core`                                                  | Script E2E que usa o Chrome já instalado (`e2e/validate.mjs`).                     |
| `tsx` + `dotenv`                                                   | Execução dos scripts TypeScript (`scripts/*.ts`) com carregamento de `.env.local`. |
| `eslint` + `eslint-config-next`                                    | Lint.                                                                              |

---

## 3. Estrutura de pastas

```text
.
├── src/
│   ├── app/
│   │   ├── layout.tsx                 # <html>, fontes, metadata, <AppToaster/>
│   │   ├── loading.tsx                # skeleton raiz
│   │   ├── error.tsx                  # error boundary global (StatePanel + reset)
│   │   ├── not-found.tsx
│   │   ├── globals.css                # tema Tailwind v4 (cores forest/gold/parchment…)
│   │   ├── (site)/                    # grupo com o "shell" do site
│   │   │   ├── layout.tsx             # SiteHeader/Footer + GrimoireDataProvider + LegacyDataCleanup
│   │   │   ├── page.tsx               # "/" Biblioteca (Server Component)
│   │   │   ├── magias/[id]/           # detalhe (page.tsx + spell-detail.tsx + spell-not-found.tsx)
│   │   │   ├── magias-salvas/         # coleção protegida (page.tsx + saved-spells-page.tsx + hook)
│   │   │   ├── equipamento/           # catálogo + detalhe [slug]
│   │   │   ├── guia/                  # placeholder "Em breve"
│   │   │   ├── arsenal/               # coleção autenticada (page.tsx + arsenal-page.tsx)
│   │   ├── login/                     # page.tsx (server) + login-form.tsx + login-backdrop.tsx
│   │   └── api/
│   │       ├── auth/[...nextauth]/route.ts
│   │       ├── magias/route.ts            # lista/busca OU ?ids=
│   │       ├── magias/[id]/route.ts       # detalhe
│   │       ├── equipamentos/route.ts      # catálogo paginado
│   │       ├── equipamentos/[slug]/route.ts
│   │       ├── grimorios/route.ts         # GET snapshot, POST criar
│   │       ├── grimorios/[id]/route.ts    # PATCH renomear, DELETE excluir
│   │       ├── magias-salvas/route.ts     # PUT associação magia↔grimários
│   │       └── arsenal/route.ts + [slug]/route.ts  # GET/POST/DELETE autenticado
│   ├── auth.ts                        # NextAuth(): provider, sessão, callbacks
│   ├── components/                    # componentes de produto + ui/ (primitivas)
│   ├── lib/
│   │   ├── api-response.ts            # jsonResponse/readJsonObject (no-store)
│   │   ├── auth/                      # adapter.ts, session.ts, redirect.ts
│   │   ├── catalog/                   # repository.ts, errors.ts, cursor.ts
│   │   ├── db/                        # client.ts, factory.ts, pglite.ts, migrate.ts, types.ts, migrations/
│   │   ├── equipment/                 # repository.ts, mappers.ts, errors.ts
│   │   ├── grimoires/                 # repository.ts, errors.ts
│   │   ├── import/                    # spells.ts, equipment.ts (validação + upsert + relatório)
│   │   ├── local/                     # database.ts, spell-cache.ts, legacy.ts, events.ts
│   │   ├── validation/                # spell.ts, catalog.ts, grimoire.ts, equipment.ts
│   │   ├── errors.ts search.ts navigation.ts site-navigation.ts utils.ts
│   └── types/next-auth.d.ts           # aumenta Session com user.id
├── data/                              # magias.json, equipamentos.json e relatórios
├── references/                        # PDF e imagens de referência
├── scripts/                           # extract-magias.py, migrate.ts, import-magias.ts, import-equipamentos.ts
├── tests/                             # Vitest (PGlite + fake-indexeddb)
├── e2e/validate.mjs                   # Playwright com Chrome local
├── docs/ plans/ specs/
└── .data/                             # banco PGlite local (ignorado pelo Git)
```

---

## 4. Variáveis de ambiente e execução

`.env.example` documenta tudo; `scripts/load-env.ts` carrega `.env.local` e
depois `.env`.

| Variável                                    | Uso                                                                                                                  |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                              | `pglite:.data/catalogo` (embutido), `pglite:memory` (memória) ou `postgresql://…`. Exigida em runtime por `getDb()`. |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | OAuth do Google. Sem elas os catálogos continuam públicos e o login não conclui.                                     |
| `AUTH_SECRET`                               | Assinatura de cookies/tokens. Em desenvolvimento há um segredo fixo de fallback; em produção é obrigatório.          |
| `AUTH_URL`                                  | Opcional; o app usa `trustHost: true`.                                                                               |

Notas de execução:

- `npm run db:setup:local` = migrações + importação de magias e equipamentos.
- Rotas que tocam banco declaram `export const dynamic = "force-dynamic"` e
  `runtime = "nodejs"`, então `next build` não consulta o banco.
- `DATABASE_URL` ausente não quebra a home: vira um erro explícito 503
  (`catalog-not-configured`).

---

## 5. Camada de dados (a base de tudo)

### 5.1 `DbClient` — a interface mínima

`src/lib/db/types.ts` define:

```ts
interface DbClient {
  query<T>(text: string, params?: unknown[]): Promise<T[]>;
  close?(): Promise<void>;
}
```

Todos os repositórios dependem **apenas** disso, o que permite trocar o banco
sem tocar em SQL.

### 5.2 Fábrica de conexões — `src/lib/db/factory.ts`

```text
createDbClient(DATABASE_URL)
├── começa com "pglite:"  → createPgliteHandle(...)      (PostgreSQL embutido)
├── host termina em ".neon.tech" → neon(url)             (driver HTTP serverless)
└── qualquer outra URL    → new Pool({ max: 5, ... })     (node-postgres)
```

- **PGlite**: `parsePgliteConnectionString` aceita `pglite:`,
  `pglite:memory`, `pglite:.data/catalogo` e `pglite://.data/catalogo`. O módulo
  é importado dinamicamente e o diretório é criado com `mkdir`.
- **Neon**: `sql.query(text, params)` retorna `T[]` diretamente.
- **pg**: `pool.query()` → `result.rows`.

### 5.3 Singleton de request — `src/lib/db/client.ts`

```ts
getDb(); // cria e memoriza o DbClient a partir de process.env.DATABASE_URL
hasDatabaseUrl(); // checagem booleana
```

`client.ts` importa `server-only`, então qualquer tentativa de usar o banco a
partir de um componente cliente falha no build.

### 5.4 Migrações — `src/lib/db/migrate.ts`

`runMigrations(connectionString)`:

1. abre o alvo (`PGlite` ou `Pool` com 1 conexão);
2. cria `public.schema_migrations(filename PK, applied_at)`;
3. lista `src/lib/db/migrations/*.sql` ordenados por nome;
4. para cada arquivo ausente na tabela: `BEGIN` → executa SQL → registra o
   arquivo → `COMMIT`; em erro, `ROLLBACK` e lança erro com `cause`.

`scripts/migrate.ts` embrulha isso com logs e `process.exitCode = 1` em falha.

### 5.5 Esquema SQL

**`001_create_magias.sql`** — catálogo global:

- `public.magias`: `id uuid` (default `gen_random_uuid()`), `slug` único,
  `nome`, `tipo` (= escola), `classes text[]`, `circulo smallint 0–9`,
  `descricao`, `tempo_conjuracao`, `alcance`, `duracao`,
  `componentes_verbal|somatico|material` (bool),
  `componentes_material_descricao`, `criado_em`, `atualizado_em`.
- `CHECK`s de formato (slug `^[a-z0-9]+(-[a-z0-9]+)*$`, campos não vazios,
  círculo 0–9, `classes` não vazio, ao menos um componente, coerência
  material/descrição).
- Índices: `(tipo, circulo)`, `(circulo)`, `(nome)`, `lower(nome)` e GIN em
  `classes`.
- Trigger `trg_magias_atualizado_em` → `atualizado_em = now()` em UPDATE.

**`002_auth_and_grimoires.sql`** — contas e grimórios:

| Tabela               | Função                                                                                                                                                                                                                        |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `usuarios`           | conta criada no primeiro login; `email` único por `lower(email)`.                                                                                                                                                             |
| `contas_oauth`       | vínculo com o Google; PK `(provider, provider_account_id)`, FK `user_id … ON DELETE CASCADE`.                                                                                                                                 |
| `sessoes`            | sessões revogáveis: `session_token` PK, `expires`.                                                                                                                                                                            |
| `tokens_verificacao` | contrato do adapter (não usado pelo fluxo Google).                                                                                                                                                                            |
| `grimorios`          | `user_id`, `nome`, `reservada bool`; índices únicos `(user_id, lower(btrim(nome)))` onde **não** reservada e `(user_id)` onde reservada; CHECKs de tamanho (≤60), nome não vazio e regra `reservada ⇔ nome = 'Sem grimório'`. |
| `magias_salvas`      | associação `(grimorio_id, magia_id)` PK composta, ambas com `ON DELETE CASCADE`, `salva_em`.                                                                                                                                  |

Trigger `tg_grimorios_atualizada_em` mantém `atualizada_em`.

Deletar um usuário cascateia para contas, sessões, grimórios e associações —
o catálogo global permanece.

**`003_equipment_and_arsenal.sql`** — equipamentos e Arsenal:

| Tabela          | Função                                                                                                                                                                                                      |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `equipamentos`  | catálogo global com `slug` único, campos comuns (`nome`, `tipo`, `peso`, `custo`, `fonte_pagina`), colunas específicas por subtipo, `propriedades text[]` e dimensões derivadas `arma_tipo`/`arma_alcance`. |
| `arsenal_itens` | associação `(user_id, equipamento_id)` PK composta, FKs com `ON DELETE CASCADE` e `salvo_em`; não há quantidade nem personagem.                                                                             |

Constraints relevantes:

- `tipo IN ('arma','armadura','ferramenta','aventura')` e um `CHECK` único que
  exige as colunas do subtipo e rejeita as dos demais;
- `categoria` limitada às categorias reais de arma/armadura/ferramenta;
- `tipo_dano` e `furtividade` limitados aos valores da fonte;
- slug no formato `^[a-z0-9]+(-[a-z0-9]+)*$`, nome/custo não vazios e página > 0;
- `arma_tipo`/`arma_alcance` normalizados para os filtros ortogonais.

Índices: `(tipo, nome)`, `(categoria)`, `(arma_tipo, arma_alcance)`,
`lower(nome)`, GIN em `propriedades`, além dos índices de Arsenal por
`equipamento_id` e `(user_id, salvo_em DESC)`. O trigger
`trg_equipamentos_atualizado_em` atualiza `atualizado_em`.

---

## 6. Fluxos de requisição, passo a passo

### 6.1 Biblioteca (`/`) — renderizada no servidor

```text
GET /
└── src/app/(site)/layout.tsx  (Server Component)
    ├── getSessionUser()                     → lib/auth/session.ts
    └── renderiza Shell + GrimoireDataProvider (client)
        └── src/app/(site)/page.tsx
            ├── parseCatalogFilters(searchParams)      lib/validation/catalog.ts
            ├── catalogRepository.searchSpells(filters)
            │   └── getCatalogRepository() → new CatalogRepository(getDb())
            │       └── db.query(...)  → neon | pg | pglite
            │           ├── SELECT count(*) … WHERE <WHERE_CLAUSE>
            │           ├── SELECT … ORDER BY … LIMIT $5 OFFSET $6
            │           └── listFacets()  (escolas, classes, círculos)
            ├── mapSpellRow() → spellSchema.parse(...)  (snake_case → camelCase)
            └── JSX: PageHero, CatalogSearchBar, SpellFilters, SpellSort,
                     SpellCard[], Pagination, StatePanel
```

Detalhes relevantes:

- **Busca insensível a acentos/maiúsculas**: `translate(lower(...), 'áàâãäé…', 'aaaaa…')`
  nas colunas `nome` e `descricao`, comparada com `position($1 in …) > 0`.
- **Filtros**: `tipo = ANY($2::text[])` (escola), `classes && $4::text[]`
  (sobreposição de array — OR entre classes), `circulo = $3`.
- **Ordenação** (`ORDER_BY`): `nome-asc`, `nome-desc`, `circulo-asc`,
  `circulo-desc` (todos com desempate por `id`).
- **Paginação**: `page`/`limit` (limit máx. 50, padrão 12) **ou** cursor
  `base64url(JSON {v:1, offset})`; `decodeCursor` tem prioridade sobre `page`.
  A resposta inclui `nextCursor`/`previousCursor` e `pageCount`.
- **Facetas**: contagens agregadas por escola, classe (`unnest(classes)`) e
  círculo, usadas para os contadores na barra de filtros.
- Se `filters.page > pageCount`, a página faz `redirect()` para a última página
  válida.
- Erros: `describeCatalogFailure(error)` percorre a cadeia de `cause` procurando
  `DatabaseConfigError` → 503 `catalog-not-configured`; caso contrário 503
  `catalog-unavailable`. A UI mostra `StatePanel` com “Tentar novamente” — nunca
  uma lista vazia falsa.

### 6.2 Detalhe da magia (`/magias/[id]`)

```text
page.tsx (server)
├── generateMetadata → catalogRepository.getSpellById(id) → title/description
└── <SpellDetail spellId from> (client)
    ├── 1) getSpellSnapshot(id)        → IndexedDB `cache_magias`
    │      se existir: mostra imediatamente (source = "snapshot", stale?)
    ├── 2) fetch GET /api/magias/[id]
    │      ├── 200 → spellSchema.parse → mostra (source = "server")
    │      │        └── saveSpellSnapshot(spell)   (TTL 7 dias)
    │      ├── 404 → estado "missing" (se não houver snapshot)
    │      └── outro → Notice de sincronização + estado "error" (sem snapshot)
    └── <SpellSaveButton> → ver 6.4
```

`from` vem de `?from=` e é sanitizado por `safeInternalPath` (`lib/navigation.ts`),
definindo o link “Voltar aos grimórios/biblioteca”. Um erro de snapshot nunca
apaga a referência: apenas reduz o que é exibível.

### 6.3 Autenticação (Google)

```text
/login (server page)
├── safeReturnTo(?returnTo | ?callbackUrl)   → lib/auth/redirect.ts
├── getSessionUser() → se logado, redirect(returnTo)
└── <LoginForm returnTo initialError> (client)
    ├── inspectLegacyListData()          → IndexedDB legado (só detecção)
    ├── clique → se há dados legados, AlertDialog de confirmação
    │            └── confirmar → markLegacyCleanupPending() (localStorage)
    └── signIn("google", { redirectTo: returnTo })   (next-auth/react)
```

No servidor, `src/auth.ts`:

- provider `Google` com `prompt: "select_account"`;
- `session.strategy = "database"`, `maxAge` 30 dias, `updateAge` 1 dia;
- `pages.signIn` e `pages.error` → `/login`;
- callbacks: `signIn` recusa provider diferente de Google, e-mail ausente ou
  `email_verified !== true`; `session` copia `user.id` para `session.user.id`;
  `redirect` delega a `resolveAuthRedirect` (só same-origin).

Handlers em `src/app/api/auth/[...nextauth]/route.ts` (`export const { GET, POST } = handlers`).

O adapter (`src/lib/auth/adapter.ts`) implementa o contrato `Adapter` do Auth.js
sobre as tabelas em português. Pontos importantes:

- `createUser`: INSERT do usuário **e** da coleção reservada na mesma CTE
  (`WITH novo AS (INSERT …) , reservado AS (INSERT grimorios …)`), garantindo que
  toda conta nasça com `Sem grimório`. Em corrida de primeiro login
  (violação `23505`), busca o usuário existente e segue o fluxo normal.
- `getSessionAndUser`: só devolve sessões não expiradas (`expires > now()`) e,
  quando expira, apaga a linha de forma best-effort.
- `linkAccount` faz upsert por `(provider, provider_account_id)`.
- `updateUser` monta o `SET` dinamicamente apenas com os campos presentes.

`LegacyDataCleanup` (montado no layout do site **somente com sessão**) consome o
sinal do `localStorage`, limpa `listas_salvas` + `magias_salvas` e remove o
sinal; em falha, mostra aviso fixo com “Tentar novamente”.

### 6.4 Salvar magia em grimórios

```text
SpellSaveButton (client)
└── SpellSaveDialog
    ├── useGrimoireData()            (contexto global do site)
    ├── GET  /api/grimorios          (feito uma vez no provider)
    ├── POST /api/grimorios          (criar grimório dentro do diálogo)
    └── PUT  /api/magias-salvas      { magiaId, grimoireIds[], withoutGrimoire }
        └── refresh() → GET /api/grimorios novamente
```

- Marcar um grimório nomeado desmarca `Sem grimório` (exclusividade na UI).
- `status === "unauthenticated"` → o botão redireciona para `/login?returnTo=…`
  usando `currentLoginHref()`.
- `401` durante uma mutação lança `AuthRequiredError` e também leva ao login.

### 6.5 Magias salvas (`/magias-salvas`)

```text
page.tsx (server)
├── getSessionUser() → sem sessão: redirect(loginHref(pathAtual))
├── valida query params (grimorio ≤120 chars, q ≤120, sort do enum, page 1..100000)
└── <SavedSpellsPage> (client)
    ├── useGrimoireData()  → snapshot (listas + associações + contagens)
    ├── collectionIds     = magiaIds da coleção ativa ("todas" | id reservado | id nomeado)
    ├── useSavedSpellSnapshots(ids, status === "ready")
    │   ├── getSpellSnapshots(ids)        → IndexedDB
    │   ├── refreshSpellSnapshots(ids)    → GET /api/magias?ids=… (lotes de 100)
    │   ├── recalcula em evento `online`
    │   └── retrySync() manual
    ├── busca local  matchesSearch([nome, tipo, descricao, classes], termo)   (lib/search.ts)
    ├── ordenação local (nome/círculo asc-desc, ausentes sempre no fim)
    ├── paginação local (SAVED_PAGE_SIZE = 9)
    └── GrimoireSidebar / GrimoireDialogs (criar, renomear, excluir)
```

A URL é sincronizada com `history.replaceState` (`?grimorio=&q=&sort=&page=`),
sem nova navegação. Magias sem snapshot aparecem como `UnavailableSpellCard`
(“Magia não sincronizada”) — a referência remota nunca é apagada.

### 6.6 Contratos das rotas de API

Todas respondem JSON com `cache-control: no-store` (`src/lib/api-response.ts`) e
usam `runtime = "nodejs"` + `force-dynamic`.

| Rota                       | Método   | Entrada                                                                                         | Saída                                                 |
| -------------------------- | -------- | ----------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| `/api/magias`              | GET      | `q, tipo(s), classe(s), circulo, sort, page, limit, cursor` **ou** `ids=a,b,…` (máx. 100 UUIDs) | `CatalogPage` ou `Spell[]`; 400 `invalid-ids`; 503    |
| `/api/magias/[id]`         | GET      | UUID no path                                                                                    | `Spell`; 400 `invalid-id`; 404 `not-found`; 503       |
| `/api/equipamentos`        | GET      | `q, tipo, arma[], alcance[], armadura[], sort, page, limit`                                     | `EquipmentPage`; 503                                  |
| `/api/equipamentos/[slug]` | GET      | slug no path                                                                                    | `Equipment`; 400 `invalid-slug`; 404 `not-found`; 503 |
| `/api/arsenal`             | GET      | sessão                                                                                          | `ArsenalSnapshot`; 401 `unauthorized`; 503            |
| `/api/arsenal`             | POST     | `{ slug }`                                                                                      | `ArsenalSnapshot`; 401; 400/404; 503                  |
| `/api/arsenal/[slug]`      | DELETE   | slug no path                                                                                    | `ArsenalSnapshot`; 401; 400/404; 503                  |
| `/api/grimorios`           | GET      | sessão                                                                                          | `GrimoireSnapshot`; 401 `unauthorized`; 500           |
| `/api/grimorios`           | POST     | `{ nome }`                                                                                      | 201 `Grimoire`; 400 `invalid`; 409 `conflict`         |
| `/api/grimorios/[id]`      | PATCH    | `{ nome }`                                                                                      | `Grimoire`; 404/400/409                               |
| `/api/grimorios/[id]`      | DELETE   | —                                                                                               | `{ ok: true }`; 404/400                               |
| `/api/magias-salvas`       | PUT      | `{ magiaId, grimoireIds[≤50], withoutGrimoire }`                                                | `{ ok: true }`; 400/404                               |
| `/api/auth/[...nextauth]`  | GET/POST | —                                                                                               | Auth.js                                               |

Mapeamento de erros de grimório (`lib/grimoires/errors.ts`):
`not-found → 404`, `conflict → 409`, `invalid → 400`, resto → 500
`internal-error` com mensagem genérica.

Equipamentos usam `describeEquipmentFailure()`: `not-found → 404`,
`invalid → 400`, `DatabaseConfigError → 503 catalog-not-configured` e demais
falhas → 503 `catalog-unavailable`. Arsenal reutiliza o mesmo mapeamento.

Identidade: **sempre** `getSessionUser().id`. Nenhum `userId` vindo do cliente é
aceito; IDs enviados só identificam o recurso, nunca autorizam.

### 6.7 Catálogo de equipamentos (`/equipamento`)

```text
GET /equipamento?tipo=arma&arma=marcial&alcance=distancia&sort=nome-asc
└── src/app/(site)/equipamento/page.tsx (Server Component)
    ├── parseEquipmentFilters(searchParams)     lib/validation/equipment.ts
    ├── equipmentRepository.searchEquipment(filters)
    │   ├── count(*) + SELECT paginado (ORDER BY categoria/nome)
    │   ├── facetas de tipo (com busca aplicada)
    │   ├── facetas de arma (simples/marcial, corpo-a-corpo/distância)
    │   ├── facetas de armadura (Leve/Média/Pesada/Escudo)
    │   └── typeTotals (contagem por seção no resultado filtrado)
    ├── page > pageCount → redirect() para a última página válida
    └── JSX: PageHero, EquipmentSearchBar, EquipmentFilters,
             EquipmentSort, EquipmentSection/EquipmentGrid, Pagination
```

- **Busca** cobre nome, descrição, categoria, atributo, maestria, tipo de dano
  e propriedades, sem acentos/maiúsculas.
- **Filtros**: OR dentro de `arma` e de `alcance`, AND entre dimensões e entre
  grupos; subfiltros são zerados quando não se aplicam ao `tipo` selecionado.
- **Ordenação**: `categoria` (padrão, com seções e desempate por nome/id),
  `nome-asc` e `nome-desc` (lista plana).
- **URL**: busca, filtros, sort, página e limite são serializados; o link de
  detalhe carrega `from` com o estado completo.
- **Estados**: erro de banco vira `StatePanel` com retry; resultado vazio oferece
  “Limpar filtros”; carregamento usa `LoadingPanel`/`loading.tsx`.

### 6.8 Detalhe do equipamento (`/equipamento/[slug]`)

```text
page.tsx (server)
├── equipmentSlugSchema.safeParse(slug) → inválido: EquipmentNotFound
├── generateMetadata → getEquipmentBySlug() → title/description
├── getEquipmentBySlug(slug) → mapEquipmentRow() → equipmentSchema.parse()
├── from = safeInternalPath(?from, "/equipamento")
└── render específico:
    ├── arma: dano, tipo de dano, maestria e propriedades individuais
    ├── armadura: CA, requisito de Força e furtividade
    ├── ferramenta: categoria, atributo e descrição
    └── aventura: descrição
    + peso, custo, página de origem e EquipmentSaveButton
```

`/arsenal` como origem produz “Voltar ao Arsenal”; qualquer outra origem interna
produz “Voltar ao catálogo”. Falha de banco mostra retry sem transformar o item
em “não encontrado”.

### 6.9 Arsenal (`/arsenal`)

```text
page.tsx (server)
├── getSessionUser() → sem sessão: redirect(loginHref("/arsenal?..."))
└── <ArsenalPage initialQuery> (client)
    ├── useArsenalData()  → GET /api/arsenal no provider do layout
    ├── busca local (nome, categoria, descrição, dano, propriedades…)
    ├── filtro local por tipo + paginação de 9 itens
    └── EquipmentSection + botão remover

EquipmentSaveButton (catálogo/detalhe/Arsenal)
├── status unauthenticated → /login?returnTo=<rota atual>
├── save   → POST /api/arsenal { slug }   (idempotente)
└── remove → DELETE /api/arsenal/<slug>   (idempotente)
```

O servidor deriva o dono exclusivamente da sessão. `POST` usa
`ON CONFLICT DO NOTHING` e `DELETE` limita-se a `user_id + equipamento_id`; ambos
retornam o snapshot atualizado. Erros de persistência mantêm o estado anterior e
mostram toast, sem sucesso falso. O Arsenal não tem quantidades, carga,
personagens ou loadouts.

---

## 7. Repositórios e regras de negócio

### 7.1 `CatalogRepository` (`src/lib/catalog/repository.ts`)

Métodos: `getSpellById`, `getSpellBySlug`, `listSpellsByIds` (máx. 100, ordem
preservada), `searchSpells`, `listSpellSchools`, `listClasses`, `listFacets`.
Singleton via `getCatalogRepository()`; o objeto `catalogRepository` expõe
funções finas sobre ele.

`mapSpellRow` converte a linha (snake_case, `classes` podendo vir como array ou
string `{a,b}`) no tipo `Spell` e roda `spellSchema.parse` — o banco é a última
linha de defesa contra dados inválidos.

### 7.2 `GrimoireRepository` (`src/lib/grimoires/repository.ts`)

| Método                           | Regras                                                                                                                                                                                                                                                                                                     |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ensureReservedGrimoire(userId)` | `INSERT … ON CONFLICT DO NOTHING` da coleção `reservada = true` e retorno dela. Idempotente; chamado antes de snapshot, exclusão e seleção.                                                                                                                                                                |
| `getSnapshot(userId)`            | Lista grimórios (`reservada ASC, lower(nome) ASC`) + associações do usuário; calcula `total` por lista, `namedGrimoires`, `reserved`, `totalUnique` (magias distintas) e `associations`.                                                                                                                   |
| `createGrimoire(userId, nome)`   | Valida nome (Zod) e recusa o nome reservado; `23505` → erro `conflict`.                                                                                                                                                                                                                                    |
| `renameGrimoire`                 | Só grimórios do usuário e `NOT reservada`; nome validado; conflito → `conflict`.                                                                                                                                                                                                                           |
| `deleteGrimoire`                 | Em uma única CTE: move para `Sem grimório` as magias que **não** estão em outro grimório nomeado do usuário, depois apaga o grimório. Recusa excluir a reservada.                                                                                                                                          |
| `updateSpellSelection`           | Recusa `withoutGrimoire` junto com ids nomeados; confirma que a magia existe no catálogo; apaga as associações do usuário para a magia e reinsere apenas nos grimórios válidos; se algum id não pertencer ao usuário → `not-found` (nenhuma escrita é aplicada, pois tudo roda na mesma CTE transacional). |

Erros são `GrimoireRepositoryError` com `code: "not-found" | "conflict" | "invalid"`.

**Regras de produto codificadas:** uma magia pode estar em vários grimórios
nomeados; não pode estar neles e em `Sem grimório` ao mesmo tempo; `Sem grimório`
é única por usuário, não pode ser renomeada/excluída e seu nome é reservado
(também no CHECK do banco); exclusão de grimório preserva as magias.

### 7.3 `EquipmentRepository` (`src/lib/equipment/repository.ts`)

| Método                       | Regras                                                                                                                                   |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `getEquipmentBySlug(slug)`   | Busca exata por slug e valida a linha com `mapEquipmentRow`/`equipmentSchema`.                                                           |
| `searchEquipment(filters)`   | Normaliza filtros, monta um `WHERE` com parâmetros e resolve em paralelo contagem, página, facetas de tipo/arma/armadura e `typeTotals`. |
| `listSavedEquipment(userId)` | JOIN de `arsenal_itens` com `equipamentos` filtrando **somente** pelo `userId` da sessão.                                                |
| `getArsenalSnapshot(userId)` | Retorna `{ items, total }` na ordem categoria → nome → id.                                                                               |
| `saveItem(userId, slug)`     | Confirma que o slug existe e faz `INSERT … ON CONFLICT DO NOTHING`; idempotente, retorna o snapshot.                                     |
| `removeItem(userId, slug)`   | Confirma o slug e apaga apenas `(user_id, equipamento_id)`; não altera o catálogo; retorna o snapshot.                                   |
| `isSaved(userId, slug)`      | `EXISTS` limitado ao usuário, usado pela UI quando necessário.                                                                           |

`buildWhere` aplica `q` na busca normalizada, `tipo`, arrays de arma/alcance e
categorias de armadura, sempre com AND entre grupos. As facetas de arma e
armadura são calculadas a partir do catálogo inteiro (respeitando apenas `q`),
enquanto `typeTotals` usa o `WHERE` completo para os títulos das seções.
`normalizeEquipmentFilters` zera subfiltros que não pertencem ao tipo ativo.

Erros de domínio: `EquipmentRepositoryError` com
`code: "not-found" | "invalid"`. Falhas de banco são convertidas em 503 por
`describeEquipmentFailure`, nunca em lista vazia.

---

## 8. Validação (Zod) e utilitários compartilhados

| Arquivo                   | Conteúdo                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `validation/spell.ts`     | `spellIdSchema` (uuid), `spellSchema`, `spellImportSchema` (sem id/timestamps), `spellComponentsSchema` (refine: descrição material exige a flag), helpers `spellCircleLabel` (“Truque”/“Nº Círculo”), `spellComponentsLabel` (V·S·M), `isConcentrationSpell` (regex em `duracao`).                                                                                                                                            |
| `validation/catalog.ts`   | `CATALOG_PAGE_SIZE=12`, `SAVED_PAGE_SIZE=9`, `MAX_PAGE_SIZE=50`, `catalogSortSchema`, `catalogFilterSchema`, `catalogFacetsSchema`, `parseCatalogFilters` (aceita `URLSearchParams` ou `searchParams` do Next, aceita `tipo`/`tipos` e `classe`/`classes`, deduplica) e `catalogFiltersToSearchParams`.                                                                                                                        |
| `validation/grimoire.ts`  | `RESERVED_GRIMOIRE_NAME`/`RESERVED_GRIMOIRE_ID` (este último legado), `grimoireNameSchema` (1–60), `grimoireSchema`, `grimoireWithCountSchema`, `savedSpellSchema`, `grimoireSnapshotSchema`, `spellSelectionRequestSchema`, `magiaCacheSchema`.                                                                                                                                                                               |
| `validation/equipment.ts` | Schemas discriminados e `.strict()` para arma/armadura/ferramenta/aventura, `equipmentSchema`, `equipmentSlugSchema`, filtros (`q`, `tipo`, `armas[]`, `alcances[]`, `armaduras[]`, `sort`, `page`, `limit`), `parseEquipmentFilters`, `equipmentFiltersToSearchParams`, `equipmentFacetsSchema`, o tipo `EquipmentPage` (com `typeTotals`) e `arsenalSnapshotSchema`; helpers de rótulo para tipo, Força, furtividade e peso. |
| `lib/search.ts`           | `normalizeForSearch` (NFD, remove diacríticos, lowercase pt-BR) e `matchesSearch` — usados na busca **client-side** de magias salvas e do Arsenal.                                                                                                                                                                                                                                                                             |
| `lib/navigation.ts`       | `safeInternalPath`, `currentLoginHref`, `spellHref(id, from)`, `equipmentHref(slug, from)`, `withSearchParams`.                                                                                                                                                                                                                                                                                                                |
| `lib/site-navigation.ts`  | Itens do menu (Biblioteca, Equipamento*, Guia*) com flags `soon` e matcher de rota ativa.                                                                                                                                                                                                                                                                                                                                      |
| `lib/errors.ts`           | `getErrorMessage(error, fallback)`.                                                                                                                                                                                                                                                                                                                                                                                            |
| `lib/api-response.ts`     | `jsonResponse`, `readJsonObject` (objeto JSON ou `null`).                                                                                                                                                                                                                                                                                                                                                                      |
| `lib/catalog/cursor.ts`   | `encodeCursor`/`decodeCursor` (base64url, versão 1, offset limitado a 1.000.000; cursor inválido = primeira página).                                                                                                                                                                                                                                                                                                           |

---

## 9. Estado do cliente

### `GrimoireDataProvider` (`src/components/grimoire-data-provider.tsx`)

Montado no layout de `(site)` — ou seja, em todas as páginas do site.

- `status`: `loading | ready | unauthenticated | error`.
- Na montagem faz `GET /api/grimorios` e valida com `grimoireSnapshotSchema`.
- `401` → `unauthenticated` (sem erro); falhas → `error` + mensagem.
- Expõe: `refresh`, `createGrimoire`, `renameGrimoire`, `deleteGrimoire`,
  `saveSpellSelection`, `getGrimoireIdsForSpell`, `isSpellSaved`,
  `grimoires`, `reserved`, `totalUnique`.
- Derivados em `useMemo`: mapa `magiaId → [grimoireIds]` para marcar o ícone de
  marcador no card e no detalhe.
- Todas as mutações passam por `requestJson` (JSON, `no-store`), que converte
  `401` em `AuthRequiredError` e extrai `{ error }` do corpo.

### `ArsenalDataProvider` (`src/components/arsenal-data-provider.tsx`)

Também montado no layout de `(site)`, recebendo `authenticated` derivado da
sessão no servidor.

- `status`: `loading | ready | unauthenticated | error`.
- Autenticado: `GET /api/arsenal` na montagem; valida com
  `arsenalSnapshotSchema`. `401` → `unauthenticated`; falhas → `error`.
- Expõe `items`, `total`, `refresh`, `save`, `remove` e `isSaved` (derivado de um
  `Set` de slugs).
- `save`/`remove` atualizam o snapshot retornado pelo servidor; erros de
  persistência não alteram o estado anterior e viram toast acionável.
- Deslogado, o provider já nasce `unauthenticated`, sem disparar requisição.

### Cache local (IndexedDB)

Banco `ars-arcana`, versão 1 (`src/lib/local/database.ts`):

| Store           | Conteúdo                                              | Uso atual                      |
| --------------- | ----------------------------------------------------- | ------------------------------ |
| `listas_salvas` | grimórios da versão sem conta                         | **somente detecção/limpeza**   |
| `magias_salvas` | associações `[listaId, magiaId]`                      | **somente detecção/limpeza**   |
| `cache_magias`  | snapshot completo da magia + `cachedAt` + `expiresAt` | cache de detalhes (TTL 7 dias) |

`spell-cache.ts` oferece `saveSpellSnapshot(s)`, `getSpellSnapshot(s)`,
`fetchSpellsFromServer(ids)` (lotes de 100 via `/api/magias?ids=`),
`refreshSpellSnapshots`, `clearExpiredSpellSnapshots`. Toda falha é embrulhada em
`LocalStorageError` com mensagem acionável. O cache nunca é tratado como dado de
usuário: `legacy.ts` só considera `listas_salvas` + `magias_salvas`.

`local/events.ts` publica eventos `ars-arcana:local-data-changed` (ainda usado
por `saveSpellSnapshot` para notificar atualizações de cache).

Sem IndexedDB (SSR, navegador restrito), a UI mostra aviso e mantém as
referências remotas intactas.

---

## 10. Componentes: quem chama quem

| Componente                             | Tipo               | Responsabilidade                                                                                                                                                                          | Depende de                                                                           |
| -------------------------------------- | ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `app/layout.tsx`                       | server             | `<html>`, fontes, `metadata`, `AppToaster`                                                                                                                                                | `app-toaster`                                                                        |
| `(site)/layout.tsx`                    | server             | header/footer, providers de grimórios e Arsenal, limpeza legada se logado                                                                                                                 | `getSessionUser`, `GrimoireDataProvider`, `ArsenalDataProvider`, `LegacyDataCleanup` |
| `site-header`                          | server             | marca + navegação + conta + menu mobile                                                                                                                                                   | `site-nav`, `account-menu`                                                           |
| `account-menu` → `account-menu-dialog` | server → client    | botão `UserRound`; deslogado vira link de login com `returnTo`; logado abre diálogo com Magias Salvas / Arsenal / Sair (`signOut({ redirectTo: "/" })`)                                   | `loginHref`, `next-auth/react`                                                       |
| `site-nav`                             | client             | `DesktopNav`/`MobileNav` a partir de `SITE_NAV_ITEMS`                                                                                                                                     | `lib/site-navigation`                                                                |
| `site-footer`                          | server             | rodapé com GitHub                                                                                                                                                                         | `react-icons`                                                                        |
| `page-hero`                            | server             | faixa de título das páginas                                                                                                                                                               | —                                                                                    |
| `spell-search`                         | client             | `CatalogSearchBar` (navega em `/?q=…`) e `SavedSearchBar` (busca local + “buscar no catálogo”); atalho de teclado `/`                                                                     | `router`, `lib/navigation`                                                           |
| `spell-filters`                        | client             | painel de escolas/classes/círculos com contadores e `Sheet` no mobile; altera a URL                                                                                                       | `facets`, `Checkbox`, `Sheet`                                                        |
| `spell-sort`                           | client             | `SpellSort` (links) e `SortSelect`                                                                                                                                                        | `catalogSortSchema`                                                                  |
| `pagination`                           | client/server-safe | links de página com `hrefForPage` + `onPageChange` opcional                                                                                                                               | —                                                                                    |
| `spell-card`                           | server             | card com escola, círculo, 3 atributos, concentração e botão salvar; `UnavailableSpellCard` para snapshot ausente                                                                          | `SpellSaveButton`, `spellHref`                                                       |
| `spell-save-dialog`                    | client             | `SpellSaveDialog` + `SpellSaveButton` (ícone ou rotulado)                                                                                                                                 | `useGrimoireData`, `currentLoginHref`                                                |
| `grimoire-sidebar`                     | client             | lista “Todas”, grimórios nomeados (com menu renomear/excluir), “Sem grimório”, botão criar                                                                                                | `useGrimoireData`                                                                    |
| `grimoire-dialogs`                     | client             | diálogos de criar / renomear / excluir (AlertDialog) com toasts                                                                                                                           | `useGrimoireData`                                                                    |
| `equipment-search`                     | client             | `EquipmentSearchBar` (Enter/limpar) e `ArsenalSearchBar` (busca local); usa o shell compartilhado                                                                                         | `search-input-shell`, `router`                                                       |
| `search-input-shell`                   | client             | campo de busca reutilizável com ícone, atalho e botão limpar                                                                                                                              | —                                                                                    |
| `equipment-filters`                    | client             | categorias, tipo de arma e categoria de armadura com contagens; painel fixo no desktop e `Sheet` no mobile                                                                                | `facets`, `equipmentFiltersToSearchParams`                                           |
| `equipment-sort`                       | client             | select de ordenação que preserva os demais parâmetros da URL                                                                                                                              | `equipmentSortSchema`                                                                |
| `equipment-card`                       | server             | card tipado por subtipo (dano/CA/descrição), peso, custo, ícone e marcador                                                                                                                | `EquipmentSaveButton`, `equipmentHref`                                               |
| `equipment-section`                    | server             | agrupa cards por tipo e exibe o total filtrado da seção; `EquipmentGrid` para lista plana                                                                                                 | `EquipmentCard`                                                                      |
| `equipment-icon`                       | server             | ícone decorativo por subtipo com texto acessível                                                                                                                                          | —                                                                                    |
| `equipment-save-button`                | client             | salva/remove no Arsenal, mostra spinner e redireciona ao login preservando a rota                                                                                                         | `useArsenalData`, `currentLoginHref`                                                 |
| `arsenal-data-provider`                | client             | snapshot do Arsenal, status e mutações idempotentes                                                                                                                                       | `/api/arsenal`                                                                       |
| `loading-panel`                        | server             | painel `role="status"` com spinner e descrição para carregamentos                                                                                                                         | —                                                                                    |
| `legacy-data-cleanup`                  | client             | banner de limpeza pós-login                                                                                                                                                               | `lib/local/legacy`                                                                   |
| `state-panel`                          | server             | painel de estado vazio/erro com ícone e ações                                                                                                                                             | —                                                                                    |
| `spell-school-icon`                    | server             | ícone/cor por escola de magia                                                                                                                                                             | —                                                                                    |
| `arcane-circle`                        | server             | ornamento SVG                                                                                                                                                                             | —                                                                                    |
| `app-toaster` / `ui/sonner`            | client             | toasts                                                                                                                                                                                    | `sonner`                                                                             |
| `ui/*`                                 | client             | primitivas Shadcn sobre Base UI (button, dialog, alert-dialog, checkbox, dropdown-menu, input, label, popover, scroll-area, select, separator, sheet, skeleton, textarea, tooltip, badge) | `@base-ui/react`                                                                     |

Observação de arquitetura: `SpellCard` e `EquipmentCard` são Server Components
e apenas renderizam filhos clientes (`SpellSaveButton`/`EquipmentSaveButton`),
evitando levar os catálogos para o bundle.

---

## 11. Pipeline de dados (extração → importação)

```text
references/DnD 5.5 - Magias.pdf
   │  scripts/extract-magias.py (PyMuPDF, leitura em duas colunas)
   ▼
data/magias.json  ──►  scripts/import-magias.ts
                         ├── readSourceCatalog()          (JSON precisa ser lista)
                         ├── validateCatalogEntries()     (spellImportSchema + slug duplicado)
                         ├── createDbClient(DATABASE_URL)
                         ├── checa public.magias (to_regclass)
                         ├── upsertCatalog()              (INSERT … ON CONFLICT (slug) DO UPDATE,
                         │                                 RETURNING (xmax = 0) AS inserted)
                         ├── listCatalogSlugs()
                         └── buildImportReport() → data/import-report.json
```

Comportamento do script:

- Sem `--dry-run` e sem `DATABASE_URL` → erro explícito.
- Registros inválidos **interrompem** a importação, a menos que
  `--allow-invalid` seja passado; ainda assim o relatório é gravado.
- Flags: `--dry-run`, `--allow-invalid`, `--source=<path>`,
  `--report=<path>`.
- `process.exitCode = 1` se houver magias da fonte ausentes no banco — útil em CI.
- O relatório reconcilia `sourceCount`, `validCount`, `invalidCount`, `inserted`,
  `updated`, `missingFromDatabase`, `extraInDatabase`, `databaseCount`, faixa de
  páginas e issues por registro.

Estado atual: 391 magias (34 truques + 357 de 1º–9º), 8 escolas, 8 classes,
0 inválidas — ver `data/*.json`.

### Equipamentos — `data/equipamentos.json` → `scripts/import-equipamentos.ts`

```text
data/equipamentos.json  (174 registros já extraídos; não há reextração do PDF)
   │
   ├── readEquipmentSource()          (JSON precisa ser uma lista)
   ├── validateEquipmentEntries()     (equipmentSchema discriminado + slug duplicado)
   ├── createDbClient(DATABASE_URL)
   ├── checa public.equipamentos (to_regclass)
   ├── upsertEquipmentCatalog()       (INSERT … ON CONFLICT (slug) DO UPDATE,
   │                                   RETURNING id, (xmax = 0) AS inserted)
   ├── listEquipmentSlugs() / countEquipmentByType()
   └── buildEquipmentImportReport() → data/equipment-import-report.json
```

- As propriedades das armas são gravadas individualmente em `text[]`; os campos
  de armadura/ferramenta/aventura em colunas próprias. `getWeaponTraits()`
  deriva `arma_tipo` e `arma_alcance` da categoria.
- Registros inválidos ou slugs duplicados interrompem a importação, salvo
  `--allow-invalid`; o relatório registra índice, slug, página e mensagem.
- Flags: `--dry-run`, `--allow-invalid`, `--source=<path>`, `--report=<path>`.
- `process.exitCode = 1` se houver itens da fonte ausentes no banco.
- O arquivo é lido **somente pela importação**. O runtime do site consulta o
  PostgreSQL; `data/equipamentos.json` é ignorado pelo Git e precisa ser
  fornecido ao ambiente de importação (CI/artefato ou `--source`).

Estado atual: 174 válidos (38 armas, 13 armaduras, 25 ferramentas, 98 itens de
aventura), 0 inválidos. A reimportação resultou em 0 inserções, 174 atualizações
e 174 registros no banco, preservando os IDs.

---

## 12. Scripts e testes

| Comando                                   | O que faz                                                                                                            |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `npm run dev` / `build` / `start`         | Next.js (Turbopack).                                                                                                 |
| `npm run lint` / `typecheck`              | ESLint / `tsc --noEmit`.                                                                                             |
| `npm run test` / `test:watch`             | Vitest (`tests/**/*.test.ts`, ambiente node, `fileParallelism: false`).                                              |
| `npm run test:e2e`                        | `node e2e/validate.mjs` (Playwright + Chrome local; requer `localhost:3000` com banco e `localhost:3001` sem banco). |
| `npm run db:migrate`                      | `scripts/migrate.ts`.                                                                                                |
| `npm run db:import` / `db:import:dry`     | `scripts/import-magias.ts` / com `--dry-run`.                                                                        |
| `npm run db:import:equipamentos` / `:dry` | `scripts/import-equipamentos.ts` / com `--dry-run`.                                                                  |
| `npm run db:setup:local`                  | migrações + importação de magias e equipamentos.                                                                     |

`vitest.config.mts` aponta `server-only` para `tests/server-only.ts` (em Vitest o
módulo real lançaria erro) e resolve o alias `@/`.

Cobertura existente (`tests/`): catálogo de magias (consultas, facetas,
paginação), catálogo de equipamentos (busca sem acentos, filtros ortogonais,
facets, ordenação, paginação, campos por subtipo), repositório de grimórios
(isolamento entre contas, coleção reservada, exclusividade, exclusão com
movimentação, nomes), Arsenal (save/remove idempotente, isolamento entre duas
contas e preservação do catálogo), adapter do Auth.js (criação automática de
usuário + grimório reservado, vínculo de conta, sessões e revogação), redirects
seguros, limpeza legada preservando `cache_magias`, importações idempotentes,
migrações em PGlite, schemas de validação e `api-response`. A suíte tem 70
testes em 11 arquivos.

O E2E cobre o fluxo público (biblioteca, busca, filtros, paginação, detalhes,
login, redirecionamentos com `returnTo`, confirmação legada, catálogo de
equipamentos com busca/filtros/ordenação/paginação, detalhes dos quatro
subtipos, proteção das APIs, layout estreito e catálogo sem configuração) e
grava artefatos em `e2e/artifacts/`. O cenário autenticado do Arsenal só roda
quando `E2E_AUTH_STORAGE_STATE` aponta para um `storageState` obtido após login
Google real; sem isso, o script imprime `SKIP`.

---

## 13. Decisões e convenções que explicam o código

1. **Banco em português, código em inglês.** Colunas, rotas, stores e mensagens
   são em pt-BR; tipos e funções em inglês. Renomear identificadores persistidos
   exigiria migração própria.
2. **`server-only` como fronteira.** `db/client.ts`, repositórios, adapter e
   `auth/session.ts` importam `server-only`; o navegador só conversa por `/api/*`.
3. **Falhas explícitas.** Não existe “lista vazia” para erro: cada falha vira
   `StatePanel`/`Notice` com mensagem e ação de tentar novamente.
4. **Autorização derivada da sessão.** `getSessionUser` é memoizado por request
   com `cache()` do React, trata `unstable_rethrow` para não engolir
   `redirect()`/erros de controle do Next e devolve `null` quando o banco de
   auth está fora — páginas públicas continuam servindo, áreas privadas
   redirecionam para o login.
5. **`no-store` em toda API.** Catálogo e coleção são sempre fresco.
6. **Snapshot nunca substitui a verdade remota.** IndexedDB serve para leitura
   offline; referências ausentes continuam listadas e são ressincronizadas.
7. **Sem `NEXT_PUBLIC_` para segredos.** `DATABASE_URL`, credenciais Google e
   `AUTH_SECRET` nunca chegam ao cliente.
8. **Migrações versionadas por arquivo**, aplicadas em ordem com transação por
   arquivo e registro em `schema_migrations`.
9. **`slug` é a chave de negócio do equipamento.** Upserts atualizam pela slug,
   preservam o `id` do banco e permitem reimportar sem duplicar o catálogo.
10. **Dados por subtipo em colunas, não em texto concatenado.** Propriedades de
    arma permanecem individuais em `text[]`; `arma_tipo`/`arma_alcance` são
    dimensões derivadas para filtros ortogonais.
11. **O JSON de equipamentos é artefato de importação, não de runtime.** O site
    só lê o PostgreSQL; o arquivo fica fora do bundle e nunca deve ir para
    `public/`.

---

## 14. Limitações e próximos passos naturais

- Login apenas Google; sem e-mail/senha, recuperação de senha, exclusão ou
  exportação de conta.
- `/guia` continua placeholder (“Em breve”).
- Confirmar os direitos de uso do conteúdo de equipamentos antes de publicar o
  catálogo. O Neon hospedado já foi migrado e importado (174 itens); falta o
  smoke test no deploy da Vercel.
- O Arsenal é uma lista de itens salvos, sem quantidades, carga, personagens ou
  loadouts. O fluxo autenticado de navegador depende de um `storageState` Google
  real (`E2E_AUTH_STORAGE_STATE`) e não roda por padrão.
- Sem compartilhamento de grimórios entre contas, colaboração ou administração
  de catálogo pela UI.
- Offline cobre só detalhes de magias já visitados; coleção, Arsenal e grimórios
  exigem servidor.
- `clearExpiredSpellSnapshots` existe mas não é chamado automaticamente; o TTL é
  aplicado na leitura (flag `stale`).
- Cursor de paginação é, na prática, um offset codificado (não keyset).
