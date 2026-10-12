import { addonsToState, resolveEngLaborAddons, type AddonState } from "@/lib/eng-labor-addons";
import {
  lineFromItem,
  type MountPreference,
  type QuoteLineInput,
} from "@/lib/quote-engine";
import { filterByCategory, getDefaultsByCategory } from "@/lib/inventory";
import type { InventoryItem } from "@/types/inventory";

export const SITE_VISIT_STORAGE_KEY = "datosVisitaTecnica";

export const VISIT_AC_LINE_KEY = "visit-ac-cable";
export const VISIT_CONDUIT_LINE_KEY = "visit-conduit";

export type GridType =
  | "monofasica"
  | "bifasica"
  | "trifasica_208"
  | "trifasica_480";

export type RoofCoverType =
  | "barro"
  | "termoacustica"
  | "metalica"
  | "fibrocemento"
  | "losa"
  | "suelo";

export type CanalType = "emt" | "pvc" | "imc" | "bandeja";

export interface SiteVisitPhoto {
  id: string;
  dataUrl: string;
  name: string;
}

export interface SiteVisit {
  clientName: string;
  visitDate: string;
  technician: string;
  location: string;
  lat?: number;
  lon?: number;
  gridType: GridType;
  mainBreakerAmps: number;
  panelSpace: string;
  groundingStatus: "bueno" | "regular" | "deficiente" | "ausente";
  meterType: "bidireccional" | "convencional" | "prepago" | "inteligente";
  roofType: RoofCoverType;
  structuralState: "bueno" | "regular" | "refuerzo";
  orientation: string;
  tiltDeg: number;
  usefulAreaM2: number;
  shading: "ninguna" | "parcial" | "critica";
  dcRunM: number;
  acRunM: number;
  canalType: CanalType;
  inverterSurface: "muro" | "piso" | "cuarto" | "poste";
  wifi: "si" | "no" | "parcial";
  roofAccess: "escalera" | "interno" | "andamio" | "dificil";
  needLifting: boolean;
  needScaffold: boolean;
  needLifeline: boolean;
  notes: string;
  extraNotes: string;
  photos: SiteVisitPhoto[];
  updatedAt: string;
}

export interface StoredSiteVisit {
  linked: boolean;
  visit: SiteVisit;
}

export const GRID_LABELS: Record<GridType, string> = {
  monofasica: "Monofásica",
  bifasica: "Bifásica",
  trifasica_208: "Trifásica 208 V",
  trifasica_480: "Trifásica 480 V",
};

export const ROOF_LABELS: Record<RoofCoverType, string> = {
  barro: "Teja de barro",
  termoacustica: "Termoacústica",
  metalica: "Metálica",
  fibrocemento: "Fibrocemento",
  losa: "Losa concreto",
  suelo: "Suelo",
};

export const CANAL_LABELS: Record<CanalType, string> = {
  emt: "Conduit EMT",
  pvc: "PVC HD intemperie",
  imc: "IMC",
  bandeja: "Bandeja portacables",
};

function todayISO() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export function emptySiteVisit(): SiteVisit {
  return {
    clientName: "",
    visitDate: todayISO(),
    technician: "",
    location: "",
    lat: undefined,
    lon: undefined,
    gridType: "monofasica",
    mainBreakerAmps: 60,
    panelSpace: "",
    groundingStatus: "bueno",
    meterType: "convencional",
    roofType: "metalica",
    structuralState: "bueno",
    orientation: "Sur",
    tiltDeg: 10,
    usefulAreaM2: 0,
    shading: "ninguna",
    dcRunM: 15,
    acRunM: 8,
    canalType: "emt",
    inverterSurface: "muro",
    wifi: "si",
    roofAccess: "escalera",
    needLifting: false,
    needScaffold: false,
    needLifeline: false,
    notes: "",
    extraNotes: "",
    photos: [],
    updatedAt: new Date().toISOString(),
  };
}

export function loadStoredSiteVisit(): StoredSiteVisit | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(SITE_VISIT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredSiteVisit | SiteVisit;
    if (parsed && "visit" in parsed && parsed.visit) {
      return {
        linked: Boolean(parsed.linked),
        visit: { ...emptySiteVisit(), ...parsed.visit },
      };
    }
    if (parsed && "clientName" in parsed) {
      return {
        linked: false,
        visit: { ...emptySiteVisit(), ...(parsed as SiteVisit) },
      };
    }
    return null;
  } catch {
    return null;
  }
}

export function saveStoredSiteVisit(stored: StoredSiteVisit): void {
  if (typeof window === "undefined") return;
  const payload: StoredSiteVisit = {
    linked: stored.linked,
    visit: { ...stored.visit, updatedAt: new Date().toISOString() },
  };
  localStorage.setItem(SITE_VISIT_STORAGE_KEY, JSON.stringify(payload));
}

export function mountFromRoof(roof: RoofCoverType): MountPreference {
  return roof === "suelo" ? "suelo" : "cubierta";
}

export function compressVisitPhoto(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const max = 1100;
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext("2d");
      URL.revokeObjectURL(url);
      if (!ctx) {
        reject(new Error("canvas"));
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", 0.72));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("image"));
    };
    img.src = url;
  });
}

function pickDefault(
  items: InventoryItem[],
  category: string
): InventoryItem | null {
  const list = filterByCategory(items, category);
  return list.find((i) => i.isDefault) || list[0] || null;
}

function pickConduit(items: InventoryItem[], canal: CanalType): InventoryItem | null {
  const channels = filterByCategory(items, "metal_channel");
  const sheath = filterByCategory(items, "lszh_sheath");
  const blob = (i: InventoryItem) =>
    `${i.name} ${i.model} ${i.brand}`.toLowerCase();
  if (canal === "pvc") {
    return (
      [...channels, ...sheath].find((i) => blob(i).includes("pvc")) ||
      sheath[0] ||
      channels[0] ||
      null
    );
  }
  if (canal === "bandeja") {
    return (
      channels.find((i) => blob(i).includes("8x4")) || channels[0] || null
    );
  }
  return (
    channels.find((i) => blob(i).includes("6x4")) || channels[0] || null
  );
}

function upsertLine(
  lines: QuoteLineInput[],
  key: string,
  item: InventoryItem | null,
  qty: number
): QuoteLineInput[] {
  if (!item || qty <= 0) {
    return lines.filter((l) => l.key !== key);
  }
  const next = lineFromItem(key, item, Math.max(1, Math.round(qty)));
  const idx = lines.findIndex((l) => l.key === key);
  if (idx < 0) return [...lines, next];
  const copy = [...lines];
  copy[idx] = {
    ...next,
    marginPercent: lines[idx].marginPercent,
    applyIva: lines[idx].applyIva,
  };
  return copy;
}

export function applyVisitToQuoteLines(
  lines: QuoteLineInput[],
  inventory: InventoryItem[],
  visit: SiteVisit
): QuoteLineInput[] {
  const defaults = getDefaultsByCategory(inventory);
  const dcItem = defaults.cabling ?? pickDefault(inventory, "cabling");
  const acItem = defaults.ac_cable ?? pickDefault(inventory, "ac_cable");
  const conduit = pickConduit(inventory, visit.canalType);
  const conduitM = Math.max(1, Math.round(visit.dcRunM + visit.acRunM));
  let next = upsertLine(lines, "cabling", dcItem, visit.dcRunM);
  next = upsertLine(next, VISIT_AC_LINE_KEY, acItem, visit.acRunM);
  next = upsertLine(next, VISIT_CONDUIT_LINE_KEY, conduit, conduitM);
  return next;
}

export function stripVisitQuoteLines(lines: QuoteLineInput[]): QuoteLineInput[] {
  return lines.filter(
    (l) => l.key !== VISIT_AC_LINE_KEY && l.key !== VISIT_CONDUIT_LINE_KEY
  );
}

export function visitHasCoords(visit: SiteVisit): boolean {
  return (
    typeof visit.lat === "number" &&
    typeof visit.lon === "number" &&
    Number.isFinite(visit.lat) &&
    Number.isFinite(visit.lon)
  );
}

export function isVisitLockedLineKey(key: string) {
  return (
    key === "cabling" ||
    key === VISIT_AC_LINE_KEY ||
    key === VISIT_CONDUIT_LINE_KEY
  );
}

export function applyVisitToAddons(
  prev: AddonState[] | undefined,
  visit: SiteVisit
): AddonState[] {
  const resolved = resolveEngLaborAddons(prev, {
    systemKwp: 10,
    technicians: 3,
    days: 7,
    dailyWageCOP: 90_000,
    mount: mountFromRoof(visit.roofType),
    applyLey1715: true,
    equipmentSaleCOP: 0,
    marginPercent: 25,
  });
  return addonsToState(
    resolved.map((a) => {
      if (a.id === "lifting" && (visit.needLifting || visit.needScaffold)) {
        return { ...a, enabled: true };
      }
      if (a.id === "epp" && visit.needLifeline) {
        return { ...a, enabled: true };
      }
      return a;
    })
  );
}
