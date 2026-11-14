import { lineFromItem, type QuoteLineInput } from "@/lib/quote-engine";
import type { InventoryItem } from "@/types/inventory";

/** Doctrina BOS de Genera Solutions SAS — en toda cotización on-grid e híbrida. */

export interface BosKitOpts {
  panelCount: number;
  inverter: InventoryItem | null | undefined;
  /** true = inversor híbrido → cable AC ×2 (y coraza igual). */
  hybrid: boolean;
  inventory: InventoryItem[];
  /** Riel preferido (doctrina / inventario). */
  preferStructureId?: string;
}

export interface BosKitLine {
  key: string;
  role: string;
  item: InventoryItem;
  qty: number;
  detail: string;
}

function fold(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function active(items: InventoryItem[], category: string): InventoryItem[] {
  return items.filter((i) => i.category === category && i.active !== false);
}

function prefer(
  pool: InventoryItem[],
  ...tests: Array<(item: InventoryItem) => boolean>
): InventoryItem | null {
  for (const test of tests) {
    const hit = pool.find(test);
    if (hit) return hit;
  }
  return pool.find((i) => i.isDefault) || pool[0] || null;
}

/** Rieles 4.80: cada grupo de 4 paneles → 2 rieles. */
export function railCountForPanels(panelCount: number): number {
  const n = Math.max(0, Math.trunc(panelCount));
  if (n <= 0) return 0;
  return Math.max(2, Math.ceil(n / 4) * 2);
}

/** Clamps universales: 4 paneles → 10; 8 → 18 ⇒ 2 + 2×paneles. */
export function clampCountForPanels(panelCount: number): number {
  const n = Math.max(0, Math.trunc(panelCount));
  if (n <= 0) return 0;
  return 2 + 2 * n;
}

/** Lugs de tierra: misma cantidad que rieles. */
export function lugCountForPanels(panelCount: number): number {
  return railCountForPanels(panelCount);
}

export function isHybridInverter(item: InventoryItem | null | undefined): boolean {
  if (!item) return false;
  return /h[ií]brid/.test(fold(`${item.brand} ${item.model} ${item.name}`));
}

export type InverterPhaseKind = "mono" | "bi" | "tri";

export function inverterPhaseKind(
  item: InventoryItem | null | undefined
): InverterPhaseKind {
  if (!item) return "bi";
  const t = fold(`${item.model} ${item.name}`);
  if (/trifas/.test(t)) return "tri";
  if (/monofas/.test(t)) return "mono";
  return "bi";
}

/** Conductores AC: bi 2F+N+T; tri 3F+N+T; mono 1F+N+T. */
export function acLineCount(kind: InverterPhaseKind): number {
  if (kind === "tri") return 5;
  if (kind === "mono") return 3;
  return 4;
}

/** Metros de cable AC #8: 12 m por línea × (híbrido ? 2 : 1). */
export function acCableMeters(
  kind: InverterPhaseKind,
  hybrid: boolean
): number {
  return 12 * acLineCount(kind) * (hybrid ? 2 : 1);
}

function pickRail(
  inventory: InventoryItem[],
  preferId?: string
): InventoryItem | null {
  const pool = active(inventory, "structure").filter(
    (i) => !i.mountType || i.mountType === "cubierta"
  );
  return prefer(
    pool,
    (i) => Boolean(preferId && i.id === preferId),
    (i) => /riel\s*4[.,]?80/.test(fold(i.model + i.name)) && i.isDefault,
    (i) => /riel\s*4[.,]?80/.test(fold(i.model + i.name)),
    (i) => i.isDefault
  );
}

function pickClamps(inventory: InventoryItem[]): InventoryItem | null {
  const pool = active(inventory, "structure");
  return prefer(
    pool,
    (i) => /clamp\s*universal|universal\s*clamp|clamps?\s*univers/.test(fold(i.model + i.name)),
    (i) => /end[\s-]*cl?amp/.test(fold(i.model + i.name))
  );
}

function pickLug(inventory: InventoryItem[]): InventoryItem | null {
  const pool = active(inventory, "structure");
  return prefer(
    pool,
    (i) => /lug.*tierra|tierra.*lug/.test(fold(i.model + i.name))
  );
}

function pickDpsDc(inventory: InventoryItem[]): InventoryItem | null {
  const pool = active(inventory, "dps").filter((i) =>
    /\bdc\b/.test(fold(`${i.model} ${i.name} ${i.notes || ""}`))
  );
  return prefer(
    pool,
    (i) => i.id === "dps-clamper-600v-40ka-dc",
    (i) => /600/.test(fold(i.model)),
    (i) => i.isDefault
  );
}

function pickBoxDc(inventory: InventoryItem[]): InventoryItem | null {
  const pool = active(inventory, "protection_box");
  return prefer(
    pool,
    (i) => /\bdc\b/.test(fold(i.notes || "")),
    (i) => /10\s*circuit/.test(fold(i.model + i.name)),
    (i) => /12\s*circuit/.test(fold(i.model + i.name))
  );
}

function pickBoxAc(inventory: InventoryItem[]): InventoryItem | null {
  const pool = active(inventory, "protection_box");
  return prefer(
    pool,
    (i) =>
      /\bac\b/.test(fold(i.notes || "")) &&
      /12\s*circuit/.test(fold(i.model + i.name)),
    (i) => /12\s*circuit/.test(fold(i.model + i.name)),
    (i) => /\bac\b/.test(fold(i.notes || ""))
  );
}

function pickGroundRod(inventory: InventoryItem[]): InventoryItem | null {
  return prefer(
    active(inventory, "ground_rod"),
    (i) => /varilla/.test(fold(i.model + i.name))
  );
}

function pickGroundTerminal(inventory: InventoryItem[]): InventoryItem | null {
  const pool = active(inventory, "ground_rod");
  return prefer(
    pool,
    (i) => /terminal/.test(fold(i.model + i.name)),
    (i) => /^acople$/.test(fold(i.model + i.name)) || fold(i.model) === "acople"
  );
}

function pickGroundCable(inventory: InventoryItem[]): InventoryItem | null {
  const pool = active(inventory, "ground_cable");
  return prefer(
    pool,
    (i) => /#?\s*8|calibre\s*8|awg\s*8/.test(fold(i.model + i.name)),
    (i) => i.isDefault
  );
}

function pickAcCable(inventory: InventoryItem[]): InventoryItem | null {
  const pool = active(inventory, "ac_cable");
  return prefer(
    pool,
    (i) => /#?\s*8|calibre\s*8/.test(fold(i.model + i.name)),
    (i) => i.isDefault
  );
}

function pickCanaleta(inventory: InventoryItem[]): InventoryItem | null {
  const pool = active(inventory, "metal_channel");
  return prefer(
    pool,
    (i) => /8\s*[x×]\s*4/.test(fold(i.model + i.name)),
    (i) => i.isDefault
  );
}

function pickCorazaPanel(inventory: InventoryItem[]): InventoryItem | null {
  const pool = active(inventory, "lszh_sheath");
  return prefer(
    pool,
    (i) => /coraza\s*metal/.test(fold(i.model + i.name)),
    (i) => /coraza/.test(fold(i.model + i.name)) && !/terminal/.test(fold(i.model + i.name))
  );
}

function pickCorazaLszh(inventory: InventoryItem[]): InventoryItem | null {
  const pool = active(inventory, "lszh_sheath");
  return prefer(
    pool,
    (i) => /libre\s*de\s*halogen|lszh/.test(fold(`${i.model} ${i.name} ${i.notes || ""}`)),
    (i) => /coraza\s*plastic/.test(fold(i.model + i.name))
  );
}

function pickCorazaTerminal(inventory: InventoryItem[]): InventoryItem | null {
  const pool = active(inventory, "lszh_sheath");
  return prefer(
    pool,
    (i) => /terminal.*3\s*\/\s*4|3\s*\/\s*4.*terminal/.test(fold(i.model + i.name)),
    (i) => /terminal/.test(fold(i.model + i.name))
  );
}

/**
 * Equipos BOS de toda cotización Genera Solutions SAS.
 * No incluye panel/inversor/batería/cable solar/YRO (van por el núcleo).
 * Sí incluye rieles con qty doctrina (reemplaza qty de estructura).
 */
export function buildBosKit(opts: BosKitOpts): BosKitLine[] {
  const panels = Math.max(0, Math.trunc(opts.panelCount));
  if (panels <= 0) return [];

  const hybrid = opts.hybrid || isHybridInverter(opts.inverter);
  const phase = inverterPhaseKind(opts.inverter);
  const rails = railCountForPanels(panels);
  const clamps = clampCountForPanels(panels);
  const lugs = lugCountForPanels(panels);
  const acM = acCableMeters(phase, hybrid);
  const inv = opts.inventory;
  const out: BosKitLine[] = [];

  const push = (
    key: string,
    role: string,
    item: InventoryItem | null,
    qty: number,
    detail: string
  ) => {
    if (!item || qty <= 0) return;
    out.push({ key, role, item, qty, detail });
  };

  push(
    "structure",
    "Estructura",
    pickRail(inv, opts.preferStructureId),
    rails,
    `Riel 4.80 · ${panels} paneles → ${rails} rieles (grupo de 4 → 2)`
  );
  push(
    "clamp_universal",
    "Clamps",
    pickClamps(inv),
    clamps,
    `Universales por defecto · ${panels} paneles → ${clamps}`
  );
  push(
    "ground_lug",
    "Lugs de tierra",
    pickLug(inv),
    lugs,
    `Misma cantidad que rieles (${lugs})`
  );
  push(
    "dps_dc",
    "DPS DC",
    pickDpsDc(inv),
    1,
    "Obligatorio para certificar el sistema"
  );
  push(
    "protection_box_dc",
    "Caja protecciones DC",
    pickBoxDc(inv),
    1,
    "Caja 10–12 circuitos para el tablero DC"
  );
  push(
    "protection_box_ac",
    "Caja protecciones AC",
    pickBoxAc(inv),
    1,
    "Caja 12 circuitos AC"
  );
  push("ground_rod", "Varilla a tierra", pickGroundRod(inv), 1, "Puesta a tierra");
  push(
    "ground_rod_terminal",
    "Terminal varilla",
    pickGroundTerminal(inv),
    1,
    "Terminal / acople de la varilla"
  );
  push(
    "ground_cable",
    "Cable de tierra",
    pickGroundCable(inv),
    20,
    "20 m calibre 8 por defecto"
  );
  push(
    "ac_cable",
    "Cable AC",
    pickAcCable(inv),
    acM,
    `Calibre 8 · 12 m/línea · ${phase === "tri" ? "trifásico 5" : phase === "mono" ? "monofásico 3" : "bifásico 4"} conductores · ${hybrid ? "híbrido ×2" : "on-grid ×1"} = ${acM} m`
  );
  push(
    "metal_channel",
    "Canaleta electrostática",
    pickCanaleta(inv),
    2,
    "2 canaletas 8×4 (tramos 2.40 m)"
  );
  push(
    "coraza_panel",
    "Coraza cable paneles",
    pickCorazaPanel(inv),
    acM,
    `Misma cantidad que el cable AC (${acM} m)`
  );
  push(
    "coraza_lszh",
    "Coraza libre de halógeno",
    pickCorazaLszh(inv),
    10,
    "10 m plástica por defecto"
  );
  push(
    "coraza_terminal",
    "Terminales 3/4",
    pickCorazaTerminal(inv),
    25,
    "25 terminales 3/4 por defecto"
  );

  return out;
}

const BOS_KEYS = new Set([
  "clamp_universal",
  "ground_lug",
  "dps_dc",
  "protection_box_dc",
  "protection_box_ac",
  "ground_rod",
  "ground_rod_terminal",
  "ground_cable",
  "ac_cable",
  "metal_channel",
  "coraza_panel",
  "coraza_lszh",
  "coraza_terminal",
]);

/** Inserta / refresca líneas BOS; actualiza qty de rieles (structure). */
export function upsertBosKitLines(
  lines: QuoteLineInput[],
  opts: BosKitOpts
): QuoteLineInput[] {
  const kit = buildBosKit(opts);
  if (!kit.length) return lines;

  const byKey = new Map(kit.map((row) => [row.key, row]));
  const next: QuoteLineInput[] = [];
  const seen = new Set<string>();

  for (const line of lines) {
    const bos = byKey.get(line.key);
    if (bos) {
      next.push(lineFromItem(bos.key, bos.item, bos.qty));
      seen.add(bos.key);
      continue;
    }
    if (BOS_KEYS.has(line.key)) continue;
    next.push(line);
  }

  for (const row of kit) {
    if (seen.has(row.key)) continue;
    if (row.key === "structure") {
      const idx = next.findIndex((l) => l.key === "structure");
      const line = lineFromItem(row.key, row.item, row.qty);
      if (idx >= 0) next[idx] = line;
      else next.push(line);
      continue;
    }
    next.push(lineFromItem(row.key, row.item, row.qty));
  }

  return next;
}
