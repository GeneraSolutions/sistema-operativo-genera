export const MAX_BILL_PHOTOS = 4;

export interface EnergyBillPhoto {
  id: string;
  dataUrl: string;
}

export interface EnergyBillMonth {
  label: string;
  kwh: number;
}

export interface EnergyBill {
  photos: EnergyBillPhoto[];
  utility: string;
  operator: string;
  accountNumber: string;
  nic: string;
  niu: string;
  meterNumber: string;
  address: string;
  stratum: string;
  tensionLevel: string;
  transformerNumber: string;
  circuitNumber: string;
  demandKw: number;
  contractedLoad: string;
  consumptionKWh: number;
  average6MonthsKWh: number;
  billedDays: number;
  periodLabel: string;
  unitPriceCOPPerKWh: number;
  effectiveTariffCOPPerKWh: number;
  energyChargesCOP: number;
  demandChargeCOPPerKW: number;
  totalCOP: number;
  chargesActiveEnergy: boolean;
  chargesReactiveEnergy: boolean;
  reactiveKvarh: number;
  subsidyOrContribution: string;
  history: EnergyBillMonth[];
  extras: string;
  analyzedAt: string;
}

export function emptyEnergyBill(): EnergyBill {
  return {
    photos: [],
    utility: "",
    operator: "",
    accountNumber: "",
    nic: "",
    niu: "",
    meterNumber: "",
    address: "",
    stratum: "",
    tensionLevel: "",
    transformerNumber: "",
    circuitNumber: "",
    demandKw: 0,
    contractedLoad: "",
    consumptionKWh: 0,
    average6MonthsKWh: 0,
    billedDays: 0,
    periodLabel: "",
    unitPriceCOPPerKWh: 0,
    effectiveTariffCOPPerKWh: 0,
    energyChargesCOP: 0,
    demandChargeCOPPerKW: 0,
    totalCOP: 0,
    chargesActiveEnergy: true,
    chargesReactiveEnergy: false,
    reactiveKvarh: 0,
    subsidyOrContribution: "",
    history: [],
    extras: "",
    analyzedAt: "",
  };
}

function num(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function text(value: unknown): string {
  return value == null ? "" : String(value).trim();
}

export function normalizeEnergyBill(
  raw: Partial<EnergyBill> | null | undefined,
  photos?: EnergyBillPhoto[]
): EnergyBill {
  const base = emptyEnergyBill();
  const history = Array.isArray(raw?.history)
    ? raw!.history
        .map((row) => ({
          label: text(row.label),
          kwh: Math.round(num(row.kwh)),
        }))
        .filter((row) => row.label || row.kwh)
    : [];
  const consumptionKWh = Math.round(num(raw?.consumptionKWh));
  const histKwh = history.map((h) => h.kwh).filter((k) => k > 0);
  const average6MonthsKWh =
    Math.round(num(raw?.average6MonthsKWh)) ||
    (histKwh.length
      ? Math.round(histKwh.reduce((s, k) => s + k, 0) / histKwh.length)
      : 0);
  const energyChargesCOP = Math.round(num(raw?.energyChargesCOP));
  const unitPriceCOPPerKWh = Math.round(num(raw?.unitPriceCOPPerKWh));
  const fromTotal =
    consumptionKWh > 0 && energyChargesCOP > 0
      ? Math.round(energyChargesCOP / consumptionKWh)
      : 0;
  const effectiveTariffCOPPerKWh =
    Math.round(num(raw?.effectiveTariffCOPPerKWh)) ||
    unitPriceCOPPerKWh ||
    fromTotal;
  return {
    ...base,
    ...raw,
    photos: photos ?? raw?.photos ?? [],
    utility: text(raw?.utility),
    operator: text(raw?.operator),
    accountNumber: text(raw?.accountNumber),
    nic: text(raw?.nic),
    niu: text(raw?.niu),
    meterNumber: text(raw?.meterNumber),
    address: text(raw?.address),
    stratum: text(raw?.stratum),
    tensionLevel: text(raw?.tensionLevel),
    transformerNumber: text(raw?.transformerNumber),
    circuitNumber: text(raw?.circuitNumber),
    demandKw: num(raw?.demandKw),
    contractedLoad: text(raw?.contractedLoad),
    consumptionKWh,
    average6MonthsKWh,
    billedDays: Math.round(num(raw?.billedDays)),
    periodLabel: text(raw?.periodLabel),
    unitPriceCOPPerKWh,
    effectiveTariffCOPPerKWh,
    energyChargesCOP,
    demandChargeCOPPerKW: Math.round(num(raw?.demandChargeCOPPerKW)),
    totalCOP: Math.round(num(raw?.totalCOP)),
    chargesActiveEnergy: raw?.chargesActiveEnergy !== false,
    chargesReactiveEnergy: Boolean(raw?.chargesReactiveEnergy),
    reactiveKvarh: num(raw?.reactiveKvarh),
    subsidyOrContribution: text(raw?.subsidyOrContribution),
    history,
    extras: text(raw?.extras),
    analyzedAt: text(raw?.analyzedAt) || new Date().toISOString(),
  };
}

export function consumptionForQuote(bill: EnergyBill) {
  return bill.average6MonthsKWh || bill.consumptionKWh || 0;
}

export function tariffForQuote(bill: EnergyBill) {
  return bill.effectiveTariffCOPPerKWh || bill.unitPriceCOPPerKWh || 0;
}

export function suggestedKwpFromBill(bill: EnergyBill, hsp: number) {
  const kwh = consumptionForQuote(bill);
  const sun = hsp > 0 ? hsp : 4.5;
  if (kwh <= 0) return 0;
  return Math.round((kwh / (sun * 30 * 0.8)) * 10) / 10;
}

export const ENERGY_BILL_SYSTEM = `Eres un analista de facturas de energía eléctrica de Colombia (EPM, Enel, Celsia, Air-e, Afinia, CEO, Electrohuila, etc.).
Lees fotografías de RECIBOS / FACTURAS de energía. Extrae con la mayor exactitud posible. No inventes números que no se vean. Si un dato no aparece, deja "" o 0.

Unidades:
- Consumo siempre en kWh (aunque el recibo diga kW mes).
- Demanda / carga contratada en kW.
- Tarifas en COP por kWh.
- Reactiva en kVArh si aparece.

Campos a buscar (nombres típicos en Colombia):
- Comercializador / empresa (utility)
- Operador de red (operator)
- Cuenta contrato, NIC, NIÚ, código unicomo, medidor
- Dirección del predio, estrato
- Nivel de tensión
- Transformador / nro. transformador / código trafo
- Circuito / nro. circuito / alimentador
- Carga contratada o demanda máxima (kW)
- Consumo del periodo (kWh)
- Histórico de 6 a 12 meses (gráfica o tabla)
- Promedio 6 meses si está impreso; si no, calcúlalo del histórico
- Precio unitario $/kWh (generación+transmisión+distribución+comercialización si está unificado, o el cargo de energía)
- Cargos solo de energía (sin aseo ni alumbrado) → energyChargesCOP
- Tarifa efectiva = energyChargesCOP / kWh del mes, o el $/kWh impreso
- Cargo por potencia / kW si hay
- Total a pagar
- ¿Cobra energía activa? casi siempre sí
- ¿Cobra energía reactiva? sí si hay kVArh, recargo reactiva o "energía reactiva"
- Subsidio / contribución
- Periodo facturado y días

Responde SOLO JSON:
{
  "utility": "",
  "operator": "",
  "accountNumber": "",
  "nic": "",
  "niu": "",
  "meterNumber": "",
  "address": "",
  "stratum": "",
  "tensionLevel": "",
  "transformerNumber": "",
  "circuitNumber": "",
  "demandKw": 0,
  "contractedLoad": "",
  "consumptionKWh": 0,
  "average6MonthsKWh": 0,
  "billedDays": 0,
  "periodLabel": "",
  "unitPriceCOPPerKWh": 0,
  "effectiveTariffCOPPerKWh": 0,
  "energyChargesCOP": 0,
  "demandChargeCOPPerKW": 0,
  "totalCOP": 0,
  "chargesActiveEnergy": true,
  "chargesReactiveEnergy": false,
  "reactiveKvarh": 0,
  "subsidyOrContribution": "",
  "history": [{ "label": "Ene", "kwh": 0 }],
  "extras": "otros datos útiles: lectura anterior/actual, alumbrado, aseo, NICs, observaciones"
}`;
