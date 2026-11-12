import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Backpack, Sparkles } from "lucide-react";

import { PageHero } from "@/components/page-hero";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Equipamento",
};

export default function EquipamentoPage() {
  return (
    <>
      <PageHero
        eyebrow="Equipamento"
        title="Em breve, seu inventário."
        description="Estamos preparando um espaço para organizar armas, armaduras, poções e tudo o que a sua aventura exigir."
      />
      <section className="container-page py-12 sm:py-16">
        <div className="surface-card mx-auto max-w-2xl px-6 py-12 text-center sm:px-12">
          <span className="mx-auto grid size-14 place-items-center rounded-full border border-gold/35 bg-parchment text-forest">
            <Backpack className="size-6" strokeWidth={1.5} aria-hidden="true" />
          </span>
          <p className="eyebrow mt-6 text-gold">Trabalho em andamento</p>
          <h2 className="mt-3 text-3xl text-forest">O inventário ainda está sendo preparado.</h2>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            Enquanto isso, explore a biblioteca de magias e organize seus grimórios para a próxima
            sessão.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button render={<Link href="/" />} className="bg-forest text-[#f8f1df] hover:bg-forest/90">
              <Sparkles className="size-4" aria-hidden="true" />
              Explorar a biblioteca
            </Button>
            <Button variant="outline" render={<Link href="/magias-salvas" />}>
              <ArrowLeft className="size-4" aria-hidden="true" />
              Magias salvas
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
