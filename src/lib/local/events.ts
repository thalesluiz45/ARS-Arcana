export const LOCAL_DATA_CHANGED_EVENT = "ars-arcana:local-data-changed";

export type LocalDataChangeDetail = {
  reason:
    | "grimoire-created"
    | "grimoire-renamed"
    | "grimoire-deleted"
    | "spell-saved"
    | "spell-removed"
    | "cache-updated";
  magiaId?: string;
  listaId?: string;
};

export function notifyLocalDataChanged(detail: LocalDataChangeDetail): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<LocalDataChangeDetail>(LOCAL_DATA_CHANGED_EVENT, { detail }));
}

export function subscribeToLocalDataChanges(
  listener: (detail: LocalDataChangeDetail | null) => void,
): () => void {
  if (typeof window === "undefined") return () => undefined;
  const handler = (event: Event) => {
    listener(event instanceof CustomEvent ? (event.detail as LocalDataChangeDetail) : null);
  };
  window.addEventListener(LOCAL_DATA_CHANGED_EVENT, handler);
  return () => window.removeEventListener(LOCAL_DATA_CHANGED_EVENT, handler);
}
