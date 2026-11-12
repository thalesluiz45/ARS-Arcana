import { describe, expect, it } from "vitest";

import { makeSpell } from "./fixtures";
import { catalogFilterSchema, parseCatalogFilters } from "@/lib/validation/catalog";
import { grimoireNameSchema } from "@/lib/validation/grimoire";
import {
  isConcentrationSpell,
  spellSchema,
  spellCircleLabel,
  spellComponentsLabel,
} from "@/lib/validation/spell";

const NOW = "2026-01-01T00:00:00.000Z";

function fullSpell(overrides: Record<string, unknown> = {}) {
  return {
    ...makeSpell(),
    id: "11111111-1111-4111-8111-111111111111",
    criadoEm: NOW,
    atualizadoEm: NOW,
    ...overrides,
  };
}

describe("spell validation", () => {
  it("accepts cantrips (circle 0) and 9th-level spells", () => {
    expect(spellSchema.safeParse(fullSpell({ circulo: 0 })).success).toBe(true);
    expect(spellSchema.safeParse(fullSpell({ circulo: 9 })).success).toBe(true);
    expect(spellCircleLabel(0)).toBe("Truque");
    expect(spellCircleLabel(9)).toBe("9º Círculo");
  });

  it("rejects circles outside the 0-9 range", () => {
    expect(spellSchema.safeParse(fullSpell({ circulo: -1 })).success).toBe(false);
    expect(spellSchema.safeParse(fullSpell({ circulo: 10 })).success).toBe(false);
    expect(spellSchema.safeParse(fullSpell({ circulo: 1.5 })).success).toBe(false);
  });

  it("requires a school, classes, and all required fields", () => {
    expect(spellSchema.safeParse(fullSpell({ tipo: "" })).success).toBe(false);
    expect(spellSchema.safeParse(fullSpell({ classes: [] })).success).toBe(false);
    expect(spellSchema.safeParse(fullSpell({ nome: "  " })).success).toBe(false);
    expect(spellSchema.safeParse(fullSpell({ componentes: { verbal: false } })).success).toBe(
      false,
    );
  });

  it("rejects a material description when the material flag is false", () => {
    const result =     spellSchema.safeParse(
      fullSpell({
        componentes: {
          verbal: true,
          somatico: false,
          material: false,
          materialDescricao: "Uma pena",
        },
      }),
    );
    expect(result.success).toBe(false);
  });

  it("normalizes dates and identifies concentration", () => {
    const parsed =     spellSchema.parse(
      fullSpell({
        criadoEm: new Date("2026-02-03T10:20:30.000Z"),
        atualizadoEm: new Date("2026-02-03T10:20:30.000Z"),
      }),
    );
    expect(parsed.criadoEm).toBe("2026-02-03T10:20:30.000Z");
    expect(isConcentrationSpell("Concentração, até 1 minuto")).toBe(true);
    expect(isConcentrationSpell("Instantânea")).toBe(false);
  });

  it("formats component labels", () => {
    expect(
      spellComponentsLabel({
        verbal: true,
        somatico: true,
        material: true,
        materialDescricao: null,
      }),
    ).toBe("V · S · M");
    expect(
      spellComponentsLabel({
        verbal: false,
        somatico: true,
        material: false,
        materialDescricao: null,
      }),
    ).toBe("S");
  });
});

describe("catalog filters", () => {
  it("reads circle 0 and type/class lists from the URL", () => {
    const filters = parseCatalogFilters(
      new URLSearchParams(
        "circulo=0&tipo=Evoca%C3%A7%C3%A3o&classe=Mago&classe=Cl%C3%A9rigo&sort=circulo-asc&page=2",
      ),
    );

    expect(filters.circulo).toBe(0);
    expect(filters.tipos).toEqual(["Evocação"]);
    expect(filters.classes).toEqual(["Mago", "Clérigo"]);
    expect(filters.sort).toBe("circulo-asc");
    expect(filters.page).toBe(2);
  });

  it("ignores invalid circles and pages and limits the page size", () => {
    const filters = parseCatalogFilters(
      new URLSearchParams("circulo=10&page=-2&limit=500&sort=invalido"),
    );

    expect(filters.circulo).toBeNull();
    expect(filters.page).toBe(1);
    expect(filters.limit).toBe(12);
    expect(filters.sort).toBe("nome-asc");
  });

  it("accepts circle 0 in the filter schema", () => {
    expect(catalogFilterSchema.parse({ circulo: 0 }).circulo).toBe(0);
  });
});

describe("grimoire names", () => {
  it("trims whitespace and requires a non-empty name within the length limit", () => {
    expect(grimoireNameSchema.parse("  Combate  ")).toBe("Combate");
    expect(grimoireNameSchema.safeParse("").success).toBe(false);
    expect(grimoireNameSchema.safeParse("a".repeat(61)).success).toBe(false);
  });
});
