import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Backpack, RotateCcw, SearchX, TriangleAlert } from "lucide-react";

import { EquipmentFilters } from "@/components/equipment-filters";
import { EquipmentSearchBar } from "@/components/equipment-search";
import { EquipmentGrid, EquipmentSection, groupEquipmentByType } from "@/components/equipment-section";
import { EquipmentSort } from "@/components/equipment-sort";
import { PageHero } from "@/components/page-hero";
import { Pagination } from "@/components/pagination";
import { StatePanel } from "@/components/state-panel";
import { Button } from "@/components/ui/button";
import {
  describeEquipmentFailure,
  type EquipmentFailure,
} from "@/lib/equipment/errors";
import { equipmentRepository } from "@/lib/equipment/repository";
import {
  equipmentFiltersToSearchParams,
  parseEquipmentFilters,
  type EquipmentFilters as EquipmentFiltersType,
  type EquipmentPage,
} from "@/lib/validation/equipment";

export const metadata: Metadata = {
  title: "Equipamento",
  description:
    "Explore armas, armaduras, ferramentas e equipamentos de aventura para a sua próxima jornada.",
};

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function catalogHref(filters: EquipmentFiltersType, page?: number): string {
  const params = equipmentFiltersToSearchParams(filters);
  if (page !== undefined) {
    if (page > 1) params.set("page", String(page));
    else params.delete("page");
  }
  const query = params.toString();
  return query ? `/equipamento?${query}` : "/equipamento";
}

export default async function EquipamentoPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const resolvedSearchParams = await searchParams;
  const filters = parseEquipmentFilters(resolvedSearchParams);
  const currentSearch = equipmentFiltersToSearchParams(filters).toString();
  const from = currentSearch ? `/equipamento?${currentSearch}` : "/equipamento";

  let page: EquipmentPage | null = null;
  let failure: EquipmentFailure | null = null;

  try {
    page = await equipmentRepository.searchEquipment(filters);
  } catch (error) {
    failure = describeEquipmentFailure(error);
    console.error("[equipamento] falha ao carregar o catálogo:", error);
  }

  if (page && page.total > 0 && filters.page > page.pageCount) {
    redirect(catalogHref(filters, page.pageCount));
  }

  const rangeStart =
    page && page.items.length > 0 ? (page.page - 1) * page.pageSize + 1 : 0;
  const rangeEnd =
    page && page.items.length > 0 ? rangeStart + page.items.length - 1 : 0;
  const retryHref = currentSearch ? `/equipamento?${currentSearch}` : "/equipamento";
  const grouped = filters.sort === "categoria";

  return (
    <>
      <PageHero
        eyebrow="D&D • 5.5"
        title="Prepare-se para qualquer batalha."
        description="Encontre as armas e armaduras certas para a sua próxima aventura."
      />

      <section className="container-page py-8 sm:py-10">
        <EquipmentSearchBar initialQuery={filters.q} currentSearch={currentSearch} />

        {failure ? (
          <div className="mt-8">
            <StatePanel
              icon={TriangleAlert}
              tone="error"
              eyebrow="Catálogo indisponível"
              title="Não foi possível carregar os equipamentos."
              description={`${failure.message} Nenhum resultado vazio foi inventado: tente novamente assim que o catálogo estiver acessível.`}
              actions={
                <Button
                  render={<Link href={retryHref} />}
                  className="bg-forest text-[#f8f1df] hover:bg-forest-deep"
                >
                  <RotateCcw className="size-4" aria-hidden="true" />
                  Tentar novamente
                </Button>
              }
            />
          </div>
        ) : (
          <div className="mt-8 grid items-start gap-8 lg:grid-cols-[280px_minmax(0,1fr)] xl:gap-10">
            <EquipmentFilters
              facets={page?.facets ?? null}
              filters={filters}
              currentSearch={currentSearch}
            />

            <div className="min-w-0">
              <div className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <div className="flex items-center gap-2.5">
                    <Backpack
                      className="size-4 text-gold"
                      strokeWidth={1.6}
                      aria-hidden="true"
                    />
                    <h2 className="text-[1.9rem] leading-none text-forest">
                      Catálogo de equipamentos
                    </h2>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {page && page.total > 0
                      ? `${page.total} ${
                          page.total === 1 ? "equipamento" : "equipamentos"
                        } para a sua próxima aventura`
                      : "Nenhum equipamento corresponde à sua busca"}
                  </p>
                </div>
                <EquipmentSort value={filters.sort} currentSearch={currentSearch} />
              </div>

              {page && page.items.length > 0 ? (
                <>
                  {grouped ? (
                    groupEquipmentByType(page.items).map((group) => (
                      <EquipmentSection
                        key={group.type}
                        type={group.type}
                        items={group.items}
                        total={
                          page.typeTotals.find(
                            (entry) => entry.valor === group.type,
                          )?.total ?? group.items.length
                        }
                        from={from}
                      />
                    ))
                  ) : (
                    <EquipmentGrid items={page.items} from={from} />
                  )}

                  <div className="mt-8 flex flex-col items-center justify-between gap-4 border-t border-border pt-5 sm:flex-row">
                    <p className="text-xs text-muted-foreground">
                      Mostrando {rangeStart}–{rangeEnd} de {page.total}
                    </p>
                    <Pagination
                      currentPage={page.page}
                      pageCount={page.pageCount}
                      hrefForPage={(targetPage) =>
                        catalogHref(filters, targetPage)
                      }
                      label="Paginação do catálogo de equipamentos"
                    />
                  </div>
                </>
              ) : page ? (
                <div className="mt-6">
                  <StatePanel
                    icon={SearchX}
                    eyebrow="Sem resultados"
                    title="Nenhum equipamento encontrado."
                    description="Não há equipamentos com os filtros ou termos atuais. Limpe a busca para voltar ao catálogo completo."
                    actions={
                      <Button
                        render={<Link href="/equipamento" />}
                        className="bg-forest text-[#f8f1df] hover:bg-forest-deep"
                      >
                        Limpar filtros
                      </Button>
                    }
                  />
                </div>
              ) : null}
            </div>
          </div>
        )}

        <p className="mt-10 border-t border-border pt-4 text-xs leading-relaxed text-muted-foreground">
          Custo e peso são exibidos conforme a fonte. Consulte as propriedades e as
          regras de treinamento antes de escolher seu equipamento.
        </p>
      </section>
    </>
  );
}
