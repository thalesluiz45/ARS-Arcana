import { DatabaseConfigError } from "@/lib/db/factory";
import { EquipmentRepositoryError } from "@/lib/equipment/repository";
import { MochilaRepositoryError } from "@/lib/mochilas/repository";

export type EquipmentFailure = {
  status: number;
  code: string;
  message: string;
};

export function describeEquipmentFailure(error: unknown): EquipmentFailure {
  if (error instanceof EquipmentRepositoryError) {
    return {
      status: error.code === "not-found" ? 404 : 400,
      code: error.code,
      message: error.message,
    };
  }

  let current: unknown = error;
  for (let depth = 0; current && depth < 5; depth += 1) {
    if (current instanceof DatabaseConfigError) {
      return {
        status: 503,
        code: "catalog-not-configured",
        message:
          "O catálogo de equipamentos ainda não está configurado neste ambiente. Defina a conexão do banco no servidor.",
      };
    }
    current = current instanceof Error ? current.cause : null;
  }

  return {
    status: 503,
    code: "catalog-unavailable",
    message:
      "Não foi possível consultar o catálogo de equipamentos agora. Verifique a conexão e tente novamente.",
  };
}

export function describeArsenalFailure(error: unknown): EquipmentFailure {
  if (
    error instanceof EquipmentRepositoryError ||
    error instanceof MochilaRepositoryError
  ) {
    const status =
      error.code === "not-found"
        ? 404
        : error.code === "conflict"
          ? 409
          : 400;
    return {
      status,
      code: error.code,
      message: error.message,
    };
  }

  let current: unknown = error;
  for (let depth = 0; current && depth < 5; depth += 1) {
    if (current instanceof DatabaseConfigError) {
      return {
        status: 503,
        code: "arsenal-not-configured",
        message:
          "O Arsenal ainda não está configurado neste ambiente. Defina a conexão do banco no servidor.",
      };
    }
    current = current instanceof Error ? current.cause : null;
  }

  return {
    status: 500,
    code: "internal-error",
    message:
      "Não foi possível concluir a operação com o seu Arsenal. Tente novamente.",
  };
}
