import { describe, expect, it } from "vitest";

import { jsonResponse } from "@/lib/api-response";

describe("API responses", () => {
  it("returns uncached JSON and preserves the supplied status", async () => {
    const body = { error: "Identificador inválido.", code: "invalid-id" };
    const response = jsonResponse(body, 400);

    expect(response.status).toBe(400);
    expect(response.headers.get("content-type")).toBe("application/json; charset=utf-8");
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual(body);
  });
});
