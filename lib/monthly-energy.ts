import {
  MONTH_LABELS,
  monthlyGenerationKWh,
} from "@/lib/ideam-irradiance";
import type { MonthlyEnergyPoint } from "@/types/proposal";

export function buildMonthlyEnergy(
  annualGenerationKWh: number,
  monthlyConsumptionKWh: number,
  monthlyWh?: number[],
  systemKwp?: number
): MonthlyEnergyPoint[] {
  const gen =
    monthlyWh && monthlyWh.length === 12 && systemKwp
      ? monthlyGenerationKWh(systemKwp, monthlyWh)
      : null;
  const fallbackShare = [
    1.08, 1.02, 1.06, 1.0, 0.94, 0.88, 0.9, 0.94, 0.98, 1.02, 1.06, 1.12,
  ];
  const shareSum = fallbackShare.reduce((a, b) => a + b, 0);

  return MONTH_LABELS.map((month, i) => ({
    month,
    generationKWh:
      gen?.[i] ??
      Math.round(annualGenerationKWh * (fallbackShare[i] / shareSum)),
    consumptionKWh: Math.round(monthlyConsumptionKWh),
  }));
}
