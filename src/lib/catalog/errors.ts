import { DatabaseConfigError } from "@/lib/db/factory";

export type CatalogFailure = {
  code: "catalog-not-configured" | "catalog-unavailable";
  message: string;
  status: 503;
};

export function describeCatalogFailure(error: unknown): CatalogFailure {
  let current: unknown = error;
  for (let depth = 0; current && depth < 5; depth += 1) {
    if (current instanceof DatabaseConfigError) {
      return {
        code: "catalog-not-configured",
        message:
          "O catálogo ainda não está configurado neste ambiente. Defina a conexão do banco no servidor.",
        status: 503,
      };
    }
    current = current instanceof Error ? current.cause : null;
  }

  return {
    code: "catalog-unavailable",
    message:
      "Não foi possível consultar o catálogo de magias agora. Verifique a conexão e tente novamente.",
    status: 503,
  };
}
