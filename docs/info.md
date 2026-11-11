## ARS Arcana

Uma biblioteca de magias de D&D 5.5 com grimórios locais. O catálogo completo
(391 magias extraídas do PDF de referência) é servido pelo servidor a partir de
PostgreSQL/NeonDB; grimórios, magias salvas e snapshots offline ficam somente no
IndexedDB do navegador. Não há login, conta ou sincronização entre dispositivos.

## O que já funciona

- **Biblioteca de magias** (`/`): busca por nome/descrição, filtros reais de
  escola, classe e círculo (incluindo truques), ordenação e paginação no servidor.
- **Detalhes da magia** (`/magias/[id]`): descrição completa, tempo de
  conjuração, alcance, duração, componentes e ação de salvar.
- **Magias salvas** (`/magias-salvas`): visão "Todas", grimórios nomeados e a
  coleção reservada "Sem grimório", com busca, ordenação e paginação locais.
- **Grimórios**: criar, renomear e excluir com confirmação. Ao excluir, magias
  sem outro grimório nomeado são movidas para "Sem grimório".
- **Offline**: snapshots em cache exibem os detalhes disponíveis; referências sem
  snapshot continuam listadas e podem ser sincronizadas quando a conexão volta.
- **Estados explícitos**: falhas de catálogo ou de IndexedDB nunca viram lista
  vazia ou falso sucesso; há mensagem de erro e ação de tentar novamente.

O "Guia do aventureiro" existe apenas como placeholder informativo ("Em breve").

## Stack

- Next.js 16 (App Router) + React 19 + TypeScript
- Tailwind CSS v4 e componentes Shadcn UI (Base UI)
- Lucide para ícones
- PostgreSQL no NeonDB em produção; PGlite para desenvolvimento/testes locais
- IndexedDB (via `idb`) para grimórios, associações e snapshots
- Vitest, Testing Library e fake-indexeddb

## Rodando localmente

Requisitos: Node.js 20+ e npm.

```bash
npm install
cp .env.example .env.local
npm run db:setup:local
npm run dev
```

O `.env.example` já vem com a opção local:

```dotenv
DATABASE_URL="pglite:.data/catalogo"
```

`npm run db:setup:local` aplica as migrações e importa as 391 magias de
`data/magias.json` para o PostgreSQL embutido em `.data/catalogo` (ignorado pelo
Git). Abra <http://localhost:3000>.

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

> O `build` consulta o banco ao pré-renderizar rotas. Com PGlite local use
> `DATABASE_URL="pglite:.data/catalogo" npm run build`, ou configure o Neon antes
> de compilar.

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
    page.tsx                  # Biblioteca (Server Component)
    magias/[id]/              # Detalhes + fallback para snapshot local
    magias-salvas/            # Coleção local (Client Component)
    api/magias/               # Leitura paginada e busca por IDs
    api/magias/[id]/          # Detalhe para hidratação/fallback offline
  components/                 # Header, cards, filtros, grimórios, diálogos
  lib/
    catalog/                  # Repositório server-only do catálogo
    db/                       # Fábrica Neon/pg/PGlite, migrações e SQL
    import/                   # Validação, upsert e relatório de importação
    local/                    # IndexedDB: grimórios, associações e snapshots
    validation/               # Schemas Zod e tipos compartilhados
data/                         # Catálogo extraído e relatórios
scripts/                      # Extração, migração e importação
tests/                        # Vitest (PGlite + fake-indexeddb)
```

### Limites servidor/cliente

- `DATABASE_URL` e o repositório de catálogo são importados apenas no servidor
  (`server-only`). O navegador consome `/api/magias` e `/api/magias/[id]`, sempre
  com `cache: no-store`.
- Busca, filtros e paginação do catálogo são resolvidos em SQL. A busca é
  insensível a acentos e maiúsculas.
- Nenhuma tabela de usuários, grimórios ou favoritos existe no banco remoto.

### IndexedDB (`ars-arcana`, versão 1)

| Store           | Conteúdo                                                             |
| --------------- | -------------------------------------------------------------------- |
| `listas_salvas` | Grimórios, incluindo a coleção reservada `sem-grimorio`              |
| `magias_salvas` | Associações `[listaId, magiaId]`, com índice por lista e por magia   |
| `cache_magias`  | Snapshot completo da magia, `cachedAt` e `expiresAt` (TTL de 7 dias) |

Regras principais:

- "Sem grimório" é criada automaticamente, não pode ser renomeada/excluída e é
  exclusiva com grimórios nomeados.
- Uma magia pode estar em vários grimórios nomeados; não pode estar neles e em
  "Sem grimório" ao mesmo tempo.
- Snapshot expirado ou ausente nunca apaga a referência local.
- O nome "Sem grimório" é reservado para grimórios nomeados.
- Se o IndexedDB falhar, a interface informa o erro e oferece nova tentativa.

## Qualidade

```bash
npm run lint
npm run typecheck
npm run test
DATABASE_URL="pglite:.data/catalogo" npm run build
```

Os testes cobrem regras de grimórios, exclusividade, exclusão com movimentação,
validação da fonte (391 magias), importação idempotente, migrações PGlite,
consultas/facetas/paginação do catálogo e schemas de validação.

### Validação de navegador

O fluxo completo pode ser reexecutado com Playwright usando o Chrome instalado
(sem baixar navegadores). Com o catálogo local servido em `http://localhost:3000`
e uma segunda instância sem `DATABASE_URL` em `http://localhost:3001`:

```bash
npm run test:e2e
```

Variáveis opcionais: `E2E_BASE_URL`, `E2E_ERROR_BASE_URL`, `E2E_OUT_DIR` e
`CHROME_PATH`. O script cobre Biblioteca, detalhes, salvar, criação/renomeação/
exclusão de grimórios, busca/paginação local, snapshots offline, referência sem
snapshot, ID inválido, layout estreito, falha de IndexedDB e catálogo sem
configuração. As capturas e o resumo ficam em `e2e/artifacts/` (ignorado pelo Git).

## Limitações do MVP

- Dados locais não têm backup nem sincronização; limpar o navegador os remove.
- Sem autenticação, administração de catálogo pela UI ou compartilhamento.
- O Guia do aventureiro ainda não tem conteúdo funcional.
- O fallback offline depende de snapshots que já tenham sido carregados neste
  navegador; referências sem snapshot aparecem como indisponíveis até sincronizar.
