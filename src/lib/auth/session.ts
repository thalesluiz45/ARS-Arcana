import "server-only";

import { unstable_rethrow } from "next/navigation";
import { cache } from "react";

import { auth } from "@/auth";

export type SessionUser = {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
};

export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  try {
    const session = await auth();
    if (!session?.user?.id) return null;
    return {
      id: session.user.id,
      name: session.user.name ?? null,
      email: session.user.email ?? null,
      image: session.user.image ?? null,
    };
  } catch (error) {
    // Let Next.js control-flow errors (dynamic usage, redirects) through.
    unstable_rethrow(error);
    // Public pages must stay available when the auth database is temporarily
    // unreachable. Private routes and API handlers treat this as signed out.
    console.error("[auth] falha ao ler a sessão:", error);
    return null;
  }
});

export function unauthorizedResponseBody() {
  return {
    error: "Entre com sua conta Google para acessar suas magias salvas.",
    code: "unauthorized",
  } as const;
}
