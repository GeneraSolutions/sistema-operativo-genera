/**
 * Solar win — empresa aliada. Genera hace ingeniería, diseño e instalación;
 * Solar win envía dinero (viáticos, etc.) y aquí se lleva el control de en qué
 * se gastó para cuadrar cuentas al final.
 */

const STORE_KEY = "genera.solarwin.gastos.v1";
const TOMBSTONE_DAYS = 120;

/** Dinero que Solar win envía a Genera (un “fondo”). */
export interface SolarwinEnvio {
  id: string;
  /** YYYY-MM-DD */
  date: string;
  amountCOP: number;
  /** Para qué es: viáticos, anticipo de obra, etc. */
  concept: string;
  /** Proyecto o instalación al que corresponde el dinero. */
  project?: string;
  notes?: string;
  /** Presupuesto estimado de gastos (opcional) para comparar con lo real. */
  budgetCOP?: number;
  /** Si existe, el envío está liquidado (cuentas cerradas y congeladas). */
  closedAt?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export type SolarwinGastoKind = "gasto" | "devolucion";

/** Gasto o compra que se descuenta de un envío (o devolución del saldo). */
export interface SolarwinGasto {
  id: string;
  envioId: string;
  date: string;
  concept: string;
  amountCOP: number;
  /** "gasto" (por defecto) o "devolucion" de dinero a Solar win. */
  kind?: SolarwinGastoKind;
  /** Quién puso la plata: Camilo, un técnico, caja de Genera… */
  paidBy?: string;
  /** Viáticos, transporte, alimentación… para el resumen por categoría. */
  category?: string;
  /** Cuándo se le repuso a quien puso la plata de su bolsillo. */
  reimbursedAt?: string;
  notes?: string;
  /** Foto del comprobante (comprimida), copia local. "" = quitado. */
  receiptDataUrl?: string;
  /** Id de la foto en el servidor (se guarda aparte, no dentro de las cuentas). */
  receiptId?: string;
  /** La foto ya se subió al servidor. */
  receiptUp?: boolean;
  receiptName?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

/** Documento (PDF/enlace) que se compartió con Solar win. */
export interface SolarwinDoc {
  id: string;
  createdAt: string;
  updatedAt: string;
  /** Si es de un solo envío. */
  envioId?: string;
  label: string;
  acceptedAt?: string;
  acceptedBy?: string;
  acceptedNote?: string;
  deletedAt?: string;
}

export interface SolarwinBundle {
  envios: SolarwinEnvio[];
  gastos: SolarwinGasto[];
  docs?: SolarwinDoc[];
}

export interface SolarwinAcceptance {
  name: string;
  note?: string;
  at: string;
}

export interface EnvioTotals {
  enviadoCOP: number;
  /** Gastos y compras reales. */
  gastadoCOP: number;
  /** Dinero devuelto a Solar win. */
  devueltoCOP: number;
  /** enviado − gastado − devuelto */
  disponibleCOP: number;
  /** 0–100+ (puede pasar de 100 si se excede) */
  usedPercent: number;
  excedeCOP: number;
}

/** Corte congelado de las cuentas, para compartir por enlace o PDF. */
export interface SolarwinStatement {
  id: string;
  createdAt: string;
  createdByName?: string;
  /** Si viene, el documento solo incluye ese envío. */
  envioId?: string;
  bundle: SolarwinBundle;
  /** "Revisado y conforme" de Solar win, desde el enlace público. */
  acceptance?: SolarwinAcceptance;
}

export function emptySolarwinBundle(): SolarwinBundle {
  return { envios: [], gastos: [], docs: [] };
}

export function localISODate(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function cleanMoney(value: unknown): number {
  const n = Math.round(Number(value) || 0);
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}

function sanitizeEnvio(row: SolarwinEnvio): SolarwinEnvio | null {
  if (!row?.id) return null;
  return {
    ...row,
    amountCOP: cleanMoney(row.amountCOP),
    budgetCOP: row.budgetCOP ? cleanMoney(row.budgetCOP) : undefined,
    concept: String(row.concept || "").trim(),
    date: row.date || localISODate(),
  };
}

function sanitizeGasto(row: SolarwinGasto): SolarwinGasto | null {
  if (!row?.id || !row?.envioId) return null;
  return {
    ...row,
    amountCOP: cleanMoney(row.amountCOP),
    concept: String(row.concept || "").trim(),
    date: row.date || localISODate(),
    // Comprobantes de la versión anterior: tenían la foto dentro de la cuenta.
    receiptId:
      row.receiptId || (row.receiptDataUrl ? `legacy-${row.id}` : undefined),
  };
}

function normalizeBundle(raw: Partial<SolarwinBundle> | null | undefined): SolarwinBundle {
  const envios = (Array.isArray(raw?.envios) ? raw!.envios : [])
    .map(sanitizeEnvio)
    .filter((r): r is SolarwinEnvio => Boolean(r));
  const gastos = (Array.isArray(raw?.gastos) ? raw!.gastos : [])
    .map(sanitizeGasto)
    .filter((r): r is SolarwinGasto => Boolean(r));
  const docs = (Array.isArray(raw?.docs) ? raw!.docs : []).filter(
    (d): d is SolarwinDoc => Boolean(d?.id)
  );
  return { envios, gastos, docs };
}

export function loadSolarwinBundle(): SolarwinBundle {
  if (typeof window === "undefined") return emptySolarwinBundle();
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return emptySolarwinBundle();
    return normalizeBundle(JSON.parse(raw) as Partial<SolarwinBundle>);
  } catch {
    return emptySolarwinBundle();
  }
}

export function saveSolarwinBundle(bundle: SolarwinBundle): void {
  if (typeof window === "undefined") return;
  const clean = pruneTombstones(normalizeBundle(bundle));
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(clean));
  } catch {
    throw new Error(
      "No se pudo guardar en este navegador (almacenamiento lleno). Libere espacio e intente de nuevo."
    );
  }
}

function pruneTombstones(bundle: SolarwinBundle): SolarwinBundle {
  const cutoff = Date.now() - TOMBSTONE_DAYS * 86_400_000;
  const keep = (row: { deletedAt?: string }) =>
    !row.deletedAt || Date.parse(row.deletedAt) > cutoff;
  return {
    envios: bundle.envios.filter(keep),
    gastos: bundle.gastos.filter(keep),
    docs: (bundle.docs ?? []).filter(keep),
  };
}

function mergeById<T extends { id: string; updatedAt: string }>(
  local: T[],
  remote: T[]
): T[] {
  const byId = new Map<string, T>();
  for (const row of [...remote, ...local]) {
    if (!row?.id) continue;
    const prev = byId.get(row.id);
    if (!prev || Date.parse(row.updatedAt) >= Date.parse(prev.updatedAt)) {
      byId.set(row.id, row);
    }
  }
  return [...byId.values()];
}

export function mergeSolarwinBundle(
  local: SolarwinBundle,
  remote: Partial<SolarwinBundle> | null | undefined
): SolarwinBundle {
  const r = normalizeBundle(remote);
  const l = normalizeBundle(local);
  const gastos = mergeById(l.gastos, r.gastos).slice(0, 4000);
  // La nube guarda las cuentas sin fotos (van aparte). Si el ganador no trae la
  // copia local de la foto pero otra versión sí, y es la misma foto, se conserva.
  const photos = new Map<string, string>();
  for (const g of [...r.gastos, ...l.gastos]) {
    if (g.receiptDataUrl && g.receiptId) photos.set(g.receiptId, g.receiptDataUrl);
  }
  const healed = gastos.map((g) => {
    if (g.receiptDataUrl || g.deletedAt || !g.receiptId) return g;
    const url = photos.get(g.receiptId);
    return url ? { ...g, receiptDataUrl: url } : g;
  });
  return pruneTombstones({
    envios: mergeById(l.envios, r.envios).slice(0, 400),
    gastos: healed,
    docs: mergeById(l.docs ?? [], r.docs ?? []).slice(0, 400),
  });
}

export function activeEnvios(bundle: SolarwinBundle): SolarwinEnvio[] {
  return bundle.envios
    .filter((e) => !e.deletedAt)
    .sort((a, b) => {
      const byDate = Date.parse(b.date) - Date.parse(a.date);
      if (byDate !== 0) return byDate;
      return Date.parse(b.createdAt) - Date.parse(a.createdAt);
    });
}

export function gastosOfEnvio(
  bundle: SolarwinBundle,
  envioId: string
): SolarwinGasto[] {
  return bundle.gastos
    .filter((g) => g.envioId === envioId && !g.deletedAt)
    .sort((a, b) => {
      const byDate = Date.parse(b.date) - Date.parse(a.date);
      if (byDate !== 0) return byDate;
      return Date.parse(b.createdAt) - Date.parse(a.createdAt);
    });
}

export function totalsForEnvio(
  bundle: SolarwinBundle,
  envioId: string
): EnvioTotals {
  const envio = bundle.envios.find((e) => e.id === envioId && !e.deletedAt);
  const enviadoCOP = envio ? cleanMoney(envio.amountCOP) : 0;
  return buildTotals(enviadoCOP, gastosOfEnvio(bundle, envioId));
}

export function totalsAll(bundle: SolarwinBundle): EnvioTotals {
  const envios = activeEnvios(bundle);
  const ids = new Set(envios.map((e) => e.id));
  const enviadoCOP = envios.reduce((s, e) => s + cleanMoney(e.amountCOP), 0);
  return buildTotals(
    enviadoCOP,
    bundle.gastos.filter((g) => !g.deletedAt && ids.has(g.envioId))
  );
}

export function isDevolucion(g: SolarwinGasto): boolean {
  return g.kind === "devolucion";
}

function buildTotals(
  enviadoCOP: number,
  rows: SolarwinGasto[]
): EnvioTotals {
  let gastadoCOP = 0;
  let devueltoCOP = 0;
  for (const g of rows) {
    if (isDevolucion(g)) devueltoCOP += cleanMoney(g.amountCOP);
    else gastadoCOP += cleanMoney(g.amountCOP);
  }
  const salida = gastadoCOP + devueltoCOP;
  const disponibleCOP = enviadoCOP - salida;
  return {
    enviadoCOP,
    gastadoCOP,
    devueltoCOP,
    disponibleCOP,
    usedPercent:
      enviadoCOP > 0
        ? Math.round((salida / enviadoCOP) * 1000) / 10
        : salida > 0
          ? 100
          : 0,
    excedeCOP: disponibleCOP < 0 ? Math.abs(disponibleCOP) : 0,
  };
}

export interface PayerTotals {
  name: string;
  /** Todo lo que puso de su bolsillo. */
  totalCOP: number;
  /** Lo que ya se le repuso. */
  reimbursedCOP: number;
  /** Lo que aún se le debe. */
  pendingCOP: number;
}

/** Cuánto puso cada persona de su bolsillo (solo gastos, no devoluciones). */
export function totalsByPayer(bundle: SolarwinBundle): PayerTotals[] {
  const ids = new Set(activeEnvios(bundle).map((e) => e.id));
  const map = new Map<string, PayerTotals>();
  for (const g of bundle.gastos) {
    if (g.deletedAt || !ids.has(g.envioId) || isDevolucion(g)) continue;
    const name = (g.paidBy || "").trim();
    if (!name) continue;
    const row = map.get(name) ?? {
      name,
      totalCOP: 0,
      reimbursedCOP: 0,
      pendingCOP: 0,
    };
    const amount = cleanMoney(g.amountCOP);
    row.totalCOP += amount;
    if (g.reimbursedAt) row.reimbursedCOP += amount;
    else row.pendingCOP += amount;
    map.set(name, row);
  }
  return [...map.values()].sort((a, b) => b.totalCOP - a.totalCOP);
}

/** Marca (o desmarca) un gasto como ya repuesto a quien lo pagó. */
export function setReimbursed(
  bundle: SolarwinBundle,
  gastoId: string,
  on: boolean
): SolarwinBundle {
  const now = new Date().toISOString();
  return {
    ...bundle,
    gastos: bundle.gastos.map((g) =>
      g.id === gastoId
        ? { ...g, reimbursedAt: on ? now : undefined, updatedAt: now }
        : g
    ),
  };
}

/** Marca como repuestos todos los gastos pendientes de una persona. */
export function reimburseAllFor(
  bundle: SolarwinBundle,
  name: string
): SolarwinBundle {
  const now = new Date().toISOString();
  const ids = new Set(activeEnvios(bundle).map((e) => e.id));
  return {
    ...bundle,
    gastos: bundle.gastos.map((g) =>
      !g.deletedAt &&
      ids.has(g.envioId) &&
      !isDevolucion(g) &&
      (g.paidBy || "").trim() === name &&
      !g.reimbursedAt
        ? { ...g, reimbursedAt: now, updatedAt: now }
        : g
    ),
  };
}

export interface CategoryTotals {
  category: string;
  totalCOP: number;
  count: number;
  percent: number;
}

export const NO_CATEGORY = "Sin categoría";

/** Gasto total por categoría (excluye devoluciones). */
export function totalsByCategory(
  bundle: SolarwinBundle,
  envioId?: string
): CategoryTotals[] {
  const ids = new Set(
    activeEnvios(bundle)
      .filter((e) => !envioId || e.id === envioId)
      .map((e) => e.id)
  );
  const map = new Map<string, { totalCOP: number; count: number }>();
  let total = 0;
  for (const g of bundle.gastos) {
    if (g.deletedAt || !ids.has(g.envioId) || isDevolucion(g)) continue;
    const key = (g.category || "").trim() || NO_CATEGORY;
    const amount = cleanMoney(g.amountCOP);
    const row = map.get(key) ?? { totalCOP: 0, count: 0 };
    row.totalCOP += amount;
    row.count += 1;
    map.set(key, row);
    total += amount;
  }
  return [...map.entries()]
    .map(([category, v]) => ({
      category,
      ...v,
      percent: total > 0 ? Math.round((v.totalCOP / total) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.totalCOP - a.totalCOP);
}

export interface ProjectTotals {
  project: string;
  enviadoCOP: number;
  gastadoCOP: number;
  devueltoCOP: number;
  disponibleCOP: number;
  budgetCOP: number;
  envios: number;
}

/** Cuentas agrupadas por proyecto (solo envíos que tengan proyecto). */
export function totalsByProject(bundle: SolarwinBundle): ProjectTotals[] {
  const map = new Map<string, ProjectTotals>();
  for (const envio of activeEnvios(bundle)) {
    const project = (envio.project || "").trim();
    if (!project) continue;
    const t = totalsForEnvio(bundle, envio.id);
    const row = map.get(project) ?? {
      project,
      enviadoCOP: 0,
      gastadoCOP: 0,
      devueltoCOP: 0,
      disponibleCOP: 0,
      budgetCOP: 0,
      envios: 0,
    };
    row.enviadoCOP += t.enviadoCOP;
    row.gastadoCOP += t.gastadoCOP;
    row.devueltoCOP += t.devueltoCOP;
    row.disponibleCOP += t.disponibleCOP;
    row.budgetCOP += cleanMoney(envio.budgetCOP);
    row.envios += 1;
    map.set(project, row);
  }
  return [...map.values()].sort((a, b) => b.gastadoCOP - a.gastadoCOP);
}

export interface BudgetStatus {
  budgetCOP: number;
  gastadoCOP: number;
  /** % del presupuesto ya gastado (puede pasar de 100) */
  percent: number;
  /** presupuesto − gastado (negativo si se pasó) */
  restanteCOP: number;
  level: "ok" | "warn" | "over";
}

export function budgetStatus(
  budgetCOP: number | undefined,
  gastadoCOP: number
): BudgetStatus | null {
  const budget = cleanMoney(budgetCOP);
  if (!budget) return null;
  const percent = Math.round((gastadoCOP / budget) * 1000) / 10;
  return {
    budgetCOP: budget,
    gastadoCOP,
    percent,
    restanteCOP: budget - gastadoCOP,
    level: gastadoCOP > budget ? "over" : percent >= 85 ? "warn" : "ok",
  };
}

/** Registra un documento compartido para seguir su aceptación. */
export function addDoc(
  bundle: SolarwinBundle,
  doc: { id: string; envioId?: string; label: string }
): SolarwinBundle {
  const now = new Date().toISOString();
  const row: SolarwinDoc = { ...doc, createdAt: now, updatedAt: now };
  return {
    ...bundle,
    docs: [row, ...(bundle.docs ?? []).filter((d) => d.id !== row.id)],
  };
}

export function recordAcceptance(
  bundle: SolarwinBundle,
  docId: string,
  a: SolarwinAcceptance
): SolarwinBundle {
  const now = new Date().toISOString();
  return {
    ...bundle,
    docs: (bundle.docs ?? []).map((d) =>
      d.id === docId
        ? {
            ...d,
            acceptedAt: a.at,
            acceptedBy: a.name,
            acceptedNote: a.note,
            updatedAt: now,
          }
        : d
    ),
  };
}

export function removeDoc(bundle: SolarwinBundle, docId: string): SolarwinBundle {
  const now = new Date().toISOString();
  return {
    ...bundle,
    docs: (bundle.docs ?? []).map((d) =>
      d.id === docId ? { ...d, deletedAt: now, updatedAt: now } : d
    ),
  };
}

export function activeDocs(bundle: SolarwinBundle): SolarwinDoc[] {
  return (bundle.docs ?? [])
    .filter((d) => !d.deletedAt)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

function csvCell(value: unknown): string {
  const s = String(value ?? "");
  return /[";\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** CSV para Excel (separador ";" y BOM para tildes). */
export function buildSolarwinCsv(bundle: SolarwinBundle): string {
  const head = [
    "Fecha",
    "Tipo",
    "Envío",
    "Proyecto",
    "Concepto",
    "Categoría",
    "Quién pagó",
    "Reembolsado",
    "Monto (+/−)",
    "Notas",
    "Liquidado",
  ];
  const rows: unknown[][] = [];
  const envios = activeEnvios(bundle).sort(
    (a, b) => Date.parse(a.date) - Date.parse(b.date)
  );
  for (const e of envios) {
    const label = e.concept || "Envío";
    rows.push([
      e.date,
      "Envío",
      label,
      e.project || "",
      "Dinero enviado por Solar win",
      "",
      "",
      "",
      cleanMoney(e.amountCOP),
      e.notes || "",
      e.closedAt ? e.closedAt.slice(0, 10) : "",
    ]);
    for (const g of gastosOfEnvio(bundle, e.id).sort(
      (a, b) => Date.parse(a.date) - Date.parse(b.date)
    )) {
      rows.push([
        g.date,
        isDevolucion(g) ? "Devolución" : "Gasto",
        label,
        e.project || "",
        g.concept,
        g.category || "",
        g.paidBy || "",
        g.reimbursedAt ? g.reimbursedAt.slice(0, 10) : "",
        -cleanMoney(g.amountCOP),
        g.notes || "",
        e.closedAt ? e.closedAt.slice(0, 10) : "",
      ]);
    }
  }
  const lines = [head, ...rows].map((r) => r.map(csvCell).join(";"));
  return "\uFEFF" + lines.join("\r\n");
}

export function downloadSolarwinCsv(bundle: SolarwinBundle): void {
  const blob = new Blob([buildSolarwinCsv(bundle)], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `solarwin-cuentas-${localISODate()}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** Nombres y proyectos ya usados, para autocompletar. */
export function knownPayers(bundle: SolarwinBundle): string[] {
  return [
    ...new Set(
      bundle.gastos
        .filter((g) => !g.deletedAt)
        .map((g) => (g.paidBy || "").trim())
        .filter(Boolean)
    ),
  ];
}

export function knownProjects(bundle: SolarwinBundle): string[] {
  return [
    ...new Set(
      bundle.envios
        .filter((e) => !e.deletedAt)
        .map((e) => (e.project || "").trim())
        .filter(Boolean)
    ),
  ];
}

/** Liquida el envío: queda congelado hasta que se reabra. */
export function closeEnvio(
  bundle: SolarwinBundle,
  envioId: string
): SolarwinBundle {
  const now = new Date().toISOString();
  return {
    ...bundle,
    envios: bundle.envios.map((e) =>
      e.id === envioId ? { ...e, closedAt: now, updatedAt: now } : e
    ),
  };
}

export function reopenEnvio(
  bundle: SolarwinBundle,
  envioId: string
): SolarwinBundle {
  const now = new Date().toISOString();
  return {
    ...bundle,
    envios: bundle.envios.map((e) =>
      e.id === envioId ? { ...e, closedAt: undefined, updatedAt: now } : e
    ),
  };
}

/**
 * Lote para publicar un documento. Va sin fotos: el servidor las agrega
 * desde su almacenamiento (por `receiptId`).
 */
export function bundleForPublish(
  bundle: SolarwinBundle,
  envioId?: string
): SolarwinBundle {
  const envios = bundle.envios.filter(
    (e) => !e.deletedAt && (!envioId || e.id === envioId)
  );
  const ids = new Set(envios.map((e) => e.id));
  const gastos = bundle.gastos
    .filter((g) => !g.deletedAt && ids.has(g.envioId))
    .map((g) => ({ ...g, receiptDataUrl: undefined }));
  return { envios, gastos, docs: [] };
}

export function blankEnvio(): SolarwinEnvio {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    date: localISODate(),
    amountCOP: 0,
    concept: "",
    project: "",
    notes: "",
    createdAt: now,
    updatedAt: now,
  };
}

export function blankGasto(envioId: string): SolarwinGasto {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    envioId,
    date: localISODate(),
    concept: "",
    amountCOP: 0,
    kind: "gasto",
    paidBy: "",
    notes: "",
    createdAt: now,
    updatedAt: now,
  };
}

export function upsertEnvio(
  bundle: SolarwinBundle,
  envio: SolarwinEnvio
): SolarwinBundle {
  const row: SolarwinEnvio = {
    ...envio,
    amountCOP: cleanMoney(envio.amountCOP),
    concept: envio.concept.trim(),
    project: (envio.project || "").trim(),
    budgetCOP: envio.budgetCOP ? cleanMoney(envio.budgetCOP) : undefined,
    updatedAt: new Date().toISOString(),
  };
  return {
    ...bundle,
    envios: [row, ...bundle.envios.filter((e) => e.id !== row.id)],
  };
}

/** Borrado suave: el sync entre dispositivos respeta la eliminación. */
export function removeEnvio(
  bundle: SolarwinBundle,
  envioId: string
): SolarwinBundle {
  const now = new Date().toISOString();
  return {
    ...bundle,
    envios: bundle.envios.map((e) =>
      e.id === envioId ? { ...e, deletedAt: now, updatedAt: now } : e
    ),
    gastos: bundle.gastos.map((g) =>
      g.envioId === envioId && !g.deletedAt
        ? { ...g, deletedAt: now, updatedAt: now }
        : g
    ),
  };
}

export function upsertGasto(
  bundle: SolarwinBundle,
  gasto: SolarwinGasto
): SolarwinBundle {
  const row: SolarwinGasto = {
    ...gasto,
    amountCOP: cleanMoney(gasto.amountCOP),
    concept: gasto.concept.trim(),
    paidBy: (gasto.paidBy || "").trim(),
    category: (gasto.category || "").trim(),
    updatedAt: new Date().toISOString(),
  };
  return {
    ...bundle,
    gastos: [row, ...bundle.gastos.filter((g) => g.id !== row.id)],
  };
}

export function removeGasto(
  bundle: SolarwinBundle,
  gastoId: string
): SolarwinBundle {
  const now = new Date().toISOString();
  return {
    ...bundle,
    gastos: bundle.gastos.map((g) =>
      g.id === gastoId ? { ...g, deletedAt: now, updatedAt: now } : g
    ),
  };
}

const copFmt = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

export function formatCOP(value: number): string {
  return copFmt.format(Math.round(value || 0));
}

/** Resumen en texto para enviar a Solar win al cerrar cuentas. */
export function buildSolarwinSummary(bundle: SolarwinBundle): string {
  const envios = activeEnvios(bundle).sort(
    (a, b) => Date.parse(a.date) - Date.parse(b.date)
  );
  const all = totalsAll(bundle);
  const lines: string[] = [
    "CUENTAS SOLAR WIN · Genera Solutions SAS",
    `Generado: ${localISODate()}`,
    "",
    `Total enviado: ${formatCOP(all.enviadoCOP)}`,
    `Total gastado: ${formatCOP(all.gastadoCOP)}`,
    ...(all.devueltoCOP > 0
      ? [`Devuelto a Solar win: ${formatCOP(all.devueltoCOP)}`]
      : []),
    all.disponibleCOP >= 0
      ? `Saldo a favor de Solar win: ${formatCOP(all.disponibleCOP)}`
      : `Excedido (Genera adelantó): ${formatCOP(all.excedeCOP)}`,
    "",
  ];
  for (const envio of envios) {
    const t = totalsForEnvio(bundle, envio.id);
    lines.push(
      `■ ${envio.date} · ${envio.concept || "Envío"}${envio.project ? ` · ${envio.project}` : ""} · enviado ${formatCOP(t.enviadoCOP)}${envio.closedAt ? " · LIQUIDADO" : ""}`
    );
    const gastos = gastosOfEnvio(bundle, envio.id).sort(
      (a, b) => Date.parse(a.date) - Date.parse(b.date)
    );
    if (!gastos.length) lines.push("   (sin gastos aún)");
    for (const g of gastos) {
      lines.push(
        `   - ${g.date} · ${isDevolucion(g) ? "DEVOLUCIÓN · " : ""}${g.concept || "Gasto"}: ${formatCOP(g.amountCOP)}${g.paidBy ? ` · pagó ${g.paidBy}` : ""}${g.notes ? ` (${g.notes})` : ""}`
      );
    }
    lines.push(
      `   Gastado ${formatCOP(t.gastadoCOP)}${t.devueltoCOP ? ` · Devuelto ${formatCOP(t.devueltoCOP)}` : ""} · ${
        t.disponibleCOP >= 0
          ? `Disponible ${formatCOP(t.disponibleCOP)}`
          : `Excedido ${formatCOP(t.excedeCOP)}`
      }`,
      ""
    );
  }
  return lines.join("\n");
}

/**
 * Sincroniza con la nube. Las fotos de comprobantes NO viajan aquí: se suben
 * aparte (`/api/solarwin/foto`) y las cuentas solo guardan su `receiptId`.
 */
export async function persistSolarwinCloud(bundle: SolarwinBundle): Promise<void> {
  try {
    const slim: SolarwinBundle = {
      ...bundle,
      gastos: bundle.gastos.map((g) => ({ ...g, receiptDataUrl: undefined })),
    };
    await fetch("/api/archivo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ solarwin: slim }),
    });
  } catch {
    /* local ya quedó */
  }
}
