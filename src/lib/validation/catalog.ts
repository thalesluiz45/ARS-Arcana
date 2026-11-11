import { z } from "zod";

import type { Magia } from "./magia";

export const CATALOG_PAGE_SIZE = 12;
export const SAVED_PAGE_SIZE = 9;
export const MAX_PAGE_SIZE = 50;

export const catalogSortSchema = z.enum([
  "nome-asc",
  "nome-desc",
  "circulo-asc",
  "circulo-desc",
]);

export type CatalogSort = z.infer<typeof catalogSortSchema>;

export const catalogFilterSchema = z.object({
  q: z.string().trim().max(120).default(""),
  tipos: z.array(z.string().trim().min(1).max(80)).max(10).default([]),
  classes: z.array(z.string().trim().min(1).max(80)).max(20).default([]),
  circulo: z.number().int().min(0).max(9).nullable().default(null),
  sort: catalogSortSchema.default("nome-asc"),
  page: z.number().int().min(1).max(100_000).default(1),
  limit: z.number().int().min(1).max(MAX_PAGE_SIZE).default(CATALOG_PAGE_SIZE),
  cursor: z.string().trim().max(200).nullable().default(null),
});

export type CatalogFilters = z.infer<typeof catalogFilterSchema>;

export const facetValueSchema = z.object({
  valor: z.string(),
  total: z.number().int().nonnegative(),
});

export const catalogFacetsSchema = z.object({
  escolas: z.array(facetValueSchema),
  classes: z.array(facetValueSchema),
  circulos: z.array(
    z.object({
      valor: z.number().int().min(0).max(9),
      total: z.number().int().nonnegative(),
    }),
  ),
});

export type CatalogFacets = z.infer<typeof catalogFacetsSchema>;

export type CatalogPage = {
  items: Magia[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
  nextCursor: string | null;
  previousCursor: string | null;
  facets: CatalogFacets;
};

type SearchParamsInput = Record<string, string | string[] | undefined> | URLSearchParams;

function readParam(input: SearchParamsInput, key: string): string | undefined {
  if (input instanceof URLSearchParams) {
    return input.get(key) ?? undefined;
  }
  const value = input[key];
  return Array.isArray(value) ? value[0] : value;
}

function readAll(input: SearchParamsInput, key: string): string[] {
  if (input instanceof URLSearchParams) {
    return input.getAll(key);
  }
  const value = input[key];
  if (Array.isArray(value)) return value;
  return value ? [value] : [];
}

export function parseCatalogFilters(input: SearchParamsInput): CatalogFilters {
  const rawCircle = readParam(input, "circulo");
  const circleNumber = rawCircle === undefined || rawCircle === "" ? null : Number(rawCircle);
  const rawPage = Number(readParam(input, "page") ?? "1");
  const rawLimit = Number(readParam(input, "limit") ?? CATALOG_PAGE_SIZE);
  const rawSort = readParam(input, "sort");
  const classes = [...readAll(input, "classe"), ...readAll(input, "classes")]
    .flatMap((value) => value.split(","))
    .map((value) => value.trim())
    .filter(Boolean);
  const tipos = [...readAll(input, "tipo"), ...readAll(input, "tipos")]
    .flatMap((value) => value.split(","))
    .map((value) => value.trim())
    .filter(Boolean);

  const parsed = catalogFilterSchema.safeParse({
    q: readParam(input, "q") ?? "",
    tipos: [...new Set(tipos)],
    classes: [...new Set(classes)],
    circulo:
      circleNumber !== null && Number.isInteger(circleNumber) && circleNumber >= 0 && circleNumber <= 9
        ? circleNumber
        : null,
    sort: rawSort && catalogSortSchema.safeParse(rawSort).success ? rawSort : "nome-asc",
    page: Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1,
    limit:
      Number.isInteger(rawLimit) && rawLimit >= 1 && rawLimit <= MAX_PAGE_SIZE
        ? rawLimit
        : CATALOG_PAGE_SIZE,
    cursor: readParam(input, "cursor") ?? null,
  });

  return parsed.success ? parsed.data : catalogFilterSchema.parse({});
}

export function catalogFiltersToSearchParams(filters: CatalogFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  for (const tipo of filters.tipos) params.append("tipo", tipo);
  for (const classe of filters.classes) params.append("classe", classe);
  if (filters.circulo !== null) params.set("circulo", String(filters.circulo));
  if (filters.sort !== "nome-asc") params.set("sort", filters.sort);
  if (filters.page > 1) params.set("page", String(filters.page));
  if (filters.limit !== CATALOG_PAGE_SIZE) params.set("limit", String(filters.limit));
  return params;
}
