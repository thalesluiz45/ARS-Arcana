"use client";

import {
  BookMarked,
  BookOpenText,
  Bookmark,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react";

import { useLocalData } from "@/components/local-data-provider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
  RESERVED_GRIMOIRE_ID,
  type GrimoireWithCount,
} from "@/lib/validation/grimoire";
import { cn } from "@/lib/utils";

type GrimoireSidebarProps = {
  selectedId: string;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onRename: (grimoire: GrimoireWithCount) => void;
  onDelete: (grimoire: GrimoireWithCount) => void;
  onNavigate?: () => void;
  className?: string;
};

function CollectionButton({
  icon: Icon,
  label,
  total,
  selected,
  onSelect,
}: {
  icon: typeof Bookmark;
  label: string;
  total: number;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={selected ? "true" : undefined}
      className={cn(
        "flex w-full items-center gap-3 rounded-sm border-l-2 border-transparent px-2.5 py-2.5 text-left text-sm transition-colors",
        selected
          ? "border-forest bg-[#e9eee6] font-medium text-forest"
          : "text-[#4d5a52] hover:bg-secondary/70 hover:text-forest",
      )}
    >
      <Icon
        className={cn("size-4 shrink-0", selected ? "text-forest" : "text-muted-foreground")}
        strokeWidth={1.6}
        aria-hidden="true"
      />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <span
        className="min-w-5 text-right text-xs tabular-nums text-muted-foreground"
        aria-label={`${total} ${total === 1 ? "magia" : "magias"}`}
      >
        {total}
      </span>
    </button>
  );
}

export function GrimoireSidebar({
  selectedId,
  onSelect,
  onCreate,
  onRename,
  onDelete,
  onNavigate,
  className,
}: GrimoireSidebarProps) {
  const { status, error, grimoires, reserved, totalUnique, refresh } = useLocalData();

  function select(id: string) {
    onSelect(id);
    onNavigate?.();
  }

  return (
    <div className={cn("min-w-0", className)}>
      <div className="border-b border-border pb-3">
        <h2 className="text-[1.7rem] leading-none text-forest">Minha coleção</h2>
      </div>

      {status === "loading" ? (
        <div className="mt-5 space-y-2.5" role="status" aria-label="Carregando grimórios">
          <div className="h-3 w-24 animate-pulse rounded-sm bg-muted" />
          <div className="h-10 animate-pulse rounded-sm bg-muted" />
          <div className="h-10 animate-pulse rounded-sm bg-muted" />
          <div className="h-10 animate-pulse rounded-sm bg-muted" />
          <span className="sr-only">Carregando seus grimórios…</span>
        </div>
      ) : status === "error" ? (
        <div
          role="alert"
          className="mt-5 rounded-md border border-destructive/30 bg-destructive/5 p-3.5 text-sm"
        >
          <p className="font-medium text-destructive">Coleção indisponível</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {error ?? "Não foi possível acessar os grimórios deste navegador."}
          </p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => void refresh()}>
            <RefreshCw className="size-3.5" aria-hidden="true" />
            Tentar novamente
          </Button>
        </div>
      ) : (
        <>
          <p className="eyebrow mt-5 text-muted-foreground">Seus grimórios</p>

          <nav aria-label="Coleções de magias salvas" className="mt-2">
            <ul className="space-y-1">
              <li>
                <CollectionButton
                  icon={BookMarked}
                  label="Todas as magias"
                  total={totalUnique}
                  selected={selectedId === "todas"}
                  onSelect={() => select("todas")}
                />
              </li>

              {grimoires.map((grimoire) => {
                const selected = selectedId === grimoire.id;
                return (
                  <li
                    key={grimoire.id}
                    className={cn(
                      "flex items-center rounded-sm border-l-2 border-transparent transition-colors",
                      selected
                        ? "border-forest bg-[#e9eee6]"
                        : "hover:bg-secondary/70",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => select(grimoire.id)}
                      aria-current={selected ? "true" : undefined}
                      className={cn(
                        "flex min-w-0 flex-1 items-center gap-3 px-2.5 py-2.5 text-left text-sm transition-colors",
                        selected ? "font-medium text-forest" : "text-[#4d5a52] hover:text-forest",
                      )}
                    >
                      <Bookmark
                        className={cn(
                          "size-4 shrink-0",
                          selected ? "text-forest" : "text-muted-foreground",
                        )}
                        strokeWidth={1.6}
                        aria-hidden="true"
                      />
                      <span className="min-w-0 flex-1 truncate">{grimoire.nome}</span>
                      <span
                        className="min-w-5 text-right text-xs tabular-nums text-muted-foreground"
                        aria-label={`${grimoire.total} ${
                          grimoire.total === 1 ? "magia" : "magias"
                        }`}
                      >
                        {grimoire.total}
                      </span>
                    </button>

                    <DropdownMenu>
                      <DropdownMenuTrigger
                        aria-label={`Gerenciar o grimório ${grimoire.nome}`}
                        className="mr-1 grid size-7 shrink-0 place-items-center rounded-sm text-muted-foreground transition-colors hover:bg-white/70 hover:text-forest focus-visible:outline-offset-1"
                      >
                        <MoreHorizontal className="size-4" aria-hidden="true" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="min-w-40">
                        <DropdownMenuItem onClick={() => onRename(grimoire)}>
                          <Pencil className="size-4" aria-hidden="true" />
                          Renomear
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() => onDelete(grimoire)}
                        >
                          <Trash2 className="size-4" aria-hidden="true" />
                          Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </li>
                );
              })}

              {reserved ? (
                <li>
                  <CollectionButton
                    icon={Bookmark}
                    label="Sem grimório"
                    total={reserved.total}
                    selected={selectedId === RESERVED_GRIMOIRE_ID}
                    onSelect={() => select(RESERVED_GRIMOIRE_ID)}
                  />
                </li>
              ) : null}
            </ul>
          </nav>

          {grimoires.length === 0 ? (
            <p className="mt-3 px-2.5 text-xs leading-relaxed text-muted-foreground">
              Crie um grimório nomeado para separar suas magias por personagem ou campanha.
            </p>
          ) : null}

          <Button
            type="button"
            variant="outline"
            onClick={onCreate}
            className="mt-4 h-10 w-full justify-start rounded-sm border-border bg-card px-3 text-sm font-medium text-forest hover:border-gold/60 hover:bg-secondary/60"
          >
            <Plus className="size-4" aria-hidden="true" />
            Criar grimório
          </Button>

          <div className="mt-7 rounded-md border border-[#dfe6da] bg-[#eef2e9] p-4">
            <div className="flex items-center gap-2 text-forest">
              <BookOpenText className="size-4" strokeWidth={1.6} aria-hidden="true" />
              <p className="font-heading text-[1.05rem] leading-none">Prepare sua aventura</p>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-[#5d6a61]">
              Organize suas magias em grimórios para cada personagem ou campanha.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
