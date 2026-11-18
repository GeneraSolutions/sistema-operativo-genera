import {
  calculateProjectPL,
  loadTaxConfig,
  type ColombiaTaxConfig,
  type ProjectPL,
} from "@/lib/colombia-tax";
import { saleFromCost } from "@/lib/eng-labor-addons";
import { buildPaymentSchedule } from "@/lib/payment-schedule";
import { cleanParticularTerms } from "@/lib/particular-terms";
import { IVA_RATE } from "@/lib/pricing";
import { lineFromItem, type QuoteLineInput } from "@/lib/quote-engine";
import { cloneWarranties, type SystemWarranties } from "@/lib/warranties";
import type { ClientIdType } from "@/lib/client-party";
import type { InventoryItem } from "@/types/inventory";
import type {
  CommercialLine,
  EpcProposal,
  ParticularTerm,
  PaymentKind,
} from "@/types/proposal";

export const MAX_SERVICE_LINES = 40;

export interface PricedServiceLine {
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
  fromInventory: boolean;
}

export interface ServiceQuoteTotals {
  lines: PricedServiceLine[];
  subtotalCOP: number;
  ivaCOP: number;
  totalCOP: number;
  costCOP: number;
  pl: ProjectPL;
}

export function blankServiceLine(label = "Nuevo ítem"): QuoteLineInput {
  return {
    key: `svc-${crypto.randomUUID().slice(0, 8)}`,
    itemId: "",
    qty: 1,
    marginPercent: 0,
    applyIva: true,
    costUnitCOP: 0,
    label,
  };
}

export function serviceLineFromInventory(
  item: InventoryItem,
  qty = 1
): QuoteLineInput {
  return lineFromItem(`svc-${crypto.randomUUID().slice(0, 8)}`, item, qty);
}

export function priceServiceLines(
  lines: QuoteLineInput[],
  inventory: InventoryItem[],
  chargeIva: boolean
): PricedServiceLine[] {
  return lines.slice(0, MAX_SERVICE_LINES).map((line, i) => {
    const item = line.itemId
      ? inventory.find((it) => it.id === line.itemId)
      : undefined;
    const qty = Math.max(0, Number(line.qty) || 0);
    const cost = Math.max(0, Number(line.costUnitCOP) || 0);
    const margin = Number.isFinite(line.marginPercent) ? line.marginPercent : 0;
    const saleUnit = saleFromCost(cost, margin);
    const applyIva = Boolean(line.applyIva);
    const ivaUnit = chargeIva && applyIva ? Math.round(saleUnit * IVA_RATE) : 0;
    const label =
      line.label?.trim() ||
      (item ? `${item.brand} ${item.model || item.name}`.trim() : "Ítem");
    return {
      key: line.key || `svc-${i}`,
      itemId: line.itemId || "",
      label,
      brand: item?.brand || "",
      model: item?.model || "",
      category: item?.category || "servicio",
      qty,
      unit: item?.unit || "und",
      costUnitCOP: cost,
      marginPercent: margin,
      saleUnitCOP: saleUnit,
      saleTotalCOP: Math.round(saleUnit * qty),
      ivaUnitCOP: ivaUnit,
      ivaTotalCOP: Math.round(ivaUnit * qty),
      applyIva: applyIva && chargeIva,
      fromInventory: Boolean(item),
    };
  });
}

export function serviceQuoteTotals(
  lines: QuoteLineInput[],
  inventory: InventoryItem[],
  opts: {
    chargeIva: boolean;
    clientWithholds: boolean;
    clientGranContribuyente: boolean;
    taxConfig?: ColombiaTaxConfig;
  }
): ServiceQuoteTotals {
  const priced = priceServiceLines(lines, inventory, opts.chargeIva);
  const subtotalCOP = priced.reduce((s, l) => s + l.saleTotalCOP, 0);
  const ivaCOP = priced.reduce((s, l) => s + l.ivaTotalCOP, 0);
  const costCOP = priced.reduce(
    (s, l) => s + Math.round(l.costUnitCOP * l.qty),
    0
  );
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

export function buildServiceProposal(input: {
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
  clientIdType?: ClientIdType;
  withholdingsNote?: string;
  partnerLogoDataUrl?: string;
  companyName?: string;
  logoHeight?: number;
  paymentKind?: PaymentKind;
  advancePercent: number;
  totals: ServiceQuoteTotals;
  serviceDescription?: string;
  warranties?: SystemWarranties;
  particularTerms?: ParticularTerm[];
  executionDays?: number;
}): EpcProposal {
  const { totals } = input;
  const first = totals.lines[0];
  const description = (input.serviceDescription || "").trim();
  const commercialLines: CommercialLine[] = totals.lines.map((line, i) => ({
    index: i + 1,
    title: line.label,
    description: [
      line.fromInventory && line.brand
        ? `${line.brand}${line.model ? ` · ${line.model}` : ""}`
        : "Servicio / ítem",
      line.unit ? `Unidad: ${line.unit}` : "",
    ]
      .filter(Boolean)
      .join(" · "),
    qty: line.qty,
    unit: line.unit,
    saleUnitCOP: line.saleUnitCOP,
    saleTotalCOP: line.saleTotalCOP,
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
            hint: "Pago único para confirmar el servicio",
          }
        : row
    );
  }
  if (payment.kind === "two_shot") {
    payment.installments = payment.installments.map((row) =>
      row.key === "start"
        ? { ...row, hint: "Anticipo para programar el servicio" }
        : row.key === "end"
          ? {
              ...row,
              label: "Cierre",
              hint: "Contra entrega / recepción del servicio",
            }
          : row
    );
  }

  const warranties =
    input.warranties ??
    cloneWarranties({
      items: [],
      notes:
        "Las garantías de equipos, si aplican, se detallan en los ítems del inventario incluidos. La mano de obra de Genera Solutions SAS se rige por lo pactado en esta oferta.",
    });

  return {
    id: input.id ?? crypto.randomUUID(),
    kind: "servicios",
    serviceDescription: description || undefined,
    createdAt: (input.issuedAt || new Date().toLocaleDateString("en-CA")).slice(
      0,
      10
    ),
    validUntilDays: Math.min(45, Math.max(1, input.validUntilDays)),
    logoHeight: input.logoHeight ?? 80,
    partnerLogoDataUrl: input.partnerLogoDataUrl,
    companyName: input.companyName?.trim() || "Genera Solutions SAS",
    companyTag: "COTIZACIÓN DE SERVICIOS · Genera Solutions SAS",
    clientName: input.clientName.trim() || "Cliente",
    clientCity: input.clientCity.trim() || "Colombia",
    clientEmail: input.clientEmail?.trim() || "",
    clientPhone: input.clientPhone?.trim() || "",
    clientAddress: input.clientAddress?.trim() || "",
    clientNit: input.clientNit?.trim() || "",
    clientDv: input.clientDv?.trim() || "",
    clientIdType: input.clientIdType || "nit",
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
    includeBattery: false,
    mountLabel: "—",
    roofType:
      description ||
      "Servicios e instalación según alcance descrito. Puede incluir equipos del inventario.",
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
      panelsIvaExclusion: false,
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
        contrato: false,
      },
    },
    warranties,
    particularTerms: cleanParticularTerms(input.particularTerms ?? []),
    datasheets: [],
  };
}
