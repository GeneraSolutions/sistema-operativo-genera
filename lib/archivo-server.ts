import { persistGet, persistSet } from "@/lib/persist";
import type { SavedQuote } from "@/lib/saved-quotes";
import { mergeQuotes } from "@/lib/saved-quotes";
import type { SavedVisit } from "@/lib/saved-visits";
import { mergeVisits } from "@/lib/saved-visits";

const QUOTES_KEY = "genera:archivo-quotes";
const VISITS_KEY = "genera:archivo-visits";

export async function loadArchivoQuotes(): Promise<SavedQuote[]> {
  const stored = await persistGet<SavedQuote[]>(QUOTES_KEY);
  return Array.isArray(stored) ? stored : [];
}

export async function loadArchivoVisits(): Promise<SavedVisit[]> {
  const stored = await persistGet<SavedVisit[]>(VISITS_KEY);
  return Array.isArray(stored) ? stored : [];
}

export async function upsertArchivoQuote(quote: SavedQuote): Promise<SavedQuote[]> {
  const next = mergeQuotes(await loadArchivoQuotes(), [quote]);
  await persistSet(QUOTES_KEY, next);
  return next;
}

export async function upsertArchivoVisit(visit: SavedVisit): Promise<SavedVisit[]> {
  const next = mergeVisits(await loadArchivoVisits(), [visit]);
  await persistSet(VISITS_KEY, next);
  return next;
}

export async function removeArchivoQuote(id: string): Promise<SavedQuote[]> {
  const next = (await loadArchivoQuotes()).filter((q) => q.id !== id);
  await persistSet(QUOTES_KEY, next);
  return next;
}

export async function removeArchivoVisit(id: string): Promise<SavedVisit[]> {
  const next = (await loadArchivoVisits()).filter((v) => v.id !== id);
  await persistSet(VISITS_KEY, next);
  return next;
}
