# Architecture

ARS Arcana uses the Next.js App Router with server-rendered catalog pages and
client-side IndexedDB persistence.

## Source layout

| Path | Responsibility |
| --- | --- |
| `src/app/` | Public routes, server pages, and API route handlers |
| `src/app/magias-salvas/use-saved-spell-snapshots.ts` | Client-side saved-spell snapshot loading and refresh lifecycle |
| `src/components/` | Shared layout and interactive UI |
| `src/components/grimoire-sidebar.tsx` | Grimoire collection navigation |
| `src/components/grimoire-dialogs.tsx` | Grimoire create, rename, and delete dialogs |
| `src/lib/catalog/` | Server-only catalog queries and row mapping |
| `src/lib/db/` | PostgreSQL, Neon, and PGlite adapters and migrations |
| `src/lib/import/spells.ts` | Catalog validation, upserts, and import reports |
| `src/lib/local/` | Browser-only IndexedDB access, grimoires, and spell snapshots |
| `src/lib/validation/spell.ts` | Spell payload schemas and shared spell types |
| `src/lib/validation/grimoire.ts` | Grimoire and saved-spell schemas |
| `tests/` | Vitest coverage for validation, catalog queries, and local persistence |

## Runtime boundaries

- Database access is server-only. Browser components use `/api/magias` and
  `/api/magias/[id]`; these existing routes remain stable.
- IndexedDB access is client-side and is isolated in `src/lib/local/`.
- The app has no user accounts or remote persistence for grimoires.
- Catalog failures and local-storage failures remain explicit; they are not
  represented as empty results.

## Data compatibility

The spell payload contains Portuguese field names, and the PostgreSQL schema,
migration filenames, API paths, and IndexedDB stores and indexes also use
existing Portuguese identifiers. They are intentionally unchanged: the payload
is used by the catalog, and the IndexedDB schema is version 1 with user data
already stored in browsers.

The `Spell` type and TypeScript module/function names are English, while the
spell payload shape and user-facing Portuguese copy remain unchanged. Renaming
persistent identifiers requires a separate migration and compatibility plan.

## Validation

Run the relevant checks from the repository root:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```
