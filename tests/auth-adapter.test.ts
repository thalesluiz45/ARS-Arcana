import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createAuthAdapter } from "@/lib/auth/adapter";
import { createPgliteHandle, type PgliteHandle } from "@/lib/db/pglite";

let handle: PgliteHandle;
let adapter: ReturnType<typeof createAuthAdapter>;

beforeAll(async () => {
  handle = createPgliteHandle(null);
  await handle.exec(
    await readFile(
      path.join(process.cwd(), "src", "lib", "db", "migrations", "001_create_magias.sql"),
      "utf8",
    ),
  );
  await handle.exec(
    await readFile(
      path.join(process.cwd(), "src", "lib", "db", "migrations", "002_auth_and_grimoires.sql"),
      "utf8",
    ),
  );
  adapter = createAuthAdapter(() => handle.client);
});

afterAll(async () => {
  await handle.close();
});

describe("Auth.js database adapter", () => {
  it("creates a user and the reserved collection in one statement", async () => {
    const user = await adapter.createUser!({
      id: randomUUID(),
      name: "Aventureira",
      email: "Aventureira@Example.com",
      emailVerified: new Date("2026-01-01T00:00:00.000Z"),
      image: null,
    });

    expect(user.email).toBe("Aventureira@Example.com");

    const reserved = await handle.client.query<{ nome: string; reservada: boolean }>(
      "SELECT nome, reservada FROM public.grimorios WHERE user_id = $1",
      [user.id],
    );
    expect(reserved).toEqual([{ nome: "Sem grimório", reservada: true }]);
  });

  it("looks users up by id and email without case sensitivity", async () => {
    const byEmail = await adapter.getUserByEmail!("aventureira@example.com");
    expect(byEmail?.name).toBe("Aventureira");

    const byId = await adapter.getUser!(byEmail!.id);
    expect(byId?.email).toBe("Aventureira@Example.com");

    expect(await adapter.getUserByEmail!("nao-existe@example.com")).toBeNull();
  });

  it("returns the existing user when the same email is created again", async () => {
    const duplicate = await adapter.createUser!({
      id: randomUUID(),
      name: "Outra pessoa",
      email: "aventureira@example.com",
      emailVerified: null,
      image: null,
    });

    expect(duplicate.name).toBe("Aventureira");
  });

  it("links Google accounts and finds users by provider account", async () => {
    const user = await adapter.getUserByEmail!("aventureira@example.com");
    expect(user).not.toBeNull();

    await adapter.linkAccount!({
      userId: user!.id,
      type: "oidc",
      provider: "google",
      providerAccountId: "google-123",
      access_token: "access-token",
      token_type: "bearer",
      scope: "openid email profile",
      id_token: "id-token",
    });

    const linked = await adapter.getUserByAccount!({
      provider: "google",
      providerAccountId: "google-123",
    });
    expect(linked?.id).toBe(user!.id);

    const account = await adapter.getAccount!("google-123", "google");
    expect(account).toMatchObject({
      userId: user!.id,
      provider: "google",
      providerAccountId: "google-123",
      token_type: "bearer",
    });
  });

  it("creates, reads, updates, and deletes server sessions", async () => {
    const user = await adapter.getUserByEmail!("aventureira@example.com");
    const expires = new Date(Date.now() + 60_000);

    const session = await adapter.createSession!({
      sessionToken: "session-token-123",
      userId: user!.id,
      expires,
    });
    expect(session.userId).toBe(user!.id);

    const found = await adapter.getSessionAndUser!("session-token-123");
    expect(found?.user.id).toBe(user!.id);
    expect(found?.session.sessionToken).toBe("session-token-123");

    const nextExpires = new Date(Date.now() + 120_000);
    const updated = await adapter.updateSession!({
      sessionToken: "session-token-123",
      userId: user!.id,
      expires: nextExpires,
    });
    expect(updated?.expires.getTime()).toBe(nextExpires.getTime());

    expect(await adapter.getSessionAndUser!("unknown-token")).toBeNull();

    const deleted = await adapter.deleteSession!("session-token-123");
    expect(deleted?.sessionToken).toBe("session-token-123");
    expect(await adapter.getSessionAndUser!("session-token-123")).toBeNull();
  });

  it("updates user profile fields and cascades deletion", async () => {
    const user = await adapter.getUserByEmail!("aventureira@example.com");

    const updated = await adapter.updateUser!({
      id: user!.id,
      name: "Aventureira Renomeada",
      email: "aventureira@example.com",
      emailVerified: null,
      image: "https://example.com/avatar.png",
    });
    expect(updated.name).toBe("Aventureira Renomeada");
    expect(updated.image).toBe("https://example.com/avatar.png");

    await adapter.deleteUser!(user!.id);

    expect(await adapter.getUser!(user!.id)).toBeNull();
    const rows = await handle.client.query(
      "SELECT 1 FROM public.grimorios WHERE user_id = $1",
      [user!.id],
    );
    expect(rows).toHaveLength(0);
  });
});
