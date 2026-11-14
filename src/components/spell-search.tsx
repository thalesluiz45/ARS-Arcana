"use client";

import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { SearchInputShell, useSlashShortcut } from "@/components/search-input-shell";
import { Button } from "@/components/ui/button";

export function CatalogSearchBar({
  initialQuery,
  currentSearch,
}: {
  initialQuery: string;
  currentSearch: string;
}) {
  const router = useRouter();
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
    params.delete("cursor");
    const queryString = params.toString();
    return queryString ? `/?${queryString}` : "/";
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
        placeholder="Qual magia você procura?"
        label="Buscar magias por nome ou descrição"
      />
      <Button
        type="submit"
        className="h-12 rounded-md bg-forest px-6 text-sm font-medium text-[#f8f1df] hover:bg-forest-deep sm:min-w-[190px]"
      >
        <Sparkles className="size-4 text-gold" aria-hidden="true" />
        Buscar magias
      </Button>
    </form>
  );
}

export function SavedSearchBar({
  value,
  onChange,
  onCatalogSearch,
}: {
  value: string;
  onChange: (value: string) => void;
  onCatalogSearch: (value: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  useSlashShortcut(inputRef);

  return (
    <form
      role="search"
      onSubmit={(event) => {
        event.preventDefault();
        onCatalogSearch(value.trim());
      }}
      className="search-surface flex flex-col gap-2 p-2 sm:flex-row sm:items-center"
    >
      <SearchInputShell
        inputRef={inputRef}
        value={value}
        onChange={onChange}
        onClear={() => onChange("")}
        placeholder="Pesquisar nas suas magias salvas"
        label="Pesquisar nas magias salvas"
      />
      <Button
        type="submit"
        className="h-12 rounded-md bg-forest px-6 text-sm font-medium text-[#f8f1df] hover:bg-forest-deep sm:min-w-[190px]"
      >
        <Sparkles className="size-4 text-gold" aria-hidden="true" />
        Buscar magias
      </Button>
    </form>
  );
}
