import type { MountPreference, QuoteEquipmentSelection, QuoteQuantities } from "@/lib/quote-engine";
import type { ProposalToggles } from "@/types/proposal";

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
  advancePercent: number;
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
  toggles: ProposalToggles;
}

const KEY = "genera.saved-quotes.v1";

export function loadSavedQuotes(): SavedQuote[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]") as SavedQuote[];
  } catch {
    return [];
  }
}

export function saveQuoteSnapshot(quote: SavedQuote): void {
  const all = loadSavedQuotes().filter((q) => q.id !== quote.id);
  localStorage.setItem(KEY, JSON.stringify([quote, ...all].slice(0, 40)));
}

export function deleteSavedQuote(id: string): void {
  localStorage.setItem(
    KEY,
    JSON.stringify(loadSavedQuotes().filter((q) => q.id !== id))
  );
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
