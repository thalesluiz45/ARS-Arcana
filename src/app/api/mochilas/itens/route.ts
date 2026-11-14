import type { NextRequest } from "next/server";

import { jsonResponse, readJsonObject } from "@/lib/api-response";
import { getSessionUser, unauthorizedResponseBody } from "@/lib/auth/session";
import { describeArsenalFailure } from "@/lib/equipment/errors";
import { getMochilaRepository } from "@/lib/mochilas/repository";
import { equipmentSelectionRequestSchema } from "@/lib/validation/mochila";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PUT(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return jsonResponse(unauthorizedResponseBody(), 401);

  const body = await readJsonObject(request);
  const parsed = equipmentSelectionRequestSchema.safeParse(body);
  if (!parsed.success) {
    return jsonResponse(
      {
        error: parsed.error.issues[0]?.message ?? "Seleção de mochilas inválida.",
        code: "invalid",
      },
      400,
    );
  }

  try {
    await getMochilaRepository().updateEquipmentSelection(user.id, parsed.data.slug, {
      mochilaIds: parsed.data.mochilaIds,
      withoutMochila: parsed.data.withoutMochila,
    });
    return jsonResponse({ ok: true });
  } catch (error) {
    const failure = describeArsenalFailure(error);
    return jsonResponse({ error: failure.message, code: failure.code }, failure.status);
  }
}
