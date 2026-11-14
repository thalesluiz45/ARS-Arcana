import { describe, expect, it } from "vitest";

import { getErrorMessage } from "@/lib/errors";

describe("error messages", () => {
  it("uses the error message or the fallback when no message is available", () => {
    expect(getErrorMessage(new Error("Falha ao carregar."), "Tente novamente.")).toBe(
      "Falha ao carregar.",
    );
    expect(getErrorMessage(new Error(""), "Tente novamente.")).toBe("Tente novamente.");
    expect(getErrorMessage("falha desconhecida", "Tente novamente.")).toBe("Tente novamente.");
  });
});
