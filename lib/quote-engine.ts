import {
  buildMarginTactics,
  calculateLaborCost,
  calculateProjectPL,
  type ColombiaTaxConfig,
  type LaborCostResult,
  type MarginTactic,
  type ProjectPL,
} from "@/lib/colombia-tax";
import {
  resolveEngLaborAddons,
  sumEnabledAddons,
  type AddonState,
  type ResolvedAddon,
} from "@/lib/eng-labor-addons";
import { IVA_RATE } from "@/lib/pricing";
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

export interface QuoteLineInput {
  key: string;
  itemId: string;
  qty: number;
  marginPercent: number;
  applyIva: boolean;
  costUnitCOP: number;
  label?: string;
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
  quoteLines?: QuoteLineInput[];
  inventory?: InventoryItem[];
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
  /** GHI mensual IDEAM en Wh/m²·día (ene–dic). Si existe, manda sobre HSP plano. */
  monthlyGhiWh?: number[];
  engAddons?: AddonState[];
  applyLey1715?: boolean;
  addonMarginPercent?: number;
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
  addons: ResolvedAddon[];
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

const SUGGESTED_QTY_KEYS: Record<string, keyof QuoteQuantities> = {
  panel: "panels",
  inverter: "inverters",
  microinverter: "inverters",
  structure: "structure",
  cabling: "cabling",
  protection_dc: "protectionDc",
  protection_ac: "protectionAc",
  battery: "batteries",
};

/** Updates qty on core equipment only. Extra products stay untouched. */
export function applySuggestedQuantities(
  lines: QuoteLineInput[],
  suggested: QuoteQuantities,
  opts?: { preserveKeys?: string[] }
): QuoteLineInput[] {
  const preserve = new Set(opts?.preserveKeys ?? []);
  return lines.map((line) => {
    if (preserve.has(line.key)) return line;
    const field = SUGGESTED_QTY_KEYS[line.key];
    if (!field) return line;
    return { ...line, qty: suggested[field] };
  });
}

function makeLine(
  key: string,
  item: InventoryItem,
  qty: number,
  unit: string,
  chargeIva: boolean,
  label?: string,
  overrides?: {
    marginPercent?: number;
    applyIva?: boolean;
    costUnitCOP?: number;
  }
): QuoteBreakdownLine {
  const safeQty = Math.max(0, qty);
  const costUnit = overrides?.costUnitCOP ?? item.priceCOP;
  const margin =
    overrides?.marginPercent ??
    (Number.isFinite(item.marginPercent) ? item.marginPercent : 0);
  const applyIva = overrides?.applyIva ?? Boolean(item.applyIva);
  const saleUnit = Math.round(costUnit * (1 + margin / 100));
  const ivaUnit =
    chargeIva && applyIva ? Math.round(saleUnit * IVA_RATE) : 0;
  const costTotal = Math.round(costUnit * safeQty);
  const saleTotal = Math.round(saleUnit * safeQty);
  const ivaTotal = Math.round(ivaUnit * safeQty);
  return {
    key,
    label: label ?? `${item.brand} ${item.model || item.name}`,
    qty: safeQty,
    unit,
    costUnitCOP: costUnit,
    marginPercent: margin,
    saleUnitCOP: saleUnit,
    ivaUnitCOP: ivaUnit,
    costTotalCOP: costTotal,
    saleTotalCOP: saleTotal,
    ivaTotalCOP: ivaTotal,
    profitCOP: saleTotal - costTotal,
    applyIva: applyIva && chargeIva,
    unitPriceCOP: saleUnit,
    totalCOP: saleTotal,
  };
}

export function lineFromItem(
  key: string,
  item: InventoryItem,
  qty: number
): QuoteLineInput {
  return {
    key,
    itemId: item.id,
    qty,
    marginPercent: item.marginPercent ?? 0,
    applyIva: item.applyIva ?? item.category !== "panel",
    costUnitCOP: item.priceCOP,
    label: `${item.brand} ${item.model || item.name}`.trim(),
  };
}

export function selectionFromLines(
  lines: QuoteLineInput[],
  inventory: InventoryItem[]
): QuoteEquipmentSelection {
  const findCat = (cat: string) => {
    const line = lines.find((l) => {
      const it = inventory.find((i) => i.id === l.itemId);
      return it?.category === cat;
    });
    return inventory.find((i) => i.id === line?.itemId) ?? null;
  };
  return {
    panel: findCat("panel"),
    inverter: findCat("inverter") ?? findCat("microinverter"),
    battery: findCat("battery"),
    structure: findCat("structure"),
    cabling: findCat("cabling"),
    protectionDc: findCat("protection_dc"),
    protectionAc: findCat("protection_ac"),
  };
}

export function calculateParametricQuote(params: QuoteParams): QuoteBreakdown {
  const { selection, quantities: q, chargeIva } = params;
  const lines: QuoteBreakdownLine[] = [];

  if (params.quoteLines?.length) {
    for (const slot of params.quoteLines) {
      if (slot.qty <= 0) continue;
      const item = params.inventory?.find((i) => i.id === slot.itemId);
      const stub: InventoryItem = item ?? {
        id: slot.itemId,
        category: "panel",
        name: slot.label || slot.key,
        brand: "GENERA",
        model: slot.label || slot.key,
        priceCOP: slot.costUnitCOP,
        priceUSD: 0,
        marginPercent: slot.marginPercent,
        applyIva: slot.applyIva,
        unit: "unidad",
        isDefault: false,
        active: true,
        updatedAt: new Date().toISOString(),
      };
      lines.push(
        makeLine(
          slot.key,
          stub,
          slot.qty,
          item?.unit || "unidad",
          chargeIva,
          slot.label ||
            (item?.category === "structure"
              ? `${item.name} (${params.mount})`
              : undefined),
          {
            marginPercent: slot.marginPercent,
            applyIva: slot.applyIva,
            costUnitCOP: slot.costUnitCOP,
          }
        )
      );
    }
  } else {
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

  const addons = resolveEngLaborAddons(params.engAddons, {
    systemKwp: params.systemKwp,
    technicians: params.technicians,
    days: params.laborDays,
    dailyWageCOP: params.dailyWageCOP,
    mount: params.mount,
    applyLey1715: Boolean(params.applyLey1715),
    equipmentSaleCOP: equipmentSale,
    marginPercent: params.addonMarginPercent ?? params.laborMarginPercent ?? 35,
  });
  const engAdd = sumEnabledAddons(addons, "engineering");
  const siteAdd = sumEnabledAddons(addons, "site");

  const engineeringSale =
    Math.max(0, Math.round(params.engineeringSaleCOP)) + engAdd.sale;
  const engineeringCost =
    Math.max(0, Math.round(params.engineeringCostCOP)) + engAdd.cost;
  const laborSale = labor.saleCOP + siteAdd.sale;
  const laborCost = labor.costCOP + siteAdd.cost;
  const engineeringIva = params.chargeIva
    ? Math.round(engineeringSale * IVA_RATE)
    : 0;
  const laborIva = params.chargeIva
    ? labor.ivaCOP + Math.round(siteAdd.sale * IVA_RATE)
    : 0;

  const overheadCOP = Math.round(
    equipmentSale * (Math.max(0, params.overheadPercent) / 100)
  );

  const ivaCOP = equipmentIva + engineeringIva + laborIva;
  const saleSubtotalCOP = equipmentSale + engineeringSale + laborSale;
  const totalCapexCOP = saleSubtotalCOP + ivaCOP;
  const marginCOP = Math.max(
    0,
    saleSubtotalCOP - equipmentCost - engineeringCost - laborCost - overheadCOP
  );

  const totalInternalCost =
    equipmentCost + engineeringCost + laborCost + overheadCOP;
  const targetNet =
    params.targetNetProfitCOP > 0
      ? params.targetNetProfitCOP
      : Math.round(totalInternalCost * 0.12);

  const pl = calculateProjectPL({
    saleEquipmentCOP: equipmentSale,
    costEquipmentCOP: equipmentCost,
    saleEngineeringCOP: engineeringSale,
    costEngineeringCOP: engineeringCost,
    saleLaborCOP: laborSale,
    costLaborCOP: laborCost,
    overheadCOP,
    ivaCOP,
    targetNetProfitCOP: targetNet,
    clientWithholds: params.clientWithholds,
    clientGranContribuyente: params.clientGranContribuyente,
    config: params.taxConfig,
  });

  const LINE_TACTIC_KEY: Record<string, string> = {
    panels: "panel",
    panel: "panel",
    inverters: "inverter",
    inverter: "inverter",
    batteries: "battery",
    battery: "battery",
    structure: "structure",
    cabling: "cabling",
    "prot-dc": "protection",
    "prot-ac": "protection",
    protection_dc: "protection",
    protection_ac: "protection",
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
        laborSale > 0 ? ((laborSale - laborCost) / laborSale) * 100 : 0,
    },
  ]);

  const performanceRatio = 0.8;
  const annualGenerationKWh = params.monthlyGhiWh?.length === 12
    ? Math.round(
        params.monthlyGhiWh.reduce((acc, wh, i) => {
          const days = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][i];
          return acc + params.systemKwp * (wh / 1000) * days * performanceRatio;
        }, 0)
      )
    : Math.round(
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
    moduleCount:
      params.quoteLines?.find((l) => l.key === "panel")?.qty ?? q.panels,
    inverterCount:
      params.quoteLines?.find((l) => l.key === "inverter" || l.key === "microinverter")
        ?.qty ?? q.inverters,
    batteryCount:
      params.quoteLines?.find((l) => l.key === "battery")?.qty ?? q.batteries,
    labor,
    addons,
    pl,
    tactics,
  };
}
