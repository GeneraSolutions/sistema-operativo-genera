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

function compactVisit(record: SavedVisit): SavedVisit {
  const photos = (record.visit.photos ?? [])
    .filter((p) => p?.dataUrl && p.dataUrl.length < 160_000)
    .slice(0, 4);
  return {
    ...record,
    visit: { ...record.visit, photos },
  };
}

export function mergeVisits(local: SavedVisit[], remote: SavedVisit[]): SavedVisit[] {
  const byId = new Map<string, SavedVisit>();
  for (const v of [...remote, ...local]) {
    if (!v?.id) continue;
    const prev = byId.get(v.id);
    if (!prev || Date.parse(v.savedAt) >= Date.parse(prev.savedAt)) {
      byId.set(v.id, v);
    }
  }
  return [...byId.values()]
    .sort((a, b) => Date.parse(b.savedAt) - Date.parse(a.savedAt))
    .slice(0, 40);
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
  const stored = compactVisit(record);
  const next = [stored, ...all.filter((v) => v.id !== stored.id)].slice(0, 40);
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    const lighter = next.map((v) => ({
      ...v,
      visit: { ...v.visit, photos: [] },
    }));
    localStorage.setItem(KEY, JSON.stringify(lighter));
  }
  return stored;
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
