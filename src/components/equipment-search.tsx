"use client";

import { useRouter } from "next/navigation";
import { Swords } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { useArsenalData } from "@/components/arsenal-data-provider";
import { SearchInputShell, useSlashShortcut } from "@/components/search-input-shell";
import { Button } from "@/components/ui/button";

export function EquipmentSearchBar({
  initialQuery,
  currentSearch,
}: {
  initialQuery: string;
  currentSearch: string;
}) {
  const router = useRouter();
  const { status } = useArsenalData();
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState(initialQuery);

  useEffect(() => {
    setValue(initialQuery);
  }, [initialQuery]);

  useSlashShortcut(inputRef);

  function buildHref(query: string) {
    const params = new URLSearchParams(currentSearch);
    const trimmed = query.trim();
    if (trimmed) params.set("q", trimmed);
    else params.delete("q");
    params.delete("page");
    const queryString = params.toString();
    return queryString ? `/equipamento?${queryString}` : "/equipamento";
  }

  function arsenalHref() {
    // Visitantes sem sessão não têm Arsenal: a busca continua no catálogo público.
    // A sessão só é exigida para salvar o equipamento em uma lista.
    if (status === "unauthenticated") return buildHref(value);

    const trimmed = value.trim();
    return trimmed ? `/arsenal?q=${encodeURIComponent(trimmed)}` : "/arsenal";
  }

  return (
    <form
      role="search"
      onSubmit={(event) => {
        event.preventDefault();
        router.push(buildHref(value));
      }}
      className="search-surface flex flex-col gap-2 p-2 sm:flex-row sm:items-center"
    >
      <SearchInputShell
        inputRef={inputRef}
        value={value}
        onChange={setValue}
        onClear={() => {
          setValue("");
          router.push(buildHref(""));
        }}
        placeholder="Qual equipamento você procura?"
        label="Buscar equipamentos por nome, descrição ou categoria"
      />
      <Button
        type="button"
        onClick={() => router.push(arsenalHref())}
        className="h-12 rounded-md bg-forest px-6 text-sm font-medium text-[#f8f1df] hover:bg-forest-deep sm:min-w-[190px]"
      >
        <Swords className="size-4 text-gold" aria-hidden="true" />
        Buscar no arsenal
      </Button>
    </form>
  );
}

export function ArsenalSearchBar({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  useSlashShortcut(inputRef);

  return (
    <form
      role="search"
      onSubmit={(event) => event.preventDefault()}
      className="search-surface p-2"
    >
      <SearchInputShell
        inputRef={inputRef}
        value={value}
        onChange={onChange}
        onClear={() => onChange("")}
        placeholder="Pesquisar no seu Arsenal"
        label="Pesquisar nos equipamentos salvos"
      />
    </form>
  );
}
