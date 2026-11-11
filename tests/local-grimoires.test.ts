// @vitest-environment jsdom
import "fake-indexeddb/auto";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { resetLocalDatabaseForTests } from "@/lib/local/database";
import {
  atualizarSelecaoMagia,
  carregarColecoesLocais,
  criarGrimorio,
  excluirGrimorio,
  listarGrimorios,
  obterGrimoriosDaMagia,
  renomearGrimorio,
} from "@/lib/local/grimoires";
import {
  RESERVED_GRIMOIRE_ID,
  RESERVED_GRIMOIRE_NAME,
} from "@/lib/validation/grimoire";

const SPELL_A = "11111111-1111-4111-8111-111111111111";
const SPELL_B = "22222222-2222-4222-8222-222222222222";

beforeEach(async () => {
  await resetLocalDatabaseForTests();
});

afterEach(async () => {
  await resetLocalDatabaseForTests();
});

describe("coleções locais", () => {
  it("cria a coleção reservada automaticamente", async () => {
    const snapshot = await carregarColecoesLocais();

    expect(snapshot.reserved).toMatchObject({
      id: RESERVED_GRIMOIRE_ID,
      nome: RESERVED_GRIMOIRE_NAME,
      total: 0,
    });
    expect(snapshot.namedGrimoires).toEqual([]);
    expect(snapshot.totalUnique).toBe(0);

    const lists = await listarGrimorios();
    expect(lists).toHaveLength(1);
    expect(lists[0]?.reservada).toBe(true);
  });

  it("cria grimórios com nome normalizado e impede duplicidade sem diferenciar caixa", async () => {
    const created = await criarGrimorio("  Campanha da Floresta  ");

    expect(created.nome).toBe("Campanha da Floresta");
    expect(created.id).not.toBe(RESERVED_GRIMOIRE_ID);

    await expect(criarGrimorio("campanha da floresta")).rejects.toThrow(
      "Já existe um grimório com esse nome.",
    );
    await expect(criarGrimorio("   ")).rejects.toThrow("Informe um nome para o grimório.");
  });

  it("reserva o nome Sem grimório para a coleção automática", async () => {
    await expect(criarGrimorio(RESERVED_GRIMOIRE_NAME)).rejects.toThrow(
      "O nome “Sem grimório” é reservado.",
    );

    const created = await criarGrimorio("Combate");
    await expect(renomearGrimorio(created.id, "sem grimório")).rejects.toThrow(
      "O nome “Sem grimório” é reservado.",
    );
  });

  it("impede renomear e excluir a coleção reservada", async () => {
    await expect(renomearGrimorio(RESERVED_GRIMOIRE_ID, "Outro nome")).rejects.toThrow(
      "A coleção “Sem grimório” não pode ser renomeada.",
    );
    await expect(excluirGrimorio(RESERVED_GRIMOIRE_ID)).rejects.toThrow(
      "A coleção “Sem grimório” não pode ser excluída.",
    );
  });

  it("mantém Sem grimório exclusivo em relação aos grimórios nomeados", async () => {
    const combat = await criarGrimorio("Combate");
    const support = await criarGrimorio("Suporte");

    await expect(
      atualizarSelecaoMagia(SPELL_A, {
        grimorioIds: [combat.id],
        semGrimorio: true,
      }),
    ).rejects.toThrow("“Sem grimório” é exclusivo");

    await atualizarSelecaoMagia(SPELL_A, {
      grimorioIds: [combat.id, support.id],
      semGrimorio: false,
    });
    expect(new Set(await obterGrimoriosDaMagia(SPELL_A))).toEqual(
      new Set([combat.id, support.id]),
    );

    await atualizarSelecaoMagia(SPELL_A, {
      grimorioIds: [],
      semGrimorio: true,
    });
    expect(await obterGrimoriosDaMagia(SPELL_A)).toEqual([RESERVED_GRIMOIRE_ID]);

    await atualizarSelecaoMagia(SPELL_A, {
      grimorioIds: [support.id],
      semGrimorio: false,
    });
    expect(await obterGrimoriosDaMagia(SPELL_A)).toEqual([support.id]);
  });

  it("move para Sem grimório as magias sem outro grimório nomeado ao excluir", async () => {
    const combat = await criarGrimorio("Combate");
    const support = await criarGrimorio("Suporte");

    await atualizarSelecaoMagia(SPELL_A, {
      grimorioIds: [combat.id],
      semGrimorio: false,
    });
    await atualizarSelecaoMagia(SPELL_B, {
      grimorioIds: [combat.id, support.id],
      semGrimorio: false,
    });

    await excluirGrimorio(combat.id);

    expect((await listarGrimorios()).map((list) => list.id)).not.toContain(combat.id);
    expect(await obterGrimoriosDaMagia(SPELL_A)).toEqual([RESERVED_GRIMOIRE_ID]);
    expect(await obterGrimoriosDaMagia(SPELL_B)).toEqual([support.id]);

    const snapshot = await carregarColecoesLocais();
    expect(snapshot.totalUnique).toBe(2);
    expect(snapshot.reserved.total).toBe(1);
    expect(snapshot.namedGrimoires.find((list) => list.id === support.id)?.total).toBe(1);
  });

  it("conta magias únicas em Todas sem duplicar quem está em vários grimórios", async () => {
    const combat = await criarGrimorio("Combate");
    const support = await criarGrimorio("Suporte");

    await atualizarSelecaoMagia(SPELL_A, {
      grimorioIds: [combat.id, support.id],
      semGrimorio: false,
    });

    const snapshot = await carregarColecoesLocais();
    expect(snapshot.totalUnique).toBe(1);
    expect(snapshot.namedGrimoires.map((list) => [list.nome, list.total])).toEqual([
      ["Combate", 1],
      ["Suporte", 1],
    ]);
  });
});
