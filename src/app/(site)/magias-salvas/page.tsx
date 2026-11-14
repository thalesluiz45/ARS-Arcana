import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { loginHref } from "@/lib/auth/redirect";
import { getSessionUser } from "@/lib/auth/session";
import { catalogSortSchema, type CatalogSort } from "@/lib/validation/catalog";

import { SavedSpellsPage } from "./saved-spells-page";

export const metadata: Metadata = {
  title: "Magias salvas",
  description:
    "Consulte as magias que você salvou e organize seus grimórios associados à sua conta.",
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
  return query ? `/magias-salvas?${query}` : "/magias-salvas";
}

export default async function SavedSpellsRoute({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const resolved = await searchParams;

  const user = await getSessionUser();
  if (!user) redirect(loginHref(currentPath(resolved)));

  const rawCollection = readParam(resolved, "grimorio")?.trim();
  const collection =
    rawCollection && rawCollection.length <= 120 ? rawCollection : "todas";

  const query = (readParam(resolved, "q") ?? "").trim().slice(0, 120);

  const rawSort = readParam(resolved, "sort");
  const sort: CatalogSort =
    rawSort && catalogSortSchema.safeParse(rawSort).success
      ? (rawSort as CatalogSort)
      : "nome-asc";

  const rawPage = Number(readParam(resolved, "page") ?? "1");
  const page =
    Number.isInteger(rawPage) && rawPage >= 1 && rawPage <= 100_000 ? rawPage : 1;

  return (
    <SavedSpellsPage
      initialCollection={collection}
      initialQuery={query}
      initialSort={sort}
      initialPage={page}
    />
  );
}
