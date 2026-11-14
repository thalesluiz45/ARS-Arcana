import { Loader2 } from "lucide-react";

export default function ArsenalLoading() {
  return (
    <div role="status" aria-live="polite">
      <div className="bg-forest">
        <div className="container-page min-h-[250px] py-14 sm:min-h-[286px]">
          <p className="eyebrow text-gold">Seu acervo</p>
          <div className="mt-5 h-12 w-2/3 max-w-xl animate-pulse rounded-sm bg-white/10" />
          <div className="mt-4 h-4 w-1/2 max-w-md animate-pulse rounded-sm bg-white/10" />
        </div>
      </div>
      <div className="container-page py-8 sm:py-10">
        <div className="flex items-center gap-2.5 rounded-md border border-gold/30 bg-parchment/70 px-4 py-3 text-sm text-forest">
          <Loader2 className="size-5 animate-spin" aria-hidden="true" />
          Carregando os equipamentos salvos na sua conta…
        </div>
        <div className="mt-6 h-14 animate-pulse rounded-lg border border-border bg-card" />
        <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, index) => (
            <div key={index} className="h-[360px] animate-pulse rounded-lg border border-border bg-card" />
          ))}
        </div>
      </div>
    </div>
  );
}
