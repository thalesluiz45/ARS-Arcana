import type { NextRequest } from "next/server";
import { z } from "zod";

import { jsonResponse, readJsonObject } from "@/lib/api-response";
import { getSessionUser, unauthorizedResponseBody } from "@/lib/auth/session";
import { describeGrimoireFailure } from "@/lib/grimoires/errors";
import { getGrimoireRepository } from "@/lib/grimoires/repository";
import { grimoireNameSchema } from "@/lib/validation/grimoire";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const idSchema = z.uuid();
const renameSchema = z.object({
  nome: grimoireNameSchema,
});

type Params = Promise<{ id: string }>;

export async function PATCH(request: NextRequest, { params }: { params: Params }) {
  const user = await getSessionUser();
  if (!user) return jsonResponse(unauthorizedResponseBody(), 401);

  const { id } = await params;
  if (!idSchema.safeParse(id).success) {
    return jsonResponse({ error: "Grimório não encontrado.", code: "not-found" }, 404);
  }

  const body = await readJsonObject(request);
  const parsed = renameSchema.safeParse(body);
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
    const grimoire = await getGrimoireRepository().renameGrimoire(user.id, id, parsed.data.nome);
    return jsonResponse(grimoire);
  } catch (error) {
    const failure = describeGrimoireFailure(error);
    return jsonResponse({ error: failure.message, code: failure.code }, failure.status);
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Params }) {
  const user = await getSessionUser();
  if (!user) return jsonResponse(unauthorizedResponseBody(), 401);

  const { id } = await params;
  if (!idSchema.safeParse(id).success) {
    return jsonResponse({ error: "Grimório não encontrado.", code: "not-found" }, 404);
  }

  try {
    await getGrimoireRepository().deleteGrimoire(user.id, id);
    return jsonResponse({ ok: true });
  } catch (error) {
    const failure = describeGrimoireFailure(error);
    return jsonResponse({ error: failure.message, code: failure.code }, failure.status);
  }
}
