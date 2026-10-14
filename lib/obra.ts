export type ObraStatus =
  | "por-iniciar"
  | "en-obra"
  | "tramites"
  | "energizado"
  | "cerrado";

export type TramiteStatus = "pendiente" | "radicado" | "aprobado" | "na";

export interface ObraJob {
  id: string;
  clientName: string;
  siteName: string;
  city: string;
  kwp: string;
  quoteId?: string;
  quoteName?: string;
  visitId?: string;
  plantId?: string;
  status: ObraStatus;
  startDate: string;
  endTarget: string;
  energizedAt: string;
  crew: string;
  progress: number;
  compras: "pendiente" | "parcial" | "completo";
  upme: TramiteStatus;
  retie: TramiteStatus;
  operadorRed: TramiteStatus;
  notes: string;
  updatedAt: string;
}

const KEY = "genera.obra.v1";

export const OBRA_STATUS_LABELS: Record<ObraStatus, string> = {
  "por-iniciar": "Por iniciar",
  "en-obra": "En obra",
  tramites: "Trámites",
  energizado: "Energizado",
  cerrado: "Cerrado",
};

export const TRAMITE_LABELS: Record<TramiteStatus, string> = {
  pendiente: "Pendiente",
  radicado: "Radicado",
  aprobado: "Aprobado / dictamen",
  na: "No aplica",
};

export function emptyObra(): ObraJob {
  return {
    id: crypto.randomUUID(),
    clientName: "",
    siteName: "",
    city: "",
    kwp: "",
    status: "por-iniciar",
    startDate: "",
    endTarget: "",
    energizedAt: "",
    crew: "",
    progress: 0,
    compras: "pendiente",
    upme: "pendiente",
    retie: "pendiente",
    operadorRed: "pendiente",
    notes: "",
    updatedAt: new Date().toISOString(),
  };
}

export function loadObras(): ObraJob[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) || "[]") as ObraJob[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function replaceObras(jobs: ObraJob[]): ObraJob[] {
  const next = jobs.filter((j) => j?.id).slice(0, 80);
  localStorage.setItem(KEY, JSON.stringify(next));
  return next;
}

export function upsertObra(job: ObraJob): ObraJob[] {
  const stamped = { ...job, updatedAt: new Date().toISOString() };
  const next = [stamped, ...loadObras().filter((j) => j.id !== stamped.id)].slice(
    0,
    80
  );
  localStorage.setItem(KEY, JSON.stringify(next));
  return next;
}

export function deleteObra(id: string): ObraJob[] {
  const next = loadObras().filter((j) => j.id !== id);
  localStorage.setItem(KEY, JSON.stringify(next));
  return next;
}

export function mergeObras(local: ObraJob[], remote: ObraJob[]): ObraJob[] {
  const byId = new Map<string, ObraJob>();
  for (const job of [...remote, ...local]) {
    if (!job?.id) continue;
    const prev = byId.get(job.id);
    const prevT = Date.parse(prev?.updatedAt || "") || 0;
    const nextT = Date.parse(job.updatedAt || "") || 0;
    if (!prev || nextT >= prevT) byId.set(job.id, job);
  }
  return [...byId.values()].sort((a, b) =>
    (a.clientName || "").localeCompare(b.clientName || "", "es")
  );
}

export function obraLabel(job: ObraJob) {
  const client = job.clientName.trim() || "Sin cliente";
  const site = job.siteName.trim() || job.city.trim();
  return site ? `${client} · ${site}` : client;
}
