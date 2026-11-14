import "server-only";

import { getDb } from "@/lib/db/client";
import type { DbClient } from "@/lib/db/types";
import { mapEquipmentRow } from "@/lib/equipment/mappers";
import {
  ARMOR_FILTER_DB_VALUES,
  EQUIPMENT_TYPE_ORDER,
  equipmentFacetsSchema,
  equipmentFilterSchema,
  normalizeEquipmentFilters,
  type ArsenalSnapshot,
  type Equipment,
  type EquipmentFacetValue,
  type EquipmentFilters,
  type EquipmentPage,
  type EquipmentType,
} from "@/lib/validation/equipment";

const SELECT_COLUMNS = `
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
  fonte_pagina
`;

const SEARCH_ACCENTS = "áàâãäéèêëíìîïóòôõöúùûüçñýÿ";
const SEARCH_WITHOUT_ACCENTS = "aaaaaeeeeiiiiooooouuuucnyy";

function normalizedSearch(expression: string): string {
  return `translate(lower(${expression}), '${SEARCH_ACCENTS}', '${SEARCH_WITHOUT_ACCENTS}')`;
}

function searchClause(parameter: string): string {
  const needle = normalizedSearch(`${parameter}::text`);
  return `(
    position(${needle} in ${normalizedSearch("nome")}) > 0
    OR position(${needle} in ${normalizedSearch("coalesce(descricao, '')")}) > 0
    OR position(${needle} in ${normalizedSearch("coalesce(categoria, '')")}) > 0
    OR position(${needle} in ${normalizedSearch("coalesce(atributo, '')")}) > 0
    OR position(${needle} in ${normalizedSearch("coalesce(maestria, '')")}) > 0
    OR position(${needle} in ${normalizedSearch("coalesce(tipo_dano, '')")}) > 0
    OR position(${needle} in ${normalizedSearch("array_to_string(propriedades, ' ')")}) > 0
  )`;
}

type WhereOptions = {
  typeOverride?: EquipmentType | null;
  excludeSubtypes?: boolean;
  savedByUserId?: string;
};

function buildWhere(
  filters: EquipmentFilters,
  options: WhereOptions = {},
): { clause: string; params: unknown[] } {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filters.q) {
    params.push(filters.q);
    conditions.push(searchClause(`$${params.length}`));
  }

  const type =
    options.typeOverride !== undefined ? options.typeOverride : filters.tipo;
  if (type) {
    params.push(type);
    conditions.push(`tipo = $${params.length}`);
  }

  if (!options.excludeSubtypes) {
    if (filters.armas.length > 0) {
      params.push(filters.armas);
      conditions.push(`arma_tipo = ANY($${params.length}::text[])`);
    }
    if (filters.alcances.length > 0) {
      params.push(filters.alcances);
      conditions.push(`arma_alcance = ANY($${params.length}::text[])`);
    }
    if (filters.armaduras.length > 0) {
      params.push(filters.armaduras.map((value) => ARMOR_FILTER_DB_VALUES[value]));
      conditions.push(`categoria = ANY($${params.length}::text[])`);
    }
  }

  if (options.savedByUserId) {
    params.push(options.savedByUserId);
    conditions.push(
      `EXISTS (
        SELECT 1 FROM public.arsenal_itens AS arsenal
        WHERE arsenal.equipamento_id = equipamentos.id
          AND arsenal.user_id = $${params.length}::uuid
      )`,
    );
  }

  return {
    clause: conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "",
    params,
  };
}

const TYPE_RANK = (alias: string) => `CASE ${alias}.tipo
  WHEN 'arma' THEN 0
  WHEN 'armadura' THEN 1
  WHEN 'ferramenta' THEN 2
  WHEN 'aventura' THEN 3
  ELSE 4
END`;

function orderBy(sort: EquipmentFilters["sort"]): string {
  switch (sort) {
    case "nome-desc":
      return "nome DESC, id ASC";
    case "nome-asc":
      return "nome ASC, id ASC";
    default:
      return `${TYPE_RANK("equipamentos")}, nome ASC, id ASC`;
  }
}

function filledFacets(
  rows: { valor: string; total: number | string }[],
  possible: readonly string[],
  labels?: Record<string, string>,
): EquipmentFacetValue[] {
  const totals = new Map(
    rows.map((row) => [String(row.valor), Number(row.total)]),
  );
  return possible.map((value) => ({
    valor: labels?.[value] ?? value,
    total: totals.get(value) ?? 0,
  }));
}

type FacetRow = { valor: string; total: number | string };

export class EquipmentRepository {
  constructor(private readonly db: DbClient) {}

  async getEquipmentBySlug(slug: string): Promise<Equipment | null> {
    const rows = await this.db.query(
      `SELECT ${SELECT_COLUMNS} FROM public.equipamentos WHERE slug = $1`,
      [slug],
    );
    return rows[0] ? mapEquipmentRow(rows[0]) : null;
  }

  async searchEquipment(input: EquipmentFilters): Promise<EquipmentPage> {
    const filters = normalizeEquipmentFilters(equipmentFilterSchema.parse(input));
    const offset = Math.max(0, (filters.page - 1) * filters.limit);
    const { clause, params } = buildWhere(filters);

    const [
      countRows,
      dataRows,
      typeRows,
      sectionRows,
      weaponKindRows,
      weaponRangeRows,
      armorRows,
    ] = await Promise.all([
      this.db.query<{ total: number | string }>(
        `SELECT count(*)::int AS total FROM public.equipamentos ${clause}`,
        params,
      ),
      this.db.query(
        `SELECT ${SELECT_COLUMNS}
         FROM public.equipamentos
         ${clause}
         ORDER BY ${orderBy(filters.sort)}
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, filters.limit, offset],
      ),
      this.queryTypeFacets(filters.q),
      this.db.query<FacetRow>(
        `SELECT tipo AS valor, count(*)::int AS total
         FROM public.equipamentos
         ${clause}
         GROUP BY tipo`,
        params,
      ),
      this.queryWeaponKindFacets(filters.q),
      this.queryWeaponRangeFacets(filters.q),
      this.queryArmorFacets(filters.q),
    ]);

    const total = Number(countRows[0]?.total ?? 0);
    const pageCount = Math.max(1, Math.ceil(total / filters.limit));
    const facets = equipmentFacetsSchema.parse({
      tipos: filledFacets(typeRows, EQUIPMENT_TYPE_ORDER),
      armas: {
        tipos: filledFacets(weaponKindRows, ["simples", "marcial"]),
        alcances: filledFacets(weaponRangeRows, ["corpo-a-corpo", "distancia"]),
      },
      armaduras: filledFacets(armorRows, ["Leve", "Média", "Pesada", "Escudo"]),
    });

    return {
      items: dataRows.map(mapEquipmentRow),
      total,
      page: filters.page,
      pageSize: filters.limit,
      pageCount,
      facets,
      typeTotals: filledFacets(sectionRows, EQUIPMENT_TYPE_ORDER),
    };
  }

  private async queryTypeFacets(q: string): Promise<FacetRow[]> {
    const { clause, params } = buildWhere(
      equipmentFilterSchema.parse({ q }),
      { typeOverride: null, excludeSubtypes: true },
    );
    return this.db.query<FacetRow>(
      `SELECT tipo AS valor, count(*)::int AS total
       FROM public.equipamentos
       ${clause}
       GROUP BY tipo`,
      params,
    );
  }

  private async queryWeaponKindFacets(q: string): Promise<FacetRow[]> {
    return this.queryWeaponFacets(q, "arma_tipo");
  }

  private async queryWeaponRangeFacets(q: string): Promise<FacetRow[]> {
    return this.queryWeaponFacets(q, "arma_alcance");
  }

  private async queryWeaponFacets(
    q: string,
    column: "arma_tipo" | "arma_alcance",
  ): Promise<FacetRow[]> {
    const { clause, params } = buildWhere(
      equipmentFilterSchema.parse({ q }),
      { typeOverride: "arma", excludeSubtypes: true },
    );
    return this.db.query<FacetRow>(
      `SELECT ${column} AS valor, count(*)::int AS total
       FROM public.equipamentos
       ${clause}
       GROUP BY ${column}`,
      params,
    );
  }

  private async queryArmorFacets(q: string): Promise<FacetRow[]> {
    const { clause, params } = buildWhere(
      equipmentFilterSchema.parse({ q }),
      { typeOverride: "armadura", excludeSubtypes: true },
    );
    return this.db.query<FacetRow>(
      `SELECT categoria AS valor, count(*)::int AS total
       FROM public.equipamentos
       ${clause}
       GROUP BY categoria`,
      params,
    );
  }

  async listSavedEquipment(userId: string): Promise<Equipment[]> {
    const rows = await this.db.query(
      `SELECT ${SELECT_COLUMNS
        .split(",")
        .map((column) => `e.${column.trim()}`)
        .join(", ")}
       FROM public.arsenal_itens AS arsenal
       JOIN public.equipamentos AS e ON e.id = arsenal.equipamento_id
       WHERE arsenal.user_id = $1
       ORDER BY ${TYPE_RANK("e")}, e.nome ASC, e.id ASC`,
      [userId],
    );
    return rows.map(mapEquipmentRow);
  }

  async getArsenalSnapshot(userId: string): Promise<ArsenalSnapshot> {
    const items = await this.listSavedEquipment(userId);
    return { items, total: items.length };
  }

  async saveItem(userId: string, slug: string): Promise<ArsenalSnapshot> {
    const id = await this.requireEquipmentId(slug);
    await this.db.query(
      `INSERT INTO public.arsenal_itens (user_id, equipamento_id)
       VALUES ($1, $2)
       ON CONFLICT (user_id, equipamento_id) DO NOTHING`,
      [userId, id],
    );
    return this.getArsenalSnapshot(userId);
  }

  async removeItem(userId: string, slug: string): Promise<ArsenalSnapshot> {
    const id = await this.requireEquipmentId(slug);
    await this.db.query(
      `DELETE FROM public.arsenal_itens
       WHERE user_id = $1 AND equipamento_id = $2`,
      [userId, id],
    );
    return this.getArsenalSnapshot(userId);
  }

  async isSaved(userId: string, slug: string): Promise<boolean> {
    const rows = await this.db.query(
      `SELECT 1
       FROM public.arsenal_itens AS arsenal
       JOIN public.equipamentos AS e ON e.id = arsenal.equipamento_id
       WHERE arsenal.user_id = $1 AND e.slug = $2`,
      [userId, slug],
    );
    return rows.length > 0;
  }

  private async requireEquipmentId(slug: string): Promise<string> {
    const rows = await this.db.query<{ id: string }>(
      "SELECT id::text AS id FROM public.equipamentos WHERE slug = $1",
      [slug],
    );
    const id = rows[0]?.id;
    if (!id) {
      throw new EquipmentRepositoryError(
        "Equipamento não encontrado no catálogo.",
        "not-found",
      );
    }
    return id;
  }
}

export type EquipmentErrorCode = "not-found" | "invalid";

export class EquipmentRepositoryError extends Error {
  constructor(
    message: string,
    readonly code: EquipmentErrorCode,
  ) {
    super(message);
    this.name = "EquipmentRepositoryError";
  }
}

let singleton: EquipmentRepository | null = null;

export function getEquipmentRepository(): EquipmentRepository {
  if (!singleton) {
    singleton = new EquipmentRepository(getDb());
  }
  return singleton;
}

export const equipmentRepository = {
  getEquipmentBySlug: (slug: string) =>
    getEquipmentRepository().getEquipmentBySlug(slug),
  searchEquipment: (filters: EquipmentFilters) =>
    getEquipmentRepository().searchEquipment(filters),
  getArsenalSnapshot: (userId: string) =>
    getEquipmentRepository().getArsenalSnapshot(userId),
  saveItem: (userId: string, slug: string) =>
    getEquipmentRepository().saveItem(userId, slug),
  removeItem: (userId: string, slug: string) =>
    getEquipmentRepository().removeItem(userId, slug),
  isSaved: (userId: string, slug: string) =>
    getEquipmentRepository().isSaved(userId, slug),
};
