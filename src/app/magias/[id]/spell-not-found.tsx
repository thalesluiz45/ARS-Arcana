import Link from "next/link";
import { ArrowLeft, SearchX } from "lucide-react";

import { StatePanel } from "@/components/state-panel";
import { Button } from "@/components/ui/button";

export function SpellNotFound({ from = "/" }: { from?: string }) {
  return (
    <section className="container-page py-14 sm:py-20">
      <StatePanel
        icon={SearchX}
        eyebrow="Magia não encontrada"
        title="Este identificador não leva a uma magia."
        description="O endereço pode estar incompleto ou a magia não existe no catálogo. Volte para a biblioteca e continue a busca."
        actions={
          <>
            <Button render={<Link href="/" />} className="bg-forest text-[#f8f1df] hover:bg-forest-deep">
              Ir para a biblioteca
            </Button>
            {from !== "/" ? (
              <Button variant="outline" render={<Link href={from} />}>
                <ArrowLeft className="size-4" aria-hidden="true" />
                Voltar para onde eu estava
              </Button>
            ) : null}
          </>
        }
      />
    </section>
  );
}
