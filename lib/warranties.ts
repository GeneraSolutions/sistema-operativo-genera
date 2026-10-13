export interface WarrantyItem {
  id: string;
  label: string;
  years: number;
  detail: string;
  enabled: boolean;
}

export interface SystemWarranties {
  items: WarrantyItem[];
  notes: string;
}

export const DEFAULT_WARRANTY_ITEMS: WarrantyItem[] = [
  {
    id: "panels-product",
    label: "Paneles (producto)",
    years: 25,
    detail: "",
    enabled: true,
  },
  {
    id: "panels-yield",
    label: "Paneles (rendimiento)",
    years: 25,
    detail: "≥80%",
    enabled: true,
  },
  {
    id: "inverters",
    label: "Inversores",
    years: 10,
    detail: "fábrica",
    enabled: true,
  },
  {
    id: "batteries",
    label: "Baterías",
    years: 10,
    detail: "según fabricante",
    enabled: true,
  },
  {
    id: "structure",
    label: "Estructura",
    years: 10,
    detail: "corrosión",
    enabled: true,
  },
  {
    id: "labor",
    label: "Mano de obra GENERA",
    years: 1,
    detail: "",
    enabled: true,
  },
];

export const DEFAULT_WARRANTIES: SystemWarranties = {
  items: DEFAULT_WARRANTY_ITEMS.map((item) => ({ ...item })),
  notes: "",
};

const COMPANY_KEY = "genera.warranties.v1";

function sanitizeItem(raw: Partial<WarrantyItem> | null | undefined, fallbackId: string): WarrantyItem {
  const years = Number(raw?.years);
  return {
    id: String(raw?.id || fallbackId),
    label: String(raw?.label || "Garantía").trim() || "Garantía",
    years: Number.isFinite(years) ? Math.max(0, years) : 0,
    detail: String(raw?.detail ?? ""),
    enabled: raw?.enabled !== false,
  };
}

export function cloneWarranties(input?: SystemWarranties | null): SystemWarranties {
  const items = Array.isArray(input?.items)
    ? input!.items.map((item, i) => sanitizeItem(item, `custom-${i}`))
    : DEFAULT_WARRANTY_ITEMS.map((item) => ({ ...item }));
  return {
    items: items.length ? items : DEFAULT_WARRANTY_ITEMS.map((item) => ({ ...item })),
    notes: String(input?.notes ?? ""),
  };
}

export function visibleWarrantyItems(
  warranties: SystemWarranties,
  includeBattery = true
): WarrantyItem[] {
  return cloneWarranties(warranties).items.filter((item) => {
    if (!item.enabled) return false;
    if (!includeBattery && item.id === "batteries") return false;
    return true;
  });
}

export function yearsLabel(years: number): string {
  return years === 1 ? "1 año" : `${years} años`;
}

export function formatWarrantyLine(item: WarrantyItem): string {
  const detail = item.detail.trim();
  return `${item.label}: ${yearsLabel(item.years)}${detail ? ` · ${detail}` : ""}`;
}

export function warrantySummary(warranties: SystemWarranties, includeBattery = true): string {
  const items = visibleWarrantyItems(warranties, includeBattery);
  if (!items.length) return warranties.notes.trim() || "Sin garantías visibles";
  return items
    .slice(0, 3)
    .map((item) => `${item.label} ${item.years}a`)
    .join(" · ");
}

export function loadCompanyWarranties(): SystemWarranties {
  if (typeof window === "undefined") return cloneWarranties();
  try {
    const parsed = JSON.parse(localStorage.getItem(COMPANY_KEY) || "null") as SystemWarranties | null;
    return cloneWarranties(parsed);
  } catch {
    return cloneWarranties();
  }
}

export function saveCompanyWarranties(warranties: SystemWarranties): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(COMPANY_KEY, JSON.stringify(cloneWarranties(warranties)));
  } catch {
    /* quota */
  }
}
