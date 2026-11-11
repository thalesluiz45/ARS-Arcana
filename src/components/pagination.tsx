import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";

type PageItem = number | "ellipsis-start" | "ellipsis-end";

export function getPageItems(current: number, total: number): PageItem[] {
  if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1);

  const items: PageItem[] = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);

  if (start > 2) items.push("ellipsis-start");
  for (let page = start; page <= end; page += 1) items.push(page);
  if (end < total - 1) items.push("ellipsis-end");
  items.push(total);

  return items;
}

type PaginationProps = {
  currentPage: number;
  pageCount: number;
  hrefForPage: (page: number) => string;
  onPageChange?: (page: number) => void;
  className?: string;
  label?: string;
};

export function Pagination({
  currentPage,
  pageCount,
  hrefForPage,
  onPageChange,
  className,
  label = "Paginação",
}: PaginationProps) {
  if (pageCount <= 1) return null;

  const items = getPageItems(currentPage, pageCount);

  return (
    <nav aria-label={label} className={cn("flex flex-wrap items-center justify-center gap-2", className)}>
      {currentPage > 1 ? (
        <Link
          href={hrefForPage(currentPage - 1)}
          rel="prev"
          onClick={
            onPageChange
              ? (event) => {
                  event.preventDefault();
                  onPageChange(currentPage - 1);
                }
              : undefined
          }
          className="inline-flex h-10 items-center gap-1.5 rounded-md border border-border bg-card px-3 text-sm text-foreground transition-colors hover:bg-secondary"
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
          <span className="hidden sm:inline">Anterior</span>
          <span className="sr-only sm:hidden">Página anterior</span>
        </Link>
      ) : (
        <span
          aria-disabled="true"
          className="inline-flex h-10 items-center gap-1.5 rounded-md border border-border bg-card px-3 text-sm text-muted-foreground/55"
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
          <span className="hidden sm:inline">Anterior</span>
          <span className="sr-only sm:hidden">Página anterior</span>
        </span>
      )}

      <ul className="flex items-center gap-1.5">
        {items.map((item) =>
          typeof item === "number" ? (
            <li key={item}>
              <Link
                href={hrefForPage(item)}
                aria-current={item === currentPage ? "page" : undefined}
                aria-label={`Página ${item}`}
                onClick={
                  onPageChange
                    ? (event) => {
                        event.preventDefault();
                        onPageChange(item);
                      }
                    : undefined
                }
                className={cn(
                  "grid size-10 place-items-center rounded-md border text-sm transition-colors",
                  item === currentPage
                    ? "border-forest bg-forest font-semibold text-[#f8f1df]"
                    : "border-border bg-card text-foreground hover:bg-secondary",
                )}
              >
                {item}
              </Link>
            </li>
          ) : (
            <li key={item} aria-hidden="true" className="px-1 text-sm text-muted-foreground">
              …
            </li>
          ),
        )}
      </ul>

      {currentPage < pageCount ? (
        <Link
          href={hrefForPage(currentPage + 1)}
          rel="next"
          onClick={
            onPageChange
              ? (event) => {
                  event.preventDefault();
                  onPageChange(currentPage + 1);
                }
              : undefined
          }
          className="inline-flex h-10 items-center gap-1.5 rounded-md border border-border bg-card px-3 text-sm text-foreground transition-colors hover:bg-secondary"
        >
          <span className="hidden sm:inline">Próxima página</span>
          <span className="sr-only sm:hidden">Próxima página</span>
          <ChevronRight className="size-4" aria-hidden="true" />
        </Link>
      ) : (
        <span
          aria-disabled="true"
          className="inline-flex h-10 items-center gap-1.5 rounded-md border border-border bg-card px-3 text-sm text-muted-foreground/55"
        >
          <span className="hidden sm:inline">Próxima página</span>
          <span className="sr-only sm:hidden">Próxima página</span>
          <ChevronRight className="size-4" aria-hidden="true" />
        </span>
      )}
    </nav>
  );
}
