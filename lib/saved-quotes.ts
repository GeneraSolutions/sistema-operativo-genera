import {
  compactClientParty,
  type ClientIdType,
  type ClientParty,
} from "@/lib/client-party";
import type { EnergyBill } from "@/lib/energy-bill";
import type { AddonState } from "@/lib/eng-labor-addons";
import type {
  MountPreference,
  QuoteEquipmentSelection,
  QuoteLineInput,
  QuoteQuantities,
} from "@/lib/quote-engine";
import type { SystemWarranties } from "@/lib/warranties";
import type {
  ParticularTerm,
  PaymentKind,
  ProposalKind,
  ProposalToggles,
} from "@/types/proposal";
import type { AliadoTripId } from "@/lib/aliado-install";

export interface SavedQuote {
  id: string;
  name: string;
  savedAt: string;
  kind?: ProposalKind;
  clientName: string;
  clientCity: string;
  clientEmail?: string;
  clientPhone?: string;
  clientAddress?: string;
  clientNit?: string;
  clientDv?: string;
  clientIdType?: ClientIdType;
  clientParty?: ClientParty;
  systemKwp: number;
  peakSunHours: number;
  energyTariff: number;
  includeBattery: boolean;
  batteryKwh: number;
  mount: MountPreference;
  softCostPercent: number;
  overheadPercent?: number;
  engineeringSaleCOP?: number;
  engineeringCostCOP?: number;
  technicians?: number;
  dailyWageCOP?: number;
  laborSaleCOP?: number;
  laborMarginPercent?: number;
  targetNetProfitCOP?: number;
  clientWithholds?: boolean;
  clientGranContribuyente?: boolean;
  chargeIva: boolean;
  applyLey1715: boolean;
  monthlyConsumption: number;
  executionDays: number;
  validUntilDays?: number;
  issuedAt?: string;
  siteImageDataUrl?: string;
  logoHeight?: number;
  advancePercent: number;
  paymentKind?: PaymentKind;
  twoStartPercent?: number;
  threeStartPercent?: number;
  threeEquipmentPercent?: number;
  financedPercent?: number;
  financedMonths?: number;
  financedEaPercent?: number;
  ppaYears?: number;
  ppaPricePerKWhCOP?: number;
  siteLat?: number;
  siteLon?: number;
  equipmentIds: {
    panel?: string;
    inverter?: string;
    battery?: string;
    structure?: string;
    cabling?: string;
    protectionDc?: string;
    protectionAc?: string;
  };
  qty: QuoteQuantities;
  quoteLines?: QuoteLineInput[];
  /** Once true, kWp/panel suggestions no longer overwrite edited quantities. */
  qtyLocked?: boolean;
  savedBy?: string;
  savedByName?: string;
  engAddons?: AddonState[];
  toggles: ProposalToggles;
  warranties?: SystemWarranties;
  particularTerms?: ParticularTerm[];
  bonusIds?: string[];
  /** Enlace comercial ya publicado; las fichas se liberan sobre este mismo id. */
  commercialProposalId?: string;
  energyBill?: EnergyBill;
  channel?: "genera" | "aliado";
  partnerCompanyName?: string;
  partnerLogoDataUrl?: string;
  aliadoTrip?: AliadoTripId;
}

const KEY = "genera.saved-quotes.v1";
const LINES_KEY = "genera.quote-lines.v1";
export const ACTIVE_QUOTE_KEY = "genera:active-quote";

export function cloneQuoteLines(
  lines: QuoteLineInput[] | undefined | null
): QuoteLineInput[] {
  if (!Array.isArray(lines)) return [];
  return lines.map((l) => {
    const qty = Number(l.qty);
    const cost = Number(l.costUnitCOP);
    const margin = Number(l.marginPercent);
    return {
      ...l,
      itemId: String(l.itemId || ""),
      key: String(l.key || ""),
      qty: Number.isFinite(qty) ? qty : 0,
      costUnitCOP: Number.isFinite(cost) ? cost : 0,
      marginPercent: Number.isFinite(margin) ? margin : 0,
      applyIva: Boolean(l.applyIva),
    };
  });
}

function readLinesMap(): Record<string, QuoteLineInput[]> {
  if (typeof window === "undefined") return {};
  try {
    const parsed = JSON.parse(localStorage.getItem(LINES_KEY) || "{}") as Record<
      string,
      QuoteLineInput[]
    >;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function putQuoteLines(id: string, lines: QuoteLineInput[]): void {
  if (typeof window === "undefined" || !id) return;
  const cloned = cloneQuoteLines(lines);
  const all = readLinesMap();
  all[id] = cloned;
  try {
    localStorage.setItem(LINES_KEY, JSON.stringify(all));
  } catch {
    /* quota: still pin this quote in session */
  }
  try {
    sessionStorage.setItem(`${LINES_KEY}:${id}`, JSON.stringify(cloned));
  } catch {
    /* ignore */
  }
}

export function getStoredQuoteLines(id: string): QuoteLineInput[] | undefined {
  if (typeof window === "undefined" || !id) return undefined;
  try {
    const sess = sessionStorage.getItem(`${LINES_KEY}:${id}`);
    if (sess) {
      const parsed = JSON.parse(sess) as QuoteLineInput[];
      if (Array.isArray(parsed) && parsed.length) return cloneQuoteLines(parsed);
    }
  } catch {
    /* ignore */
  }
  const stored = readLinesMap()[id];
  if (Array.isArray(stored) && stored.length) return cloneQuoteLines(stored);
  return undefined;
}

/** Exact equipment rows for a saved quote. Never recalculates from kWp. */
export function resolveQuoteLines(q: SavedQuote): QuoteLineInput[] | undefined {
  const stored = getStoredQuoteLines(q.id);
  if (stored?.length) return stored;
  if (Array.isArray(q.quoteLines) && q.quoteLines.length) {
    return cloneQuoteLines(q.quoteLines);
  }
  return undefined;
}

export function pinActiveQuote(id: string): void {
  if (typeof window === "undefined" || !id) return;
  sessionStorage.setItem(ACTIVE_QUOTE_KEY, id);
}

export function clearActiveQuote(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(ACTIVE_QUOTE_KEY);
}

function compactQuote(quote: SavedQuote): SavedQuote {
  const image = quote.siteImageDataUrl || "";
  return {
    ...quote,
    siteImageDataUrl: image.length > 120_000 ? undefined : quote.siteImageDataUrl,
    clientParty: compactClientParty(quote.clientParty),
  };
}

function pickRicher(newer: SavedQuote, older: SavedQuote): SavedQuote {
  return {
    ...newer,
    quoteLines:
      newer.quoteLines?.length ? newer.quoteLines : older.quoteLines,
    qty: newer.quoteLines?.length
      ? newer.qty
      : older.quoteLines?.length
        ? older.qty
        : newer.qty,
    qtyLocked: newer.qtyLocked || older.qtyLocked,
    engAddons: newer.engAddons?.length ? newer.engAddons : older.engAddons,
    warranties: newer.warranties?.items?.length ? newer.warranties : older.warranties,
    particularTerms: newer.particularTerms ?? older.particularTerms,
    bonusIds: newer.bonusIds ?? older.bonusIds,
  };
}

export function mergeQuotes(local: SavedQuote[], remote: SavedQuote[]): SavedQuote[] {
  const byId = new Map<string, SavedQuote>();
  for (const q of [...remote, ...local]) {
    if (!q?.id) continue;
    const prev = byId.get(q.id);
    if (!prev) {
      byId.set(q.id, q);
      continue;
    }
    const newer = Date.parse(q.savedAt) >= Date.parse(prev.savedAt) ? q : prev;
    const older = newer === q ? prev : q;
    byId.set(q.id, pickRicher(newer, older));
  }
  return [...byId.values()]
    .map((q) => {
      if (typeof window === "undefined") return q;
      const stored = getStoredQuoteLines(q.id);
      if (!stored?.length) return q;
      return { ...q, quoteLines: stored, qtyLocked: true };
    })
    .sort((a, b) => Date.parse(b.savedAt) - Date.parse(a.savedAt))
    .slice(0, 40);
}

export function isAliadoQuote(q: SavedQuote) {
  return q.channel === "aliado";
}

export function quotesForCotizador(
  quotes: SavedQuote[],
  opts: { aliado: boolean; username?: string; kind?: ProposalKind }
): SavedQuote[] {
  const channel = opts.aliado
    ? quotes.filter(
        (q) =>
          isAliadoQuote(q) &&
          (!opts.username || q.savedBy === opts.username || !q.savedBy)
      )
    : quotes.filter((q) => !isAliadoQuote(q));
  if (opts.kind === "equipos") {
    return channel.filter((q) => q.kind === "equipos");
  }
  if (opts.kind === "epc") {
    return channel.filter((q) => q.kind !== "equipos");
  }
  return channel;
}

export function quoteDeskPath(quote: SavedQuote): string {
  const q = encodeURIComponent(quote.id);
  return quote.kind === "equipos"
    ? `/cotizador/equipos?quote=${q}`
    : `/cotizador?quote=${q}`;
}

export function loadSavedQuotes(): SavedQuote[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) || "[]") as SavedQuote[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveQuoteSnapshot(
  quote: SavedQuote,
  opts?: { replaceLines?: boolean }
): SavedQuote {
  const incoming = cloneQuoteLines(quote.quoteLines);
  const existing = quote.id ? getStoredQuoteLines(quote.id) : undefined;
  const replace = opts?.replaceLines !== false;
  const lines =
    replace && incoming.length
      ? incoming
      : existing?.length
        ? existing
        : incoming;
  const compact = compactQuote({
    ...quote,
    quoteLines: lines ?? incoming,
    qtyLocked: true,
  });
  if (compact.id && replace && (compact.quoteLines?.length ?? 0) > 0) {
    putQuoteLines(compact.id, compact.quoteLines ?? []);
  }
  const all = loadSavedQuotes().filter((q) => q.id !== compact.id);
  const next = [compact, ...all].slice(0, 40);
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    const lighter = next.map((q) => ({ ...q, siteImageDataUrl: undefined }));
    localStorage.setItem(KEY, JSON.stringify(lighter));
  }
  return compact;
}

export function deleteSavedQuote(id: string): void {
  localStorage.setItem(
    KEY,
    JSON.stringify(loadSavedQuotes().filter((q) => q.id !== id))
  );
  const all = readLinesMap();
  delete all[id];
  try {
    localStorage.setItem(LINES_KEY, JSON.stringify(all));
    sessionStorage.removeItem(`${LINES_KEY}:${id}`);
  } catch {
    /* ignore */
  }
  if (sessionStorage.getItem(ACTIVE_QUOTE_KEY) === id) {
    sessionStorage.removeItem(ACTIVE_QUOTE_KEY);
  }
}

export function getSavedQuote(id: string): SavedQuote | undefined {
  return loadSavedQuotes().find((q) => q.id === id);
}

export function qtyFromLines(lines: QuoteLineInput[]): QuoteQuantities {
  const n = (key: string) => lines.find((l) => l.key === key)?.qty ?? 0;
  return {
    panels: n("panel"),
    inverters: n("inverter") || n("microinverter"),
    batteries: n("battery"),
    structure: n("structure"),
    cabling: n("cabling"),
    protectionDc: n("protection_dc"),
    protectionAc: n("protection_ac"),
  };
}

export function idsFromSelection(selection: QuoteEquipmentSelection) {
  return {
    panel: selection.panel?.id,
    inverter: selection.inverter?.id,
    battery: selection.battery?.id,
    structure: selection.structure?.id,
    cabling: selection.cabling?.id,
    protectionDc: selection.protectionDc?.id,
    protectionAc: selection.protectionAc?.id,
  };
}
