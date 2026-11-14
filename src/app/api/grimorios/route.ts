import type { NextRequest } from "next/server";
import { z } from "zod";

import { jsonResponse, readJsonObject } from "@/lib/api-response";
import { getSessionUser, unauthorizedResponseBody } from "@/lib/auth/session";
import { describeGrimoireFailure } from "@/lib/grimoires/errors";
import { getGrimoireRepository } from "@/lib/grimoires/repository";
import { grimoireNameSchema } from "@/lib/validation/grimoire";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return jsonResponse(unauthorizedResponseBody(), 401);

  try {
    const snapshot = await getGrimoireRepository().getSnapshot(user.id);
    return jsonResponse(snapshot);
  } catch (error) {
    const failure = describeGrimoireFailure(error);
    console.error("[api/grimorios] falha ao carregar a coleção:", error);
    return jsonResponse({ error: failure.message, code: failure.code }, failure.status);
  }
}

const createSchema = z.object({
  nome: grimoireNameSchema,
});

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return jsonResponse(unauthorizedResponseBody(), 401);

  const body = await readJsonObject(request);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return jsonResponse(
      {
        error: parsed.error.issues[0]?.message ?? "Informe um nome para o grimório.",
        code: "invalid",
      },
      400,
    );
  }

  try {
    const grimoire = await getGrimoireRepository().createGrimoire(user.id, parsed.data.nome);
    return jsonResponse(grimoire, 201);
  } catch (error) {
    const failure = describeGrimoireFailure(error);
    return jsonResponse({ error: failure.message, code: failure.code }, failure.status);
  }
}
