export const BUILTIN_CATEGORIES = [
  { id: "inverter", label: "Inversores" },
  { id: "microinverter", label: "Microinversores" },
  { id: "panel", label: "Paneles solares" },
  { id: "cabling", label: "Cable solar" },
  { id: "battery", label: "Baterías" },
  { id: "protection_dc", label: "Protecciones DC" },
  { id: "protection_ac", label: "Protecciones AC" },
  { id: "dps", label: "DPS" },
  { id: "structure", label: "Estructura" },
  { id: "ground_rod", label: "Varilla a tierra" },
  { id: "lszh_sheath", label: "Coraza libre de halógeno" },
  { id: "metal_channel", label: "Canaleta metálica" },
  { id: "mc4", label: "MC4" },
  { id: "ac_cable", label: "Cable AC" },
  { id: "protection_box", label: "Caja de protecciones" },
  { id: "combiner", label: "Combiner box" },
  { id: "ground_cable", label: "Cable de tierra" },
  { id: "ev_charger", label: "Cargadores eléctricos" },
] as const;

export type BuiltinEquipmentCategory = (typeof BUILTIN_CATEGORIES)[number]["id"];
export type EquipmentCategory = BuiltinEquipmentCategory | (string & {});

export type StructureMountType = "cubierta" | "suelo" | "pergola";

export interface InventoryItem {
  id: string;
  category: EquipmentCategory;
  name: string;
  brand: string;
  model: string;
  /** Costo interno / compra unitario en COP */
  priceCOP: number;
  /** Costo interno unitario en USD */
  priceUSD: number;
  /** Ganancia sobre el costo (ej: 20 = 20%) */
  marginPercent: number;
  /** Si el ítem genera IVA en la venta */
  applyIva: boolean;
  /** Unidad de medida (Wp, kW, kWh, m, kit, etc.) */
  unit: string;
  /** Capacidad / potencia nominal cuando aplica */
  capacity?: number;
  /** Tipo de montaje (solo estructuras) */
  mountType?: StructureMountType;
  /** Usar por defecto en el cotizador */
  isDefault: boolean;
  /** Activo en catálogo */
  active: boolean;
  notes?: string;
  /** Unidades disponibles en bodega */
  stock?: number;
  /** Días de importación / entrega si no hay stock */
  leadTimeDays?: number;
  /** URL de ficha técnica (fabricante) */
  datasheetUrl?: string;
  updatedAt: string;
}

export interface TrmConfig {
  /** TRM COP por 1 USD */
  trm: number;
  source: string;
  updatedAt: string;
}

export interface CustomCategory {
  id: string;
  label: string;
}

export const CATEGORY_LABELS: Record<string, string> = Object.fromEntries(
  BUILTIN_CATEGORIES.map((c) => [c.id, c.label])
);

export const MOUNT_LABELS: Record<StructureMountType, string> = {
  cubierta: "Cubierta",
  suelo: "Suelo",
  pergola: "Pérgola",
};

export function slugCategory(label: string) {
  return (
    label
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "")
      .slice(0, 40) || `grupo_${Date.now()}`
  );
}
