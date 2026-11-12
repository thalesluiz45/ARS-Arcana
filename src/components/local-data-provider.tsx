"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  createGrimoire,
  deleteGrimoire,
  loadLocalCollections,
  renameGrimoire,
  type LocalCollectionsSnapshot,
  type SpellSelection,
  updateSpellSelection,
} from "@/lib/local/grimoires";
import { subscribeToLocalDataChanges } from "@/lib/local/events";
import type { Grimoire, GrimoireWithCount } from "@/lib/validation/grimoire";

type LocalDataStatus = "loading" | "ready" | "error";

type LocalDataContextValue = {
  status: LocalDataStatus;
  error: string | null;
  snapshot: LocalCollectionsSnapshot | null;
  grimoires: GrimoireWithCount[];
  reserved: GrimoireWithCount | null;
  totalUnique: number;
  refresh: () => Promise<void>;
  createGrimoire: (name: string) => Promise<Grimoire>;
  renameGrimoire: (id: string, name: string) => Promise<void>;
  deleteGrimoire: (id: string) => Promise<void>;
  saveSpellSelection: (spellId: string, selection: SpellSelection) => Promise<void>;
  getGrimoireIdsForSpell: (spellId: string) => string[];
  isSpellSaved: (spellId: string) => boolean;
};

const LocalDataContext = createContext<LocalDataContextValue | null>(null);

const EMPTY_ASSOCIATIONS: LocalCollectionsSnapshot["associations"] = [];

export function LocalDataProvider({ children }: { children: ReactNode }) {
  const [snapshot, setSnapshot] = useState<LocalCollectionsSnapshot | null>(null);
  const [status, setStatus] = useState<LocalDataStatus>("loading");
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const next = await loadLocalCollections();
      setSnapshot(next);
      setStatus("ready");
      setError(null);
    } catch (cause) {
      setStatus("error");
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível acessar os grimórios deste navegador.",
      );
    }
  }, []);

  useEffect(() => {
    void refresh();
    return subscribeToLocalDataChanges((detail) => {
      if (detail?.reason === "cache-updated") return;
      void refresh();
    });
  }, [refresh]);

  const associationsBySpell = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const association of snapshot?.associations ?? EMPTY_ASSOCIATIONS) {
      const lists = map.get(association.magiaId) ?? [];
      lists.push(association.listaId);
      map.set(association.magiaId, lists);
    }
    return map;
  }, [snapshot]);

  const getGrimoireIdsForSpell = useCallback(
    (spellId: string) => associationsBySpell.get(spellId) ?? [],
    [associationsBySpell],
  );

  const isSpellSaved = useCallback(
    (spellId: string) => (associationsBySpell.get(spellId)?.length ?? 0) > 0,
    [associationsBySpell],
  );

  const value = useMemo<LocalDataContextValue>(
    () => ({
      status,
      error,
      snapshot,
      grimoires: snapshot?.namedGrimoires ?? [],
      reserved: snapshot?.reserved ?? null,
      totalUnique: snapshot?.totalUnique ?? 0,
      refresh,
      createGrimoire,
      renameGrimoire,
      deleteGrimoire,
      saveSpellSelection: updateSpellSelection,
      getGrimoireIdsForSpell,
      isSpellSaved,
    }),
    [error, getGrimoireIdsForSpell, isSpellSaved, refresh, snapshot, status],
  );

  return <LocalDataContext.Provider value={value}>{children}</LocalDataContext.Provider>;
}

export function useLocalData(): LocalDataContextValue {
  const value = useContext(LocalDataContext);
  if (!value) {
    throw new Error("useLocalData deve ser usado dentro de LocalDataProvider.");
  }
  return value;
}
