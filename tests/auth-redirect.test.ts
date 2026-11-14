import { describe, expect, it } from "vitest";

import {
  loginHref,
  resolveAuthRedirect,
  safeReturnTo,
} from "@/lib/auth/redirect";
import { currentLoginHref, safeInternalPath } from "@/lib/navigation";

describe("safeReturnTo", () => {
  it("accepts internal paths with query strings and hash fragments", () => {
    expect(safeReturnTo("/magias-salvas?grimorio=abc&page=2")).toBe(
      "/magias-salvas?grimorio=abc&page=2",
    );
    expect(safeReturnTo("/magias/123?from=%2F%3Fq%3Dfogo")).toBe(
      "/magias/123?from=%2F%3Fq%3Dfogo",
    );
    expect(safeReturnTo("/equipamento#inventario")).toBe("/equipamento#inventario");
  });

  it("rejects external, protocol-relative, backslash, control, and login paths", () => {
    expect(safeReturnTo("https://evil.example/")).toBe("/");
    expect(safeReturnTo("//evil.example/")).toBe("/");
    expect(safeReturnTo("/\\evil.example")).toBe("/");
    expect(safeReturnTo("/magias\nsalvas")).toBe("/");
    expect(safeReturnTo("/login?returnTo=/magias-salvas")).toBe("/");
    expect(safeReturnTo("")).toBe("/");
    expect(safeReturnTo(null)).toBe("/");
  });

  it("uses the provided fallback for invalid destinations", () => {
    expect(safeReturnTo("https://evil.example", "/magias-salvas")).toBe("/magias-salvas");
  });
});

describe("loginHref", () => {
  it("omits the query when the destination is the library", () => {
    expect(loginHref("/")).toBe("/login");
    expect(loginHref(null)).toBe("/login");
  });

  it("encodes internal destinations", () => {
    expect(loginHref("/magias-salvas?grimorio=abc")).toBe(
      `/login?returnTo=${encodeURIComponent("/magias-salvas?grimorio=abc")}`,
    );
  });
});

describe("resolveAuthRedirect", () => {
  const base = "https://ars.example";

  it("resolves relative paths against the deployment origin", () => {
    expect(resolveAuthRedirect("/magias-salvas", base)).toBe(
      "https://ars.example/magias-salvas",
    );
  });

  it("accepts absolute URLs only on the same origin", () => {
    expect(resolveAuthRedirect("https://ars.example/magias-salvas", base)).toBe(
      "https://ars.example/magias-salvas",
    );
    expect(resolveAuthRedirect("https://evil.example/", base)).toBe("https://ars.example/");
  });

  it("falls back safely for invalid values", () => {
    expect(resolveAuthRedirect("not a url", base)).toBe("https://ars.example/");
    expect(resolveAuthRedirect("/magias", "not a url")).toBe("/");
  });
});

describe("navigation helpers", () => {
  it("keeps currentLoginHref and safeInternalPath aligned with safeReturnTo", () => {
    expect(safeInternalPath("//evil.example")).toBe("/");
    expect(currentLoginHref()).toBe("/login");
  });
});
