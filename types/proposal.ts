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
}

export interface ProposalBonus {
  id: string;
  title: string;
  tagline: string;
  description: string;
}

export interface TaxIncentives {
  ivaRefundCOP: number;
  rentaDeductionBaseCOP: number;
  acceleratedDepreciationCOP: number;
  annualDepreciationCOP: number;
  panelsIvaExclusion: boolean;
}

export interface PaymentSchedule {
  modality: string;
  advancePercent: number;
  deliveryPercent: number;
  advanceCOP: number;
  deliveryCOP: number;
}

export interface ProposalToggles {
  showTir: boolean;
  showRoiPayback: boolean;
  showDeductionLey1715: boolean;
  showIvaAranceles: boolean;
  showDepreciacion: boolean;
  showCharts: boolean;
}

export interface EpcProposal {
  id: string;
  createdAt: string;
  validUntilDays: number;
  companyName: string;
  companyTag: string;
  clientName: string;
  clientCity: string;
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
