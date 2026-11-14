import { Loader2 } from "lucide-react";

export default function EquipmentDetailLoading() {
  return (
    <div role="status" aria-live="polite">
      <div className="bg-forest">
        <div className="container-page min-h-[250px] py-12 sm:min-h-[286px] sm:py-14">
          <p className="eyebrow text-gold">Equipamento</p>
          <div className="mt-5 h-12 w-2/3 max-w-xl animate-pulse rounded-sm bg-white/10" />
          <div className="mt-4 h-4 w-1/3 max-w-sm animate-pulse rounded-sm bg-white/10" />
        </div>
      </div>
      <div className="container-page py-10">
        <div className="mb-5 flex items-center gap-2.5 rounded-md border border-gold/30 bg-parchment/70 px-4 py-3 text-sm text-forest">
          <Loader2 className="size-5 animate-spin" aria-hidden="true" />
          Consultando os detalhes do equipamento no catálogo…
        </div>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="h-72 animate-pulse rounded-lg border border-border bg-card" />
          <div className="h-72 animate-pulse rounded-lg border border-border bg-card" />
        </div>
      </div>
    </div>
  );
}
