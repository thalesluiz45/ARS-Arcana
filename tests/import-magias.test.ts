import { describe, expect, it } from "vitest";

import { readSourceCatalog, validateCatalogEntries, buildImportReport } from "@/lib/import/magias";

import { makeSpell } from "./fixtures";

describe("validação da importação", () => {
  it("aceita magias válidas e reporta o índice dos registros inválidos", () => {
    const valid = makeSpell();
    const result = validateCatalogEntries([
      valid,
      { ...valid },
      { ...valid, slug: "circulo-invalido", circulo: 10 },
      { ...valid, slug: "sem-classes", classes: [] },
      { ...valid, slug: "circulo-nove", circulo: 9, classes: ["Mago"] },
    ]);

    expect(result.spells).toHaveLength(2);
    expect(result.spells.map((spell) => spell.slug)).toEqual(["bola-de-fogo", "circulo-nove"]);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ index: 1, slug: "bola-de-fogo" }),
        expect.objectContaining({ index: 2, slug: "circulo-invalido" }),
        expect.objectContaining({ index: 3, slug: "sem-classes" }),
      ]),
    );
    expect(result.issues).toHaveLength(3);
  });

  it("reconcilia slugs ausentes e extras no banco", () => {
    const validated = {
      spells: [makeSpell({ slug: "bola-de-fogo" }), makeSpell({ slug: "curar-ferimentos" })],
      issues: [],
    };
    const report = buildImportReport({
      entries: [
        { ...makeSpell({ slug: "bola-de-fogo" }), fontePagina: 250 },
        { ...makeSpell({ slug: "curar-ferimentos" }), fontePagina: 300 },
      ],
      validated,
      upserted: [
        { slug: "bola-de-fogo", id: "1", inserted: true },
        { slug: "curar-ferimentos", id: "2", inserted: false },
      ],
      databaseSlugs: ["bola-de-fogo", "curar-ferimentos", "magia-antiga"],
      dryRun: false,
    });

    expect(report).toMatchObject({
      sourceCount: 2,
      validCount: 2,
      invalidCount: 0,
      inserted: 1,
      updated: 1,
      missingFromDatabase: [],
      extraInDatabase: ["magia-antiga"],
      databaseCount: 3,
      pages: { first: 250, last: 300 },
      dryRun: false,
    });
  });

  it("não inventa reconciliação quando o banco não foi consultado", () => {
    const report = buildImportReport({
      entries: [],
      validated: { spells: [], issues: [] },
      upserted: [],
      databaseSlugs: null,
      dryRun: true,
    });

    expect(report.databaseCount).toBeNull();
    expect(report.missingFromDatabase).toEqual([]);
    expect(report.extraInDatabase).toEqual([]);
  });
});

describe("catálogo de referência", () => {
  it("contém as 391 magias extraídas sem erros de validação", async () => {
    const { entries } = await readSourceCatalog();
    const result = validateCatalogEntries(entries);

    expect(entries).toHaveLength(391);
    expect(result.issues).toEqual([]);
    expect(result.spells).toHaveLength(391);
    expect(result.spells.some((spell) => spell.circulo === 0)).toBe(true);
    expect(result.spells.some((spell) => spell.circulo === 9)).toBe(true);
    expect(result.spells.every((spell) => spell.classes.length > 0)).toBe(true);
  });
});
