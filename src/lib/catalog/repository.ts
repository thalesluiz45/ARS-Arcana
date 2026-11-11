import "server-only";

import { getDb, type DatabaseRow, type DbClient } from "@/lib/db/client";
import {
  catalogFacetsSchema,
  catalogFilterSchema,
  type CatalogFacets,
  type CatalogFilters,
  type CatalogPage,
} from "@/lib/validation/catalog";
import { magiaSchema, type Magia } from "@/lib/validation/magia";

import { decodeCursor, encodeCursor } from "./cursor";

const SELECT_COLUMNS = `
  id,
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
  componentes_material_descricao,
  criado_em,
  atualizado_em
`;

const SEARCH_ACCENTS = "áàâãäéèêëíìîïóòôõöúùûüçñýÿ";
const SEARCH_WITHOUT_ACCENTS = "aaaaaeeeeiiiiooooouuuucnyy";

function normalizedSearch(expression: string): string {
  return `translate(lower(${expression}), '${SEARCH_ACCENTS}', '${SEARCH_WITHOUT_ACCENTS}')`;
}

const WHERE_CLAUSE = `
  (
    $1 = ''
    OR position(${normalizedSearch("$1::text")} in ${normalizedSearch("nome")}) > 0
    OR position(${normalizedSearch("$1::text")} in ${normalizedSearch("descricao")}) > 0
  )
  AND (cardinality($2::text[]) = 0 OR tipo = ANY($2::text[]))
  AND ($3::smallint IS NULL OR circulo = $3)
  AND (cardinality($4::text[]) = 0 OR classes && $4::text[])
`;

const ORDER_BY: Record<CatalogFilters["sort"], string> = {
  "nome-asc": "nome ASC, id ASC",
  "nome-desc": "nome DESC, id ASC",
  "circulo-asc": "circulo ASC, nome ASC, id ASC",
  "circulo-desc": "circulo DESC, nome ASC, id ASC",
};

function toIsoString(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string" && value) {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date.toISOString();
  }
  return new Date(0).toISOString();
}

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }
  if (typeof value === "string") {
    return value
      .replace(/^\{/, "")
      .replace(/\}$/, "")
      .split(",")
      .map((item) => item.replace(/^"|"$/g, "").trim())
      .filter(Boolean);
  }
  return [];
}

export function mapMagiaRow(row: DatabaseRow): Magia {
  return magiaSchema.parse({
    id: row.id,
    slug: row.slug,
    nome: row.nome,
    tipo: row.tipo,
    classes: toStringArray(row.classes),
    circulo: Number(row.circulo),
    descricao: row.descricao,
    tempoConjuracao: row.tempo_conjuracao,
    alcance: row.alcance,
    duracao: row.duracao,
    componentes: {
      verbal: Boolean(row.componentes_verbal),
      somatico: Boolean(row.componentes_somatico),
      material: Boolean(row.componentes_material),
      materialDescricao: row.componentes_material_descricao ?? null,
    },
    criadoEm: toIsoString(row.criado_em),
    atualizadoEm: toIsoString(row.atualizado_em),
  });
}

type FacetQueryRow = { valor: string | number; total: number | string };

export class CatalogRepository {
  constructor(private readonly db: DbClient) {}

  async getMagiaById(id: string): Promise<Magia | null> {
    const rows = await this.db.query(`SELECT ${SELECT_COLUMNS} FROM public.magias WHERE id = $1`, [
      id,
    ]);
    return rows[0] ? mapMagiaRow(rows[0]) : null;
  }

  async getMagiaBySlug(slug: string): Promise<Magia | null> {
    const rows = await this.db.query(
      `SELECT ${SELECT_COLUMNS} FROM public.magias WHERE slug = $1`,
      [slug],
    );
    return rows[0] ? mapMagiaRow(rows[0]) : null;
  }

  async listarMagiasPorIds(ids: string[]): Promise<Magia[]> {
    if (ids.length === 0) return [];
    const uniqueIds = [...new Set(ids)].slice(0, 100);
    const rows = await this.db.query(
      `SELECT ${SELECT_COLUMNS} FROM public.magias WHERE id = ANY($1::uuid[])`,
      [uniqueIds],
    );
    const byId = new Map(rows.map((row) => [String(row.id), mapMagiaRow(row)]));
    return uniqueIds
      .map((id) => byId.get(id))
      .filter((spell): spell is Magia => Boolean(spell));
  }

  async buscarMagias(input: CatalogFilters): Promise<CatalogPage> {
    const filters = catalogFilterSchema.parse(input);
    const cursorOffset = decodeCursor(filters.cursor);
    const requestedOffset = cursorOffset ?? Math.max(0, (filters.page - 1) * filters.limit);
    const offset = Math.min(requestedOffset, 1_000_000);
    const filterParams = [filters.q, filters.tipos, filters.circulo, filters.classes];

    const [countRows, dataRows, facets] = await Promise.all([
      this.db.query<{ total: number | string }>(
        `SELECT count(*)::int AS total FROM public.magias WHERE ${WHERE_CLAUSE}`,
        filterParams,
      ),
      this.db.query(
        `SELECT ${SELECT_COLUMNS}
         FROM public.magias
         WHERE ${WHERE_CLAUSE}
         ORDER BY ${ORDER_BY[filters.sort]}
         LIMIT $5 OFFSET $6`,
        [...filterParams, filters.limit, offset],
      ),
      this.listarFacetas(),
    ]);

    const total = Number(countRows[0]?.total ?? 0);
    const page = Math.floor(offset / filters.limit) + 1;
    const pageCount = Math.max(1, Math.ceil(total / filters.limit));
    const nextOffset = offset + filters.limit;
    const previousOffset = Math.max(0, offset - filters.limit);

    return {
      items: dataRows.map(mapMagiaRow),
      total,
      page,
      pageSize: filters.limit,
      pageCount,
      nextCursor: nextOffset < total ? encodeCursor(nextOffset) : null,
      previousCursor: offset > 0 ? encodeCursor(previousOffset) : null,
      facets,
    };
  }

  async listarTipos(): Promise<string[]> {
    const rows = await this.db.query<{ valor: string }>(
      `SELECT DISTINCT tipo AS valor FROM public.magias ORDER BY tipo`,
    );
    return rows.map((row) => row.valor);
  }

  async listarClasses(): Promise<string[]> {
    const rows = await this.db.query<{ valor: string }>(
      `SELECT DISTINCT classe AS valor
       FROM public.magias
       CROSS JOIN LATERAL unnest(classes) AS classe
       ORDER BY classe`,
    );
    return rows.map((row) => row.valor);
  }

  async listarFacetas(): Promise<CatalogFacets> {
    const [escolasRows, classesRows, circulosRows] = await Promise.all([
      this.db.query<FacetQueryRow>(
        `SELECT tipo AS valor, count(*)::int AS total
         FROM public.magias
         GROUP BY tipo
         ORDER BY tipo`,
      ),
      this.db.query<FacetQueryRow>(
        `SELECT classe AS valor, count(*)::int AS total
         FROM public.magias
         CROSS JOIN LATERAL unnest(classes) AS classe
         GROUP BY classe
         ORDER BY classe`,
      ),
      this.db.query<FacetQueryRow>(
        `SELECT circulo AS valor, count(*)::int AS total
         FROM public.magias
         GROUP BY circulo
         ORDER BY circulo`,
      ),
    ]);

    return catalogFacetsSchema.parse({
      escolas: escolasRows.map((row) => ({
        valor: String(row.valor),
        total: Number(row.total),
      })),
      classes: classesRows.map((row) => ({
        valor: String(row.valor),
        total: Number(row.total),
      })),
      circulos: circulosRows.map((row) => ({
        valor: Number(row.valor),
        total: Number(row.total),
      })),
    });
  }
}

let singleton: CatalogRepository | null = null;

export function getCatalogRepository(): CatalogRepository {
  if (!singleton) {
    singleton = new CatalogRepository(getDb());
  }
  return singleton;
}

export const catalogRepository = {
  getMagiaById: (id: string) => getCatalogRepository().getMagiaById(id),
  getMagiaBySlug: (slug: string) => getCatalogRepository().getMagiaBySlug(slug),
  listarMagiasPorIds: (ids: string[]) => getCatalogRepository().listarMagiasPorIds(ids),
  buscarMagias: (filters: CatalogFilters) => getCatalogRepository().buscarMagias(filters),
  listarTipos: () => getCatalogRepository().listarTipos(),
  listarClasses: () => getCatalogRepository().listarClasses(),
  listarFacetas: () => getCatalogRepository().listarFacetas(),
};
