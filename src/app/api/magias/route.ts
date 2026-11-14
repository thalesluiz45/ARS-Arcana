import type { NextRequest } from "next/server";

import { jsonResponse } from "@/lib/api-response";
import { catalogRepository } from "@/lib/catalog/repository";
import { describeCatalogFailure } from "@/lib/catalog/errors";
import { parseCatalogFilters } from "@/lib/validation/catalog";
import { spellIdSchema } from "@/lib/validation/spell";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const rawIds = searchParams.get("ids");

  try {
    if (rawIds !== null) {
      const ids = [...new Set(rawIds.split(",").map((id) => id.trim()).filter(Boolean))];
      const parsed = spellIdSchema.array().max(100).safeParse(ids);
      if (!parsed.success) {
        return jsonResponse(
          {
            error:
              "A lista de IDs é inválida. Envie até 100 UUIDs separados por vírgula.",
            code: "invalid-ids",
          },
          400,
        );
      }

      const spells = await catalogRepository.listSpellsByIds(parsed.data);
      return jsonResponse(spells);
    }

    const filters = parseCatalogFilters(searchParams);
    const page = await catalogRepository.searchSpells(filters);
    return jsonResponse(page);
  } catch (error) {
    const failure = describeCatalogFailure(error);
    console.error("[api/magias] falha ao consultar o catálogo:", error);
    return jsonResponse({ error: failure.message, code: failure.code }, failure.status);
  }
}
