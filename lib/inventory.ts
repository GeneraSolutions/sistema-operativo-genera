import type { EquipmentCategory, InventoryItem, TrmConfig } from "@/types/inventory";
import { SEED_INVENTORY } from "@/lib/catalog-seed";

export { SEED_INVENTORY };

export const DEFAULT_TRM: TrmConfig = {
  trm: 4125,
  source: "Lista oficial Genera Solutions",
  updatedAt: new Date().toISOString(),
};

const INVENTORY_KEY = "genera.inventory.v3";
const TRM_KEY = "genera.trm.v1";

export function normalizeItem(item: InventoryItem): InventoryItem {
  return {
    ...item,
    marginPercent:
      typeof item.marginPercent === "number" && Number.isFinite(item.marginPercent)
        ? item.marginPercent
        : 0,
    applyIva:
      typeof item.applyIva === "boolean" ? item.applyIva : item.category !== "panel",
  };
}

export function loadInventory(): InventoryItem[] {
  if (typeof window === "undefined") return SEED_INVENTORY.map(normalizeItem);
  try {
    const raw = localStorage.getItem(INVENTORY_KEY);
    if (!raw) return SEED_INVENTORY.map(normalizeItem);
    const parsed = JSON.parse(raw) as InventoryItem[];
    return Array.isArray(parsed) && parsed.length > 0
      ? parsed.map(normalizeItem)
      : SEED_INVENTORY.map(normalizeItem);
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
): Partial<Record<EquipmentCategory, InventoryItem>> {
  const result: Partial<Record<EquipmentCategory, InventoryItem>> = {};
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
