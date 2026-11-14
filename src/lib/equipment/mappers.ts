import type { DatabaseRow } from "@/lib/db/types";
import {
  armorEquipmentSchema,
  adventureEquipmentSchema,
  toolEquipmentSchema,
  weaponEquipmentSchema,
  type Equipment,
} from "@/lib/validation/equipment";

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }
  if (typeof value === "string") {
    return value
      .replace(/^\{/, "")
      .replace(/\}$/, "")
      .split(",")
      .map((item) => item.replace(/^"|"$/g, "").trim())
      .filter(Boolean);
  }
  return [];
}

export function mapEquipmentRow(row: DatabaseRow): Equipment {
  const base = {
    slug: String(row.slug),
    nome: String(row.nome),
    peso: row.peso ?? null,
    custo: String(row.custo),
    fontePagina: Number(row.fonte_pagina),
  };

  switch (row.tipo) {
    case "arma":
      return weaponEquipmentSchema.parse({
        ...base,
        tipo: "arma",
        categoria: row.categoria,
        dano: row.dano,
        tipoDano: row.tipo_dano,
        propriedades: toStringArray(row.propriedades),
        maestria: row.maestria,
      });
    case "armadura":
      return armorEquipmentSchema.parse({
        ...base,
        tipo: "armadura",
        categoria: row.categoria,
        classeArmadura: row.classe_armadura,
        forca: row.forca ?? null,
        furtividade: row.furtividade ?? null,
      });
    case "ferramenta":
      return toolEquipmentSchema.parse({
        ...base,
        tipo: "ferramenta",
        categoria: row.categoria,
        atributo: row.atributo,
        descricao: row.descricao,
      });
    case "aventura":
      return adventureEquipmentSchema.parse({
        ...base,
        tipo: "aventura",
        descricao: row.descricao,
      });
    default:
      throw new Error(`Tipo de equipamento desconhecido no banco: ${String(row.tipo)}`);
  }
}
