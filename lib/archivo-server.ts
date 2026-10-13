import { persistGet, persistSet } from "@/lib/persist";
import type { SavedQuote } from "@/lib/saved-quotes";
import { mergeQuotes } from "@/lib/saved-quotes";
import type { SavedVisit } from "@/lib/saved-visits";
import { mergeVisits } from "@/lib/saved-visits";

const QUOTES_KEY = "genera:archivo-quotes";
const VISITS_KEY = "genera:archivo-visits";
const QUOTE_IDS_KEY = "genera:archivo-quote-ids";
const VISIT_IDS_KEY = "genera:archivo-visit-ids";

function quoteItemKey(id: string) {
  return `genera:archivo-quote:${id}`;
}

function visitItemKey(id: string) {
  return `genera:archivo-visit:${id}`;
}

function slimQuote(quote: SavedQuote): SavedQuote {
  const image = quote.siteImageDataUrl || "";
  return {
    ...quote,
    siteImageDataUrl: image.length > 120_000 ? undefined : quote.siteImageDataUrl,
  };
}

export async function loadArchivoQuotes(): Promise<SavedQuote[]> {
  const ids = await persistGet<string[]>(QUOTE_IDS_KEY);
  if (Array.isArray(ids) && ids.length) {
    const rows = await Promise.all(
      ids.map((id) => persistGet<SavedQuote>(quoteItemKey(id)))
    );
    const found = rows.filter((q): q is SavedQuote => Boolean(q?.id));
    if (found.length) {
      return mergeQuotes(found, []);
    }
  }
  const legacy = await persistGet<SavedQuote[]>(QUOTES_KEY);
  return Array.isArray(legacy) ? legacy : [];
}

export async function loadArchivoVisits(): Promise<SavedVisit[]> {
  const ids = await persistGet<string[]>(VISIT_IDS_KEY);
  if (Array.isArray(ids) && ids.length) {
    const rows = await Promise.all(
      ids.map((id) => persistGet<SavedVisit>(visitItemKey(id)))
    );
    const found = rows.filter((v): v is SavedVisit => Boolean(v?.id));
    if (found.length) {
      return mergeVisits(found, []);
    }
  }
  const legacy = await persistGet<SavedVisit[]>(VISITS_KEY);
  return Array.isArray(legacy) ? legacy : [];
}

async function rememberQuoteId(id: string) {
  const ids = (await persistGet<string[]>(QUOTE_IDS_KEY)) ?? [];
  const next = [id, ...ids.filter((x) => x !== id)].slice(0, 80);
  await persistSet(QUOTE_IDS_KEY, next);
}

async function rememberVisitId(id: string) {
  const ids = (await persistGet<string[]>(VISIT_IDS_KEY)) ?? [];
  const next = [id, ...ids.filter((x) => x !== id)].slice(0, 80);
  await persistSet(VISIT_IDS_KEY, next);
}

export async function upsertArchivoQuote(quote: SavedQuote): Promise<SavedQuote[]> {
  const compact = slimQuote(quote);
  await persistSet(quoteItemKey(compact.id), compact);
  await rememberQuoteId(compact.id);
  return loadArchivoQuotes();
}

export async function upsertArchivoQuotes(quotes: SavedQuote[]): Promise<SavedQuote[]> {
  const compact = quotes.filter((q) => q?.id).map(slimQuote);
  if (!compact.length) return loadArchivoQuotes();
  await Promise.all(
    compact.map((quote) => persistSet(quoteItemKey(quote.id), quote))
  );
  const ids = (await persistGet<string[]>(QUOTE_IDS_KEY)) ?? [];
  const next = [
    ...compact.map((q) => q.id),
    ...ids.filter((id) => !compact.some((q) => q.id === id)),
  ].slice(0, 80);
  await persistSet(QUOTE_IDS_KEY, next);
  return loadArchivoQuotes();
}

export async function upsertArchivoVisit(visit: SavedVisit): Promise<SavedVisit[]> {
  await persistSet(visitItemKey(visit.id), visit);
  await rememberVisitId(visit.id);
  return loadArchivoVisits();
}

export async function upsertArchivoVisits(visits: SavedVisit[]): Promise<SavedVisit[]> {
  const list = visits.filter((v) => v?.id);
  if (!list.length) return loadArchivoVisits();
  await Promise.all(list.map((visit) => persistSet(visitItemKey(visit.id), visit)));
  const ids = (await persistGet<string[]>(VISIT_IDS_KEY)) ?? [];
  const next = [
    ...list.map((v) => v.id),
    ...ids.filter((id) => !list.some((v) => v.id === id)),
  ].slice(0, 80);
  await persistSet(VISIT_IDS_KEY, next);
  return loadArchivoVisits();
}

export async function removeArchivoQuote(id: string): Promise<SavedQuote[]> {
  const ids = ((await persistGet<string[]>(QUOTE_IDS_KEY)) ?? []).filter(
    (x) => x !== id
  );
  await persistSet(QUOTE_IDS_KEY, ids);
  return loadArchivoQuotes();
}

export async function removeArchivoVisit(id: string): Promise<SavedVisit[]> {
  const ids = ((await persistGet<string[]>(VISIT_IDS_KEY)) ?? []).filter(
    (x) => x !== id
  );
  await persistSet(VISIT_IDS_KEY, ids);
  return loadArchivoVisits();
}
