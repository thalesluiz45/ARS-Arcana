import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Compass, Sparkles } from "lucide-react";

import { PageHero } from "@/components/page-hero";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Guia do aventureiro",
};

export default function GuiaPage() {
  return (
    <>
      <PageHero
        eyebrow="Guia do aventureiro"
        title="Em breve, novos caminhos."
        description="Estamos preparando um guia para ajudar você a montar personagens, escolher magias e conduzir grandes aventuras."
      />
      <section className="container-page py-12 sm:py-16">
        <div className="surface-card mx-auto max-w-2xl px-6 py-12 text-center sm:px-12">
          <span className="mx-auto grid size-14 place-items-center rounded-full border border-gold/35 bg-parchment text-forest">
            <Compass className="size-6" strokeWidth={1.5} aria-hidden="true" />
          </span>
          <p className="eyebrow mt-6 text-gold">Trabalho em andamento</p>
          <h2 className="mt-3 text-3xl text-forest">O guia ainda está sendo escrito.</h2>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            Enquanto isso, explore a biblioteca completa de magias, salve suas favoritas e organize
            seus grimórios para a próxima sessão.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button render={<Link href="/" />} className="bg-forest text-[#f8f1df] hover:bg-forest/90">
              <Sparkles className="size-4" aria-hidden="true" />
              Explorar a biblioteca
            </Button>
            <Button variant="outline" render={<Link href="/magias-salvas" />}>
              <ArrowLeft className="size-4" aria-hidden="true" />
              Meus grimórios
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
