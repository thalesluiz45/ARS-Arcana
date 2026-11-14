import type { NextRequest } from "next/server";

import { jsonResponse, readJsonObject } from "@/lib/api-response";
import { getSessionUser, unauthorizedResponseBody } from "@/lib/auth/session";
import { describeGrimoireFailure } from "@/lib/grimoires/errors";
import { getGrimoireRepository } from "@/lib/grimoires/repository";
import { spellSelectionRequestSchema } from "@/lib/validation/grimoire";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PUT(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return jsonResponse(unauthorizedResponseBody(), 401);

  const body = await readJsonObject(request);
  const parsed = spellSelectionRequestSchema.safeParse(body);
  if (!parsed.success) {
    return jsonResponse(
      {
        error: parsed.error.issues[0]?.message ?? "Seleção de grimórios inválida.",
        code: "invalid",
      },
      400,
    );
  }

  try {
    await getGrimoireRepository().updateSpellSelection(user.id, parsed.data.magiaId, {
      grimoireIds: parsed.data.grimoireIds,
      withoutGrimoire: parsed.data.withoutGrimoire,
    });
    return jsonResponse({ ok: true });
  } catch (error) {
    const failure = describeGrimoireFailure(error);
    return jsonResponse({ error: failure.message, code: failure.code }, failure.status);
  }
}
