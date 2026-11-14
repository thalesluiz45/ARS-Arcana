import { EquipmentCard } from "@/components/equipment-card";
import {
  EQUIPMENT_TYPE_LABELS,
  type Equipment,
  type EquipmentType,
} from "@/lib/validation/equipment";

export function EquipmentGrid({
  items,
  from,
}: {
  items: Equipment[];
  from: string;
}) {
  return (
    <div className="mt-4 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
      {items.map((equipment) => (
        <EquipmentCard key={equipment.slug} equipment={equipment} from={from} />
      ))}
    </div>
  );
}

export function EquipmentSection({
  type,
  items,
  total,
  from,
}: {
  type: EquipmentType;
  items: Equipment[];
  total?: number;
  from: string;
}) {
  if (items.length === 0) return null;

  const sectionTotal = total ?? items.length;

  return (
    <section aria-labelledby={`secao-${type}`} className="mt-8 first:mt-6">
      <div className="flex items-baseline justify-between gap-4 border-b border-border pb-2.5">
        <h3
          id={`secao-${type}`}
          className="font-heading text-[1.65rem] leading-none text-forest"
        >
          {EQUIPMENT_TYPE_LABELS[type].section}
        </h3>
        <span className="text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          {String(sectionTotal).padStart(2, "0")}{" "}
          {sectionTotal === 1 ? "item" : "itens"}
        </span>
      </div>
      <EquipmentGrid items={items} from={from} />
    </section>
  );
}

export function groupEquipmentByType(
  items: Equipment[],
): { type: EquipmentType; items: Equipment[] }[] {
  const groups = new Map<EquipmentType, Equipment[]>();
  for (const item of items) {
    const group = groups.get(item.tipo) ?? [];
    group.push(item);
    groups.set(item.tipo, group);
  }

  return ["arma", "armadura", "ferramenta", "aventura"]
    .filter((type): type is EquipmentType => groups.has(type as EquipmentType))
    .map((type) => ({ type, items: groups.get(type) ?? [] }));
}
