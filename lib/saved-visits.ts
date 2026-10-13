import type { SiteVisit } from "@/lib/site-visit";

export interface SavedVisit {
  id: string;
  savedAt: string;
  linked: boolean;
  visit: SiteVisit;
}

const KEY = "genera.saved-visits.v1";

export const OPEN_QUOTE_KEY = "genera:open-quote";
export const OPEN_VISIT_KEY = "genera:open-visit";

export function loadSavedVisits(): SavedVisit[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) || "[]") as SavedVisit[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveVisitSnapshot(input: {
  visit: SiteVisit;
  linked: boolean;
  id?: string;
}): SavedVisit {
  const all = loadSavedVisits();
  const byId = input.id ? all.find((v) => v.id === input.id) : undefined;
  const byClient =
    !byId && input.visit.clientName.trim()
      ? all.find(
          (v) =>
            v.visit.clientName.trim().toLowerCase() ===
              input.visit.clientName.trim().toLowerCase() &&
            v.visit.visitDate === input.visit.visitDate
        )
      : undefined;
  const record: SavedVisit = {
    id: byId?.id || byClient?.id || crypto.randomUUID(),
    savedAt: new Date().toISOString(),
    linked: input.linked,
    visit: { ...input.visit, updatedAt: new Date().toISOString() },
  };
  const next = [record, ...all.filter((v) => v.id !== record.id)].slice(0, 40);
  localStorage.setItem(KEY, JSON.stringify(next));
  return record;
}

export function deleteSavedVisit(id: string): void {
  localStorage.setItem(
    KEY,
    JSON.stringify(loadSavedVisits().filter((v) => v.id !== id))
  );
}

export function getSavedVisit(id: string): SavedVisit | undefined {
  return loadSavedVisits().find((v) => v.id === id);
}
