import type { NextRequest } from "next/server";
import { z } from "zod";

import { jsonResponse, readJsonObject } from "@/lib/api-response";
import { getSessionUser, unauthorizedResponseBody } from "@/lib/auth/session";
import { describeArsenalFailure } from "@/lib/equipment/errors";
import { getMochilaRepository } from "@/lib/mochilas/repository";
import { mochilaNameSchema } from "@/lib/validation/mochila";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return jsonResponse(unauthorizedResponseBody(), 401);

  try {
    const snapshot = await getMochilaRepository().getSnapshot(user.id);
    return jsonResponse(snapshot);
  } catch (error) {
    const failure = describeArsenalFailure(error);
    console.error("[api/mochilas] falha ao carregar as mochilas:", error);
    return jsonResponse({ error: failure.message, code: failure.code }, failure.status);
  }
}

const createSchema = z.object({
  nome: mochilaNameSchema,
});

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return jsonResponse(unauthorizedResponseBody(), 401);

  const body = await readJsonObject(request);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return jsonResponse(
      {
        error: parsed.error.issues[0]?.message ?? "Informe um nome para a mochila.",
        code: "invalid",
      },
      400,
    );
  }

  try {
    const mochila = await getMochilaRepository().createMochila(user.id, parsed.data.nome);
    return jsonResponse(mochila, 201);
  } catch (error) {
    const failure = describeArsenalFailure(error);
    return jsonResponse({ error: failure.message, code: failure.code }, failure.status);
  }
}
