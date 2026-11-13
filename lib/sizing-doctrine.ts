import type { InventoryItem } from "@/types/inventory";

const KEY = "genera.sizing-doctrine.v1";

export interface SizingPrefs {
  /** Id de panel del inventario. */
  preferPanelId?: string;
  /** Marca de inversor, p. ej. deye. */
  preferInverterBrand?: string;
  /** true = híbrido; false = sin híbrido. */
  preferHybrid?: boolean;
  /** Id de batería del inventario. */
  preferBatteryId?: string;
  /** Multiplicador sobre el consumo (1.1 = 10% más). */
  coverFactor?: number;
  /** Fracción del día para noche sin medición (0–1). */
  nightShare?: number;
  /** Paneles de más después del cálculo. */
  extraPanels?: number;
  /** Con batería aunque no diga noche. */
  alwaysBattery?: boolean;
  /** Sin batería aunque diga noche. */
  neverBattery?: boolean;
}

export interface SizingLesson {
  id: string;
  text: string;
  heard: string[];
  createdAt: string;
}

export interface SizingDoctrine {
  lessons: SizingLesson[];
  prefs: SizingPrefs;
}

function foldText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function parseNumber(raw: string): number {
  const t = raw.trim();
  if (/^\d{1,3}(\.\d{3})+$/.test(t)) return Number(t.replace(/\./g, ""));
  return Number(t.replace(",", "."));
}

function labelOf(item: InventoryItem): string {
  return `${item.brand} ${item.model || item.name}`.replace(/\s+/g, " ").trim();
}

function active(items: InventoryItem[], category: string): InventoryItem[] {
  return items.filter((item) => item.category === category && item.active !== false);
}

function emptyDoctrine(): SizingDoctrine {
  return { lessons: [], prefs: {} };
}

function asPrefs(raw: unknown): SizingPrefs {
  if (!raw || typeof raw !== "object") return {};
  const src = raw as Record<string, unknown>;
  const next: SizingPrefs = {};
  if (typeof src.preferPanelId === "string" && src.preferPanelId) next.preferPanelId = src.preferPanelId;
  if (typeof src.preferInverterBrand === "string" && src.preferInverterBrand) {
    next.preferInverterBrand = src.preferInverterBrand;
  }
  if (typeof src.preferHybrid === "boolean") next.preferHybrid = src.preferHybrid;
  if (typeof src.preferBatteryId === "string" && src.preferBatteryId) {
    next.preferBatteryId = src.preferBatteryId;
  }
  if (typeof src.coverFactor === "number" && src.coverFactor > 0 && src.coverFactor <= 2) {
    next.coverFactor = src.coverFactor;
  }
  if (typeof src.nightShare === "number" && src.nightShare > 0 && src.nightShare < 1) {
    next.nightShare = src.nightShare;
  }
  if (typeof src.extraPanels === "number" && Number.isFinite(src.extraPanels)) {
    next.extraPanels = Math.trunc(src.extraPanels);
  }
  if (typeof src.alwaysBattery === "boolean") next.alwaysBattery = src.alwaysBattery;
  if (typeof src.neverBattery === "boolean") next.neverBattery = src.neverBattery;
  return next;
}

/** Lee lo que Genera Solutions SAS ya le enseñó al pedido. */
export function loadSizingDoctrine(): SizingDoctrine {
  if (typeof window === "undefined") return emptyDoctrine();
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) || "null") as {
      lessons?: SizingLesson[];
      prefs?: unknown;
    } | null;
    if (!parsed) return emptyDoctrine();
    const lessons = Array.isArray(parsed.lessons)
      ? parsed.lessons.filter((row) => row?.id && row?.text).slice(0, 80)
      : [];
    return { lessons, prefs: asPrefs(parsed.prefs) };
  } catch {
    return emptyDoctrine();
  }
}

function saveDoctrine(doctrine: SizingDoctrine): SizingDoctrine {
  const next: SizingDoctrine = {
    lessons: doctrine.lessons.slice(0, 80),
    prefs: asPrefs(doctrine.prefs),
  };
  localStorage.setItem(KEY, JSON.stringify(next));
  return next;
}

/** Convierte una lección en preferencias concretas del inventario. */
export function parseSizingLesson(
  text: string,
  inventory: InventoryItem[]
): { heard: string[]; patch: SizingPrefs } {
  const folded = foldText(text);
  const heard: string[] = [];
  const patch: SizingPrefs = {};
  if (!folded) return { heard, patch };

  const panels = active(inventory, "panel");
  const inverters = active(inventory, "inverter");
  const batteries = active(inventory, "battery");

  let bestPanel: { item: InventoryItem; score: number } | null = null;
  for (const item of panels) {
    const brand = foldText(item.brand || "");
    const model = foldText(item.model || item.name || "");
    let score = 0;
    if (brand.length > 2 && folded.includes(brand)) score += 2;
    if (model.length > 2 && folded.includes(model)) score += 3;
    if (
      item.capacity &&
      item.capacity > 50 &&
      new RegExp(`(?:^|\\D)${item.capacity}\\s*w`).test(folded)
    ) {
      score += 2;
    }
    if (score >= 3 && (!bestPanel || score > bestPanel.score)) bestPanel = { item, score };
  }
  if (
    bestPanel &&
    /panel|modulo|modulos|usar|usa|prefier|dej[ea]|elige|esco/.test(folded)
  ) {
    patch.preferPanelId = bestPanel.item.id;
    heard.push(`panel ${labelOf(bestPanel.item)}`);
  }

  let bestBattery: { item: InventoryItem; score: number } | null = null;
  for (const item of batteries) {
    const brand = foldText(item.brand || "");
    const model = foldText(item.model || item.name || "");
    let score = 0;
    if (brand.length > 2 && folded.includes(brand)) score += 2;
    if (model.length > 2 && folded.includes(model)) score += 3;
    if (score >= 3 && (!bestBattery || score > bestBattery.score)) bestBattery = { item, score };
  }
  if (bestBattery && /bater|bess|respaldo/.test(folded)) {
    patch.preferBatteryId = bestBattery.item.id;
    heard.push(`batería ${labelOf(bestBattery.item)}`);
  }

  let bestBrand = "";
  let bestBrandScore = 0;
  for (const item of inverters) {
    const brand = foldText(item.brand || "");
    if (brand.length < 3 || !folded.includes(brand)) continue;
    const score = brand.length;
    if (score > bestBrandScore) {
      bestBrand = brand;
      bestBrandScore = score;
    }
  }
  if (bestBrand && /inversor|usar|usa|prefier|dej[ea]|elige|esco|marca/.test(folded)) {
    patch.preferInverterBrand = bestBrand;
    heard.push(`inversor ${bestBrand}`);
  }

  if (/siempre h[ií]brid|solo h[ií]brid|prefier\w* h[ií]brid|usa(?:r)? h[ií]brid/.test(folded)) {
    patch.preferHybrid = true;
    heard.push("siempre híbrido");
  } else if (
    /nunca h[ií]brid|sin h[ií]brid|no (?:quiero|uses?|usar) h[ií]brid|on[\s-]?grid|solo (?:string|grid)/.test(
      folded
    )
  ) {
    patch.preferHybrid = false;
    heard.push("sin híbrido");
  }

  if (/nunca bater|sin bater|no (?:quiero|uses?|usar) bater|solo autoconsumo/.test(folded)) {
    patch.neverBattery = true;
    patch.alwaysBattery = false;
    heard.push("sin batería");
  } else if (/siempre bater|siempre con bater|siempre respaldo/.test(folded)) {
    patch.alwaysBattery = true;
    patch.neverBattery = false;
    heard.push("siempre batería");
  }

  const coverPct = folded.match(
    /(?:sobredimension|cubre|cobertura|margen)\w*\s+(?:al\s+)?(\d{2,3})\s*%|(\d{2,3})\s*%\s*(?:mas|de mas|de cobertura|sobre)/
  );
  if (coverPct) {
    const pct = Number(coverPct[1] || coverPct[2]);
    if (pct >= 100 && pct <= 200) {
      patch.coverFactor = pct / 100;
      heard.push(`cobertura ${pct}%`);
    } else if (pct > 0 && pct < 100) {
      patch.coverFactor = 1 + pct / 100;
      heard.push(`cobertura ${100 + pct}%`);
    }
  }
  const coverFactor = folded.match(/factor(?:\s+de)?(?:\s+cobertura)?\s+(\d+(?:[.,]\d+)?)/);
  if (coverFactor) {
    const value = parseNumber(coverFactor[1]);
    if (value >= 1 && value <= 2) {
      patch.coverFactor = value;
      heard.push(`cobertura ${Math.round(value * 100)}%`);
    }
  }

  const nightPct = folded.match(
    /noche(?:\s+\w+){0,4}\s+(\d{1,2})\s*%|(\d{1,2})\s*%(?:\s+\w+){0,3}\s+noche|franja(?:\s+nocturna)?\s+(\d{1,2})\s*%/
  );
  if (nightPct) {
    const pct = Number(nightPct[1] || nightPct[2] || nightPct[3]);
    if (pct > 0 && pct < 100) {
      patch.nightShare = pct / 100;
      heard.push(`noche al ${pct}%`);
    }
  }

  const extra = folded.match(
    /(\d+)\s*paneles?\s*(?:de\s+)?mas|agrega(?:r)?\s+(\d+)\s*paneles?|siempre\s+(\d+)\s*paneles?\s*(?:de\s+)?mas/
  );
  if (extra) {
    const n = Number(extra[1] || extra[2] || extra[3]);
    if (n > 0 && n <= 20) {
      patch.extraPanels = n;
      heard.push(`${n} paneles de más`);
    }
  } else if (/un panel(?:\s+de)?\s+mas|siempre un panel(?:\s+de)?\s+mas/.test(folded)) {
    patch.extraPanels = 1;
    heard.push("1 panel de más");
  } else if (/sin paneles?(?:\s+de)?\s+mas|cero paneles?(?:\s+de)?\s+mas|no agregues paneles/.test(folded)) {
    patch.extraPanels = 0;
    heard.push("sin paneles de más");
  }

  return { heard, patch };
}

function mergePrefs(base: SizingPrefs, patch: SizingPrefs): SizingPrefs {
  return { ...base, ...patch };
}

/** Guarda una lección y actualiza las preferencias que el pedido usará después. */
export function addSizingLesson(text: string, inventory: InventoryItem[]): {
  doctrine: SizingDoctrine;
  heard: string[];
} {
  const source = text.replace(/\s+/g, " ").trim();
  const { heard, patch } = parseSizingLesson(source, inventory);
  const current = loadSizingDoctrine();
  const lesson: SizingLesson = {
    id: `lesson-${Date.now().toString(36)}`,
    text: source,
    heard: heard.length ? heard : ["nota guardada"],
    createdAt: new Date().toISOString(),
  };
  const doctrine = saveDoctrine({
    lessons: [lesson, ...current.lessons],
    prefs: heard.length ? mergePrefs(current.prefs, patch) : current.prefs,
  });
  return { doctrine, heard };
}

export function removeSizingLesson(id: string, inventory: InventoryItem[] = []): SizingDoctrine {
  const current = loadSizingDoctrine();
  const lessons = current.lessons.filter((row) => row.id !== id);
  return saveDoctrine({ lessons, prefs: recompilePrefs(lessons, inventory) });
}

function recompilePrefs(lessons: SizingLesson[], inventory: InventoryItem[]): SizingPrefs {
  // Orden cronológico: la más reciente gana.
  const ordered = [...lessons].reverse();
  return ordered.reduce<SizingPrefs>((acc, lesson) => {
    const { patch } = parseSizingLesson(lesson.text, inventory);
    return mergePrefs(acc, patch);
  }, {});
}

/** Frases cortas de lo que ya quedó enseñado. */
export function describeSizingPrefs(prefs: SizingPrefs, inventory: InventoryItem[] = []): string[] {
  const lines: string[] = [];
  if (prefs.preferPanelId) {
    const panel = inventory.find((item) => item.id === prefs.preferPanelId);
    lines.push(panel ? `Panel ${labelOf(panel)}` : "Panel fijo del inventario");
  }
  if (prefs.preferInverterBrand) {
    lines.push(`Inversor marca ${prefs.preferInverterBrand}`);
  }
  if (prefs.preferHybrid === true) lines.push("Siempre híbrido");
  if (prefs.preferHybrid === false) lines.push("Sin híbrido");
  if (prefs.preferBatteryId) {
    const battery = inventory.find((item) => item.id === prefs.preferBatteryId);
    lines.push(battery ? `Batería ${labelOf(battery)}` : "Batería fija del inventario");
  }
  if (prefs.coverFactor && prefs.coverFactor !== 1) {
    lines.push(`Cobertura ${Math.round(prefs.coverFactor * 100)}%`);
  }
  if (prefs.nightShare) {
    lines.push(`Noche al ${Math.round(prefs.nightShare * 100)}%`);
  }
  if (prefs.extraPanels) lines.push(`${prefs.extraPanels} paneles de más`);
  if (prefs.alwaysBattery) lines.push("Siempre batería");
  if (prefs.neverBattery) lines.push("Sin batería");
  return lines;
}

export function clearSizingDoctrine(): SizingDoctrine {
  return saveDoctrine(emptyDoctrine());
}
