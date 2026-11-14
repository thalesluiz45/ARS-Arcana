import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { EquipmentIcon } from "@/components/equipment-icon";
import { EquipmentSaveButton } from "@/components/equipment-save-button";
import { equipmentHref } from "@/lib/navigation";
import {
  equipmentForcaLabel,
  equipmentFurtividadeLabel,
  equipmentPesoLabel,
  equipmentTypeLabel,
  type ArmorEquipment,
  type Equipment,
  type WeaponEquipment,
} from "@/lib/validation/equipment";
import { cn } from "@/lib/utils";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="stat-label">{label}</dt>
      <dd className="mt-1.5 text-[0.8rem] leading-snug text-foreground">{value}</dd>
    </div>
  );
}

function WeaponBody({ equipment }: { equipment: WeaponEquipment }) {
  return (
    <>
      <div>
        <p className="stat-label">Dano</p>
        <p className="mt-1.5 font-heading text-[1.7rem] leading-none text-forest">
          {equipment.dano}{" "}
          <span className="text-[1rem] text-muted-foreground">
            {equipment.tipoDano.toLowerCase()}
          </span>
        </p>
      </div>

      <div className="mt-4">
        <p className="stat-label">Propriedades</p>
        {equipment.propriedades.length > 0 ? (
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {equipment.propriedades.map((property) => (
              <li
                key={property}
                className="rounded-sm border border-border/80 bg-parchment/70 px-2 py-0.5 text-[0.7rem] leading-relaxed text-[#3d4a43]"
              >
                {property}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-[0.8rem] text-muted-foreground">
            Sem propriedades adicionais.
          </p>
        )}
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-border pt-4 sm:grid-cols-3">
        <Stat label="Maestria" value={equipment.maestria} />
        <Stat label="Peso" value={equipmentPesoLabel(equipment)} />
        <Stat label="Custo" value={equipment.custo} />
      </dl>
    </>
  );
}

function ArmorBody({ equipment }: { equipment: ArmorEquipment }) {
  return (
    <>
      <div>
        <p className="stat-label">Classe de armadura</p>
        <p className="mt-1.5 font-heading text-[1.7rem] leading-none text-forest">
          {equipment.classeArmadura}
        </p>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3">
        <Stat label="Força" value={equipmentForcaLabel(equipment)} />
        <Stat label="Furtividade" value={equipmentFurtividadeLabel(equipment)} />
      </dl>

      <dl className="mt-auto grid grid-cols-2 gap-x-4 gap-y-3 border-t border-border pt-4">
        <Stat label="Peso" value={equipmentPesoLabel(equipment)} />
        <Stat label="Custo" value={equipment.custo} />
      </dl>
    </>
  );
}

function DescriptionBody({
  equipment,
  lines,
}: {
  equipment: Extract<Equipment, { tipo: "ferramenta" | "aventura" }>;
  lines: string;
}) {
  return (
    <>
      <p className={cn("text-sm leading-relaxed text-muted-foreground", lines)}>
        {equipment.descricao}
      </p>

      <dl
        className={cn(
          "mt-auto grid gap-x-4 gap-y-3 border-t border-border pt-4",
          equipment.tipo === "ferramenta" ? "grid-cols-3" : "grid-cols-2",
        )}
      >
        {equipment.tipo === "ferramenta" ? (
          <Stat label="Atributo" value={equipment.atributo} />
        ) : null}
        <Stat label="Peso" value={equipmentPesoLabel(equipment)} />
        <Stat label="Custo" value={equipment.custo} />
      </dl>
    </>
  );
}

export function EquipmentCard({
  equipment,
  from,
  className,
}: {
  equipment: Equipment;
  from: string;
  className?: string;
}) {
  const href = equipmentHref(equipment.slug, from);

  return (
    <article
      className={cn(
        "surface-card group flex h-full flex-col overflow-hidden transition-[border-color,box-shadow,transform] hover:-translate-y-0.5 hover:border-gold/55 hover:shadow-[0_18px_40px_-30px_rgb(34_48_42/0.5)]",
        className,
      )}
    >
      <div className="flex items-start gap-3 p-5 pb-4">
        <EquipmentIcon equipment={equipment} />
        <div className="min-w-0 flex-1">
          <h3 className="font-heading text-[1.45rem] leading-[1.08] tracking-[-0.01em] text-forest">
            <Link href={href} className="transition-colors hover:text-[#7d5e2a]">
              {equipment.nome}
            </Link>
          </h3>
          <p className="mt-1.5 text-[0.62rem] font-semibold uppercase tracking-[0.13em] text-muted-foreground">
            {equipmentTypeLabel(equipment)}
          </p>
        </div>
        <EquipmentSaveButton equipment={equipment} />
      </div>

      <div className="mx-5 border-t border-border" />

      <div className="flex flex-1 flex-col p-5 pt-4">
        {equipment.tipo === "arma" ? (
          <WeaponBody equipment={equipment} />
        ) : equipment.tipo === "armadura" ? (
          <ArmorBody equipment={equipment} />
        ) : equipment.tipo === "ferramenta" ? (
          <DescriptionBody equipment={equipment} lines="line-clamp-3" />
        ) : (
          <DescriptionBody equipment={equipment} lines="line-clamp-4" />
        )}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
          <Link
            href={href}
            className="inline-flex items-center gap-2 text-sm font-semibold text-forest transition-colors hover:text-[#7d5e2a]"
          >
            Ver equipamento
            <ArrowRight
              className="size-4 transition-transform group-hover:translate-x-0.5"
              aria-hidden="true"
            />
          </Link>
          <span className="text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Página {equipment.fontePagina}
          </span>
        </div>
      </div>
    </article>
  );
}
