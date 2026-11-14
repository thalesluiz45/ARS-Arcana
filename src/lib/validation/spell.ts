import { z } from "zod";

export const spellIdSchema = z.uuid();

const isoDateSchema = z
  .union([z.string().min(1), z.date()])
  .transform((value) => (value instanceof Date ? value.toISOString() : new Date(value).toISOString()));

export const spellComponentsSchema = z
  .object({
    verbal: z.boolean(),
    somatico: z.boolean(),
    material: z.boolean(),
    materialDescricao: z.string().trim().min(1).nullable().optional().default(null),
  })
  .superRefine((value, context) => {
    if (!value.material && value.materialDescricao) {
      context.addIssue({
        code: "custom",
        message: "Componente material descrito sem a flag material.",
        path: ["materialDescricao"],
      });
    }
  });

export const spellSchema = z.object({
  id: z.uuid(),
  slug: z
    .string()
    .min(1)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug deve usar letras minúsculas, números e hífens."),
  nome: z.string().trim().min(1),
  tipo: z.string().trim().min(1),
  classes: z.array(z.string().trim().min(1)).min(1),
  circulo: z.number().int().min(0).max(9),
  descricao: z.string().trim().min(1),
  tempoConjuracao: z.string().trim().min(1),
  alcance: z.string().trim().min(1),
  duracao: z.string().trim().min(1),
  componentes: spellComponentsSchema,
  criadoEm: isoDateSchema,
  atualizadoEm: isoDateSchema,
});

export const spellImportSchema = spellSchema.omit({
  id: true,
  criadoEm: true,
  atualizadoEm: true,
});

export type Spell = z.infer<typeof spellSchema>;
export type SpellImport = z.infer<typeof spellImportSchema>;
export type SpellComponents = z.infer<typeof spellComponentsSchema>;

export function spellCircleLabel(circle: number): string {
  return circle === 0 ? "Truque" : `${circle}º Círculo`;
}

export function spellComponentsLabel(components: SpellComponents): string {
  const values: string[] = [];
  if (components.verbal) values.push("V");
  if (components.somatico) values.push("S");
  if (components.material) values.push("M");
  return values.join(" · ");
}

export function isConcentrationSpell(duration: string): boolean {
  return /^concentra[çc][aã]o/i.test(duration.trim());
}
