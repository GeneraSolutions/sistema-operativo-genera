import type {
  CustomCategory,
  EquipmentCategory,
  InventoryItem,
  TrmConfig,
} from "@/types/inventory";
import { BUILTIN_CATEGORIES, CATEGORY_LABELS } from "@/types/inventory";
import { SEED_INVENTORY } from "@/lib/catalog-seed";

export { SEED_INVENTORY };

export const DEFAULT_TRM: TrmConfig = {
  trm: 4125,
  source: "Lista oficial Genera Solutions",
  updatedAt: new Date().toISOString(),
};

const INVENTORY_KEY = "genera.inventory.v4";
const LEGACY_KEY = "genera.inventory.v3";
const TRM_KEY = "genera.trm.v1";
const CUSTOM_CAT_KEY = "genera.custom-categories.v1";

export function normalizeItem(item: InventoryItem): InventoryItem {
  return {
    ...item,
    category: migrateCategory(item),
    marginPercent:
      typeof item.marginPercent === "number" && Number.isFinite(item.marginPercent)
        ? item.marginPercent
        : 0,
    applyIva:
      typeof item.applyIva === "boolean"
        ? item.applyIva
        : item.category !== "panel",
  };
}

function migrateCategory(item: InventoryItem): EquipmentCategory {
  const old = String(item.category || "");
  const notes = (item.notes || "").toLowerCase();
  const blob = `${item.name} ${item.brand} ${notes}`.toLowerCase();
  if (old === "protection") {
    if (blob.includes("combiner")) return "combiner";
    if (blob.includes("dps")) return "dps";
    if (blob.includes("varilla")) return "ground_rod";
    if (blob.includes("caja")) return "protection_box";
    if (notes === "ac" || blob.includes(" ac")) return "protection_ac";
    return "protection_dc";
  }
  if (old === "inverter" && notes.includes("micro")) return "microinverter";
  if (old === "cabling") {
    if (notes.includes("cargador") || blob.includes("charger")) return "ev_charger";
    if (blob.includes("mc4")) return "mc4";
    if (blob.includes("coraza") || blob.includes("halogen")) return "lszh_sheath";
    if (blob.includes("canaleta")) return "metal_channel";
    if (blob.includes("tierra")) return "ground_cable";
    if (blob.includes("cable ac") || blob.includes("ac cable")) return "ac_cable";
    return "cabling";
  }
  return old as EquipmentCategory;
}

function mergeWithSeed(existing: InventoryItem[]): InventoryItem[] {
  const byId = new Map(existing.map((i) => [i.id, normalizeItem(i)]));
  for (const seed of SEED_INVENTORY) {
    if (!byId.has(seed.id)) byId.set(seed.id, normalizeItem(seed));
  }
  return Array.from(byId.values());
}

export function loadInventory(): InventoryItem[] {
  if (typeof window === "undefined") return SEED_INVENTORY.map(normalizeItem);
  try {
    const raw = localStorage.getItem(INVENTORY_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as InventoryItem[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map(normalizeItem);
      }
    }
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      const parsed = JSON.parse(legacy) as InventoryItem[];
      const merged = mergeWithSeed(Array.isArray(parsed) ? parsed : []);
      saveInventory(merged);
      return merged;
    }
    return SEED_INVENTORY.map(normalizeItem);
  } catch {
    return SEED_INVENTORY.map(normalizeItem);
  }
}

export function saveInventory(items: InventoryItem[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(INVENTORY_KEY, JSON.stringify(items));
}

export function restoreOfficialCatalog(): InventoryItem[] {
  const next = SEED_INVENTORY.map(normalizeItem);
  saveInventory(next);
  return next;
}

export function loadCustomCategories(): CustomCategory[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(CUSTOM_CAT_KEY);
    const parsed = raw ? (JSON.parse(raw) as CustomCategory[]) : [];
    return Array.isArray(parsed) ? parsed.filter((c) => c.id && c.label) : [];
  } catch {
    return [];
  }
}

export function saveCustomCategories(cats: CustomCategory[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(CUSTOM_CAT_KEY, JSON.stringify(cats));
}

export function allCategoryIds(custom: CustomCategory[] = []): string[] {
  const ids = BUILTIN_CATEGORIES.map((c) => c.id as string);
  for (const c of custom) {
    if (!ids.includes(c.id)) ids.push(c.id);
  }
  return ids;
}

export function categoryLabel(
  id: string,
  custom: CustomCategory[] = []
): string {
  const extra = custom.find((c) => c.id === id);
  if (extra) return extra.label;
  return CATEGORY_LABELS[id] ?? id;
}

export function loadTrm(): TrmConfig {
  if (typeof window === "undefined") return DEFAULT_TRM;
  try {
    const raw = localStorage.getItem(TRM_KEY);
    if (!raw) return DEFAULT_TRM;
    return JSON.parse(raw) as TrmConfig;
  } catch {
    return DEFAULT_TRM;
  }
}

export function saveTrm(config: TrmConfig): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(TRM_KEY, JSON.stringify(config));
}

export function usdToCop(usd: number, trm: number): number {
  return Math.round(usd * trm);
}

export function copToUsd(cop: number, trm: number): number {
  if (trm <= 0) return 0;
  return Number((cop / trm).toFixed(2));
}

export function getDefaultsByCategory(
  items: InventoryItem[]
): Partial<Record<string, InventoryItem>> {
  const result: Partial<Record<string, InventoryItem>> = {};
  for (const item of items) {
    if (item.active && item.isDefault && !result[item.category]) {
      result[item.category] = item;
    }
  }
  return result;
}

export function filterByCategory(
  items: InventoryItem[],
  category: EquipmentCategory
): InventoryItem[] {
  return items.filter((i) => i.category === category && i.active);
}
