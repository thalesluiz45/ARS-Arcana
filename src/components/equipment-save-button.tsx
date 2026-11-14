"use client";

import { Bookmark, BookmarkCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { useArsenalData } from "@/components/arsenal-data-provider";
import { EquipmentSaveDialog } from "@/components/equipment-save-dialog";
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
  const { status, isSaved } = useArsenalData();
  const [open, setOpen] = useState(false);
  const saved = isSaved(equipment.slug);

  function handleOpen() {
    if (status === "unauthenticated") {
      router.push(currentLoginHref());
      return;
    }
    setOpen(true);
  }

  return (
    <>
      {variant === "icon" ? (
        <button
          type="button"
          onClick={handleOpen}
          aria-label={
            saved
              ? `Gerenciar as mochilas de “${equipment.nome}”`
              : `Salvar “${equipment.nome}” em uma mochila`
          }
          aria-pressed={saved}
          aria-haspopup="dialog"
          title={saved ? "Gerenciar mochilas" : "Salvar em uma mochila"}
          className={cn(
            "grid size-10 shrink-0 place-items-center rounded-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-forest disabled:opacity-60",
            saved && "text-forest",
            className,
          )}
        >
          <Bookmark
            className="size-[1.15rem]"
            strokeWidth={1.6}
            fill={saved ? "currentColor" : "none"}
            aria-hidden="true"
          />
        </button>
      ) : (
        <Button
          type="button"
          variant="outline"
          onClick={handleOpen}
          aria-haspopup="dialog"
          className={cn(
            "h-11 border-border bg-card px-4 text-sm font-medium text-forest hover:border-gold/60 hover:bg-secondary/60",
            className,
          )}
        >
          {saved ? (
            <BookmarkCheck className="size-4" aria-hidden="true" />
          ) : (
            <Bookmark className="size-4" aria-hidden="true" />
          )}
          {saved ? "No seu Arsenal" : "Salvar no Arsenal"}
        </Button>
      )}

      <EquipmentSaveDialog open={open} onOpenChange={setOpen} equipment={equipment} />
    </>
  );
}
