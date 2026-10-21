import {
  calculateProjectPL,
  loadTaxConfig,
  type ColombiaTaxConfig,
  type ProjectPL,
} from "@/lib/colombia-tax";
import { saleFromCost } from "@/lib/eng-labor-addons";
import { buildPaymentSchedule } from "@/lib/payment-schedule";
import { IVA_RATE } from "@/lib/pricing";
import {
  cloneWarranties,
  type SystemWarranties,
  type WarrantyItem,
} from "@/lib/warranties";
import type { QuoteLineInput } from "@/lib/quote-engine";
import type { InventoryItem } from "@/types/inventory";
import type {
  CommercialLine,
  EpcProposal,
  EquipmentDatasheet,
  PaymentKind,
} from "@/types/proposal";

export const MAX_EQUIPMENT_LINES = 12;

export interface PricedEquipmentLine {
  key: string;
  itemId: string;
  label: string;
  brand: string;
  model: string;
  category: string;
  qty: number;
  unit: string;
  costUnitCOP: number;
  marginPercent: number;
  saleUnitCOP: number;
  saleTotalCOP: number;
  ivaUnitCOP: number;
  ivaTotalCOP: number;
  applyIva: boolean;
  datasheetUrl?: string;
}

export interface EquipmentQuoteTotals {
  lines: PricedEquipmentLine[];
  subtotalCOP: number;
  ivaCOP: number;
  totalCOP: number;
  costCOP: number;
  pl: ProjectPL;
}

export function defaultWarrantyYears(category: string): number {
  if (category === "panel") return 25;
  if (category === "inverter" || category === "microinverter") return 10;
  if (category === "battery") return 10;
  if (category === "structure") return 10;
  return 5;
}

export function warrantiesFromQuoteLines(
  lines: { key: string; itemId: string; label?: string }[],
  inventory: { id: string; category: string; name: string; brand: string; model: string }[],
  prev?: SystemWarranties | null
): SystemWarranties {
  const prevItems = prev?.items ?? [];
  const items: WarrantyItem[] = lines.map((line) => {
    const item = inventory.find((i) => i.id === line.itemId);
    const found = prevItems.find((w) => w.id === line.key);
    const label =
      found?.label ||
      line.label ||
      (item ? `${item.brand} ${item.model || item.name}`.trim() : "Equipo");
    return {
      id: line.key,
      label,
      years: found?.years ?? defaultWarrantyYears(item?.category || ""),
      detail: found?.detail ?? "fábrica",
      enabled: found?.enabled !== false,
    };
  });
  const custom = prevItems.filter((w) => w.id.startsWith("custom-"));
  return {
    items: [...items, ...custom],
    notes:
      prev?.notes ||
      "Garantías de fábrica de los equipos de esta oferta. No incluye instalación, ingeniería ni mano de obra GENERA.",
  };
}

export function warrantiesForEquipment(
  categories: string[]
): SystemWarranties {
  const w = cloneWarranties();
  const enable = new Set<string>();
  for (const c of categories) {
    if (c === "panel") {
      enable.add("panels-product");
      enable.add("panels-yield");
    }
    if (c === "inverter" || c === "microinverter") enable.add("inverters");
    if (c === "battery") enable.add("batteries");
    if (c === "structure") enable.add("structure");
  }
  return {
    ...w,
    items: w.items.map((item) => ({
      ...item,
      enabled: enable.has(item.id),
    })),
    notes:
      "Garantías de fábrica de los equipos de esta oferta. No incluye instalación, ingeniería ni mano de obra GENERA.",
  };
}

export function priceEquipmentLines(
  lines: QuoteLineInput[],
  inventory: InventoryItem[],
  chargeIva: boolean
): PricedEquipmentLine[] {
  return lines.slice(0, MAX_EQUIPMENT_LINES).map((line, i) => {
    const item = inventory.find((it) => it.id === line.itemId);
    const qty = Math.max(0, Number(line.qty) || 0);
    const cost = Math.max(0, Number(line.costUnitCOP) || 0);
    const margin = Number.isFinite(line.marginPercent) ? line.marginPercent : 0;
    const saleUnit = saleFromCost(cost, margin);
    const applyIva = Boolean(line.applyIva);
    const ivaUnit = chargeIva && applyIva ? Math.round(saleUnit * IVA_RATE) : 0;
    const label =
      line.label ||
      (item ? `${item.brand} ${item.model || item.name}`.trim() : "Equipo");
    return {
      key: line.key || `eq-${i}`,
      itemId: line.itemId,
      label,
      brand: item?.brand || "",
      model: item?.model || "",
      category: item?.category || "",
      qty,
      unit: item?.unit || "und",
      costUnitCOP: cost,
      marginPercent: margin,
      saleUnitCOP: saleUnit,
      saleTotalCOP: Math.round(saleUnit * qty),
      ivaUnitCOP: ivaUnit,
      ivaTotalCOP: Math.round(ivaUnit * qty),
      applyIva: applyIva && chargeIva,
      datasheetUrl: item?.datasheetUrl,
    };
  });
}

export function equipmentQuoteTotals(
  lines: QuoteLineInput[],
  inventory: InventoryItem[],
  opts: {
    chargeIva: boolean;
    clientWithholds: boolean;
    clientGranContribuyente: boolean;
    taxConfig?: ColombiaTaxConfig;
  }
): EquipmentQuoteTotals {
  const priced = priceEquipmentLines(lines, inventory, opts.chargeIva);
  const subtotalCOP = priced.reduce((s, l) => s + l.saleTotalCOP, 0);
  const ivaCOP = priced.reduce((s, l) => s + l.ivaTotalCOP, 0);
  const costCOP = priced.reduce((s, l) => s + Math.round(l.costUnitCOP * l.qty), 0);
  const pl = calculateProjectPL({
    saleEquipmentCOP: subtotalCOP,
    costEquipmentCOP: costCOP,
    saleEngineeringCOP: 0,
    costEngineeringCOP: 0,
    saleLaborCOP: 0,
    costLaborCOP: 0,
    overheadCOP: 0,
    ivaCOP,
    targetNetProfitCOP: 0,
    clientWithholds: opts.clientWithholds,
    clientGranContribuyente: opts.clientGranContribuyente,
    config: opts.taxConfig ?? loadTaxConfig(),
  });
  return {
    lines: priced,
    subtotalCOP,
    ivaCOP,
    totalCOP: subtotalCOP + ivaCOP,
    costCOP,
    pl,
  };
}

export function buildEquipmentProposal(input: {
  id?: string;
  issuedAt?: string;
  validUntilDays: number;
  clientName: string;
  clientCity: string;
  clientEmail?: string;
  clientPhone?: string;
  clientAddress?: string;
  clientNit?: string;
  clientDv?: string;
  withholdingsNote?: string;
  partnerLogoDataUrl?: string;
  companyName?: string;
  logoHeight?: number;
  paymentKind?: PaymentKind;
  advancePercent: number;
  totals: EquipmentQuoteTotals;
  warranties?: SystemWarranties;
  executionDays?: number;
}): EpcProposal {
  const { totals } = input;
  const first = totals.lines[0];
  const commercialLines: CommercialLine[] = totals.lines.map((line, i) => ({
    index: i + 1,
    title: line.label,
    description: [
      line.brand && line.model ? `${line.brand} · ${line.model}` : "",
      line.unit ? `Unidad: ${line.unit}` : "",
    ]
      .filter(Boolean)
      .join(" · "),
    qty: line.qty,
    unit: line.unit,
    saleUnitCOP: line.saleUnitCOP,
    saleTotalCOP: line.saleTotalCOP,
  }));
  const datasheets: EquipmentDatasheet[] = totals.lines
    .filter((l) => l.datasheetUrl)
    .map((l) => ({
      itemId: l.itemId,
      label: l.label,
      brand: l.brand,
      model: l.model,
      datasheetUrl: l.datasheetUrl,
    }));
  const payment = buildPaymentSchedule({
    kind: input.paymentKind ?? "two_shot",
    totalCOP: totals.totalCOP,
    annualGenerationKWh: 0,
    twoStartPercent: input.advancePercent,
    threeStartPercent: 40,
    threeEquipmentPercent: 40,
    financedPercent: 100,
    financedMonths: 12,
    financedEaPercent: 0,
    ppaYears: 0,
    ppaPricePerKWhCOP: 0,
  });
  if (payment.kind === "one_shot") {
    payment.modality = "1 solo contado";
    payment.installments = payment.installments.map((row) =>
      row.key === "full"
        ? {
            ...row,
            label: "1 solo contado",
            hint: "Pago único para confirmar y despachar el pedido",
          }
        : row
    );
  }
  if (payment.kind === "two_shot") {
    payment.installments = payment.installments.map((row) =>
      row.key === "start"
        ? { ...row, hint: "Anticipo para confirmar el pedido" }
        : row.key === "end"
          ? {
              ...row,
              label: "Despacho",
              hint: "Contra despacho de los equipos",
            }
          : row
    );
  }

  const categories = totals.lines.map((l) => l.category);
  const includeBattery = categories.includes("battery");

  return {
    id: input.id ?? crypto.randomUUID(),
    kind: "equipos",
    createdAt: (input.issuedAt || new Date().toLocaleDateString("en-CA")).slice(
      0,
      10
    ),
    validUntilDays: Math.min(45, Math.max(1, input.validUntilDays)),
    logoHeight: input.logoHeight ?? 80,
    partnerLogoDataUrl: input.partnerLogoDataUrl,
    companyName: input.companyName?.trim() || "Genera Solutions SAS",
    companyTag: "COTIZACIÓN DE EQUIPOS · GENERA",
    clientName: input.clientName.trim() || "Cliente",
    clientCity: input.clientCity.trim() || "Colombia",
    clientEmail: input.clientEmail?.trim() || "",
    clientPhone: input.clientPhone?.trim() || "",
    clientAddress: input.clientAddress?.trim() || "",
    clientNit: input.clientNit?.trim() || "",
    clientDv: input.clientDv?.trim() || "",
    withholdingsNote: input.withholdingsNote,
    executionDays: input.executionDays ?? 5,
    systemKwp: 0,
    inverterKwAc: 0,
    inverterLabel: first?.label || "—",
    panelCount: 0,
    panelWatts: 0,
    panelLabel: "—",
    batteryKwh: 0,
    batteryLabel: "—",
    includeBattery,
    mountLabel: "—",
    roofType: "Suministro de equipos. Sin instalación ni obra civil.",
    annualGenerationKWh: 0,
    monthlyEnergy: [],
    bundles: [],
    commercialLines,
    subtotalCOP: totals.subtotalCOP,
    ivaCOP: totals.ivaCOP,
    totalCOP: totals.totalCOP,
    taxes: {
      ivaRefundCOP: 0,
      rentaDeductionBaseCOP: 0,
      acceleratedDepreciationCOP: 0,
      annualDepreciationCOP: 0,
      panelsIvaExclusion: categories.includes("panel"),
    },
    payment,
    annualEnergySavingsCOP: 0,
    year1TaxSavingsCOP: 0,
    total25ySavingsCOP: 0,
    blendedAnnualSavingsCOP: 0,
    roiPercentage: 0,
    irrPercentage: 0,
    paybackYearsSimple: 0,
    npvCOP: 0,
    bonuses: [],
    toggles: {
      showTir: false,
      showRoiPayback: false,
      showDeductionLey1715: false,
      showIvaAranceles: false,
      showDepreciacion: false,
      showCharts: false,
      deliverables: {
        fichas: false,
        explicacion: false,
        manual: false,
        "primera-factura": false,
        certificado: false,
      },
    },
    warranties: input.warranties ?? warrantiesForEquipment(categories),
    datasheets,
  };
}
