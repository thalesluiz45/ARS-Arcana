import type { NextRequest } from "next/server";

import { jsonResponse } from "@/lib/api-response";
import { describeEquipmentFailure } from "@/lib/equipment/errors";
import { equipmentRepository } from "@/lib/equipment/repository";
import { parseEquipmentFilters } from "@/lib/validation/equipment";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const filters = parseEquipmentFilters(request.nextUrl.searchParams);
    const page = await equipmentRepository.searchEquipment(filters);
    return jsonResponse(page);
  } catch (error) {
    const failure = describeEquipmentFailure(error);
    console.error("[api/equipamentos] falha ao consultar o catálogo:", error);
    return jsonResponse(
      { error: failure.message, code: failure.code },
      failure.status,
    );
  }
}
