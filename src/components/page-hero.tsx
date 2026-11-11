import { ArcaneCircle } from "@/components/arcane-circle";

type PageHeroProps = {
  eyebrow: string;
  title: string;
  description: string;
  children?: React.ReactNode;
};

export function PageHero({ eyebrow, title, description, children }: PageHeroProps) {
  return (
    <section className="relative overflow-hidden bg-forest text-[#f7f1e2]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_78%_40%,rgb(200_163_90/0.12),transparent_34rem)]" />
      <div className="container-page relative flex min-h-[250px] items-center justify-between gap-10 py-12 sm:min-h-[286px] sm:py-14">
        <div className="max-w-[720px]">
          <p className="eyebrow text-gold">{eyebrow}</p>
          <h1 className="mt-4 text-[clamp(2.45rem,5.2vw,4.35rem)] leading-[1.02] tracking-[-0.012em] text-[#f8f2e4]">
            {title}
          </h1>
          <p className="mt-5 max-w-xl text-[0.98rem] leading-relaxed text-[#d7d2c4] sm:text-base">
            {description}
          </p>
          {children}
        </div>
        <ArcaneCircle className="pointer-events-none absolute -right-20 top-1/2 hidden h-[320px] w-[320px] -translate-y-1/2 text-gold/80 md:block lg:-right-6 lg:h-[340px] lg:w-[340px]" />
        <ArcaneCircle className="pointer-events-none absolute -right-32 top-1/2 h-[300px] w-[300px] -translate-y-1/2 text-gold/45 md:hidden" />
      </div>
      <div className="absolute inset-x-0 bottom-0 h-px bg-gold/25" />
    </section>
  );
}
