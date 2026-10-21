import { bonusesFromIds } from "@/lib/proposal-bonuses";
import { buildMonthlyEnergy } from "@/lib/monthly-energy";
import { buildPaymentSchedule, type PaymentInput } from "@/lib/payment-schedule";
import type { QuoteBreakdown, QuoteEquipmentSelection } from "@/lib/quote-engine";
import { cloneWarranties, type SystemWarranties } from "@/lib/warranties";
import type { PaymentKind } from "@/types/proposal";
import {
  ColombiaSolarFinancials,
  type SolarProjectInput,
} from "@/types/financials";
import type {
  CommercialLine,
  EpcProposal,
  ProposalToggles,
  TechnicalBundle,
} from "@/types/proposal";

export interface BuildProposalInput {
  id?: string;
  clientName: string;
  clientCity: string;
  clientEmail?: string;
  clientPhone?: string;
  clientAddress?: string;
  clientNit?: string;
  clientDv?: string;
  withholdingsNote?: string;
  systemKwp: number;
  peakSunHours: number;
  energyTariffCOP: number;
  monthlyConsumptionKWh: number;
  includeBattery: boolean;
  batteryKwh: number;
  mount: "cubierta" | "suelo" | "pergola";
  executionDays: number;
  validUntilDays: number;
  issuedAt?: string;
  siteImageDataUrl?: string;
  logoHeight?: number;
  partnerLogoDataUrl?: string;
  companyName?: string;
  companyTag?: string;
  paymentKind?: PaymentKind;
  twoStartPercent?: number;
  threeStartPercent?: number;
  threeEquipmentPercent?: number;
  financedPercent?: number;
  financedMonths?: number;
  financedEaPercent?: number;
  ppaYears?: number;
  ppaPricePerKWhCOP?: number;
  advancePercent: number;
  siteLat?: number;
  siteLon?: number;
  monthlyGhiWh?: number[];
  ideamStationName?: string;
  ideamDistanceKm?: number;
  quote: QuoteBreakdown;
  selection: QuoteEquipmentSelection;
  toggles: ProposalToggles;
  applyLey1715: boolean;
  warranties?: SystemWarranties;
  bonusIds?: string[];
}

const MOUNT_COPY = {
  cubierta: {
    label: "Techo",
    roof: "Concreto / losa · NSR-10 · RETIE · Montaje losa/concreto",
  },
  suelo: {
    label: "Suelo",
    roof: "Estructura monoposte · NSR-10 · RETIE",
  },
  pergola: {
    label: "Pérgola",
    roof: "Pérgola arquitectónica · NSR-10 · RETIE",
  },
};

export function buildEpcProposal(input: BuildProposalInput): EpcProposal {
  const {
    quote,
    selection,
    systemKwp,
    includeBattery,
    batteryKwh,
    energyTariffCOP,
    applyLey1715,
    toggles,
  } = input;

  const panelWatts = selection.panel?.capacity ?? 570;
  const inverterKw = (selection.inverter?.capacity ?? 0) * quote.inverterCount;
  const inverterKwAc = inverterKw || Math.round(systemKwp);
  const batteryTotalKwh = includeBattery
    ? Math.round(
        (selection.battery?.capacity ?? batteryKwh) * Math.max(quote.batteryCount, 1)
      )
    : 0;

  const ivaCOP = quote.ivaCOP;
  const subtotalCOP = quote.saleSubtotalCOP;
  const totalCOP = quote.totalCapexCOP;

  const financialInput: SolarProjectInput = {
    systemCostCOP: totalCOP,
    annualGenerationKWh: quote.annualGenerationKWh,
    currentEnergyTariffCOP: energyTariffCOP,
    energyTariffInflation: 0.05,
    degradationRate: 0.005,
    omCostAnnualCOP: Math.round(totalCOP * 0.01),
    omInflation: 0.04,
    discountRate: 0.12,
    projectLifespanYears: 25,
    companyTaxRate: 0.35,
    applyTaxDeduction: applyLey1715 && toggles.showDeductionLey1715,
    deductionYears: 15,
    applyAcceleratedDepreciation: applyLey1715 && toggles.showDepreciacion,
    depreciationYears: 3,
  };
  const metrics = ColombiaSolarFinancials.calculate(financialInput);
  const year1 = metrics.cashFlows.find((c) => c.year === 1);

  const annualEnergySavingsCOP = year1?.energySavingsCOP ?? 0;
  const year1TaxSavingsCOP = year1?.taxBenefitsCOP ?? 0;
  const total25ySavingsCOP = metrics.cashFlows
    .slice(1)
    .reduce((acc, c) => acc + c.energySavingsCOP + c.taxBenefitsCOP, 0);
  const blendedAnnualSavingsCOP = Math.round(total25ySavingsCOP / 25);

  const paymentInput: PaymentInput = {
    kind: input.paymentKind ?? "two_shot",
    totalCOP,
    annualGenerationKWh: quote.annualGenerationKWh,
    twoStartPercent: input.twoStartPercent ?? input.advancePercent,
    threeStartPercent: input.threeStartPercent ?? 40,
    threeEquipmentPercent: input.threeEquipmentPercent ?? 40,
    financedPercent: input.financedPercent ?? 100,
    financedMonths: input.financedMonths ?? 36,
    financedEaPercent: input.financedEaPercent ?? 18,
    ppaYears: input.ppaYears ?? 15,
    ppaPricePerKWhCOP: input.ppaPricePerKWhCOP ?? energyTariffCOP,
  };
  const payment = buildPaymentSchedule(paymentInput);

  const panelLabel = selection.panel
    ? `${selection.panel.brand} · ${selection.panel.model}`
    : "Módulos FV catálogo Genera Solutions SAS";
  const inverterLabel = selection.inverter
    ? `${selection.inverter.model}`
    : "Inversor catálogo Genera Solutions SAS";
  const batteryLabel = selection.battery
    ? `${selection.battery.brand} · ${selection.battery.model}`
    : "BESS catálogo Genera Solutions SAS";

  const bundles = buildBundles({
    includeBattery,
    batteryCount: quote.batteryCount,
    batteryLabel,
    panelLabel,
    panelWatts,
    moduleCount: quote.moduleCount,
    inverterLabel,
    inverterKwAc,
    mount: input.mount,
    mountCopy: MOUNT_COPY[input.mount],
  });

  const commercialLines = buildCommercialLines(input, inverterKwAc, batteryTotalKwh);

  return {
    id: input.id ?? crypto.randomUUID(),
    kind: "epc",
    createdAt: (input.issuedAt || new Date().toLocaleDateString("en-CA")).slice(
      0,
      10
    ),
    validUntilDays: Math.min(45, Math.max(1, input.validUntilDays)),
    siteImageDataUrl: input.siteImageDataUrl,
    logoHeight: input.logoHeight ?? 80,
    partnerLogoDataUrl: input.partnerLogoDataUrl,
    companyName: input.companyName?.trim() || "Genera Solutions SAS",
    companyTag:
      input.companyTag?.trim() ||
      (input.companyName?.trim()
        ? `COTIZACIÓN · ${input.companyName.trim().toUpperCase()}`
        : "COTIZACIÓN EPC · Genera Solutions SAS"),
    clientName: input.clientName.trim() || "Cliente",
    clientCity: input.clientCity.trim() || "Colombia",
    clientEmail: input.clientEmail?.trim() || "",
    clientPhone: input.clientPhone?.trim() || "",
    clientAddress: input.clientAddress?.trim() || "",
    clientNit: input.clientNit?.trim() || "",
    clientDv: input.clientDv?.trim() || "",
    withholdingsNote: input.withholdingsNote,
    executionDays: input.executionDays,
    systemKwp,
    inverterKwAc,
    inverterLabel,
    panelCount: quote.moduleCount,
    panelWatts,
    panelLabel,
    batteryKwh: batteryTotalKwh,
    batteryLabel,
    includeBattery,
    mountLabel: MOUNT_COPY[input.mount].label,
    roofType: MOUNT_COPY[input.mount].roof,
    annualGenerationKWh: quote.annualGenerationKWh,
    peakSunHours: input.peakSunHours,
    siteLat: input.siteLat,
    siteLon: input.siteLon,
    ideamStationName: input.ideamStationName,
    ideamDistanceKm: input.ideamDistanceKm,
    monthlyEnergy: buildMonthlyEnergy(
      quote.annualGenerationKWh,
      input.monthlyConsumptionKWh,
      input.monthlyGhiWh,
      systemKwp
    ),
    bundles,
    commercialLines,
    subtotalCOP,
    ivaCOP,
    totalCOP,
    taxes: {
      ivaRefundCOP: toggles.showIvaAranceles ? ivaCOP : 0,
      rentaDeductionBaseCOP: Math.round(subtotalCOP * 0.5),
      acceleratedDepreciationCOP: subtotalCOP,
      annualDepreciationCOP: Math.round(subtotalCOP / 3),
      panelsIvaExclusion: true,
    },
    payment,
    annualEnergySavingsCOP,
    year1TaxSavingsCOP,
    total25ySavingsCOP,
    blendedAnnualSavingsCOP,
    roiPercentage: metrics.roiPercentage,
    irrPercentage: metrics.irrPercentage,
    paybackYearsSimple: metrics.paybackYearsSimple,
    npvCOP: metrics.npvCOP,
    bonuses: bonusesFromIds(input.bonusIds),
    toggles,
    warranties: cloneWarranties(input.warranties),
    datasheets: buildDatasheets(selection, includeBattery),
  };
}

function buildDatasheets(
  selection: QuoteEquipmentSelection,
  includeBattery: boolean
) {
  const items = [
    selection.panel,
    selection.inverter,
    includeBattery ? selection.battery : null,
    selection.structure,
    selection.cabling,
    selection.protectionDc,
    selection.protectionAc,
  ].filter(Boolean);

  return items.map((item) => ({
    itemId: item!.id,
    label: item!.name,
    brand: item!.brand,
    model: item!.model,
    datasheetUrl: item!.datasheetUrl,
  }));
}

function buildBundles(opts: {
  includeBattery: boolean;
  batteryCount: number;
  batteryLabel: string;
  panelLabel: string;
  panelWatts: number;
  moduleCount: number;
  inverterLabel: string;
  inverterKwAc: number;
  mount: string;
  mountCopy: { label: string; roof: string };
}): TechnicalBundle[] {
  return [
    {
      index: 1,
      title: "Inversores",
      description:
        "Conversores DC/AC con MPPT. Equipos predeterminados del catálogo de Genera Solutions SAS según potencia del proyecto.",
      accent: "#38bdf8",
    },
    {
      index: 2,
      title: "Paneles",
      description: `Módulos del inventario (${opts.panelLabel}). Cantidad escalada por kWp instalado.`,
      accent: "#fbbf24",
    },
    {
      index: 3,
      title: "Almacenamiento",
      description: opts.includeBattery
        ? `Baterías LiFePO4 incluidas: ${opts.batteryCount}× ${opts.batteryLabel}. Respaldo nocturno y mayor autoconsumo.`
        : "Sin banco de baterías en este alcance. El sistema opera en autoconsumo e inyección de excedentes.",
      detail: opts.includeBattery
        ? `${opts.batteryCount} × ${opts.batteryLabel}`
        : undefined,
      accent: "#c084fc",
    },
    {
      index: 4,
      title: "Canalización",
      description:
        "Cable solar, bandeja y conduit según ítems predeterminados Suntree / catálogo.",
      accent: "#22d3ee",
    },
    {
      index: 5,
      title: "Protecciones",
      description:
        "Fusibles, DPS, MC4 y combiner del inventario — conforme NTC 2050.",
      accent: "#fb7185",
    },
    {
      index: 6,
      title: "Conectividad/Monitoreo",
      description: "Monitoreo en nube, DTU/gateway y portal del cliente.",
      accent: "#34d399",
    },
    {
      index: 7,
      title: "Estructura",
      description: `Rieles, clamps y soportes (predeterminados Genera Solutions SAS). · Soporte: ${opts.mountCopy.label} · ${opts.mountCopy.roof}`,
      accent: "#fb923c",
    },
    {
      index: 8,
      title: "Ingeniería/Legal/Logística",
      description:
        "Ingeniería, cuadrilla, transporte y trámites UPME / RETIE / Ley 1715.",
      accent: "#a78bfa",
    },
  ];
}

function buildCommercialLines(
  input: BuildProposalInput,
  inverterKwAc: number,
  batteryKwh: number
): CommercialLine[] {
  const { quote, selection, includeBattery } = input;
  const inv = selection.inverter;
  const panel = selection.panel;
  const bat = selection.battery;

  return [
    {
      index: 1,
      title: "Sistema de Inversión y Conversión",
      description: inv
        ? `${quote.inverterCount}× ${inv.model} · ${inverterKwAc} kW AC`
        : `${quote.inverterCount} inversor(es) · ${inverterKwAc} kW AC`,
      qty: quote.inverterCount,
    },
    {
      index: 2,
      title: "Sistema de Captación Fotovoltaica (Paneles)",
      description: panel
        ? `${quote.moduleCount} módulos · ${panel.capacity} W c/u · ${input.systemKwp} kWp DC · ${panel.brand} · ${panel.model}`
        : `${quote.moduleCount} módulos · ${input.systemKwp} kWp DC`,
      qty: quote.moduleCount,
    },
    {
      index: 3,
      title: "Sistema de Almacenamiento de Energía",
      description: includeBattery && bat
        ? `${quote.batteryCount}× ${bat.brand} · ${bat.model} · ${batteryKwh} kWh total`
        : "No incluido en este alcance",
      qty: includeBattery ? Math.max(quote.batteryCount, 1) : 0,
    },
    {
      index: 4,
      title: "Infraestructura de Canalización y Ductería",
      description: "coraza · canaleta / conduit según metrado de obra",
      qty: 1,
    },
    {
      index: 5,
      title: "Centro de Control y Protecciones Eléctricas",
      description: "combiner strings DC · DPS AC · puesta a tierra",
      qty: 1,
    },
    {
      index: 6,
      title: "Kit de Conectividad, Cableado y Monitoreo",
      description: selection.cabling
        ? `${selection.cabling.name} · tierra FV · monitoreo en nube`
        : "Cableado AC/DC · tierra FV · monitoreo",
      qty: 1,
    },
    {
      index: 7,
      title: "Soporte Estructural y Anclaje Certificado",
      description: selection.structure
        ? `${selection.structure.name} · rieles y abrazaderas`
        : "Riel aluminio · abrazaderas · NSR-10",
      qty: 1,
    },
    {
      index: 8,
      title: "Ingeniería, Gestión Legal y Logística",
      description: (() => {
        const extras = (quote.addons ?? [])
          .filter((a) => a.enabled)
          .map((a) => a.label);
        const crew = quote.labor
          ? `cuadrilla ${quote.labor.technicians} técnicos × ${quote.labor.days} días`
          : "cuadrilla de obra";
        return extras.length
          ? `${extras.join(" · ")} · ${crew}`
          : `Ingeniería, UPME/RETIE y ${crew}`;
      })(),
      qty: 1,
    },
  ];
}
