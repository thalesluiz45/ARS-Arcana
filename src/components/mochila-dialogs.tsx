"use client";

import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { useArsenalData } from "@/components/arsenal-data-provider";
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
import type { Mochila, MochilaWithCount } from "@/lib/validation/mochila";

export type MochilaDialogState =
  | { type: "create" }
  | { type: "rename"; mochila: MochilaWithCount }
  | { type: "delete"; mochila: MochilaWithCount }
  | null;

export function MochilaDialogs({
  state,
  onOpenChange,
  onCreated,
  onDeleted,
}: {
  state: MochilaDialogState;
  onOpenChange: (open: boolean) => void;
  onCreated?: (mochila: Mochila) => void;
  onDeleted?: (id: string) => void;
}) {
  const { createMochila, renameMochila, deleteMochila, refresh } = useArsenalData();

  const [createName, setCreateName] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const [renameName, setRenameName] = useState("");
  const [renameError, setRenameError] = useState<string | null>(null);
  const [renaming, setRenaming] = useState(false);

  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const renameTarget = state?.type === "rename" ? state.mochila : null;
  const deleteTarget = state?.type === "delete" ? state.mochila : null;

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
      setCreateError("Informe um nome para a mochila.");
      return;
    }

    setCreating(true);
    setCreateError(null);
    try {
      const created = await createMochila(name);
      await refresh();
      toast.success(`Mochila “${created.nome}” criada.`);
      onCreated?.(created);
      onOpenChange(false);
    } catch (cause) {
      const message = getErrorMessage(cause, "Não foi possível criar a mochila.");
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
      setRenameError("Informe um nome para a mochila.");
      return;
    }

    setRenaming(true);
    setRenameError(null);
    try {
      await renameMochila(renameTarget.id, name);
      await refresh();
      toast.success(`Mochila renomeada para “${name}”.`);
      onOpenChange(false);
    } catch (cause) {
      const message = getErrorMessage(cause, "Não foi possível renomear a mochila.");
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
      await deleteMochila(deleteTarget.id);
      await refresh();
      toast.success(
        `Mochila “${deleteTarget.nome}” excluída. Os equipamentos sem outra mochila foram movidos para “Sem mochila”.`,
      );
      onDeleted?.(deleteTarget.id);
      onOpenChange(false);
    } catch (cause) {
      const message = getErrorMessage(cause, "Não foi possível excluir a mochila.");
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
            <DialogTitle className="text-xl">Criar mochila</DialogTitle>
            <DialogDescription>
              Dê um nome à mochila para organizar seus equipamentos por personagem ou
              campanha.
            </DialogDescription>
          </DialogHeader>

          <div>
            <label htmlFor="criar-mochila-nome" className="eyebrow text-muted-foreground">
              Nome da mochila
            </label>
            <Input
              id="criar-mochila-nome"
              value={createName}
              onChange={(event) => setCreateName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void handleCreate();
                }
              }}
              maxLength={60}
              placeholder="Ex.: Kit de exploração"
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
              Criar mochila
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={state?.type === "rename"} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl">Renomear mochila</DialogTitle>
            <DialogDescription>
              Atualize o nome de{" "}
              <strong className="font-medium text-foreground">{renameTarget?.nome}</strong>.
            </DialogDescription>
          </DialogHeader>

          <div>
            <label htmlFor="renomear-mochila-nome" className="eyebrow text-muted-foreground">
              Nome da mochila
            </label>
            <Input
              id="renomear-mochila-nome"
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
            <AlertDialogTitle className="text-xl">Excluir mochila?</AlertDialogTitle>
            <AlertDialogDescription>
              A mochila{" "}
              <strong className="font-medium text-foreground">{deleteTarget?.nome}</strong>{" "}
              será excluída. Os equipamentos que não estiverem em outra mochila nomeada serão
              movidos para{" "}
              <strong className="font-medium text-foreground">Sem mochila</strong>. Nenhum
              equipamento será removido do catálogo.
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
              Excluir mochila
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
