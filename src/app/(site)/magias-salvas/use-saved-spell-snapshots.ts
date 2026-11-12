"use client";

import { useEffect, useState } from "react";

import { getErrorMessage } from "@/lib/errors";
import {
  getSpellSnapshots,
  refreshSpellSnapshots,
  SNAPSHOT_TTL_MS,
  type CachedSpellState,
} from "@/lib/local/spell-cache";
import type { Spell } from "@/lib/validation/spell";

type SnapshotPhase = "idle" | "loading" | "ready" | "error";

function mergeSnapshotStates(
  previous: Map<string, CachedSpellState>,
  next: Map<string, CachedSpellState>,
): Map<string, CachedSpellState> {
  const merged = new Map(previous);
  for (const [id, state] of next) merged.set(id, state);
  return merged;
}

function remoteSnapshotState(spell: Spell): CachedSpellState {
  const now = Date.now();
  return {
    spell,
    cachedAt: new Date(now).toISOString(),
    expiresAt: new Date(now + SNAPSHOT_TTL_MS).toISOString(),
    stale: false,
    missing: false,
  };
}

export function useSavedSpellSnapshots(spellIds: string[], enabled: boolean) {
  const [snapshots, setSnapshots] = useState<Map<string, CachedSpellState>>(new Map());
  const [cachePhase, setCachePhase] = useState<SnapshotPhase>("idle");
  const [cacheError, setCacheError] = useState<string | null>(null);
  const [syncState, setSyncState] = useState<SnapshotPhase>("idle");
  const [syncError, setSyncError] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  const idsKey = spellIds.join(",");

  useEffect(() => {
    if (!enabled) return;

    const ids = idsKey ? idsKey.split(",") : [];
    if (ids.length === 0) {
      setSnapshots(new Map());
      setCacheError(null);
      setCachePhase("ready");
      setSyncError(null);
      setSyncState("idle");
      return;
    }

    let cancelled = false;
    setCacheError(null);
    setCachePhase("loading");
    setSyncError(null);
    setSyncState("loading");

    async function loadSnapshots() {
      try {
        const cached = await getSpellSnapshots(ids);
        if (cancelled) return;
        setSnapshots((previous) => mergeSnapshotStates(previous, cached));
        setCachePhase("ready");
      } catch (cause) {
        if (cancelled) return;
        setCacheError(
          getErrorMessage(cause, "Não foi possível ler as cópias locais das magias."),
        );
        setCachePhase("error");
      }

      try {
        const remote = await refreshSpellSnapshots(ids);
        if (cancelled) return;
        setSnapshots((previous) => {
          const next = new Map(previous);
          for (const spell of remote.values()) next.set(spell.id, remoteSnapshotState(spell));
          return next;
        });
        setSyncState("ready");
      } catch (cause) {
        if (cancelled) return;
        setSyncError(
          getErrorMessage(
            cause,
            "Não foi possível sincronizar os detalhes das magias salvas.",
          ),
        );
        setSyncState("error");
      }
    }

    void loadSnapshots();

    return () => {
      cancelled = true;
    };
  }, [idsKey, enabled, refreshToken]);

  useEffect(() => {
    function handleOnline() {
      setRefreshToken((current) => current + 1);
    }

    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, []);

  function retrySync() {
    setRefreshToken((current) => current + 1);
  }

  return {
    snapshots,
    cachePhase,
    cacheError,
    syncState,
    syncError,
    syncing: syncState === "loading",
    readyForData: enabled && (cachePhase === "ready" || cachePhase === "error"),
    retrySync,
  };
}
