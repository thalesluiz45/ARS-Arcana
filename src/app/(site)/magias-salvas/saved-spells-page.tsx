"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  Bookmark,
  ChevronDown,
  Info,
  LibraryBig,
  Loader2,
  LogIn,
  RefreshCw,
  RotateCcw,
  SearchX,
  TriangleAlert,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import {
  GrimoireDialogs,
  type GrimoireDialogState,
} from "@/components/grimoire-dialogs";
import { GrimoireSidebar } from "@/components/grimoire-sidebar";
import { useGrimoireData } from "@/components/grimoire-data-provider";
import { PageHero } from "@/components/page-hero";
import { Pagination } from "@/components/pagination";
import { SpellCard, UnavailableSpellCard } from "@/components/spell-card";
import { SavedSearchBar } from "@/components/spell-search";
import { SpellSaveButton } from "@/components/spell-save-dialog";
import { SortSelect } from "@/components/spell-sort";
import { StatePanel } from "@/components/state-panel";
import { Button } from "@/components/ui/button";
import { matchesSearch } from "@/lib/search";
import { SAVED_PAGE_SIZE, type CatalogSort } from "@/lib/validation/catalog";
import type { Grimoire } from "@/lib/validation/grimoire";
import type { Spell } from "@/lib/validation/spell";
import { cn } from "@/lib/utils";
import { useSavedSpellSnapshots } from "./use-saved-spell-snapshots";

type SavedViewState = {
  collection: string;
  query: string;
  sort: CatalogSort;
  page: number;
};

type ReadyEntry = {
  id: string;
  spell: Spell | null;
};

function buildSavedHref({ collection, query, sort, page }: SavedViewState): string {
  const params = new URLSearchParams();
  if (collection !== "todas") params.set("grimorio", collection);
  const term = query.trim();
  if (term) params.set("q", term);
  if (sort !== "nome-asc") params.set("sort", sort);
  if (page > 1) params.set("page", String(page));
  const queryString = params.toString();
  return queryString ? `/magias-salvas?${queryString}` : "/magias-salvas";
}

function sortEntries(entries: ReadyEntry[], sort: CatalogSort): ReadyEntry[] {
  const byName = (left: ReadyEntry, right: ReadyEntry) =>
    (left.spell?.nome ?? "").localeCompare(right.spell?.nome ?? "", "pt-BR");

  return [...entries].sort((left, right) => {
    if (!left.spell && !right.spell) return left.id.localeCompare(right.id);
    if (!left.spell) return 1;
    if (!right.spell) return -1;

    switch (sort) {
      case "nome-desc":
        return (
          right.spell.nome.localeCompare(left.spell.nome, "pt-BR") ||
          left.id.localeCompare(right.id)
        );
      case "circulo-asc":
        return (
          left.spell.circulo - right.spell.circulo ||
          byName(left, right) ||
          left.id.localeCompare(right.id)
        );
      case "circulo-desc":
        return (
          right.spell.circulo - left.spell.circulo ||
          byName(left, right) ||
          left.id.localeCompare(right.id)
        );
      default:
        return byName(left, right) || left.id.localeCompare(right.id);
    }
  });
}

function SavedNotice({
  tone = "info",
  title,
  children,
  action,
}: {
  tone?: "info" | "warning" | "error";
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  const Icon = tone === "info" ? Info : TriangleAlert;
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "flex flex-col gap-3 rounded-md border px-4 py-3.5 text-sm sm:flex-row sm:items-center sm:justify-between",
        tone === "error" && "border-destructive/30 bg-[#fdf4f1]",
        tone === "warning" && "border-[#d8b46a]/50 bg-[#fbf2df]",
        tone === "info" && "border-gold/30 bg-parchment/70",
      )}
    >
      <div className="flex items-start gap-2.5">
        <Icon
          className={cn(
            "mt-0.5 size-4 shrink-0",
            tone === "error" && "text-destructive",
            tone === "warning" && "text-[#8a6827]",
            tone === "info" && "text-forest",
          )}
          aria-hidden="true"
        />
        <div>
          <p className="font-medium text-foreground">{title}</p>
          <div className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{children}</div>
        </div>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

function SnapshotSkeletonGrid() {
  return (
    <div role="status" aria-live="polite">
      <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3" aria-hidden="true">
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="surface-card min-h-[330px] animate-pulse p-5">
            <div className="flex gap-3">
              <div className="size-11 rounded-md bg-muted" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-2/3 rounded-sm bg-muted" />
                <div className="h-3 w-1/3 rounded-sm bg-muted" />
              </div>
            </div>
            <div className="mt-7 space-y-2">
              <div className="h-3 w-full rounded-sm bg-muted" />
              <div className="h-3 w-5/6 rounded-sm bg-muted" />
              <div className="h-3 w-4/6 rounded-sm bg-muted" />
            </div>
            <div className="mt-9 grid grid-cols-3 gap-3">
              <div className="h-8 rounded-sm bg-muted" />
              <div className="h-8 rounded-sm bg-muted" />
              <div className="h-8 rounded-sm bg-muted" />
            </div>
          </div>
        ))}
      </div>
      <span className="sr-only">Carregando suas magias salvas…</span>
    </div>
  );
}

export function SavedSpellsPage({
  initialCollection,
  initialQuery,
  initialSort,
  initialPage,
}: {
  initialCollection: string;
  initialQuery: string;
  initialSort: CatalogSort;
  initialPage: number;
}) {
  const router = useRouter();
  const {
    status,
    error,
    snapshot,
    grimoires,
    reserved,
    totalUnique,
    refresh,
  } = useGrimoireData();

  const reservedId = reserved?.id ?? null;

  const [collection, setCollection] = useState(initialCollection);
  const [query, setQuery] = useState(initialQuery);
  const [sort, setSort] = useState<CatalogSort>(initialSort);
  const [page, setPage] = useState(initialPage);
  const [dialog, setDialog] = useState<GrimoireDialogState>(null);
  const [mobileCollectionOpen, setMobileCollectionOpen] = useState(false);

  const resultsRef = useRef<HTMLDivElement>(null);

  const collectionExists =
    collection === "todas" ||
    (reservedId !== null && collection === reservedId) ||
    grimoires.some((grimoire) => grimoire.id === collection);
  const activeCollection =
    status === "ready" && !collectionExists ? "todas" : collection;

  const activeGrimoire = useMemo(
    () => grimoires.find((grimoire) => grimoire.id === activeCollection) ?? null,
    [grimoires, activeCollection],
  );

  const collectionIds = useMemo(() => {
    const associations = snapshot?.associations ?? [];
    const selected =
      activeCollection === "todas"
        ? associations
        : associations.filter((association) => association.listaId === activeCollection);
    return [...new Set(selected.map((association) => association.magiaId))].sort((left, right) =>
      left.localeCompare(right),
    );
  }, [snapshot, activeCollection]);

  const {
    snapshots,
    cacheError,
    syncState,
    syncError,
    syncing,
    readyForData,
    retrySync,
  } = useSavedSpellSnapshots(collectionIds, status === "ready");

  const collectionEntries = useMemo<ReadyEntry[]>(
    () =>
      collectionIds.map((id) => {
        return { id, spell: snapshots.get(id)?.spell ?? null };
      }),
    [collectionIds, snapshots],
  );

  const filteredEntries = useMemo(() => {
    const term = query.trim();
    const matches = collectionEntries.filter((entry) => {
      if (!entry.spell) return term.length === 0;
      return matchesSearch(
        [
          entry.spell.nome,
          entry.spell.tipo,
          entry.spell.descricao,
          entry.spell.classes.join(" "),
        ],
        term,
      );
    });
    return sortEntries(matches, sort);
  }, [collectionEntries, query, sort]);

  const pageCount = readyForData
    ? Math.max(1, Math.ceil(filteredEntries.length / SAVED_PAGE_SIZE))
    : 1;
  const displayPage = readyForData ? Math.min(Math.max(page, 1), pageCount) : Math.max(page, 1);
  const rangeStart =
    readyForData && filteredEntries.length > 0
      ? (displayPage - 1) * SAVED_PAGE_SIZE + 1
      : 0;
  const visibleEntries = readyForData
    ? filteredEntries.slice(
        (displayPage - 1) * SAVED_PAGE_SIZE,
        displayPage * SAVED_PAGE_SIZE,
      )
    : [];
  const rangeEnd = rangeStart > 0 ? rangeStart + visibleEntries.length - 1 : 0;

  const missingCount = readyForData
    ? collectionEntries.filter((entry) => !entry.spell).length
    : 0;
  const canonicalHref = useMemo(
    () =>
      buildSavedHref({
        collection: activeCollection,
        query,
        sort,
        page: displayPage,
      }),
    [activeCollection, query, sort, displayPage],
  );

  useEffect(() => {
    if (!readyForData) return;
    const current = `${window.location.pathname}${window.location.search}`;
    if (current !== canonicalHref) {
      window.history.replaceState(null, "", canonicalHref);
    }
  }, [canonicalHref, readyForData]);

  useEffect(() => {
    if (!readyForData) return;
    if (page > pageCount) setPage(pageCount);
  }, [readyForData, page, pageCount]);

  function selectCollection(id: string) {
    setCollection(id);
    setPage(1);
    setMobileCollectionOpen(false);
  }

  function changeQuery(value: string) {
    setQuery(value);
    setPage(1);
  }

  function clearSearch() {
    setQuery("");
    setPage(1);
  }

  function changeSort(value: CatalogSort) {
    setSort(value);
    setPage(1);
  }

  function searchCatalog() {
    const term = query.trim();
    router.push(term ? `/?q=${encodeURIComponent(term)}` : "/");
  }

  function goToPage(nextPage: number) {
    const target = Math.min(Math.max(nextPage, 1), pageCount);
    setPage(target);
    requestAnimationFrame(() => {
      resultsRef.current?.scrollIntoView?.({ behavior: "smooth", block: "start" });
    });
  }

  function openDialog(next: GrimoireDialogState) {
    setMobileCollectionOpen(false);
    setDialog(next);
  }

  function handleCreated(created: Grimoire) {
    setCollection(created.id);
    setPage(1);
  }

  function handleDeleted(id: string) {
    if (activeCollection === id || collection === id) {
      setCollection("todas");
      setPage(1);
    }
  }

  const isReserved = reservedId !== null && activeCollection === reservedId;
  const title =
    activeCollection === "todas"
      ? "Todas as magias salvas"
      : isReserved
        ? "Sem grimório"
        : (activeGrimoire?.nome ?? "Magias salvas");

  const collectionKind = activeCollection === "todas" ? "magias salvas" : "magias neste grimório";
  const subtitle =
    status === "loading"
      ? "Carregando sua coleção…"
      : status === "unauthenticated"
        ? "Entre com sua conta Google para acessar suas magias salvas."
        : status === "error"
          ? "Não foi possível carregar sua coleção."
          : !readyForData
            ? "Carregando os detalhes das suas magias…"
            : filteredEntries.length > 0
              ? `Mostrando ${rangeStart}–${rangeEnd} de ${filteredEntries.length} ${collectionKind}`
              : query.trim()
                ? "Nenhuma magia corresponde à busca."
                : "Nenhuma magia nesta coleção.";

  const retryAction = (
    <Button variant="outline" size="sm" onClick={retrySync} disabled={syncing}>
      <RefreshCw className="size-3.5" aria-hidden="true" />
      {syncing ? "Sincronizando…" : "Tentar sincronizar"}
    </Button>
  );

  const showMissingWarning = readyForData && syncState === "ready" && missingCount > 0;

  return (
    <>
      <PageHero
        eyebrow="Seu acervo arcano"
        title="Suas magias, sempre por perto."
        description="Seus encantamentos favoritos, reunidos para a próxima aventura."
      />

      <section className="container-page py-8 sm:py-10">
        <SavedSearchBar
          value={query}
          onChange={changeQuery}
          onCatalogSearch={searchCatalog}
        />

        <div className="mt-8 grid items-start gap-8 lg:grid-cols-[250px_minmax(0,1fr)] xl:gap-10">
          <GrimoireSidebar
            className="hidden lg:block"
            selectedId={activeCollection}
            onSelect={selectCollection}
            onCreate={() => openDialog({ type: "create" })}
            onRename={(grimoire) => openDialog({ type: "rename", grimoire })}
            onDelete={(grimoire) => openDialog({ type: "delete", grimoire })}
          />

          <div className="min-w-0">
            <div className="mb-5 lg:hidden">
              <Button
                type="button"
                variant="outline"
                onClick={() => setMobileCollectionOpen((current) => !current)}
                aria-expanded={mobileCollectionOpen}
                aria-controls="minha-colecao-mobile"
                className="h-10 gap-2 border-border bg-card px-3.5 text-forest"
              >
                <LibraryBig className="size-4" aria-hidden="true" />
                Minha coleção
                <ChevronDown
                  className={cn(
                    "size-4 transition-transform",
                    mobileCollectionOpen && "rotate-180",
                  )}
                  aria-hidden="true"
                />
              </Button>

              {mobileCollectionOpen ? (
                <div id="minha-colecao-mobile" className="surface-card mt-3 px-4 py-5">
                  <GrimoireSidebar
                    selectedId={activeCollection}
                    onSelect={selectCollection}
                    onCreate={() => openDialog({ type: "create" })}
                    onRename={(grimoire) => openDialog({ type: "rename", grimoire })}
                    onDelete={(grimoire) => openDialog({ type: "delete", grimoire })}
                    onNavigate={() => setMobileCollectionOpen(false)}
                  />
                </div>
              ) : null}
            </div>

            <div
              ref={resultsRef}
              className="flex scroll-mt-6 flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2.5">
                  <BookOpen
                    className="size-4 shrink-0 text-gold"
                    strokeWidth={1.6}
                    aria-hidden="true"
                  />
                  <h2 className="text-[1.9rem] leading-none text-forest">{title}</h2>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>
              </div>
              {readyForData && totalUnique > 0 ? (
                <SortSelect
                  id="ordenar-magias-salvas"
                  value={sort}
                  onChange={changeSort}
                />
              ) : null}
            </div>

            {readyForData ? (
              <div className="mt-5 space-y-3">
                {cacheError ? (
                  <SavedNotice
                    tone="error"
                    title="Cópias locais indisponíveis"
                    action={retryAction}
                  >
                    {cacheError} As referências continuam salvas na sua conta e os detalhes
                    disponíveis em cache serão exibidos assim que o armazenamento local estiver
                    acessível.
                  </SavedNotice>
                ) : null}

                {syncing ? (
                  <div
                    role="status"
                    className="flex items-center gap-2.5 rounded-md border border-gold/30 bg-parchment/70 px-4 py-3 text-sm text-muted-foreground"
                  >
                    <Loader2 className="size-4 animate-spin text-forest" aria-hidden="true" />
                    Sincronizando os detalhes das magias salvas…
                  </div>
                ) : null}

                {syncError ? (
                  <SavedNotice
                    tone="warning"
                    title="Não foi possível sincronizar os detalhes"
                    action={retryAction}
                  >
                    {syncError} Suas referências locais foram preservadas e as cópias disponíveis
                    continuam acessíveis.
                  </SavedNotice>
                ) : null}

                {showMissingWarning ? (
                  <SavedNotice
                    tone="warning"
                    title="Referências sem detalhes neste navegador"
                    action={retryAction}
                  >
                    {missingCount}{" "}
                    {missingCount === 1
                      ? "magia salva não possui detalhes disponíveis"
                      : "magias salvas não possuem detalhes disponíveis"}{" "}
                    neste navegador. Elas continuam na sua coleção e serão sincronizadas quando
                    houver conexão.
                    {query.trim()
                      ? " A busca considera apenas as magias com detalhes disponíveis."
                      : ""}
                  </SavedNotice>
                ) : null}
              </div>
            ) : null}

            {status === "unauthenticated" ? (
              <div className="mt-6">
                <StatePanel
                  icon={LogIn}
                  eyebrow="Sessão necessária"
                  title="Entre para acessar suas magias salvas."
                  description="Sua coleção fica associada à sua conta Google e disponível em qualquer dispositivo. Nenhum dado local antigo foi importado."
                  actions={
                    <Button
                      render={<Link href="/login" />}
                      className="bg-forest text-[#f8f1df] hover:bg-forest-deep"
                    >
                      <LogIn className="size-4" aria-hidden="true" />
                      Entrar com Google
                    </Button>
                  }
                />
              </div>
            ) : status === "loading" || !readyForData ? (
              status === "error" ? (
                <div className="mt-6">
                  <StatePanel
                    icon={TriangleAlert}
                    tone="error"
                    eyebrow="Coleção indisponível"
                    title="Não foi possível abrir suas magias salvas."
                    description={
                      error ??
                      "O servidor não respondeu. Seus grimórios e referências não foram apagados."
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
              ) : (
                <SnapshotSkeletonGrid />
              )
            ) : collectionIds.length === 0 ? (
              <div className="mt-6">
                <StatePanel
                  icon={Bookmark}
                  eyebrow={activeCollection === "todas" ? "Coleção vazia" : "Grimório vazio"}
                  title={
                    activeCollection === "todas"
                      ? "Sua coleção ainda está vazia."
                      : isReserved
                        ? "Sem grimório está vazio."
                        : "Este grimório ainda está vazio."
                  }
                  description={
                    activeCollection === "todas"
                      ? "Encontre uma magia na Biblioteca e use o marcador para guardá-la em um grimório ou em Sem grimório."
                      : "As magias que você salvar neste grimório aparecerão aqui. Explore a Biblioteca para encontrar novas magias."
                  }
                  actions={
                    <Button
                      render={<Link href="/" />}
                      className="bg-forest text-[#f8f1df] hover:bg-forest-deep"
                    >
                      <LibraryBig className="size-4" aria-hidden="true" />
                      Explorar biblioteca
                    </Button>
                  }
                />
              </div>
            ) : filteredEntries.length === 0 ? (
              <div className="mt-6">
                <StatePanel
                  icon={SearchX}
                  eyebrow="Sem resultados"
                  title="Nenhuma magia encontrada."
                  description={
                    query.trim()
                      ? `Sua busca por “${query.trim()}” não encontrou magias nesta coleção. Tente outro termo ou limpe a busca.`
                      : "Não há magias para exibir nesta coleção no momento."
                  }
                  actions={
                    <>
                      {query.trim() ? (
                        <Button
                          onClick={clearSearch}
                          className="bg-forest text-[#f8f1df] hover:bg-forest-deep"
                        >
                          Limpar busca
                        </Button>
                      ) : null}
                      <Button variant="outline" render={<Link href="/" />}>
                        <LibraryBig className="size-4" aria-hidden="true" />
                        Explorar biblioteca
                      </Button>
                    </>
                  }
                />
              </div>
            ) : (
              <>
                <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                  {visibleEntries.map((entry) =>
                    entry.spell ? (
                      <SpellCard
                        key={entry.id}
                        spell={entry.spell}
                        from={canonicalHref}
                      />
                    ) : (
                      <UnavailableSpellCard
                        key={entry.id}
                        spellId={entry.id}
                        onRetry={retrySync}
                        retrying={syncing}
                        action={
                          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                            Organizar
                            <SpellSaveButton
                              spellId={entry.id}
                              spellName="esta magia"
                              ariaLabel="Gerenciar os grimórios desta magia não sincronizada"
                            />
                          </span>
                        }
                      />
                    ),
                  )}
                </div>

                <div className="mt-8 flex flex-col-reverse items-center justify-between gap-4 border-t border-border pt-5 sm:flex-row">
                  <p className="text-xs text-muted-foreground">
                    {collectionIds.length}{" "}
                    {collectionIds.length === 1 ? "magia guardada" : "magias guardadas"}. Infinitas
                    possibilidades.
                  </p>
                  <Pagination
                    currentPage={displayPage}
                    pageCount={pageCount}
                    hrefForPage={(targetPage) =>
                      buildSavedHref({
                        collection: activeCollection,
                        query,
                        sort,
                        page: targetPage,
                      })
                    }
                    onPageChange={goToPage}
                  />
                </div>
              </>
            )}
          </div>
        </div>
      </section>

      <GrimoireDialogs
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
