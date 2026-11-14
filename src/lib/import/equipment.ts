import { readFile } from "node:fs/promises";
import path from "node:path";

import type { DbClient } from "@/lib/db/types";
import {
  EQUIPMENT_TYPE_ORDER,
  equipmentSchema,
  getWeaponTraits,
  type Equipment,
  type EquipmentImport,
  type EquipmentType,
} from "@/lib/validation/equipment";

export const DEFAULT_EQUIPMENT_SOURCE_PATH = path.join(
  process.cwd(),
  "data",
  "equipamentos.json",
);
export const DEFAULT_EQUIPMENT_REPORT_PATH = path.join(
  process.cwd(),
  "data",
  "equipment-import-report.json",
);

export type EquipmentValidationIssue = {
  index: number;
  slug: string | null;
  message: string;
  page: number | null;
};

export type DuplicateSlug = {
  slug: string;
  indices: number[];
};

export type ValidatedEquipmentCatalog = {
  items: EquipmentImport[];
  issues: EquipmentValidationIssue[];
  duplicates: DuplicateSlug[];
  countsByType: Record<EquipmentType, number>;
};

export type EquipmentUpsertResult = {
  slug: string;
  id: string;
  inserted: boolean;
};

export type EquipmentImportReport = {
  sourceCount: number;
  validCount: number;
  invalidCount: number;
  issues: EquipmentValidationIssue[];
  duplicates: DuplicateSlug[];
  countsByType: Record<EquipmentType, number>;
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

export function emptyTypeCounts(): Record<EquipmentType, number> {
  return {
    arma: 0,
    armadura: 0,
    ferramenta: 0,
    aventura: 0,
  };
}

function readPage(entry: RawEntry): number | null {
  const value = entry.fontePagina;
  return typeof value === "number" && Number.isInteger(value) ? value : null;
}

function readSlug(entry: RawEntry): string | null {
  return typeof entry.slug === "string" && entry.slug.trim()
    ? entry.slug.trim()
    : null;
}

export async function readEquipmentSource(
  sourcePath = DEFAULT_EQUIPMENT_SOURCE_PATH,
): Promise<{ entries: unknown[]; sourcePath: string }> {
  const contents = await readFile(sourcePath, "utf8");
  const parsed: unknown = JSON.parse(contents);
  if (!Array.isArray(parsed)) {
    throw new Error(
      "O arquivo de origem deve conter uma lista JSON de equipamentos.",
    );
  }
  return { entries: parsed, sourcePath };
}

export function validateEquipmentEntries(
  entries: unknown[],
): ValidatedEquipmentCatalog {
  const items: EquipmentImport[] = [];
  const issues: EquipmentValidationIssue[] = [];
  const firstIndexBySlug = new Map<string, number>();
  const indicesBySlug = new Map<string, number[]>();
  const countsByType = emptyTypeCounts();

  entries.forEach((entry, index) => {
    const raw = typeof entry === "object" && entry !== null ? (entry as RawEntry) : {};
    const slug = readSlug(raw);
    const page = readPage(raw);

    if (slug) {
      const firstIndex = firstIndexBySlug.get(slug);
      if (firstIndex !== undefined) {
        const indices = indicesBySlug.get(slug) ?? [firstIndex];
        indices.push(index);
        indicesBySlug.set(slug, indices);
        issues.push({
          index,
          slug,
          page,
          message: `Slug duplicado na fonte (já usado no índice ${firstIndex}).`,
        });
        return;
      }
      firstIndexBySlug.set(slug, index);
    }

    const parsed = equipmentSchema.safeParse(entry);
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

    items.push(parsed.data);
    countsByType[parsed.data.tipo] += 1;
  });

  const duplicates = [...indicesBySlug.entries()]
    .map(([duplicateSlug, indices]) => ({ slug: duplicateSlug, indices }))
    .sort((left, right) => left.slug.localeCompare(right.slug, "pt-BR"));

  return { items, issues, duplicates, countsByType };
}

const UPSERT_SQL = `
  INSERT INTO public.equipamentos (
    slug,
    nome,
    tipo,
    categoria,
    dano,
    tipo_dano,
    propriedades,
    maestria,
    classe_armadura,
    forca,
    furtividade,
    atributo,
    descricao,
    peso,
    custo,
    fonte_pagina,
    arma_tipo,
    arma_alcance
  )
  VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9,
    $10, $11, $12, $13, $14, $15, $16, $17, $18
  )
  ON CONFLICT (slug) DO UPDATE SET
    nome = EXCLUDED.nome,
    tipo = EXCLUDED.tipo,
    categoria = EXCLUDED.categoria,
    dano = EXCLUDED.dano,
    tipo_dano = EXCLUDED.tipo_dano,
    propriedades = EXCLUDED.propriedades,
    maestria = EXCLUDED.maestria,
    classe_armadura = EXCLUDED.classe_armadura,
    forca = EXCLUDED.forca,
    furtividade = EXCLUDED.furtividade,
    atributo = EXCLUDED.atributo,
    descricao = EXCLUDED.descricao,
    peso = EXCLUDED.peso,
    custo = EXCLUDED.custo,
    fonte_pagina = EXCLUDED.fonte_pagina,
    arma_tipo = EXCLUDED.arma_tipo,
    arma_alcance = EXCLUDED.arma_alcance,
    atualizado_em = now()
  RETURNING id::text AS id, (xmax = 0) AS inserted
`;

type UpsertRow = { id: string; inserted: boolean };

function equipmentColumns(item: Equipment): unknown[] {
  if (item.tipo === "arma") {
    const traits = getWeaponTraits(item.categoria);
    return [
      item.slug,
      item.nome,
      item.tipo,
      item.categoria,
      item.dano,
      item.tipoDano,
      item.propriedades,
      item.maestria,
      null,
      null,
      null,
      null,
      null,
      item.peso,
      item.custo,
      item.fontePagina,
      traits.tipo,
      traits.alcance,
    ];
  }

  if (item.tipo === "armadura") {
    return [
      item.slug,
      item.nome,
      item.tipo,
      item.categoria,
      null,
      null,
      [],
      null,
      item.classeArmadura,
      item.forca,
      item.furtividade,
      null,
      null,
      item.peso,
      item.custo,
      item.fontePagina,
      null,
      null,
    ];
  }

  if (item.tipo === "ferramenta") {
    return [
      item.slug,
      item.nome,
      item.tipo,
      item.categoria,
      null,
      null,
      [],
      null,
      null,
      null,
      null,
      item.atributo,
      item.descricao,
      item.peso,
      item.custo,
      item.fontePagina,
      null,
      null,
    ];
  }

  return [
    item.slug,
    item.nome,
    item.tipo,
    null,
    null,
    null,
    [],
    null,
    null,
    null,
    null,
    null,
    item.descricao,
    item.peso,
    item.custo,
    item.fontePagina,
    null,
    null,
  ];
}

export async function upsertEquipmentCatalog(
  db: DbClient,
  items: EquipmentImport[],
): Promise<EquipmentUpsertResult[]> {
  const results: EquipmentUpsertResult[] = [];

  for (const item of items) {
    const rows = await db.query<UpsertRow>(UPSERT_SQL, equipmentColumns(item));
    const row = rows[0];
    if (!row) {
      throw new Error(
        `O banco não retornou o equipamento importado para o slug “${item.slug}”.`,
      );
    }
    results.push({
      slug: item.slug,
      id: row.id,
      inserted: Boolean(row.inserted),
    });
  }

  return results;
}

export async function listEquipmentSlugs(db: DbClient): Promise<string[]> {
  const rows = await db.query<{ slug: string }>(
    "SELECT slug FROM public.equipamentos ORDER BY slug",
  );
  return rows.map((row) => row.slug);
}

export async function countEquipmentByType(
  db: DbClient,
): Promise<Record<EquipmentType, number>> {
  const rows = await db.query<{ tipo: string; total: number | string }>(
    `SELECT tipo, count(*)::int AS total
     FROM public.equipamentos
     GROUP BY tipo`,
  );
  const counts = emptyTypeCounts();
  for (const row of rows) {
    if (EQUIPMENT_TYPE_ORDER.includes(row.tipo as EquipmentType)) {
      counts[row.tipo as EquipmentType] = Number(row.total);
    }
  }
  return counts;
}

export function buildEquipmentImportReport(input: {
  entries: unknown[];
  validated: ValidatedEquipmentCatalog;
  upserted: EquipmentUpsertResult[];
  databaseSlugs: string[] | null;
  databaseCountsByType?: Record<EquipmentType, number> | null;
  dryRun: boolean;
}): EquipmentImportReport {
  const sourceSlugs = new Set(input.validated.items.map((item) => item.slug));
  const databaseSlugs = input.databaseSlugs;
  const databaseSet = databaseSlugs ? new Set(databaseSlugs) : null;
  const pages = input.entries
    .map((entry) =>
      typeof entry === "object" && entry !== null
        ? readPage(entry as RawEntry)
        : null,
    )
    .filter((page): page is number => page !== null);

  return {
    sourceCount: input.entries.length,
    validCount: input.validated.items.length,
    invalidCount: input.validated.issues.length,
    issues: input.validated.issues,
    duplicates: input.validated.duplicates,
    countsByType: input.validated.countsByType,
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

export function formatEquipmentImportReport(
  report: EquipmentImportReport,
): string {
  const lines = [
    `ARS Arcana — importação de equipamentos ${report.dryRun ? "(simulação)" : "concluída"}`,
    `Fonte: ${report.sourceCount} registros (${report.pages.first ?? "?"}–${report.pages.last ?? "?"} páginas)`,
    `Válidos: ${report.validCount} · Inválidos: ${report.invalidCount}`,
    `Armas: ${report.countsByType.arma} · Armaduras: ${report.countsByType.armadura} · Ferramentas: ${report.countsByType.ferramenta} · Aventura: ${report.countsByType.aventura}`,
    report.dryRun
      ? "Nenhuma escrita foi realizada."
      : `Inseridos: ${report.inserted} · Atualizados: ${report.updated}`,
  ];

  if (report.databaseCount !== null) {
    lines.push(`Banco após a operação: ${report.databaseCount} registros`);
  }
  if (report.duplicates.length > 0) {
    lines.push(
      `Slugs duplicados: ${report.duplicates
        .map((duplicate) => `${duplicate.slug} (${duplicate.indices.join(", ")})`)
        .join("; ")}`,
    );
  }
  if (report.missingFromDatabase.length > 0) {
    lines.push(`Ausentes no banco: ${report.missingFromDatabase.join(", ")}`);
  }
  if (report.extraInDatabase.length > 0) {
    lines.push(
      `Extras no banco (não presentes na fonte): ${report.extraInDatabase.join(", ")}`,
    );
  }
  if (report.issues.length > 0) {
    lines.push("Registros inválidos:");
    for (const issue of report.issues) {
      lines.push(
        `  #${issue.index} ${issue.slug ?? "(sem slug)"} [página ${issue.page ?? "?"}]: ${issue.message}`,
      );
    }
  }

  return lines.join("\n");
}
