import { z } from "zod";

import { equipmentSchema, equipmentSlugSchema } from "@/lib/validation/equipment";

export const RESERVED_MOCHILA_NAME = "Sem mochila";

export const mochilaNameSchema = z
  .string()
  .trim()
  .min(1, "Informe um nome para a mochila.")
  .max(60, "O nome pode ter no máximo 60 caracteres.");

export const mochilaSchema = z.object({
  id: z.string().min(1),
  nome: z.string().min(1).max(60),
  criadaEm: z.string().min(1),
  atualizadaEm: z.string().min(1),
  reservada: z.boolean(),
});

export type Mochila = z.infer<typeof mochilaSchema>;

export const mochilaWithCountSchema = mochilaSchema.extend({
  total: z.number().int().nonnegative(),
});

export type MochilaWithCount = z.infer<typeof mochilaWithCountSchema>;

export const savedEquipmentSchema = z.object({
  listaId: z.string().min(1),
  equipamentoSlug: equipmentSlugSchema,
  salvoEm: z.string().min(1),
});

export type SavedEquipment = z.infer<typeof savedEquipmentSchema>;

export const mochilaSnapshotSchema = z.object({
  lists: z.array(mochilaSchema),
  namedMochilas: z.array(mochilaWithCountSchema),
  reserved: mochilaWithCountSchema,
  totalUnique: z.number().int().nonnegative(),
  associations: z.array(savedEquipmentSchema),
  items: z.array(equipmentSchema),
});

export type MochilaSnapshot = z.infer<typeof mochilaSnapshotSchema>;

export type ArsenalSnapshot = MochilaSnapshot;

export const equipmentSelectionRequestSchema = z.object({
  slug: equipmentSlugSchema,
  mochilaIds: z.array(z.uuid()).max(50),
  withoutMochila: z.boolean(),
});

export type EquipmentSelection = {
  mochilaIds: string[];
  withoutMochila: boolean;
};
