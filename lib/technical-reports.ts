import type { SpecialistId } from "@/lib/specialists";
import { getSpecialist } from "@/lib/specialists";

export type ReportKind =
  | "inspeccion-fv"
  | "inspeccion-electrica"
  | "pre-mantenimiento"
  | "post-mantenimiento";

export type ReportStatus = "borrador" | "revisado" | "publicado";

export type CheckStatus = "pendiente" | "ok" | "no" | "na";

export interface PlantProfile {
  id: string;
  clientName: string;
  siteName: string;
  city: string;
  address: string;
  kwp: string;
  inverter: string;
  yearInstalled: string;
  ours: boolean;
  notes: string;
}

export interface ReportPhoto {
  id: string;
  caption: string;
  dataUrl: string;
}

export interface ChecklistItem {
  id: string;
  label: string;
  status: CheckStatus;
  note: string;
}

export interface ReportChapter {
  specialistId: SpecialistId;
  title: string;
  body: string;
  approved: boolean;
}

export interface TechnicalReport {
  id: string;
  kind: ReportKind;
  status: ReportStatus;
  plant: PlantProfile;
  inspector: string;
  visitDate: string;
  purpose: string;
  findings: string;
  /** Complemento del inspector para que la mesa aplique norma y correcciones. */
  engineeringNotes?: string;
  recommendations: string;
  nextSteps: string;
  checklist: ChecklistItem[];
  photos: ReportPhoto[];
  chapters: ReportChapter[];
  createdAt: string;
  updatedAt: string;
  savedBy?: string;
  savedByName?: string;
}

export interface SavedReport {
  id: string;
  savedAt: string;
  report: TechnicalReport;
}

export const REPORT_KIND_LABELS: Record<ReportKind, string> = {
  "inspeccion-fv": "Inspección FV de tercero",
  "inspeccion-electrica": "Inspección eléctrica",
  "pre-mantenimiento": "Diagnóstico pre-mantenimiento",
  "post-mantenimiento": "Informe post-mantenimiento",
};

export const REPORT_KIND_HINTS: Record<ReportKind, string> = {
  "inspeccion-fv":
    "Criterio GENERA sobre un sistema fotovoltaico ya instalado (propio o de otro EPC).",
  "inspeccion-electrica":
    "Tableros, tierras, protecciones y calidad de energía. No requiere paneles.",
  "pre-mantenimiento":
    "Estado actual para justificar y cotizar el mantenimiento que el cliente aún no ha hecho.",
  "post-mantenimiento":
    "Qué se ejecutó, mediciones, fotos y pendientes después del servicio.",
};

const CHECKLISTS: Record<ReportKind, string[]> = {
  "inspeccion-fv": [
    "Identificación de módulos, inversor y seriales",
    "Suciedad, sombreado y estado del vidrio",
    "Conectores MC4, cableado DC y canalización",
    "Estructura, anclajes y cubierta",
    "Tablero DC / fusibles / seccionador",
    "Tablero AC, tierras y DPS",
    "Monitoreo, comunicación y registros de fallas",
    "Evidencia de mantenimiento previo",
  ],
  "inspeccion-electrica": [
    "Tablero general rotulado y accesible",
    "Interruptor principal y capacidad aparente",
    "DPS y coordinación de protecciones",
    "Puesta a tierra y continuidad",
    "Conductores, canalización y calentamiento",
    "Medición de tensiones y desbalance",
    "Cargas críticas y punto de conexión",
    "Hallazgos visibles frente a RETIE / NTC 2050",
  ],
  "pre-mantenimiento": [
    "Fecha del último mantenimiento conocido",
    "Suciedad de módulos y acceso a cubierta",
    "Alertas o historial en monitoreo",
    "Estado de estructura y anclajes",
    "Tableros, protecciones y tierras",
    "Inversor: ruidos, errores, ventilación",
    "Condiciones SST / trabajo en altura",
    "Repuestos o consumibles previsibles",
  ],
  "post-mantenimiento": [
    "Limpieza de módulos ejecutada",
    "Revisión y reapriete de conectores",
    "Inspección de estructura",
    "Prueba de inversor / string",
    "Mediciones DC y AC registradas",
    "Limpieza y apriete de tableros",
    "Hallazgos residuales no resueltos",
    "Próxima visita recomendada",
  ],
};

const CHAPTERS: Record<ReportKind, SpecialistId[]> = {
  "inspeccion-fv": [
    "fotovoltaico",
    "potencia",
    "estructural",
    "om",
    "retie",
    "sst",
  ],
  "inspeccion-electrica": ["potencia", "retie", "sst", "om"],
  "pre-mantenimiento": [
    "om",
    "fotovoltaico",
    "potencia",
    "estructural",
    "sst",
    "comercial",
  ],
  "post-mantenimiento": ["om", "fotovoltaico", "potencia", "sst", "retie"],
};

const PLANTS_KEY = "genera.plants.v1";
const REPORTS_KEY = "genera.saved-reports.v1";
export const OPEN_REPORT_KEY = "genera:open-report";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function emptyPlant(): PlantProfile {
  return {
    id: crypto.randomUUID(),
    clientName: "",
    siteName: "",
    city: "",
    address: "",
    kwp: "",
    inverter: "",
    yearInstalled: "",
    ours: false,
    notes: "",
  };
}

function checklistFor(kind: ReportKind): ChecklistItem[] {
  return CHECKLISTS[kind].map((label, i) => ({
    id: `${kind}-${i}`,
    label,
    status: "pendiente",
    note: "",
  }));
}

function chaptersFor(kind: ReportKind): ReportChapter[] {
  return CHAPTERS[kind].map((id) => {
    const spec = getSpecialist(id);
    return {
      specialistId: id,
      title: spec?.title ?? id,
      body: "",
      approved: false,
    };
  });
}

export function emptyReport(kind: ReportKind): TechnicalReport {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    kind,
    status: "borrador",
    plant: emptyPlant(),
    inspector: "",
    visitDate: todayISO(),
    purpose: "",
    findings: "",
    engineeringNotes: "",
    recommendations: "",
    nextSteps: "",
    checklist: checklistFor(kind),
    photos: [],
    chapters: chaptersFor(kind),
    createdAt: now,
    updatedAt: now,
  };
}

export function retargetKind(
  report: TechnicalReport,
  kind: ReportKind
): TechnicalReport {
  if (report.kind === kind) return report;
  return {
    ...report,
    kind,
    checklist: checklistFor(kind),
    chapters: chaptersFor(kind),
    status: "borrador",
    updatedAt: new Date().toISOString(),
  };
}

export function loadPlants(): PlantProfile[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(PLANTS_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function upsertPlant(plant: PlantProfile): PlantProfile[] {
  const all = loadPlants();
  const next = [plant, ...all.filter((p) => p.id !== plant.id)].slice(0, 80);
  localStorage.setItem(PLANTS_KEY, JSON.stringify(next));
  return next;
}

export function loadSavedReports(): SavedReport[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(
      localStorage.getItem(REPORTS_KEY) || "[]"
    ) as SavedReport[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function compactReport(record: SavedReport): SavedReport {
  const photos = (record.report.photos ?? [])
    .filter((p) => p?.dataUrl && p.dataUrl.length < 160_000)
    .slice(0, 12);
  return {
    ...record,
    report: { ...record.report, photos },
  };
}

export function mergeReports(
  local: SavedReport[],
  remote: SavedReport[]
): SavedReport[] {
  const byId = new Map<string, SavedReport>();
  for (const row of [...remote, ...local]) {
    if (!row?.id) continue;
    const prev = byId.get(row.id);
    if (!prev || Date.parse(row.savedAt) >= Date.parse(prev.savedAt)) {
      byId.set(row.id, row);
    }
  }
  return [...byId.values()]
    .sort((a, b) => Date.parse(b.savedAt) - Date.parse(a.savedAt))
    .slice(0, 60);
}

export function saveReportSnapshot(input: {
  report: TechnicalReport;
  id?: string;
}): SavedReport {
  const all = loadSavedReports();
  const byId = input.id ? all.find((r) => r.id === input.id) : undefined;
  const record: SavedReport = {
    id: byId?.id || input.report.id,
    savedAt: new Date().toISOString(),
    report: { ...input.report, updatedAt: new Date().toISOString() },
  };
  const stored = compactReport(record);
  const next = [stored, ...all.filter((r) => r.id !== stored.id)].slice(0, 60);
  try {
    localStorage.setItem(REPORTS_KEY, JSON.stringify(next));
  } catch {
    const lighter = next.map((r) => ({
      ...r,
      report: { ...r.report, photos: [] },
    }));
    localStorage.setItem(REPORTS_KEY, JSON.stringify(lighter));
  }
  return stored;
}

export function deleteSavedReport(id: string): void {
  localStorage.setItem(
    REPORTS_KEY,
    JSON.stringify(loadSavedReports().filter((r) => r.id !== id))
  );
}

export function getSavedReport(id: string): SavedReport | undefined {
  return loadSavedReports().find((r) => r.id === id);
}

export function checklistSummary(items: ChecklistItem[]) {
  const ok = items.filter((i) => i.status === "ok").length;
  const no = items.filter((i) => i.status === "no").length;
  const na = items.filter((i) => i.status === "na").length;
  const pending = items.filter((i) => i.status === "pendiente").length;
  return { ok, no, na, pending, total: items.length };
}

export function reportTitle(report: TechnicalReport) {
  const client = report.plant.clientName.trim() || "Sin cliente";
  return `${REPORT_KIND_LABELS[report.kind]} · ${client}`;
}

export function briefingForMesa(report: TechnicalReport) {
  const checks = report.checklist
    .map((c) => `- [${c.status}] ${c.label}${c.note ? ` — ${c.note}` : ""}`)
    .join("\n");
  const photos = report.photos
    .map((p, i) => `${i + 1}. ${p.caption || "Sin pie de foto"}`)
    .join("\n");
  return `Tipo de informe: ${REPORT_KIND_LABELS[report.kind]}
Estado: ${report.status}
Fecha de visita: ${report.visitDate}
Inspector: ${report.inspector || "no indicado"}

Planta / predio
- Cliente: ${report.plant.clientName || "—"}
- Sitio: ${report.plant.siteName || "—"}
- Ciudad: ${report.plant.city || "—"}
- Dirección: ${report.plant.address || "—"}
- Potencia: ${report.plant.kwp || "—"} kWp
- Inversor: ${report.plant.inverter || "—"}
- Año instalación: ${report.plant.yearInstalled || "—"}
- ¿Instaló GENERA?: ${report.plant.ours ? "sí" : "no / tercero"}
- Notas de planta: ${report.plant.notes || "—"}

Objeto del informe:
${report.purpose || "(sin objeto escrito)"}

Hallazgos de campo:
${report.findings || "(sin hallazgos escritos)"}

Complemento para ingeniería (norma, no conformidades, correcciones pedidas por el inspector):
${report.engineeringNotes || "(sin complemento)"}

Checklist:
${checks || "(vacío)"}

Fotos (solo pies de foto; el ingeniero las ve en el PDF):
${photos || "(sin fotos)"}

Capítulos que debe redactar (usar exactamente estos specialistId):
${report.chapters.map((c) => `- ${c.specialistId} · ${c.title}`).join("\n")}
`;
}
