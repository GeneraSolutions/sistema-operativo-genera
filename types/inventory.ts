export type EquipmentCategory =
  | "panel"
  | "inverter"
  | "battery"
  | "structure"
  | "cabling"
  | "protection";

export type StructureMountType = "cubierta" | "suelo" | "pergola";

export interface InventoryItem {
  id: string;
  category: EquipmentCategory;
  name: string;
  brand: string;
  model: string;
  /** Precio unitario en COP */
  priceCOP: number;
  /** Precio unitario en USD */
  priceUSD: number;
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
  updatedAt: string;
}

export interface TrmConfig {
  /** TRM COP por 1 USD */
  trm: number;
  source: string;
  updatedAt: string;
}

export const CATEGORY_LABELS: Record<EquipmentCategory, string> = {
  panel: "Paneles",
  inverter: "Inversores",
  battery: "Baterías de Litio",
  structure: "Estructuras",
  cabling: "Cableado Solar",
  protection: "Protecciones",
};

export const MOUNT_LABELS: Record<StructureMountType, string> = {
  cubierta: "Cubierta",
  suelo: "Suelo",
  pergola: "Pérgola",
};
