"use client";

import { Search, X } from "lucide-react";
import { useEffect, type RefObject } from "react";

import { Input } from "@/components/ui/input";

export function useSlashShortcut(inputRef: RefObject<HTMLInputElement | null>) {
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

export function SearchInputShell({
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
