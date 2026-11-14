"use client";

import { Loader2, RefreshCw, TriangleAlert } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  clearLegacyCleanupPending,
  clearLegacyListData,
  isLegacyCleanupPending,
} from "@/lib/local/legacy";

type CleanupState = "idle" | "running" | "error";

/**
 * Runs only after an explicit confirmation on the login screen. The flag is
 * set before OAuth starts and consumed here once a server session exists.
 */
export function LegacyDataCleanup() {
  const [state, setState] = useState<CleanupState>("idle");
  const runningRef = useRef(false);

  const runCleanup = useCallback(async () => {
    if (runningRef.current) return;
    runningRef.current = true;
    setState("running");

    try {
      await clearLegacyListData();
      clearLegacyCleanupPending();
      setState("idle");
      toast.success("Dados antigos deste navegador foram removidos.");
    } catch {
      setState("error");
    } finally {
      runningRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (!isLegacyCleanupPending()) return;
    void runCleanup();
  }, [runCleanup]);

  if (state === "idle") return null;

  return (
    <div
      role="alert"
      aria-live="polite"
      className="fixed inset-x-4 bottom-4 z-[80] mx-auto max-w-xl rounded-lg border border-[#d8b46a]/60 bg-[#fbf2df] px-4 py-3.5 shadow-[0_18px_50px_-20px_rgb(20_61_51/0.55)] sm:flex sm:items-center sm:justify-between sm:gap-4"
    >
      <div className="flex items-start gap-2.5">
        {state === "running" ? (
          <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin text-forest" aria-hidden="true" />
        ) : (
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-[#8a6827]" aria-hidden="true" />
        )}
        <div>
          <p className="text-sm font-medium text-foreground">
            {state === "running"
              ? "Removendo dados antigos deste navegador…"
              : "Não foi possível remover os dados antigos."}
          </p>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
            {state === "running"
              ? "Seus grimórios antigos não são usados na conta e serão apagados em seguida."
              : "Esses dados não pertencem à sua conta e continuam bloqueados. Tente novamente para concluir a limpeza."}
          </p>
        </div>
      </div>
      {state === "error" ? (
        <Button
          variant="outline"
          size="sm"
          onClick={() => void runCleanup()}
          className="mt-3 shrink-0 sm:mt-0"
        >
          <RefreshCw className="size-3.5" aria-hidden="true" />
          Tentar novamente
        </Button>
      ) : null}
    </div>
  );
}
