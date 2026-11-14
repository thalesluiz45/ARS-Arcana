import { z } from "zod";

// Legacy IndexedDB reserved collection. Remote collections use real UUIDs and
// are identified by the `reservada` flag returned by the server.
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

export const grimoireWithCountSchema = grimoireSchema.extend({
  total: z.number().int().nonnegative(),
});

export type GrimoireWithCount = z.infer<typeof grimoireWithCountSchema>;

export const savedSpellSchema = z.object({
  listaId: z.string().min(1),
  magiaId: z.uuid(),
  salvaEm: z.string().min(1),
});

export type SavedSpell = z.infer<typeof savedSpellSchema>;

export const grimoireSnapshotSchema = z.object({
  lists: z.array(grimoireSchema),
  namedGrimoires: z.array(grimoireWithCountSchema),
  reserved: grimoireWithCountSchema,
  totalUnique: z.number().int().nonnegative(),
  associations: z.array(savedSpellSchema),
});

export type GrimoireSnapshot = z.infer<typeof grimoireSnapshotSchema>;

export const spellSelectionRequestSchema = z.object({
  magiaId: z.uuid(),
  grimoireIds: z.array(z.uuid()).max(50),
  withoutGrimoire: z.boolean(),
});

export type SpellSelection = {
  grimoireIds: string[];
  withoutGrimoire: boolean;
};

export const magiaCacheSchema = z.object({
  magiaId: z.uuid(),
  cachedAt: z.string().min(1),
  expiresAt: z.string().min(1),
});

export type MagiaCache = z.infer<typeof magiaCacheSchema>;

export type SavedCollectionSelection = "todas" | string;
