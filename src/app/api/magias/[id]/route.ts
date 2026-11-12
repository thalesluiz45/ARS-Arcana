import type { NextRequest } from "next/server";

import { jsonResponse } from "@/lib/api-response";
import { describeCatalogFailure } from "@/lib/catalog/errors";
import { catalogRepository } from "@/lib/catalog/repository";
import { spellIdSchema } from "@/lib/validation/spell";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const parsedId = spellIdSchema.safeParse(id);

  if (!parsedId.success) {
    return jsonResponse(
      { error: "O identificador da magia não é válido.", code: "invalid-id" },
      400,
    );
  }

  try {
    const spell = await catalogRepository.getSpellById(parsedId.data);
    if (!spell) {
      return jsonResponse(
        { error: "Magia não encontrada no catálogo.", code: "not-found" },
        404,
      );
    }
    return jsonResponse(spell);
  } catch (error) {
    const failure = describeCatalogFailure(error);
    console.error("[api/magias/[id]] falha ao consultar o catálogo:", error);
    return jsonResponse({ error: failure.message, code: failure.code }, failure.status);
  }
}
