import { existsSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  DEFAULT_EQUIPMENT_SOURCE_PATH,
  buildEquipmentImportReport,
  readEquipmentSource,
  validateEquipmentEntries,
} from "@/lib/import/equipment";
import {
  equipmentSchema,
  getWeaponTraits,
} from "@/lib/validation/equipment";

import {
  makeAdventure,
  makeArmor,
  makeTool,
  makeWeapon,
} from "./fixtures";

describe("equipment import validation", () => {
  it("accepts all four subtypes and normalizes absent presentation weights", () => {
    const result = validateEquipmentEntries([
      makeWeapon(),
      makeArmor({ forca: "13", furtividade: "Desvantagem" }),
      makeTool(),
      makeAdventure(),
      makeAdventure({ slug: "frasco", nome: "Frasco", peso: "null" }),
    ]);

    expect(result.issues).toEqual([]);
    expect(result.items).toHaveLength(5);
    expect(result.countsByType).toEqual({
      arma: 1,
      armadura: 1,
      ferramenta: 1,
      aventura: 2,
    });
    expect(result.items.at(-1)?.peso).toBeNull();
    expect(getWeaponTraits("Marcial Corpo a Corpo")).toEqual({
      tipo: "marcial",
      alcance: "corpo-a-corpo",
    });
  });

  it("rejects fields that do not belong to the discriminated subtype", () => {
    expect(
      equipmentSchema.safeParse({ ...makeArmor(), dano: "1d8" }).success,
    ).toBe(false);
    expect(
      equipmentSchema.safeParse({ ...makeWeapon(), furtividade: "Desvantagem" })
        .success,
    ).toBe(false);
    expect(
      equipmentSchema.safeParse({ ...makeTool(), tipoDano: "Cortante" }).success,
    ).toBe(false);
    expect(
      equipmentSchema.safeParse({
        ...makeArmor(),
        furtividade: "Vantagem",
      }).success,
    ).toBe(false);
  });

  it("reports invalid entries with their index and page", () => {
    const valid = makeWeapon();
    const result = validateEquipmentEntries([
      valid,
      { ...valid, slug: "arco-invalido", tipoDano: "Fogo" },
      { ...valid, slug: "sem-custo", custo: "" },
    ]);

    expect(result.items).toHaveLength(1);
    expect(result.issues).toEqual([
      expect.objectContaining({ index: 1, slug: "arco-invalido", page: 215 }),
      expect.objectContaining({ index: 2, slug: "sem-custo", page: 215 }),
    ]);
  });

  it("keeps a single item per duplicate slug and reports the duplicate", () => {
    const result = validateEquipmentEntries([
      makeWeapon({ slug: "adaga", nome: "Adaga" }),
      makeWeapon({ slug: "adaga", nome: "Outra adaga" }),
      makeWeapon({ slug: "adaga", nome: "Adaga final" }),
    ]);

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.nome).toBe("Adaga");
    expect(result.duplicates).toEqual([{ slug: "adaga", indices: [0, 1, 2] }]);
    expect(result.issues.map((issue) => issue.index)).toEqual([1, 2]);
  });

  it("reconciles source and database slugs in the import report", () => {
    const validated = validateEquipmentEntries([makeWeapon(), makeArmor()]);
    const report = buildEquipmentImportReport({
      entries: [makeWeapon(), makeArmor()],
      validated,
      upserted: [
        { slug: "espada-longa", id: "1", inserted: true },
        { slug: "armadura-de-couro", id: "2", inserted: false },
      ],
      databaseSlugs: ["espada-longa", "armadura-de-couro", "item-antigo"],
      databaseCountsByType: { arma: 1, armadura: 1, ferramenta: 0, aventura: 0 },
      dryRun: false,
    });

    expect(report).toMatchObject({
      sourceCount: 2,
      validCount: 2,
      invalidCount: 0,
      inserted: 1,
      updated: 1,
      missingFromDatabase: [],
      extraInDatabase: ["item-antigo"],
      databaseCount: 3,
      pages: { first: 215, last: 219 },
      dryRun: false,
    });
  });
});

describe("reference equipment catalog", () => {
  it.skipIf(!existsSync(DEFAULT_EQUIPMENT_SOURCE_PATH))(
    "contains all 174 items without validation errors",
    async () => {
      const { entries } = await readEquipmentSource();
      const result = validateEquipmentEntries(entries);

      expect(entries).toHaveLength(174);
      expect(result.issues).toEqual([]);
      expect(result.duplicates).toEqual([]);
      expect(result.items).toHaveLength(174);
      expect(result.countsByType).toEqual({
        arma: 38,
        armadura: 13,
        ferramenta: 25,
        aventura: 98,
      });
      expect(new Set(result.items.map((item) => item.slug)).size).toBe(174);
      expect(result.items.every((item) => item.custo.trim().length > 0)).toBe(true);
    },
  );
});
