import { Compass } from "lucide-react";
import Link from "next/link";

import { StatePanel } from "@/components/state-panel";
import { Button } from "@/components/ui/button";

export function EquipmentNotFound({ from }: { from: string }) {
  const fromArsenal = from.startsWith("/arsenal");
  return (
    <section className="container-page py-14 sm:py-20">
      <StatePanel
        icon={Compass}
        eyebrow="Equipamento indisponível"
        title="Este equipamento não foi encontrado."
        description="O item não existe no catálogo ou o endereço está incorreto. Volte para continuar explorando os equipamentos disponíveis."
        actions={
          <>
            <Button
              render={<Link href={from} />}
              className="bg-forest text-[#f8f1df] hover:bg-forest-deep"
            >
              {fromArsenal ? "Voltar ao Arsenal" : "Voltar ao catálogo"}
            </Button>
            {fromArsenal ? (
              <Button variant="outline" render={<Link href="/equipamento" />}>
                Ver equipamentos
              </Button>
            ) : null}
          </>
        }
      />
    </section>
  );
}
