import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Sparkles, Swords } from "lucide-react";

import { PageHero } from "@/components/page-hero";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Arsenal",
};

export default function ArsenalPage() {
  return (
    <>
      <PageHero
        eyebrow="Arsenal"
        title="Em breve, seu arsenal."
        description="Um espaço para reunir técnicas, recursos e equipamentos que acompanham o seu personagem em cada batalha."
      />
      <section className="container-page py-12 sm:py-16">
        <div className="surface-card mx-auto max-w-2xl px-6 py-12 text-center sm:px-12">
          <span className="mx-auto grid size-14 place-items-center rounded-full border border-gold/35 bg-parchment text-forest">
            <Swords className="size-6" strokeWidth={1.5} aria-hidden="true" />
          </span>
          <p className="eyebrow mt-6 text-gold">Trabalho em andamento</p>
          <h2 className="mt-3 text-3xl text-forest">O arsenal ainda está sendo forjado.</h2>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            Enquanto isso, explore a biblioteca de magias e prepare seus próximos encantamentos.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button render={<Link href="/" />} className="bg-forest text-[#f8f1df] hover:bg-forest/90">
              <Sparkles className="size-4" aria-hidden="true" />
              Explorar a biblioteca
            </Button>
            <Button variant="outline" render={<Link href="/equipamento" />}>
              <ArrowLeft className="size-4" aria-hidden="true" />
              Ver equipamento
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
