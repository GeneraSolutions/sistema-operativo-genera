import {
  buildMarginTactics,
  calculateLaborCost,
  calculateProjectPL,
  type ColombiaTaxConfig,
  type LaborCostResult,
  type MarginTactic,
  type ProjectPL,
} from "@/lib/colombia-tax";
import { IVA_RATE, ivaUnitCOP, saleUnitCOP } from "@/lib/pricing";
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

export interface QuoteQuantities {
  panels: number;
  inverters: number;
  batteries: number;
  structure: number;
  cabling: number;
  protectionDc: number;
  protectionAc: number;
}

export interface QuoteParams {
  systemKwp: number;
  peakSunHours: number;
  includeBattery: boolean;
  batteryKwh: number;
  cableMetersPerKwp: number;
  mount: MountPreference;
  energyTariffCOP: number;
  selection: QuoteEquipmentSelection;
  quantities: QuoteQuantities;
  /** Gastos indirectos de obra (% sobre venta de equipos) — costo interno, no se cobra aparte */
  overheadPercent: number;
  chargeIva: boolean;
  engineeringSaleCOP: number;
  engineeringCostCOP: number;
  technicians: number;
  dailyWageCOP: number;
  laborDays: number;
  laborSaleCOP: number;
  laborMarginPercent: number;
  targetNetProfitCOP: number;
  clientWithholds: boolean;
  clientGranContribuyente: boolean;
  taxConfig: ColombiaTaxConfig;
}

export interface QuoteBreakdownLine {
  key: string;
  label: string;
  qty: number;
  unit: string;
  costUnitCOP: number;
  marginPercent: number;
  saleUnitCOP: number;
  ivaUnitCOP: number;
  costTotalCOP: number;
  saleTotalCOP: number;
  ivaTotalCOP: number;
  profitCOP: number;
  applyIva: boolean;
  unitPriceCOP: number;
  totalCOP: number;
}

export interface QuoteBreakdown {
  lines: QuoteBreakdownLine[];
  hardCostCOP: number;
  /** @deprecated use overheadCOP — se mantiene para propuestas viejas */
  softCostCOP: number;
  overheadCOP: number;
  marginCOP: number;
  saleSubtotalCOP: number;
  ivaCOP: number;
  totalCapexCOP: number;
  annualGenerationKWh: number;
  moduleCount: number;
  inverterCount: number;
  batteryCount: number;
  labor: LaborCostResult;
  pl: ProjectPL;
  tactics: MarginTactic[];
}

export function suggestQuantities(
  systemKwp: number,
  selection: QuoteEquipmentSelection,
  includeBattery: boolean,
  batteryKwh: number,
  cableMetersPerKwp = 12
): QuoteQuantities {
  const panelWp = selection.panel?.capacity ?? 570;
  const panels = Math.max(1, Math.ceil((systemKwp * 1000) / panelWp));
  const invKw = selection.inverter?.capacity ?? 50;
  const inverters = Math.max(1, Math.ceil(systemKwp / Math.max(invKw, 0.1)));
  let batteries = 0;
  if (includeBattery && selection.battery) {
    const batKwh = selection.battery.capacity ?? 5;
    batteries = Math.max(1, Math.ceil(batteryKwh / Math.max(batKwh, 0.1)));
  }
  const protKits = Math.max(1, Math.ceil(systemKwp / 50));
  return {
    panels,
    inverters,
    batteries,
    structure: panels,
    cabling: Math.ceil(systemKwp * cableMetersPerKwp),
    protectionDc: protKits,
    protectionAc: protKits,
  };
}

function makeLine(
  key: string,
  item: InventoryItem,
  qty: number,
  unit: string,
  chargeIva: boolean,
  label?: string
): QuoteBreakdownLine {
  const safeQty = Math.max(0, qty);
  const costUnit = item.priceCOP;
  const saleUnit = saleUnitCOP(item);
  const ivaUnit = ivaUnitCOP(item, chargeIva);
  const costTotal = Math.round(costUnit * safeQty);
  const saleTotal = Math.round(saleUnit * safeQty);
  const ivaTotal = Math.round(ivaUnit * safeQty);
  return {
    key,
    label: label ?? `${item.brand} ${item.model || item.name}`,
    qty: safeQty,
    unit,
    costUnitCOP: costUnit,
    marginPercent: item.marginPercent ?? 0,
    saleUnitCOP: saleUnit,
    ivaUnitCOP: ivaUnit,
    costTotalCOP: costTotal,
    saleTotalCOP: saleTotal,
    ivaTotalCOP: ivaTotal,
    profitCOP: saleTotal - costTotal,
    applyIva: Boolean(item.applyIva) && chargeIva,
    unitPriceCOP: saleUnit,
    totalCOP: saleTotal,
  };
}

export function calculateParametricQuote(params: QuoteParams): QuoteBreakdown {
  const { selection, quantities: q, chargeIva } = params;
  const lines: QuoteBreakdownLine[] = [];

  if (selection.panel && q.panels > 0) {
    lines.push(
      makeLine("panels", selection.panel, q.panels, "módulo", chargeIva)
    );
  }
  if (selection.inverter && q.inverters > 0) {
    lines.push(
      makeLine("inverters", selection.inverter, q.inverters, "unidad", chargeIva)
    );
  }
  if (params.includeBattery && selection.battery && q.batteries > 0) {
    lines.push(
      makeLine(
        "batteries",
        selection.battery,
        q.batteries,
        selection.battery.unit || "módulo",
        chargeIva
      )
    );
  }
  if (selection.structure && q.structure > 0) {
    lines.push(
      makeLine(
        "structure",
        selection.structure,
        q.structure,
        selection.structure.unit || "unidad",
        chargeIva,
        `${selection.structure.name} (${params.mount})`
      )
    );
  }
  if (selection.cabling && q.cabling > 0) {
    lines.push(
      makeLine(
        "cabling",
        selection.cabling,
        q.cabling,
        selection.cabling.unit || "metro",
        chargeIva
      )
    );
  }
  if (selection.protectionDc && q.protectionDc > 0) {
    lines.push(
      makeLine(
        "prot-dc",
        selection.protectionDc,
        q.protectionDc,
        "unidad",
        chargeIva
      )
    );
  }
  if (selection.protectionAc && q.protectionAc > 0) {
    lines.push(
      makeLine(
        "prot-ac",
        selection.protectionAc,
        q.protectionAc,
        "unidad",
        chargeIva
      )
    );
  }

  const equipmentSale = lines.reduce((acc, l) => acc + l.saleTotalCOP, 0);
  const equipmentCost = lines.reduce((acc, l) => acc + l.costTotalCOP, 0);
  const equipmentIva = lines.reduce((acc, l) => acc + l.ivaTotalCOP, 0);

  const labor = calculateLaborCost({
    technicians: params.technicians,
    days: params.laborDays,
    dailyWageCOP: params.dailyWageCOP,
    laborSaleCOP: params.laborSaleCOP,
    laborMarginPercent: params.laborMarginPercent,
    chargeIva: params.chargeIva,
    config: params.taxConfig,
  });

  const engineeringSale = Math.max(0, Math.round(params.engineeringSaleCOP));
  const engineeringCost = Math.max(0, Math.round(params.engineeringCostCOP));
  const engineeringIva = params.chargeIva
    ? Math.round(engineeringSale * IVA_RATE)
    : 0;

  const overheadCOP = Math.round(
    equipmentSale * (Math.max(0, params.overheadPercent) / 100)
  );

  const ivaCOP = equipmentIva + engineeringIva + labor.ivaCOP;
  const saleSubtotalCOP = equipmentSale + engineeringSale + labor.saleCOP;
  const totalCapexCOP = saleSubtotalCOP + ivaCOP;
  const marginCOP = Math.max(
    0,
    saleSubtotalCOP - equipmentCost - engineeringCost - labor.costCOP - overheadCOP
  );

  const totalInternalCost =
    equipmentCost + engineeringCost + labor.costCOP + overheadCOP;
  const targetNet =
    params.targetNetProfitCOP > 0
      ? params.targetNetProfitCOP
      : Math.round(totalInternalCost * 0.12);

  const pl = calculateProjectPL({
    saleEquipmentCOP: equipmentSale,
    costEquipmentCOP: equipmentCost,
    saleEngineeringCOP: engineeringSale,
    costEngineeringCOP: engineeringCost,
    saleLaborCOP: labor.saleCOP,
    costLaborCOP: labor.costCOP,
    overheadCOP,
    ivaCOP,
    targetNetProfitCOP: targetNet,
    clientWithholds: params.clientWithholds,
    clientGranContribuyente: params.clientGranContribuyente,
    config: params.taxConfig,
  });

  const LINE_TACTIC_KEY: Record<string, string> = {
    panels: "panel",
    inverters: "inverter",
    batteries: "battery",
    structure: "structure",
    cabling: "cabling",
    "prot-dc": "protection",
    "prot-ac": "protection",
  };

  const tactics = buildMarginTactics([
    ...lines.map((l) => ({
      key: LINE_TACTIC_KEY[l.key] ?? l.key,
      marginPercent: l.marginPercent,
    })),
    {
      key: "engineering",
      marginPercent:
        engineeringSale > 0
          ? ((engineeringSale - engineeringCost) / engineeringSale) * 100
          : 0,
    },
    {
      key: "labor",
      marginPercent:
        labor.saleCOP > 0
          ? ((labor.saleCOP - labor.costCOP) / labor.saleCOP) * 100
          : 0,
    },
  ]);

  const performanceRatio = 0.8;
  const annualGenerationKWh = Math.round(
    params.systemKwp * params.peakSunHours * 365 * performanceRatio
  );

  return {
    lines,
    hardCostCOP: equipmentCost,
    softCostCOP: overheadCOP,
    overheadCOP,
    marginCOP,
    saleSubtotalCOP,
    ivaCOP,
    totalCapexCOP,
    annualGenerationKWh,
    moduleCount: q.panels,
    inverterCount: q.inverters,
    batteryCount: q.batteries,
    labor,
    pl,
    tactics,
  };
}
