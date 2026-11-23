"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Building2,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  PackagePlus,
  Plus,
  Receipt,
  Send,
  Trash2,
  Upload,
  Users,
  Wallet,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import {
  applyCompraLinesToInventory,
  applyGastoBundle,
  blankCompra,
  blankCompraLine,
  blankPago,
  blankSubItem,
  cheapestByProduct,
  deleteCompra,
  deletePago,
  deletePresupuestoDoc,
  deleteSubItem,
  deleteSubItems,
  getActiveGastoProjectId,
  importLinesToSubInventario,
  loadGastoBundle,
  mergeGastoBundle,
  persistGastosCloud,
  pinActiveGastoProject,
  productKey,
  projectTotals,
  promoteSubItemsToInventory,
  recordPreciosFromCompra,
  subInventarioTotalCOP,
  upsertCompra,
  upsertGastoProject,
  upsertPago,
  upsertPresupuestoDoc,
  upsertSubItem,
  type CompraGasto,
  type CompraLine,
  type GastoProject,
  type PagoGasto,
  type PresupuestoDoc,
  type SubInventarioItem,
} from "@/lib/gastos";
import { isPdfFile, renderBillPdf } from "@/lib/bill-pdf";
import {
  loadCustomCategories,
  loadInventory,
  saveCustomCategories,
  saveInventory,
} from "@/lib/inventory";
import { loadObras, obraLabel, type ObraJob } from "@/lib/obra";
import { sendSubItemsToCotizador } from "@/lib/subinv-to-quote";
import { BUILTIN_CATEGORIES, slugCategory } from "@/types/inventory";

const cop = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

const field =
  "w-full rounded-xl border border-[#d8d2c4] bg-[#fbfaf6] px-3 py-2.5 text-sm";

type Tab = "compras" | "pagos" | "precios" | "sub";

function lineTotal(l: CompraLine) {
  return Math.round((Number(l.qty) || 0) * (Number(l.unitPriceCOP) || 0));
}

export default function GastosPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<GastoProject[]>([]);
  const [obras, setObras] = useState<ObraJob[]>([]);
  const [projectId, setProjectId] = useState<string>("");
  const [tab, setTab] = useState<Tab>("compras");
  const [compras, setCompras] = useState<CompraGasto[]>([]);
  const [pagos, setPagos] = useState<PagoGasto[]>([]);
  const [subItems, setSubItems] = useState<SubInventarioItem[]>([]);
  const [presupDocs, setPresupDocs] = useState<PresupuestoDoc[]>([]);
  const [draftCompra, setDraftCompra] = useState<CompraGasto | null>(null);
  const [draftPago, setDraftPago] = useState<PagoGasto | null>(null);
  const [docKind, setDocKind] = useState<"cotizacion" | "factura">("cotizacion");
  const [expandedSub, setExpandedSub] = useState<Record<string, boolean>>({});
  const [expandedDocs, setExpandedDocs] = useState<Record<string, boolean>>({});
  const [newProjectName, setNewProjectName] = useState("");
  const [pickObraId, setPickObraId] = useState("");
  const [flash, setFlash] = useState("");
  const [reading, setReading] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const localWriteGen = useRef(0);

  const active = projects.find((p) => p.id === projectId) || null;
  const totals = useMemo(
    () => (projectId ? projectTotals(projectId) : { comprasCOP: 0, pagosCOP: 0, totalCOP: 0 }),
    [projectId, compras, pagos]
  );
  const projectCompras = useMemo(
    () => compras.filter((c) => c.projectId === projectId),
    [compras, projectId]
  );
  const projectPagos = useMemo(
    () => pagos.filter((p) => p.projectId === projectId),
    [pagos, projectId]
  );
  const priceBoard = useMemo(() => cheapestByProduct(), [compras]);
  const projectSub = useMemo(
    () => subItems.filter((r) => r.projectId === projectId),
    [subItems, projectId]
  );
  const projectDocs = useMemo(
    () =>
      presupDocs
        .filter((d) => d.projectId === projectId)
        .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)),
    [presupDocs, projectId]
  );
  /** Cada cotización/factura es un bloque independiente; manual aparte. */
  const subGroups = useMemo(() => {
    const itemsByDoc = new Map<string, SubInventarioItem[]>();
    const manual: SubInventarioItem[] = [];
    for (const row of projectSub) {
      if (row.sourceDocId) {
        const list = itemsByDoc.get(row.sourceDocId) || [];
        list.push(row);
        itemsByDoc.set(row.sourceDocId, list);
      } else {
        manual.push(row);
      }
    }
    type SubGroup = {
      key: string;
      doc: PresupuestoDoc | null;
      items: SubInventarioItem[];
      totalCOP: number;
    };
    const docs: SubGroup[] = projectDocs.map((doc) => {
      const items = (itemsByDoc.get(doc.id) || []).sort((a, b) =>
        a.name.localeCompare(b.name, "es")
      );
      itemsByDoc.delete(doc.id);
      const totalCOP = items.reduce(
        (s, r) =>
          s + Math.round((Number(r.qty) || 0) * (Number(r.unitPriceCOP) || 0)),
        0
      );
      return { key: doc.id, doc, items, totalCOP };
    });
    // Ítems huérfanos (doc borrado a medias)
    for (const [docId, items] of itemsByDoc) {
      const totalCOP = items.reduce(
        (s, r) =>
          s + Math.round((Number(r.qty) || 0) * (Number(r.unitPriceCOP) || 0)),
        0
      );
      docs.push({
        key: docId,
        doc: null,
        items: items.sort((a, b) => a.name.localeCompare(b.name, "es")),
        totalCOP,
      });
    }
    const manualTotal = manual.reduce(
      (s, r) =>
        s + Math.round((Number(r.qty) || 0) * (Number(r.unitPriceCOP) || 0)),
      0
    );
    return {
      docs,
      manual: manual.sort((a, b) => a.name.localeCompare(b.name, "es")),
      manualTotal,
    };
  }, [projectDocs, projectSub]);
  const subBudgetCOP = useMemo(
    () => (projectId ? subInventarioTotalCOP(projectId) : 0),
    [projectId, subItems]
  );

  function dupKeysIn(items: SubInventarioItem[]): Set<string> {
    const counts = new Map<string, number>();
    for (const row of items) {
      counts.set(row.productKey, (counts.get(row.productKey) || 0) + 1);
    }
    return new Set(
      [...counts.entries()].filter(([, n]) => n > 1).map(([k]) => k)
    );
  }

  const categoryOptions = useMemo(() => {
    const custom = loadCustomCategories();
    return [
      ...BUILTIN_CATEGORIES.map((c) => ({ id: c.id, label: c.label })),
      ...custom.map((c) => ({ id: c.id, label: c.label })),
    ];
  }, [draftCompra, flash]);

  useEffect(() => {
    setObras(loadObras());
    const local = loadGastoBundle();
    applyGastoBundle(local);
    setProjects(local.projects);
    setCompras(local.compras);
    setPagos(local.pagos);
    setSubItems(local.subInventario ?? []);
    setPresupDocs(local.presupuestoDocs ?? []);
    const pinned = getActiveGastoProjectId();
    if (pinned && local.projects.some((p) => p.id === pinned)) {
      setProjectId(pinned);
    } else if (local.projects[0]) {
      setProjectId(local.projects[0].id);
      pinActiveGastoProject(local.projects[0].id);
    }
    setHydrated(true);
    const bootGen = localWriteGen.current;
    void fetch("/api/archivo", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data?.gastos) return;
        // Si el usuario ya guardó algo localmente, merge contra lo último
        const merged = mergeGastoBundle(loadGastoBundle(), data.gastos);
        applyGastoBundle(merged);
        setProjects(merged.projects);
        setCompras(merged.compras);
        setPagos(merged.pagos);
        // No pisar Sub inventario si hubo escrituras locales durante el fetch
        if (localWriteGen.current === bootGen) {
          setSubItems(merged.subInventario ?? []);
          setPresupDocs(merged.presupuestoDocs ?? []);
        } else {
          const latest = loadGastoBundle();
          const again = mergeGastoBundle(latest, data.gastos);
          applyGastoBundle(again);
          setSubItems(again.subInventario ?? []);
          setPresupDocs(again.presupuestoDocs ?? []);
        }
      })
      .catch(() => undefined);
  }, []);

  function bumpLocalWrite() {
    localWriteGen.current += 1;
  }

  function refreshSubStateFromStorage() {
    const bundle = loadGastoBundle();
    setSubItems(bundle.subInventario ?? []);
    setPresupDocs(bundle.presupuestoDocs ?? []);
  }

  function syncCloud() {
    void persistGastosCloud(loadGastoBundle());
  }

  function selectProject(id: string) {
    setProjectId(id);
    pinActiveGastoProject(id);
    setDraftCompra(null);
    setDraftPago(null);
  }

  function createLibreProject() {
    const name = newProjectName.trim();
    if (!name) return;
    const now = new Date().toISOString();
    const project: GastoProject = {
      id: crypto.randomUUID(),
      name,
      source: "libre",
      createdAt: now,
      updatedAt: now,
    };
    const next = upsertGastoProject(project);
    setProjects(next);
    selectProject(project.id);
    setNewProjectName("");
    syncCloud();
    setFlash("Proyecto creado.");
  }

  function createFromObra() {
    const obra = obras.find((o) => o.id === pickObraId);
    if (!obra) return;
    const existing = projects.find((p) => p.obraId === obra.id);
    if (existing) {
      selectProject(existing.id);
      setFlash("Esa obra ya tenía control de gastos.");
      return;
    }
    const now = new Date().toISOString();
    const project: GastoProject = {
      id: crypto.randomUUID(),
      name: obraLabel(obra),
      source: "obra",
      obraId: obra.id,
      clientName: obra.clientName,
      city: obra.city,
      createdAt: now,
      updatedAt: now,
    };
    const next = upsertGastoProject(project);
    setProjects(next);
    selectProject(project.id);
    setPickObraId("");
    syncCloud();
    setFlash("Proyecto amarrado a la obra.");
  }

  function openNewCompra() {
    if (!projectId) return;
    setDraftCompra(blankCompra(projectId));
  }

  function openNewPago() {
    if (!projectId) return;
    setDraftPago(blankPago(projectId));
  }

  function saveDraftCompra(toInventory: boolean) {
    if (!draftCompra || !projectId) return;
    const lines = draftCompra.lines
      .map((l) => ({
        ...l,
        name: l.name.trim(),
        addToInventory: toInventory ? Boolean(l.addToInventory) : false,
      }))
      .filter((l) => l.name);
    if (!lines.length) {
      setFlash("Agregue al menos un ítem con nombre.");
      return;
    }
    const compra: CompraGasto = {
      ...draftCompra,
      projectId,
      supplier: draftCompra.supplier.trim() || "Sin proveedor",
      lines,
      totalCOP: lines.reduce((s, l) => s + lineTotal(l), 0),
    };
    const next = upsertCompra(compra);
    setCompras(next);
    recordPreciosFromCompra(compra);

    if (toInventory) {
      const marked = lines.filter((l) => l.addToInventory);
      if (marked.length) {
        const result = applyCompraLinesToInventory(
          marked,
          loadInventory(),
          loadCustomCategories()
        );
        saveInventory(result.inventory);
        saveCustomCategories(result.customCats);
        setFlash(
          `Compra guardada. ${marked.length} ítem(s) pasaron al inventario.`
        );
      } else {
        setFlash("Compra guardada (sin ítems al inventario).");
      }
    } else {
      setFlash("Compra guardada.");
    }
    setDraftCompra(null);
    syncCloud();
  }

  function saveDraftPago() {
    if (!draftPago || !projectId) return;
    if (!draftPago.person.trim() || draftPago.amountCOP <= 0) {
      setFlash("Indique persona y monto.");
      return;
    }
    const next = upsertPago({
      ...draftPago,
      projectId,
      person: draftPago.person.trim(),
    });
    setPagos(next);
    setDraftPago(null);
    setFlash("Pago registrado.");
    syncCloud();
  }

  async function shrinkDataUrl(
    dataUrl: string,
    maxChars = 1_600_000
  ): Promise<string> {
    if (!dataUrl || dataUrl.length <= maxChars) return dataUrl;
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, Math.sqrt(maxChars / dataUrl.length) * 0.9);
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(640, Math.round(img.width * scale));
        canvas.height = Math.max(480, Math.round(img.height * scale));
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(dataUrl);
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        let out = canvas.toDataURL("image/jpeg", 0.62);
        if (out.length > maxChars) {
          out = canvas.toDataURL("image/jpeg", 0.45);
        }
        resolve(out);
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });
  }

  async function prepareDocForOcr(file: File): Promise<{
    imageDataUrl: string;
    pdfText: string;
  }> {
    if (isPdfFile(file)) {
      const rendered = await renderBillPdf(file, 2);
      const imageDataUrl = await shrinkDataUrl(
        rendered.pages[0]?.dataUrl || ""
      );
      return {
        imageDataUrl,
        pdfText: rendered.text || "",
      };
    }
    const raw = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("read"));
      reader.readAsDataURL(file);
    });
    return { imageDataUrl: await shrinkDataUrl(raw), pdfText: "" };
  }

  async function onInvoiceFile(file: File | null) {
    if (!file || !draftCompra) return;
    if (file.size > 12_000_000) {
      setFlash("Archivo muy pesado (máx. ~12 MB).");
      return;
    }
    setReading(true);
    setFlash("Leyendo factura…");
    try {
      const prepared = await prepareDocForOcr(file);
      if (!prepared.imageDataUrl && !prepared.pdfText) {
        setFlash("No se pudo leer el archivo. Pruebe una foto o PDF.");
        return;
      }

      const res = await fetch("/api/gastos/factura", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageDataUrl: prepared.imageDataUrl || undefined,
          pdfText: prepared.pdfText || undefined,
          fileName: file.name,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFlash(data.error || "No se pudo leer la factura.");
        return;
      }
      const reading = data.reading as {
        supplier?: string;
        place?: string;
        date?: string;
        notes?: string;
        lines?: {
          name: string;
          qty: number;
          unitPriceCOP: number;
          unit?: string;
          categoryLabel?: string;
        }[];
        totalCOP?: number;
      };
      const lines: CompraLine[] = (reading.lines || [])
        .filter((l) => String(l.name || "").trim())
        .map((l) => ({
          id: `ln-${crypto.randomUUID().slice(0, 8)}`,
          name: l.name,
          qty: l.qty || 1,
          unitPriceCOP: l.unitPriceCOP || 0,
          unit: l.unit || "und",
          categoryLabel: l.categoryLabel || "Compras",
          categoryId: slugCategory(l.categoryLabel || "Compras"),
          addToInventory: true,
        }));
      setDraftCompra({
        ...draftCompra,
        supplier: reading.supplier || draftCompra.supplier,
        place: reading.place || draftCompra.place,
        date: reading.date || draftCompra.date,
        notes: reading.notes || draftCompra.notes,
        lines: lines.length ? lines : draftCompra.lines,
        invoiceName: file.name,
        invoiceDataUrl: prepared.imageDataUrl || undefined,
        totalCOP: reading.totalCOP || 0,
      });
      setFlash(
        data.offline
          ? "Sin clave OpenAI: complete a mano."
          : lines.length
            ? `Factura leída: ${lines.length} ítem(s). Revise y confirme.`
            : "Factura leída sin ítems claros. Complete a mano."
      );
    } catch {
      setFlash("Error al leer el archivo.");
    } finally {
      setReading(false);
    }
  }

  function patchLine(id: string, patch: Partial<CompraLine>) {
    if (!draftCompra) return;
    setDraftCompra({
      ...draftCompra,
      lines: draftCompra.lines.map((l) =>
        l.id === id ? { ...l, ...patch } : l
      ),
    });
  }

  async function onPresupuestoFile(file: File | null) {
    if (!file || !projectId) return;
    if (file.size > 12_000_000) {
      setFlash("Archivo muy pesado (máx. ~12 MB).");
      return;
    }
    setReading(true);
    setFlash(
      docKind === "cotizacion"
        ? "Leyendo cotización…"
        : "Leyendo factura de presupuesto…"
    );
    try {
      const prepared = await prepareDocForOcr(file);
      if (!prepared.imageDataUrl && !prepared.pdfText) {
        setFlash("No se pudo leer el archivo. Pruebe una foto o PDF.");
        return;
      }

      let res = await fetch("/api/gastos/factura", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageDataUrl: prepared.imageDataUrl || undefined,
          pdfText: prepared.pdfText || undefined,
          fileName: file.name,
        }),
      });
      let data = await res.json().catch(() => ({}));
      // Reintento con imagen más chica si el cuerpo fue rechazado
      if (
        !res.ok &&
        prepared.imageDataUrl &&
        (res.status === 400 || res.status === 413 || res.status === 500)
      ) {
        const smaller = await shrinkDataUrl(prepared.imageDataUrl, 900_000);
        res = await fetch("/api/gastos/factura", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            imageDataUrl: smaller || undefined,
            pdfText: prepared.pdfText || undefined,
            fileName: file.name,
          }),
        });
        data = await res.json().catch(() => ({}));
      }
      if (!res.ok) {
        setFlash(data.error || "No se pudo leer el documento.");
        return;
      }
      const reading = data.reading as {
        supplier?: string;
        date?: string;
        notes?: string;
        lines?: {
          name: string;
          qty: number;
          unitPriceCOP: number;
          unit?: string;
          categoryLabel?: string;
        }[];
        totalCOP?: number;
      };
      const now = new Date().toISOString();
      const doc: PresupuestoDoc = {
        id: crypto.randomUUID(),
        projectId,
        kind: docKind,
        supplier: reading.supplier || file.name.replace(/\.[^.]+$/, "") || "Sin proveedor",
        date: reading.date || now.slice(0, 10),
        fileName: file.name,
        notes: reading.notes,
        createdAt: now,
        updatedAt: now,
      };
      const lines = (reading.lines || []).filter((l) =>
        String(l.name || "").trim()
      );

      bumpLocalWrite();
      if (lines.length) {
        const saved = importLinesToSubInventario({
          projectId,
          doc,
          lines,
        });
        setSubItems(saved.items);
        setPresupDocs(saved.docs);
        setExpandedDocs((prev) => ({ ...prev, [doc.id]: true }));
        setFlash(
          data.offline
            ? `Sin OpenAI: ${lines.length} ítem(s) en cotización aparte (revise precios).`
            : `${lines.length} ítem(s) en cotización independiente · ${
                doc.supplier || file.name
              }.`
        );
      } else {
        const blank = blankSubItem(projectId);
        blank.name = "Ítem por completar";
        blank.productKey = productKey(blank.name);
        blank.supplier = doc.supplier;
        blank.sourceDocId = doc.id;
        blank.sourceLabel = `${
          doc.kind === "cotizacion" ? "Cotización" : "Factura"
        } · ${doc.supplier}`;
        // Ítem primero, luego el documento (evita cotización vacía)
        const items = upsertSubItem(blank);
        const docs = upsertPresupuestoDoc(doc);
        setSubItems(items);
        setPresupDocs(docs);
        setExpandedDocs((prev) => ({ ...prev, [doc.id]: true }));
        setFlash(
          data.offline
            ? "Sin clave OpenAI: cotización guardada. Complete los ítems a mano."
            : "Cotización guardada, pero no se detectaron ítems. Complete a mano o pruebe otra foto/PDF."
        );
      }
      setTab("sub");
      refreshSubStateFromStorage();
      syncCloud();
      // Lleva la vista al bloque nuevo
      requestAnimationFrame(() => {
        document
          .getElementById(`sub-doc-${doc.id}`)
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    } catch (err) {
      console.error(err);
      const msg =
        err instanceof Error && err.message
          ? err.message
          : "Error al leer el archivo. Si es PDF escaneado, pruebe una foto de la hoja.";
      setFlash(msg);
      refreshSubStateFromStorage();
    } finally {
      setReading(false);
    }
  }

  function toggleSubExpanded(id: string) {
    setExpandedSub((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function toggleDocExpanded(key: string) {
    setExpandedDocs((prev) => ({
      ...prev,
      // default abierto si no está definido
      [key]: prev[key] === undefined ? false : !prev[key],
    }));
  }

  function isDocOpen(key: string) {
    return expandedDocs[key] !== false;
  }

  function setAllSubExpanded(open: boolean) {
    const nextItems: Record<string, boolean> = {};
    for (const row of projectSub) nextItems[row.id] = open;
    setExpandedSub(nextItems);
    const nextDocs: Record<string, boolean> = {};
    for (const g of subGroups.docs) nextDocs[g.key] = open;
    nextDocs.__manual__ = open;
    setExpandedDocs(nextDocs);
  }

  function addManualSubItem(docId?: string) {
    if (!projectId) return;
    const row = blankSubItem(projectId);
    row.name = "Nuevo material";
    row.productKey = productKey(row.name);
    if (docId) {
      const doc = presupDocs.find((d) => d.id === docId);
      row.sourceDocId = docId;
      row.supplier = doc?.supplier;
      row.sourceLabel = doc
        ? `${doc.kind === "cotizacion" ? "Cotización" : "Factura"} · ${doc.supplier}`
        : undefined;
      setExpandedDocs((prev) => ({ ...prev, [docId]: true }));
    }
    const next = upsertSubItem(row);
    setSubItems(next);
    setExpandedSub((prev) => ({ ...prev, [row.id]: true }));
    setFlash(
      docId
        ? "Ítem agregado a esa cotización. Edite nombre, unidades y precio."
        : "Ítem manual agregado. Edite nombre, unidades y precio."
    );
    syncCloud();
  }

  function patchSub(id: string, patch: Partial<SubInventarioItem>) {
    const row = subItems.find((r) => r.id === id);
    if (!row) return;
    const nextRow = { ...row, ...patch };
    if (patch.name !== undefined) {
      nextRow.productKey = productKey(String(patch.name));
    }
    setSubItems(upsertSubItem(nextRow));
  }

  function removeSub(id: string) {
    setSubItems(deleteSubItem(id));
    setFlash("Ítem eliminado del Sub inventario.");
    syncCloud();
  }

  function removeDupGroup(key: string, withinDocId?: string | null) {
    const pool = projectSub.filter(
      (r) =>
        r.productKey === key &&
        (withinDocId === undefined
          ? true
          : withinDocId
            ? r.sourceDocId === withinDocId
            : !r.sourceDocId)
    );
    if (pool.length < 2) return;
    const sorted = [...pool].sort(
      (a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)
    );
    const drop = sorted.slice(1).map((r) => r.id);
    setSubItems(deleteSubItems(drop));
    setFlash(`Duplicados de «${sorted[0].name}» eliminados (quedó 1).`);
    syncCloud();
  }

  function promoteSub(ids: string[]) {
    if (!ids.length) return;
    const rows = subItems.filter((r) => ids.includes(r.id));
    if (!rows.length) return;
    const result = promoteSubItemsToInventory(
      rows,
      loadInventory(),
      loadCustomCategories()
    );
    saveInventory(result.inventory);
    saveCustomCategories(result.customCats);
    setSubItems(deleteSubItems(ids));
    setFlash(
      `${rows.length} ítem(s) pasaron al inventario principal y salieron del Sub inventario.`
    );
    syncCloud();
  }

  function sendToCotizador(
    rows: SubInventarioItem[],
    sourceLabel?: string
  ) {
    const result = sendSubItemsToCotizador(rows, {
      sourceLabel,
      projectName: active?.name,
    });
    if (!result.ok) {
      setFlash(result.message);
      return;
    }
    setFlash(result.message);
    if (result.href) router.push(result.href);
  }

  function removeDoc(id: string) {
    const { docs, sub } = deletePresupuestoDoc(id);
    setPresupDocs(docs);
    setSubItems(sub);
    setFlash("Documento y sus ítems eliminados del Sub inventario.");
    syncCloud();
  }

  if (!hydrated) {
    return (
      <AppShell title="Gastos" subtitle="Cargando…">
        <p className="text-sm text-[#6d7c74]">Cargando…</p>
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Gastos"
      subtitle="Compras a proveedores y pagos a trabajadores, por proyecto"
      actions={
        active ? (
          <span className="os-btn os-btn-ghost pointer-events-none">
            <Wallet size={16} />
            {active.name}
          </span>
        ) : null
      }
    >
      {flash ? (
        <p className="mb-3 text-sm text-[#1f6b45]">{flash}</p>
      ) : null}

      <section className="os-panel mb-5 rounded-2xl border border-[#ddd6c8] bg-white p-5">
        <h2 className="font-semibold">Proyecto</h2>
        <p className="mt-1 text-sm text-[#4d5c55]">
          Elija el proyecto donde quiere llevar el control. Puede amarrarlo a una
          obra o crear uno con nombre libre.
        </p>
        <div className="mt-3 grid gap-3 lg:grid-cols-3">
          <label className="block text-sm lg:col-span-1">
            <span className="mb-1 block font-medium">Proyecto activo</span>
            <select
              className={field}
              value={projectId}
              onChange={(e) => selectProject(e.target.value)}
            >
              <option value="">Seleccionar…</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.source === "obra" ? " · obra" : ""}
                </option>
              ))}
            </select>
          </label>
          <div className="flex flex-wrap items-end gap-2 lg:col-span-1">
            <label className="min-w-[160px] flex-1 text-sm">
              <span className="mb-1 block font-medium">Desde obra</span>
              <select
                className={field}
                value={pickObraId}
                onChange={(e) => setPickObraId(e.target.value)}
              >
                <option value="">Elegir obra…</option>
                {obras.map((o) => (
                  <option key={o.id} value={o.id}>
                    {obraLabel(o)}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="rounded-xl bg-[#0f3d2e] px-3 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              disabled={!pickObraId}
              onClick={createFromObra}
            >
              Usar obra
            </button>
          </div>
          <div className="flex flex-wrap items-end gap-2 lg:col-span-1">
            <label className="min-w-[160px] flex-1 text-sm">
              <span className="mb-1 block font-medium">Proyecto libre</span>
              <input
                className={field}
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                placeholder="Ej. Bodega · stock abril"
              />
            </label>
            <button
              type="button"
              className="rounded-xl border border-[#0f3d2e] px-3 py-2.5 text-sm font-semibold text-[#0f3d2e]"
              onClick={createLibreProject}
            >
              Crear
            </button>
          </div>
        </div>

        {active ? (
          <dl className="os-quote-sum mt-4">
            <div>
              <dt>Compras</dt>
              <dd>{cop.format(totals.comprasCOP)}</dd>
            </div>
            <div>
              <dt>Pagos</dt>
              <dd>{cop.format(totals.pagosCOP)}</dd>
            </div>
            <div>
              <dt>Presupuesto materiales</dt>
              <dd>{cop.format(subBudgetCOP)}</dd>
            </div>
            <div data-tone="ok">
              <dt>Total gastado</dt>
              <dd>{cop.format(totals.totalCOP)}</dd>
            </div>
          </dl>
        ) : null}
      </section>

      {!projectId ? (
        <p className="text-sm text-[#6d7c74]">
          Seleccione o cree un proyecto para registrar compras y pagos.
        </p>
      ) : (
        <>
          <div className="os-subtabs mb-5 flex flex-wrap gap-1 rounded-xl bg-[#0f2a1f] p-1">
            {(
              [
                ["compras", "Compras", Receipt],
                ["pagos", "Pagos", Users],
                ["sub", "Sub inventario", ClipboardList],
                ["precios", "Dónde es más barato", Building2],
              ] as const
            ).map(([id, label, Icon]) => (
              <button
                key={id}
                type="button"
                className={`os-subtab flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold ${
                  tab === id
                    ? "is-active bg-[#1f6b45] text-white"
                    : "text-[#c9d7cf] hover:bg-[#143528] hover:text-white"
                }`}
                onClick={() => setTab(id)}
              >
                <Icon size={15} />
                {label}
              </button>
            ))}
          </div>

          {tab === "compras" ? (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="os-btn os-btn-primary"
                  onClick={openNewCompra}
                >
                  <Plus size={16} />
                  Nueva compra
                </button>
              </div>

              {draftCompra ? (
                <section className="os-panel rounded-2xl border border-[#ddd6c8] bg-white p-5">
                  <h3 className="font-semibold">Registrar compra</h3>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <label className="text-sm">
                      Proveedor
                      <input
                        className={`${field} mt-1`}
                        value={draftCompra.supplier}
                        onChange={(e) =>
                          setDraftCompra({
                            ...draftCompra,
                            supplier: e.target.value,
                          })
                        }
                      />
                    </label>
                    <label className="text-sm">
                      Lugar / sucursal
                      <input
                        className={`${field} mt-1`}
                        value={draftCompra.place || ""}
                        onChange={(e) =>
                          setDraftCompra({
                            ...draftCompra,
                            place: e.target.value,
                          })
                        }
                      />
                    </label>
                    <label className="text-sm">
                      Fecha
                      <input
                        type="date"
                        className={`${field} mt-1`}
                        value={draftCompra.date}
                        onChange={(e) =>
                          setDraftCompra({
                            ...draftCompra,
                            date: e.target.value,
                          })
                        }
                      />
                    </label>
                    <label className="text-sm">
                      Foto o PDF de factura
                      <input
                        type="file"
                        accept="image/*,application/pdf"
                        className={`${field} mt-1`}
                        disabled={reading}
                        onChange={(e) =>
                          void onInvoiceFile(e.target.files?.[0] || null)
                        }
                      />
                    </label>
                    <label className="text-sm sm:col-span-2">
                      Notas
                      <input
                        className={`${field} mt-1`}
                        value={draftCompra.notes || ""}
                        onChange={(e) =>
                          setDraftCompra({
                            ...draftCompra,
                            notes: e.target.value,
                          })
                        }
                      />
                    </label>
                  </div>

                  <div className="mt-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-semibold">Ítems</h4>
                      <button
                        type="button"
                        className="text-sm font-semibold text-[#0f3d2e] underline"
                        onClick={() =>
                          setDraftCompra({
                            ...draftCompra,
                            lines: [...draftCompra.lines, blankCompraLine()],
                          })
                        }
                      >
                        + Ítem
                      </button>
                    </div>
                    {draftCompra.lines.map((line) => (
                      <div
                        key={line.id}
                        className="rounded-xl border border-[#eee8dc] p-3"
                      >
                        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
                          <label className="text-xs sm:col-span-2 lg:col-span-2">
                            Nombre
                            <input
                              className={`${field} mt-1`}
                              value={line.name}
                              onChange={(e) =>
                                patchLine(line.id, { name: e.target.value })
                              }
                            />
                          </label>
                          <label className="text-xs">
                            Cant.
                            <input
                              type="number"
                              className={`${field} mt-1`}
                              value={line.qty}
                              onChange={(e) =>
                                patchLine(line.id, {
                                  qty: Number(e.target.value) || 0,
                                })
                              }
                            />
                          </label>
                          <label className="text-xs">
                            Precio und.
                            <input
                              type="number"
                              className={`${field} mt-1`}
                              value={line.unitPriceCOP}
                              onChange={(e) =>
                                patchLine(line.id, {
                                  unitPriceCOP: Number(e.target.value) || 0,
                                })
                              }
                            />
                          </label>
                          <label className="text-xs lg:col-span-2">
                            Grupo inventario
                            <input
                              className={`${field} mt-1`}
                              list="gasto-cats"
                              value={line.categoryLabel || ""}
                              onChange={(e) => {
                                const label = e.target.value;
                                patchLine(line.id, {
                                  categoryLabel: label,
                                  categoryId: slugCategory(label || "compras"),
                                });
                              }}
                              placeholder="Ej. Ferretería"
                            />
                          </label>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                          <label className="flex items-center gap-2 text-xs">
                            <input
                              type="checkbox"
                              checked={Boolean(line.addToInventory)}
                              onChange={(e) =>
                                patchLine(line.id, {
                                  addToInventory: e.target.checked,
                                })
                              }
                            />
                            Pasar al inventario
                          </label>
                          <span className="text-xs font-semibold">
                            {cop.format(lineTotal(line))}
                          </span>
                          <button
                            type="button"
                            className="text-xs font-semibold text-[#9b2c2c] underline"
                            onClick={() =>
                              setDraftCompra({
                                ...draftCompra,
                                lines: draftCompra.lines.filter(
                                  (l) => l.id !== line.id
                                ),
                              })
                            }
                          >
                            Quitar
                          </button>
                        </div>
                      </div>
                    ))}
                    <datalist id="gasto-cats">
                      {categoryOptions.map((c) => (
                        <option key={c.id} value={c.label} />
                      ))}
                    </datalist>
                  </div>

                  <p className="mt-3 text-sm font-semibold">
                    Total:{" "}
                    {cop.format(
                      draftCompra.lines.reduce((s, l) => s + lineTotal(l), 0)
                    )}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="os-btn os-btn-primary"
                      disabled={reading}
                      onClick={() => saveDraftCompra(true)}
                    >
                      <Upload size={16} />
                      Guardar y pasar al inventario
                    </button>
                    <button
                      type="button"
                      className="os-btn os-btn-ghost"
                      disabled={reading}
                      onClick={() => saveDraftCompra(false)}
                    >
                      Guardar solo el gasto
                    </button>
                    <button
                      type="button"
                      className="os-btn os-btn-ghost"
                      onClick={() => setDraftCompra(null)}
                    >
                      Cancelar
                    </button>
                  </div>
                </section>
              ) : null}

              <div className="space-y-2">
                {projectCompras.length === 0 ? (
                  <p className="text-sm text-[#6d7c74]">
                    Aún no hay compras en este proyecto.
                  </p>
                ) : (
                  projectCompras.map((c) => (
                    <article
                      key={c.id}
                      className="rounded-2xl border border-[#ddd6c8] bg-white p-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold">{c.supplier}</p>
                          <p className="text-xs text-[#6d7c74]">
                            {c.date}
                            {c.place ? ` · ${c.place}` : ""} · {c.lines.length}{" "}
                            ítem(s)
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <p className="font-semibold">{cop.format(c.totalCOP)}</p>
                          <button
                            type="button"
                            className="text-[#9b2c2c]"
                            aria-label="Eliminar compra"
                            onClick={() => {
                              if (!confirm("¿Eliminar esta compra?")) return;
                              setCompras(deleteCompra(c.id));
                              syncCloud();
                            }}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                      <ul className="mt-2 space-y-1 text-xs text-[#4d5c55]">
                        {c.lines.slice(0, 6).map((l) => (
                          <li key={l.id}>
                            {l.qty} × {l.name} · {cop.format(l.unitPriceCOP)}
                          </li>
                        ))}
                      </ul>
                    </article>
                  ))
                )}
              </div>
            </div>
          ) : null}

          {tab === "pagos" ? (
            <div className="space-y-4">
              <button
                type="button"
                className="os-btn os-btn-primary"
                onClick={openNewPago}
              >
                <Plus size={16} />
                Nuevo pago
              </button>

              {draftPago ? (
                <section className="os-panel rounded-2xl border border-[#ddd6c8] bg-white p-5">
                  <h3 className="font-semibold">Registrar pago</h3>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <label className="text-sm">
                      Persona / proveedor de servicio
                      <input
                        className={`${field} mt-1`}
                        value={draftPago.person}
                        onChange={(e) =>
                          setDraftPago({ ...draftPago, person: e.target.value })
                        }
                      />
                    </label>
                    <label className="text-sm">
                      Rol / concepto
                      <input
                        className={`${field} mt-1`}
                        value={draftPago.role}
                        onChange={(e) =>
                          setDraftPago({ ...draftPago, role: e.target.value })
                        }
                        placeholder="Técnico, transporte, viáticos…"
                      />
                    </label>
                    <label className="text-sm">
                      Fecha
                      <input
                        type="date"
                        className={`${field} mt-1`}
                        value={draftPago.date}
                        onChange={(e) =>
                          setDraftPago({ ...draftPago, date: e.target.value })
                        }
                      />
                    </label>
                    <label className="text-sm">
                      Monto COP
                      <input
                        type="number"
                        className={`${field} mt-1`}
                        value={draftPago.amountCOP}
                        onChange={(e) =>
                          setDraftPago({
                            ...draftPago,
                            amountCOP: Number(e.target.value) || 0,
                          })
                        }
                      />
                    </label>
                    <label className="text-sm">
                      Método
                      <input
                        className={`${field} mt-1`}
                        value={draftPago.method || ""}
                        onChange={(e) =>
                          setDraftPago({ ...draftPago, method: e.target.value })
                        }
                      />
                    </label>
                    <label className="text-sm">
                      Notas
                      <input
                        className={`${field} mt-1`}
                        value={draftPago.notes || ""}
                        onChange={(e) =>
                          setDraftPago({ ...draftPago, notes: e.target.value })
                        }
                      />
                    </label>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="os-btn os-btn-primary"
                      onClick={saveDraftPago}
                    >
                      Guardar pago
                    </button>
                    <button
                      type="button"
                      className="os-btn os-btn-ghost"
                      onClick={() => setDraftPago(null)}
                    >
                      Cancelar
                    </button>
                  </div>
                </section>
              ) : null}

              <div className="space-y-2">
                {projectPagos.length === 0 ? (
                  <p className="text-sm text-[#6d7c74]">
                    Aún no hay pagos en este proyecto.
                  </p>
                ) : (
                  projectPagos.map((p) => (
                    <article
                      key={p.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[#ddd6c8] bg-white p-4"
                    >
                      <div>
                        <p className="font-semibold">{p.person}</p>
                        <p className="text-xs text-[#6d7c74]">
                          {p.date} · {p.role}
                          {p.method ? ` · ${p.method}` : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <p className="font-semibold">{cop.format(p.amountCOP)}</p>
                        <button
                          type="button"
                          className="text-[#9b2c2c]"
                          aria-label="Eliminar pago"
                          onClick={() => {
                            if (!confirm("¿Eliminar este pago?")) return;
                            setPagos(deletePago(p.id));
                            syncCloud();
                          }}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </article>
                  ))
                )}
              </div>
            </div>
          ) : null}

          {tab === "sub" ? (
            <div className="space-y-4">
              <section className="os-panel rounded-2xl border border-[#ddd6c8] bg-white p-5">
                <h3 className="font-semibold">Sub inventario · presupuesto de materiales</h3>
                <p className="mt-1 text-sm text-[#4d5c55]">
                  Cada cotización o factura queda en su propio bloque, sin
                  mezclar equipos. Usted decide qué pasa al inventario
                  principal.
                </p>
                <div className="mt-4 flex flex-wrap items-end gap-3">
                  <label className="text-sm">
                    Tipo
                    <select
                      className={`${field} mt-1 w-auto`}
                      value={docKind}
                      onChange={(e) =>
                        setDocKind(e.target.value as "cotizacion" | "factura")
                      }
                    >
                      <option value="cotizacion">Cotización</option>
                      <option value="factura">Factura (presupuesto)</option>
                    </select>
                  </label>
                  <label className="os-btn os-btn-primary cursor-pointer">
                    <Upload size={16} />
                    {reading ? "Leyendo…" : "Adjuntar documento"}
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      className="hidden"
                      disabled={reading}
                      onChange={(e) => {
                        void onPresupuestoFile(e.target.files?.[0] || null);
                        e.target.value = "";
                      }}
                    />
                  </label>
                  <button
                    type="button"
                    className="os-btn os-btn-ghost"
                    onClick={() => addManualSubItem()}
                  >
                    <Plus size={16} />
                    Ítem manual (sin cotización)
                  </button>
                </div>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-[#1f6b45]">
                    Presupuesto total materiales: {cop.format(subBudgetCOP)}
                    <span className="ml-2 font-normal text-[#6d7c74]">
                      · {subGroups.docs.length} documento(s)
                    </span>
                  </p>
                  {projectSub.length ? (
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="os-btn os-btn-ghost text-sm"
                        onClick={() => setAllSubExpanded(true)}
                      >
                        Desplegar todos
                      </button>
                      <button
                        type="button"
                        className="os-btn os-btn-ghost text-sm"
                        onClick={() => setAllSubExpanded(false)}
                      >
                        Esconder todos
                      </button>
                    </div>
                  ) : null}
                </div>
              </section>

              {subGroups.docs.length === 0 && subGroups.manual.length === 0 ? (
                <section className="os-panel rounded-2xl border border-[#ddd6c8] bg-white p-5">
                  <p className="text-sm text-[#6d7c74]">
                    Aún no hay cotizaciones. Adjunte un documento: cada uno
                    creará su propio grupo de equipos.
                  </p>
                </section>
              ) : null}

              {subGroups.docs.map((group) => {
                const docOpen = isDocOpen(group.key);
                const dups = dupKeysIn(group.items);
                const kindLabel =
                  group.doc?.kind === "factura" ? "Factura" : "Cotización";
                const title = group.doc
                  ? `${kindLabel} · ${group.doc.supplier || "Sin proveedor"}`
                  : group.items[0]?.sourceLabel || "Documento";
                return (
                  <section
                    key={group.key}
                    id={`sub-doc-${group.key}`}
                    className="os-panel rounded-2xl border border-[#ddd6c8] bg-white p-4"
                  >
                    <div className="flex flex-wrap items-start gap-2">
                      <button
                        type="button"
                        className="flex min-w-0 flex-1 items-center gap-2 text-left"
                        onClick={() => toggleDocExpanded(group.key)}
                        aria-expanded={docOpen}
                      >
                        {docOpen ? (
                          <ChevronDown
                            size={18}
                            className="shrink-0 text-[#1f6b45]"
                          />
                        ) : (
                          <ChevronRight
                            size={18}
                            className="shrink-0 text-[#6d7c74]"
                          />
                        )}
                        <span className="min-w-0">
                          <span className="block font-semibold">{title}</span>
                          <span className="text-xs text-[#6d7c74]">
                            {group.doc?.fileName || "Sin archivo"}
                            {group.doc?.date ? ` · ${group.doc.date}` : ""}
                            {` · ${group.items.length} ítem(s)`}
                          </span>
                        </span>
                      </button>
                      <span className="shrink-0 self-center text-sm font-semibold text-[#1f6b45]">
                        {cop.format(group.totalCOP)}
                      </span>
                    </div>

                    {docOpen ? (
                      <div className="mt-3 space-y-3 border-t border-[#eee8dc] pt-3">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            className="os-btn os-btn-ghost text-xs"
                            onClick={() => addManualSubItem(group.key)}
                          >
                            <Plus size={14} />
                            Agregar ítem a esta cotización
                          </button>
                          {group.items.length ? (
                            <>
                              <button
                                type="button"
                                className="os-btn os-btn-primary text-xs"
                                onClick={() =>
                                  sendToCotizador(group.items, title)
                                }
                              >
                                <Send size={14} />
                                Pasar a cotización
                              </button>
                              <button
                                type="button"
                                className="os-btn os-btn-ghost text-xs"
                                onClick={() =>
                                  promoteSub(group.items.map((r) => r.id))
                                }
                              >
                                <PackagePlus size={14} />
                                Al inventario principal
                              </button>
                            </>
                          ) : null}
                          {group.doc ? (
                            <button
                              type="button"
                              className="os-btn os-btn-ghost text-xs text-[#9b3b2e]"
                              onClick={() => removeDoc(group.doc!.id)}
                            >
                              <Trash2 size={14} />
                              Eliminar cotización
                            </button>
                          ) : null}
                        </div>

                        {group.items.length === 0 ? (
                          <p className="text-sm text-[#6d7c74]">
                            Sin ítems en este documento.
                          </p>
                        ) : (
                          <ul className="space-y-2">
                            {group.items.map((row) => {
                              const isDup = dups.has(row.productKey);
                              const open = Boolean(expandedSub[row.id]);
                              const lineCOP = Math.round(
                                (Number(row.qty) || 0) *
                                  (Number(row.unitPriceCOP) || 0)
                              );
                              return (
                                <li
                                  key={row.id}
                                  className={`rounded-xl border ${
                                    isDup
                                      ? "border-[#e8c48a] bg-[#fff9ef]"
                                      : "border-[#eee8dc] bg-[#fbfaf6]"
                                  }`}
                                >
                                  <button
                                    type="button"
                                    className="flex w-full items-center gap-2 px-3 py-2.5 text-left"
                                    onClick={() => toggleSubExpanded(row.id)}
                                    aria-expanded={open}
                                  >
                                    {open ? (
                                      <ChevronDown
                                        size={16}
                                        className="shrink-0 text-[#1f6b45]"
                                      />
                                    ) : (
                                      <ChevronRight
                                        size={16}
                                        className="shrink-0 text-[#6d7c74]"
                                      />
                                    )}
                                    <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                                      {row.name || "Sin nombre"}
                                    </span>
                                    {isDup ? (
                                      <span className="shrink-0 rounded-md bg-[#f0d9a8] px-2 py-0.5 text-[11px] font-semibold text-[#7a4e12]">
                                        Repetido
                                      </span>
                                    ) : null}
                                    <span className="shrink-0 text-xs text-[#6d7c74]">
                                      {row.qty} {row.unit || "und"}
                                    </span>
                                    <span className="shrink-0 text-sm font-semibold text-[#1f6b45]">
                                      {cop.format(lineCOP)}
                                    </span>
                                  </button>
                                  {open ? (
                                    <div className="border-t border-[#eee8dc] px-3 pb-3 pt-2">
                                      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
                                        <label className="text-xs text-[#6d7c74] lg:col-span-2">
                                          Elemento / equipo
                                          <input
                                            className={`${field} mt-1`}
                                            value={row.name}
                                            onChange={(e) =>
                                              patchSub(row.id, {
                                                name: e.target.value,
                                              })
                                            }
                                            onBlur={() => syncCloud()}
                                          />
                                        </label>
                                        <label className="text-xs text-[#6d7c74]">
                                          Unidades
                                          <input
                                            type="number"
                                            min={0}
                                            step={1}
                                            className={`${field} mt-1`}
                                            value={row.qty}
                                            onChange={(e) =>
                                              patchSub(row.id, {
                                                qty:
                                                  Number(e.target.value) || 0,
                                              })
                                            }
                                            onBlur={() => syncCloud()}
                                          />
                                        </label>
                                        <label className="text-xs text-[#6d7c74]">
                                          Precio und. COP
                                          <input
                                            type="number"
                                            min={0}
                                            className={`${field} mt-1`}
                                            value={row.unitPriceCOP}
                                            onChange={(e) =>
                                              patchSub(row.id, {
                                                unitPriceCOP:
                                                  Number(e.target.value) || 0,
                                              })
                                            }
                                            onBlur={() => syncCloud()}
                                          />
                                        </label>
                                        <label className="text-xs text-[#6d7c74]">
                                          Und.
                                          <input
                                            className={`${field} mt-1`}
                                            value={row.unit || "und"}
                                            onChange={(e) =>
                                              patchSub(row.id, {
                                                unit: e.target.value,
                                              })
                                            }
                                            onBlur={() => syncCloud()}
                                          />
                                        </label>
                                        <div className="flex flex-col justify-end text-sm">
                                          <span className="text-[#6d7c74]">
                                            Total
                                          </span>
                                          <span className="font-semibold">
                                            {cop.format(lineCOP)}
                                          </span>
                                        </div>
                                      </div>
                                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[#6d7c74]">
                                        <span className="flex-1" />
                                        {isDup ? (
                                          <button
                                            type="button"
                                            className="os-btn os-btn-ghost text-xs"
                                            onClick={() =>
                                              removeDupGroup(
                                                row.productKey,
                                                group.key
                                              )
                                            }
                                          >
                                            Limpiar duplicados
                                          </button>
                                        ) : null}
                                        <button
                                          type="button"
                                          className="os-btn os-btn-ghost text-xs"
                                          onClick={() =>
                                            sendToCotizador([row], title)
                                          }
                                        >
                                          <Send size={14} />
                                          A cotización
                                        </button>
                                        <button
                                          type="button"
                                          className="os-btn os-btn-ghost text-xs"
                                          onClick={() => promoteSub([row.id])}
                                        >
                                          <PackagePlus size={14} />
                                          Al inventario principal
                                        </button>
                                        <button
                                          type="button"
                                          className="os-btn os-btn-ghost text-xs text-[#9b3b2e]"
                                          onClick={() => removeSub(row.id)}
                                        >
                                          <Trash2 size={14} />
                                          Eliminar
                                        </button>
                                      </div>
                                    </div>
                                  ) : null}
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </div>
                    ) : null}
                  </section>
                );
              })}

              {subGroups.manual.length ? (
                <section className="os-panel rounded-2xl border border-dashed border-[#c9d2cb] bg-white p-4">
                  <div className="flex flex-wrap items-start gap-2">
                    <button
                      type="button"
                      className="flex min-w-0 flex-1 items-center gap-2 text-left"
                      onClick={() => toggleDocExpanded("__manual__")}
                      aria-expanded={isDocOpen("__manual__")}
                    >
                      {isDocOpen("__manual__") ? (
                        <ChevronDown
                          size={18}
                          className="shrink-0 text-[#1f6b45]"
                        />
                      ) : (
                        <ChevronRight
                          size={18}
                          className="shrink-0 text-[#6d7c74]"
                        />
                      )}
                      <span className="min-w-0">
                        <span className="block font-semibold">
                          Ítems manuales
                        </span>
                        <span className="text-xs text-[#6d7c74]">
                          Sin cotización adjunta · {subGroups.manual.length}{" "}
                          ítem(s)
                        </span>
                      </span>
                    </button>
                    <span className="shrink-0 self-center text-sm font-semibold text-[#1f6b45]">
                      {cop.format(subGroups.manualTotal)}
                    </span>
                  </div>
                  {isDocOpen("__manual__") ? (
                    <ul className="mt-3 space-y-2 border-t border-[#eee8dc] pt-3">
                      {subGroups.manual.map((row) => {
                        const dups = dupKeysIn(subGroups.manual);
                        const isDup = dups.has(row.productKey);
                        const open = Boolean(expandedSub[row.id]);
                        const lineCOP = Math.round(
                          (Number(row.qty) || 0) *
                            (Number(row.unitPriceCOP) || 0)
                        );
                        return (
                          <li
                            key={row.id}
                            className={`rounded-xl border ${
                              isDup
                                ? "border-[#e8c48a] bg-[#fff9ef]"
                                : "border-[#eee8dc] bg-[#fbfaf6]"
                            }`}
                          >
                            <button
                              type="button"
                              className="flex w-full items-center gap-2 px-3 py-2.5 text-left"
                              onClick={() => toggleSubExpanded(row.id)}
                              aria-expanded={open}
                            >
                              {open ? (
                                <ChevronDown
                                  size={16}
                                  className="shrink-0 text-[#1f6b45]"
                                />
                              ) : (
                                <ChevronRight
                                  size={16}
                                  className="shrink-0 text-[#6d7c74]"
                                />
                              )}
                              <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                                {row.name || "Sin nombre"}
                              </span>
                              <span className="shrink-0 text-xs text-[#6d7c74]">
                                {row.qty} {row.unit || "und"}
                              </span>
                              <span className="shrink-0 text-sm font-semibold text-[#1f6b45]">
                                {cop.format(lineCOP)}
                              </span>
                            </button>
                            {open ? (
                              <div className="border-t border-[#eee8dc] px-3 pb-3 pt-2">
                                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
                                  <label className="text-xs text-[#6d7c74] lg:col-span-2">
                                    Elemento / equipo
                                    <input
                                      className={`${field} mt-1`}
                                      value={row.name}
                                      onChange={(e) =>
                                        patchSub(row.id, {
                                          name: e.target.value,
                                        })
                                      }
                                      onBlur={() => syncCloud()}
                                    />
                                  </label>
                                  <label className="text-xs text-[#6d7c74]">
                                    Unidades
                                    <input
                                      type="number"
                                      min={0}
                                      step={1}
                                      className={`${field} mt-1`}
                                      value={row.qty}
                                      onChange={(e) =>
                                        patchSub(row.id, {
                                          qty: Number(e.target.value) || 0,
                                        })
                                      }
                                      onBlur={() => syncCloud()}
                                    />
                                  </label>
                                  <label className="text-xs text-[#6d7c74]">
                                    Precio und. COP
                                    <input
                                      type="number"
                                      min={0}
                                      className={`${field} mt-1`}
                                      value={row.unitPriceCOP}
                                      onChange={(e) =>
                                        patchSub(row.id, {
                                          unitPriceCOP:
                                            Number(e.target.value) || 0,
                                        })
                                      }
                                      onBlur={() => syncCloud()}
                                    />
                                  </label>
                                  <label className="text-xs text-[#6d7c74]">
                                    Und.
                                    <input
                                      className={`${field} mt-1`}
                                      value={row.unit || "und"}
                                      onChange={(e) =>
                                        patchSub(row.id, {
                                          unit: e.target.value,
                                        })
                                      }
                                      onBlur={() => syncCloud()}
                                    />
                                  </label>
                                  <div className="flex flex-col justify-end text-sm">
                                    <span className="text-[#6d7c74]">Total</span>
                                    <span className="font-semibold">
                                      {cop.format(lineCOP)}
                                    </span>
                                  </div>
                                </div>
                                <div className="mt-2 flex flex-wrap justify-end gap-2">
                                  <button
                                    type="button"
                                    className="os-btn os-btn-ghost text-xs"
                                    onClick={() =>
                                      sendToCotizador(
                                        [row],
                                        "Ítems manuales"
                                      )
                                    }
                                  >
                                    <Send size={14} />
                                    A cotización
                                  </button>
                                  <button
                                    type="button"
                                    className="os-btn os-btn-ghost text-xs"
                                    onClick={() => promoteSub([row.id])}
                                  >
                                    <PackagePlus size={14} />
                                    Al inventario principal
                                  </button>
                                  <button
                                    type="button"
                                    className="os-btn os-btn-ghost text-xs text-[#9b3b2e]"
                                    onClick={() => removeSub(row.id)}
                                  >
                                    <Trash2 size={14} />
                                    Eliminar
                                  </button>
                                </div>
                              </div>
                            ) : null}
                          </li>
                        );
                      })}
                    </ul>
                  ) : null}
                </section>
              ) : null}
            </div>
          ) : null}

          {tab === "precios" ? (
            <section className="os-panel rounded-2xl border border-[#ddd6c8] bg-white p-5">
              <h3 className="font-semibold">Dónde sale más barato</h3>
              <p className="mt-1 text-sm text-[#4d5c55]">
                Compara precios unitarios vistos en facturas (todos los
                proyectos). El más bajo aparece primero.
              </p>
              {priceBoard.length === 0 ? (
                <p className="mt-4 text-sm text-[#6d7c74]">
                  Guarde compras con ítems para llenar este tablero.
                </p>
              ) : (
                <ul className="mt-4 space-y-3">
                  {priceBoard.slice(0, 40).map((row) => (
                    <li
                      key={row.productKey}
                      className="rounded-xl border border-[#eee8dc] p-3 text-sm"
                    >
                      <p className="font-semibold">{row.productName}</p>
                      <p className="text-[#1f6b45]">
                        Mejor: {cop.format(row.best.unitPriceCOP)} en{" "}
                        {row.best.place || row.best.supplier}
                        <span className="text-[#6d7c74]">
                          {" "}
                          · {row.best.date}
                        </span>
                      </p>
                      {row.others.length ? (
                        <p className="mt-1 text-xs text-[#6d7c74]">
                          Otros:{" "}
                          {row.others
                            .map(
                              (o) =>
                                `${cop.format(o.unitPriceCOP)} (${o.place || o.supplier})`
                            )
                            .join(" · ")}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ) : null}
        </>
      )}
    </AppShell>
  );
}
