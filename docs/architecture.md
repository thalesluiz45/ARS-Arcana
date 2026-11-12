# Architecture

ARS Arcana uses the Next.js App Router with server-rendered catalog pages,
Google OAuth (Auth.js), server-side sessions, and PostgreSQL persistence for
per-user grimoires. The catalog remains public; saved spells are private.

## Source layout

| Path | Responsibility |
| --- | --- |
| `src/app/(site)/` | Public and authenticated application routes with the site shell |
| `src/app/login/` | Google-only login screen and legacy-data confirmation |
| `src/app/api/auth/[...nextauth]/` | Auth.js route handlers |
| `src/app/api/grimorios/` | Authenticated grimoire list/create/rename/delete |
| `src/app/api/magias-salvas/` | Authenticated spell-to-grimoire selection |
| `src/auth.ts` | Google provider, database sessions, and redirect callback |
| `src/lib/auth/` | Session reading, Auth.js adapter, and safe redirect helpers |
| `src/lib/grimoires/` | Ownership-scoped grimoire repository and error mapping |
| `src/lib/catalog/` | Server-only catalog queries and row mapping |
| `src/lib/db/` | PostgreSQL, Neon, and PGlite adapters and migrations |
| `src/lib/local/` | Browser-only spell snapshot cache and legacy list cleanup |
| `src/components/` | Shared layout, account menu, grimoire UI, and dialogs |
| `tests/` | Vitest coverage for catalog, auth adapter, repository, redirects, and legacy cleanup |

## Runtime boundaries

- Database access is server-only. Browser components use `/api/magias` and
  `/api/magias/[id]` for the public catalog and the authenticated
  `/api/grimorios` and `/api/magias-salvas` routes for personal data.
- The identity used by every personal operation comes from the server session
  (`getSessionUser`). Client-provided user IDs are never accepted.
- `/magias-salvas` is protected in the server component; anonymous visitors are
  redirected to `/login?returnTo=...`. The redirect callback only accepts
  internal destinations.
- `src/lib/local/` still owns the `cache_magias` IndexedDB snapshot cache. The
  legacy `listas_salvas` and `magias_salvas` stores are only read to detect old
  data and are cleared after explicit confirmation plus a successful login.
- Catalog failures, auth failures, and remote collection failures remain
  explicit; they are not represented as empty results.

## Data model

Migration `002_auth_and_grimoires.sql` adds:

- `usuarios`, `contas_oauth`, `sessoes`, and `tokens_verificacao` for Auth.js.
- `grimorios`, scoped by `user_id`, with a unique reserved collection
  (`reservada = true`) and case-insensitive unique names per user.
- `magias_salvas`, associating a grimoire with a global catalog spell.

Every query filters by the session user. Deleting an account cascades to its
OAuth accounts, sessions, grimoires, and saved spells while preserving the
global catalog. Deleting a named grimoire moves spells that have no other named
grimoire to the reserved `Sem grimório` collection.

## Data compatibility

The spell payload contains Portuguese field names, and the PostgreSQL schema,
migration filenames, API paths, and IndexedDB stores use existing Portuguese
identifiers. The `Spell` type and TypeScript module/function names are English.
Renaming persistent identifiers requires a separate migration and compatibility
plan.

## Validation

Run the relevant checks from the repository root:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```
