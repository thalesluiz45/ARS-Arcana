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
import type { Equipment } from "@/lib/validation/equipment";
import {
  mochilaSchema,
  mochilaSnapshotSchema,
  type EquipmentSelection,
  type Mochila,
  type MochilaSnapshot,
  type MochilaWithCount,
} from "@/lib/validation/mochila";

export class ArsenalAuthRequiredError extends Error {
  constructor(message = "Sua sessão expirou. Entre novamente para continuar.") {
    super(message);
    this.name = "ArsenalAuthRequiredError";
  }
}

type ArsenalStatus = "loading" | "ready" | "unauthenticated" | "error";

type ArsenalDataContextValue = {
  status: ArsenalStatus;
  error: string | null;
  snapshot: MochilaSnapshot | null;
  mochilas: MochilaWithCount[];
  reserved: MochilaWithCount | null;
  items: Equipment[];
  totalUnique: number;
  refresh: () => Promise<void>;
  createMochila: (name: string) => Promise<Mochila>;
  renameMochila: (id: string, name: string) => Promise<void>;
  deleteMochila: (id: string) => Promise<void>;
  saveEquipmentSelection: (
    slug: string,
    selection: EquipmentSelection,
  ) => Promise<void>;
  getMochilaIdsForEquipment: (slug: string) => string[];
  isSaved: (slug: string) => boolean;
};

const ArsenalDataContext = createContext<ArsenalDataContextValue | null>(null);

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

export function ArsenalDataProvider({
  children,
  authenticated,
}: {
  children: ReactNode;
  authenticated: boolean;
}) {
  const [snapshot, setSnapshot] = useState<MochilaSnapshot | null>(null);
  const [status, setStatus] = useState<ArsenalStatus>(
    authenticated ? "loading" : "unauthenticated",
  );
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!authenticated) {
      setSnapshot(null);
      setStatus("unauthenticated");
      setError(null);
      return;
    }

    setStatus((current) => (current === "ready" ? "ready" : "loading"));
    try {
      const response = await fetch("/api/arsenal", {
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
          await readApiError(response, "Não foi possível carregar o seu Arsenal."),
        );
      }

      const parsed = mochilaSnapshotSchema.safeParse(await response.json());
      if (!parsed.success) {
        throw new Error("O servidor retornou o Arsenal em formato inesperado.");
      }

      setSnapshot(parsed.data);
      setStatus("ready");
      setError(null);
    } catch (cause) {
      setStatus("error");
      setError(getErrorMessage(cause, "Não foi possível carregar o seu Arsenal."));
    }
  }, [authenticated]);

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
        throw new ArsenalAuthRequiredError();
      }

      if (!response.ok) {
        throw new Error(
          await readApiError(response, "Não foi possível concluir a operação com o Arsenal."),
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

  const associationsByEquipment = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const association of snapshot?.associations ?? []) {
      const lists = map.get(association.equipamentoSlug) ?? [];
      lists.push(association.listaId);
      map.set(association.equipamentoSlug, lists);
    }
    return map;
  }, [snapshot]);

  const savedSlugs = useMemo(
    () => new Set((snapshot?.items ?? []).map((item) => item.slug)),
    [snapshot],
  );

  const isSaved = useCallback((slug: string) => savedSlugs.has(slug), [savedSlugs]);

  const getMochilaIdsForEquipment = useCallback(
    (slug: string) => associationsByEquipment.get(slug) ?? [],
    [associationsByEquipment],
  );

  const createMochila = useCallback(
    async (name: string) => {
      const body = await requestJson("/api/mochilas", {
        method: "POST",
        body: JSON.stringify({ nome: name }),
      });
      const parsed = mochilaSchema.safeParse(body);
      if (!parsed.success) {
        throw new Error("O servidor retornou a mochila em formato inesperado.");
      }
      await refresh();
      return parsed.data;
    },
    [refresh, requestJson],
  );

  const renameMochila = useCallback(
    async (id: string, name: string) => {
      await requestJson(`/api/mochilas/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify({ nome: name }),
      });
      await refresh();
    },
    [refresh, requestJson],
  );

  const deleteMochila = useCallback(
    async (id: string) => {
      await requestJson(`/api/mochilas/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      await refresh();
    },
    [refresh, requestJson],
  );

  const saveEquipmentSelection = useCallback(
    async (slug: string, selection: EquipmentSelection) => {
      await requestJson("/api/mochilas/itens", {
        method: "PUT",
        body: JSON.stringify({
          slug,
          mochilaIds: selection.mochilaIds,
          withoutMochila: selection.withoutMochila,
        }),
      });
      await refresh();
    },
    [refresh, requestJson],
  );

  const value = useMemo<ArsenalDataContextValue>(
    () => ({
      status,
      error,
      snapshot,
      mochilas: snapshot?.namedMochilas ?? [],
      reserved: snapshot?.reserved ?? null,
      items: snapshot?.items ?? [],
      totalUnique: snapshot?.totalUnique ?? 0,
      refresh,
      createMochila,
      renameMochila,
      deleteMochila,
      saveEquipmentSelection,
      getMochilaIdsForEquipment,
      isSaved,
    }),
    [
      createMochila,
      deleteMochila,
      error,
      getMochilaIdsForEquipment,
      isSaved,
      refresh,
      renameMochila,
      saveEquipmentSelection,
      snapshot,
      status,
    ],
  );

  return (
    <ArsenalDataContext.Provider value={value}>{children}</ArsenalDataContext.Provider>
  );
}

export function useArsenalData(): ArsenalDataContextValue {
  const value = useContext(ArsenalDataContext);
  if (!value) {
    throw new Error("useArsenalData deve ser usado dentro de ArsenalDataProvider.");
  }
  return value;
}
