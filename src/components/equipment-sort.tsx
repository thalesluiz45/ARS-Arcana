"use client";

import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";

import {
  equipmentSortLabels,
  type EquipmentSort,
} from "@/lib/validation/equipment";

const SORT_OPTIONS = Object.entries(equipmentSortLabels) as [
  EquipmentSort,
  string,
][];

export function EquipmentSort({
  value,
  currentSearch,
}: {
  value: EquipmentSort;
  currentSearch: string;
}) {
  const router = useRouter();

  return (
    <div className="flex items-center gap-2.5">
      <label htmlFor="ordenar-equipamentos" className="whitespace-nowrap text-sm text-muted-foreground">
        Ordenar por:
      </label>
      <div className="relative">
        <select
          id="ordenar-equipamentos"
          value={value}
          onChange={(event) => {
            const params = new URLSearchParams(currentSearch);
            if (event.target.value === "categoria") params.delete("sort");
            else params.set("sort", event.target.value);
            params.delete("page");
            const query = params.toString();
            router.push(query ? `/equipamento?${query}` : "/equipamento");
          }}
          className="h-9 appearance-none rounded-sm border border-transparent bg-transparent py-1 pl-1 pr-7 text-sm font-medium text-foreground transition-colors hover:border-border focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
        >
          {SORT_OPTIONS.map(([optionValue, label]) => (
            <option key={optionValue} value={optionValue}>
              {label}
            </option>
          ))}
        </select>
        <ChevronDown
          className="pointer-events-none absolute right-1 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
      </div>
    </div>
  );
}
