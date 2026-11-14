import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { loginHref } from "@/lib/auth/redirect";
import { getSessionUser } from "@/lib/auth/session";

import { ArsenalPage } from "./arsenal-page";

export const metadata: Metadata = {
  title: "Arsenal",
  description:
    "Consulte os equipamentos que você salvou na sua conta e prepare-se para a próxima aventura.",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function readParam(
  input: Record<string, string | string[] | undefined>,
  key: string,
): string | undefined {
  const value = input[key];
  return Array.isArray(value) ? value[0] : value;
}

function currentPath(input: Record<string, string | string[] | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(input)) {
    if (Array.isArray(value)) {
      for (const item of value) params.append(key, item);
    } else if (value !== undefined) {
      params.set(key, value);
    }
  }
  const query = params.toString();
  return query ? `/arsenal?${query}` : "/arsenal";
}

export default async function ArsenalRoute({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const resolved = await searchParams;

  const user = await getSessionUser();
  if (!user) redirect(loginHref(currentPath(resolved)));

  const query = (readParam(resolved, "q") ?? "").trim().slice(0, 120);

  return <ArsenalPage initialQuery={query} />;
}
