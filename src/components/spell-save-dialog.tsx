"use client";

import { Bookmark, BookmarkCheck, Loader2, Plus, RefreshCw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { useLocalData } from "@/components/local-data-provider";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { RESERVED_GRIMOIRE_ID } from "@/lib/validation/grimoire";
import { cn } from "@/lib/utils";

function associationKey(spellId: string) {
  return `spell-dialog:${spellId}`;
}

export function SpellSaveDialog({
  open,
  onOpenChange,
  spellId,
  spellName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  spellId: string;
  spellName: string;
}) {
  const {
    status,
    error,
    grimoires,
    reserved,
    refresh,
    createGrimoire,
    saveSpellSelection,
    getGrimoireIdsForSpell,
  } = useLocalData();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [includeReserved, setIncludeReserved] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);

  const getIdsRef = useRef(getGrimoireIdsForSpell);
  useEffect(() => {
    getIdsRef.current = getGrimoireIdsForSpell;
  }, [getGrimoireIdsForSpell]);

  useEffect(() => {
    if (!open || status !== "ready") return;
    const current = getIdsRef.current(spellId);
    setSelectedIds(new Set(current.filter((id) => id !== RESERVED_GRIMOIRE_ID)));
    setIncludeReserved(current.includes(RESERVED_GRIMOIRE_ID));
    setNewName("");
    setInlineError(null);
  }, [open, spellId, status]);

  function toggleNamed(id: string) {
    setSelectedIds((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setIncludeReserved(false);
  }

  async function handleCreate() {
    const name = newName.trim();
    if (!name) {
      setInlineError("Informe um nome para o grimório.");
      return;
    }
    setCreating(true);
    setInlineError(null);
    try {
      const created = await createGrimoire(name);
      setSelectedIds((previous) => new Set(previous).add(created.id));
      setIncludeReserved(false);
      setNewName("");
      toast.success(`Grimório “${created.nome}” criado.`);
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : "Não foi possível criar o grimório.";
      setInlineError(message);
      toast.error(message);
    } finally {
      setCreating(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setInlineError(null);
    try {
      await saveSpellSelection(spellId, {
        grimoireIds: [...selectedIds],
        withoutGrimoire: includeReserved,
      });
      const total = selectedIds.size + (includeReserved ? 1 : 0);
      if (total === 0) {
        toast.success(`“${spellName}” foi removida dos seus grimórios.`);
      } else if (includeReserved) {
        toast.success(`“${spellName}” foi salva em Sem grimório.`);
      } else {
        const names = grimoires
          .filter((grimoire) => selectedIds.has(grimoire.id))
          .map((grimoire) => grimoire.nome);
        toast.success(
          names.length === 1
            ? `“${spellName}” foi salva em “${names[0]}”.`
            : `“${spellName}” foi salva em ${total} grimórios.`,
        );
      }
      onOpenChange(false);
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : "Não foi possível salvar a magia.";
      setInlineError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  const ready = status === "ready";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid={associationKey(spellId)}>
        <DialogHeader>
          <DialogTitle className="text-xl">Organizar magia</DialogTitle>
          <DialogDescription>
            Escolha onde guardar <strong className="font-medium text-foreground">{spellName}</strong>.
            Você pode marcar vários grimórios nomeados.
          </DialogDescription>
        </DialogHeader>

        {status === "loading" ? (
          <div className="flex items-center gap-3 rounded-md border border-border bg-muted/40 px-4 py-6 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            Carregando seus grimórios…
          </div>
        ) : null}

        {status === "error" ? (
          <div role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-4 text-sm">
            <p className="font-medium text-destructive">Armazenamento local indisponível</p>
            <p className="mt-1 text-muted-foreground">
              {error ?? "Não foi possível acessar os grimórios deste navegador."}
            </p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => void refresh()}>
              <RefreshCw className="size-3.5" aria-hidden="true" />
              Tentar novamente
            </Button>
          </div>
        ) : null}

        {ready ? (
          <div className="space-y-5">
            <fieldset>
              <legend className="eyebrow text-muted-foreground">Grimórios nomeados</legend>
              <div className="mt-2 max-h-56 space-y-0.5 overflow-y-auto pr-1">
                {grimoires.length === 0 ? (
                  <p className="rounded-md border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">
                    Você ainda não tem grimórios nomeados. Crie o primeiro abaixo.
                  </p>
                ) : (
                  grimoires.map((grimoire) => (
                    <label
                      key={grimoire.id}
                      htmlFor={`salvar-${grimoire.id}`}
                      className={cn(
                        "flex cursor-pointer items-center gap-3 rounded-sm px-2 py-2.5 text-sm transition-colors hover:bg-secondary/60",
                        selectedIds.has(grimoire.id) && "bg-secondary/80",
                      )}
                    >
                      <Checkbox
                        id={`salvar-${grimoire.id}`}
                        checked={selectedIds.has(grimoire.id)}
                        onCheckedChange={() => toggleNamed(grimoire.id)}
                      />
                      <span className="flex-1">{grimoire.nome}</span>
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {grimoire.total}
                      </span>
                    </label>
                  ))
                )}
              </div>
            </fieldset>

            <div className="rounded-md border border-gold/25 bg-parchment/60 p-3">
              <label
                htmlFor="salvar-sem-grimorio"
                className="flex cursor-pointer items-start gap-3 text-sm"
              >
                <Checkbox
                  id="salvar-sem-grimorio"
                  checked={includeReserved}
                  onCheckedChange={(checked) => {
                    setIncludeReserved(checked);
                    if (checked) setSelectedIds(new Set());
                  }}
                  className="mt-0.5"
                />
                <span>
                  <span className="flex items-center gap-2 font-medium text-forest">
                    <Bookmark className="size-3.5" aria-hidden="true" />
                    Sem grimório
                  </span>
                  <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                    Coleção reservada para magias sem grimório nomeado. É exclusiva: ao marcar,
                    os grimórios nomeados serão desmarcados.
                    {reserved ? ` ${reserved.total} magia(s) aqui.` : ""}
                  </span>
                </span>
              </label>
            </div>

            <div>
              <label htmlFor="novo-grimorio-dialog" className="eyebrow text-muted-foreground">
                Criar novo grimório
              </label>
              <div className="mt-2 flex gap-2">
                <Input
                  id="novo-grimorio-dialog"
                  value={newName}
                  onChange={(event) => setNewName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void handleCreate();
                    }
                  }}
                  maxLength={60}
                  placeholder="Ex.: Campanha da Floresta"
                  disabled={creating}
                  className="h-10 bg-card"
                />
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 shrink-0"
                  disabled={creating}
                  onClick={() => void handleCreate()}
                >
                  {creating ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Plus className="size-4" aria-hidden="true" />
                  )}
                  Criar
                </Button>
              </div>
            </div>

            {inlineError ? (
              <p role="alert" className="text-sm text-destructive">
                {inlineError}
              </p>
            ) : null}
          </div>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button
            onClick={() => void handleSave()}
            disabled={!ready || saving}
            className="bg-forest text-[#f8f1df] hover:bg-forest-deep"
          >
            {saving ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <BookmarkCheck className="size-4" aria-hidden="true" />
            )}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function SpellSaveButton({
  spellId,
  spellName,
  variant = "icon",
  className,
  ariaLabel,
}: {
  spellId: string;
  spellName: string;
  variant?: "icon" | "labelled";
  className?: string;
  ariaLabel?: string;
}) {
  const { isSpellSaved } = useLocalData();
  const [open, setOpen] = useState(false);
  const saved = isSpellSaved(spellId);

  return (
    <>
      {variant === "icon" ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={
            ariaLabel ??
            (saved ? `Gerenciar grimórios de ${spellName}` : `Salvar “${spellName}” em um grimório`)
          }
          aria-haspopup="dialog"
          className={cn(
            "grid size-10 shrink-0 place-items-center rounded-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-forest",
            saved && "text-forest",
            className,
          )}
        >
          <Bookmark
            className="size-[1.15rem]"
            strokeWidth={1.6}
            fill={saved ? "currentColor" : "none"}
            aria-hidden="true"
          />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-haspopup="dialog"
          className={cn(
            "inline-flex h-11 items-center justify-center gap-2 rounded-md border border-border bg-card px-4 text-sm font-medium text-forest transition-colors hover:border-gold/60 hover:bg-secondary/60",
            className,
          )}
        >
          <Bookmark
            className="size-4"
            strokeWidth={1.7}
            fill={saved ? "currentColor" : "none"}
            aria-hidden="true"
          />
          {saved ? "Nos seus grimórios" : "Salvar em grimório"}
        </button>
      )}
      <SpellSaveDialog
        open={open}
        onOpenChange={setOpen}
        spellId={spellId}
        spellName={spellName}
      />
    </>
  );
}
