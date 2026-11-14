import type { SpellImport } from "@/lib/validation/spell";
import type {
  AdventureEquipment,
  ArmorEquipment,
  Equipment,
  ToolEquipment,
  WeaponEquipment,
} from "@/lib/validation/equipment";

export function makeSpell(overrides: Partial<SpellImport> = {}): SpellImport {
  return {
    slug: "bola-de-fogo",
    nome: "Bola de Fogo",
    tipo: "Evocação",
    classes: ["Feiticeiro", "Mago"],
    circulo: 3,
    descricao: "Uma esfera de fogo explode em um ponto escolhido dentro do alcance.",
    tempoConjuracao: "Ação",
    alcance: "45 metros",
    duracao: "Instantânea",
    componentes: {
      verbal: true,
      somatico: true,
      material: true,
      materialDescricao: "Uma bolinha de enxofre e guano de morcego.",
    },
    ...overrides,
  };
}

export function makeWeapon(
  overrides: Partial<WeaponEquipment> = {},
): WeaponEquipment {
  return {
    slug: "espada-longa",
    nome: "Espada Longa",
    tipo: "arma",
    categoria: "Marcial Corpo a Corpo",
    dano: "1d8",
    tipoDano: "Cortante",
    propriedades: ["Versátil (1d10)"],
    maestria: "Derrubar",
    peso: "1,5 kg",
    custo: "15 PO",
    fontePagina: 215,
    ...overrides,
  };
}

export function makeArmor(
  overrides: Partial<ArmorEquipment> = {},
): ArmorEquipment {
  return {
    slug: "armadura-de-couro",
    nome: "Armadura de Couro",
    tipo: "armadura",
    categoria: "Leve",
    classeArmadura: "11 + modificador de Des",
    forca: null,
    furtividade: null,
    peso: "5 kg",
    custo: "10 PO",
    fontePagina: 219,
    ...overrides,
  };
}

export function makeTool(overrides: Partial<ToolEquipment> = {}): ToolEquipment {
  return {
    slug: "ferramentas-de-ladrao",
    nome: "Ferramentas de Ladrão",
    tipo: "ferramenta",
    categoria: "Outras Ferramentas",
    atributo: "Destreza",
    descricao: "Ferramentas para abrir fechaduras e desarmar armadilhas.",
    peso: "0,5 kg",
    custo: "25 PO",
    fontePagina: 221,
    ...overrides,
  };
}

export function makeAdventure(
  overrides: Partial<AdventureEquipment> = {},
): AdventureEquipment {
  return {
    slug: "corda",
    nome: "Corda",
    tipo: "aventura",
    descricao: "Uma corda resistente de 15 metros.",
    peso: "2,5 kg",
    custo: "1 PO",
    fontePagina: 224,
    ...overrides,
  };
}

export function makeEquipment(): Equipment[] {
  return [makeWeapon(), makeArmor(), makeTool(), makeAdventure()];
}
