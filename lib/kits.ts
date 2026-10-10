import type { MountPreference, QuoteQuantities } from "@/lib/quote-engine";

export interface EquipmentKit {
  id: string;
  name: string;
  hint: string;
  systemKwp: number;
  includeBattery: boolean;
  batteryKwh: number;
  mount: MountPreference;
  peakSunHours: number;
  equipment: {
    panel?: string;
    inverter?: string;
    battery?: string;
    structure?: string;
    cabling?: string;
    protectionDc?: string;
    protectionAc?: string;
  };
  quantities?: Partial<QuoteQuantities>;
}

const KEY = "genera.kits.v1";

export const SEED_KITS: EquipmentKit[] = [
  {
    id: "kit-res-5",
    name: "Residencial 5 kWp",
    hint: "Casa · ~8 paneles 650 W · Deye 6 kW",
    systemKwp: 5.2,
    includeBattery: false,
    batteryKwh: 0,
    mount: "cubierta",
    peakSunHours: 4.5,
    equipment: {
      panel: "pane-znshine-solar-650w",
      inverter: "inve-deye-6kw-trifasico-lv-208v-hibrido",
      structure: "stru-improinde-ps-riel-4-80",
      cabling: "cabl-kibor-6mm",
      protectionDc: "prot-yro-20a-500v-2p",
      protectionAc: "prot-voltio-31a-2p",
    },
  },
  {
    id: "kit-res-10-bess",
    name: "Residencial 10 kWp + BESS",
    hint: "16 paneles · Deye 12 kW · Felicity 10 kWh",
    systemKwp: 10.4,
    includeBattery: true,
    batteryKwh: 10,
    mount: "cubierta",
    peakSunHours: 4.5,
    equipment: {
      panel: "pane-znshine-solar-650w",
      inverter: "inve-deye-12kw-trifasico-lv-208v-hibrido",
      battery: "batt-felicity-10kw-lv",
      structure: "stru-improinde-ps-riel-4-80",
      cabling: "cabl-kibor-6mm",
      protectionDc: "prot-yro-20a-500v-2p",
      protectionAc: "prot-voltio-31a-2p",
    },
  },
  {
    id: "kit-ci-50",
    name: "C&I 50 kWp",
    hint: "Comercial · Deye 30 kW HV · sin batería",
    systemKwp: 50,
    includeBattery: false,
    batteryKwh: 0,
    mount: "cubierta",
    peakSunHours: 4.5,
    equipment: {
      panel: "pane-znshine-solar-650w",
      inverter: "inve-deye-30kw-trifasico-hv-208v-hibrido",
      structure: "stru-improinde-ps-riel-4-80",
      cabling: "cabl-kibor-6mm",
      protectionDc: "prot-suntree-125a-600v-2p",
      protectionAc: "prot-voltio-63a-3p",
    },
  },
];

export function loadKits(): EquipmentKit[] {
  if (typeof window === "undefined") return SEED_KITS;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return SEED_KITS;
    const parsed = JSON.parse(raw) as EquipmentKit[];
    return parsed.length ? parsed : SEED_KITS;
  } catch {
    return SEED_KITS;
  }
}

export function saveKits(kits: EquipmentKit[]): void {
  localStorage.setItem(KEY, JSON.stringify(kits));
}
