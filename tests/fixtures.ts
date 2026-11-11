import type { MagiaImport } from "@/lib/validation/magia";

export function makeSpell(overrides: Partial<MagiaImport> = {}): MagiaImport {
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
