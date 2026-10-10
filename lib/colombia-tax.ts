/**
 * Impuestos y prestaciones Colombia — parámetros editables.
 * ICA es municipal (cambia por ciudad). ReteFuente / ReteICA / ReteIVA
 * son retenciones de caja, no un impuesto extra sobre la utilidad.
 */

export type ArlClass = "I" | "II" | "III" | "IV" | "V";

export interface ColombiaTaxConfig {
  /** Salario mínimo mensual legal vigente */
  smmlvCOP: number;
  /** Auxilio de transporte vigente */
  auxilioTransporteCOP: number;
  /** ICA comercio (equipos) en por mil, ej. 4.14 = 4.14‰ */
  icaComercioPerMil: number;
  /** ICA servicios (ingeniería + instalacion) en por mil */
  icaServiciosPerMil: number;
  /** % del ICA que el cliente retiene (100 = retiene todo el ICA) */
  reteIcaOfIcaPercent: number;
  reteFuenteBienesPercent: number;
  reteFuenteServiciosPercent: number;
  reteIvaPercent: number;
  /** Impuesto de renta de sociedades */
  rentaPercent: number;
  arlClass: ArlClass;
  /** Art. 114-1: exoneración salud, SENA e ICBF si salario < 10 SMMLV */
  applyExoneracion114: boolean;
  cityPreset: string;
}

export const ARL_RATES: Record<ArlClass, number> = {
  I: 0.00522,
  II: 0.01044,
  III: 0.02436,
  IV: 0.0435,
  V: 0.0696,
};

/** Prestaciones sociales de ley (contrato laboral) */
export const PRESTACIONES = {
  cesantias: 0.0833,
  interesesCesantias: 0.01,
  prima: 0.0833,
  vacaciones: 0.0417,
};

export const APORTES = {
  caja: 0.04,
  sena: 0.02,
  icbf: 0.03,
  salud: 0.085,
  pension: 0.12,
};

export const CITY_ICA_PRESETS: Record<
  string,
  { comercio: number; servicios: number; reteIcaOfIca: number }
> = {
  Bogotá: { comercio: 4.14, servicios: 9.66, reteIcaOfIca: 100 },
  Bogota: { comercio: 4.14, servicios: 9.66, reteIcaOfIca: 100 },
  Medellín: { comercio: 5.0, servicios: 10.0, reteIcaOfIca: 100 },
  Medellin: { comercio: 5.0, servicios: 10.0, reteIcaOfIca: 100 },
  Cali: { comercio: 5.0, servicios: 11.04, reteIcaOfIca: 100 },
  Barranquilla: { comercio: 7.0, servicios: 10.0, reteIcaOfIca: 80 },
  Bucaramanga: { comercio: 7.0, servicios: 10.0, reteIcaOfIca: 80 },
};

export const DEFAULT_TAX_CONFIG: ColombiaTaxConfig = {
  smmlvCOP: 1_423_500,
  auxilioTransporteCOP: 200_000,
  icaComercioPerMil: 4.14,
  icaServiciosPerMil: 9.66,
  reteIcaOfIcaPercent: 100,
  reteFuenteBienesPercent: 2.5,
  reteFuenteServiciosPercent: 4,
  reteIvaPercent: 15,
  rentaPercent: 35,
  arlClass: "IV",
  applyExoneracion114: true,
  cityPreset: "Bogotá",
};

const TAX_KEY = "genera.tax-config.v1";

export function loadTaxConfig(): ColombiaTaxConfig {
  if (typeof window === "undefined") return DEFAULT_TAX_CONFIG;
  try {
    const raw = localStorage.getItem(TAX_KEY);
    if (!raw) return DEFAULT_TAX_CONFIG;
    return { ...DEFAULT_TAX_CONFIG, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_TAX_CONFIG;
  }
}

export function saveTaxConfig(config: ColombiaTaxConfig): void {
  localStorage.setItem(TAX_KEY, JSON.stringify(config));
}

export function applyCityPreset(
  config: ColombiaTaxConfig,
  city: string
): ColombiaTaxConfig {
  const key = Object.keys(CITY_ICA_PRESETS).find(
    (k) => k.toLowerCase() === city.trim().toLowerCase()
  );
  if (!key) return config;
  const p = CITY_ICA_PRESETS[key];
  return {
    ...config,
    cityPreset: key,
    icaComercioPerMil: p.comercio,
    icaServiciosPerMil: p.servicios,
    reteIcaOfIcaPercent: p.reteIcaOfIca,
  };
}

export function prestacionesRate(): number {
  return (
    PRESTACIONES.cesantias +
    PRESTACIONES.interesesCesantias +
    PRESTACIONES.prima +
    PRESTACIONES.vacaciones
  );
}

export function aportesRate(config: ColombiaTaxConfig): number {
  const arl = ARL_RATES[config.arlClass] ?? ARL_RATES.IV;
  let rate = APORTES.pension + APORTES.caja + arl;
  if (!config.applyExoneracion114) {
    rate += APORTES.salud + APORTES.sena + APORTES.icbf;
  }
  return rate;
}

/** Factor sobre el salario bruto (prestaciones + aportes empleador). */
export function laborLoadedFactor(config: ColombiaTaxConfig): number {
  return 1 + prestacionesRate() + aportesRate(config);
}

export interface LaborCostResult {
  technicians: number;
  days: number;
  dailyWageCOP: number;
  salaryBaseCOP: number;
  auxilioCOP: number;
  prestacionesCOP: number;
  aportesCOP: number;
  factor: number;
  costCOP: number;
  saleCOP: number;
  ivaCOP: number;
  underTwoSmmlv: boolean;
}

export function calculateLaborCost(opts: {
  technicians: number;
  days: number;
  dailyWageCOP: number;
  laborSaleCOP: number;
  laborMarginPercent: number;
  chargeIva: boolean;
  config: ColombiaTaxConfig;
}): LaborCostResult {
  const technicians = Math.max(0, opts.technicians);
  const days = Math.max(0, opts.days);
  const daily = Math.max(0, opts.dailyWageCOP);
  const salaryBaseCOP = Math.round(technicians * days * daily);
  const monthlyEquiv = daily * 30;
  const underTwoSmmlv = monthlyEquiv > 0 && monthlyEquiv <= opts.config.smmlvCOP * 2;
  const auxilioDay = opts.config.auxilioTransporteCOP / 30;
  const auxilioCOP = underTwoSmmlv
    ? Math.round(technicians * days * auxilioDay)
    : 0;
  const factor = laborLoadedFactor(opts.config);
  const prestacionesCOP = Math.round(salaryBaseCOP * prestacionesRate());
  const aportesCOP = Math.round(salaryBaseCOP * aportesRate(opts.config));
  const costCOP = Math.round(salaryBaseCOP * factor) + auxilioCOP;
  const saleCOP =
    opts.laborSaleCOP > 0
      ? Math.round(opts.laborSaleCOP)
      : Math.round(costCOP * (1 + Math.max(0, opts.laborMarginPercent) / 100));
  const ivaCOP = opts.chargeIva ? Math.round(saleCOP * 0.19) : 0;
  return {
    technicians,
    days,
    dailyWageCOP: daily,
    salaryBaseCOP,
    auxilioCOP,
    prestacionesCOP,
    aportesCOP,
    factor,
    costCOP,
    saleCOP,
    ivaCOP,
    underTwoSmmlv,
  };
}

export interface ProjectTaxes {
  baseBienesCOP: number;
  baseServiciosCOP: number;
  icaBienesCOP: number;
  icaServiciosCOP: number;
  icaCOP: number;
  reteIcaCOP: number;
  reteFuenteBienesCOP: number;
  reteFuenteServiciosCOP: number;
  reteFuenteCOP: number;
  reteIvaCOP: number;
  withholdingsCOP: number;
  rentaCOP: number;
}

export interface ProjectPL {
  saleEquipmentCOP: number;
  saleEngineeringCOP: number;
  saleLaborCOP: number;
  saleNetCOP: number;
  ivaCOP: number;
  totalClientCOP: number;
  costEquipmentCOP: number;
  costEngineeringCOP: number;
  costLaborCOP: number;
  overheadCOP: number;
  totalCostCOP: number;
  grossProfitCOP: number;
  taxes: ProjectTaxes;
  profitBeforeRentaCOP: number;
  netProfitCOP: number;
  netMarginPercent: number;
  cashFromClientCOP: number;
  cashAfterCostsCOP: number;
  minSaleForTargetNetCOP: number;
}

export function calculateProjectPL(opts: {
  saleEquipmentCOP: number;
  costEquipmentCOP: number;
  saleEngineeringCOP: number;
  costEngineeringCOP: number;
  saleLaborCOP: number;
  costLaborCOP: number;
  overheadCOP: number;
  ivaCOP: number;
  targetNetProfitCOP: number;
  clientWithholds: boolean;
  clientGranContribuyente: boolean;
  config: ColombiaTaxConfig;
}): ProjectPL {
  const saleEquipmentCOP = Math.max(0, opts.saleEquipmentCOP);
  const saleEngineeringCOP = Math.max(0, opts.saleEngineeringCOP);
  const saleLaborCOP = Math.max(0, opts.saleLaborCOP);
  const saleNetCOP = saleEquipmentCOP + saleEngineeringCOP + saleLaborCOP;
  const totalCostCOP =
    Math.max(0, opts.costEquipmentCOP) +
    Math.max(0, opts.costEngineeringCOP) +
    Math.max(0, opts.costLaborCOP) +
    Math.max(0, opts.overheadCOP);
  const ivaCOP = Math.max(0, opts.ivaCOP);
  const totalClientCOP = saleNetCOP + ivaCOP;

  const icaBienesCOP = Math.round(
    saleEquipmentCOP * (opts.config.icaComercioPerMil / 1000)
  );
  const icaServiciosCOP = Math.round(
    (saleEngineeringCOP + saleLaborCOP) * (opts.config.icaServiciosPerMil / 1000)
  );
  const icaCOP = icaBienesCOP + icaServiciosCOP;

  const reteIcaCOP = opts.clientWithholds
    ? Math.round(icaCOP * (opts.config.reteIcaOfIcaPercent / 100))
    : 0;
  const reteFuenteBienesCOP = opts.clientWithholds
    ? Math.round(saleEquipmentCOP * (opts.config.reteFuenteBienesPercent / 100))
    : 0;
  const reteFuenteServiciosCOP = opts.clientWithholds
    ? Math.round(
        (saleEngineeringCOP + saleLaborCOP) *
          (opts.config.reteFuenteServiciosPercent / 100)
      )
    : 0;
  const reteFuenteCOP = reteFuenteBienesCOP + reteFuenteServiciosCOP;
  const reteIvaCOP =
    opts.clientWithholds && opts.clientGranContribuyente
      ? Math.round(ivaCOP * (opts.config.reteIvaPercent / 100))
      : 0;
  const withholdingsCOP = reteIcaCOP + reteFuenteCOP + reteIvaCOP;

  const grossProfitCOP = saleNetCOP - totalCostCOP;
  const profitBeforeRentaCOP = grossProfitCOP - icaCOP;
  const rentaCOP = Math.round(
    Math.max(0, profitBeforeRentaCOP) * (opts.config.rentaPercent / 100)
  );
  const netProfitCOP = profitBeforeRentaCOP - rentaCOP;
  const netMarginPercent =
    saleNetCOP > 0 ? (netProfitCOP / saleNetCOP) * 100 : 0;

  const cashFromClientCOP = totalClientCOP - withholdingsCOP;
  const icaPorPagarCOP = Math.max(0, icaCOP - reteIcaCOP);
  const cashAfterCostsCOP =
    cashFromClientCOP - totalCostCOP - ivaCOP - icaPorPagarCOP;

  const icaRateBlended =
    saleNetCOP > 0 ? icaCOP / saleNetCOP : opts.config.icaServiciosPerMil / 1000;
  const renta = opts.config.rentaPercent / 100;
  const denom = (1 - icaRateBlended) * (1 - renta);
  const minSaleForTargetNetCOP =
    denom > 0
      ? Math.round(
          (opts.targetNetProfitCOP + totalCostCOP * (1 - renta)) / denom
        )
      : saleNetCOP;

  const taxes: ProjectTaxes = {
    baseBienesCOP: saleEquipmentCOP,
    baseServiciosCOP: saleEngineeringCOP + saleLaborCOP,
    icaBienesCOP,
    icaServiciosCOP,
    icaCOP,
    reteIcaCOP,
    reteFuenteBienesCOP,
    reteFuenteServiciosCOP,
    reteFuenteCOP,
    reteIvaCOP,
    withholdingsCOP,
    rentaCOP,
  };

  return {
    saleEquipmentCOP,
    saleEngineeringCOP,
    saleLaborCOP,
    saleNetCOP,
    ivaCOP,
    totalClientCOP,
    costEquipmentCOP: opts.costEquipmentCOP,
    costEngineeringCOP: opts.costEngineeringCOP,
    costLaborCOP: opts.costLaborCOP,
    overheadCOP: opts.overheadCOP,
    totalCostCOP,
    grossProfitCOP,
    taxes,
    profitBeforeRentaCOP,
    netProfitCOP,
    netMarginPercent,
    cashFromClientCOP,
    cashAfterCostsCOP,
    minSaleForTargetNetCOP,
  };
}

export interface MarginTactic {
  category: string;
  label: string;
  minPercent: number;
  maxPercent: number;
  currentPercent: number;
  status: "bajo" | "ok" | "alto";
  canRaise: boolean;
  advice: string;
}

const BANDS: Record<
  string,
  { label: string; min: number; max: number; raise: boolean; advice: string }
> = {
  panel: {
    label: "Paneles",
    min: 8,
    max: 15,
    raise: false,
    advice:
      "No suba agresivo: el cliente compara Wp y $/Wp. Gane volumen y cierre con Ley 1715, no con sobreprecio.",
  },
  inverter: {
    label: "Inversores",
    min: 18,
    max: 28,
    raise: true,
    advice:
      "Sí puede subir: garantía, hibridación y soporte técnico no se copian fácil. Justifique marca y servicio.",
  },
  battery: {
    label: "Baterías",
    min: 15,
    max: 25,
    raise: true,
    advice:
      "Margen medio-alto si vende respaldo y autonomía, no kWh sueltos. Cuidado con guerra de precios LiFePO4.",
  },
  structure: {
    label: "Estructuras",
    min: 25,
    max: 40,
    raise: true,
    advice:
      "Suba con confianza: es local, NSR-10 y poco comparable. El cliente no cotiza rieles aparte.",
  },
  cabling: {
    label: "Cableado",
    min: 30,
    max: 50,
    raise: true,
    advice:
      "Suba: es poco del CAPEX y crítico en RETIE. Un extra aquí casi no mueve el total.",
  },
  protection: {
    label: "Protecciones",
    min: 30,
    max: 50,
    raise: true,
    advice:
      "Suba: DPS, fusibles y tableros son seguridad. No descuente para ‘ganar’ la oferta.",
  },
  engineering: {
    label: "Ingeniería",
    min: 40,
    max: 80,
    raise: true,
    advice:
      "Aquí está el valor GENERA: memoria, UPME, RETIE, unifilar. No regale diseño si el equipo ya va apretado.",
  },
  labor: {
    label: "Cuadrilla",
    min: 20,
    max: 35,
    raise: false,
    advice:
      "No baje del costo cargado (prestaciones + ARL). Si piden descuento, recorte alcance de obra, no el jornal.",
  },
};

export function buildMarginTactics(
  lines: { key: string; marginPercent: number }[]
): MarginTactic[] {
  const merged = new Map<string, { sum: number; n: number }>();
  for (const line of lines) {
    const prev = merged.get(line.key) ?? { sum: 0, n: 0 };
    merged.set(line.key, {
      sum: prev.sum + line.marginPercent,
      n: prev.n + 1,
    });
  }
  return [...merged.entries()].map(([key, { sum, n }]) => {
    const band = BANDS[key] ?? {
      label: key,
      min: 15,
      max: 30,
      raise: false,
      advice: "Mantenga un piso del 15% sobre costo.",
    };
    const current = n ? sum / n : 0;
    let status: MarginTactic["status"] = "ok";
    if (current < band.min) status = "bajo";
    else if (current > band.max) status = "alto";
    return {
      category: key,
      label: band.label,
      minPercent: band.min,
      maxPercent: band.max,
      currentPercent: current,
      status,
      canRaise: band.raise && current < band.max,
      advice: band.advice,
    };
  });
}
