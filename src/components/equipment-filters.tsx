"use client";

import { useRouter } from "next/navigation";
import { ChevronDown, SlidersHorizontal } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  ARMOR_FILTER_LABELS,
  EQUIPMENT_TYPE_LABELS,
  EQUIPMENT_TYPE_ORDER,
  WEAPON_KIND_LABELS,
  WEAPON_RANGE_LABELS,
  type ArmorFilter,
  type EquipmentFacets,
  type EquipmentFilters,
  type EquipmentType,
  type WeaponKind,
  type WeaponRange,
} from "@/lib/validation/equipment";
import { cn } from "@/lib/utils";

const ARMOR_FILTER_VALUES: Record<ArmorFilter, string> = {
  leve: "Leve",
  media: "Média",
  pesada: "Pesada",
  escudo: "Escudo",
};

function activeFilterCount(filters: EquipmentFilters): number {
  return (
    (filters.q ? 1 : 0) +
    (filters.tipo ? 1 : 0) +
    filters.armas.length +
    filters.alcances.length +
    filters.armaduras.length
  );
}

function facetTotal(facets: EquipmentFacets): number {
  return facets.tipos.reduce((total, item) => total + item.total, 0);
}

type FilterPanelProps = {
  facets: EquipmentFacets | null;
  filters: EquipmentFilters;
  currentSearch: string;
  onNavigate?: () => void;
};

function FilterPanel({ facets, filters, currentSearch, onNavigate }: FilterPanelProps) {
  const router = useRouter();
  const disabled = !facets;

  function navigate(update: (params: URLSearchParams) => void) {
    const params = new URLSearchParams(currentSearch);
    update(params);
    params.delete("page");
    const query = params.toString();
    router.push(query ? `/equipamento?${query}` : "/equipamento");
    onNavigate?.();
  }

  function selectType(type: EquipmentType | null) {
    navigate((params) => {
      if (type) params.set("tipo", type);
      else params.delete("tipo");

      if (type !== "arma") {
        params.delete("arma");
        params.delete("armas");
        params.delete("alcance");
        params.delete("alcances");
      }
      if (type !== "armadura") {
        params.delete("armadura");
        params.delete("armaduras");
      }
    });
  }

  function toggleListValue(
    key: "arma" | "alcance" | "armadura",
    value: string,
    selected: readonly string[],
  ) {
    const next = new Set(selected);
    if (next.has(value)) next.delete(value);
    else next.add(value);

    navigate((params) => {
      params.delete(key);
      params.delete(
        key === "arma" ? "armas" : key === "alcance" ? "alcances" : "armaduras",
      );
      for (const item of next) params.append(key, item);
    });
  }

  function clearAll() {
    router.push("/equipamento");
    onNavigate?.();
  }

  const hasActiveFilters = activeFilterCount(filters) > 0;
  const showWeapons = filters.tipo === null || filters.tipo === "arma";
  const showArmor = filters.tipo === null || filters.tipo === "armadura";

  const weaponKindCounts = new Map(
    facets?.armas.tipos.map((item) => [item.valor, item.total]) ?? [],
  );
  const weaponRangeCounts = new Map(
    facets?.armas.alcances.map((item) => [item.valor, item.total]) ?? [],
  );
  const armorCounts = new Map(
    facets?.armaduras.map((item) => [item.valor, item.total]) ?? [],
  );

  return (
    <div className="space-y-7">
      <div className="flex items-center justify-between gap-3 border-b border-border pb-4">
        <h2 className="text-[1.55rem] leading-none text-forest">Refinar busca</h2>
        <button
          type="button"
          onClick={clearAll}
          disabled={!hasActiveFilters}
          className="text-xs font-medium text-muted-foreground underline-offset-4 transition-colors hover:text-forest hover:underline disabled:pointer-events-none disabled:opacity-45"
        >
          Limpar
        </button>
      </div>

      <fieldset disabled={disabled}>
        <legend className="eyebrow text-foreground">Categoria</legend>
        <div className="mt-3 space-y-0.5">
          <button
            type="button"
            onClick={() => selectType(null)}
            aria-pressed={filters.tipo === null}
            className={cn(
              "flex w-full items-center justify-between gap-3 rounded-sm px-2 py-2 text-left text-sm transition-colors hover:bg-secondary/60",
              filters.tipo === null && "bg-secondary/80 font-medium text-forest",
            )}
          >
            <span>Todos os equipamentos</span>
            {facets ? (
              <span className="text-xs tabular-nums text-muted-foreground">
                {facetTotal(facets)}
              </span>
            ) : null}
          </button>

          {EQUIPMENT_TYPE_ORDER.map((type) => {
            const total =
              facets?.tipos.find((item) => item.valor === type)?.total ?? 0;
            return (
              <button
                key={type}
                type="button"
                onClick={() => selectType(type)}
                aria-pressed={filters.tipo === type}
                className={cn(
                  "flex w-full items-center justify-between gap-3 rounded-sm px-2 py-2 text-left text-sm transition-colors hover:bg-secondary/60",
                  filters.tipo === type && "bg-secondary/80 font-medium text-forest",
                  total === 0 && filters.tipo !== type && "opacity-50",
                )}
              >
                <span>{EQUIPMENT_TYPE_LABELS[type].plural}</span>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {total}
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>

      {showWeapons ? (
        <fieldset disabled={disabled}>
          <legend className="eyebrow text-foreground">Tipo de arma</legend>
          <div className="mt-3 space-y-0.5">
            {(["simples", "marcial"] as WeaponKind[]).map((kind) => {
              const checked = filters.armas.includes(kind);
              const total = weaponKindCounts.get(kind) ?? 0;
              return (
                <label
                  key={kind}
                  htmlFor={`arma-${kind}`}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-sm px-2 py-2 text-sm transition-colors hover:bg-secondary/60",
                    checked && "bg-secondary/80 font-medium",
                    total === 0 && !checked && "opacity-50",
                  )}
                >
                  <Checkbox
                    id={`arma-${kind}`}
                    checked={checked}
                    disabled={total === 0 && !checked}
                    onCheckedChange={() =>
                      toggleListValue("arma", kind, filters.armas)
                    }
                  />
                  <span className="flex-1">{WEAPON_KIND_LABELS[kind]}</span>
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {total}
                  </span>
                </label>
              );
            })}

            {(["corpo-a-corpo", "distancia"] as WeaponRange[]).map((range) => {
              const checked = filters.alcances.includes(range);
              const total = weaponRangeCounts.get(range) ?? 0;
              return (
                <label
                  key={range}
                  htmlFor={`alcance-${range}`}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-sm px-2 py-2 text-sm transition-colors hover:bg-secondary/60",
                    checked && "bg-secondary/80 font-medium",
                    total === 0 && !checked && "opacity-50",
                  )}
                >
                  <Checkbox
                    id={`alcance-${range}`}
                    checked={checked}
                    disabled={total === 0 && !checked}
                    onCheckedChange={() =>
                      toggleListValue("alcance", range, filters.alcances)
                    }
                  />
                  <span className="flex-1">{WEAPON_RANGE_LABELS[range]}</span>
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {total}
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
      ) : null}

      {showArmor ? (
        <fieldset disabled={disabled}>
          <legend className="eyebrow text-foreground">Tipo de armadura</legend>
          <div className="mt-3 space-y-0.5">
            {(Object.keys(ARMOR_FILTER_LABELS) as ArmorFilter[]).map((armor) => {
              const checked = filters.armaduras.includes(armor);
              const total = armorCounts.get(ARMOR_FILTER_VALUES[armor]) ?? 0;
              return (
                <label
                  key={armor}
                  htmlFor={`armadura-${armor}`}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-sm px-2 py-2 text-sm transition-colors hover:bg-secondary/60",
                    checked && "bg-secondary/80 font-medium",
                    total === 0 && !checked && "opacity-50",
                  )}
                >
                  <Checkbox
                    id={`armadura-${armor}`}
                    checked={checked}
                    disabled={total === 0 && !checked}
                    onCheckedChange={() =>
                      toggleListValue("armadura", armor, filters.armaduras)
                    }
                  />
                  <span className="flex-1">{ARMOR_FILTER_LABELS[armor]}</span>
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {total}
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
      ) : null}

      <div className="rounded-md border border-gold/25 bg-parchment/70 p-4">
        <p className="text-sm font-medium text-forest">Antes de equipar</p>
        <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
          Custo e peso são exibidos como na fonte. Consulte as propriedades e as
          regras de treinamento antes de escolher seu equipamento.
        </p>
      </div>
    </div>
  );
}

export function EquipmentFilters({
  facets,
  filters,
  currentSearch,
}: {
  facets: EquipmentFacets | null;
  filters: EquipmentFilters;
  currentSearch: string;
}) {
  const [open, setOpen] = useState(false);
  const active = activeFilterCount(filters);

  return (
    <>
      <aside aria-label="Filtros do catálogo de equipamentos" className="hidden lg:block">
        <div className="sticky top-6">
          <FilterPanel facets={facets} filters={filters} currentSearch={currentSearch} />
        </div>
      </aside>

      <div className="min-w-0 lg:hidden">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger
            render={
              <Button
                variant="outline"
                className="h-11 w-full justify-between border-border bg-card px-4 text-foreground"
              />
            }
          >
            <span className="inline-flex min-w-0 items-center gap-2">
              <SlidersHorizontal className="size-4 shrink-0 text-forest" aria-hidden="true" />
              <span className="truncate">Filtrar equipamentos</span>
            </span>
            <span className="inline-flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
              <span className="hidden sm:inline">
                {active > 0
                  ? `${active} ativo${active > 1 ? "s" : ""}`
                  : "Categoria, arma e armadura"}
              </span>
              {active > 0 ? <span className="sm:hidden">{active}</span> : null}
              <ChevronDown className="size-4" aria-hidden="true" />
            </span>
          </SheetTrigger>
          <SheetContent
            side="left"
            className="w-[min(92vw,360px)] overflow-y-auto bg-background px-5 pb-8"
          >
            <SheetHeader className="px-0 pt-2">
              <SheetTitle className="sr-only">Filtros de equipamentos</SheetTitle>
              <SheetDescription className="sr-only">
                Refine os equipamentos por categoria, tipo de arma e tipo de armadura.
              </SheetDescription>
            </SheetHeader>
            <FilterPanel
              facets={facets}
              filters={filters}
              currentSearch={currentSearch}
              onNavigate={() => setOpen(false)}
            />
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}

export { activeFilterCount };
