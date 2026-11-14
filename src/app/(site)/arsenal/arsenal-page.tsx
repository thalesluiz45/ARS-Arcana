"use client";

import Link from "next/link";
import {
  Backpack,
  LogIn,
  RotateCcw,
  SearchX,
  Swords,
  TriangleAlert,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { useArsenalData } from "@/components/arsenal-data-provider";
import { ArsenalSearchBar } from "@/components/equipment-search";
import { EquipmentSection, groupEquipmentByType } from "@/components/equipment-section";
import { LoadingPanel } from "@/components/loading-panel";
import { PageHero } from "@/components/page-hero";
import { Pagination } from "@/components/pagination";
import { StatePanel } from "@/components/state-panel";
import { Button } from "@/components/ui/button";
import { loginHref } from "@/lib/auth/redirect";
import { matchesSearch } from "@/lib/search";
import {
  EQUIPMENT_TYPE_LABELS,
  EQUIPMENT_TYPE_ORDER,
  equipmentTypeLabel,
  type Equipment,
  type EquipmentType,
} from "@/lib/validation/equipment";
import { cn } from "@/lib/utils";

const ARSENAL_PAGE_SIZE = 9;

function searchHaystacks(equipment: Equipment): string[] {
  const values = [equipment.nome, equipment.custo, equipmentTypeLabel(equipment)];

  if (equipment.tipo !== "aventura") values.push(equipment.categoria);
  if ("descricao" in equipment) values.push(equipment.descricao);
  if (equipment.tipo === "arma") {
    values.push(
      equipment.dano,
      equipment.tipoDano,
      equipment.maestria,
      ...equipment.propriedades,
    );
  }
  if (equipment.tipo === "armadura") {
    values.push(
      equipment.classeArmadura,
      equipment.forca ?? "",
      equipment.furtividade ?? "",
    );
  }
  if (equipment.tipo === "ferramenta") values.push(equipment.atributo);

  return values;
}

export function ArsenalPage({ initialQuery }: { initialQuery: string }) {
  const { status, error, items, total, refresh } = useArsenalData();
  const [query, setQuery] = useState(initialQuery);
  const [tipo, setTipo] = useState<EquipmentType | null>(null);
  const [page, setPage] = useState(1);
  const resultsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setPage(1);
  }, [query, tipo]);

  const typeCounts = useMemo(() => {
    const counts = new Map<EquipmentType, number>();
    for (const item of items) {
      counts.set(item.tipo, (counts.get(item.tipo) ?? 0) + 1);
    }
    return counts;
  }, [items]);

  const filtered = useMemo(
    () =>
      items.filter(
        (item) =>
          (tipo === null || item.tipo === tipo) &&
          matchesSearch(searchHaystacks(item), query),
      ),
    [items, query, tipo],
  );

  const pageCount = Math.max(1, Math.ceil(filtered.length / ARSENAL_PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageStart = (currentPage - 1) * ARSENAL_PAGE_SIZE;
  const visibleItems = filtered.slice(pageStart, pageStart + ARSENAL_PAGE_SIZE);
  const rangeStart = filtered.length > 0 ? pageStart + 1 : 0;
  const rangeEnd = Math.min(pageStart + ARSENAL_PAGE_SIZE, filtered.length);
  const hasActiveFilters = query.trim() !== "" || tipo !== null;

  return (
    <>
      <PageHero
        eyebrow="Seu acervo"
        title="Seu Arsenal, pronto para a batalha."
        description="Os equipamentos que você salvou, reunidos para consultar e preparar a próxima aventura."
      />

      <section className="container-page py-8 sm:py-10">
        <ArsenalSearchBar value={query} onChange={setQuery} />

        <div className="mt-6" ref={resultsRef}>
          <div className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="flex items-center gap-2.5">
                <Swords
                  className="size-4 text-gold"
                  strokeWidth={1.6}
                  aria-hidden="true"
                />
                <h2 className="text-[1.9rem] leading-none text-forest">
                  Itens salvos
                </h2>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                {status === "ready"
                  ? hasActiveFilters
                    ? `Mostrando ${rangeStart}–${rangeEnd} de ${filtered.length} ${
                        filtered.length === 1 ? "item" : "itens"
                      }`
                    : `${total} ${total === 1 ? "equipamento salvo" : "equipamentos salvos"} no seu Arsenal`
                  : "Sua coleção pessoal de equipamentos"}
              </p>
            </div>

            {status === "ready" && items.length > 0 ? (
              <div className="flex flex-wrap items-center gap-1.5" aria-label="Filtrar por categoria">
                <button
                  type="button"
                  onClick={() => setTipo(null)}
                  aria-pressed={tipo === null}
                  className={cn(
                    "rounded-sm border px-3 py-1.5 text-xs font-medium transition-colors",
                    tipo === null
                      ? "border-forest bg-forest text-[#f8f1df]"
                      : "border-border bg-card text-foreground hover:bg-secondary",
                  )}
                >
                  Todos ({items.length})
                </button>
                {EQUIPMENT_TYPE_ORDER.map((type) => {
                  const count = typeCounts.get(type) ?? 0;
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setTipo(type)}
                      disabled={count === 0}
                      aria-pressed={tipo === type}
                      className={cn(
                        "rounded-sm border px-3 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40",
                        tipo === type
                          ? "border-forest bg-forest text-[#f8f1df]"
                          : "border-border bg-card text-foreground hover:bg-secondary",
                      )}
                    >
                      {EQUIPMENT_TYPE_LABELS[type].plural} ({count})
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>
        </div>

        {status === "loading" ? (
          <LoadingPanel
            className="mt-6"
            label="Carregando seu Arsenal…"
            description="Buscando os equipamentos salvos na sua conta."
          />
        ) : status === "unauthenticated" ? (
          <div className="mt-6">
            <StatePanel
              icon={LogIn}
              eyebrow="Sessão necessária"
              title="Entre para acessar o seu Arsenal."
              description="O Arsenal fica associado à sua conta Google e pode ser consultado em qualquer dispositivo."
              actions={
                <Button
                  render={<Link href={loginHref("/arsenal")} />}
                  className="bg-forest text-[#f8f1df] hover:bg-forest-deep"
                >
                  <LogIn className="size-4" aria-hidden="true" />
                  Entrar com Google
                </Button>
              }
            />
          </div>
        ) : status === "error" ? (
          <div className="mt-6">
            <StatePanel
              icon={TriangleAlert}
              tone="error"
              eyebrow="Arsenal indisponível"
              title="Não foi possível abrir o seu Arsenal."
              description={
                error ??
                "O servidor não respondeu. Seus itens salvos não foram apagados."
              }
              actions={
                <Button
                  onClick={() => void refresh()}
                  className="bg-forest text-[#f8f1df] hover:bg-forest-deep"
                >
                  <RotateCcw className="size-4" aria-hidden="true" />
                  Tentar novamente
                </Button>
              }
            />
          </div>
        ) : items.length === 0 ? (
          <div className="mt-6">
            <StatePanel
              icon={Backpack}
              eyebrow="Arsenal vazio"
              title="Seu Arsenal ainda está vazio."
              description="Explore o catálogo de equipamentos e use o marcador para guardar armas, armaduras e itens de aventura na sua conta."
              actions={
                <Button
                  render={<Link href="/equipamento" />}
                  className="bg-forest text-[#f8f1df] hover:bg-forest-deep"
                >
                  <Swords className="size-4" aria-hidden="true" />
                  Explorar equipamentos
                </Button>
              }
            />
          </div>
        ) : filtered.length === 0 ? (
          <div className="mt-6">
            <StatePanel
              icon={SearchX}
              eyebrow="Sem resultados"
              title="Nenhum item encontrado no Arsenal."
              description={
                query.trim()
                  ? `Sua busca por “${query.trim()}” não encontrou equipamentos salvos. Tente outro termo ou limpe os filtros.`
                  : "Não há itens salvos nesta categoria. Selecione outra categoria ou limpe os filtros."
              }
              actions={
                <Button
                  onClick={() => {
                    setQuery("");
                    setTipo(null);
                  }}
                  className="bg-forest text-[#f8f1df] hover:bg-forest-deep"
                >
                  Limpar filtros
                </Button>
              }
            />
          </div>
        ) : (
          <>
            {groupEquipmentByType(visibleItems).map((group) => (
              <EquipmentSection
                key={group.type}
                type={group.type}
                items={group.items}
                from="/arsenal"
              />
            ))}

            <div className="mt-8 flex flex-col items-center justify-between gap-4 border-t border-border pt-5 sm:flex-row">
              <p className="text-xs text-muted-foreground">
                Mostrando {rangeStart}–{rangeEnd} de {filtered.length}{" "}
                {filtered.length === 1 ? "item" : "itens"}
              </p>
              <Pagination
                currentPage={currentPage}
                pageCount={pageCount}
                hrefForPage={(target) => `#arsenal-pagina-${target}`}
                onPageChange={(target) => {
                  setPage(target);
                  resultsRef.current?.scrollIntoView({ block: "start" });
                }}
                label="Paginação do Arsenal"
              />
            </div>
          </>
        )}

        {status === "ready" && items.length > 0 ? (
          <p className="mt-10 border-t border-border pt-4 text-xs leading-relaxed text-muted-foreground">
            O Arsenal é uma lista pessoal de equipamentos salvos. Quantidades,
            personagens e inventários não fazem parte desta coleção.
          </p>
        ) : null}
      </section>
    </>
  );
}
