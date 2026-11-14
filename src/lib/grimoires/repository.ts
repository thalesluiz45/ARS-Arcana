import "server-only";

import { getDb } from "@/lib/db/client";
import type { DatabaseRow, DbClient } from "@/lib/db/types";
import {
  grimoireNameSchema,
  RESERVED_GRIMOIRE_NAME,
  type Grimoire,
  type GrimoireSnapshot,
  type GrimoireWithCount,
  type SavedSpell,
  type SpellSelection,
} from "@/lib/validation/grimoire";
import { spellIdSchema } from "@/lib/validation/spell";

export type GrimoireErrorCode = "not-found" | "conflict" | "invalid";

export class GrimoireRepositoryError extends Error {
  constructor(
    message: string,
    readonly code: GrimoireErrorCode,
  ) {
    super(message);
    this.name = "GrimoireRepositoryError";
  }
}

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

function mapGrimoire(row: DatabaseRow): Grimoire {
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
  const parsed = grimoireNameSchema.safeParse(value);
  if (!parsed.success) {
    throw new GrimoireRepositoryError(
      parsed.error.issues[0]?.message ?? "Nome de grimório inválido.",
      "invalid",
    );
  }
  if (normalizeName(parsed.data) === normalizeName(RESERVED_GRIMOIRE_NAME)) {
    throw new GrimoireRepositoryError("O nome “Sem grimório” é reservado.", "invalid");
  }
  return parsed.data;
}

function validateSpellId(value: string): string {
  const parsed = spellIdSchema.safeParse(value);
  if (!parsed.success) {
    throw new GrimoireRepositoryError("Identificador de magia inválido.", "invalid");
  }
  return parsed.data;
}

function mapAssociations(rows: DatabaseRow[]): SavedSpell[] {
  return rows.map((row) => ({
    listaId: String(row.lista_id),
    magiaId: String(row.magia_id),
    salvaEm: toIsoString(row.salva_em),
  }));
}

export class GrimoireRepository {
  constructor(private readonly db: DbClient) {}

  async ensureReservedGrimoire(userId: string): Promise<Grimoire> {
    await this.db.query(
      `
      INSERT INTO public.grimorios (user_id, nome, reservada)
      VALUES ($1, $2, true)
      ON CONFLICT DO NOTHING
      `,
      [userId, RESERVED_GRIMOIRE_NAME],
    );

    const rows = await this.db.query(
      `
      SELECT id, nome, criada_em, atualizada_em, reservada
      FROM public.grimorios
      WHERE user_id = $1 AND reservada
      LIMIT 1
      `,
      [userId],
    );

    if (!rows[0]) {
      throw new GrimoireRepositoryError(
        "Não foi possível preparar a coleção “Sem grimório”.",
        "not-found",
      );
    }
    return mapGrimoire(rows[0]);
  }

  async getSnapshot(userId: string): Promise<GrimoireSnapshot> {
    await this.ensureReservedGrimoire(userId);

    const [listRows, associationRows] = await Promise.all([
      this.db.query(
        `
        SELECT id, nome, criada_em, atualizada_em, reservada
        FROM public.grimorios
        WHERE user_id = $1
        ORDER BY reservada ASC, lower(nome) ASC
        `,
        [userId],
      ),
      this.db.query(
        `
        SELECT ms.grimorio_id AS lista_id, ms.magia_id, ms.salva_em
        FROM public.magias_salvas ms
        JOIN public.grimorios g ON g.id = ms.grimorio_id
        WHERE g.user_id = $1
        ORDER BY ms.salva_em DESC
        `,
        [userId],
      ),
    ]);

    const lists = listRows.map(mapGrimoire);
    const associations = mapAssociations(associationRows);
    const counts = new Map<string, Set<string>>();
    for (const association of associations) {
      const set = counts.get(association.listaId) ?? new Set<string>();
      set.add(association.magiaId);
      counts.set(association.listaId, set);
    }

    const withCount = (list: Grimoire): GrimoireWithCount => ({
      ...list,
      total: counts.get(list.id)?.size ?? 0,
    });

    const reserved = lists.find((list) => list.reservada);
    if (!reserved) {
      throw new GrimoireRepositoryError(
        "Não foi possível carregar a coleção “Sem grimório”.",
        "not-found",
      );
    }

    return {
      lists,
      namedGrimoires: lists.filter((list) => !list.reservada).map(withCount),
      reserved: withCount(reserved),
      totalUnique: new Set(associations.map((association) => association.magiaId)).size,
      associations,
    };
  }

  async createGrimoire(userId: string, name: string): Promise<Grimoire> {
    const validName = validateName(name);

    try {
      const rows = await this.db.query(
        `
        INSERT INTO public.grimorios (user_id, nome, reservada)
        VALUES ($1, $2, false)
        RETURNING id, nome, criada_em, atualizada_em, reservada
        `,
        [userId, validName],
      );
      if (!rows[0]) {
        throw new GrimoireRepositoryError("Não foi possível criar o grimório.", "invalid");
      }
      return mapGrimoire(rows[0]);
    } catch (error) {
      if (isDatabaseErrorCode(error, "23505")) {
        throw new GrimoireRepositoryError("Já existe um grimório com esse nome.", "conflict");
      }
      throw error;
    }
  }

  async renameGrimoire(userId: string, grimoireId: string, name: string): Promise<Grimoire> {
    const validName = validateName(name);

    const targetRows = await this.db.query(
      `
      SELECT id, nome, criada_em, atualizada_em, reservada
      FROM public.grimorios
      WHERE id = $1 AND user_id = $2
      `,
      [grimoireId, userId],
    );
    const target = targetRows[0] ? mapGrimoire(targetRows[0]) : null;

    if (!target) {
      throw new GrimoireRepositoryError("Grimório não encontrado.", "not-found");
    }
    if (target.reservada) {
      throw new GrimoireRepositoryError(
        "A coleção “Sem grimório” não pode ser renomeada.",
        "invalid",
      );
    }

    try {
      const rows = await this.db.query(
        `
        UPDATE public.grimorios
        SET nome = $3
        WHERE id = $1 AND user_id = $2 AND NOT reservada
        RETURNING id, nome, criada_em, atualizada_em, reservada
        `,
        [grimoireId, userId, validName],
      );
      if (!rows[0]) {
        throw new GrimoireRepositoryError("Grimório não encontrado.", "not-found");
      }
      return mapGrimoire(rows[0]);
    } catch (error) {
      if (isDatabaseErrorCode(error, "23505")) {
        throw new GrimoireRepositoryError("Já existe um grimório com esse nome.", "conflict");
      }
      throw error;
    }
  }

  async deleteGrimoire(userId: string, grimoireId: string): Promise<void> {
    const reserved = await this.ensureReservedGrimoire(userId);

    const rows = await this.db.query<{
      found: number | string;
      deleted: number | string;
      reservada: boolean | null;
    }>(
      `
      WITH target AS (
        SELECT id, reservada
        FROM public.grimorios
        WHERE id = $1 AND user_id = $2
      ), movable AS (
        SELECT ms.magia_id, ms.salva_em
        FROM public.magias_salvas ms
        JOIN target t ON t.id = ms.grimorio_id
        WHERE NOT t.reservada
      ), moved AS (
        INSERT INTO public.magias_salvas (grimorio_id, magia_id, salva_em)
        SELECT $3, m.magia_id, m.salva_em
        FROM movable m
        WHERE NOT EXISTS (
          SELECT 1
          FROM public.magias_salvas other
          JOIN public.grimorios og ON og.id = other.grimorio_id
          WHERE other.magia_id = m.magia_id
            AND og.user_id = $2
            AND NOT og.reservada
            AND og.id <> $1
        )
        AND NOT EXISTS (
          SELECT 1
          FROM public.magias_salvas res
          WHERE res.grimorio_id = $3 AND res.magia_id = m.magia_id
        )
        ON CONFLICT DO NOTHING
        RETURNING 1
      ), deleted AS (
        DELETE FROM public.grimorios
        WHERE id IN (SELECT id FROM target WHERE NOT reservada)
        RETURNING id
      )
      SELECT
        (SELECT count(*) FROM target)::int AS found,
        (SELECT count(*) FROM deleted)::int AS deleted,
        (SELECT reservada FROM target LIMIT 1) AS reservada
      `,
      [grimoireId, userId, reserved.id],
    );

    const result = rows[0];
    if (!result || Number(result.found) === 0) {
      throw new GrimoireRepositoryError("Grimório não encontrado.", "not-found");
    }
    if (result.reservada) {
      throw new GrimoireRepositoryError(
        "A coleção “Sem grimório” não pode ser excluída.",
        "invalid",
      );
    }
    if (Number(result.deleted) === 0) {
      throw new GrimoireRepositoryError("Grimório não encontrado.", "not-found");
    }
  }

  async updateSpellSelection(
    userId: string,
    spellId: string,
    selection: SpellSelection,
  ): Promise<void> {
    const validSpellId = validateSpellId(spellId);
    const namedIds = [...new Set(selection.grimoireIds)];

    if (selection.withoutGrimoire && namedIds.length > 0) {
      throw new GrimoireRepositoryError(
        "“Sem grimório” é exclusivo: remova a seleção dos grimórios nomeados para usá-lo.",
        "invalid",
      );
    }

    const spellRows = await this.db.query("SELECT 1 FROM public.magias WHERE id = $1", [
      validSpellId,
    ]);
    if (!spellRows[0]) {
      throw new GrimoireRepositoryError("Magia não encontrada no catálogo.", "not-found");
    }

    const reserved = await this.ensureReservedGrimoire(userId);

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
        SELECT g.id
        FROM public.grimorios g
        JOIN requested r ON r.id = g.id
        WHERE g.user_id = $1 AND NOT g.reservada
      ), valid AS (
        SELECT (SELECT count(*) FROM named) = cardinality($3::uuid[]) AS ok
      ), deleted AS (
        DELETE FROM public.magias_salvas ms
        USING public.grimorios g
        WHERE ms.grimorio_id = g.id
          AND g.user_id = $1
          AND ms.magia_id = $2
          AND (SELECT ok FROM valid)
        RETURNING 1
      ), inserted AS (
        INSERT INTO public.magias_salvas (grimorio_id, magia_id, salva_em)
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
      [userId, validSpellId, namedIds, reserved.id, selection.withoutGrimoire],
    );

    const result = rows[0];
    if (!result || Number(result.named_count) !== namedIds.length) {
      throw new GrimoireRepositoryError(
        "Um dos grimórios selecionados não existe mais.",
        "not-found",
      );
    }
  }
}

let repository: GrimoireRepository | null = null;

export function getGrimoireRepository(): GrimoireRepository {
  repository ??= new GrimoireRepository(getDb());
  return repository;
}
