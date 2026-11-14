"use client";

import { Bookmark, BookmarkCheck, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import {
  ArsenalAuthRequiredError,
  useArsenalData,
} from "@/components/arsenal-data-provider";
import { Button } from "@/components/ui/button";
import { currentLoginHref } from "@/lib/navigation";
import type { Equipment } from "@/lib/validation/equipment";
import { cn } from "@/lib/utils";

export function EquipmentSaveButton({
  equipment,
  variant = "icon",
  className,
}: {
  equipment: Pick<Equipment, "slug" | "nome">;
  variant?: "icon" | "labelled";
  className?: string;
}) {
  const router = useRouter();
  const { status, error, isSaved, save, remove } = useArsenalData();
  const [pending, setPending] = useState(false);
  const saved = isSaved(equipment.slug);

  async function handleClick() {
    if (pending) return;

    if (status === "unauthenticated") {
      router.push(currentLoginHref());
      return;
    }

    if (status === "loading") {
      toast.info("Seu Arsenal ainda está carregando. Tente novamente em instantes.");
      return;
    }

    if (status === "error") {
      toast.error("Seu Arsenal não está disponível agora.", {
        description: error ?? "Tente novamente em instantes.",
      });
      return;
    }

    setPending(true);
    try {
      if (saved) {
        await remove(equipment.slug);
        toast.success(`${equipment.nome} foi removido do seu Arsenal.`);
      } else {
        await save(equipment.slug);
        toast.success(`${equipment.nome} foi salvo no seu Arsenal.`, {
          description: "Consulte os itens salvos em Arsenal, no menu da sua conta.",
        });
      }
    } catch (cause) {
      if (cause instanceof ArsenalAuthRequiredError) {
        toast.error("Sua sessão expirou. Entre novamente para continuar.");
        router.push(currentLoginHref());
        return;
      }
      toast.error(
        cause instanceof Error && cause.message
          ? cause.message
          : "Não foi possível atualizar o seu Arsenal.",
      );
    } finally {
      setPending(false);
    }
  }

  if (variant === "icon") {
    return (
      <button
        type="button"
        onClick={() => void handleClick()}
        disabled={pending}
        aria-label={
          saved
            ? `Remover “${equipment.nome}” do Arsenal`
            : `Salvar “${equipment.nome}” no Arsenal`
        }
        aria-pressed={saved}
        aria-busy={pending}
        title={saved ? "Remover do Arsenal" : "Salvar no Arsenal"}
        className={cn(
          "grid size-10 shrink-0 place-items-center rounded-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-forest disabled:opacity-60",
          saved && "text-forest",
          className,
        )}
      >
        {pending ? (
          <Loader2 className="size-[1.1rem] animate-spin" aria-hidden="true" />
        ) : (
          <Bookmark
            className="size-[1.15rem]"
            strokeWidth={1.6}
            fill={saved ? "currentColor" : "none"}
            aria-hidden="true"
          />
        )}
      </button>
    );
  }

  return (
    <Button
      type="button"
      variant="outline"
      onClick={() => void handleClick()}
      disabled={pending}
      aria-busy={pending}
      className={cn(
        "h-11 border-border bg-card px-4 text-sm font-medium text-forest hover:border-gold/60 hover:bg-secondary/60",
        className,
      )}
    >
      {pending ? (
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
      ) : saved ? (
        <BookmarkCheck className="size-4" aria-hidden="true" />
      ) : (
        <Bookmark className="size-4" aria-hidden="true" />
      )}
      {saved ? "Remover do Arsenal" : "Salvar no Arsenal"}
    </Button>
  );
}
