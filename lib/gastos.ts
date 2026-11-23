import { slugCategory, type CustomCategory, type InventoryItem } from "@/types/inventory";

const PROJECTS_KEY = "genera.gastos.projects.v1";
const COMPRAS_KEY = "genera.gastos.compras.v1";
const PAGOS_KEY = "genera.gastos.pagos.v1";
const PRICES_KEY = "genera.gastos.precios.v1";
const SUBINV_KEY = "genera.gastos.subinventario.v1";
const PRESP_DOCS_KEY = "genera.gastos.presupuesto-docs.v1";
export const ACTIVE_GASTO_PROJECT_KEY = "genera:active-gasto-project";

export type GastoProjectSource = "obra" | "libre";

export interface GastoProject {
  id: string;
  name: string;
  source: GastoProjectSource;
  /** Si viene de Obra. */
  obraId?: string;
  clientName?: string;
  city?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CompraLine {
  id: string;
  name: string;
  qty: number;
  unitPriceCOP: number;
  /** Grupo / categoría inventario (id o label nuevo). */
  categoryId?: string;
  categoryLabel?: string;
  /** Si se debe crear/actualizar en inventario al confirmar. */
  addToInventory?: boolean;
  unit?: string;
  notes?: string;
}

export interface CompraGasto {
  id: string;
  projectId: string;
  supplier: string;
  place?: string;
  date: string;
  notes?: string;
  lines: CompraLine[];
  /** data URL o URL remota de la factura (opcional). */
  invoiceDataUrl?: string;
  invoiceName?: string;
  totalCOP: number;
  createdAt: string;
  updatedAt: string;
}

export interface PagoGasto {
  id: string;
  projectId: string;
  person: string;
  role: string;
  date: string;
  amountCOP: number;
  method?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

/** Precio observado por producto × lugar (para comparar). */
export interface PrecioObservado {
  id: string;
  productKey: string;
  productName: string;
  supplier: string;
  place?: string;
  unitPriceCOP: number;
  date: string;
  compraId: string;
  projectId: string;
}

/** Cotización o factura adjunta para armar presupuesto (no es compra cerrada). */
export interface PresupuestoDoc {
  id: string;
  projectId: string;
  kind: "cotizacion" | "factura";
  supplier: string;
  date: string;
  fileName?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Ítem del Sub inventario: materiales/equipos leídos de cotizaciones o facturas
 * para presupuestar el próximo proyecto. Aún no son el inventario principal.
 */
export interface SubInventarioItem {
  id: string;
  projectId: string;
  productKey: string;
  name: string;
  qty: number;
  unitPriceCOP: number;
  unit?: string;
  categoryId?: string;
  categoryLabel?: string;
  supplier?: string;
  sourceDocId?: string;
  sourceLabel?: string;
  createdAt: string;
  updatedAt: string;
}

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as T;
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(value));
}

export function loadGastoProjects(): GastoProject[] {
  const rows = readJson<GastoProject[]>(PROJECTS_KEY, []);
  return Array.isArray(rows) ? rows.filter((p) => p?.id && p?.name) : [];
}

export function saveGastoProjects(rows: GastoProject[]): void {
  writeJson(
    PROJECTS_KEY,
    rows
      .filter((p) => p?.id && p?.name)
      .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
      .slice(0, 80)
  );
}

export function upsertGastoProject(project: GastoProject): GastoProject[] {
  const all = loadGastoProjects().filter((p) => p.id !== project.id);
  const next = [{ ...project, updatedAt: new Date().toISOString() }, ...all];
  saveGastoProjects(next);
  return next;
}

export function loadCompras(): CompraGasto[] {
  const rows = readJson<CompraGasto[]>(COMPRAS_KEY, []);
  return Array.isArray(rows) ? rows.filter((c) => c?.id && c?.projectId) : [];
}

export function saveCompras(rows: CompraGasto[]): void {
  writeJson(COMPRAS_KEY, rows.slice(0, 400));
}

export function upsertCompra(compra: CompraGasto): CompraGasto[] {
  const total =
    compra.lines.reduce(
      (s, l) => s + Math.round((Number(l.qty) || 0) * (Number(l.unitPriceCOP) || 0)),
      0
    ) || compra.totalCOP;
  const row: CompraGasto = {
    ...compra,
    totalCOP: total,
    updatedAt: new Date().toISOString(),
  };
  const next = [row, ...loadCompras().filter((c) => c.id !== row.id)];
  saveCompras(next);
  return next;
}

export function deleteCompra(id: string): CompraGasto[] {
  const next = loadCompras().filter((c) => c.id !== id);
  saveCompras(next);
  return next;
}

export function loadPagos(): PagoGasto[] {
  const rows = readJson<PagoGasto[]>(PAGOS_KEY, []);
  return Array.isArray(rows) ? rows.filter((p) => p?.id && p?.projectId) : [];
}

export function savePagos(rows: PagoGasto[]): void {
  writeJson(PAGOS_KEY, rows.slice(0, 400));
}

export function upsertPago(pago: PagoGasto): PagoGasto[] {
  const row = { ...pago, updatedAt: new Date().toISOString() };
  const next = [row, ...loadPagos().filter((p) => p.id !== row.id)];
  savePagos(next);
  return next;
}

export function deletePago(id: string): PagoGasto[] {
  const next = loadPagos().filter((p) => p.id !== id);
  savePagos(next);
  return next;
}

export function loadPrecios(): PrecioObservado[] {
  const rows = readJson<PrecioObservado[]>(PRICES_KEY, []);
  return Array.isArray(rows) ? rows.filter((p) => p?.id) : [];
}

export function savePrecios(rows: PrecioObservado[]): void {
  writeJson(PRICES_KEY, rows.slice(0, 800));
}

export function productKey(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

export function loadSubInventario(): SubInventarioItem[] {
  const rows = readJson<SubInventarioItem[]>(SUBINV_KEY, []);
  return Array.isArray(rows) ? rows.filter((r) => r?.id && r?.projectId) : [];
}

export function saveSubInventario(rows: SubInventarioItem[]): void {
  writeJson(SUBINV_KEY, rows.slice(0, 800));
}

export function upsertSubItem(item: SubInventarioItem): SubInventarioItem[] {
  const row = {
    ...item,
    productKey: item.productKey || productKey(item.name),
    updatedAt: new Date().toISOString(),
  };
  const next = [row, ...loadSubInventario().filter((r) => r.id !== row.id)];
  saveSubInventario(next);
  return next;
}

export function deleteSubItem(id: string): SubInventarioItem[] {
  const next = loadSubInventario().filter((r) => r.id !== id);
  saveSubInventario(next);
  return next;
}

export function deleteSubItems(ids: string[]): SubInventarioItem[] {
  const drop = new Set(ids);
  const next = loadSubInventario().filter((r) => !drop.has(r.id));
  saveSubInventario(next);
  return next;
}

export function subInventarioForProject(projectId: string): SubInventarioItem[] {
  return loadSubInventario()
    .filter((r) => r.projectId === projectId)
    .sort((a, b) => a.name.localeCompare(b.name, "es"));
}

/** Suma presupuestada del sub inventario del proyecto. */
export function subInventarioTotalCOP(projectId: string): number {
  return subInventarioForProject(projectId).reduce(
    (s, r) => s + Math.round((Number(r.qty) || 0) * (Number(r.unitPriceCOP) || 0)),
    0
  );
}

export function loadPresupuestoDocs(): PresupuestoDoc[] {
  const rows = readJson<PresupuestoDoc[]>(PRESP_DOCS_KEY, []);
  return Array.isArray(rows) ? rows.filter((d) => d?.id && d?.projectId) : [];
}

export function savePresupuestoDocs(rows: PresupuestoDoc[]): void {
  writeJson(PRESP_DOCS_KEY, rows.slice(0, 200));
}

export function upsertPresupuestoDoc(doc: PresupuestoDoc): PresupuestoDoc[] {
  const row = { ...doc, updatedAt: new Date().toISOString() };
  const next = [row, ...loadPresupuestoDocs().filter((d) => d.id !== row.id)];
  savePresupuestoDocs(next);
  return next;
}

export function deletePresupuestoDoc(id: string): {
  docs: PresupuestoDoc[];
  sub: SubInventarioItem[];
} {
  const docs = loadPresupuestoDocs().filter((d) => d.id !== id);
  savePresupuestoDocs(docs);
  const sub = loadSubInventario().filter((r) => r.sourceDocId !== id);
  saveSubInventario(sub);
  return { docs, sub };
}

export function blankSubItem(projectId: string): SubInventarioItem {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    projectId,
    productKey: "",
    name: "",
    qty: 1,
    unitPriceCOP: 0,
    unit: "und",
    categoryLabel: "Presupuesto",
    categoryId: "presupuesto",
    createdAt: now,
    updatedAt: now,
  };
}

/** Importa líneas leídas de una cotización/factura al Sub inventario. */
export function importLinesToSubInventario(opts: {
  projectId: string;
  doc: PresupuestoDoc;
  lines: {
    name: string;
    qty: number;
    unitPriceCOP: number;
    unit?: string;
    categoryLabel?: string;
  }[];
}): SubInventarioItem[] {
  const now = new Date().toISOString();
  const incoming: SubInventarioItem[] = opts.lines
    .filter((l) => l.name.trim())
    .map((l) => {
      const name = l.name.trim();
      return {
        id: crypto.randomUUID(),
        projectId: opts.projectId,
        productKey: productKey(name),
        name,
        qty: Number(l.qty) > 0 ? Number(l.qty) : 1,
        unitPriceCOP: Math.max(0, Math.round(Number(l.unitPriceCOP) || 0)),
        unit: l.unit || "und",
        categoryLabel: l.categoryLabel || "Presupuesto",
        categoryId: slugCategory(l.categoryLabel || "Presupuesto"),
        supplier: opts.doc.supplier,
        sourceDocId: opts.doc.id,
        sourceLabel: `${opts.doc.kind === "cotizacion" ? "Cotización" : "Factura"} · ${opts.doc.supplier}`,
        createdAt: now,
        updatedAt: now,
      };
    });
  upsertPresupuestoDoc(opts.doc);
  const next = [...incoming, ...loadSubInventario()].slice(0, 800);
  saveSubInventario(next);
  return next;
}

export function mergeSubInventario(
  local: SubInventarioItem[],
  remote: SubInventarioItem[]
): SubInventarioItem[] {
  const byId = new Map<string, SubInventarioItem>();
  for (const row of [...remote, ...local]) {
    if (!row?.id) continue;
    const prev = byId.get(row.id);
    if (!prev || Date.parse(row.updatedAt) >= Date.parse(prev.updatedAt)) {
      byId.set(row.id, row);
    }
  }
  return [...byId.values()].slice(0, 800);
}

export function mergePresupuestoDocs(
  local: PresupuestoDoc[],
  remote: PresupuestoDoc[]
): PresupuestoDoc[] {
  const byId = new Map<string, PresupuestoDoc>();
  for (const row of [...remote, ...local]) {
    if (!row?.id) continue;
    const prev = byId.get(row.id);
    if (!prev || Date.parse(row.updatedAt) >= Date.parse(prev.updatedAt)) {
      byId.set(row.id, row);
    }
  }
  return [...byId.values()].slice(0, 200);
}

/** Claves de producto repetidas en el sub inventario del proyecto. */
export function duplicateProductKeys(projectId: string): Set<string> {
  const counts = new Map<string, number>();
  for (const row of subInventarioForProject(projectId)) {
    counts.set(row.productKey, (counts.get(row.productKey) || 0) + 1);
  }
  return new Set(
    [...counts.entries()].filter(([, n]) => n > 1).map(([k]) => k)
  );
}

/** Pasa ítems del sub inventario al inventario principal. */
export function promoteSubItemsToInventory(
  items: SubInventarioItem[],
  inventory: InventoryItem[],
  customCats: CustomCategory[]
): { inventory: InventoryItem[]; customCats: CustomCategory[] } {
  const lines: CompraLine[] = items.map((r) => ({
    id: r.id,
    name: r.name,
    qty: r.qty,
    unitPriceCOP: r.unitPriceCOP,
    unit: r.unit,
    categoryId: r.categoryId,
    categoryLabel: r.categoryLabel,
    addToInventory: true,
  }));
  return applyCompraLinesToInventory(lines, inventory, customCats);
}

/** Registra precios de una compra para el comparador. */
export function recordPreciosFromCompra(compra: CompraGasto): PrecioObservado[] {
  const existing = loadPrecios().filter((p) => p.compraId !== compra.id);
  const added: PrecioObservado[] = compra.lines
    .filter((l) => l.name.trim() && l.unitPriceCOP > 0)
    .map((l) => ({
      id: `px-${compra.id}-${l.id}`,
      productKey: productKey(l.name),
      productName: l.name.trim(),
      supplier: compra.supplier || "Sin proveedor",
      place: compra.place || compra.supplier,
      unitPriceCOP: Math.round(l.unitPriceCOP),
      date: compra.date,
      compraId: compra.id,
      projectId: compra.projectId,
    }));
  const next = [...added, ...existing].slice(0, 800);
  savePrecios(next);
  return next;
}

export function comprasForProject(projectId: string): CompraGasto[] {
  return loadCompras()
    .filter((c) => c.projectId === projectId)
    .sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
}

export function pagosForProject(projectId: string): PagoGasto[] {
  return loadPagos()
    .filter((p) => p.projectId === projectId)
    .sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
}

export function projectTotals(projectId: string): {
  comprasCOP: number;
  pagosCOP: number;
  totalCOP: number;
} {
  const comprasCOP = comprasForProject(projectId).reduce(
    (s, c) => s + (c.totalCOP || 0),
    0
  );
  const pagosCOP = pagosForProject(projectId).reduce(
    (s, p) => s + (p.amountCOP || 0),
    0
  );
  return { comprasCOP, pagosCOP, totalCOP: comprasCOP + pagosCOP };
}

/** Mejor precio unitario visto por producto (más barato primero). */
export function cheapestByProduct(): {
  productKey: string;
  productName: string;
  best: PrecioObservado;
  others: PrecioObservado[];
}[] {
  const map = new Map<string, PrecioObservado[]>();
  for (const row of loadPrecios()) {
    const list = map.get(row.productKey) ?? [];
    list.push(row);
    map.set(row.productKey, list);
  }
  return [...map.entries()]
    .map(([productKey, rows]) => {
      const sorted = [...rows].sort((a, b) => a.unitPriceCOP - b.unitPriceCOP);
      return {
        productKey,
        productName: sorted[0]?.productName || productKey,
        best: sorted[0],
        others: sorted.slice(1, 5),
      };
    })
    .filter((row) => row.best)
    .sort((a, b) => a.productName.localeCompare(b.productName, "es"));
}

export function pinActiveGastoProject(id: string): void {
  if (typeof window === "undefined" || !id) return;
  sessionStorage.setItem(ACTIVE_GASTO_PROJECT_KEY, id);
}

export function getActiveGastoProjectId(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(ACTIVE_GASTO_PROJECT_KEY);
}

export function mergeGastoProjects(
  local: GastoProject[],
  remote: GastoProject[]
): GastoProject[] {
  const byId = new Map<string, GastoProject>();
  for (const row of [...remote, ...local]) {
    if (!row?.id) continue;
    const prev = byId.get(row.id);
    if (!prev || Date.parse(row.updatedAt) >= Date.parse(prev.updatedAt)) {
      byId.set(row.id, row);
    }
  }
  return [...byId.values()].sort(
    (a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)
  );
}

export function mergeCompras(
  local: CompraGasto[],
  remote: CompraGasto[]
): CompraGasto[] {
  const byId = new Map<string, CompraGasto>();
  for (const row of [...remote, ...local]) {
    if (!row?.id) continue;
    const prev = byId.get(row.id);
    if (!prev || Date.parse(row.updatedAt) >= Date.parse(prev.updatedAt)) {
      byId.set(row.id, row);
    }
  }
  return [...byId.values()].slice(0, 400);
}

export function mergePagos(local: PagoGasto[], remote: PagoGasto[]): PagoGasto[] {
  const byId = new Map<string, PagoGasto>();
  for (const row of [...remote, ...local]) {
    if (!row?.id) continue;
    const prev = byId.get(row.id);
    if (!prev || Date.parse(row.updatedAt) >= Date.parse(prev.updatedAt)) {
      byId.set(row.id, row);
    }
  }
  return [...byId.values()].slice(0, 400);
}

export interface GastoBundle {
  projects: GastoProject[];
  compras: CompraGasto[];
  pagos: PagoGasto[];
  precios: PrecioObservado[];
  subInventario: SubInventarioItem[];
  presupuestoDocs: PresupuestoDoc[];
}

export function loadGastoBundle(): GastoBundle {
  return {
    projects: loadGastoProjects(),
    compras: loadCompras(),
    pagos: loadPagos(),
    precios: loadPrecios(),
    subInventario: loadSubInventario(),
    presupuestoDocs: loadPresupuestoDocs(),
  };
}

export function applyGastoBundle(bundle: GastoBundle): void {
  if (bundle.projects) saveGastoProjects(bundle.projects);
  if (bundle.compras) saveCompras(bundle.compras);
  if (bundle.pagos) savePagos(bundle.pagos);
  if (bundle.precios) savePrecios(bundle.precios);
  if (bundle.subInventario) saveSubInventario(bundle.subInventario);
  if (bundle.presupuestoDocs) savePresupuestoDocs(bundle.presupuestoDocs);
}

export function mergeGastoBundle(
  local: GastoBundle,
  remote: Partial<GastoBundle> | null | undefined
): GastoBundle {
  if (!remote) return local;
  const compras = mergeCompras(local.compras, remote.compras ?? []);
  const preciosFromCompras = compras.flatMap((c) => {
    return c.lines
      .filter((l) => l.name.trim() && l.unitPriceCOP > 0)
      .map((l) => ({
        id: `px-${c.id}-${l.id}`,
        productKey: productKey(l.name),
        productName: l.name.trim(),
        supplier: c.supplier || "Sin proveedor",
        place: c.place || c.supplier,
        unitPriceCOP: Math.round(l.unitPriceCOP),
        date: c.date,
        compraId: c.id,
        projectId: c.projectId,
      }));
  });
  return {
    projects: mergeGastoProjects(local.projects, remote.projects ?? []),
    compras,
    pagos: mergePagos(local.pagos, remote.pagos ?? []),
    precios: [...preciosFromCompras, ...(remote.precios ?? []), ...local.precios]
      .filter((row, i, arr) => arr.findIndex((x) => x.id === row.id) === i)
      .slice(0, 800),
    subInventario: mergeSubInventario(
      local.subInventario ?? [],
      remote.subInventario ?? []
    ),
    presupuestoDocs: mergePresupuestoDocs(
      local.presupuestoDocs ?? [],
      remote.presupuestoDocs ?? []
    ),
  };
}

export function blankCompraLine(): CompraLine {
  return {
    id: `ln-${crypto.randomUUID().slice(0, 8)}`,
    name: "",
    qty: 1,
    unitPriceCOP: 0,
    addToInventory: true,
    unit: "und",
  };
}

export function blankCompra(projectId: string): CompraGasto {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    projectId,
    supplier: "",
    place: "",
    date: now.slice(0, 10),
    notes: "",
    lines: [blankCompraLine()],
    totalCOP: 0,
    createdAt: now,
    updatedAt: now,
  };
}

export function blankPago(projectId: string): PagoGasto {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    projectId,
    person: "",
    role: "Técnico",
    date: now.slice(0, 10),
    amountCOP: 0,
    method: "Transferencia",
    notes: "",
    createdAt: now,
    updatedAt: now,
  };
}

/** Aplica líneas marcadas al inventario local. */
export function applyCompraLinesToInventory(
  lines: CompraLine[],
  inventory: InventoryItem[],
  customCats: CustomCategory[]
): { inventory: InventoryItem[]; customCats: CustomCategory[] } {
  const cats = [...customCats];
  const items = [...inventory];
  const now = new Date().toISOString();

  for (const line of lines) {
    if (!line.addToInventory || !line.name.trim()) continue;
    let catId = line.categoryId?.trim() || "";
    const catLabel = (line.categoryLabel || line.categoryId || "Compras").trim();
    if (!catId || catId === catLabel) {
      catId = slugCategory(catLabel);
    }
    if (
      !cats.some((c) => c.id === catId) &&
      ![
        "inverter",
        "panel",
        "battery",
        "cabling",
        "structure",
        "protection_dc",
        "protection_ac",
        "dps",
        "ac_cable",
        "ground_cable",
        "ground_rod",
        "protection_box",
        "combiner",
        "mc4",
        "lszh_sheath",
        "metal_channel",
        "microinverter",
        "ev_charger",
      ].includes(catId)
    ) {
      cats.push({ id: catId, label: catLabel || catId });
    }

    const name = line.name.trim();
    const existing = items.find(
      (i) =>
        i.category === catId &&
        `${i.brand} ${i.model} ${i.name}`.toLowerCase().includes(name.toLowerCase())
    );
    if (existing) {
      existing.priceCOP = Math.round(line.unitPriceCOP);
      existing.updatedAt = now;
      if (line.qty > 0) {
        existing.stock = (existing.stock ?? 0) + Math.round(line.qty);
      }
      continue;
    }

    items.push({
      id: `compra-${catId}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      category: catId,
      name,
      brand: "Compra",
      model: name,
      priceCOP: Math.round(line.unitPriceCOP),
      priceUSD: 0,
      marginPercent: 0,
      applyIva: true,
      unit: line.unit || "und",
      isDefault: false,
      active: true,
      stock: Math.max(0, Math.round(line.qty)),
      notes: "Alta desde factura / gasto",
      updatedAt: now,
    });
  }

  return { inventory: items, customCats: cats };
}

export async function persistGastosCloud(bundle: GastoBundle): Promise<void> {
  try {
    await fetch("/api/archivo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gastos: bundle }),
    });
  } catch {
    /* local ya quedó */
  }
}
