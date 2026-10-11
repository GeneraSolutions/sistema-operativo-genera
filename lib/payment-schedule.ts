import type { PaymentKind, PaymentSchedule } from "@/types/proposal";

export const FINANCED_MONTH_OPTIONS = [12, 18, 24, 36, 48, 60] as const;

export interface PaymentInput {
  kind: PaymentKind;
  totalCOP: number;
  annualGenerationKWh: number;
  twoStartPercent: number;
  threeStartPercent: number;
  threeEquipmentPercent: number;
  financedPercent: number;
  financedMonths: number;
  financedEaPercent: number;
  ppaYears: number;
  ppaPricePerKWhCOP: number;
}

function clampPct(n: number, min = 0, max = 100) {
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

function roundCOP(n: number) {
  return Math.round(n);
}

/** Cuota mensual a partir de tasa efectiva anual. */
export function monthlyAnnuityCOP(
  principal: number,
  months: number,
  eaPercent: number
) {
  if (months <= 0) return 0;
  if (eaPercent <= 0) return roundCOP(principal / months);
  const i = (1 + eaPercent / 100) ** (1 / 12) - 1;
  const factor = (i * (1 + i) ** months) / ((1 + i) ** months - 1);
  return roundCOP(principal * factor);
}

export function buildPaymentSchedule(input: PaymentInput): PaymentSchedule {
  const total = Math.max(0, input.totalCOP);
  const kind = input.kind;

  if (kind === "three_shot") {
    const start = clampPct(input.threeStartPercent);
    const equip = clampPct(input.threeEquipmentPercent, 0, 100 - start);
    const end = Math.max(0, 100 - start - equip);
    const startCOP = roundCOP(total * (start / 100));
    const equipCOP = roundCOP(total * (equip / 100));
    const endCOP = total - startCOP - equipCOP;
    return {
      kind,
      modality: "Tres contados",
      summary: `${start}% anticipo · ${equip}% equipos · ${end}% entrega`,
      installments: [
        {
          key: "start",
          label: "Anticipo",
          percent: start,
          amountCOP: startCOP,
          hint: "Al inicio, para arrancar ingeniería y compras",
        },
        {
          key: "equipment",
          label: "Entrega de equipos",
          percent: equip,
          amountCOP: equipCOP,
          hint: "Cuando los equipos llegan a sitio",
        },
        {
          key: "end",
          label: "Entrega del proyecto",
          percent: end,
          amountCOP: endCOP,
          hint: "Contra puesta en marcha",
        },
      ],
      advancePercent: start,
      deliveryPercent: end,
      advanceCOP: startCOP,
      deliveryCOP: endCOP,
    };
  }

  if (kind === "financed") {
    const financedPct = clampPct(input.financedPercent, 10, 100);
    const downPct = 100 - financedPct;
    const months = input.financedMonths || 36;
    const ea = Math.max(0, input.financedEaPercent);
    const downCOP = roundCOP(total * (downPct / 100));
    const principal = total - downCOP;
    const cuota = monthlyAnnuityCOP(principal, months, ea);
    const installments = [
      ...(downPct > 0
        ? [
            {
              key: "down",
              label: "Cuota inicial",
              percent: downPct,
              amountCOP: downCOP,
              hint: `${downPct}% no financiado`,
            },
          ]
        : []),
      {
        key: "cuota",
        label: `Cuota mensual × ${months}`,
        percent: financedPct,
        amountCOP: cuota,
        hint:
          ea > 0
            ? `Financia ${financedPct}% a ${months} meses · TEA ${ea}%`
            : `Financia ${financedPct}% a ${months} meses, sin intereses`,
      },
    ];
    return {
      kind,
      modality: financedPct >= 100 ? "Financiado 100%" : `Financiado ${financedPct}%`,
      summary: `${financedPct}% a ${months} meses${ea > 0 ? ` · TEA ${ea}%` : ""}`,
      installments,
      advancePercent: downPct,
      deliveryPercent: financedPct,
      advanceCOP: downCOP,
      deliveryCOP: principal,
      financedPercent: financedPct,
      financedMonths: months,
      financedEaPercent: ea,
      monthlyInstallmentCOP: cuota,
      downPaymentCOP: downCOP,
    };
  }

  if (kind === "ppa") {
    const years = Math.min(25, Math.max(1, Math.round(input.ppaYears || 15)));
    const price = Math.max(0, input.ppaPricePerKWhCOP);
    const year1 = roundCOP(input.annualGenerationKWh * price);
    let contract = 0;
    for (let y = 0; y < years; y++) {
      contract += input.annualGenerationKWh * Math.pow(1 - 0.005, y) * price;
    }
    contract = roundCOP(contract);
    return {
      kind,
      modality: `PPA ${years} años`,
      summary: `$${price.toLocaleString("es-CO")}/kWh · ${years} años`,
      installments: [
        {
          key: "tarifa",
          label: "Precio de energía",
          amountCOP: price,
          hint: "Costo del kWh en el PPA (editable)",
        },
        {
          key: "year1",
          label: "Pago año 1",
          amountCOP: year1,
          hint: "Generación estimada × tarifa PPA",
        },
        {
          key: "contract",
          label: `Total contrato ${years} años`,
          amountCOP: contract,
          hint: "Con degradación 0.5%/año · el cliente no compra la planta",
        },
      ],
      advancePercent: 0,
      deliveryPercent: 0,
      advanceCOP: 0,
      deliveryCOP: 0,
      ppaYears: years,
      ppaPricePerKWhCOP: price,
      ppaAnnualYear1COP: year1,
      ppaContractTotalCOP: contract,
    };
  }

  const start = clampPct(input.twoStartPercent);
  const end = 100 - start;
  const startCOP = roundCOP(total * (start / 100));
  const endCOP = total - startCOP;
  return {
    kind: "two_shot",
    modality: "Dos contados",
    summary: `${start}% anticipo · ${end}% a la entrega`,
    installments: [
      {
        key: "start",
        label: "Anticipo",
        percent: start,
        amountCOP: startCOP,
        hint: "Al inicio del proyecto",
      },
      {
        key: "end",
        label: "Entrega del proyecto",
        percent: end,
        amountCOP: endCOP,
        hint: "Contra puesta en marcha",
      },
    ],
    advancePercent: start,
    deliveryPercent: end,
    advanceCOP: startCOP,
    deliveryCOP: endCOP,
  };
}
