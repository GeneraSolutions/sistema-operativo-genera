import type { AddonState } from "@/lib/eng-labor-addons";
import type {
  MountPreference,
  QuoteEquipmentSelection,
  QuoteLineInput,
  QuoteQuantities,
} from "@/lib/quote-engine";
import type { PaymentKind, ProposalToggles } from "@/types/proposal";

export interface SavedQuote {
  id: string;
  name: string;
  savedAt: string;
  clientName: string;
  clientCity: string;
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
  engAddons?: AddonState[];
  toggles: ProposalToggles;
}

const KEY = "genera.saved-quotes.v1";

function compactQuote(quote: SavedQuote): SavedQuote {
  const image = quote.siteImageDataUrl || "";
  return {
    ...quote,
    siteImageDataUrl: image.length > 120_000 ? undefined : quote.siteImageDataUrl,
  };
}

export function mergeQuotes(local: SavedQuote[], remote: SavedQuote[]): SavedQuote[] {
  const byId = new Map<string, SavedQuote>();
  for (const q of [...remote, ...local]) {
    if (!q?.id) continue;
    const prev = byId.get(q.id);
    if (!prev || Date.parse(q.savedAt) >= Date.parse(prev.savedAt)) {
      byId.set(q.id, q);
    }
  }
  return [...byId.values()]
    .sort((a, b) => Date.parse(b.savedAt) - Date.parse(a.savedAt))
    .slice(0, 40);
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

export function saveQuoteSnapshot(quote: SavedQuote): SavedQuote {
  const compact = compactQuote(quote);
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
}

export function getSavedQuote(id: string): SavedQuote | undefined {
  return loadSavedQuotes().find((q) => q.id === id);
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
