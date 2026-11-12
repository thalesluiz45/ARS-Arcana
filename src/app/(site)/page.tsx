import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Library, RotateCcw, SearchX, TriangleAlert } from "lucide-react";

import { PageHero } from "@/components/page-hero";
import { Pagination } from "@/components/pagination";
import { SpellCard } from "@/components/spell-card";
import { CatalogSearchBar } from "@/components/spell-search";
import { SpellFilters } from "@/components/spell-filters";
import { SpellSort } from "@/components/spell-sort";
import { StatePanel } from "@/components/state-panel";
import { Button } from "@/components/ui/button";
import {
  describeCatalogFailure,
  type CatalogFailure,
} from "@/lib/catalog/errors";
import { catalogRepository } from "@/lib/catalog/repository";
import {
  catalogFiltersToSearchParams,
  parseCatalogFilters,
  type CatalogPage,
} from "@/lib/validation/catalog";

export const metadata: Metadata = {
  title: "Biblioteca de magias",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function pageHref(
  filters: ReturnType<typeof parseCatalogFilters>,
  page: number,
): string {
  const params = catalogFiltersToSearchParams(filters);
  if (page > 1) params.set("page", String(page));
  else params.delete("page");
  params.delete("cursor");
  const query = params.toString();
  return query ? `/?${query}` : "/";
}

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const resolvedSearchParams = await searchParams;
  const filters = parseCatalogFilters(resolvedSearchParams);
  const currentSearch = catalogFiltersToSearchParams(filters).toString();

  let page: CatalogPage | null = null;
  let failure: CatalogFailure | null = null;

  try {
    page = await catalogRepository.searchSpells(filters);
  } catch (error) {
    failure = describeCatalogFailure(error);
    console.error("[biblioteca] falha ao carregar o catálogo:", error);
  }

  if (page && page.total > 0 && filters.page > page.pageCount) {
    redirect(pageHref(filters, page.pageCount));
  }

  const rangeStart =
    page && page.items.length > 0 ? (page.page - 1) * page.pageSize + 1 : 0;
  const rangeEnd =
    page && page.items.length > 0 ? rangeStart + page.items.length - 1 : 0;
  const retryHref = currentSearch ? `/?${currentSearch}` : "/";

  return (
    <>
      <PageHero
        eyebrow="D&D • 5.5"
        title="A magia está em suas mãos."
        description="Explore e descubra magias para o seu RPG."
      />

      <section className="container-page py-8 sm:py-10">
        <CatalogSearchBar
          initialQuery={filters.q}
          currentSearch={currentSearch}
        />

        {failure ? (
          <div className="mt-8">
            <StatePanel
              icon={TriangleAlert}
              tone="error"
              eyebrow="Catálogo indisponível"
              title="Não foi possível carregar as magias."
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
            <SpellFilters
              facets={page?.facets ?? null}
              filters={filters}
              currentSearch={currentSearch}
            />

            <div className="min-w-0">
              <div className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <div className="flex items-center gap-2.5">
                    <Library
                      className="size-4 text-gold"
                      strokeWidth={1.6}
                      aria-hidden="true"
                    />
                    <h2 className="text-[1.9rem] leading-none text-forest">
                      Biblioteca de magias
                    </h2>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {page && page.total > 0
                      ? `${page.total} ${page.total === 1 ? "magia" : "magias"} para a sua próxima aventura`
                      : "Nenhuma magia corresponde à sua busca"}
                  </p>
                </div>
                <SpellSort value={filters.sort} currentSearch={currentSearch} />
              </div>

              {page && page.items.length > 0 ? (
                <>
                  <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                    {page.items.map((spell) => (
                      <SpellCard
                        key={spell.id}
                        spell={spell}
                        from={currentSearch ? `/?${currentSearch}` : "/"}
                      />
                    ))}
                  </div>

                  <div className="mt-8 flex flex-col items-center justify-between gap-4 border-t border-border pt-5 sm:flex-row">
                    <p className="text-xs text-muted-foreground">
                      Mostrando {rangeStart}–{rangeEnd} de {page.total}
                    </p>
                    <Pagination
                      currentPage={page.page}
                      pageCount={page.pageCount}
                      hrefForPage={(targetPage) =>
                        pageHref(filters, targetPage)
                      }
                    />
                  </div>
                </>
              ) : page ? (
                <div className="mt-6">
                  <StatePanel
                    icon={SearchX}
                    eyebrow="Sem resultados"
                    title="Nenhuma magia encontrada."
                    description="Não há magias com os filtros ou termos atuais. Limpe a busca para voltar ao catálogo completo."
                    actions={
                      <Button
                        render={<Link href="/" />}
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
      </section>
    </>
  );
}
