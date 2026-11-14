import type { NextRequest } from "next/server";

import { jsonResponse, readJsonObject } from "@/lib/api-response";
import { getSessionUser, unauthorizedResponseBody } from "@/lib/auth/session";
import {
  describeArsenalFailure,
  describeEquipmentFailure,
} from "@/lib/equipment/errors";
import { equipmentRepository } from "@/lib/equipment/repository";
import { equipmentSlugSchema } from "@/lib/validation/equipment";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return jsonResponse(unauthorizedResponseBody(), 401);

  try {
    const snapshot = await equipmentRepository.getArsenalSnapshot(user.id);
    return jsonResponse(snapshot);
  } catch (error) {
    const failure = describeArsenalFailure(error);
    console.error("[api/arsenal] falha ao carregar o Arsenal:", error);
    return jsonResponse(
      { error: failure.message, code: failure.code },
      failure.status,
    );
  }
}

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return jsonResponse(unauthorizedResponseBody(), 401);

  const body = await readJsonObject(request);
  const parsed = equipmentSlugSchema.safeParse(body?.slug);
  if (!parsed.success) {
    return jsonResponse(
      {
        error: "Informe um equipamento válido para salvar no Arsenal.",
        code: "invalid-slug",
      },
      400,
    );
  }

  try {
    const snapshot = await equipmentRepository.saveItem(user.id, parsed.data);
    return jsonResponse(snapshot);
  } catch (error) {
    const failure =
      error instanceof Error && "code" in error && error.code === "not-found"
        ? describeEquipmentFailure(error)
        : describeArsenalFailure(error);
    if (failure.status >= 500) {
      console.error("[api/arsenal] falha ao salvar no Arsenal:", error);
    }
    return jsonResponse(
      { error: failure.message, code: failure.code },
      failure.status,
    );
  }
}
