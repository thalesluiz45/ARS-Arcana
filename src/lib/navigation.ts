export function safeInternalPath(value: string | null | undefined, fallback = "/"): string {
  if (!value) return fallback;
  if (!value.startsWith("/") || value.startsWith("//")) return fallback;
  if (value.includes("\\") || /[\u0000-\u001f]/.test(value)) return fallback;
  return value;
}

export function currentLoginHref(): string {
  if (typeof window === "undefined") return "/login";
  const current = `${window.location.pathname}${window.location.search}`;
  const safe = safeInternalPath(current, "/");
  return safe === "/" ? "/login" : `/login?returnTo=${encodeURIComponent(safe)}`;
}

export function spellHref(id: string, from: string): string {
  return `/magias/${encodeURIComponent(id)}?from=${encodeURIComponent(safeInternalPath(from))}`;
}

export function equipmentHref(slug: string, from: string): string {
  return `/equipamento/${encodeURIComponent(slug)}?from=${encodeURIComponent(
    safeInternalPath(from, "/equipamento"),
  )}`;
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
