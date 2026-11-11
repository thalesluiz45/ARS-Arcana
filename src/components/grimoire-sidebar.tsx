"use client";

import {
  BookMarked,
  BookOpenText,
  Bookmark,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { useLocalData } from "@/components/local-data-provider";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  RESERVED_GRIMOIRE_ID,
  type Grimoire,
  type GrimoireWithCount,
} from "@/lib/validation/grimoire";
import { cn } from "@/lib/utils";

export type GrimoireDialogState =
  | { type: "create" }
  | { type: "rename"; grimoire: GrimoireWithCount }
  | { type: "delete"; grimoire: GrimoireWithCount }
  | null;

type GrimoireSidebarProps = {
  selectedId: string;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onRename: (grimoire: GrimoireWithCount) => void;
  onDelete: (grimoire: GrimoireWithCount) => void;
  onNavigate?: () => void;
  className?: string;
};

function errorMessage(cause: unknown, fallback: string): string {
  return cause instanceof Error && cause.message ? cause.message : fallback;
}

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

export function GrimoireDialogs({
  state,
  onOpenChange,
  onCreated,
  onDeleted,
}: {
  state: GrimoireDialogState;
  onOpenChange: (open: boolean) => void;
  onCreated?: (grimoire: Grimoire) => void;
  onDeleted?: (id: string) => void;
}) {
  const {
    createGrimoire,
    renameGrimoire,
    deleteGrimoire,
    refresh,
  } = useLocalData();

  const [createName, setCreateName] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const [renameName, setRenameName] = useState("");
  const [renameError, setRenameError] = useState<string | null>(null);
  const [renaming, setRenaming] = useState(false);

  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const renameTarget = state?.type === "rename" ? state.grimoire : null;
  const deleteTarget = state?.type === "delete" ? state.grimoire : null;

  useEffect(() => {
    if (state?.type === "create") {
      setCreateName("");
      setCreateError(null);
      setCreating(false);
    }
  }, [state]);

  useEffect(() => {
    if (renameTarget) {
      setRenameName(renameTarget.nome);
      setRenameError(null);
      setRenaming(false);
    }
  }, [renameTarget]);

  useEffect(() => {
    if (deleteTarget) {
      setDeleteError(null);
      setDeleting(false);
    }
  }, [deleteTarget]);

  async function handleCreate() {
    const name = createName.trim();
    if (!name) {
      setCreateError("Informe um nome para o grimório.");
      return;
    }

    setCreating(true);
    setCreateError(null);
    try {
      const created = await createGrimoire(name);
      await refresh();
      toast.success(`Grimório “${created.nome}” criado.`);
      onCreated?.(created);
      onOpenChange(false);
    } catch (cause) {
      const message = errorMessage(cause, "Não foi possível criar o grimório.");
      setCreateError(message);
      toast.error(message);
    } finally {
      setCreating(false);
    }
  }

  async function handleRename() {
    if (!renameTarget) return;
    const name = renameName.trim();
    if (!name) {
      setRenameError("Informe um nome para o grimório.");
      return;
    }

    setRenaming(true);
    setRenameError(null);
    try {
      await renameGrimoire(renameTarget.id, name);
      await refresh();
      toast.success(`Grimório renomeado para “${name}”.`);
      onOpenChange(false);
    } catch (cause) {
      const message = errorMessage(cause, "Não foi possível renomear o grimório.");
      setRenameError(message);
      toast.error(message);
    } finally {
      setRenaming(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteGrimoire(deleteTarget.id);
      await refresh();
      toast.success(
        `Grimório “${deleteTarget.nome}” excluído. As magias sem outro grimório foram movidas para “Sem grimório”.`,
      );
      onDeleted?.(deleteTarget.id);
      onOpenChange(false);
    } catch (cause) {
      const message = errorMessage(cause, "Não foi possível excluir o grimório.");
      setDeleteError(message);
      toast.error(message);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <Dialog open={state?.type === "create"} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl">Criar grimório</DialogTitle>
            <DialogDescription>
              Dê um nome ao grimório para organizar suas magias por personagem ou campanha.
            </DialogDescription>
          </DialogHeader>

          <div>
            <label htmlFor="criar-grimorio-nome" className="eyebrow text-muted-foreground">
              Nome do grimório
            </label>
            <Input
              id="criar-grimorio-nome"
              value={createName}
              onChange={(event) => setCreateName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void handleCreate();
                }
              }}
              maxLength={60}
              placeholder="Ex.: Campanha da Floresta"
              disabled={creating}
              autoFocus
              className="mt-2 h-10 bg-card"
            />
          </div>

          {createError ? (
            <p role="alert" className="text-sm text-destructive">
              {createError}
            </p>
          ) : null}

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={creating}>
              Cancelar
            </Button>
            <Button
              onClick={() => void handleCreate()}
              disabled={creating}
              className="bg-forest text-[#f8f1df] hover:bg-forest-deep"
            >
              {creating ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Plus className="size-4" aria-hidden="true" />
              )}
              Criar grimório
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={state?.type === "rename"} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl">Renomear grimório</DialogTitle>
            <DialogDescription>
              Atualize o nome de{" "}
              <strong className="font-medium text-foreground">{renameTarget?.nome}</strong>.
            </DialogDescription>
          </DialogHeader>

          <div>
            <label htmlFor="renomear-grimorio-nome" className="eyebrow text-muted-foreground">
              Nome do grimório
            </label>
            <Input
              id="renomear-grimorio-nome"
              value={renameName}
              onChange={(event) => setRenameName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void handleRename();
                }
              }}
              maxLength={60}
              disabled={renaming}
              autoFocus
              className="mt-2 h-10 bg-card"
            />
          </div>

          {renameError ? (
            <p role="alert" className="text-sm text-destructive">
              {renameError}
            </p>
          ) : null}

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={renaming}>
              Cancelar
            </Button>
            <Button
              onClick={() => void handleRename()}
              disabled={renaming}
              className="bg-forest text-[#f8f1df] hover:bg-forest-deep"
            >
              {renaming ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Pencil className="size-4" aria-hidden="true" />
              )}
              Salvar nome
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={state?.type === "delete"} onOpenChange={onOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-destructive/10 text-destructive">
              <Trash2 className="size-5" aria-hidden="true" />
            </AlertDialogMedia>
            <AlertDialogTitle className="text-xl">Excluir grimório?</AlertDialogTitle>
            <AlertDialogDescription>
              O grimório <strong className="font-medium text-foreground">{deleteTarget?.nome}</strong>{" "}
              será excluído. As magias que não estiverem em outro grimório nomeado serão movidas
              para <strong className="font-medium text-foreground">Sem grimório</strong>. Nenhuma
              magia será removida do catálogo.
            </AlertDialogDescription>
          </AlertDialogHeader>

          {deleteError ? (
            <p role="alert" className="text-sm text-destructive">
              {deleteError}
            </p>
          ) : null}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deleting}
              onClick={() => void handleDelete()}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {deleting ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Trash2 className="size-4" aria-hidden="true" />
              )}
              Excluir grimório
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
