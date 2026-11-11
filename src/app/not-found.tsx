import Link from "next/link";
import { Compass, Home } from "lucide-react";

import { StatePanel } from "@/components/state-panel";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <section className="container-page py-14 sm:py-20">
      <StatePanel
        icon={Compass}
        eyebrow="Página 404"
        title="Este caminho não está no mapa."
        description="A página que você procurou não existe ou foi movida. Volte para a biblioteca para continuar explorando."
        actions={
          <Button render={<Link href="/" />} className="bg-forest text-[#f8f1df] hover:bg-forest/90">
            <Home className="size-4" aria-hidden="true" />
            Voltar para a biblioteca
          </Button>
        }
      />
    </section>
  );
}
