import type { NextRequest } from "next/server";

import { jsonResponse } from "@/lib/api-response";
import { describeEquipmentFailure } from "@/lib/equipment/errors";
import { equipmentRepository } from "@/lib/equipment/repository";
import { equipmentSlugSchema } from "@/lib/validation/equipment";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const parsedSlug = equipmentSlugSchema.safeParse(slug);
  if (!parsedSlug.success) {
    return jsonResponse(
      { error: "O identificador do equipamento não é válido.", code: "invalid-slug" },
      400,
    );
  }

  try {
    const equipment = await equipmentRepository.getEquipmentBySlug(parsedSlug.data);
    if (!equipment) {
      return jsonResponse(
        { error: "Equipamento não encontrado no catálogo.", code: "not-found" },
        404,
      );
    }
    return jsonResponse(equipment);
  } catch (error) {
    const failure = describeEquipmentFailure(error);
    console.error("[api/equipamentos/[slug]] falha ao consultar o catálogo:", error);
    return jsonResponse(
      { error: failure.message, code: failure.code },
      failure.status,
    );
  }
}
