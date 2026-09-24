import type { InventoryItem } from "@/types/inventory";

export type MountPreference = "cubierta" | "suelo" | "pergola";

export interface QuoteEquipmentSelection {
  panel: InventoryItem | null;
  inverter: InventoryItem | null;
  battery: InventoryItem | null;
  structure: InventoryItem | null;
  cabling: InventoryItem | null;
  protectionDc: InventoryItem | null;
  protectionAc: InventoryItem | null;
}

export interface QuoteParams {
  /** Capacidad del sistema en kWp (3 – 5000) */
  systemKwp: number;
  /** Irradiancia / horas pico sol equivalentes */
  peakSunHours: number;
  /** Incluir BESS */
  includeBattery: boolean;
  /** Autonomía deseada en kWh (si BESS) */
  batteryKwh: number;
  /** Metros de cableado estimados por kWp */
  cableMetersPerKwp: number;
  mount: MountPreference;
  energyTariffCOP: number;
  selection: QuoteEquipmentSelection;
  /** Soft costs: EPC, ingeniería, trámites (% del hard cost) */
  softCostPercent: number;
  /** Margen comercial */
  marginPercent: number;
}

export interface QuoteBreakdownLine {
  key: string;
  label: string;
  qty: number;
  unit: string;
  unitPriceCOP: number;
  totalCOP: number;
}

export interface QuoteBreakdown {
  lines: QuoteBreakdownLine[];
  hardCostCOP: number;
  softCostCOP: number;
  marginCOP: number;
  totalCapexCOP: number;
  annualGenerationKWh: number;
  moduleCount: number;
  inverterCount: number;
  batteryCount: number;
}

/**
 * Motor paramétrico ultra-rápido: dimensiona CAPEX desde kWp + equipos del inventario.
 */
export function calculateParametricQuote(params: QuoteParams): QuoteBreakdown {
  const { systemKwp, selection } = params;
  const lines: QuoteBreakdownLine[] = [];

  const panelWp = selection.panel?.capacity ?? 570;
  const moduleCount = Math.max(1, Math.ceil((systemKwp * 1000) / panelWp));
  const panelPrice = selection.panel?.priceCOP ?? 0;
  lines.push({
    key: "panels",
    label: selection.panel
      ? `${selection.panel.brand} ${selection.panel.model}`
      : "Paneles FV",
    qty: moduleCount,
    unit: "módulo",
    unitPriceCOP: panelPrice,
    totalCOP: moduleCount * panelPrice,
  });

  const invKw = selection.inverter?.capacity ?? 50;
  const inverterCount = Math.max(1, Math.ceil(systemKwp / invKw));
  const invPrice = selection.inverter?.priceCOP ?? 0;
  lines.push({
    key: "inverters",
    label: selection.inverter
      ? `${selection.inverter.brand} ${selection.inverter.model}`
      : "Inversores",
    qty: inverterCount,
    unit: "unidad",
    unitPriceCOP: invPrice,
    totalCOP: inverterCount * invPrice,
  });

  let batteryCount = 0;
  if (params.includeBattery && selection.battery) {
    const batKwh = selection.battery.capacity ?? 5.12;
    batteryCount = Math.max(1, Math.ceil(params.batteryKwh / batKwh));
    lines.push({
      key: "batteries",
      label: `${selection.battery.brand} ${selection.battery.model}`,
      qty: batteryCount,
      unit: selection.battery.unit,
      unitPriceCOP: selection.battery.priceCOP,
      totalCOP: batteryCount * selection.battery.priceCOP,
    });
  }

  if (selection.structure) {
    lines.push({
      key: "structure",
      label: `${selection.structure.name} (${params.mount})`,
      qty: moduleCount,
      unit: "módulo",
      unitPriceCOP: selection.structure.priceCOP,
      totalCOP: moduleCount * selection.structure.priceCOP,
    });
  }

  if (selection.cabling) {
    const meters = Math.ceil(systemKwp * params.cableMetersPerKwp);
    lines.push({
      key: "cabling",
      label: selection.cabling.name,
      qty: meters,
      unit: "metro",
      unitPriceCOP: selection.cabling.priceCOP,
      totalCOP: meters * selection.cabling.priceCOP,
    });
  }

  // Kits de protección: 1 por cada ~50 kWp (mín. 1)
  const protKits = Math.max(1, Math.ceil(systemKwp / 50));
  if (selection.protectionDc) {
    lines.push({
      key: "prot-dc",
      label: selection.protectionDc.name,
      qty: protKits,
      unit: "kit",
      unitPriceCOP: selection.protectionDc.priceCOP,
      totalCOP: protKits * selection.protectionDc.priceCOP,
    });
  }
  if (selection.protectionAc) {
    lines.push({
      key: "prot-ac",
      label: selection.protectionAc.name,
      qty: protKits,
      unit: "kit",
      unitPriceCOP: selection.protectionAc.priceCOP,
      totalCOP: protKits * selection.protectionAc.priceCOP,
    });
  }

  const hardCostCOP = lines.reduce((acc, l) => acc + l.totalCOP, 0);
  const softCostCOP = Math.round(hardCostCOP * (params.softCostPercent / 100));
  const subtotal = hardCostCOP + softCostCOP;
  const marginCOP = Math.round(subtotal * (params.marginPercent / 100));
  const totalCapexCOP = subtotal + marginCOP;

  // Generación: kWp * HSP * 365 * PR 0.80
  const performanceRatio = 0.8;
  const annualGenerationKWh = Math.round(
    systemKwp * params.peakSunHours * 365 * performanceRatio
  );

  return {
    lines,
    hardCostCOP,
    softCostCOP,
    marginCOP,
    totalCapexCOP,
    annualGenerationKWh,
    moduleCount,
    inverterCount,
    batteryCount,
  };
}
