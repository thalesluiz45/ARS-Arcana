import type { NextRequest } from "next/server";

import { jsonResponse } from "@/lib/api-response";
import { getSessionUser, unauthorizedResponseBody } from "@/lib/auth/session";
import { describeArsenalFailure } from "@/lib/equipment/errors";
import { equipmentRepository } from "@/lib/equipment/repository";
import { equipmentSlugSchema } from "@/lib/validation/equipment";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const user = await getSessionUser();
  if (!user) return jsonResponse(unauthorizedResponseBody(), 401);

  const { slug } = await params;
  const parsedSlug = equipmentSlugSchema.safeParse(slug);
  if (!parsedSlug.success) {
    return jsonResponse(
      {
        error: "Informe um equipamento válido para remover do Arsenal.",
        code: "invalid-slug",
      },
      400,
    );
  }

  try {
    const snapshot = await equipmentRepository.removeItem(user.id, parsedSlug.data);
    return jsonResponse(snapshot);
  } catch (error) {
    const failure = describeArsenalFailure(error);
    if (failure.status >= 500) {
      console.error("[api/arsenal] falha ao remover do Arsenal:", error);
    }
    return jsonResponse(
      { error: failure.message, code: failure.code },
      failure.status,
    );
  }
}
