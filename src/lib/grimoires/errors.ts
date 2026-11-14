import { GrimoireRepositoryError } from "@/lib/grimoires/repository";

export type GrimoireFailure = {
  status: number;
  code: string;
  message: string;
};

export function describeGrimoireFailure(error: unknown): GrimoireFailure {
  if (error instanceof GrimoireRepositoryError) {
    const status =
      error.code === "not-found" ? 404 : error.code === "conflict" ? 409 : 400;
    return { status, code: error.code, message: error.message };
  }

  return {
    status: 500,
    code: "internal-error",
    message: "Não foi possível concluir a operação com seus grimórios.",
  };
}
