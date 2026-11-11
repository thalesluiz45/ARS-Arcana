import { describe, expect, it } from "vitest";

import { makeSpell } from "./fixtures";
import { catalogFilterSchema, parseCatalogFilters } from "@/lib/validation/catalog";
import { grimoireNameSchema } from "@/lib/validation/grimoire";
import {
  isConcentrationSpell,
  magiaSchema,
  spellCircleLabel,
  spellComponentsLabel,
} from "@/lib/validation/magia";

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

describe("validação de magia", () => {
  it("aceita truques (círculo 0) e o 9º círculo", () => {
    expect(magiaSchema.safeParse(fullSpell({ circulo: 0 })).success).toBe(true);
    expect(magiaSchema.safeParse(fullSpell({ circulo: 9 })).success).toBe(true);
    expect(spellCircleLabel(0)).toBe("Truque");
    expect(spellCircleLabel(9)).toBe("9º Círculo");
  });

  it("rejeita círculos fora de 0-9", () => {
    expect(magiaSchema.safeParse(fullSpell({ circulo: -1 })).success).toBe(false);
    expect(magiaSchema.safeParse(fullSpell({ circulo: 10 })).success).toBe(false);
    expect(magiaSchema.safeParse(fullSpell({ circulo: 1.5 })).success).toBe(false);
  });

  it("exige escola, classes e campos obrigatórios", () => {
    expect(magiaSchema.safeParse(fullSpell({ tipo: "" })).success).toBe(false);
    expect(magiaSchema.safeParse(fullSpell({ classes: [] })).success).toBe(false);
    expect(magiaSchema.safeParse(fullSpell({ nome: "  " })).success).toBe(false);
    expect(magiaSchema.safeParse(fullSpell({ componentes: { verbal: false } })).success).toBe(
      false,
    );
  });

  it("rejeita descrição material sem a flag material", () => {
    const result = magiaSchema.safeParse(
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

  it("normaliza datas e identifica concentração", () => {
    const parsed = magiaSchema.parse(
      fullSpell({
        criadoEm: new Date("2026-02-03T10:20:30.000Z"),
        atualizadoEm: new Date("2026-02-03T10:20:30.000Z"),
      }),
    );
    expect(parsed.criadoEm).toBe("2026-02-03T10:20:30.000Z");
    expect(isConcentrationSpell("Concentração, até 1 minuto")).toBe(true);
    expect(isConcentrationSpell("Instantânea")).toBe(false);
  });

  it("monta o rótulo dos componentes", () => {
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

describe("filtros do catálogo", () => {
  it("lê círculo 0 e listas de tipos/classes da URL", () => {
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

  it("ignora círculo e página inválidos e limita o page size", () => {
    const filters = parseCatalogFilters(
      new URLSearchParams("circulo=10&page=-2&limit=500&sort=invalido"),
    );

    expect(filters.circulo).toBeNull();
    expect(filters.page).toBe(1);
    expect(filters.limit).toBe(12);
    expect(filters.sort).toBe("nome-asc");
  });

  it("mantém o círculo 0 no schema de filtros", () => {
    expect(catalogFilterSchema.parse({ circulo: 0 }).circulo).toBe(0);
  });
});

describe("nome de grimório", () => {
  it("remove espaços e exige nome não vazio e curto", () => {
    expect(grimoireNameSchema.parse("  Combate  ")).toBe("Combate");
    expect(grimoireNameSchema.safeParse("").success).toBe(false);
    expect(grimoireNameSchema.safeParse("a".repeat(61)).success).toBe(false);
  });
});
