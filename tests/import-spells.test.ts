import { describe, expect, it } from "vitest";

import { readSourceCatalog, validateCatalogEntries, buildImportReport } from "@/lib/import/spells";

import { makeSpell } from "./fixtures";

describe("catalog import validation", () => {
  it("accepts valid spells and reports the indices of invalid entries", () => {
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

  it("reconciles missing and extra database slugs", () => {
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

  it("does not report reconciliation when the database was not queried", () => {
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

describe("reference catalog", () => {
  it("contains all 391 extracted spells without validation errors", async () => {
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
