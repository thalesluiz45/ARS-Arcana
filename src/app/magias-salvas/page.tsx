import type { Metadata } from "next";

import { catalogSortSchema, type CatalogSort } from "@/lib/validation/catalog";

import { SavedSpellsPage } from "./saved-spells-page";

export const metadata: Metadata = {
  title: "Magias salvas",
  description:
    "Consulte as magias que você salvou, organize seus grimórios e encontre referências mesmo sem conexão.",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function readParam(
  input: Record<string, string | string[] | undefined>,
  key: string,
): string | undefined {
  const value = input[key];
  return Array.isArray(value) ? value[0] : value;
}

export default async function SavedSpellsRoute({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const resolved = await searchParams;

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
