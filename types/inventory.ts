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
