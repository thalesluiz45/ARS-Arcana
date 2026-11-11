"use client";

import { useRouter } from "next/navigation";
import { ChevronDown, SlidersHorizontal } from "lucide-react";
import { useMemo, useState } from "react";

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
import type { CatalogFacets, CatalogFilters } from "@/lib/validation/catalog";
import { cn } from "@/lib/utils";

function activeFilterCount(filters: CatalogFilters): number {
  return (
    filters.tipos.length +
    filters.classes.length +
    (filters.circulo !== null ? 1 : 0) +
    (filters.q ? 1 : 0)
  );
}

type FilterPanelProps = {
  facets: CatalogFacets | null;
  filters: CatalogFilters;
  currentSearch: string;
  onNavigate?: () => void;
};

function FilterPanel({ facets, filters, currentSearch, onNavigate }: FilterPanelProps) {
  const router = useRouter();
  const disabled = !facets;

  const schoolCounts = useMemo(
    () => new Map(facets?.escolas.map((item) => [item.valor, item.total]) ?? []),
    [facets],
  );

  function navigate(update: (params: URLSearchParams) => void) {
    const params = new URLSearchParams(currentSearch);
    update(params);
    params.delete("page");
    params.delete("cursor");
    const query = params.toString();
    router.push(query ? `/?${query}` : "/");
    onNavigate?.();
  }

  function toggleSchool(school: string) {
    const selected = new Set(filters.tipos);
    if (selected.has(school)) selected.delete(school);
    else selected.add(school);
    navigate((params) => {
      params.delete("tipo");
      params.delete("tipos");
      for (const value of selected) params.append("tipo", value);
    });
  }

  function clearAll() {
    router.push("/");
    onNavigate?.();
  }

  const hasActiveFilters = activeFilterCount(filters) > 0;

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
        <legend className="eyebrow text-foreground">Classe</legend>
        <div className="relative mt-3">
          <label htmlFor="filtro-classe" className="sr-only">
            Filtrar por classe
          </label>
          <select
            id="filtro-classe"
            value={filters.classes[0] ?? ""}
            onChange={(event) => {
              const value = event.target.value;
              navigate((params) => {
                params.delete("classe");
                params.delete("classes");
                if (value) params.set("classe", value);
              });
            }}
            className="h-11 w-full appearance-none rounded-md border border-border bg-card px-3 pr-9 text-sm text-foreground shadow-[0_1px_0_rgb(255_255_255/0.6)_inset] transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 disabled:opacity-50"
          >
            <option value="">Todas as classes</option>
            {facets?.classes.map((item) => (
              <option key={item.valor} value={item.valor}>
                {item.valor} ({item.total})
              </option>
            ))}
          </select>
          <ChevronDown
            className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
        </div>
      </fieldset>

      <fieldset disabled={disabled}>
        <legend className="eyebrow text-foreground">Círculo da magia</legend>
        <div className="mt-3 grid grid-cols-4 gap-2">
          <button
            type="button"
            onClick={() => navigate((params) => params.delete("circulo"))}
            aria-pressed={filters.circulo === null}
            className={cn(
              "col-span-2 h-10 rounded-md border text-sm transition-colors",
              filters.circulo === null
                ? "border-forest bg-forest font-medium text-[#f8f1df]"
                : "border-border bg-card text-foreground hover:bg-secondary",
            )}
          >
            Todos
          </button>
          {Array.from({ length: 10 }, (_, circle) => circle).map((circle) => (
            <button
              key={circle}
              type="button"
              onClick={() => navigate((params) => params.set("circulo", String(circle)))}
              aria-pressed={filters.circulo === circle}
              aria-label={circle === 0 ? "Círculo 0: truques" : `Círculo ${circle}`}
              className={cn(
                "h-10 rounded-md border text-sm tabular-nums transition-colors",
                filters.circulo === circle
                  ? "border-forest bg-forest font-medium text-[#f8f1df]"
                  : "border-border bg-card text-foreground hover:bg-secondary",
              )}
            >
              {circle}
            </button>
          ))}
        </div>
        <p className="mt-2 text-[0.7rem] leading-relaxed text-muted-foreground">
          O círculo 0 representa os truques.
        </p>
      </fieldset>

      <fieldset disabled={disabled}>
        <legend className="eyebrow text-foreground">Escola de magia</legend>
        <div className="mt-3 space-y-0.5">
          <label
            htmlFor="escola-todas"
            className={cn(
              "flex cursor-pointer items-center gap-3 rounded-sm px-2 py-2 text-sm transition-colors hover:bg-secondary/60",
              filters.tipos.length === 0 && "bg-secondary/80 font-medium",
            )}
          >
            <Checkbox
              id="escola-todas"
              checked={filters.tipos.length === 0}
              onCheckedChange={() => navigate((params) => {
                params.delete("tipo");
                params.delete("tipos");
              })}
            />
            <span className="flex-1">Todas as escolas</span>
            {facets ? (
              <span className="text-xs tabular-nums text-muted-foreground">
                {facets.escolas.reduce((total, item) => total + item.total, 0)}
              </span>
            ) : null}
          </label>
          {facets?.escolas.map((item) => {
            const checked = filters.tipos.includes(item.valor);
            return (
              <label
                key={item.valor}
                htmlFor={`escola-${item.valor}`}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-sm px-2 py-2 text-sm transition-colors hover:bg-secondary/60",
                  checked && "bg-secondary/80 font-medium",
                )}
              >
                <Checkbox
                  id={`escola-${item.valor}`}
                  checked={checked}
                  onCheckedChange={() => toggleSchool(item.valor)}
                />
                <span className="flex-1">{item.valor}</span>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {schoolCounts.get(item.valor) ?? 0}
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="rounded-md border border-gold/25 bg-parchment/70 p-4">
        <p className="text-sm font-medium text-forest">Seu grimório espera</p>
        <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
          Salve magias favoritas e organize tudo para a próxima sessão.
        </p>
      </div>
    </div>
  );
}

export function SpellFilters({
  facets,
  filters,
  currentSearch,
}: {
  facets: CatalogFacets | null;
  filters: CatalogFilters;
  currentSearch: string;
}) {
  const [open, setOpen] = useState(false);
  const active = activeFilterCount(filters);

  return (
    <>
      <aside aria-label="Filtros da biblioteca" className="hidden lg:block">
        <div className="sticky top-6">
          <FilterPanel facets={facets} filters={filters} currentSearch={currentSearch} />
        </div>
      </aside>

      <div className="lg:hidden">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger
            render={
              <Button
                variant="outline"
                className="h-11 w-full justify-between border-border bg-card px-4 text-foreground"
              />
            }
          >
            <span className="inline-flex items-center gap-2">
              <SlidersHorizontal className="size-4 text-forest" aria-hidden="true" />
              Filtrar busca
            </span>
            <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
              {active > 0 ? `${active} ativo${active > 1 ? "s" : ""}` : "Classe, círculo e escola"}
              <ChevronDown className="size-4" aria-hidden="true" />
            </span>
          </SheetTrigger>
          <SheetContent side="left" className="w-[min(92vw,360px)] overflow-y-auto bg-background px-5 pb-8">
            <SheetHeader className="px-0 pt-2">
              <SheetTitle className="sr-only">Filtros da biblioteca</SheetTitle>
              <SheetDescription className="sr-only">
                Refine as magias por classe, círculo e escola.
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
