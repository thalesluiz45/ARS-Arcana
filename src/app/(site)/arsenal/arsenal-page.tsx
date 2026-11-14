"use client";

import Link from "next/link";
import {
  Backpack,
  ChevronDown,
  LibraryBig,
  LogIn,
  Package,
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
import {
  MochilaDialogs,
  type MochilaDialogState,
} from "@/components/mochila-dialogs";
import { MochilaSidebar } from "@/components/mochila-sidebar";
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
import type { Mochila } from "@/lib/validation/mochila";
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

function buildArsenalHref({
  collection,
  query,
}: {
  collection: string;
  query: string;
}): string {
  const params = new URLSearchParams();
  if (collection !== "todas") params.set("mochila", collection);
  const term = query.trim();
  if (term) params.set("q", term);
  const queryString = params.toString();
  return queryString ? `/arsenal?${queryString}` : "/arsenal";
}

export function ArsenalPage({
  initialQuery,
  initialCollection,
}: {
  initialQuery: string;
  initialCollection: string;
}) {
  const {
    status,
    error,
    items,
    totalUnique,
    mochilas,
    reserved,
    snapshot,
    refresh,
  } = useArsenalData();
  const [query, setQuery] = useState(initialQuery);
  const [collection, setCollection] = useState(initialCollection);
  const [tipo, setTipo] = useState<EquipmentType | null>(null);
  const [page, setPage] = useState(1);
  const [dialog, setDialog] = useState<MochilaDialogState>(null);
  const [mobileCollectionOpen, setMobileCollectionOpen] = useState(false);
  const resultsRef = useRef<HTMLDivElement>(null);

  const reservedId = reserved?.id ?? null;
  const collectionExists =
    collection === "todas" ||
    (reservedId !== null && collection === reservedId) ||
    mochilas.some((mochila) => mochila.id === collection);
  const activeCollection =
    status === "ready" && !collectionExists ? "todas" : collection;

  const activeMochila = useMemo(
    () => mochilas.find((mochila) => mochila.id === activeCollection) ?? null,
    [mochilas, activeCollection],
  );

  const activeSlugs = useMemo(() => {
    if (activeCollection === "todas") return null;
    return new Set(
      (snapshot?.associations ?? [])
        .filter((association) => association.listaId === activeCollection)
        .map((association) => association.equipamentoSlug),
    );
  }, [snapshot, activeCollection]);

  const collectionItems = useMemo(
    () =>
      activeSlugs
        ? items.filter((item) => activeSlugs.has(item.slug))
        : items,
    [items, activeSlugs],
  );

  useEffect(() => {
    setPage(1);
  }, [query, tipo, activeCollection]);

  useEffect(() => {
    if (status !== "ready") return;
    const canonical = buildArsenalHref({ collection: activeCollection, query });
    const current = `${window.location.pathname}${window.location.search}`;
    if (current !== canonical) {
      window.history.replaceState(null, "", canonical);
    }
  }, [activeCollection, query, status]);

  const typeCounts = useMemo(() => {
    const counts = new Map<EquipmentType, number>();
    for (const item of collectionItems) {
      counts.set(item.tipo, (counts.get(item.tipo) ?? 0) + 1);
    }
    return counts;
  }, [collectionItems]);

  const filtered = useMemo(
    () =>
      collectionItems.filter(
        (item) =>
          (tipo === null || item.tipo === tipo) && matchesSearch(searchHaystacks(item), query),
      ),
    [collectionItems, query, tipo],
  );

  const pageCount = Math.max(1, Math.ceil(filtered.length / ARSENAL_PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageStart = (currentPage - 1) * ARSENAL_PAGE_SIZE;
  const visibleItems = filtered.slice(pageStart, pageStart + ARSENAL_PAGE_SIZE);
  const rangeStart = filtered.length > 0 ? pageStart + 1 : 0;
  const rangeEnd = Math.min(pageStart + ARSENAL_PAGE_SIZE, filtered.length);
  const hasActiveFilters = query.trim() !== "" || tipo !== null;
  const isReserved = reservedId !== null && activeCollection === reservedId;

  const title =
    activeCollection === "todas"
      ? "Todos os equipamentos salvos"
      : isReserved
        ? "Sem mochila"
        : (activeMochila?.nome ?? "Equipamentos salvos");

  const subtitle =
    status === "ready"
      ? hasActiveFilters
        ? `Mostrando ${rangeStart}–${rangeEnd} de ${filtered.length} ${
            filtered.length === 1 ? "item" : "itens"
          }`
        : activeCollection === "todas"
          ? `${totalUnique} ${
              totalUnique === 1 ? "equipamento salvo" : "equipamentos salvos"
            } no seu Arsenal`
          : `${collectionItems.length} ${
              collectionItems.length === 1 ? "equipamento" : "equipamentos"
            } nesta mochila`
      : "Sua coleção pessoal de equipamentos";

  function selectCollection(id: string) {
    setCollection(id);
    setPage(1);
    setMobileCollectionOpen(false);
  }

  function openDialog(next: MochilaDialogState) {
    setMobileCollectionOpen(false);
    setDialog(next);
  }

  function handleCreated(created: Mochila) {
    setCollection(created.id);
    setPage(1);
  }

  function handleDeleted(id: string) {
    if (activeCollection === id || collection === id) {
      setCollection("todas");
      setPage(1);
    }
  }

  const sidebar = (
    <MochilaSidebar
      selectedId={activeCollection}
      onSelect={selectCollection}
      onCreate={() => openDialog({ type: "create" })}
      onRename={(mochila) => openDialog({ type: "rename", mochila })}
      onDelete={(mochila) => openDialog({ type: "delete", mochila })}
      onNavigate={() => setMobileCollectionOpen(false)}
    />
  );

  return (
    <>
      <PageHero
        eyebrow="Seu acervo"
        title="Seu Arsenal, pronto para a batalha."
        description="Organize os equipamentos que você salvou em mochilas e prepare a próxima aventura."
      />

      <section className="container-page py-8 sm:py-10">
        <ArsenalSearchBar value={query} onChange={setQuery} />

        <div className="mt-8 grid items-start gap-8 lg:grid-cols-[250px_minmax(0,1fr)] xl:gap-10">
          <div className="hidden lg:block">{sidebar}</div>

          <div className="min-w-0">
            <div className="mb-5 lg:hidden">
              <Button
                type="button"
                variant="outline"
                onClick={() => setMobileCollectionOpen((current) => !current)}
                aria-expanded={mobileCollectionOpen}
                aria-controls="minhas-mochilas-mobile"
                className="h-10 gap-2 border-border bg-card px-3.5 text-forest"
              >
                <LibraryBig className="size-4" aria-hidden="true" />
                Minhas mochilas
                <ChevronDown
                  className={cn(
                    "size-4 transition-transform",
                    mobileCollectionOpen && "rotate-180",
                  )}
                  aria-hidden="true"
                />
              </Button>

              {mobileCollectionOpen ? (
                <div id="minhas-mochilas-mobile" className="surface-card mt-3 px-4 py-5">
                  {sidebar}
                </div>
              ) : null}
            </div>

            <div className="mt-6" ref={resultsRef}>
              <div className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2.5">
                    {activeCollection === "todas" ? (
                      <Swords
                        className="size-4 shrink-0 text-gold"
                        strokeWidth={1.6}
                        aria-hidden="true"
                      />
                    ) : (
                      <Package
                        className="size-4 shrink-0 text-gold"
                        strokeWidth={1.6}
                        aria-hidden="true"
                      />
                    )}
                    <h2 className="text-[1.9rem] leading-none text-forest">{title}</h2>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>
                </div>

                {status === "ready" && collectionItems.length > 0 ? (
                  <div
                    className="flex flex-wrap items-center gap-1.5"
                    aria-label="Filtrar por categoria"
                  >
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
                      Todos ({collectionItems.length})
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
                  description="As mochilas ficam associadas à sua conta Google e podem ser consultadas em qualquer dispositivo."
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
                  description="Explore o catálogo de equipamentos e use o marcador para guardar armas, armaduras e itens de aventura em uma mochila."
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
            ) : collectionItems.length === 0 ? (
              <div className="mt-6">
                <StatePanel
                  icon={Package}
                  eyebrow="Mochila vazia"
                  title={
                    isReserved ? "Sem mochila está vazia." : "Esta mochila ainda está vazia."
                  }
                  description="Salve equipamentos do catálogo e marque esta mochila no organizador para reuni-los aqui. Seus outros itens continuam disponíveis nas demais mochilas."
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
                      ? `Sua busca por “${query.trim()}” não encontrou equipamentos nesta mochila. Tente outro termo ou limpe os filtros.`
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
                    from={buildArsenalHref({
                      collection: activeCollection,
                      query,
                    })}
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
                O Arsenal é uma coleção pessoal de equipamentos salvos, organizada em
                mochilas. Quantidades, personagens e inventários não fazem parte desta
                coleção.
              </p>
            ) : null}
          </div>
        </div>
      </section>

      <MochilaDialogs
        state={dialog}
        onOpenChange={(open) => {
          if (!open) setDialog(null);
        }}
        onCreated={handleCreated}
        onDeleted={handleDeleted}
      />
    </>
  );
}
