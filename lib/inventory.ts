import type { EquipmentCategory, InventoryItem, TrmConfig } from "@/types/inventory";

export const DEFAULT_TRM: TrmConfig = {
  trm: 4125,
  source: "Referencia manual Genera Solutions",
  updatedAt: new Date().toISOString(),
};

export const SEED_INVENTORY: InventoryItem[] = [
  {
    id: "panel-jinko-570",
    category: "panel",
    name: "Panel Mono PERC 570 Wp",
    brand: "Jinko Solar",
    model: "JKM570N-72HL4-V",
    priceCOP: 520000,
    priceUSD: 126,
    unit: "módulo",
    capacity: 570,
    isDefault: true,
    active: true,
    notes: "Bifacial N-type · Garantía 30 años",
    updatedAt: new Date().toISOString(),
  },
  {
    id: "panel-longi-550",
    category: "panel",
    name: "Panel Hi-MO 550 Wp",
    brand: "LONGi",
    model: "LR5-72HPH-550M",
    priceCOP: 485000,
    priceUSD: 118,
    unit: "módulo",
    capacity: 550,
    isDefault: false,
    active: true,
    updatedAt: new Date().toISOString(),
  },
  {
    id: "inv-huawei-50",
    category: "inverter",
    name: "Inversor String 50 kW",
    brand: "Huawei",
    model: "SUN2000-50KTL-M3",
    priceCOP: 18500000,
    priceUSD: 4485,
    unit: "unidad",
    capacity: 50,
    isDefault: true,
    active: true,
    notes: "Ideal 30–80 kWp",
    updatedAt: new Date().toISOString(),
  },
  {
    id: "inv-sungrow-110",
    category: "inverter",
    name: "Inversor Central 110 kW",
    brand: "Sungrow",
    model: "SG110CX",
    priceCOP: 42000000,
    priceUSD: 10180,
    unit: "unidad",
    capacity: 110,
    isDefault: false,
    active: true,
    notes: "Granjas y C&I >100 kWp",
    updatedAt: new Date().toISOString(),
  },
  {
    id: "inv-fronius-10",
    category: "inverter",
    name: "Inversor Residencial 10 kW",
    brand: "Fronius",
    model: "Primo GEN24 10.0",
    priceCOP: 9800000,
    priceUSD: 2375,
    unit: "unidad",
    capacity: 10,
    isDefault: false,
    active: true,
    updatedAt: new Date().toISOString(),
  },
  {
    id: "bat-byd-hvs",
    category: "battery",
    name: "BESS Litio 10.2 kWh",
    brand: "BYD",
    model: "Battery-Box Premium HVS 10.2",
    priceCOP: 28500000,
    priceUSD: 6909,
    unit: "rack",
    capacity: 10.2,
    isDefault: false,
    active: true,
    notes: "Apilar hasta 5 módulos",
    updatedAt: new Date().toISOString(),
  },
  {
    id: "bat-pylon-5",
    category: "battery",
    name: "Batería Litio 5.12 kWh",
    brand: "Pylontech",
    model: "US5000",
    priceCOP: 12500000,
    priceUSD: 3030,
    unit: "módulo",
    capacity: 5.12,
    isDefault: true,
    active: true,
    updatedAt: new Date().toISOString(),
  },
  {
    id: "str-cubierta",
    category: "structure",
    name: "Estructura Cubierta Metálica",
    brand: "Genera Structures",
    model: "GS-CUB-AL",
    priceCOP: 280000,
    priceUSD: 68,
    unit: "módulo",
    mountType: "cubierta",
    isDefault: true,
    active: true,
    notes: "Aluminio + acero inox · NSR-10",
    updatedAt: new Date().toISOString(),
  },
  {
    id: "str-suelo",
    category: "structure",
    name: "Estructura Suelo Monoposte",
    brand: "Genera Structures",
    model: "GS-GND-MP",
    priceCOP: 420000,
    priceUSD: 102,
    unit: "módulo",
    mountType: "suelo",
    isDefault: false,
    active: true,
    updatedAt: new Date().toISOString(),
  },
  {
    id: "str-pergola",
    category: "structure",
    name: "Pérgola Solar Arquitectónica",
    brand: "Genera Structures",
    model: "GS-PRG-ARCH",
    priceCOP: 890000,
    priceUSD: 216,
    unit: "módulo",
    mountType: "pergola",
    isDefault: false,
    active: true,
    notes: "Cargas viento / sismo NSR-10",
    updatedAt: new Date().toISOString(),
  },
  {
    id: "cab-pv1",
    category: "cabling",
    name: "Cable Solar PV1-F 6 mm²",
    brand: "Lapp / Helukabel",
    model: "PV1-F 6mm",
    priceCOP: 8500,
    priceUSD: 2.06,
    unit: "metro",
    isDefault: true,
    active: true,
    updatedAt: new Date().toISOString(),
  },
  {
    id: "cab-mc4",
    category: "cabling",
    name: "Conector MC4 Par",
    brand: "Staubli",
    model: "MC4-Evo2",
    priceCOP: 12000,
    priceUSD: 2.91,
    unit: "par",
    isDefault: false,
    active: true,
    updatedAt: new Date().toISOString(),
  },
  {
    id: "prot-dc",
    category: "protection",
    name: "Tablero DC + DPS T2",
    brand: "ABB / Schneider",
    model: "GEN-DC-KIT",
    priceCOP: 1850000,
    priceUSD: 448,
    unit: "kit",
    isDefault: true,
    active: true,
    updatedAt: new Date().toISOString(),
  },
  {
    id: "prot-ac",
    category: "protection",
    name: "Tablero AC Interconexión",
    brand: "Schneider Electric",
    model: "GEN-AC-KIT",
    priceCOP: 2450000,
    priceUSD: 594,
    unit: "kit",
    isDefault: true,
    active: true,
    notes: "Incluye breaker + medidor bidireccional prep",
    updatedAt: new Date().toISOString(),
  },
];

const INVENTORY_KEY = "genera.inventory.v1";
const TRM_KEY = "genera.trm.v1";

export function loadInventory(): InventoryItem[] {
  if (typeof window === "undefined") return SEED_INVENTORY;
  try {
    const raw = localStorage.getItem(INVENTORY_KEY);
    if (!raw) return SEED_INVENTORY;
    const parsed = JSON.parse(raw) as InventoryItem[];
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : SEED_INVENTORY;
  } catch {
    return SEED_INVENTORY;
  }
}

export function saveInventory(items: InventoryItem[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(INVENTORY_KEY, JSON.stringify(items));
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
