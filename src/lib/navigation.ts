export function safeInternalPath(value: string | null | undefined, fallback = "/"): string {
  if (!value) return fallback;
  if (!value.startsWith("/") || value.startsWith("//")) return fallback;
  if (/[\u0000-\u001f]/.test(value)) return fallback;
  return value;
}

export function spellHref(id: string, from: string): string {
  return `/magias/${encodeURIComponent(id)}?from=${encodeURIComponent(safeInternalPath(from))}`;
}

export function withSearchParams(
  pathname: string,
  current: URLSearchParams,
  updates: Record<string, string | number | null | undefined>,
): string {
  const params = new URLSearchParams(current.toString());
  for (const [key, value] of Object.entries(updates)) {
    if (value === null || value === undefined || value === "") {
      params.delete(key);
    } else {
      params.set(key, String(value));
    }
  }
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}
