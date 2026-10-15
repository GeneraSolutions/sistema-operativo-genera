export type LeadStage =
  | "lead"
  | "calificado"
  | "visita"
  | "cotizado"
  | "negociacion"
  | "ganado"
  | "perdido";

export type LeadSource =
  | "referido"
  | "web"
  | "llamada"
  | "feria"
  | "aliado"
  | "upme"
  | "otro";

export interface CommercialLead {
  id: string;
  clientName: string;
  contact: string;
  phone: string;
  email: string;
  city: string;
  siteName: string;
  kwp: string;
  source: LeadSource;
  owner: string;
  estimatedValue: number;
  stage: LeadStage;
  nextAction: string;
  nextActionDate: string;
  notes: string;
  lostReason: string;
  quoteId?: string;
  quoteName?: string;
  visitId?: string;
  obraId?: string;
  updatedAt: string;
}

const KEY = "genera.pipeline.v1";

export const OPEN_LEAD_KEY = "genera:open-lead";

export const LEAD_STAGE_LABELS: Record<LeadStage, string> = {
  lead: "Lead",
  calificado: "Calificado",
  visita: "Visita",
  cotizado: "Cotizado",
  negociacion: "Negociación",
  ganado: "Ganado",
  perdido: "Perdido",
};

export const LEAD_SOURCE_LABELS: Record<LeadSource, string> = {
  referido: "Referido",
  web: "Web / redes",
  llamada: "Llamada",
  feria: "Feria",
  aliado: "Aliado",
  upme: "UPME / convocatoria",
  otro: "Otro",
};

export const LOST_REASON_LABELS: Record<string, string> = {
  precio: "Precio",
  timing: "Timing / presupuesto",
  competencia: "Competencia",
  "no-viable": "No viable técnico",
  "sin-respuesta": "Sin respuesta",
  otro: "Otro",
};

export const ACTIVE_STAGES: LeadStage[] = [
  "lead",
  "calificado",
  "visita",
  "cotizado",
  "negociacion",
];

export function emptyLead(): CommercialLead {
  return {
    id: crypto.randomUUID(),
    clientName: "",
    contact: "",
    phone: "",
    email: "",
    city: "",
    siteName: "",
    kwp: "",
    source: "llamada",
    owner: "",
    estimatedValue: 0,
    stage: "lead",
    nextAction: "",
    nextActionDate: "",
    notes: "",
    lostReason: "",
    updatedAt: new Date().toISOString(),
  };
}

export function loadLeads(): CommercialLead[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) || "[]") as CommercialLead[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function replaceLeads(leads: CommercialLead[]): CommercialLead[] {
  const next = leads.filter((l) => l?.id).slice(0, 120);
  localStorage.setItem(KEY, JSON.stringify(next));
  return next;
}

export function upsertLead(lead: CommercialLead): CommercialLead[] {
  const stamped = { ...lead, updatedAt: new Date().toISOString() };
  const next = [
    stamped,
    ...loadLeads().filter((l) => l.id !== stamped.id),
  ].slice(0, 120);
  localStorage.setItem(KEY, JSON.stringify(next));
  return next;
}

export function deleteLead(id: string): CommercialLead[] {
  const next = loadLeads().filter((l) => l.id !== id);
  localStorage.setItem(KEY, JSON.stringify(next));
  return next;
}

export function mergeLeads(
  local: CommercialLead[],
  remote: CommercialLead[]
): CommercialLead[] {
  const byId = new Map<string, CommercialLead>();
  for (const lead of [...remote, ...local]) {
    if (!lead?.id) continue;
    const prev = byId.get(lead.id);
    const prevT = Date.parse(prev?.updatedAt || "") || 0;
    const nextT = Date.parse(lead.updatedAt || "") || 0;
    if (!prev || nextT >= prevT) byId.set(lead.id, lead);
  }
  return [...byId.values()].sort((a, b) => {
    const da = a.nextActionDate || "9999";
    const db = b.nextActionDate || "9999";
    if (da !== db) return da.localeCompare(db);
    return (a.clientName || "").localeCompare(b.clientName || "", "es");
  });
}

export function leadLabel(lead: CommercialLead) {
  const client = lead.clientName.trim() || "Sin cliente";
  const site = lead.siteName.trim() || lead.city.trim();
  return site ? `${client} · ${site}` : client;
}

export function pinOpenLead(id: string) {
  if (typeof window === "undefined" || !id) return;
  sessionStorage.setItem(OPEN_LEAD_KEY, id);
}

export function peekOpenLeadId(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(OPEN_LEAD_KEY);
}

export function attachQuoteToLead(
  leadId: string,
  quoteId: string,
  quoteName?: string
): CommercialLead[] {
  const lead = loadLeads().find((l) => l.id === leadId);
  if (!lead) return loadLeads();
  const nextStage: LeadStage =
    lead.stage === "lead" || lead.stage === "calificado" || lead.stage === "visita"
      ? "cotizado"
      : lead.stage;
  return upsertLead({
    ...lead,
    quoteId,
    quoteName: quoteName || lead.quoteName,
    stage: nextStage,
  });
}

export function attachVisitToLead(
  leadId: string,
  visitId: string
): CommercialLead[] {
  const lead = loadLeads().find((l) => l.id === leadId);
  if (!lead) return loadLeads();
  const nextStage: LeadStage =
    lead.stage === "lead" || lead.stage === "calificado" ? "visita" : lead.stage;
  return upsertLead({ ...lead, visitId, stage: nextStage });
}

export function persistLeadsCloud(leads: CommercialLead[]) {
  void fetch("/api/archivo", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ leads }),
  }).catch(() => undefined);
}
