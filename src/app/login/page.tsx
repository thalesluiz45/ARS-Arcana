import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { safeReturnTo } from "@/lib/auth/redirect";
import { getSessionUser } from "@/lib/auth/session";

import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Entrar",
  description: "Entre com sua conta Google para acessar suas magias salvas e grimórios.",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function readParam(
  input: Record<string, string | string[] | undefined>,
  key: string,
): string | undefined {
  const value = input[key];
  return Array.isArray(value) ? value[0] : value;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const resolved = await searchParams;
  const rawReturnTo = readParam(resolved, "returnTo") ?? readParam(resolved, "callbackUrl");
  const returnTo = safeReturnTo(rawReturnTo, "/");
  const error = readParam(resolved, "error") ?? null;

  const user = await getSessionUser();
  if (user) redirect(returnTo);

  return <LoginForm returnTo={returnTo} initialError={error} />;
}
