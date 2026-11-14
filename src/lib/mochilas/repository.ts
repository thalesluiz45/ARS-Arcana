import "server-only";

import { getDb } from "@/lib/db/client";
import type { DatabaseRow, DbClient } from "@/lib/db/types";
import { mapEquipmentRow } from "@/lib/equipment/mappers";
import {
  equipmentSlugSchema,
  type Equipment,
} from "@/lib/validation/equipment";
import {
  mochilaNameSchema,
  RESERVED_MOCHILA_NAME,
  type EquipmentSelection,
  type Mochila,
  type MochilaSnapshot,
  type MochilaWithCount,
  type SavedEquipment,
} from "@/lib/validation/mochila";

export type MochilaErrorCode = "not-found" | "conflict" | "invalid";

export class MochilaRepositoryError extends Error {
  constructor(
    message: string,
    readonly code: MochilaErrorCode,
  ) {
    super(message);
    this.name = "MochilaRepositoryError";
  }
}

const EQUIPMENT_COLUMNS = `slug, nome, tipo, categoria, dano, tipo_dano, propriedades,
  maestria, classe_armadura, forca, furtividade, atributo, descricao, peso, custo,
  fonte_pagina`;

const TYPE_RANK = (alias: string) => `CASE ${alias}.tipo
  WHEN 'arma' THEN 0
  WHEN 'armadura' THEN 1
  WHEN 'ferramenta' THEN 2
  WHEN 'aventura' THEN 3
  ELSE 4
END`;

function isDatabaseErrorCode(error: unknown, code: string): boolean {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: unknown }).code === code,
  );
}

function toIsoString(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string" && value) {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date.toISOString();
  }
  return new Date(0).toISOString();
}

function mapMochila(row: DatabaseRow): Mochila {
  return {
    id: String(row.id),
    nome: String(row.nome),
    criadaEm: toIsoString(row.criada_em),
    atualizadaEm: toIsoString(row.atualizada_em),
    reservada: Boolean(row.reservada),
  };
}

function normalizeName(value: string): string {
  return value.trim().toLocaleLowerCase("pt-BR");
}

function validateName(value: string): string {
  const parsed = mochilaNameSchema.safeParse(value);
  if (!parsed.success) {
    throw new MochilaRepositoryError(
      parsed.error.issues[0]?.message ?? "Nome de mochila inválido.",
      "invalid",
    );
  }
  if (normalizeName(parsed.data) === normalizeName(RESERVED_MOCHILA_NAME)) {
    throw new MochilaRepositoryError("O nome “Sem mochila” é reservado.", "invalid");
  }
  return parsed.data;
}

function validateEquipmentSlug(value: string): string {
  const parsed = equipmentSlugSchema.safeParse(value);
  if (!parsed.success) {
    throw new MochilaRepositoryError("Identificador de equipamento inválido.", "invalid");
  }
  return parsed.data;
}

function mapAssociations(rows: DatabaseRow[]): SavedEquipment[] {
  return rows.map((row) => ({
    listaId: String(row.lista_id),
    equipamentoSlug: String(row.equipamento_slug),
    salvoEm: toIsoString(row.salvo_em),
  }));
}

export class MochilaRepository {
  constructor(private readonly db: DbClient) {}

  async ensureReservedMochila(userId: string): Promise<Mochila> {
    await this.db.query(
      `
      INSERT INTO public.mochilas (user_id, nome, reservada)
      VALUES ($1, $2, true)
      ON CONFLICT DO NOTHING
      `,
      [userId, RESERVED_MOCHILA_NAME],
    );

    const rows = await this.db.query(
      `
      SELECT id, nome, criada_em, atualizada_em, reservada
      FROM public.mochilas
      WHERE user_id = $1 AND reservada
      LIMIT 1
      `,
      [userId],
    );

    if (!rows[0]) {
      throw new MochilaRepositoryError(
        "Não foi possível preparar a coleção “Sem mochila”.",
        "not-found",
      );
    }
    return mapMochila(rows[0]);
  }

  async getSnapshot(userId: string): Promise<MochilaSnapshot> {
    await this.ensureReservedMochila(userId);

    const [listRows, associationRows, itemRows] = await Promise.all([
      this.db.query(
        `
        SELECT id, nome, criada_em, atualizada_em, reservada
        FROM public.mochilas
        WHERE user_id = $1
        ORDER BY reservada ASC, lower(nome) ASC
        `,
        [userId],
      ),
      this.db.query(
        `
        SELECT mi.mochila_id AS lista_id, e.slug AS equipamento_slug, mi.salvo_em
        FROM public.mochila_itens mi
        JOIN public.mochilas m ON m.id = mi.mochila_id
        JOIN public.equipamentos e ON e.id = mi.equipamento_id
        WHERE m.user_id = $1
        ORDER BY mi.salvo_em DESC
        `,
        [userId],
      ),
      this.db.query(
        `
        SELECT ${EQUIPMENT_COLUMNS}
        FROM public.equipamentos AS e
        WHERE EXISTS (
          SELECT 1
          FROM public.mochila_itens mi
          JOIN public.mochilas m ON m.id = mi.mochila_id
          WHERE mi.equipamento_id = e.id AND m.user_id = $1
        )
        ORDER BY ${TYPE_RANK("e")}, e.nome ASC, e.id ASC
        `,
        [userId],
      ),
    ]);

    const lists = listRows.map(mapMochila);
    const associations = mapAssociations(associationRows);
    const counts = new Map<string, Set<string>>();
    for (const association of associations) {
      const set = counts.get(association.listaId) ?? new Set<string>();
      set.add(association.equipamentoSlug);
      counts.set(association.listaId, set);
    }

    const withCount = (list: Mochila): MochilaWithCount => ({
      ...list,
      total: counts.get(list.id)?.size ?? 0,
    });

    const reserved = lists.find((list) => list.reservada);
    if (!reserved) {
      throw new MochilaRepositoryError(
        "Não foi possível carregar a coleção “Sem mochila”.",
        "not-found",
      );
    }

    return {
      lists,
      namedMochilas: lists.filter((list) => !list.reservada).map(withCount),
      reserved: withCount(reserved),
      totalUnique: new Set(associations.map((association) => association.equipamentoSlug))
        .size,
      associations,
      items: itemRows.map(mapEquipmentRow),
    };
  }

  async createMochila(userId: string, name: string): Promise<Mochila> {
    const validName = validateName(name);

    try {
      const rows = await this.db.query(
        `
        INSERT INTO public.mochilas (user_id, nome, reservada)
        VALUES ($1, $2, false)
        RETURNING id, nome, criada_em, atualizada_em, reservada
        `,
        [userId, validName],
      );
      if (!rows[0]) {
        throw new MochilaRepositoryError("Não foi possível criar a mochila.", "invalid");
      }
      return mapMochila(rows[0]);
    } catch (error) {
      if (isDatabaseErrorCode(error, "23505")) {
        throw new MochilaRepositoryError("Já existe uma mochila com esse nome.", "conflict");
      }
      throw error;
    }
  }

  async renameMochila(userId: string, mochilaId: string, name: string): Promise<Mochila> {
    const validName = validateName(name);

    const targetRows = await this.db.query(
      `
      SELECT id, nome, criada_em, atualizada_em, reservada
      FROM public.mochilas
      WHERE id = $1 AND user_id = $2
      `,
      [mochilaId, userId],
    );
    const target = targetRows[0] ? mapMochila(targetRows[0]) : null;

    if (!target) {
      throw new MochilaRepositoryError("Mochila não encontrada.", "not-found");
    }
    if (target.reservada) {
      throw new MochilaRepositoryError(
        "A coleção “Sem mochila” não pode ser renomeada.",
        "invalid",
      );
    }

    try {
      const rows = await this.db.query(
        `
        UPDATE public.mochilas
        SET nome = $3
        WHERE id = $1 AND user_id = $2 AND NOT reservada
        RETURNING id, nome, criada_em, atualizada_em, reservada
        `,
        [mochilaId, userId, validName],
      );
      if (!rows[0]) {
        throw new MochilaRepositoryError("Mochila não encontrada.", "not-found");
      }
      return mapMochila(rows[0]);
    } catch (error) {
      if (isDatabaseErrorCode(error, "23505")) {
        throw new MochilaRepositoryError("Já existe uma mochila com esse nome.", "conflict");
      }
      throw error;
    }
  }

  async deleteMochila(userId: string, mochilaId: string): Promise<void> {
    const reserved = await this.ensureReservedMochila(userId);

    const rows = await this.db.query<{
      found: number | string;
      deleted: number | string;
      reservada: boolean | null;
    }>(
      `
      WITH target AS (
        SELECT id, reservada
        FROM public.mochilas
        WHERE id = $1 AND user_id = $2
      ), movable AS (
        SELECT mi.equipamento_id, mi.salvo_em
        FROM public.mochila_itens mi
        JOIN target t ON t.id = mi.mochila_id
        WHERE NOT t.reservada
      ), moved AS (
        INSERT INTO public.mochila_itens (mochila_id, equipamento_id, salvo_em)
        SELECT $3, m.equipamento_id, m.salvo_em
        FROM movable m
        WHERE NOT EXISTS (
          SELECT 1
          FROM public.mochila_itens other
          JOIN public.mochilas om ON om.id = other.mochila_id
          WHERE other.equipamento_id = m.equipamento_id
            AND om.user_id = $2
            AND NOT om.reservada
            AND om.id <> $1
        )
        AND NOT EXISTS (
          SELECT 1
          FROM public.mochila_itens res
          WHERE res.mochila_id = $3 AND res.equipamento_id = m.equipamento_id
        )
        ON CONFLICT DO NOTHING
        RETURNING 1
      ), deleted AS (
        DELETE FROM public.mochilas
        WHERE id IN (SELECT id FROM target WHERE NOT reservada)
        RETURNING id
      )
      SELECT
        (SELECT count(*) FROM target)::int AS found,
        (SELECT count(*) FROM deleted)::int AS deleted,
        (SELECT reservada FROM target LIMIT 1) AS reservada
      `,
      [mochilaId, userId, reserved.id],
    );

    const result = rows[0];
    if (!result || Number(result.found) === 0) {
      throw new MochilaRepositoryError("Mochila não encontrada.", "not-found");
    }
    if (result.reservada) {
      throw new MochilaRepositoryError(
        "A coleção “Sem mochila” não pode ser excluída.",
        "invalid",
      );
    }
    if (Number(result.deleted) === 0) {
      throw new MochilaRepositoryError("Mochila não encontrada.", "not-found");
    }
  }

  async updateEquipmentSelection(
    userId: string,
    slug: string,
    selection: EquipmentSelection,
  ): Promise<void> {
    const validSlug = validateEquipmentSlug(slug);
    const namedIds = [...new Set(selection.mochilaIds)];

    if (selection.withoutMochila && namedIds.length > 0) {
      throw new MochilaRepositoryError(
        "“Sem mochila” é exclusivo: remova a seleção das mochilas nomeadas para usá-lo.",
        "invalid",
      );
    }

    const equipmentRows = await this.db.query(
      "SELECT id::text AS id FROM public.equipamentos WHERE slug = $1",
      [validSlug],
    );
    const equipmentId = equipmentRows[0]?.id;
    if (!equipmentId) {
      throw new MochilaRepositoryError(
        "Equipamento não encontrado no catálogo.",
        "not-found",
      );
    }

    const reserved = await this.ensureReservedMochila(userId);

    const rows = await this.db.query<{
      named_count: number | string;
      reserved_id: string | null;
      removed: number | string;
      inserted: number | string;
    }>(
      `
      WITH requested AS (
        SELECT unnest($3::uuid[]) AS id
      ), named AS (
        SELECT m.id
        FROM public.mochilas m
        JOIN requested r ON r.id = m.id
        WHERE m.user_id = $1 AND NOT m.reservada
      ), valid AS (
        SELECT (SELECT count(*) FROM named) = cardinality($3::uuid[]) AS ok
      ), deleted AS (
        DELETE FROM public.mochila_itens mi
        USING public.mochilas m
        WHERE mi.mochila_id = m.id
          AND m.user_id = $1
          AND mi.equipamento_id = $2
          AND (SELECT ok FROM valid)
        RETURNING 1
      ), inserted AS (
        INSERT INTO public.mochila_itens (mochila_id, equipamento_id, salvo_em)
        SELECT source.id, $2, now()
        FROM (
          SELECT id FROM named
          UNION ALL
          SELECT $4::uuid WHERE $5::boolean
        ) source
        WHERE (SELECT ok FROM valid)
        ON CONFLICT DO NOTHING
        RETURNING 1
      )
      SELECT
        (SELECT count(*) FROM named)::int AS named_count,
        $4::uuid AS reserved_id,
        (SELECT count(*) FROM deleted)::int AS removed,
        (SELECT count(*) FROM inserted)::int AS inserted
      `,
      [userId, equipmentId, namedIds, reserved.id, selection.withoutMochila],
    );

    const result = rows[0];
    if (!result || Number(result.named_count) !== namedIds.length) {
      throw new MochilaRepositoryError(
        "Uma das mochilas selecionadas não existe mais.",
        "not-found",
      );
    }
  }

  async saveItem(userId: string, slug: string): Promise<MochilaSnapshot> {
    const equipmentId = await this.requireEquipmentId(slug);
    const reserved = await this.ensureReservedMochila(userId);

    await this.db.query(
      `INSERT INTO public.mochila_itens (mochila_id, equipamento_id)
       VALUES ($1, $2)
       ON CONFLICT (mochila_id, equipamento_id) DO NOTHING`,
      [reserved.id, equipmentId],
    );
    return this.getSnapshot(userId);
  }

  async removeItem(userId: string, slug: string): Promise<MochilaSnapshot> {
    const equipmentId = await this.requireEquipmentId(slug);

    await this.db.query(
      `DELETE FROM public.mochila_itens mi
       USING public.mochilas m
       WHERE mi.mochila_id = m.id
         AND m.user_id = $1
         AND mi.equipamento_id = $2`,
      [userId, equipmentId],
    );
    return this.getSnapshot(userId);
  }

  async isSaved(userId: string, slug: string): Promise<boolean> {
    const rows = await this.db.query(
      `SELECT 1
       FROM public.mochila_itens mi
       JOIN public.mochilas m ON m.id = mi.mochila_id
       JOIN public.equipamentos e ON e.id = mi.equipamento_id
       WHERE m.user_id = $1 AND e.slug = $2`,
      [userId, slug],
    );
    return rows.length > 0;
  }

  async listSavedEquipment(userId: string): Promise<Equipment[]> {
    const snapshot = await this.getSnapshot(userId);
    return snapshot.items;
  }

  private async requireEquipmentId(slug: string): Promise<string> {
    const validSlug = validateEquipmentSlug(slug);
    const rows = await this.db.query<{ id: string }>(
      "SELECT id::text AS id FROM public.equipamentos WHERE slug = $1",
      [validSlug],
    );
    const id = rows[0]?.id;
    if (!id) {
      throw new MochilaRepositoryError(
        "Equipamento não encontrado no catálogo.",
        "not-found",
      );
    }
    return id;
  }
}

let singleton: MochilaRepository | null = null;

export function getMochilaRepository(): MochilaRepository {
  singleton ??= new MochilaRepository(getDb());
  return singleton;
}
