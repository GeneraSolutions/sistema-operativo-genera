export const NEW_PARAM = "nuevo";

export function takeNewFlag(): boolean {
  if (typeof window === "undefined") return false;
  const url = new URL(window.location.href);
  if (url.searchParams.get(NEW_PARAM) !== "1") return false;
  url.searchParams.delete(NEW_PARAM);
  window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
  return true;
}

export function normalizeSearch(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}
