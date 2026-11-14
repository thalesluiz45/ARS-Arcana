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
  arsenalSnapshotSchema,
  type ArsenalSnapshot,
  type Equipment,
} from "@/lib/validation/equipment";

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
  items: Equipment[];
  total: number;
  refresh: () => Promise<void>;
  save: (slug: string) => Promise<void>;
  remove: (slug: string) => Promise<void>;
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
  const [snapshot, setSnapshot] = useState<ArsenalSnapshot | null>(null);
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

      const parsed = arsenalSnapshotSchema.safeParse(await response.json());
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

  const requestSnapshot = useCallback(
    async (url: string, init: RequestInit): Promise<ArsenalSnapshot> => {
      let response: Response;
      try {
        response = await fetch(url, {
          cache: "no-store",
          ...init,
          headers: {
            accept: "application/json",
            ...(init.body ? { "content-type": "application/json" } : {}),
            ...init.headers,
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

      const parsed = arsenalSnapshotSchema.safeParse(await response.json());
      if (!parsed.success) {
        throw new Error("O servidor retornou o Arsenal em formato inesperado.");
      }

      setSnapshot(parsed.data);
      setStatus("ready");
      setError(null);
      return parsed.data;
    },
    [],
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const savedSlugs = useMemo(
    () => new Set((snapshot?.items ?? []).map((item) => item.slug)),
    [snapshot],
  );

  const isSaved = useCallback(
    (slug: string) => savedSlugs.has(slug),
    [savedSlugs],
  );

  const save = useCallback(
    async (slug: string) => {
      await requestSnapshot("/api/arsenal", {
        method: "POST",
        body: JSON.stringify({ slug }),
      });
    },
    [requestSnapshot],
  );

  const remove = useCallback(
    async (slug: string) => {
      await requestSnapshot(`/api/arsenal/${encodeURIComponent(slug)}`, {
        method: "DELETE",
      });
    },
    [requestSnapshot],
  );

  const value = useMemo<ArsenalDataContextValue>(
    () => ({
      status,
      error,
      items: snapshot?.items ?? [],
      total: snapshot?.total ?? 0,
      refresh,
      save,
      remove,
      isSaved,
    }),
    [error, isSaved, refresh, remove, save, snapshot, status],
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
