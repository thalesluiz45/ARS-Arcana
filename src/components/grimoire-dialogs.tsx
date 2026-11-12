"use client";

import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { useGrimoireData } from "@/components/grimoire-data-provider";
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
import { Input } from "@/components/ui/input";
import { getErrorMessage } from "@/lib/errors";
import type { Grimoire, GrimoireWithCount } from "@/lib/validation/grimoire";

export type GrimoireDialogState =
  | { type: "create" }
  | { type: "rename"; grimoire: GrimoireWithCount }
  | { type: "delete"; grimoire: GrimoireWithCount }
  | null;

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
  const { createGrimoire, renameGrimoire, deleteGrimoire, refresh } = useGrimoireData();

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
      const message = getErrorMessage(cause, "Não foi possível criar o grimório.");
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
      const message = getErrorMessage(cause, "Não foi possível renomear o grimório.");
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
      const message = getErrorMessage(cause, "Não foi possível excluir o grimório.");
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
