"use client";

import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";

import type { CatalogSort } from "@/lib/validation/catalog";

const SORT_LABELS: Record<CatalogSort, string> = {
  "nome-asc": "Nome (A-Z)",
  "nome-desc": "Nome (Z-A)",
  "circulo-asc": "Círculo (crescente)",
  "circulo-desc": "Círculo (decrescente)",
};

export const SORT_OPTIONS = Object.entries(SORT_LABELS) as [CatalogSort, string][];

export function SortSelect({
  id,
  value,
  onChange,
}: {
  id: string;
  value: CatalogSort;
  onChange: (value: CatalogSort) => void;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <label htmlFor={id} className="whitespace-nowrap text-sm text-muted-foreground">
        Ordenar por:
      </label>
      <div className="relative">
        <select
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value as CatalogSort)}
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

export function SpellSort({
  value,
  currentSearch,
}: {
  value: CatalogSort;
  currentSearch: string;
}) {
  const router = useRouter();

  return (
    <SortSelect
      id="ordenar-magias"
      value={value}
      onChange={(next) => {
        const params = new URLSearchParams(currentSearch);
        if (next === "nome-asc") params.delete("sort");
        else params.set("sort", next);
        params.delete("page");
        params.delete("cursor");
        const query = params.toString();
        router.push(query ? `/?${query}` : "/");
      }}
    />
  );
}
