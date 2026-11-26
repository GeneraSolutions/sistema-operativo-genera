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
  notes?: string;
  /** Foto del comprobante (comprimida). "" = quitado a propósito. */
  receiptDataUrl?: string;
  receiptName?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface SolarwinBundle {
  envios: SolarwinEnvio[];
  gastos: SolarwinGasto[];
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
}

export function emptySolarwinBundle(): SolarwinBundle {
  return { envios: [], gastos: [] };
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
  };
}

function normalizeBundle(raw: Partial<SolarwinBundle> | null | undefined): SolarwinBundle {
  const envios = (Array.isArray(raw?.envios) ? raw!.envios : [])
    .map(sanitizeEnvio)
    .filter((r): r is SolarwinEnvio => Boolean(r));
  const gastos = (Array.isArray(raw?.gastos) ? raw!.gastos : [])
    .map(sanitizeGasto)
    .filter((r): r is SolarwinGasto => Boolean(r));
  return { envios, gastos };
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
  // Si el ganador viene sin foto (se recortó al sincronizar) pero la otra copia
  // la tiene, se conserva. "" significa que se quitó a propósito.
  const photos = new Map<string, { url: string; name?: string }>();
  for (const g of [...r.gastos, ...l.gastos]) {
    if (g.receiptDataUrl) {
      photos.set(g.id, { url: g.receiptDataUrl, name: g.receiptName });
    }
  }
  const healed = gastos.map((g) => {
    if (g.receiptDataUrl !== undefined || g.deletedAt) return g;
    const p = photos.get(g.id);
    return p ? { ...g, receiptDataUrl: p.url, receiptName: g.receiptName ?? p.name } : g;
  });
  return pruneTombstones({
    envios: mergeById(l.envios, r.envios).slice(0, 400),
    gastos: healed,
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

/** Cuánto puso cada persona de su bolsillo (solo gastos, no devoluciones). */
export function totalsByPayer(
  bundle: SolarwinBundle
): { name: string; totalCOP: number }[] {
  const ids = new Set(activeEnvios(bundle).map((e) => e.id));
  const map = new Map<string, number>();
  for (const g of bundle.gastos) {
    if (g.deletedAt || !ids.has(g.envioId) || isDevolucion(g)) continue;
    const name = (g.paidBy || "").trim();
    if (!name) continue;
    map.set(name, (map.get(name) || 0) + cleanMoney(g.amountCOP));
  }
  return [...map.entries()]
    .map(([name, totalCOP]) => ({ name, totalCOP }))
    .sort((a, b) => b.totalCOP - a.totalCOP);
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
 * Lote para publicar un documento. Si hay muchos comprobantes y el envío
 * superaría el límite de la petición, se omiten las fotos.
 */
export function bundleForPublish(
  bundle: SolarwinBundle,
  envioId?: string,
  maxChars = 3_800_000
): { bundle: SolarwinBundle; droppedReceipts: boolean } {
  const envios = bundle.envios.filter(
    (e) => !e.deletedAt && (!envioId || e.id === envioId)
  );
  const ids = new Set(envios.map((e) => e.id));
  const gastos = bundle.gastos.filter((g) => !g.deletedAt && ids.has(g.envioId));
  const scoped = { envios, gastos };
  if (JSON.stringify(scoped).length <= maxChars) {
    return { bundle: scoped, droppedReceipts: false };
  }
  return {
    bundle: {
      envios,
      gastos: gastos.map((g) => ({ ...g, receiptDataUrl: undefined })),
    },
    droppedReceipts: true,
  };
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
 * Sincroniza con la nube. Si con las fotos la petición se vuelve demasiado
 * grande, se omiten primero las más antiguas (ya subidas antes; el servidor
 * las conserva al unir).
 */
export async function persistSolarwinCloud(bundle: SolarwinBundle): Promise<void> {
  try {
    const MAX = 3_200_000;
    let body = JSON.stringify({ solarwin: bundle });
    if (body.length > MAX) {
      const withPhoto = bundle.gastos
        .filter((g) => g.receiptDataUrl)
        .sort((a, b) => Date.parse(a.updatedAt) - Date.parse(b.updatedAt));
      const strip = new Set<string>();
      for (const g of withPhoto) {
        strip.add(g.id);
        const slim = {
          ...bundle,
          gastos: bundle.gastos.map((x) =>
            strip.has(x.id) ? { ...x, receiptDataUrl: undefined } : x
          ),
        };
        body = JSON.stringify({ solarwin: slim });
        if (body.length <= MAX) break;
      }
    }
    await fetch("/api/archivo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
  } catch {
    /* local ya quedó */
  }
}
