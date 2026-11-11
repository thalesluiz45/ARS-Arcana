export function normalizeForSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .trim();
}

export function matchesSearch(haystacks: string[], query: string): boolean {
  const normalized = normalizeForSearch(query);
  if (!normalized) return true;
  return haystacks.some((value) => normalizeForSearch(value).includes(normalized));
}
