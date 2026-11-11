"use client";

import Link from "next/link";
import { Home, RotateCcw, TriangleAlert } from "lucide-react";

import { StatePanel } from "@/components/state-panel";
import { Button } from "@/components/ui/button";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <section className="container-page py-14 sm:py-20">
      <StatePanel
        icon={TriangleAlert}
        tone="error"
        eyebrow="Algo saiu do previsto"
        title="Não foi possível carregar esta página."
        description="Ocorreu uma falha inesperada. Tente novamente; se o problema continuar, volte para a biblioteca."
        actions={
          <>
            <Button onClick={reset} className="bg-forest text-[#f8f1df] hover:bg-forest/90">
              <RotateCcw className="size-4" aria-hidden="true" />
              Tentar novamente
            </Button>
            <Button variant="outline" render={<Link href="/" />}>
              <Home className="size-4" aria-hidden="true" />
              Ir para a biblioteca
            </Button>
          </>
        }
      />
      {error.digest ? (
        <p className="mt-4 text-center text-xs text-muted-foreground">
          Código de referência: {error.digest}
        </p>
      ) : null}
    </section>
  );
}
