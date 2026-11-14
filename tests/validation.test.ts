import { describe, expect, it } from "vitest";

import { makeSpell } from "./fixtures";
import { catalogFilterSchema, parseCatalogFilters } from "@/lib/validation/catalog";
import {
  grimoireNameSchema,
  grimoireSnapshotSchema,
  spellSelectionRequestSchema,
} from "@/lib/validation/grimoire";
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

describe("remote grimoire payloads", () => {
  const grimoire = {
    id: "11111111-1111-4111-8111-111111111111",
    nome: "Combate",
    criadaEm: NOW,
    atualizadaEm: NOW,
    reservada: false,
  };

  it("accepts a snapshot with named collections, reserved collection, and UUID associations", () => {
    const parsed = grimoireSnapshotSchema.safeParse({
      lists: [grimoire, { ...grimoire, id: "22222222-2222-4222-8222-222222222222", nome: "Sem grimório", reservada: true }],
      namedGrimoires: [{ ...grimoire, total: 1 }],
      reserved: {
        ...grimoire,
        id: "22222222-2222-4222-8222-222222222222",
        nome: "Sem grimório",
        reservada: true,
        total: 0,
      },
      totalUnique: 1,
      associations: [
        {
          listaId: grimoire.id,
          magiaId: "33333333-3333-4333-8333-333333333333",
          salvaEm: NOW,
        },
      ],
    });

    expect(parsed.success).toBe(true);
  });

  it("rejects malformed spell IDs and negative counts", () => {
    expect(
      grimoireSnapshotSchema.safeParse({
        lists: [],
        namedGrimoires: [{ ...grimoire, total: -1 }],
        reserved: { ...grimoire, total: 0 },
        totalUnique: 0,
        associations: [],
      }).success,
    ).toBe(false);

    expect(
      spellSelectionRequestSchema.safeParse({
        magiaId: "not-a-uuid",
        grimoireIds: [],
        withoutGrimoire: false,
      }).success,
    ).toBe(false);
  });

  it("validates selection requests with UUID collections", () => {
    expect(
      spellSelectionRequestSchema.safeParse({
        magiaId: "33333333-3333-4333-8333-333333333333",
        grimoireIds: [grimoire.id],
        withoutGrimoire: false,
      }).success,
    ).toBe(true);

    expect(
      spellSelectionRequestSchema.safeParse({
        magiaId: "33333333-3333-4333-8333-333333333333",
        grimoireIds: ["sem-grimorio"],
        withoutGrimoire: true,
      }).success,
    ).toBe(false);
  });
});
