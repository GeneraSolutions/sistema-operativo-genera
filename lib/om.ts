import type { OmContract, PlantProfile } from "@/lib/technical-reports";

export type OmStatus = "sin-fecha" | "al-dia" | "proximo" | "vencido";

export const OM_CONTRACT_LABELS: Record<OmContract, string> = {
  ninguno: "Sin contrato",
  preventivo: "Preventivo",
  correctivo: "Correctivo",
  integral: "Integral",
};

export const OM_STATUS_LABELS: Record<OmStatus, string> = {
  "sin-fecha": "Sin fecha",
  "al-dia": "Al día",
  proximo: "Próximo (30 días)",
  vencido: "Vencido",
};

export function addMonths(iso: string, months: number): string {
  if (!iso) return "";
  const d = new Date(`${iso}T12:00:00`);
  if (!Number.isFinite(d.getTime())) return "";
  d.setMonth(d.getMonth() + Math.max(1, months));
  return d.toISOString().slice(0, 10);
}

export function daysUntil(iso?: string): number | null {
  if (!iso) return null;
  const t = Date.parse(`${iso}T12:00:00`);
  if (!Number.isFinite(t)) return null;
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  return Math.round((t - today.getTime()) / 86_400_000);
}

export function omStatus(plant: PlantProfile): OmStatus {
  const d = daysUntil(plant.nextMaintenance);
  if (d === null) return "sin-fecha";
  if (d < 0) return "vencido";
  if (d <= 30) return "proximo";
  return "al-dia";
}

export function plantLabel(plant: PlantProfile) {
  const client = plant.clientName.trim() || "Sin cliente";
  const site = plant.siteName.trim() || plant.city.trim();
  return site ? `${client} · ${site}` : client;
}

export function markMaintenanceDone(plant: PlantProfile, date: string): PlantProfile {
  const interval = plant.intervalMonths || 12;
  return {
    ...plant,
    lastMaintenance: date,
    nextMaintenance: addMonths(date, interval),
    updatedAt: new Date().toISOString(),
  };
}
