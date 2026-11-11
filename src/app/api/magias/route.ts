import type { NextRequest } from "next/server";

import { catalogRepository } from "@/lib/catalog/repository";
import { describeCatalogFailure } from "@/lib/catalog/errors";
import { parseCatalogFilters } from "@/lib/validation/catalog";
import { magiaIdSchema } from "@/lib/validation/magia";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const rawIds = searchParams.get("ids");

  try {
    if (rawIds !== null) {
      const ids = [...new Set(rawIds.split(",").map((id) => id.trim()).filter(Boolean))];
      const parsed = magiaIdSchema.array().max(100).safeParse(ids);
      if (!parsed.success) {
        return json(
          {
            error:
              "A lista de IDs é inválida. Envie até 100 UUIDs separados por vírgula.",
            code: "invalid-ids",
          },
          400,
        );
      }

      const spells = await catalogRepository.listarMagiasPorIds(parsed.data);
      return json(spells);
    }

    const filters = parseCatalogFilters(searchParams);
    const page = await catalogRepository.buscarMagias(filters);
    return json(page);
  } catch (error) {
    const failure = describeCatalogFailure(error);
    console.error("[api/magias] falha ao consultar o catálogo:", error);
    return json({ error: failure.message, code: failure.code }, failure.status);
  }
}
