export interface PricePoint {
  at: string;
  priceCOP: number;
}

const KEY = "genera.price-history.v1";

function read(): Record<string, PricePoint[]> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(KEY) || "{}") as Record<string, PricePoint[]>;
  } catch {
    return {};
  }
}

export function recordPrice(itemId: string, priceCOP: number): void {
  const map = read();
  const prev = map[itemId] ?? [];
  const last = prev[prev.length - 1];
  if (last && last.priceCOP === priceCOP) return;
  map[itemId] = [...prev, { at: new Date().toISOString(), priceCOP }].slice(-20);
  localStorage.setItem(KEY, JSON.stringify(map));
}

export function getPriceHistory(itemId: string): PricePoint[] {
  return read()[itemId] ?? [];
}
