import type { MonthlyEnergyPoint } from "@/types/proposal";

const MONTHS = [
  "Ene",
  "Feb",
  "Mar",
  "Abr",
  "May",
  "Jun",
  "Jul",
  "Ago",
  "Sep",
  "Oct",
  "Nov",
  "Dic",
];

/** Perfil relativo de generación Colombia (HSP). */
const GEN_SHAPE = [
  1.08, 1.02, 1.06, 1.0, 0.94, 0.88, 0.9, 0.94, 0.98, 1.02, 1.06, 1.12,
];

export function buildMonthlyEnergy(
  annualGenerationKWh: number,
  monthlyConsumptionKWh: number
): MonthlyEnergyPoint[] {
  const shapeSum = GEN_SHAPE.reduce((a, b) => a + b, 0);
  return MONTHS.map((month, i) => ({
    month,
    generationKWh: Math.round(
      annualGenerationKWh * (GEN_SHAPE[i] / shapeSum)
    ),
    consumptionKWh: Math.round(monthlyConsumptionKWh),
  }));
}
