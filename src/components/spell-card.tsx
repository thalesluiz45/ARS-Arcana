import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { ReactNode } from "react";

import { SpellSaveButton } from "@/components/spell-save-dialog";
import { SpellSchoolIcon } from "@/components/spell-school-icon";
import { spellHref } from "@/lib/navigation";
import {
  isConcentrationSpell,
  spellCircleLabel,
  spellComponentsLabel,
  type Magia,
} from "@/lib/validation/magia";
import { cn } from "@/lib/utils";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="stat-label">{label}</dt>
      <dd className="mt-1.5 text-[0.8rem] leading-snug text-foreground">{value}</dd>
    </div>
  );
}

export function SpellCard({
  magia,
  from,
  className,
}: {
  magia: Magia;
  from: string;
  className?: string;
}) {
  const href = spellHref(magia.id, from);
  const concentration = isConcentrationSpell(magia.duracao);

  return (
    <article
      className={cn(
        "surface-card group flex h-full flex-col overflow-hidden transition-[border-color,box-shadow,transform] hover:-translate-y-0.5 hover:border-gold/55 hover:shadow-[0_18px_40px_-30px_rgb(34_48_42/0.5)]",
        className,
      )}
    >
      <div className="flex items-start gap-3 p-5 pb-4">
        <SpellSchoolIcon school={magia.tipo} />
        <div className="min-w-0 flex-1">
          <h3 className="font-heading text-[1.5rem] leading-[1.08] tracking-[-0.01em] text-forest">
            <Link href={href} className="transition-colors hover:text-[#7d5e2a]">
              {magia.nome}
            </Link>
          </h3>
          <p className="mt-1.5 text-[0.63rem] font-semibold uppercase tracking-[0.13em] text-muted-foreground">
            {magia.tipo} <span aria-hidden="true">·</span> {spellCircleLabel(magia.circulo)}
          </p>
        </div>
        <SpellSaveButton magiaId={magia.id} magiaNome={magia.nome} />
      </div>

      <div className="mx-5 border-t border-border" />

      <div className="flex flex-1 flex-col p-5 pt-4">
        <p className="line-clamp-3 text-sm leading-relaxed text-muted-foreground">
          {magia.descricao}
        </p>

        <dl className="mt-5 grid grid-cols-3 gap-x-3 border-t border-border pt-4">
          <Stat label="Conjuração" value={magia.tempoConjuracao} />
          <Stat label="Alcance" value={magia.alcance} />
          <Stat label="Duração" value={magia.duracao} />
        </dl>

        <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
          <Link
            href={href}
            className="inline-flex items-center gap-2 text-sm font-semibold text-forest transition-colors hover:text-[#7d5e2a]"
          >
            Ver magia
            <ArrowRight
              className="size-4 transition-transform group-hover:translate-x-0.5"
              aria-hidden="true"
            />
          </Link>
          {concentration ? (
            <span className="rounded-sm bg-[#ece4f5] px-2.5 py-1 text-[0.62rem] font-semibold uppercase tracking-[0.1em] text-[#6c5b8d]">
              Concentração
            </span>
          ) : (
            <span
              className="text-[0.64rem] font-semibold uppercase tracking-[0.22em] text-muted-foreground"
              title="Componentes"
            >
              {spellComponentsLabel(magia.componentes)}
            </span>
          )}
        </div>
      </div>
    </article>
  );
}

export function UnavailableSpellCard({
  magiaId,
  onRetry,
  retrying,
  action,
}: {
  magiaId: string;
  onRetry?: () => void;
  retrying?: boolean;
  action?: ReactNode;
}) {
  return (
    <article className="surface-card flex h-full flex-col items-start justify-between overflow-hidden border-dashed px-5 py-6">
      <div className="flex items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground">
          <span className="text-lg" aria-hidden="true">
            ?
          </span>
        </span>
        <div>
          <h3 className="font-heading text-[1.35rem] leading-tight text-forest">
            Magia não sincronizada
          </h3>
          <p className="mt-1.5 text-[0.63rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Referência local preservada
          </p>
        </div>
      </div>
      <p className="mt-5 text-sm leading-relaxed text-muted-foreground">
        Os detalhes desta magia ainda não estão neste navegador. A referência continua salva e
        será sincronizada quando a conexão voltar.
      </p>
      <code className="mt-3 max-w-full truncate rounded-sm bg-parchment px-2 py-1 text-[0.68rem] text-muted-foreground">
        {magiaId}
      </code>
      {onRetry || action ? (
        <div className="mt-5 flex w-full flex-wrap items-center justify-between gap-3">
          {onRetry ? (
            <button
              type="button"
              onClick={onRetry}
              disabled={retrying}
              className="inline-flex items-center gap-2 text-sm font-semibold text-forest underline-offset-4 hover:underline disabled:opacity-60"
            >
              {retrying ? "Sincronizando…" : "Tentar sincronizar"}
            </button>
          ) : (
            <span />
          )}
          {action}
        </div>
      ) : null}
    </article>
  );
}
