import { z } from "zod";

export const RESERVED_GRIMOIRE_ID = "sem-grimorio";
export const RESERVED_GRIMOIRE_NAME = "Sem grimório";

export const grimoireNameSchema = z
  .string()
  .trim()
  .min(1, "Informe um nome para o grimório.")
  .max(60, "O nome pode ter no máximo 60 caracteres.");

export const grimoireSchema = z.object({
  id: z.string().min(1),
  nome: z.string().min(1).max(60),
  criadaEm: z.string().min(1),
  atualizadaEm: z.string().min(1),
  reservada: z.boolean(),
});

export type Grimoire = z.infer<typeof grimoireSchema>;

export const savedSpellSchema = z.object({
  listaId: z.string().min(1),
  magiaId: z.uuid(),
  salvaEm: z.string().min(1),
});

export type SavedSpell = z.infer<typeof savedSpellSchema>;

export const magiaCacheSchema = z.object({
  magiaId: z.uuid(),
  cachedAt: z.string().min(1),
  expiresAt: z.string().min(1),
});

export type MagiaCache = z.infer<typeof magiaCacheSchema>;

export type GrimoireWithCount = Grimoire & {
  total: number;
};

export type SavedCollectionSelection = "todas" | typeof RESERVED_GRIMOIRE_ID | string;
