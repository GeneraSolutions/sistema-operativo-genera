import { persistGet, persistSet } from "@/lib/persist";
import type { SavedQuote } from "@/lib/saved-quotes";
import { mergeQuotes } from "@/lib/saved-quotes";
import type { SavedVisit } from "@/lib/saved-visits";
import { mergeVisits } from "@/lib/saved-visits";
import type { PlantProfile, SavedReport } from "@/lib/technical-reports";
import { mergePlants, mergeReports } from "@/lib/technical-reports";

const QUOTES_KEY = "genera:archivo-quotes";
const VISITS_KEY = "genera:archivo-visits";
const QUOTE_IDS_KEY = "genera:archivo-quote-ids";
const VISIT_IDS_KEY = "genera:archivo-visit-ids";
const REPORT_IDS_KEY = "genera:archivo-report-ids";
const REPORTS_KEY = "genera:archivo-reports";
const PLANTS_KEY = "genera:archivo-plants";

function quoteItemKey(id: string) {
  return `genera:archivo-quote:${id}`;
}

function visitItemKey(id: string) {
  return `genera:archivo-visit:${id}`;
}

function reportItemKey(id: string) {
  return `genera:archivo-report:${id}`;
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

function slimReport(row: SavedReport): SavedReport {
  const photos = (row.report.photos ?? [])
    .filter((p) => p?.dataUrl && p.dataUrl.length < 160_000)
    .slice(0, 12);
  return { ...row, report: { ...row.report, photos } };
}

export async function loadArchivoReports(): Promise<SavedReport[]> {
  const ids = await persistGet<string[]>(REPORT_IDS_KEY);
  if (Array.isArray(ids) && ids.length) {
    const rows = await Promise.all(
      ids.map((id) => persistGet<SavedReport>(reportItemKey(id)))
    );
    const found = rows.filter((r): r is SavedReport => Boolean(r?.id));
    if (found.length) return mergeReports(found, []);
  }
  const legacy = await persistGet<SavedReport[]>(REPORTS_KEY);
  return Array.isArray(legacy) ? legacy : [];
}

async function rememberReportId(id: string) {
  const ids = (await persistGet<string[]>(REPORT_IDS_KEY)) ?? [];
  const next = [id, ...ids.filter((x) => x !== id)].slice(0, 80);
  await persistSet(REPORT_IDS_KEY, next);
}

export async function upsertArchivoReport(
  report: SavedReport
): Promise<SavedReport[]> {
  const compact = slimReport(report);
  await persistSet(reportItemKey(compact.id), compact);
  await rememberReportId(compact.id);
  return loadArchivoReports();
}

export async function upsertArchivoReports(
  reports: SavedReport[]
): Promise<SavedReport[]> {
  const list = reports.filter((r) => r?.id).map(slimReport);
  if (!list.length) return loadArchivoReports();
  await Promise.all(
    list.map((row) => persistSet(reportItemKey(row.id), row))
  );
  const ids = (await persistGet<string[]>(REPORT_IDS_KEY)) ?? [];
  const next = [
    ...list.map((r) => r.id),
    ...ids.filter((id) => !list.some((r) => r.id === id)),
  ].slice(0, 80);
  await persistSet(REPORT_IDS_KEY, next);
  return loadArchivoReports();
}

export async function removeArchivoReport(id: string): Promise<SavedReport[]> {
  const ids = ((await persistGet<string[]>(REPORT_IDS_KEY)) ?? []).filter(
    (x) => x !== id
  );
  await persistSet(REPORT_IDS_KEY, ids);
  return loadArchivoReports();
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

export async function loadArchivoPlants(): Promise<PlantProfile[]> {
  const stored = await persistGet<PlantProfile[]>(PLANTS_KEY);
  return Array.isArray(stored) ? stored.filter((p) => p?.id) : [];
}

export async function upsertArchivoPlants(
  plants: PlantProfile[]
): Promise<PlantProfile[]> {
  const merged = mergePlants(await loadArchivoPlants(), plants);
  await persistSet(PLANTS_KEY, merged);
  return merged;
}

export async function removeArchivoPlant(id: string): Promise<PlantProfile[]> {
  const next = (await loadArchivoPlants()).filter((p) => p.id !== id);
  await persistSet(PLANTS_KEY, next);
  return next;
}
