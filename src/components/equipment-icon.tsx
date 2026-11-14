import { Backpack, Shield, Swords, Wrench, type LucideIcon } from "lucide-react";

import type { Equipment, EquipmentType } from "@/lib/validation/equipment";
import { cn } from "@/lib/utils";

const TYPE_ICONS: Record<EquipmentType, LucideIcon> = {
  arma: Swords,
  armadura: Shield,
  ferramenta: Wrench,
  aventura: Backpack,
};

const TYPE_STYLES: Record<EquipmentType, string> = {
  arma: "border-[#dccda9] bg-[#f6eedc] text-[#8a6a2f]",
  armadura: "border-[#c7d5e1] bg-[#eaf0f6] text-[#526f88]",
  ferramenta: "border-[#c8d8c8] bg-[#eaf1e8] text-[#4f6b50]",
  aventura: "border-[#d9cfbd] bg-[#f4eee3] text-[#7b6848]",
};

export function EquipmentIcon({
  equipment,
  size = "md",
  className,
}: {
  equipment: Pick<Equipment, "tipo">;
  size?: "md" | "lg";
  className?: string;
}) {
  const Icon = TYPE_ICONS[equipment.tipo];
  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid shrink-0 place-items-center rounded-md border",
        size === "lg" ? "size-16" : "size-12",
        TYPE_STYLES[equipment.tipo],
        className,
      )}
    >
      <Icon
        className={size === "lg" ? "size-7" : "size-[1.35rem]"}
        strokeWidth={1.35}
      />
    </span>
  );
}
