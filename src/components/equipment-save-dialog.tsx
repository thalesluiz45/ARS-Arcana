"use client";

import { Bookmark, BookmarkCheck, Loader2, Plus, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import {
  ArsenalAuthRequiredError,
  useArsenalData,
} from "@/components/arsenal-data-provider";
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
import { currentLoginHref } from "@/lib/navigation";
import type { Equipment } from "@/lib/validation/equipment";
import { cn } from "@/lib/utils";

export function EquipmentSaveDialog({
  open,
  onOpenChange,
  equipment,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  equipment: Pick<Equipment, "slug" | "nome">;
}) {
  const router = useRouter();
  const {
    status,
    error,
    mochilas,
    reserved,
    refresh,
    createMochila,
    saveEquipmentSelection,
    getMochilaIdsForEquipment,
  } = useArsenalData();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [includeReserved, setIncludeReserved] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);

  const getIdsRef = useRef(getMochilaIdsForEquipment);
  const namedIdsRef = useRef<Set<string>>(new Set());
  const reservedIdRef = useRef<string | null>(null);

  useEffect(() => {
    getIdsRef.current = getMochilaIdsForEquipment;
  }, [getMochilaIdsForEquipment]);

  useEffect(() => {
    namedIdsRef.current = new Set(mochilas.map((mochila) => mochila.id));
  }, [mochilas]);

  useEffect(() => {
    reservedIdRef.current = reserved?.id ?? null;
  }, [reserved]);

  useEffect(() => {
    if (!open || status !== "ready") return;
    const current = getIdsRef.current(equipment.slug);
    const namedIds = namedIdsRef.current;
    setSelectedIds(new Set(current.filter((id) => namedIds.has(id))));
    setIncludeReserved(
      Boolean(reservedIdRef.current && current.includes(reservedIdRef.current)),
    );
    setNewName("");
    setInlineError(null);
  }, [open, equipment.slug, status]);

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
      setInlineError("Informe um nome para a mochila.");
      return;
    }
    setCreating(true);
    setInlineError(null);
    try {
      const created = await createMochila(name);
      setSelectedIds((previous) => new Set(previous).add(created.id));
      setIncludeReserved(false);
      setNewName("");
      toast.success(`Mochila “${created.nome}” criada.`);
    } catch (cause) {
      if (cause instanceof ArsenalAuthRequiredError) {
        onOpenChange(false);
        router.push(currentLoginHref());
        return;
      }
      const message =
        cause instanceof Error ? cause.message : "Não foi possível criar a mochila.";
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
      await saveEquipmentSelection(equipment.slug, {
        mochilaIds: [...selectedIds],
        withoutMochila: includeReserved,
      });
      const total = selectedIds.size + (includeReserved ? 1 : 0);
      if (total === 0) {
        toast.success(`“${equipment.nome}” foi removido das suas mochilas.`);
      } else if (includeReserved) {
        toast.success(`“${equipment.nome}” foi salvo em Sem mochila.`);
      } else {
        const names = mochilas
          .filter((mochila) => selectedIds.has(mochila.id))
          .map((mochila) => mochila.nome);
        toast.success(
          names.length === 1
            ? `“${equipment.nome}” foi salvo em “${names[0]}”.`
            : `“${equipment.nome}” foi salvo em ${total} mochilas.`,
        );
      }
      onOpenChange(false);
    } catch (cause) {
      if (cause instanceof ArsenalAuthRequiredError) {
        onOpenChange(false);
        router.push(currentLoginHref());
        return;
      }
      const message =
        cause instanceof Error ? cause.message : "Não foi possível salvar o equipamento.";
      setInlineError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  const ready = status === "ready";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl">Organizar equipamento</DialogTitle>
          <DialogDescription>
            Escolha onde guardar{" "}
            <strong className="font-medium text-foreground">{equipment.nome}</strong>. Você
            pode marcar várias mochilas nomeadas.
          </DialogDescription>
        </DialogHeader>

        {status === "loading" ? (
          <div className="flex items-center gap-3 rounded-md border border-border bg-muted/40 px-4 py-6 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            Carregando suas mochilas…
          </div>
        ) : null}

        {status === "unauthenticated" ? (
          <div
            role="alert"
            className="rounded-md border border-gold/35 bg-parchment/70 px-4 py-4 text-sm"
          >
            <p className="font-medium text-forest">Entre para salvar seus equipamentos</p>
            <p className="mt-1 text-muted-foreground">
              Sua coleção fica associada à sua conta Google e disponível em qualquer
              dispositivo.
            </p>
            <Button
              size="sm"
              className="mt-3 bg-forest text-[#f8f1df] hover:bg-forest-deep"
              onClick={() => {
                onOpenChange(false);
                router.push(currentLoginHref());
              }}
            >
              Entrar com Google
            </Button>
          </div>
        ) : null}

        {status === "error" ? (
          <div
            role="alert"
            className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-4 text-sm"
          >
            <p className="font-medium text-destructive">Arsenal indisponível</p>
            <p className="mt-1 text-muted-foreground">
              {error ?? "Não foi possível acessar as mochilas da sua conta."}
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
              <legend className="eyebrow text-muted-foreground">Mochilas nomeadas</legend>
              <div className="mt-2 max-h-56 space-y-0.5 overflow-y-auto pr-1">
                {mochilas.length === 0 ? (
                  <p className="rounded-md border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">
                    Você ainda não tem mochilas nomeadas. Crie a primeira abaixo.
                  </p>
                ) : (
                  mochilas.map((mochila) => (
                    <label
                      key={mochila.id}
                      htmlFor={`salvar-${mochila.id}`}
                      className={cn(
                        "flex cursor-pointer items-center gap-3 rounded-sm px-2 py-2.5 text-sm transition-colors hover:bg-secondary/60",
                        selectedIds.has(mochila.id) && "bg-secondary/80",
                      )}
                    >
                      <Checkbox
                        id={`salvar-${mochila.id}`}
                        checked={selectedIds.has(mochila.id)}
                        onCheckedChange={() => toggleNamed(mochila.id)}
                      />
                      <span className="flex-1">{mochila.nome}</span>
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {mochila.total}
                      </span>
                    </label>
                  ))
                )}
              </div>
            </fieldset>

            <div className="rounded-md border border-gold/25 bg-parchment/60 p-3">
              <label
                htmlFor="salvar-sem-mochila"
                className="flex cursor-pointer items-start gap-3 text-sm"
              >
                <Checkbox
                  id="salvar-sem-mochila"
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
                    Sem mochila
                  </span>
                  <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                    Coleção reservada para equipamentos sem mochila nomeada. É exclusiva:
                    ao marcar, as mochilas nomeadas serão desmarcadas.
                    {reserved ? ` ${reserved.total} equipamento(s) aqui.` : ""}
                  </span>
                </span>
              </label>
            </div>

            <div>
              <label htmlFor="nova-mochila-dialog" className="eyebrow text-muted-foreground">
                Criar nova mochila
              </label>
              <div className="mt-2 flex gap-2">
                <Input
                  id="nova-mochila-dialog"
                  value={newName}
                  onChange={(event) => setNewName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void handleCreate();
                    }
                  }}
                  maxLength={60}
                  placeholder="Ex.: Kit de exploração"
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

