import type { Metadata } from "next";
import Link from "next/link";
import { cache } from "react";
import {
  ArrowLeft,
  Backpack,
  BookOpen,
  RotateCcw,
  Shield,
  Swords,
  TriangleAlert,
  Wrench,
} from "lucide-react";

import { ArcaneCircle } from "@/components/arcane-circle";
import { EquipmentIcon } from "@/components/equipment-icon";
import { EquipmentSaveButton } from "@/components/equipment-save-button";
import { StatePanel } from "@/components/state-panel";
import { Button } from "@/components/ui/button";
import {
  describeEquipmentFailure,
  type EquipmentFailure,
} from "@/lib/equipment/errors";
import { equipmentRepository } from "@/lib/equipment/repository";
import { safeInternalPath } from "@/lib/navigation";
import {
  equipmentForcaLabel,
  equipmentFurtividadeLabel,
  equipmentPesoLabel,
  equipmentSlugSchema,
  equipmentTypeLabel,
  type Equipment,
} from "@/lib/validation/equipment";

import { EquipmentNotFound } from "./equipment-not-found";

type Params = Promise<{ slug: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const loadEquipment = cache(async (slug: string) =>
  equipmentRepository.getEquipmentBySlug(slug),
);

async function resolveFrom(searchParams: SearchParams): Promise<string> {
  const resolved = await searchParams;
  const raw = resolved.from;
  const value = Array.isArray(raw) ? raw[0] : raw;
  return safeInternalPath(value, "/equipamento");
}

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { slug } = await params;
  if (!equipmentSlugSchema.safeParse(slug).success) {
    return { title: "Equipamento não encontrado" };
  }

  try {
    const equipment = await loadEquipment(slug);
    if (!equipment) return { title: "Equipamento não encontrado" };
    return {
      title: equipment.nome,
      description: `Detalhes de ${equipment.nome} no catálogo de equipamentos de ARS Arcana.`,
    };
  } catch {
    return { title: "Equipamento" };
  }
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="stat-label">{label}</dt>
      <dd className="mt-1.5 text-sm text-foreground">{value}</dd>
    </div>
  );
}

function DescriptionSection({ equipment }: { equipment: Equipment }) {
  if (equipment.tipo !== "ferramenta" && equipment.tipo !== "aventura") {
    return null;
  }

  const paragraphs = equipment.descricao.split(/\n{2,}/).filter(Boolean);
  return (
    <article className="surface-card px-5 py-6 sm:px-8 sm:py-8">
      <div className="flex items-center gap-2.5 border-b border-border pb-4">
        <BookOpen className="size-4 text-gold" strokeWidth={1.6} aria-hidden="true" />
        <h2 className="text-[1.6rem] leading-none text-forest">Descrição</h2>
      </div>
      <div className="spell-copy mt-5 text-[0.98rem] leading-[1.8] text-[#3d4a43]">
        {paragraphs.map((paragraph, index) => (
          <p key={index}>{paragraph}</p>
        ))}
      </div>
    </article>
  );
}

function WeaponDetails({
  equipment,
}: {
  equipment: Extract<Equipment, { tipo: "arma" }>;
}) {
  return (
    <article className="surface-card px-5 py-6 sm:px-8 sm:py-8">
      <div className="flex items-center gap-2.5 border-b border-border pb-4">
        <Swords className="size-4 text-gold" strokeWidth={1.6} aria-hidden="true" />
        <h2 className="text-[1.6rem] leading-none text-forest">Características da arma</h2>
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-5">
        <Stat label="Dano" value={equipment.dano} />
        <Stat label="Tipo de dano" value={equipment.tipoDano} />
        <Stat label="Maestria" value={equipment.maestria} />
      </dl>

      <div className="mt-6 border-t border-border pt-5">
        <h3 className="stat-label">Propriedades</h3>
        {equipment.propriedades.length > 0 ? (
          <ul className="mt-3 flex flex-wrap gap-2">
            {equipment.propriedades.map((property) => (
              <li
                key={property}
                className="rounded-sm border border-border bg-parchment/70 px-2.5 py-1 text-[0.78rem] leading-relaxed text-[#3d4a43]"
              >
                {property}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">
            Sem propriedades adicionais.
          </p>
        )}
      </div>
    </article>
  );
}

function ArmorDetails({
  equipment,
}: {
  equipment: Extract<Equipment, { tipo: "armadura" }>;
}) {
  return (
    <article className="surface-card px-5 py-6 sm:px-8 sm:py-8">
      <div className="flex items-center gap-2.5 border-b border-border pb-4">
        <Shield className="size-4 text-gold" strokeWidth={1.6} aria-hidden="true" />
        <h2 className="text-[1.6rem] leading-none text-forest">Proteção</h2>
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-5">
        <Stat label="Classe de armadura" value={equipment.classeArmadura} />
        <Stat label="Requisito de Força" value={equipmentForcaLabel(equipment)} />
        <Stat label="Furtividade" value={equipmentFurtividadeLabel(equipment)} />
      </dl>
    </article>
  );
}

function AvailableDetails({ equipment }: { equipment: Equipment }) {
  return (
    <div className="space-y-5">
      {equipment.tipo === "arma" ? (
        <WeaponDetails equipment={equipment} />
      ) : equipment.tipo === "armadura" ? (
        <ArmorDetails equipment={equipment} />
      ) : (
        <DescriptionSection equipment={equipment} />
      )}
    </div>
  );
}

function InfoSidebar({ equipment }: { equipment: Equipment }) {
  const rows: { label: string; value: string }[] = [];

  if (equipment.tipo !== "aventura") {
    rows.push({ label: "Categoria", value: equipment.categoria });
  }
  if (equipment.tipo === "ferramenta") {
    rows.push({ label: "Atributo", value: equipment.atributo });
  }
  rows.push({ label: "Peso", value: equipmentPesoLabel(equipment) });
  rows.push({ label: "Custo", value: equipment.custo });
  rows.push({ label: "Página de origem", value: `p. ${equipment.fontePagina}` });

  const NoteIcon =
    equipment.tipo === "arma"
      ? Swords
      : equipment.tipo === "armadura"
        ? Shield
        : equipment.tipo === "ferramenta"
          ? Wrench
          : Backpack;

  return (
    <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
      <div className="surface-card overflow-hidden">
        <div className="border-b border-border px-5 py-4">
          <h2 className="text-[1.35rem] leading-none text-forest">
            Informações do equipamento
          </h2>
        </div>
        <dl className="divide-y divide-border">
          {rows.map((row) => (
            <div key={row.label} className="px-5 py-4">
              <dt className="stat-label">{row.label}</dt>
              <dd className="mt-1.5 text-sm text-foreground">{row.value}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="rounded-md border border-gold/25 bg-parchment/70 px-5 py-4">
        <div className="flex items-center gap-2 text-forest">
          <NoteIcon className="size-4" aria-hidden="true" />
          <p className="text-sm font-medium">Sempre à mão</p>
        </div>
        <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
          Salve este equipamento no seu Arsenal para consultá-lo quando preparar a
          próxima aventura.
        </p>
      </div>
    </aside>
  );
}

export default async function EquipmentDetailPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { slug } = await params;
  const from = await resolveFrom(searchParams);
  const parsedSlug = equipmentSlugSchema.safeParse(slug);

  if (!parsedSlug.success) {
    return <EquipmentNotFound from={from} />;
  }

  let equipment: Equipment | null = null;
  let failure: EquipmentFailure | null = null;

  try {
    equipment = await loadEquipment(parsedSlug.data);
  } catch (error) {
    failure = describeEquipmentFailure(error);
    console.error("[equipamento/detalhe] falha ao carregar o item:", error);
  }

  if (failure) {
    const retryHref = `/equipamento/${encodeURIComponent(
      parsedSlug.data,
    )}?from=${encodeURIComponent(from)}`;
    return (
      <section className="container-page py-14 sm:py-20">
        <StatePanel
          icon={TriangleAlert}
          tone="error"
          eyebrow="Catálogo indisponível"
          title="Não foi possível abrir este equipamento."
          description={`${failure.message} Tente novamente assim que o catálogo estiver acessível.`}
          actions={
            <>
              <Button
                render={<Link href={retryHref} prefetch={false} />}
                className="bg-forest text-[#f8f1df] hover:bg-forest-deep"
              >
                <RotateCcw className="size-4" aria-hidden="true" />
                Tentar novamente
              </Button>
              <Button variant="outline" render={<Link href="/equipamento" />}>
                Voltar ao catálogo
              </Button>
            </>
          }
        />
      </section>
    );
  }

  if (!equipment) {
    return <EquipmentNotFound from={from} />;
  }

  const fromArsenal = from.startsWith("/arsenal");
  const backLabel = fromArsenal ? "Voltar ao Arsenal" : "Voltar ao catálogo";

  return (
    <>
      <section className="relative overflow-hidden bg-forest text-[#f7f1e2]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_82%_38%,rgb(200_163_90/0.13),transparent_32rem)]" />
        <ArcaneCircle className="pointer-events-none absolute -right-16 top-1/2 hidden h-[300px] w-[300px] -translate-y-1/2 text-gold/60 md:block" />
        <div className="container-page relative py-9 sm:py-12">
          <Link
            href={from}
            className="inline-flex items-center gap-2 text-sm text-[#d8d4c7] transition-colors hover:text-white"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            {backLabel}
          </Link>

          <div className="mt-8 flex flex-col gap-6 sm:flex-row sm:items-start">
            <EquipmentIcon
              equipment={equipment}
              size="lg"
              className="border-gold/30 bg-white/[0.06] text-gold"
            />
            <div className="min-w-0 flex-1">
              <p className="eyebrow text-gold">{equipmentTypeLabel(equipment)}</p>
              <h1 className="mt-3 text-[clamp(2.35rem,5vw,4rem)] leading-[1.03] tracking-[-0.015em] text-[#f8f2e4]">
                {equipment.nome}
              </h1>
              <p className="mt-3 text-sm text-[#d7d2c4]">
                {equipment.custo} <span aria-hidden="true">·</span>{" "}
                {equipmentPesoLabel(equipment)}
              </p>
            </div>
            <EquipmentSaveButton
              equipment={equipment}
              variant="labelled"
              className="shrink-0 border-gold/45 bg-white/[0.04] text-[#f7f1e2] hover:border-gold hover:bg-white/[0.09] hover:text-white"
            />
          </div>
        </div>
        <div className="absolute inset-x-0 bottom-0 h-px bg-gold/25" />
      </section>

      <section className="container-page py-8 sm:py-10">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] xl:gap-8">
          <AvailableDetails equipment={equipment} />
          <InfoSidebar equipment={equipment} />
        </div>
      </section>
    </>
  );
}
