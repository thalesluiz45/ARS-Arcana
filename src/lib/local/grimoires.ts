import { getDatabase, LocalStorageError } from "@/lib/local/database";
import { notifyLocalDataChanged } from "@/lib/local/events";
import {
  grimoireNameSchema,
  RESERVED_GRIMOIRE_ID,
  RESERVED_GRIMOIRE_NAME,
  type Grimoire,
  type GrimoireWithCount,
  type SavedSpell,
} from "@/lib/validation/grimoire";
import { spellIdSchema } from "@/lib/validation/spell";

export type LocalCollectionsSnapshot = {
  lists: Grimoire[];
  namedGrimoires: GrimoireWithCount[];
  reserved: GrimoireWithCount;
  totalUnique: number;
  associations: SavedSpell[];
};

export type SpellSelection = {
  grimoireIds: string[];
  withoutGrimoire: boolean;
};

const currentIsoDate = () => new Date().toISOString();

function normalizeName(value: string): string {
  return value.trim().toLocaleLowerCase("pt-BR");
}

function isReservedGrimoireName(value: string): boolean {
  return normalizeName(value) === normalizeName(RESERVED_GRIMOIRE_NAME);
}

function createGrimoireId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `grimorio-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function validateGrimoireName(name: string): string {
  const parsed = grimoireNameSchema.safeParse(name);
  if (!parsed.success) {
    throw new LocalStorageError(parsed.error.issues[0]?.message ?? "Nome de grimório inválido.");
  }
  return parsed.data;
}

function validateSpellId(spellId: string): string {
  const parsed = spellIdSchema.safeParse(spellId);
  if (!parsed.success) {
    throw new LocalStorageError("Identificador de magia inválido.");
  }
  return parsed.data;
}

async function guard<T>(message: string, operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof LocalStorageError) throw error;
    throw new LocalStorageError(message, { cause: error });
  }
}

function abortTransaction(
  transaction: { abort: () => void; done: Promise<unknown> },
  message: string,
): never {
  transaction.abort();
  void transaction.done.catch(() => undefined);
  throw new LocalStorageError(message);
}

function sortGrimoires(lists: Grimoire[]): Grimoire[] {
  return [...lists].sort((left, right) => {
    if (left.reservada) return 1;
    if (right.reservada) return -1;
    return left.nome.localeCompare(right.nome, "pt-BR");
  });
}

function countSpellsByGrimoire(associations: SavedSpell[]): Map<string, Set<string>> {
  const counts = new Map<string, Set<string>>();
  for (const association of associations) {
    const set = counts.get(association.listaId) ?? new Set<string>();
    set.add(association.magiaId);
    counts.set(association.listaId, set);
  }
  return counts;
}

function addSpellCount(list: Grimoire, counts: Map<string, Set<string>>): GrimoireWithCount {
  return { ...list, total: counts.get(list.id)?.size ?? 0 };
}

export async function loadLocalCollections(): Promise<LocalCollectionsSnapshot> {
  return guard("Não foi possível carregar seus grimórios locais.", async () => {
    const db = await getDatabase();
    const transaction = db.transaction(["listas_salvas", "magias_salvas"], "readonly");
    const [lists, associations] = await Promise.all([
      transaction.objectStore("listas_salvas").getAll(),
      transaction.objectStore("magias_salvas").getAll(),
    ]);
    await transaction.done;

    const counts = countSpellsByGrimoire(associations);
    const sorted = sortGrimoires(lists);
    const reservedList =
      sorted.find((list) => list.reservada) ??
      ({
        id: RESERVED_GRIMOIRE_ID,
        nome: RESERVED_GRIMOIRE_NAME,
        criadaEm: currentIsoDate(),
        atualizadaEm: currentIsoDate(),
        reservada: true,
      } satisfies Grimoire);
    const namedGrimoires = sorted
      .filter((list) => !list.reservada)
      .map((list) => addSpellCount(list, counts));
    const unique = new Set(associations.map((association) => association.magiaId));

    return {
      lists: sorted,
      namedGrimoires,
      reserved: addSpellCount(reservedList, counts),
      totalUnique: unique.size,
      associations,
    };
  });
}

export async function listGrimoires(): Promise<Grimoire[]> {
  return guard("Não foi possível carregar seus grimórios.", async () => {
    const db = await getDatabase();
    return sortGrimoires(await db.getAll("listas_salvas"));
  });
}

export async function createGrimoire(name: string): Promise<Grimoire> {
  const validName = validateGrimoireName(name);
  if (isReservedGrimoireName(validName)) {
    throw new LocalStorageError("O nome “Sem grimório” é reservado.");
  }
  return guard("Não foi possível criar o grimório.", async () => {
    const db = await getDatabase();
    const transaction = db.transaction("listas_salvas", "readwrite");
    const store = transaction.objectStore("listas_salvas");
    const lists = await store.getAll();

    if (
      lists.some(
        (list) => !list.reservada && normalizeName(list.nome) === normalizeName(validName),
      )
    ) {
      abortTransaction(transaction, "Já existe um grimório com esse nome.");
    }

    const now = currentIsoDate();
    const grimoire: Grimoire = {
      id: createGrimoireId(),
      nome: validName,
      criadaEm: now,
      atualizadaEm: now,
      reservada: false,
    };
    await store.add(grimoire);
    await transaction.done;
    notifyLocalDataChanged({ reason: "grimoire-created", listaId: grimoire.id });
    return grimoire;
  });
}

export async function renameGrimoire(grimoireId: string, name: string): Promise<void> {
  const validName = validateGrimoireName(name);
  if (isReservedGrimoireName(validName)) {
    throw new LocalStorageError("O nome “Sem grimório” é reservado.");
  }
  return guard("Não foi possível renomear o grimório.", async () => {
    const db = await getDatabase();
    const transaction = db.transaction("listas_salvas", "readwrite");
    const store = transaction.objectStore("listas_salvas");
    const list = await store.get(grimoireId);

    if (!list) {
      abortTransaction(transaction, "Grimório não encontrado.");
    }
    if (list.reservada || list.id === RESERVED_GRIMOIRE_ID) {
      abortTransaction(transaction, "A coleção “Sem grimório” não pode ser renomeada.");
    }

    const lists = await store.getAll();
    if (
      lists.some(
        (candidate) =>
          candidate.id !== grimoireId &&
          !candidate.reservada &&
          normalizeName(candidate.nome) === normalizeName(validName),
      )
    ) {
      abortTransaction(transaction, "Já existe um grimório com esse nome.");
    }

    await store.put({ ...list, nome: validName, atualizadaEm: currentIsoDate() });
    await transaction.done;
    notifyLocalDataChanged({ reason: "grimoire-renamed", listaId: grimoireId });
  });
}

export async function deleteGrimoire(grimoireId: string): Promise<void> {
  return guard("Não foi possível excluir o grimório.", async () => {
    const db = await getDatabase();
    const transaction = db.transaction(["listas_salvas", "magias_salvas"], "readwrite");
    const listsStore = transaction.objectStore("listas_salvas");
    const spellsStore = transaction.objectStore("magias_salvas");
    const list = await listsStore.get(grimoireId);

    if (!list) {
      abortTransaction(transaction, "Grimório não encontrado.");
    }
    if (list.reservada || list.id === RESERVED_GRIMOIRE_ID) {
      abortTransaction(transaction, "A coleção “Sem grimório” não pode ser excluída.");
    }

    const allLists = await listsStore.getAll();
    const namedIds = new Set(
      allLists.filter((candidate) => !candidate.reservada).map((candidate) => candidate.id),
    );
    const associations = await spellsStore.index("by-lista").getAll(grimoireId);

    for (const association of associations) {
      const spellAssociations = await spellsStore.index("by-magia").getAll(association.magiaId);
      const hasOtherNamedGrimoire = spellAssociations.some(
        (candidate) => candidate.listaId !== grimoireId && namedIds.has(candidate.listaId),
      );
      const alreadyReserved = spellAssociations.some(
        (candidate) => candidate.listaId === RESERVED_GRIMOIRE_ID,
      );

      if (!hasOtherNamedGrimoire && !alreadyReserved) {
        await spellsStore.put({
          listaId: RESERVED_GRIMOIRE_ID,
          magiaId: association.magiaId,
          salvaEm: association.salvaEm,
        });
      }
      await spellsStore.delete([grimoireId, association.magiaId]);
    }

    await listsStore.delete(grimoireId);
    await transaction.done;
    notifyLocalDataChanged({ reason: "grimoire-deleted", listaId: grimoireId });
  });
}

export async function listSavedSpells(grimoireId?: string): Promise<SavedSpell[]> {
  return guard("Não foi possível carregar as magias salvas.", async () => {
    const db = await getDatabase();
    if (grimoireId) {
      return db.getAllFromIndex("magias_salvas", "by-lista", grimoireId);
    }
    return db.getAll("magias_salvas");
  });
}

export async function getGrimoireIdsForSpell(spellId: string): Promise<string[]> {
  const validId = validateSpellId(spellId);
  return guard("Não foi possível verificar os grimórios desta magia.", async () => {
    const db = await getDatabase();
    const associations = await db.getAllFromIndex("magias_salvas", "by-magia", validId);
    return associations.map((association) => association.listaId);
  });
}

export async function updateSpellSelection(
  spellId: string,
  selection: SpellSelection,
): Promise<void> {
  const validId = validateSpellId(spellId);
  const namedIds = [...new Set(selection.grimoireIds.filter((id) => id !== RESERVED_GRIMOIRE_ID))];
  const includeReserved =
    selection.withoutGrimoire || selection.grimoireIds.includes(RESERVED_GRIMOIRE_ID);

  if (includeReserved && namedIds.length > 0) {
    throw new LocalStorageError(
      "“Sem grimório” é exclusivo: remova a seleção dos grimórios nomeados para usá-lo.",
    );
  }

  return guard("Não foi possível salvar a magia no armazenamento local.", async () => {
    const db = await getDatabase();
    const transaction = db.transaction(["listas_salvas", "magias_salvas"], "readwrite");
    const listsStore = transaction.objectStore("listas_salvas");
    const spellsStore = transaction.objectStore("magias_salvas");
    const lists = await listsStore.getAll();
    const named = new Set(lists.filter((list) => !list.reservada).map((list) => list.id));

    for (const id of namedIds) {
      if (!named.has(id)) {
        abortTransaction(transaction, "Um dos grimórios selecionados não existe mais.");
      }
    }

    const existing = await spellsStore.index("by-magia").getAll(validId);
    for (const association of existing) {
      await spellsStore.delete([association.listaId, association.magiaId]);
    }

    const salvaEm = currentIsoDate();
    if (includeReserved) {
      await spellsStore.put({ listaId: RESERVED_GRIMOIRE_ID, magiaId: validId, salvaEm });
    } else {
      for (const listaId of namedIds) {
        await spellsStore.put({ listaId, magiaId: validId, salvaEm });
      }
    }

    await transaction.done;
    notifyLocalDataChanged({ reason: "spell-saved", magiaId: validId });
  });
}

export async function saveSpell(grimoireId: string, spellId: string): Promise<void> {
  const validId = validateSpellId(spellId);
  return guard("Não foi possível salvar a magia.", async () => {
    const db = await getDatabase();
    const transaction = db.transaction(["listas_salvas", "magias_salvas"], "readwrite");
    const listsStore = transaction.objectStore("listas_salvas");
    const spellsStore = transaction.objectStore("magias_salvas");
    const list = await listsStore.get(grimoireId);

    if (!list) {
      abortTransaction(transaction, "Grimório não encontrado.");
    }

    const salvaEm = currentIsoDate();
    if (list.reservada) {
      const namedLists = new Set(
        (await listsStore.getAll())
          .filter((candidate) => !candidate.reservada)
          .map((candidate) => candidate.id),
      );
      const existing = await spellsStore.index("by-magia").getAll(validId);
      for (const association of existing) {
        if (namedLists.has(association.listaId)) {
          await spellsStore.delete([association.listaId, association.magiaId]);
        }
      }
      await spellsStore.put({ listaId: RESERVED_GRIMOIRE_ID, magiaId: validId, salvaEm });
    } else {
      await spellsStore.put({ listaId: grimoireId, magiaId: validId, salvaEm });
      await spellsStore.delete([RESERVED_GRIMOIRE_ID, validId]);
    }

    await transaction.done;
    notifyLocalDataChanged({ reason: "spell-saved", magiaId: validId, listaId: grimoireId });
  });
}

export async function removeSavedSpell(grimoireId: string, spellId: string): Promise<void> {
  const validId = validateSpellId(spellId);
  return guard("Não foi possível remover a magia.", async () => {
    const db = await getDatabase();
    await db.delete("magias_salvas", [grimoireId, validId]);
    notifyLocalDataChanged({ reason: "spell-removed", magiaId: validId, listaId: grimoireId });
  });
}

export async function countUniqueSpells(): Promise<number> {
  return guard("Não foi possível contar suas magias salvas.", async () => {
    const db = await getDatabase();
    const associations = await db.getAll("magias_salvas");
    return new Set(associations.map((association) => association.magiaId)).size;
  });
}

export async function getSavedSpellAssociations(spellId: string): Promise<SavedSpell[]> {
  const validId = validateSpellId(spellId);
  return guard("Não foi possível verificar as listas desta magia.", async () => {
    const db = await getDatabase();
    return db.getAllFromIndex("magias_salvas", "by-magia", validId);
  });
}

export function getReservedGrimoireId(): string {
  return RESERVED_GRIMOIRE_ID;
}

export function isReservedGrimoire(list: Pick<Grimoire, "id" | "reservada">): boolean {
  return list.reservada || list.id === RESERVED_GRIMOIRE_ID;
}
