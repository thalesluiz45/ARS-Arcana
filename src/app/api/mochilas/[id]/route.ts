import type { NextRequest } from "next/server";
import { z } from "zod";

import { jsonResponse, readJsonObject } from "@/lib/api-response";
import { getSessionUser, unauthorizedResponseBody } from "@/lib/auth/session";
import { describeArsenalFailure } from "@/lib/equipment/errors";
import { getMochilaRepository } from "@/lib/mochilas/repository";
import { mochilaNameSchema } from "@/lib/validation/mochila";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const idSchema = z.uuid();
const renameSchema = z.object({
  nome: mochilaNameSchema,
});

type Params = Promise<{ id: string }>;

export async function PATCH(request: NextRequest, { params }: { params: Params }) {
  const user = await getSessionUser();
  if (!user) return jsonResponse(unauthorizedResponseBody(), 401);

  const { id } = await params;
  if (!idSchema.safeParse(id).success) {
    return jsonResponse({ error: "Mochila não encontrada.", code: "not-found" }, 404);
  }

  const body = await readJsonObject(request);
  const parsed = renameSchema.safeParse(body);
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
    const mochila = await getMochilaRepository().renameMochila(user.id, id, parsed.data.nome);
    return jsonResponse(mochila);
  } catch (error) {
    const failure = describeArsenalFailure(error);
    return jsonResponse({ error: failure.message, code: failure.code }, failure.status);
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Params }) {
  const user = await getSessionUser();
  if (!user) return jsonResponse(unauthorizedResponseBody(), 401);

  const { id } = await params;
  if (!idSchema.safeParse(id).success) {
    return jsonResponse({ error: "Mochila não encontrada.", code: "not-found" }, 404);
  }

  try {
    await getMochilaRepository().deleteMochila(user.id, id);
    return jsonResponse({ ok: true });
  } catch (error) {
    const failure = describeArsenalFailure(error);
    return jsonResponse({ error: failure.message, code: failure.code }, failure.status);
  }
}
