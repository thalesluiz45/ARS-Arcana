import "server-only";

import type {
  Adapter,
  AdapterAccount,
  AdapterSession,
  AdapterUser,
  VerificationToken,
} from "next-auth/adapters";

import { getDb } from "@/lib/db/client";
import type { DatabaseRow, DbClient } from "@/lib/db/types";

const RESERVED_GRIMOIRE_NAME = "Sem grimório";
const RESERVED_MOCHILA_NAME = "Sem mochila";

function isUniqueViolation(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: unknown }).code === "23505",
  );
}

function toDate(value: unknown): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === "string" && value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return null;
}

function mapUser(row: DatabaseRow): AdapterUser {
  return {
    id: String(row.id),
    name: row.name == null ? null : String(row.name),
    email: String(row.email),
    emailVerified: toDate(row.email_verified),
    image: row.image == null ? null : String(row.image),
  };
}

function mapSession(row: DatabaseRow): AdapterSession {
  return {
    sessionToken: String(row.session_token),
    userId: String(row.user_id),
    expires: toDate(row.expires) ?? new Date(0),
  };
}

function mapAccount(row: DatabaseRow): AdapterAccount {
  return {
    userId: String(row.user_id),
    type: String(row.type) as AdapterAccount["type"],
    provider: String(row.provider),
    providerAccountId: String(row.provider_account_id),
    refresh_token: row.refresh_token == null ? undefined : String(row.refresh_token),
    access_token: row.access_token == null ? undefined : String(row.access_token),
    expires_at: row.expires_at == null ? undefined : Number(row.expires_at),
    token_type:
      row.token_type == null
        ? undefined
        : (String(row.token_type).toLowerCase() as AdapterAccount["token_type"]),
    scope: row.scope == null ? undefined : String(row.scope),
    id_token: row.id_token == null ? undefined : String(row.id_token),
    session_state:
      row.session_state == null ? undefined : String(row.session_state),
  };
}

export function createAuthAdapter(getDatabase: () => DbClient): Adapter {
  async function getUser(id: string): Promise<AdapterUser | null> {
    const rows = await getDatabase().query("SELECT * FROM public.usuarios WHERE id = $1", [id]);
    return rows[0] ? mapUser(rows[0]) : null;
  }

  async function getUserByEmail(email: string): Promise<AdapterUser | null> {
    const rows = await getDatabase().query(
      "SELECT * FROM public.usuarios WHERE lower(email) = lower($1)",
      [email],
    );
    return rows[0] ? mapUser(rows[0]) : null;
  }

  return {
    async createUser(user) {
      try {
        const rows = await getDatabase().query(
          `
          WITH novo AS (
            INSERT INTO public.usuarios (name, email, email_verified, image)
            VALUES ($1, $2, $3, $4)
            RETURNING *
          ), reservado AS (
            INSERT INTO public.grimorios (user_id, nome, reservada)
            SELECT id, $5, true FROM novo
          ), mochila_reservada AS (
            INSERT INTO public.mochilas (user_id, nome, reservada)
            SELECT id, $6, true FROM novo
          )
          SELECT * FROM novo
          `,
          [
            user.name ?? null,
            user.email,
            user.emailVerified ?? null,
            user.image ?? null,
            RESERVED_GRIMOIRE_NAME,
            RESERVED_MOCHILA_NAME,
          ],
        );
        if (!rows[0]) throw new Error("Não foi possível criar a conta.");
        return mapUser(rows[0]);
      } catch (error) {
        // A concurrent first login may have created the same email. Returning
        // the existing account lets Auth.js continue the normal linking flow.
        if (isUniqueViolation(error)) {
          const existing = await getUserByEmail(user.email);
          if (existing) return existing;
        }
        throw error;
      }
    },

    getUser,

    getUserByEmail,

    async getUserByAccount({ provider, providerAccountId }) {
      const rows = await getDatabase().query(
        `
        SELECT u.*
        FROM public.contas_oauth c
        JOIN public.usuarios u ON u.id = c.user_id
        WHERE c.provider = $1 AND c.provider_account_id = $2
        `,
        [provider, providerAccountId],
      );
      return rows[0] ? mapUser(rows[0]) : null;
    },

    async updateUser(user) {
      const fields: string[] = [];
      const values: unknown[] = [];

      if ("name" in user) {
        values.push(user.name ?? null);
        fields.push(`name = $${values.length}`);
      }
      if ("email" in user) {
        values.push(user.email ?? null);
        fields.push(`email = $${values.length}`);
      }
      if ("emailVerified" in user) {
        values.push(user.emailVerified ?? null);
        fields.push(`email_verified = $${values.length}`);
      }
      if ("image" in user) {
        values.push(user.image ?? null);
        fields.push(`image = $${values.length}`);
      }

      if (fields.length === 0) {
        const current = await getUser(user.id);
        if (!current) throw new Error("Usuário não encontrado.");
        return current;
      }

      values.push(user.id);
      const rows = await getDatabase().query(
        `UPDATE public.usuarios
         SET ${fields.join(", ")}, atualizado_em = now()
         WHERE id = $${values.length}
         RETURNING *`,
        values,
      );
      if (!rows[0]) throw new Error("Usuário não encontrado.");
      return mapUser(rows[0]);
    },

    async deleteUser(userId) {
      await getDatabase().query("DELETE FROM public.usuarios WHERE id = $1", [userId]);
    },

    async linkAccount(account) {
      await getDatabase().query(
        `
        INSERT INTO public.contas_oauth (
          user_id, type, provider, provider_account_id, refresh_token,
          access_token, expires_at, token_type, scope, id_token, session_state
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT (provider, provider_account_id) DO UPDATE SET
          user_id = EXCLUDED.user_id,
          refresh_token = EXCLUDED.refresh_token,
          access_token = EXCLUDED.access_token,
          expires_at = EXCLUDED.expires_at,
          token_type = EXCLUDED.token_type,
          scope = EXCLUDED.scope,
          id_token = EXCLUDED.id_token,
          session_state = EXCLUDED.session_state
        `,
        [
          account.userId,
          account.type,
          account.provider,
          account.providerAccountId,
          account.refresh_token ?? null,
          account.access_token ?? null,
          account.expires_at ?? null,
          account.token_type ?? null,
          account.scope ?? null,
          account.id_token ?? null,
          account.session_state ?? null,
        ],
      );
    },

    async unlinkAccount({ provider, providerAccountId }) {
      await getDatabase().query(
        "DELETE FROM public.contas_oauth WHERE provider = $1 AND provider_account_id = $2",
        [provider, providerAccountId],
      );
    },

    async getAccount(providerAccountId, provider) {
      const rows = await getDatabase().query(
        "SELECT * FROM public.contas_oauth WHERE provider = $1 AND provider_account_id = $2",
        [provider, providerAccountId],
      );
      return rows[0] ? mapAccount(rows[0]) : null;
    },

    async createSession(session) {
      const rows = await getDatabase().query(
        `
        INSERT INTO public.sessoes (session_token, user_id, expires)
        VALUES ($1, $2, $3)
        RETURNING *
        `,
        [session.sessionToken, session.userId, session.expires],
      );
      if (!rows[0]) throw new Error("Não foi possível criar a sessão.");
      return mapSession(rows[0]);
    },

    async getSessionAndUser(sessionToken) {
      const rows = await getDatabase().query(
        `
        SELECT
          s.session_token, s.user_id, s.expires,
          u.id AS u_id, u.name, u.email, u.email_verified, u.image
        FROM public.sessoes s
        JOIN public.usuarios u ON u.id = s.user_id
        WHERE s.session_token = $1 AND s.expires > now()
        `,
        [sessionToken],
      );

      if (!rows[0]) {
        await getDatabase()
          .query("DELETE FROM public.sessoes WHERE session_token = $1 AND expires <= now()", [
            sessionToken,
          ])
          .catch(() => undefined);
        return null;
      }

      return {
        session: mapSession(rows[0]),
        user: mapUser({
          id: rows[0].u_id,
          name: rows[0].name,
          email: rows[0].email,
          email_verified: rows[0].email_verified,
          image: rows[0].image,
        }),
      };
    },

    async updateSession(session) {
      const rows = await getDatabase().query(
        `
        UPDATE public.sessoes
        SET expires = $2
        WHERE session_token = $1
        RETURNING *
        `,
        [session.sessionToken, session.expires ?? new Date()],
      );
      return rows[0] ? mapSession(rows[0]) : null;
    },

    async deleteSession(sessionToken) {
      const rows = await getDatabase().query(
        "DELETE FROM public.sessoes WHERE session_token = $1 RETURNING *",
        [sessionToken],
      );
      return rows[0] ? mapSession(rows[0]) : null;
    },

    async createVerificationToken(verificationToken: VerificationToken) {
      const rows = await getDatabase().query(
        `
        INSERT INTO public.tokens_verificacao (identifier, token, expires)
        VALUES ($1, $2, $3)
        ON CONFLICT (identifier, token) DO UPDATE SET expires = EXCLUDED.expires
        RETURNING *
        `,
        [verificationToken.identifier, verificationToken.token, verificationToken.expires],
      );
      if (!rows[0]) return null;
      return {
        identifier: String(rows[0].identifier),
        token: String(rows[0].token),
        expires: toDate(rows[0].expires) ?? verificationToken.expires,
      };
    },

    async useVerificationToken({ identifier, token }) {
      const rows = await getDatabase().query(
        `
        DELETE FROM public.tokens_verificacao
        WHERE identifier = $1 AND token = $2
        RETURNING *
        `,
        [identifier, token],
      );
      if (!rows[0]) return null;
      return {
        identifier: String(rows[0].identifier),
        token: String(rows[0].token),
        expires: toDate(rows[0].expires) ?? new Date(0),
      };
    },
  };
}

export const authAdapter = createAuthAdapter(getDb);
