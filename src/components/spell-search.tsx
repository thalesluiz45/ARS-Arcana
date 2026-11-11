"use client";

import { useRouter } from "next/navigation";
import { Search, Sparkles, X } from "lucide-react";
import { useEffect, useRef, useState, type RefObject } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function useSlashShortcut(inputRef: RefObject<HTMLInputElement | null>) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select" || target?.isContentEditable) {
        return;
      }
      event.preventDefault();
      inputRef.current?.focus();
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [inputRef]);
}

function SearchInputShell({
  inputRef,
  value,
  onChange,
  onClear,
  placeholder,
  label,
}: {
  inputRef: RefObject<HTMLInputElement | null>;
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
  placeholder: string;
  label: string;
}) {
  return (
    <div className="relative flex min-w-0 flex-1 items-center">
      <Search
        className="pointer-events-none absolute left-4 size-5 text-muted-foreground"
        strokeWidth={1.7}
        aria-hidden="true"
      />
      <Input
        ref={inputRef}
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={label}
        autoComplete="off"
        className="h-12 w-full rounded-md border-0 bg-transparent pr-24 pl-12 text-base shadow-none placeholder:text-muted-foreground/80 focus-visible:border-transparent focus-visible:ring-0 md:text-base [&::-webkit-search-cancel-button]:hidden"
      />
      {value ? (
        <button
          type="button"
          onClick={onClear}
          aria-label="Limpar busca"
          className="absolute right-3 grid size-8 place-items-center rounded-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      ) : (
        <kbd
          aria-hidden="true"
          className="absolute right-4 hidden h-7 min-w-7 place-items-center rounded-sm border border-border bg-parchment px-1.5 text-[0.72rem] font-medium text-muted-foreground sm:grid"
        >
          /
        </kbd>
      )}
    </div>
  );
}

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
