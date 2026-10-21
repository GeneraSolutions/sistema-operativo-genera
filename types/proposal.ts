import type { SystemWarranties } from "@/lib/warranties";

export interface MonthlyEnergyPoint {
  month: string;
  generationKWh: number;
  consumptionKWh: number;
}

export interface TechnicalBundle {
  index: number;
  title: string;
  description: string;
  detail?: string;
  accent: string;
}

export interface CommercialLine {
  index: number;
  title: string;
  description: string;
  qty: number;
  unit?: string;
  saleUnitCOP?: number;
  saleTotalCOP?: number;
}

export interface ProposalBonus {
  id: string;
  title: string;
  tagline: string;
  description: string;
  document?: {
    slug: "explicacion" | "manual" | "primera-factura" | "certificado";
    cta: string;
    moment: "quote" | "handover";
  };
}

export interface TaxIncentives {
  ivaRefundCOP: number;
  rentaDeductionBaseCOP: number;
  acceleratedDepreciationCOP: number;
  annualDepreciationCOP: number;
  panelsIvaExclusion: boolean;
}

export type PaymentKind =
  | "one_shot"
  | "two_shot"
  | "three_shot"
  | "financed"
  | "ppa";

export interface PaymentInstallment {
  key: string;
  label: string;
  percent?: number;
  amountCOP: number;
  hint: string;
}

export interface PaymentSchedule {
  kind: PaymentKind;
  modality: string;
  summary: string;
  installments: PaymentInstallment[];
  advancePercent: number;
  deliveryPercent: number;
  advanceCOP: number;
  deliveryCOP: number;
  financedPercent?: number;
  financedMonths?: number;
  financedEaPercent?: number;
  monthlyInstallmentCOP?: number;
  downPaymentCOP?: number;
  ppaYears?: number;
  ppaPricePerKWhCOP?: number;
  ppaAnnualYear1COP?: number;
  ppaContractTotalCOP?: number;
}

export type ClientDeliverableKey =
  | "fichas"
  | "explicacion"
  | "manual"
  | "primera-factura"
  | "certificado";

export type ClientDeliverables = Record<ClientDeliverableKey, boolean>;

export interface ProposalToggles {
  showTir: boolean;
  showRoiPayback: boolean;
  showDeductionLey1715: boolean;
  showIvaAranceles: boolean;
  showDepreciacion: boolean;
  showCharts: boolean;
  /** COP/kWp de venta al cliente, no el costo. */
  showPricePerKwp?: boolean;
  /** @deprecated use deliverables */
  showDeliverables?: boolean;
  deliverables?: Partial<ClientDeliverables>;
}

export type ProposalKind = "epc" | "equipos";

export interface EpcProposal {
  id: string;
  /** epc = planta llave en mano; equipos = suministro de SKUs sin obra. */
  kind?: ProposalKind;
  createdAt: string;
  validUntilDays: number;
  siteImageDataUrl?: string;
  logoHeight?: number;
  partnerLogoDataUrl?: string;
  companyName: string;
  companyTag: string;
  clientName: string;
  clientCity: string;
  clientEmail?: string;
  clientPhone?: string;
  clientAddress?: string;
  clientNit?: string;
  clientDv?: string;
  withholdingsNote?: string;
  executionDays: number;
  systemKwp: number;
  inverterKwAc: number;
  inverterLabel: string;
  panelCount: number;
  panelWatts: number;
  panelLabel: string;
  batteryKwh: number;
  batteryLabel: string;
  includeBattery: boolean;
  mountLabel: string;
  roofType: string;
  annualGenerationKWh: number;
  peakSunHours?: number;
  siteLat?: number;
  siteLon?: number;
  ideamStationName?: string;
  ideamDistanceKm?: number;
  monthlyEnergy: MonthlyEnergyPoint[];
  bundles: TechnicalBundle[];
  commercialLines: CommercialLine[];
  subtotalCOP: number;
  ivaCOP: number;
  totalCOP: number;
  taxes: TaxIncentives;
  payment: PaymentSchedule;
  annualEnergySavingsCOP: number;
  year1TaxSavingsCOP: number;
  total25ySavingsCOP: number;
  blendedAnnualSavingsCOP: number;
  roiPercentage: number;
  irrPercentage: number;
  paybackYearsSimple: number;
  npvCOP: number;
  bonuses: ProposalBonus[];
  toggles: ProposalToggles;
  warranties: SystemWarranties;
  notes?: string;
  datasheets: EquipmentDatasheet[];
}

export interface EquipmentDatasheet {
  itemId: string;
  label: string;
  brand: string;
  model: string;
  datasheetUrl?: string;
}
