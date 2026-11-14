import { readFile } from "node:fs/promises";
import path from "node:path";

import type { DbClient } from "@/lib/db/types";
import {
  spellImportSchema,
  type SpellImport,
} from "@/lib/validation/spell";

export const DEFAULT_SOURCE_PATH = path.join(process.cwd(), "data", "magias.json");
export const DEFAULT_REPORT_PATH = path.join(process.cwd(), "data", "import-report.json");

export type CatalogValidationIssue = {
  index: number;
  slug: string | null;
  message: string;
  page: number | null;
};

export type ValidatedCatalog = {
  spells: SpellImport[];
  issues: CatalogValidationIssue[];
};

export type UpsertResult = {
  slug: string;
  id: string;
  inserted: boolean;
};

export type ImportReconciliation = {
  sourceCount: number;
  validCount: number;
  invalidCount: number;
  issues: CatalogValidationIssue[];
  inserted: number;
  updated: number;
  missingFromDatabase: string[];
  extraInDatabase: string[];
  databaseCount: number | null;
  pages: { first: number | null; last: number | null };
  dryRun: boolean;
  generatedAt: string;
};

type RawEntry = Record<string, unknown>;

function readPage(entry: RawEntry): number | null {
  const value = entry.fontePagina;
  return typeof value === "number" && Number.isInteger(value) ? value : null;
}

function readSlug(entry: RawEntry): string | null {
  return typeof entry.slug === "string" && entry.slug.trim() ? entry.slug.trim() : null;
}

export async function readSourceCatalog(
  sourcePath = DEFAULT_SOURCE_PATH,
): Promise<{ entries: unknown[]; sourcePath: string }> {
  const contents = await readFile(sourcePath, "utf8");
  const parsed: unknown = JSON.parse(contents);
  if (!Array.isArray(parsed)) {
    throw new Error("O arquivo de origem deve conter uma lista JSON de magias.");
  }
  return { entries: parsed, sourcePath };
}

export function validateCatalogEntries(entries: unknown[]): ValidatedCatalog {
  const spells: SpellImport[] = [];
  const issues: CatalogValidationIssue[] = [];
  const seenSlugs = new Map<string, number>();

  entries.forEach((entry, index) => {
    const raw = typeof entry === "object" && entry !== null ? (entry as RawEntry) : {};
    const slug = readSlug(raw);
    const page = readPage(raw);

    if (slug) {
      const previous = seenSlugs.get(slug);
      if (previous !== undefined) {
        issues.push({
          index,
          slug,
          page,
          message: `Slug duplicado na fonte (já usado no índice ${previous}).`,
        });
        return;
      }
      seenSlugs.set(slug, index);
    }

    const parsed = spellImportSchema.safeParse(entry);
    if (!parsed.success) {
      issues.push({
        index,
        slug,
        page,
        message: parsed.error.issues
          .map((issue) => `${issue.path.join(".") || "registro"}: ${issue.message}`)
          .join("; "),
      });
      return;
    }

    spells.push(parsed.data);
  });

  return { spells, issues };
}

const UPSERT_SQL = `
  INSERT INTO public.magias (
    slug,
    nome,
    tipo,
    classes,
    circulo,
    descricao,
    tempo_conjuracao,
    alcance,
    duracao,
    componentes_verbal,
    componentes_somatico,
    componentes_material,
    componentes_material_descricao
  )
  VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13
  )
  ON CONFLICT (slug) DO UPDATE SET
    nome = EXCLUDED.nome,
    tipo = EXCLUDED.tipo,
    classes = EXCLUDED.classes,
    circulo = EXCLUDED.circulo,
    descricao = EXCLUDED.descricao,
    tempo_conjuracao = EXCLUDED.tempo_conjuracao,
    alcance = EXCLUDED.alcance,
    duracao = EXCLUDED.duracao,
    componentes_verbal = EXCLUDED.componentes_verbal,
    componentes_somatico = EXCLUDED.componentes_somatico,
    componentes_material = EXCLUDED.componentes_material,
    componentes_material_descricao = EXCLUDED.componentes_material_descricao,
    atualizado_em = now()
  RETURNING id::text AS id, (xmax = 0) AS inserted
`;

type UpsertRow = { id: string; inserted: boolean };

export async function upsertCatalog(
  db: DbClient,
  spells: SpellImport[],
): Promise<UpsertResult[]> {
  const results: UpsertResult[] = [];

  for (const spell of spells) {
    const rows = await db.query<UpsertRow>(UPSERT_SQL, [
      spell.slug,
      spell.nome,
      spell.tipo,
      spell.classes,
      spell.circulo,
      spell.descricao,
      spell.tempoConjuracao,
      spell.alcance,
      spell.duracao,
      spell.componentes.verbal,
      spell.componentes.somatico,
      spell.componentes.material,
      spell.componentes.materialDescricao ?? null,
    ]);
    const row = rows[0];
    if (!row) {
      throw new Error(`O banco não retornou o registro importado para o slug “${spell.slug}”.`);
    }
    results.push({ slug: spell.slug, id: row.id, inserted: Boolean(row.inserted) });
  }

  return results;
}

export async function listCatalogSlugs(db: DbClient): Promise<string[]> {
  const rows = await db.query<{ slug: string }>("SELECT slug FROM public.magias ORDER BY slug");
  return rows.map((row) => row.slug);
}

export function buildImportReport(input: {
  entries: unknown[];
  validated: ValidatedCatalog;
  upserted: UpsertResult[];
  databaseSlugs: string[] | null;
  dryRun: boolean;
}): ImportReconciliation {
  const sourceSlugs = new Set(input.validated.spells.map((spell) => spell.slug));
  const databaseSlugs = input.databaseSlugs;
  const databaseSet = databaseSlugs ? new Set(databaseSlugs) : null;
  const pages = input.entries
    .map((entry) =>
      typeof entry === "object" && entry !== null ? readPage(entry as RawEntry) : null,
    )
    .filter((page): page is number => page !== null);

  return {
    sourceCount: input.entries.length,
    validCount: input.validated.spells.length,
    invalidCount: input.validated.issues.length,
    issues: input.validated.issues,
    inserted: input.upserted.filter((entry) => entry.inserted).length,
    updated: input.upserted.filter((entry) => !entry.inserted).length,
    missingFromDatabase:
      databaseSet === null
        ? []
        : [...sourceSlugs].filter((slug) => !databaseSet.has(slug)).sort(),
    extraInDatabase:
      databaseSlugs === null
        ? []
        : databaseSlugs.filter((slug) => !sourceSlugs.has(slug)).sort(),
    databaseCount: databaseSlugs?.length ?? null,
    pages: {
      first: pages.length ? Math.min(...pages) : null,
      last: pages.length ? Math.max(...pages) : null,
    },
    dryRun: input.dryRun,
    generatedAt: new Date().toISOString(),
  };
}

export function formatImportReport(report: ImportReconciliation): string {
  const lines = [
    `ARS Arcana — importação ${report.dryRun ? "(simulação)" : "concluída"}`,
    `Fonte: ${report.sourceCount} registros (${report.pages.first ?? "?"}–${report.pages.last ?? "?"} páginas)`,
    `Válidos: ${report.validCount} · Inválidos: ${report.invalidCount}`,
    report.dryRun
      ? "Nenhuma escrita foi realizada."
      : `Inseridos: ${report.inserted} · Atualizados: ${report.updated}`,
  ];

  if (report.databaseCount !== null) {
    lines.push(`Banco após a operação: ${report.databaseCount} registros`);
  }
  if (report.missingFromDatabase.length > 0) {
    lines.push(`Ausentes no banco: ${report.missingFromDatabase.join(", ")}`);
  }
  if (report.extraInDatabase.length > 0) {
    lines.push(`Extras no banco (não presentes na fonte): ${report.extraInDatabase.join(", ")}`);
  }
  if (report.issues.length > 0) {
    lines.push("Registros inválidos:");
    for (const issue of report.issues) {
      lines.push(`  #${issue.index} ${issue.slug ?? "(sem slug)"} [página ${issue.page ?? "?"}]: ${issue.message}`);
    }
  }

  return lines.join("\n");
}
