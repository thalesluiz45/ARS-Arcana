import { z } from "zod";

export const EQUIPMENT_PAGE_SIZE = 12;
export const EQUIPMENT_MAX_PAGE_SIZE = 50;

export const EQUIPMENT_TYPE_ORDER = [
  "arma",
  "armadura",
  "ferramenta",
  "aventura",
] as const;

export const equipmentTypeSchema = z.enum(EQUIPMENT_TYPE_ORDER);
export type EquipmentType = z.infer<typeof equipmentTypeSchema>;

export const EQUIPMENT_TYPE_LABELS: Record<
  EquipmentType,
  { singular: string; plural: string; section: string }
> = {
  arma: { singular: "Arma", plural: "Armas", section: "Armas" },
  armadura: {
    singular: "Armadura",
    plural: "Armaduras",
    section: "Armaduras",
  },
  ferramenta: {
    singular: "Ferramenta",
    plural: "Ferramentas",
    section: "Ferramentas",
  },
  aventura: {
    singular: "Equipamento de aventura",
    plural: "Equipamentos de aventura",
    section: "Equipamento de aventura",
  },
};

export const WEAPON_CATEGORIES = [
  "Simples Corpo a Corpo",
  "Simples à Distância",
  "Marcial Corpo a Corpo",
  "Marcial à Distância",
] as const;

export const weaponCategorySchema = z.enum(WEAPON_CATEGORIES);
export type WeaponCategory = z.infer<typeof weaponCategorySchema>;

export const weaponKindSchema = z.enum(["simples", "marcial"]);
export type WeaponKind = z.infer<typeof weaponKindSchema>;

export const weaponRangeSchema = z.enum(["corpo-a-corpo", "distancia"]);
export type WeaponRange = z.infer<typeof weaponRangeSchema>;

export const ARMOR_CATEGORIES = ["Leve", "Média", "Pesada", "Escudo"] as const;
export const armorCategorySchema = z.enum(ARMOR_CATEGORIES);
export type ArmorCategory = z.infer<typeof armorCategorySchema>;

export const armorFilterSchema = z.enum([
  "leve",
  "media",
  "pesada",
  "escudo",
]);
export type ArmorFilter = z.infer<typeof armorFilterSchema>;

export const ARMOR_FILTER_LABELS: Record<ArmorFilter, string> = {
  leve: "Armaduras leves",
  media: "Armaduras médias",
  pesada: "Armaduras pesadas",
  escudo: "Escudos",
};

export const ARMOR_FILTER_DB_VALUES: Record<ArmorFilter, ArmorCategory> = {
  leve: "Leve",
  media: "Média",
  pesada: "Pesada",
  escudo: "Escudo",
};

export const WEAPON_KIND_LABELS: Record<WeaponKind, string> = {
  simples: "Simples",
  marcial: "Marcial",
};

export const WEAPON_RANGE_LABELS: Record<WeaponRange, string> = {
  "corpo-a-corpo": "Corpo a corpo",
  distancia: "À distância",
};

export const TOOL_CATEGORIES = [
  "Ferramentas de Artesão",
  "Outras Ferramentas",
] as const;
export const toolCategorySchema = z.enum(TOOL_CATEGORIES);

export const ABILITIES = [
  "Força",
  "Destreza",
  "Constituição",
  "Inteligência",
  "Sabedoria",
  "Carisma",
] as const;
export const abilitySchema = z.enum(ABILITIES);

export const DAMAGE_TYPES = ["Perfurante", "Contundente", "Cortante"] as const;
export const damageTypeSchema = z.enum(DAMAGE_TYPES);

export const MASTERIES = [
  "Ágil",
  "Lentidão",
  "Derrubar",
  "Empurrar",
  "Drenar",
  "Afligir",
  "Trespassar",
  "Garantido",
] as const;
export const masterySchema = z.enum(MASTERIES);

export const equipmentSlugSchema = z
  .string()
  .trim()
  .min(1)
  .max(90)
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Slug deve usar letras minúsculas, números e hífens.",
  );

const presentationTextSchema = z.string().trim().min(1).max(500);

/**
 * The extracted source uses the literal string "null" for a few weights.
 * Treat it as an absent presentation value instead of rendering "null".
 */
const nullablePresentationSchema = z
  .union([z.string(), z.null()])
  .transform((value) => {
    if (value === null) return null;
    const trimmed = value.trim();
    return !trimmed || trimmed.toLowerCase() === "null" ? null : trimmed;
  });

const commonEquipmentFields = {
  slug: equipmentSlugSchema,
  nome: z.string().trim().min(1).max(160),
  peso: nullablePresentationSchema,
  custo: presentationTextSchema,
  fontePagina: z.number().int().min(1).max(9999),
};

export const weaponEquipmentSchema = z
  .object({
    ...commonEquipmentFields,
    tipo: z.literal("arma"),
    categoria: weaponCategorySchema,
    dano: presentationTextSchema,
    tipoDano: damageTypeSchema,
    propriedades: z
      .array(z.string().trim().min(1).max(220))
      .max(20)
      .default([]),
    maestria: masterySchema,
  })
  .strict();

export const armorEquipmentSchema = z
  .object({
    ...commonEquipmentFields,
    tipo: z.literal("armadura"),
    categoria: armorCategorySchema,
    classeArmadura: presentationTextSchema,
    forca: nullablePresentationSchema,
    furtividade: z.enum(["Desvantagem"]).nullable(),
  })
  .strict();

export const toolEquipmentSchema = z
  .object({
    ...commonEquipmentFields,
    tipo: z.literal("ferramenta"),
    categoria: toolCategorySchema,
    atributo: abilitySchema,
    descricao: z.string().trim().min(1),
  })
  .strict();

export const adventureEquipmentSchema = z
  .object({
    ...commonEquipmentFields,
    tipo: z.literal("aventura"),
    descricao: z.string().trim().min(1),
  })
  .strict();

export const equipmentSchema = z.discriminatedUnion("tipo", [
  weaponEquipmentSchema,
  armorEquipmentSchema,
  toolEquipmentSchema,
  adventureEquipmentSchema,
]);

export type Equipment = z.infer<typeof equipmentSchema>;
export type WeaponEquipment = z.infer<typeof weaponEquipmentSchema>;
export type ArmorEquipment = z.infer<typeof armorEquipmentSchema>;
export type ToolEquipment = z.infer<typeof toolEquipmentSchema>;
export type AdventureEquipment = z.infer<typeof adventureEquipmentSchema>;
export type EquipmentImport = Equipment;

export type WeaponTraits = {
  tipo: WeaponKind;
  alcance: WeaponRange;
};

export function getWeaponTraits(category: WeaponCategory): WeaponTraits {
  switch (category) {
    case "Simples Corpo a Corpo":
      return { tipo: "simples", alcance: "corpo-a-corpo" };
    case "Simples à Distância":
      return { tipo: "simples", alcance: "distancia" };
    case "Marcial Corpo a Corpo":
      return { tipo: "marcial", alcance: "corpo-a-corpo" };
    case "Marcial à Distância":
      return { tipo: "marcial", alcance: "distancia" };
  }
}

export const equipmentSortSchema = z.enum([
  "categoria",
  "nome-asc",
  "nome-desc",
]);
export type EquipmentSort = z.infer<typeof equipmentSortSchema>;

export const equipmentSortLabels: Record<EquipmentSort, string> = {
  categoria: "Categoria",
  "nome-asc": "Nome (A-Z)",
  "nome-desc": "Nome (Z-A)",
};

export const equipmentFilterSchema = z.object({
  q: z.string().trim().max(120).default(""),
  tipo: equipmentTypeSchema.nullable().default(null),
  armas: z.array(weaponKindSchema).max(2).default([]),
  alcances: z.array(weaponRangeSchema).max(2).default([]),
  armaduras: z.array(armorFilterSchema).max(4).default([]),
  sort: equipmentSortSchema.default("categoria"),
  page: z.number().int().min(1).max(100_000).default(1),
  limit: z
    .number()
    .int()
    .min(1)
    .max(EQUIPMENT_MAX_PAGE_SIZE)
    .default(EQUIPMENT_PAGE_SIZE),
});

export type EquipmentFilters = z.infer<typeof equipmentFilterSchema>;

export function normalizeEquipmentFilters(
  filters: EquipmentFilters,
): EquipmentFilters {
  return {
    ...filters,
    armas: filters.tipo === null || filters.tipo === "arma" ? filters.armas : [],
    alcances:
      filters.tipo === null || filters.tipo === "arma" ? filters.alcances : [],
    armaduras:
      filters.tipo === null || filters.tipo === "armadura"
        ? filters.armaduras
        : [],
  };
}

export const equipmentFacetValueSchema = z.object({
  valor: z.string(),
  total: z.number().int().nonnegative(),
});

export type EquipmentFacetValue = z.infer<typeof equipmentFacetValueSchema>;

export const equipmentFacetsSchema = z.object({
  tipos: z.array(equipmentFacetValueSchema),
  armas: z.object({
    tipos: z.array(equipmentFacetValueSchema),
    alcances: z.array(equipmentFacetValueSchema),
  }),
  armaduras: z.array(equipmentFacetValueSchema),
});

export type EquipmentFacets = z.infer<typeof equipmentFacetsSchema>;

export type EquipmentPage = {
  items: Equipment[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
  facets: EquipmentFacets;
  typeTotals: EquipmentFacetValue[];
};

export type ArsenalSnapshot = {
  items: Equipment[];
  total: number;
};

export const arsenalSnapshotSchema = z.object({
  items: z.array(equipmentSchema),
  total: z.number().int().nonnegative(),
});

type SearchParamsInput =
  | Record<string, string | string[] | undefined>
  | URLSearchParams;

function readParam(
  input: SearchParamsInput,
  key: string,
): string | undefined {
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

function readList(
  input: SearchParamsInput,
  keys: string[],
  schema: z.ZodType<string>,
): string[] {
  const values = keys
    .flatMap((key) => readAll(input, key))
    .flatMap((value) => value.split(","))
    .map((value) => value.trim())
    .filter(Boolean);

  return [...new Set(values.filter((value) => schema.safeParse(value).success))];
}

export function parseEquipmentFilters(
  input: SearchParamsInput,
): EquipmentFilters {
  const rawType = readParam(input, "tipo") ?? readParam(input, "tipos");
  const tipo =
    rawType && equipmentTypeSchema.safeParse(rawType).success
      ? (rawType as EquipmentType)
      : null;

  const rawPage = Number(readParam(input, "page") ?? "1");
  const rawLimit = Number(readParam(input, "limit") ?? EQUIPMENT_PAGE_SIZE);
  const rawSort = readParam(input, "sort");

  const parsed = equipmentFilterSchema.safeParse({
    q: (readParam(input, "q") ?? "").slice(0, 120),
    tipo,
    armas: readList(input, ["arma", "armas"], weaponKindSchema),
    alcances: readList(input, ["alcance", "alcances"], weaponRangeSchema),
    armaduras: readList(input, ["armadura", "armaduras"], armorFilterSchema),
    sort:
      rawSort && equipmentSortSchema.safeParse(rawSort).success
        ? rawSort
        : "categoria",
    page: Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1,
    limit:
      Number.isInteger(rawLimit) &&
      rawLimit >= 1 &&
      rawLimit <= EQUIPMENT_MAX_PAGE_SIZE
        ? rawLimit
        : EQUIPMENT_PAGE_SIZE,
  });

  return normalizeEquipmentFilters(
    parsed.success ? parsed.data : equipmentFilterSchema.parse({}),
  );
}

export function equipmentFiltersToSearchParams(
  filters: EquipmentFilters,
): URLSearchParams {
  const normalized = normalizeEquipmentFilters(filters);
  const params = new URLSearchParams();
  if (normalized.q) params.set("q", normalized.q);
  if (normalized.tipo) params.set("tipo", normalized.tipo);
  for (const value of normalized.armas) params.append("arma", value);
  for (const value of normalized.alcances) params.append("alcance", value);
  for (const value of normalized.armaduras) params.append("armadura", value);
  if (normalized.sort !== "categoria") params.set("sort", normalized.sort);
  if (normalized.page > 1) params.set("page", String(normalized.page));
  if (normalized.limit !== EQUIPMENT_PAGE_SIZE) {
    params.set("limit", String(normalized.limit));
  }
  return params;
}

export function equipmentTypeLabel(item: Equipment): string {
  switch (item.tipo) {
    case "arma":
      return `${WEAPON_KIND_LABELS[getWeaponTraits(item.categoria).tipo]} · ${
        WEAPON_RANGE_LABELS[getWeaponTraits(item.categoria).alcance]
      }`;
    case "armadura":
      return item.categoria === "Escudo"
        ? "Escudo"
        : `Armadura ${item.categoria.toLowerCase()}`;
    case "ferramenta":
      return `${item.categoria} · ${item.atributo}`;
    case "aventura":
      return "Equipamento de aventura";
  }
}

export function equipmentPesoLabel(item: Equipment): string {
  return item.peso ?? "Não informado";
}

export function equipmentForcaLabel(item: ArmorEquipment): string {
  return item.forca ? `Força ${item.forca}` : "Sem requisito de Força";
}

export function equipmentFurtividadeLabel(item: ArmorEquipment): string {
  return item.furtividade ?? "Sem penalidade";
}
