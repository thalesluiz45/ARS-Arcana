const CONTROL_CHARACTERS = /[\u0000-\u001f]/;

/**
 * Only internal paths are accepted as post-login destinations. This is used
 * both when building `/login?returnTo=...` links and by the Auth.js redirect
 * callback, preventing an open redirect through the OAuth flow.
 */
export function safeReturnTo(value: string | null | undefined, fallback = "/"): string {
  if (!value) return fallback;
  if (!value.startsWith("/") || value.startsWith("//")) return fallback;
  if (value.includes("\\") || CONTROL_CHARACTERS.test(value)) return fallback;
  if (value.startsWith("/login")) return fallback;
  return value;
}

export function loginHref(returnTo: string | null | undefined): string {
  const safe = safeReturnTo(returnTo, "/");
  return safe === "/" ? "/login" : `/login?returnTo=${encodeURIComponent(safe)}`;
}

/**
 * Auth.js `redirect` callback helper. Relative paths resolve against the
 * deployment origin; absolute URLs are only accepted when they belong to the
 * same origin.
 */
export function resolveAuthRedirect(url: string, baseUrl: string): string {
  let base: URL;
  try {
    base = new URL(baseUrl);
  } catch {
    return "/";
  }

  if (url.startsWith("/") && !url.startsWith("//")) {
    try {
      return new URL(url, base).toString();
    } catch {
      return base.toString();
    }
  }

  try {
    const target = new URL(url);
    return target.origin === base.origin ? target.toString() : base.toString();
  } catch {
    return base.toString();
  }
}
