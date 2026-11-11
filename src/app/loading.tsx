export default function Loading() {
  return (
    <div role="status" aria-live="polite">
      <div className="bg-forest">
        <div className="container-page min-h-[250px] py-14 sm:min-h-[286px]">
          <p className="eyebrow text-gold">Carregando o grimório</p>
          <div className="mt-5 h-12 w-2/3 max-w-xl animate-pulse rounded-sm bg-white/10" />
          <div className="mt-4 h-4 w-1/2 max-w-md animate-pulse rounded-sm bg-white/10" />
        </div>
      </div>
      <div className="container-page py-8 sm:py-10">
        <div className="h-14 animate-pulse rounded-lg border border-border bg-card" />
        <div className="mt-8 grid gap-8 lg:grid-cols-[280px_minmax(0,1fr)]">
          <div className="hidden space-y-4 lg:block">
            <div className="h-6 w-36 animate-pulse rounded-sm bg-secondary" />
            <div className="h-40 animate-pulse rounded-lg bg-card" />
            <div className="h-56 animate-pulse rounded-lg bg-card" />
          </div>
          <div>
            <div className="h-9 w-64 animate-pulse rounded-sm bg-secondary" />
            <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }, (_, index) => (
                <div key={index} className="h-[330px] animate-pulse rounded-lg border border-border bg-card" />
              ))}
            </div>
          </div>
        </div>
        <span className="sr-only">Carregando o catálogo de magias…</span>
      </div>
    </div>
  );
}
