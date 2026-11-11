"use client";

import Link from "next/link";
import {
  ArrowLeft,
  BookOpen,
  Clock3,
  Info,
  RefreshCw,
  RotateCcw,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import { useEffect, useState } from "react";

import { ArcaneCircle } from "@/components/arcane-circle";
import { SpellSaveButton } from "@/components/spell-save-dialog";
import { SpellSchoolIcon } from "@/components/spell-school-icon";
import { StatePanel } from "@/components/state-panel";
import { Button } from "@/components/ui/button";
import { obterSnapshot, salvarSnapshot } from "@/lib/local/spell-cache";
import {
  isConcentrationSpell,
  magiaSchema,
  spellCircleLabel,
  spellComponentsLabel,
  type Magia,
} from "@/lib/validation/magia";

type LoadState = "loading" | "ready" | "missing" | "error";
type SpellSource = "server" | "snapshot";

function formatCachedAt(value: string | null): string {
  if (!value) return "data desconhecida";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "data desconhecida";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function Notice({
  tone = "info",
  title,
  children,
  action,
}: {
  tone?: "info" | "warning";
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  const Icon = tone === "warning" ? TriangleAlert : Info;
  return (
    <div
      role={tone === "warning" ? "alert" : "status"}
      className={
        tone === "warning"
          ? "flex flex-col gap-3 rounded-md border border-[#d8b46a]/50 bg-[#fbf2df] px-4 py-3.5 text-sm sm:flex-row sm:items-center sm:justify-between"
          : "flex flex-col gap-3 rounded-md border border-gold/30 bg-parchment/70 px-4 py-3.5 text-sm sm:flex-row sm:items-center sm:justify-between"
      }
    >
      <div className="flex items-start gap-2.5">
        <Icon
          className={tone === "warning" ? "mt-0.5 size-4 shrink-0 text-[#8a6827]" : "mt-0.5 size-4 shrink-0 text-forest"}
          aria-hidden="true"
        />
        <div>
          <p className="font-medium text-foreground">{title}</p>
          <div className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{children}</div>
        </div>
      </div>
      {action}
    </div>
  );
}

export function SpellDetail({ magiaId, from }: { magiaId: string; from: string }) {
  const [spell, setSpell] = useState<Magia | null>(null);
  const [status, setStatus] = useState<LoadState>("loading");
  const [source, setSource] = useState<SpellSource | null>(null);
  const [stale, setStale] = useState(false);
  const [cachedAt, setCachedAt] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);
  const [cacheNotice, setCacheNotice] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    let cancelled = false;

    setStatus("loading");
    setSpell(null);
    setSource(null);
    setStale(false);
    setCachedAt(null);
    setErrorMessage(null);
    setSyncNotice(null);
    setCacheNotice(null);

    async function load() {
      let cached = null;
      let snapshotError: string | null = null;

      try {
        cached = await obterSnapshot(magiaId);
      } catch (cause) {
        snapshotError =
          cause instanceof Error
            ? cause.message
            : "Não foi possível ler a cópia local desta magia.";
      }

      if (cancelled) return;

      if (cached) {
        setSpell(cached.spell);
        setSource("snapshot");
        setStale(cached.stale);
        setCachedAt(cached.cachedAt);
        setStatus("ready");
      }

      let remoteError: string | null = null;
      let remoteMissing = false;
      let remoteLoaded = false;

      try {
        const response = await fetch(`/api/magias/${encodeURIComponent(magiaId)}`, {
          cache: "no-store",
          headers: { accept: "application/json" },
        });

        if (response.ok) {
          const payload: unknown = await response.json();
          const parsed = magiaSchema.safeParse(payload);
          if (!parsed.success) {
            remoteError = "O catálogo retornou dados em formato inesperado.";
          } else if (!cancelled) {
            remoteLoaded = true;
            setSpell(parsed.data);
            setSource("server");
            setStale(false);
            setCachedAt(null);
            setStatus("ready");
            setErrorMessage(null);
            setSyncNotice(null);
            try {
              await salvarSnapshot(parsed.data);
            } catch {
              if (!cancelled) {
                setCacheNotice(
                  "A magia foi carregada, mas não foi possível atualizar a cópia local.",
                );
              }
            }
          }
        } else if (response.status === 404) {
          try {
            await response.text();
          } catch {
            // The 404 status already determines the missing-spell state.
          }
          remoteMissing = true;
        } else {
          let detail = `O catálogo respondeu com status ${response.status}.`;
          try {
            const body = (await response.json()) as { error?: unknown };
            if (typeof body.error === "string" && body.error.trim()) detail = body.error;
          } catch {
            // The status message above is already actionable.
          }
          remoteError = detail;
        }
      } catch {
        remoteError =
          "Não foi possível consultar o catálogo. Verifique sua conexão e tente novamente.";
      }

      if (cancelled) return;

      if (remoteError) {
        setSyncNotice(remoteError);
        if (!cached) {
          setErrorMessage(snapshotError ?? remoteError);
          setStatus("error");
        }
        return;
      }

      if (remoteMissing) {
        if (!cached) {
          setStatus("missing");
          return;
        }
        setSyncNotice(
          "Esta magia não está mais no catálogo remoto. A referência e a cópia salva neste navegador foram preservadas.",
        );
        return;
      }

      if (!cached && !remoteLoaded && !cancelled) {
        setErrorMessage(snapshotError);
        setStatus("error");
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [magiaId, refreshToken]);

  function retry() {
    setRefreshToken((current) => current + 1);
  }

  const fromSaved = from.startsWith("/magias-salvas");
  const backLabel = fromSaved ? "Voltar aos grimórios" : "Voltar à biblioteca";
  const retryAction = (
    <Button variant="outline" size="sm" onClick={retry}>
      <RefreshCw className="size-3.5" aria-hidden="true" />
      Tentar novamente
    </Button>
  );

  if (status === "loading") {
    return (
      <div role="status" aria-live="polite">
        <div className="bg-forest">
          <div className="container-page py-12 sm:py-16">
            <div className="h-4 w-36 animate-pulse rounded-sm bg-white/10" />
            <div className="mt-8 flex gap-5">
              <div className="size-14 animate-pulse rounded-md bg-white/10" />
              <div className="flex-1">
                <div className="h-4 w-40 animate-pulse rounded-sm bg-white/10" />
                <div className="mt-3 h-11 w-2/3 max-w-lg animate-pulse rounded-sm bg-white/10" />
              </div>
            </div>
          </div>
        </div>
        <div className="container-page py-10">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="h-72 animate-pulse rounded-lg border border-border bg-card" />
            <div className="h-72 animate-pulse rounded-lg border border-border bg-card" />
          </div>
          <span className="sr-only">Carregando detalhes da magia…</span>
        </div>
      </div>
    );
  }

  if (status === "missing" || status === "error" || !spell) {
    return (
      <section className="container-page py-14 sm:py-20">
        <StatePanel
          icon={status === "missing" ? BookOpen : TriangleAlert}
          tone={status === "error" ? "error" : "default"}
          eyebrow={status === "missing" ? "Magia indisponível" : "Falha ao carregar"}
          title={
            status === "missing"
              ? "Esta magia não foi encontrada."
              : "Não foi possível abrir os detalhes."
          }
          description={
            status === "missing"
              ? "O catálogo remoto não possui este identificador e não há cópia local disponível neste navegador."
              : (errorMessage ??
                "Não foi possível carregar a magia. Verifique a conexão e tente novamente.")
          }
          actions={
            <>
              {status === "error" ? (
                <Button onClick={retry} className="bg-forest text-[#f8f1df] hover:bg-forest-deep">
                  <RotateCcw className="size-4" aria-hidden="true" />
                  Tentar novamente
                </Button>
              ) : null}
              <Button variant="outline" render={<Link href={from} />}>
                <ArrowLeft className="size-4" aria-hidden="true" />
                {backLabel}
              </Button>
              {from !== "/" ? (
                <Button variant="ghost" render={<Link href="/" />}>
                  Ir para a biblioteca
                </Button>
              ) : null}
            </>
          }
        />
      </section>
    );
  }

  const concentration = isConcentrationSpell(spell.duracao);
  const paragraphs = spell.descricao.split(/\n{2,}/).filter(Boolean);
  const components = [
    spell.componentes.verbal ? { sigla: "V", nome: "Verbal" } : null,
    spell.componentes.somatico ? { sigla: "S", nome: "Somático" } : null,
    spell.componentes.material ? { sigla: "M", nome: "Material" } : null,
  ].filter((component): component is { sigla: string; nome: string } => component !== null);

  return (
    <>
      <section className="relative overflow-hidden bg-forest text-[#f7f1e2]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_82%_38%,rgb(200_163_90/0.13),transparent_32rem)]" />
        <ArcaneCircle className="pointer-events-none absolute -right-16 top-1/2 hidden h-[300px] w-[300px] -translate-y-1/2 text-gold/60 md:block" />
        <div className="container-page relative py-9 sm:py-12">
          <Link
            href={from}
            className="inline-flex items-center gap-2 text-sm text-[#d8d4c7] transition-colors hover:text-white"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            {backLabel}
          </Link>

          <div className="mt-8 flex flex-col gap-6 sm:flex-row sm:items-start">
            <SpellSchoolIcon school={spell.tipo} size="lg" className="ring-1 ring-gold/25" />
            <div className="min-w-0 flex-1">
              <p className="eyebrow text-gold">
                {spell.tipo} <span aria-hidden="true">·</span> {spellCircleLabel(spell.circulo)}
                {concentration ? (
                  <>
                    <span aria-hidden="true"> · </span> Concentração
                  </>
                ) : null}
              </p>
              <h1 className="mt-3 text-[clamp(2.35rem,5vw,4rem)] leading-[1.03] tracking-[-0.015em] text-[#f8f2e4]">
                {spell.nome}
              </h1>
              <ul className="mt-4 flex flex-wrap gap-2" aria-label="Classes que podem usar esta magia">
                {spell.classes.map((classe) => (
                  <li
                    key={classe}
                    className="rounded-full border border-gold/30 bg-white/[0.04] px-3 py-1 text-[0.68rem] font-medium uppercase tracking-[0.1em] text-[#e9dfc9]"
                  >
                    {classe}
                  </li>
                ))}
              </ul>
            </div>
            <SpellSaveButton
              magiaId={spell.id}
              magiaNome={spell.nome}
              variant="labelled"
              className="shrink-0 border-gold/45 bg-white/[0.04] text-[#f7f1e2] hover:border-gold hover:bg-white/[0.09] hover:text-white"
            />
          </div>
        </div>
        <div className="absolute inset-x-0 bottom-0 h-px bg-gold/25" />
      </section>

      <section className="container-page py-8 sm:py-10">
        <div className="space-y-3">
          {source === "snapshot" ? (
            <Notice
              title="Cópia salva neste navegador"
              action={retryAction}
            >
              Exibindo a cópia salva em {formatCachedAt(cachedAt)}.
              {stale ? " Ela pode estar desatualizada em relação ao catálogo." : ""}
            </Notice>
          ) : null}
          {syncNotice ? (
            <Notice tone="warning" title="Não foi possível atualizar os detalhes" action={retryAction}>
              {syncNotice}
            </Notice>
          ) : null}
          {cacheNotice ? (
            <Notice tone="warning" title="Cópia local não atualizada">
              {cacheNotice}
            </Notice>
          ) : null}
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] xl:gap-8">
          <article className="surface-card px-5 py-6 sm:px-8 sm:py-8">
            <div className="flex items-center gap-2.5 border-b border-border pb-4">
              <BookOpen className="size-4 text-gold" strokeWidth={1.6} aria-hidden="true" />
              <h2 className="text-[1.6rem] leading-none text-forest">Descrição</h2>
            </div>
            <div className="spell-copy mt-5 text-[0.98rem] leading-[1.8] text-[#3d4a43]">
              {paragraphs.map((paragraph, index) => (
                <p key={index}>{paragraph}</p>
              ))}
            </div>
          </article>

          <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
            <div className="surface-card overflow-hidden">
              <div className="border-b border-border px-5 py-4">
                <div className="flex items-center gap-2.5">
                  <Sparkles className="size-4 text-gold" strokeWidth={1.6} aria-hidden="true" />
                  <h2 className="text-[1.35rem] leading-none text-forest">Informações da magia</h2>
                </div>
              </div>
              <dl className="divide-y divide-border">
                <div className="px-5 py-4">
                  <dt className="stat-label">Tempo de conjuração</dt>
                  <dd className="mt-1.5 text-sm text-foreground">{spell.tempoConjuracao}</dd>
                </div>
                <div className="px-5 py-4">
                  <dt className="stat-label">Alcance</dt>
                  <dd className="mt-1.5 text-sm text-foreground">{spell.alcance}</dd>
                </div>
                <div className="px-5 py-4">
                  <dt className="stat-label">Duração</dt>
                  <dd className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-foreground">
                    {spell.duracao}
                    {concentration ? (
                      <span className="rounded-sm bg-[#ece4f5] px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-[0.1em] text-[#6c5b8d]">
                        Concentração
                      </span>
                    ) : null}
                  </dd>
                </div>
                <div className="px-5 py-4">
                  <dt className="stat-label">Componentes</dt>
                  <dd className="mt-2 text-sm text-foreground">
                    <span className="flex flex-wrap items-center gap-2">
                      {components.map((component) => (
                        <span
                          key={component.sigla}
                          className="inline-flex items-center gap-1.5 rounded-sm border border-border bg-parchment/70 px-2 py-1"
                        >
                          <span className="font-heading text-base font-semibold text-forest">
                            {component.sigla}
                          </span>
                          <span className="text-[0.68rem] uppercase tracking-[0.08em] text-muted-foreground">
                            {component.nome}
                          </span>
                        </span>
                      ))}
                    </span>
                    {spell.componentes.materialDescricao ? (
                      <span className="mt-3 block border-l-2 border-gold/40 pl-3 text-xs leading-relaxed text-muted-foreground">
                        {spell.componentes.materialDescricao}
                      </span>
                    ) : null}
                    <span className="mt-3 block text-[0.68rem] uppercase tracking-[0.12em] text-muted-foreground">
                      {spellComponentsLabel(spell.componentes)}
                    </span>
                  </dd>
                </div>
              </dl>
            </div>

            <div className="rounded-md border border-gold/25 bg-parchment/70 px-5 py-4">
              <div className="flex items-center gap-2 text-forest">
                <Clock3 className="size-4" aria-hidden="true" />
                <p className="text-sm font-medium">Pronta para a sessão</p>
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                Salve esta magia em um grimório para consultá-la mesmo quando a conexão falhar.
              </p>
            </div>
          </aside>
        </div>
      </section>
    </>
  );
}
