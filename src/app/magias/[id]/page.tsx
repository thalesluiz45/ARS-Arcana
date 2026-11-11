import type { Metadata } from "next";

import { catalogRepository } from "@/lib/catalog/repository";
import { safeInternalPath } from "@/lib/navigation";
import { magiaIdSchema } from "@/lib/validation/magia";

import { SpellDetail } from "./spell-detail";
import { SpellNotFound } from "./spell-not-found";

type Params = Promise<{ id: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

async function resolveFrom(searchParams: SearchParams): Promise<string> {
  const resolved = await searchParams;
  const raw = resolved.from;
  const value = Array.isArray(raw) ? raw[0] : raw;
  return safeInternalPath(value, "/");
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params;
  if (!magiaIdSchema.safeParse(id).success) {
    return { title: "Magia não encontrada" };
  }

  try {
    const spell = await catalogRepository.getMagiaById(id);
    if (!spell) return { title: "Magia não encontrada" };
    return {
      title: spell.nome,
      description: spell.descricao.slice(0, 155),
    };
  } catch {
    return { title: "Detalhes da magia" };
  }
}

export default async function SpellPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { id } = await params;
  const from = await resolveFrom(searchParams);

  if (!magiaIdSchema.safeParse(id).success) {
    return <SpellNotFound from={from} />;
  }

  return <SpellDetail magiaId={id} from={from} />;
}
