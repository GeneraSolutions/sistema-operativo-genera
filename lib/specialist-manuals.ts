import type { SpecialistId } from "@/lib/specialists";

const KEY = "genera.specialist-manuals.v1";

export type SpecialistManuals = Partial<Record<SpecialistId, string>>;

export function loadSpecialistManuals(): SpecialistManuals {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    return JSON.parse(raw) as SpecialistManuals;
  } catch {
    return {};
  }
}

export function saveSpecialistManuals(manuals: SpecialistManuals): void {
  localStorage.setItem(KEY, JSON.stringify(manuals));
}

export function upsertSpecialistManual(
  id: SpecialistId,
  manual: string,
  current: SpecialistManuals
): SpecialistManuals {
  const next = { ...current, [id]: manual };
  saveSpecialistManuals(next);
  return next;
}
