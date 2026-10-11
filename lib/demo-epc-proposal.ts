import { GENERA_BONUSES } from "@/lib/proposal-bonuses";
import { buildMonthlyEnergy } from "@/lib/monthly-energy";
import type { EpcProposal } from "@/types/proposal";

/** Réplica de la cotización histórica que Genera enviaba al cliente. */
export const DEMO_EPC_PROPOSAL: EpcProposal = {
  id: "3b0ae550-bea7-4671-a233-d368b7ae3136",
  createdAt: "2026-07-28",
  validUntilDays: 15,
  logoHeight: 80,
  companyName: "Genera Solutions SAS",
  companyTag: "COTIZACIÓN EPC · GENERA",
  clientName: "Carlos Mauricio Fuentes",
  clientCity: "Sopó",
  executionDays: 7,
  systemKwp: 10.4,
  inverterKwAc: 12,
  inverterLabel: "SUN-12K-SG01LP3-EU LV",
  panelCount: 16,
  panelWatts: 650,
  panelLabel: "Znshine Solar · ZXM7-SHLD72-650/M 650W",
  batteryKwh: 10,
  batteryLabel: "Felicity · LPBF48200 10kWh LV",
  includeBattery: true,
  mountLabel: "Techo",
  roofType:
    "Cubierta: Concreto / losa · NSR-10 · RETIE · Montaje losa/concreto — Base ajustable D y T",
  annualGenerationKWh: 17082,
  monthlyEnergy: buildMonthlyEnergy(17082, 820),
  bundles: [
    {
      index: 1,
      title: "Inversores",
      description:
        "Conversores DC/AC con MPPT. Equipos predeterminados del catálogo GENERA OS según potencia del proyecto.",
      accent: "#38bdf8",
    },
    {
      index: 2,
      title: "Paneles",
      description:
        "Módulos del inventario (estándar Znshine 650 W). Cantidad escalada por kWp instalado.",
      accent: "#fbbf24",
    },
    {
      index: 3,
      title: "Almacenamiento",
      description:
        "Baterías LiFePO4 incluidas: 1× Felicity · LPBF48200 10kWh LV. Respaldo nocturno y mayor autoconsumo.",
      detail: "1 × Felicity · LPBF48200 10kWh LV",
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
      description:
        "Rieles, clamps y soportes Clenergy (predeterminados GENERA OS). · Soporte: Techo · Cubierta: Concreto / losa · NSR-10 · RETIE · Montaje losa/concreto — Base ajustable D y T",
      accent: "#fb923c",
    },
    {
      index: 8,
      title: "Ingeniería/Legal/Logística",
      description:
        "Ingeniería, cuadrilla, transporte y trámites UPME / RETIE / Ley 1715.",
      accent: "#a78bfa",
    },
  ],
  commercialLines: [
    {
      index: 1,
      title: "Sistema de Inversión y Conversión",
      description: "1× SUN-12K-SG01LP3-EU LV · 12 kW AC · trifásico",
      qty: 1,
    },
    {
      index: 2,
      title: "Sistema de Captación Fotovoltaica (Paneles)",
      description:
        "16 módulos · 650 W c/u · 10.4 kWp DC · Znshine Solar · ZXM7-SHLD72-650/M 650W",
      qty: 16,
    },
    {
      index: 3,
      title: "Sistema de Almacenamiento de Energía",
      description: "1× Felicity · LPBF48200 10kWh LV · 10 kWh total",
      qty: 1,
    },
    {
      index: 4,
      title: "Infraestructura de Canalización y Ductería",
      description: "coraza 10 m · canaleta 2 und",
      qty: 1,
    },
    {
      index: 5,
      title: "Centro de Control y Protecciones Eléctricas",
      description: "combiner strings DC · DPS AC 1× · puesta a tierra",
      qty: 1,
    },
    {
      index: 6,
      title: "Kit de Conectividad, Cableado y Monitoreo",
      description: "AC Cable THW-LS/THHN #8 AWG · 44 m · tierra FV · 44 m",
      qty: 1,
    },
    {
      index: 7,
      title: "Soporte Estructural y Anclaje Certificado",
      description: "32× riel aluminio · 36× abrazaderas",
      qty: 1,
    },
    {
      index: 8,
      title: "Ingeniería, Gestión Legal y Logística",
      description:
        "memoria técnica · UPME · planos · cuadrilla 5 días obra · transporte materiales a obra",
      qty: 1,
    },
  ],
  subtotalCOP: 50881707,
  ivaCOP: 5863132,
  totalCOP: 56744839,
  taxes: {
    ivaRefundCOP: 5863132,
    rentaDeductionBaseCOP: 25440854,
    acceleratedDepreciationCOP: 50881707,
    annualDepreciationCOP: 16960569,
    panelsIvaExclusion: true,
  },
  payment: {
    modality: "Pago de Contado",
    advancePercent: 70,
    deliveryPercent: 30,
    advanceCOP: 39721387,
    deliveryCOP: 17023452,
  },
  annualEnergySavingsCOP: 3600000,
  year1TaxSavingsCOP: 593620,
  total25ySavingsCOP: 204393589,
  blendedAnnualSavingsCOP: 10056752,
  roiPercentage: 260.2,
  irrPercentage: 18.4,
  paybackYearsSimple: 4.56,
  npvCOP: 28511014,
  bonuses: GENERA_BONUSES,
  datasheets: [
    {
      itemId: "pane-znshine-solar-650w",
      label: "Panel 650 W",
      brand: "Znshine Solar",
      model: "ZXM7-SHLD72-650/M 650W",
    },
    {
      itemId: "inve-deye-12kw-trifasico-lv-208v-hibrido",
      label: "Inversor 12 kW",
      brand: "Deye",
      model: "SUN-12K-SG01LP3-EU LV",
    },
    {
      itemId: "batt-felicity-10kw-lv",
      label: "Batería 10 kWh",
      brand: "Felicity",
      model: "LPBF48200 10kWh LV",
    },
  ],
  toggles: {
    showTir: true,
    showRoiPayback: true,
    showDeductionLey1715: true,
    showIvaAranceles: true,
    showDepreciacion: true,
    showCharts: true,
  },
};
