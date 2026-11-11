import type { NextRequest } from "next/server";

import { describeCatalogFailure } from "@/lib/catalog/errors";
import { catalogRepository } from "@/lib/catalog/repository";
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

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const parsedId = magiaIdSchema.safeParse(id);

  if (!parsedId.success) {
    return json(
      { error: "O identificador da magia não é válido.", code: "invalid-id" },
      400,
    );
  }

  try {
    const spell = await catalogRepository.getMagiaById(parsedId.data);
    if (!spell) {
      return json({ error: "Magia não encontrada no catálogo.", code: "not-found" }, 404);
    }
    return json(spell);
  } catch (error) {
    const failure = describeCatalogFailure(error);
    console.error("[api/magias/[id]] falha ao consultar o catálogo:", error);
    return json({ error: failure.message, code: failure.code }, failure.status);
  }
}
