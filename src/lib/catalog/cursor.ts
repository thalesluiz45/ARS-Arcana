const CURSOR_VERSION = 1;
const MAX_OFFSET = 1_000_000;

type CursorPayload = {
  v: number;
  offset: number;
};

export function encodeCursor(offset: number): string {
  const payload: CursorPayload = {
    v: CURSOR_VERSION,
    offset: Math.max(0, Math.min(MAX_OFFSET, Math.trunc(offset))),
  };
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

export function decodeCursor(cursor: string | null | undefined): number | null {
  if (!cursor) return null;
  try {
    const decoded = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as unknown;
    if (
      typeof decoded === "object" &&
      decoded !== null &&
      "v" in decoded &&
      "offset" in decoded &&
      (decoded as CursorPayload).v === CURSOR_VERSION &&
      Number.isInteger((decoded as CursorPayload).offset) &&
      (decoded as CursorPayload).offset >= 0
    ) {
      return Math.min(MAX_OFFSET, (decoded as CursorPayload).offset);
    }
  } catch {
    // Um cursor inválido é tratado como ausente; a primeira página é segura.
  }
  return null;
}
