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

import { getErrorMessage } from "@/lib/errors";
import {
  grimoireSchema,
  grimoireSnapshotSchema,
  type Grimoire,
  type GrimoireSnapshot,
  type GrimoireWithCount,
  type SpellSelection,
} from "@/lib/validation/grimoire";

export class AuthRequiredError extends Error {
  constructor(message = "Sua sessão expirou. Entre novamente para continuar.") {
    super(message);
    this.name = "AuthRequiredError";
  }
}

type GrimoireDataStatus = "loading" | "ready" | "unauthenticated" | "error";

type GrimoireDataContextValue = {
  status: GrimoireDataStatus;
  error: string | null;
  snapshot: GrimoireSnapshot | null;
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

const GrimoireDataContext = createContext<GrimoireDataContextValue | null>(null);

const EMPTY_ASSOCIATIONS: GrimoireSnapshot["associations"] = [];

type ApiErrorBody = { error?: unknown; code?: unknown };

async function readApiError(response: Response, fallback: string): Promise<string> {
  try {
    const body = (await response.json()) as ApiErrorBody;
    if (typeof body.error === "string" && body.error.trim()) return body.error;
  } catch {
    // The HTTP status is enough to produce an actionable message.
  }
  return fallback;
}

export function GrimoireDataProvider({ children }: { children: ReactNode }) {
  const [snapshot, setSnapshot] = useState<GrimoireSnapshot | null>(null);
  const [status, setStatus] = useState<GrimoireDataStatus>("loading");
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setStatus((current) => (current === "ready" ? "ready" : "loading"));
    try {
      const response = await fetch("/api/grimorios", {
        cache: "no-store",
        headers: { accept: "application/json" },
      });

      if (response.status === 401) {
        setSnapshot(null);
        setStatus("unauthenticated");
        setError(null);
        return;
      }

      if (!response.ok) {
        throw new Error(
          await readApiError(response, "Não foi possível carregar suas magias salvas."),
        );
      }

      const parsed = grimoireSnapshotSchema.safeParse(await response.json());
      if (!parsed.success) {
        throw new Error("O servidor retornou sua coleção em formato inesperado.");
      }

      setSnapshot(parsed.data);
      setStatus("ready");
      setError(null);
    } catch (cause) {
      setStatus("error");
      setError(getErrorMessage(cause, "Não foi possível carregar suas magias salvas."));
    }
  }, []);

  const requestJson = useCallback(
    async (url: string, init?: RequestInit): Promise<unknown> => {
      let response: Response;
      try {
        response = await fetch(url, {
          cache: "no-store",
          ...init,
          headers: {
            accept: "application/json",
            ...(init?.body ? { "content-type": "application/json" } : {}),
            ...init?.headers,
          },
        });
      } catch {
        throw new Error("Não foi possível conectar ao servidor. Verifique sua conexão.");
      }

      if (response.status === 401) {
        setSnapshot(null);
        setStatus("unauthenticated");
        throw new AuthRequiredError();
      }

      if (!response.ok) {
        throw new Error(
          await readApiError(response, "Não foi possível concluir a operação com seus grimórios."),
        );
      }

      try {
        return await response.json();
      } catch {
        return null;
      }
    },
    [],
  );

  useEffect(() => {
    void refresh();
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

  const createGrimoire = useCallback(
    async (name: string) => {
      const body = await requestJson("/api/grimorios", {
        method: "POST",
        body: JSON.stringify({ nome: name }),
      });
      const parsed = grimoireSchema.safeParse(body);
      if (!parsed.success) {
        throw new Error("O servidor retornou o grimório em formato inesperado.");
      }
      await refresh();
      return parsed.data;
    },
    [refresh, requestJson],
  );

  const renameGrimoire = useCallback(
    async (id: string, name: string) => {
      await requestJson(`/api/grimorios/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify({ nome: name }),
      });
      await refresh();
    },
    [refresh, requestJson],
  );

  const deleteGrimoire = useCallback(
    async (id: string) => {
      await requestJson(`/api/grimorios/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      await refresh();
    },
    [refresh, requestJson],
  );

  const saveSpellSelection = useCallback(
    async (spellId: string, selection: SpellSelection) => {
      await requestJson("/api/magias-salvas", {
        method: "PUT",
        body: JSON.stringify({
          magiaId: spellId,
          grimoireIds: selection.grimoireIds,
          withoutGrimoire: selection.withoutGrimoire,
        }),
      });
      await refresh();
    },
    [refresh, requestJson],
  );

  const value = useMemo<GrimoireDataContextValue>(
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
      saveSpellSelection,
      getGrimoireIdsForSpell,
      isSpellSaved,
    }),
    [
      createGrimoire,
      deleteGrimoire,
      error,
      getGrimoireIdsForSpell,
      isSpellSaved,
      refresh,
      renameGrimoire,
      saveSpellSelection,
      snapshot,
      status,
    ],
  );

  return <GrimoireDataContext.Provider value={value}>{children}</GrimoireDataContext.Provider>;
}

export function useGrimoireData(): GrimoireDataContextValue {
  const value = useContext(GrimoireDataContext);
  if (!value) {
    throw new Error("useGrimoireData deve ser usado dentro de GrimoireDataProvider.");
  }
  return value;
}
