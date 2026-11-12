## ARS Arcana

Uma biblioteca de magias de D&D 5.5 com grimórios por conta. O catálogo completo
(391 magias extraídas do PDF de referência) é servido pelo servidor a partir de
PostgreSQL/NeonDB. O login usa exclusivamente Google OAuth; usuários, sessões,
grimórios e magias salvas ficam no PostgreSQL e são isolados por conta. Apenas
os snapshots de detalhes para leitura offline permanecem no IndexedDB do
navegador.

## O que já funciona

- **Biblioteca de magias** (`/`): busca por nome/descrição, filtros reais de
  escola, classe e círculo (incluindo truques), ordenação e paginação no servidor.
- **Detalhes da magia** (`/magias/[id]`): descrição completa, tempo de
  conjuração, alcance, duração, componentes e ação de salvar.
- **Login com Google** (`/login`): único método de autenticação, com conta criada
  automaticamente no primeiro acesso e retorno seguro à rota de origem.
- **Magias salvas** (`/magias-salvas`): visão "Todas", grimórios nomeados e a
  coleção reservada "Sem grimório", com busca, ordenação e paginação. Exige
  sessão; visitantes deslogados são levados ao login.
- **Grimórios**: criar, renomear e excluir com confirmação. Ao excluir, magias
  sem outro grimório nomeado são movidas para "Sem grimório". Tudo é persistido
  no PostgreSQL e sincronizado entre dispositivos.
- **Conta**: botão com ícone `UserRound` no cabeçalho; autenticado, abre um modal
  com Magias Salvas, Arsenal e Sair. Deslogado, leva ao login.
- **Offline**: snapshots em cache exibem os detalhes disponíveis; referências sem
  snapshot continuam listadas e podem ser sincronizadas quando a conexão volta.
- **Estados explícitos**: falhas de catálogo, sessão ou servidor nunca viram
  lista vazia ou falso sucesso; há mensagem de erro e ação de tentar novamente.

O "Guia do aventureiro" e o "Equipamento" existem como placeholders informativos
("Em breve"), assim como o "Arsenal" acessível pelo menu da conta.

## Stack

- Next.js 16 (App Router) + React 19 + TypeScript
- Tailwind CSS v4 e componentes Shadcn UI (Base UI)
- Lucide para ícones
- Auth.js (`next-auth` v5) com Google Provider e sessões de banco
- PostgreSQL no NeonDB em produção; PGlite para desenvolvimento/testes locais
- IndexedDB (via `idb`) apenas para snapshots de magias e limpeza legada
- Vitest, Testing Library e fake-indexeddb

## Rodando localmente

Requisitos: Node.js 20+ e npm.

```bash
npm install
cp .env.example .env.local
npm run db:setup:local
npm run dev
```

O `.env.example` já vem com a opção local de banco:

```dotenv
DATABASE_URL="pglite:.data/catalogo"
```

Para habilitar o login, preencha também as credenciais Google e o segredo:

```dotenv
GOOGLE_CLIENT_ID="..."
GOOGLE_CLIENT_SECRET="..."
AUTH_SECRET="..."
```

Cadastre `http://localhost:3000/api/auth/callback/google` como URL de
redirecionamento autorizada no Google Cloud Console. Sem essas variáveis a
Biblioteca continua pública, mas o botão de login não conclui o fluxo.

`npm run db:setup:local` aplica as migrações (catálogo, contas e grimórios) e
importa as 391 magias de `data/magias.json` para o PostgreSQL embutido em
`.data/catalogo` (ignorado pelo Git). Abra <http://localhost:3000>.

Para usar outro diretório ou um banco em memória, altere `DATABASE_URL`:

```dotenv
DATABASE_URL="pglite:memory"
```

## Usando NeonDB

1. Crie um projeto no Neon e copie a connection string para `DATABASE_URL` no
   `.env.local` (nunca use o prefixo `NEXT_PUBLIC_`).
2. Prefira a conexão **direta** para migrações/importação e a conexão **pooled**
   para a aplicação em execução.
3. Execute:

```bash
npm run db:migrate
npm run db:import
```

A importação valida todos os registros antes de escrever, faz upsert por `slug`
(preservando o `id` de registros existentes) e grava o relatório de reconciliação
em `data/import-report.json`. Registros inválidos interrompem a importação, a
menos que `--allow-invalid` seja passado explicitamente.

## Scripts

| Comando                       | Descrição                                     |
| ----------------------------- | --------------------------------------------- |
| `npm run dev`                 | Servidor de desenvolvimento                   |
| `npm run build` / `npm start` | Build e execução em produção                  |
| `npm run lint`                | ESLint                                        |
| `npm run typecheck`           | Verificação de tipos (`tsc --noEmit`)         |
| `npm run test`                | Testes Vitest                                 |
| `npm run db:setup:local`      | Migrações + importação no banco configurado   |
| `npm run db:migrate`          | Aplica migrações SQL pendentes                |
| `npm run db:import`           | Importa/atualiza todo o catálogo              |
| `npm run db:import:dry`       | Valida a fonte e relata sem escrever no banco |

> As rotas que dependem de sessão/catálogo são dinâmicas, então o `build` não
> consulta o banco. O `DATABASE_URL` é necessário em execução (`npm start`/`dev`)
> para carregar o catálogo e a coleção de cada conta.

## Catálogo e dados

A fonte do catálogo é `references/DnD 5.5 - Magias.pdf` (105 páginas). O extrator
`scripts/extract-magias.py` usa PyMuPDF para reconstruir a leitura em duas colunas
e gerar `data/magias.json`; ele não é necessário para rodar a aplicação.

Estado atual da extração/importação:

- 391 magias extraídas, sem duplicatas ou problemas de parsing;
- 34 truques (círculo 0) e 357 magias de 1º a 9º círculo;
- 8 escolas e 8 classes, com as duas dimensões armazenadas separadamente;
- 391 registros válidos e importados, 0 inválidos;
- relatórios em `data/extraction-report.json`, `data/import-report.json` e
  `data/validation-report.json`.

Para regenerar a partir do PDF (requer Python 3 e `pip install pymupdf`):

```bash
python scripts/extract-magias.py
npm run db:import
```

**Direitos de uso:** o PDF e o conteúdo das magias pertencem aos seus respectivos
titulares. O repositório não concede licença sobre esse material; cabe a quem
implanta a aplicação confirmar que o uso e a redistribuição do conteúdo são
autorizados.

## Arquitetura

```text
src/
  app/
    (site)/
      page.tsx                # Biblioteca (Server Component)
      magias/[id]/            # Detalhes + fallback para snapshot local
      magias-salvas/          # Coleção remota (protegida por sessão)
      equipamento/            # Placeholder
      guia/                   # Placeholder
      arsenal/                # Placeholder acessível pela conta
    login/                    # Tela Google OAuth + confirmação legada
    api/
      auth/[...nextauth]/     # Auth.js
      magias/                 # Leitura paginada e busca por IDs
      magias/[id]/            # Detalhe para hidratação/fallback offline
      grimorios/              # CRUD autenticado de grimórios
      magias-salvas/          # Associação autenticada magia/grimório
  components/                 # Header, conta, cards, filtros, grimórios, diálogos
  lib/
    auth/                     # Sessão, adapter Auth.js e redirects seguros
    catalog/                  # Repositório server-only do catálogo
    db/                       # Fábrica Neon/pg/PGlite, migrações e SQL
    grimoires/                # Repositório de grimórios com ownership
    import/                   # Validação, upsert e relatório de importação
    local/                    # Snapshots e limpeza dos stores legados
    validation/               # Schemas Zod e tipos compartilhados
data/                         # Catálogo extraído e relatórios
scripts/                      # Extração, migração e importação
tests/                        # Vitest (PGlite + fake-indexeddb)
```

### Limites servidor/cliente

- `DATABASE_URL`, credenciais Google, `AUTH_SECRET` e os repositórios são
  importados apenas no servidor (`server-only`). O navegador consome as rotas
  `/api/*` com `cache: no-store`.
- Busca, filtros e paginação do catálogo são resolvidos em SQL. A busca é
  insensível a acentos e maiúsculas.
- Toda operação de grimório usa o `user_id` da sessão no servidor. IDs enviados
  pelo cliente identificam o recurso, mas não concedem autorização.
- `/magias-salvas` redireciona visitantes deslogados para
  `/login?returnTo=...`; o callback de OAuth aceita apenas destinos internos.
- Usuários, contas Google, sessões, grimórios e associações vivem no PostgreSQL.
  A migração `002_auth_and_grimoires.sql` cria as tabelas e os índices de
  unicidade/ownership.

### IndexedDB (`ars-arcana`, versão 1)

| Store           | Conteúdo                                                             |
| --------------- | -------------------------------------------------------------------- |
| `listas_salvas` | Legado: grimórios da versão sem conta (somente detecção/limpeza)      |
| `magias_salvas` | Legado: associações `[listaId, magiaId]` (somente detecção/limpeza)   |
| `cache_magias`  | Snapshot completo da magia, `cachedAt` e `expiresAt` (TTL de 7 dias) |

Regras principais:

- Os stores legados nunca são importados para a conta. A tela de login detecta
  sua presença, pede confirmação explícita e só os apaga após login bem-sucedido.
- `cache_magias` é preservado: ele contém snapshots do catálogo, não listas de
  usuário.
- Snapshot expirado ou ausente nunca apaga a referência remota; a magia continua
  na conta e pode ser sincronizada quando a conexão voltar.
- Se a limpeza legada falhar, a interface informa o erro, mantém os dados
  bloqueados e oferece nova tentativa.
- No PostgreSQL, "Sem grimório" é criada automaticamente por usuário, não pode
  ser renomeada/excluída e é exclusiva com grimórios nomeados.
- Uma magia pode estar em vários grimórios nomeados; não pode estar neles e em
  "Sem grimório" ao mesmo tempo. O nome "Sem grimório" é reservado.

## Qualidade

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

Os testes cobrem:

- regras de grimórios: isolamento entre duas contas, coleção reservada,
  exclusividade, exclusão com movimentação e validação de nomes;
- adapter Auth.js: criação automática de usuário, vínculo com a conta Google,
  sessões e revogação;
- redirects seguros (`returnTo`, callback do OAuth e rejeição de destinos
  externos);
- detecção e limpeza apenas dos stores legados, preservando `cache_magias`;
- validação da fonte (391 magias), importação idempotente, migrações PGlite,
  consultas/facetas/paginação do catálogo e schemas de validação.

### Validação de navegador

O fluxo público pode ser reexecutado com Playwright usando o Chrome instalado
(sem baixar navegadores). Com o catálogo local servido em `http://localhost:3000`
e uma segunda instância sem `DATABASE_URL` em `http://localhost:3001`:

```bash
npm run test:e2e
```

Variáveis opcionais: `E2E_BASE_URL`, `E2E_ERROR_BASE_URL`, `E2E_OUT_DIR` e
`CHROME_PATH`. O script cobre Biblioteca, busca, filtros, paginação, detalhes,
tela de login, redirecionamento de áreas/ações privadas para o login com
`returnTo`, confirmação dos dados legados (cancelar preserva os stores), menu de
conta deslogado, placeholders de Equipamento/Arsenal/Guia, proteção das APIs,
layout estreito e catálogo sem configuração. As capturas e o resumo ficam em
`e2e/artifacts/` (ignorado pelo Git).

O fluxo autenticado real (login Google, grimórios e Sair) depende de
`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` e `AUTH_SECRET` configurados e de uma
conta Google de teste; por isso ele não faz parte do script padrão. O adapter,
as regras de ownership e os redirects são cobertos pelos testes automatizados.

## Limitações do MVP

- O login exige uma conta Google e credenciais OAuth configuradas; não há
  cadastro por e-mail/senha nem recuperação de senha.
- Não há exclusão/exportação da conta, administração de catálogo pela UI,
  compartilhamento de grimórios ou colaboração entre contas.
- O Guia do aventureiro, o Equipamento e o Arsenal ainda são placeholders.
- O fallback offline cobre apenas detalhes já visitados neste navegador; a
  coleção e os grimórios exigem o servidor para leitura e alterações.
- Dados legados de listas no IndexedDB não são importados; quando existem, só
  são apagados após confirmação explícita e login bem-sucedido.
