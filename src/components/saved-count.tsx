"use client";

import { useLocalData } from "@/components/local-data-provider";

export function SavedCount({ className }: { className?: string }) {
  const { status, totalUnique, error } = useLocalData();

  if (status === "loading") {
    return (
      <span
        aria-label="Carregando quantidade de magias salvas"
        className={`${className ?? ""} inline-block h-4 w-5 animate-pulse rounded-sm bg-current/20`}
      />
    );
  }

  if (status === "error") {
    return (
      <span className={className} title={error ?? "Armazenamento local indisponível"}>
        —
      </span>
    );
  }

  return (
    <span className={className} aria-label={`${totalUnique} magias salvas`}>
      {totalUnique}
    </span>
  );
}
