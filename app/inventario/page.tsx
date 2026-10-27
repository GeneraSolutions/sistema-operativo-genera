"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Boxes,
  ChevronDown,
  DollarSign,
  History,
  PackageMinus,
  PackageSearch,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { OsKpi } from "@/components/OsKpi";
import { saveDatasheetFile } from "@/lib/datasheets";
import {
  allCategoryIds,
  categoryLabel,
  copToUsd,
  loadCustomCategories,
  loadInventory,
  loadTrm,
  restoreOfficialCatalog,
  saveCustomCategories,
  saveInventory,
  saveTrm,
  usdToCop,
} from "@/lib/inventory";
import { normalizeSearch } from "@/lib/os-command";
import { getPriceHistory, recordPrice } from "@/lib/price-history";
import { saleUnitCOP } from "@/lib/pricing";
import {
  MOUNT_LABELS,
  slugCategory,
  type EquipmentCategory,
  type InventoryItem,
  type StructureMountType,
  type TrmConfig,
} from "@/types/inventory";

const field =
  "w-full rounded-xl border border-[#d8d2c4] bg-[#fbfaf6] px-3 py-2.5 text-sm";

const copFmt = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

const usdFmt = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

const whenFmt = new Intl.DateTimeFormat("es-CO", {
  day: "numeric",
  month: "short",
});

const LOW_STOCK = 5;

const emptyForm = {
  category: "panel" as EquipmentCategory,
  name: "",
  brand: "",
  model: "",
  priceCOP: "",
  priceUSD: "",
  unit: "unidad",
  capacity: "",
  mountType: "cubierta" as StructureMountType,
  isDefault: false,
  active: true,
  notes: "",
  marginPercent: "0",
  applyIva: true,
  stock: "",
  leadTimeDays: "",
  datasheetUrl: "",
};

function parseCopInput(raw: string): number {
  const compact = raw.replace(/\s/g, "").replace(/[.$]/g, "").replace(",", ".");
  return Number(compact);
}

function stockTone(stock: number | undefined): "ok" | "warn" | "danger" | "neutral" {
  if (stock == null) return "neutral";
  if (stock <= 0) return "danger";
  if (stock <= LOW_STOCK) return "warn";
  return "ok";
}

function stockLabel(stock: number | undefined) {
  if (stock == null) return "Sin dato";
  if (stock <= 0) return "Sin stock";
  return `${stock} und`;
}

function capacityText(item: InventoryItem) {
  if (item.capacity == null) return "";
  const unit =
    item.unit === "módulo" && item.category === "panel" ? "Wp" : item.unit;
  return `${item.capacity} ${unit}`.trim();
}

function hay(parts: Array<string | number | undefined | null>) {
  return normalizeSearch(parts.filter(Boolean).join(" "));
}

export default function InventarioPage() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [trm, setTrm] = useState<TrmConfig>({ trm: 4125, source: "", updatedAt: "" });
  const [trmInput, setTrmInput] = useState("4125");
  const [filter, setFilter] = useState<EquipmentCategory | "all">("all");
  const [stockFilter, setStockFilter] = useState<"all" | "zero" | "low">("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [priceEditMode, setPriceEditMode] = useState<"COP" | "USD">("COP");
  const [flash, setFlash] = useState("");
  const [query, setQuery] = useState("");
  const [customCats, setCustomCats] = useState<{ id: string; label: string }[]>([]);
  const [newGroupName, setNewGroupName] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const CATEGORIES = allCategoryIds(customCats);

  useEffect(() => {
    const inv = loadInventory();
    const t = loadTrm();
    setItems(inv);
    setTrm(t);
    setTrmInput(String(t.trm));
    setCustomCats(loadCustomCategories());
  }, []);

  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(""), 2800);
    return () => clearTimeout(t);
  }, [flash]);

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeDrawer();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawerOpen]);

  const tokens = normalizeSearch(query).split(/\s+/).filter(Boolean);

  const filtered = useMemo(() => {
    return items
      .filter((i) => {
        if (filter !== "all" && i.category !== filter) return false;
        if (stockFilter === "zero" && i.stock !== 0) return false;
        if (
          stockFilter === "low" &&
          !(i.stock != null && i.stock > 0 && i.stock <= LOW_STOCK)
        ) {
          return false;
        }
        if (!tokens.length) return true;
        return tokens.every((t) =>
          hay([i.name, i.brand, i.model, categoryLabel(i.category, customCats)]).includes(t)
        );
      })
      .sort((a, b) => {
        const cat = categoryLabel(a.category, customCats).localeCompare(
          categoryLabel(b.category, customCats),
          "es"
        );
        if (cat !== 0) return cat;
        return a.name.localeCompare(b.name, "es");
      });
  }, [items, filter, stockFilter, query, customCats]);

  const counts = useMemo(() => {
    const active = items.filter((i) => i.active).length;
    const zero = items.filter((i) => i.stock === 0).length;
    const low = items.filter(
      (i) => i.stock != null && i.stock > 0 && i.stock <= LOW_STOCK
    ).length;
    return { active, zero, low, total: items.length };
  }, [items]);

  function persist(next: InventoryItem[], message = "Catálogo guardado") {
    setItems(next);
    saveInventory(next);
    setFlash(message);
  }

  function handleTrmSave() {
    const value = Number(trmInput.replace(",", "."));
    if (!Number.isFinite(value) || value <= 0) return;
    const next: TrmConfig = {
      trm: value,
      source: "Actualización manual",
      updatedAt: new Date().toISOString(),
    };
    setTrm(next);
    saveTrm(next);
    const converted = items.map((item) => ({
      ...item,
      priceUSD: copToUsd(item.priceCOP, value),
      updatedAt: new Date().toISOString(),
    }));
    persist(converted, "TRM aplicada. Los COP no cambiaron.");
  }

  function onPriceChange(field: "COP" | "USD", raw: string) {
    setPriceEditMode(field);
    if (field === "COP") {
      const cop = Number(raw.replace(/\s/g, "").replace(",", "."));
      setForm((f) => ({
        ...f,
        priceCOP: raw,
        priceUSD: Number.isFinite(cop) ? String(copToUsd(cop, trm.trm)) : f.priceUSD,
      }));
    } else {
      const usd = Number(raw.replace(/\s/g, "").replace(",", "."));
      setForm((f) => ({
        ...f,
        priceUSD: raw,
        priceCOP: Number.isFinite(usd) ? String(usdToCop(usd, trm.trm)) : f.priceCOP,
      }));
    }
  }

  function updatePriceCOP(id: string, raw: string) {
    const cop = parseCopInput(raw);
    if (!Number.isFinite(cop) || cop < 0) return;
    recordPrice(id, Math.round(cop));
    persist(
      items.map((i) =>
        i.id === id
          ? {
              ...i,
              priceCOP: Math.round(cop),
              priceUSD: copToUsd(cop, trm.trm),
              updatedAt: new Date().toISOString(),
            }
          : i
      ),
      "Precio actualizado"
    );
  }

  function startEdit(item: InventoryItem) {
    setEditingId(item.id);
    setForm({
      category: item.category,
      name: item.name,
      brand: item.brand,
      model: item.model,
      priceCOP: String(item.priceCOP),
      priceUSD: String(item.priceUSD),
      unit: item.unit,
      capacity: item.capacity != null ? String(item.capacity) : "",
      mountType: item.mountType ?? "cubierta",
      isDefault: item.isDefault,
      active: item.active,
      notes: item.notes ?? "",
      marginPercent: String(item.marginPercent ?? 0),
      applyIva: item.applyIva ?? item.category !== "panel",
      stock: item.stock != null ? String(item.stock) : "",
      leadTimeDays: item.leadTimeDays != null ? String(item.leadTimeDays) : "",
      datasheetUrl: item.datasheetUrl ?? "",
    });
    setDrawerOpen(true);
  }

  function closeDrawer() {
    setDrawerOpen(false);
  }

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
  }

  function newItem() {
    resetForm();
    setDrawerOpen(true);
  }

  function handleSubmit(e?: FormEvent) {
    e?.preventDefault();
    const priceCOP = Number(form.priceCOP);
    const priceUSD = Number(form.priceUSD);
    if (!form.name.trim() || !Number.isFinite(priceCOP) || !Number.isFinite(priceUSD)) {
      setFlash("Indique nombre y un costo válido.");
      return;
    }

    const payload: InventoryItem = {
      id: editingId ?? `${form.category}-${Date.now()}`,
      category: form.category,
      name: form.name.trim(),
      brand: form.brand.trim(),
      model: form.model.trim(),
      priceCOP: Math.round(priceCOP),
      priceUSD: Number(priceUSD.toFixed(2)),
      unit: form.unit.trim() || "unidad",
      capacity: form.capacity ? Number(form.capacity) : undefined,
      mountType: form.category === "structure" ? form.mountType : undefined,
      isDefault: form.isDefault,
      active: form.active,
      notes: form.notes.trim() || undefined,
      marginPercent: Number(form.marginPercent) || 0,
      applyIva: form.applyIva,
      stock: form.stock ? Number(form.stock) : undefined,
      leadTimeDays: form.leadTimeDays ? Number(form.leadTimeDays) : undefined,
      datasheetUrl: form.datasheetUrl.trim() || undefined,
      updatedAt: new Date().toISOString(),
    };
    recordPrice(payload.id, payload.priceCOP);

    let next = [...items];
    if (payload.isDefault) {
      next = next.map((i) =>
        i.category === payload.category && i.id !== payload.id
          ? { ...i, isDefault: false }
          : i
      );
    }

    if (editingId) {
      next = next.map((i) => (i.id === editingId ? payload : i));
    } else {
      next = [payload, ...next];
    }
    persist(next, editingId ? "Equipo actualizado" : "Equipo agregado al catálogo");
    setEditingId(payload.id);
  }

  function setAsDefault(id: string) {
    const target = items.find((i) => i.id === id);
    if (!target) return;
    persist(
      items.map((i) => ({
        ...i,
        isDefault:
          i.id === id ? true : i.category === target.category ? false : i.isDefault,
      })),
      "Default del cotizador actualizado"
    );
  }

  function toggleActive(id: string) {
    persist(
      items.map((i) =>
        i.id === id ? { ...i, active: !i.active, updatedAt: new Date().toISOString() } : i
      )
    );
  }

  function removeItem(id: string) {
    if (!confirm("¿Quitar este equipo del catálogo?")) return;
    persist(items.filter((i) => i.id !== id), "Equipo eliminado");
    if (editingId === id) {
      resetForm();
      setDrawerOpen(false);
    }
  }

  function addGroup() {
    const label = newGroupName.trim();
    if (!label) return;
    const id = slugCategory(label);
    if (CATEGORIES.includes(id)) {
      setForm((f) => ({ ...f, category: id as EquipmentCategory }));
      setNewGroupName("");
      return;
    }
    const next = [...customCats, { id, label }];
    setCustomCats(next);
    saveCustomCategories(next);
    setForm((f) => ({ ...f, category: id as EquipmentCategory }));
    setNewGroupName("");
    setFlash("Grupo creado");
  }

  const editing = items.find((i) => i.id === editingId);
  const history = editingId ? getPriceHistory(editingId) : [];
  const salePreview =
    Number(form.priceCOP) > 0
      ? Math.round(Number(form.priceCOP) * (1 + (Number(form.marginPercent) || 0) / 100))
      : 0;

  const trmDate = trm.updatedAt ? whenFmt.format(Date.parse(trm.updatedAt)) : "";

  return (
    <AppShell
      title="Inventario"
      subtitle={`TRM ${copFmt.format(trm.trm)} / USD${trmDate ? ` · ${trmDate}` : ""}`}
      actions={
        <>
          <div className="os-menu" ref={menuRef}>
            <button
              type="button"
              className="os-btn os-btn-ghost"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((v) => !v)}
            >
              Más
              <ChevronDown size={15} />
            </button>
            {menuOpen ? (
              <div className="os-menu-pop" role="menu">
                <button
                  type="button"
                  role="menuitem"
                  className="os-menu-item"
                  onClick={() => {
                    setMenuOpen(false);
                    persist(restoreOfficialCatalog(), "Lista oficial restaurada");
                  }}
                >
                  <History size={15} />
                  <span>Restaurar lista oficial Genera</span>
                </button>
              </div>
            ) : null}
          </div>
          <button type="button" className="os-btn os-btn-primary" onClick={newItem}>
            <Plus size={16} />
            Nuevo equipo
          </button>
        </>
      }
    >
      <div className="os-kpis">
        <OsKpi
          icon={Boxes}
          tone="ok"
          label="Activos"
          value={counts.active}
          hint={`${counts.total} en catálogo`}
          active={stockFilter === "all" && filter === "all"}
          onClick={() => {
            setStockFilter("all");
            setFilter("all");
          }}
        />
        <OsKpi
          icon={PackageMinus}
          tone={counts.zero > 0 ? "danger" : "neutral"}
          label="Sin stock"
          value={counts.zero}
          hint="Cero unidades"
          active={stockFilter === "zero"}
          onClick={() => setStockFilter((s) => (s === "zero" ? "all" : "zero"))}
        />
        <OsKpi
          icon={AlertTriangle}
          tone={counts.low > 0 ? "warn" : "neutral"}
          label="Stock bajo"
          value={counts.low}
          hint={`Hasta ${LOW_STOCK} unidades`}
          active={stockFilter === "low"}
          onClick={() => setStockFilter((s) => (s === "low" ? "all" : "low"))}
        />
        <OsKpi
          icon={DollarSign}
          tone="info"
          label="TRM"
          value={copFmt.format(trm.trm).replace(/\s/g, " ")}
          hint={trm.source || "COP por 1 USD"}
        />
      </div>

      <div className="os-trm">
        <div className="min-w-0">
          <p className="os-trm-title">Tipo de cambio</p>
          <p className="os-trm-hint">
            Al aplicar, se recalcula el USD desde el COP. El peso no se pisa.
            {trm.source ? ` · ${trm.source}` : ""}
          </p>
        </div>
        <label className="os-trm-field">
          <span>Nueva TRM (COP/USD)</span>
          <input
            value={trmInput}
            onChange={(e) => setTrmInput(e.target.value)}
            inputMode="decimal"
          />
        </label>
        <button type="button" className="os-btn os-btn-primary" onClick={handleTrmSave}>
          Aplicar TRM
        </button>
      </div>

      <div className="os-board-bar">
        <label className="os-file-search">
          <Search size={16} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nombre, marca o modelo…"
            aria-label="Buscar en inventario"
          />
        </label>
      </div>

      <div className="os-chips os-inv-chips">
        <button
          type="button"
          className="os-chip"
          aria-pressed={filter === "all"}
          onClick={() => setFilter("all")}
        >
          Todos <span>{items.length}</span>
        </button>
        {CATEGORIES.map((c) => {
          const n = items.filter((i) => i.category === c).length;
          return (
            <button
              key={c}
              type="button"
              className="os-chip"
              aria-pressed={filter === c}
              onClick={() => setFilter((f) => (f === c ? "all" : c))}
            >
              {categoryLabel(c, customCats)} <span>{n}</span>
            </button>
          );
        })}
      </div>

      <div className="os-inv-split">
        {filtered.length === 0 ? (
          <section className="os-work os-file-panel">
            <div className="os-empty">
              <span className="os-empty-icon">
                <PackageSearch size={20} />
              </span>
              <p className="os-empty-title">No hay equipos en este filtro</p>
              <p className="os-empty-hint">
                Cambie la categoría o el stock, o cree un equipo nuevo.
              </p>
              <button type="button" className="os-btn os-btn-ghost os-btn-sm" onClick={newItem}>
                <Plus size={14} />
                Nuevo equipo
              </button>
            </div>
          </section>
        ) : (
          <section className="os-work os-file-panel os-inv-sheet">
            <div className="os-inv-sheet-bar">
              <p>
                {filtered.length === 1 ? "1 equipo" : `${filtered.length} equipos`}
                {filter !== "all" ? ` · ${categoryLabel(filter, customCats)}` : ""}
              </p>
            </div>
            <div className="os-inv-table-wrap">
              <table className="os-inv-table">
                <thead>
                  <tr>
                    <th>Equipo</th>
                    <th className="num">Costo</th>
                    <th className="num">Venta</th>
                    <th>Stock</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((item) => {
                    const on = drawerOpen && editingId === item.id;
                    return (
                      <tr
                        key={item.id}
                        className={`${item.active ? "" : "is-off"}${on ? " is-on" : ""}`}
                        aria-selected={on}
                      >
                        <td>
                          <button
                            type="button"
                            className="os-inv-row-open"
                            onClick={() => startEdit(item)}
                          >
                            <span className="os-work-row-title">{item.name}</span>
                            <span className="os-work-row-meta">
                              {[
                                categoryLabel(item.category, customCats),
                                item.brand,
                                item.model,
                                capacityText(item),
                                item.mountType ? MOUNT_LABELS[item.mountType] : "",
                              ]
                                .filter(Boolean)
                                .join(" · ")}
                            </span>
                          </button>
                          {item.isDefault ? (
                            <span className="os-pill" data-tone="ok">
                              Default
                            </span>
                          ) : null}
                        </td>
                        <td className="num">
                          <InlinePrice
                            priceCOP={item.priceCOP}
                            priceUSD={item.priceUSD}
                            onCommit={(raw) => updatePriceCOP(item.id, raw)}
                          />
                        </td>
                        <td className="num">
                          <p className="os-inv-sale">
                            {copFmt.format(saleUnitCOP(item))}
                            {item.applyIva ? " + IVA" : ""}
                          </p>
                        </td>
                        <td>
                          <span className="os-pill" data-tone={stockTone(item.stock)}>
                            {stockLabel(item.stock)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {drawerOpen ? (
          <div className="os-drawer-backdrop" onClick={closeDrawer} />
        ) : null}
        <aside
          className="os-drawer os-inv-pane"
          data-open={drawerOpen ? "true" : undefined}
          aria-hidden={!drawerOpen}
          aria-label={
            drawerOpen
              ? editingId
                ? "Editar equipo"
                : "Nuevo equipo"
              : "Ficha del equipo"
          }
        >
        <div className="os-empty os-inv-pane-empty">
          <span className="os-empty-icon">
            <PackageSearch size={20} />
          </span>
          <p className="os-empty-title">Ficha del equipo</p>
          <p className="os-empty-hint">
            Seleccione una fila para ver margen, IVA y ficha. El costo se cambia en la tabla.
          </p>
          <button type="button" className="os-btn os-btn-ghost os-btn-sm" onClick={newItem}>
            <Plus size={14} />
            Nuevo equipo
          </button>
        </div>
        <header className="os-drawer-head">
          <div className="min-w-0">
            <p className="os-drawer-kicker">{editingId ? "Editar equipo" : "Nuevo equipo"}</p>
            <h2 className="os-drawer-title">{form.name.trim() || "Sin nombre"}</h2>
          </div>
          <button type="button" className="os-icon-btn" aria-label="Cerrar" onClick={closeDrawer}>
            <X size={18} />
          </button>
        </header>

        {editingId ? (
          <div className="os-drawer-actions">
            {editing && !editing.isDefault ? (
              <button
                type="button"
                className="os-btn os-btn-ghost os-btn-sm"
                onClick={() => setAsDefault(editingId)}
              >
                Usar por defecto
              </button>
            ) : (
              <span className="os-pill" data-tone="ok">
                Default cotizador
              </span>
            )}
            <button
              type="button"
              className="os-btn os-btn-ghost os-btn-sm"
              onClick={() => toggleActive(editingId)}
            >
              {editing?.active ? "Desactivar" : "Activar"}
            </button>
          </div>
        ) : null}

        <form className="os-drawer-body" onSubmit={handleSubmit}>
          <p className="os-drawer-section">Grupo</p>
          <div className="mb-3 flex flex-wrap items-end gap-2">
            <label className="min-w-[160px] flex-1 text-sm">
              <span className="mb-1 block font-medium">Nuevo grupo</span>
              <input
                className={field}
                placeholder="Ej. Iluminación LED"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
              />
            </label>
            <button type="button" className="os-btn os-btn-ghost" onClick={addGroup}>
              Agregar
            </button>
          </div>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Categoría</span>
            <select
              className={field}
              value={form.category}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  category: e.target.value as EquipmentCategory,
                }))
              }
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {categoryLabel(c, customCats)}
                </option>
              ))}
            </select>
          </label>

          <p className="os-drawer-section">Equipo</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm sm:col-span-2">
              <span className="mb-1 block font-medium">Nombre</span>
              <input
                className={field}
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                required
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium">Marca</span>
              <input
                className={field}
                value={form.brand}
                onChange={(e) => setForm((f) => ({ ...f, brand: e.target.value }))}
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium">Modelo</span>
              <input
                className={field}
                value={form.model}
                onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))}
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium">Unidad</span>
              <input
                className={field}
                value={form.unit}
                onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium">Capacidad (Wp / kW / kWh)</span>
              <input
                className={field}
                value={form.capacity}
                onChange={(e) => setForm((f) => ({ ...f, capacity: e.target.value }))}
                inputMode="decimal"
              />
            </label>
            {form.category === "structure" ? (
              <label className="text-sm">
                <span className="mb-1 block font-medium">Tipo de montaje</span>
                <select
                  className={field}
                  value={form.mountType}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      mountType: e.target.value as StructureMountType,
                    }))
                  }
                >
                  {(Object.keys(MOUNT_LABELS) as StructureMountType[]).map((m) => (
                    <option key={m} value={m}>
                      {MOUNT_LABELS[m]}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </div>

          <p className="os-drawer-section">Costo y venta</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">
              <span className="mb-1 block font-medium">Costo COP</span>
              <input
                className={field}
                value={form.priceCOP}
                onChange={(e) => onPriceChange("COP", e.target.value)}
                inputMode="decimal"
                required
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium">Precio USD</span>
              <input
                className={field}
                value={form.priceUSD}
                onChange={(e) => onPriceChange("USD", e.target.value)}
                inputMode="decimal"
                required
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium">Ganancia %</span>
              <input
                className={field}
                value={form.marginPercent}
                onChange={(e) => setForm((f) => ({ ...f, marginPercent: e.target.value }))}
                inputMode="decimal"
              />
            </label>
            <label className="flex items-end gap-2 pb-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={form.applyIva}
                onChange={(e) => setForm((f) => ({ ...f, applyIva: e.target.checked }))}
              />
              Aplica IVA 19%
            </label>
          </div>
          {salePreview > 0 ? (
            <p className="mt-2 text-sm text-[#4d5c55]">
              Precio de venta: <strong>{copFmt.format(salePreview)}</strong>
              {priceEditMode === "USD" ? " · editando desde USD" : ""}
            </p>
          ) : null}
          {history.length > 1 ? (
            <p className="mt-2 text-xs text-[#8a7f70]">
              Historial:{" "}
              {history
                .slice(-4)
                .map((h) => copFmt.format(h.priceCOP))
                .join(" → ")}
            </p>
          ) : null}

          <p className="os-drawer-section">Bodega</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">
              <span className="mb-1 block font-medium">Stock (und)</span>
              <input
                className={field}
                value={form.stock}
                onChange={(e) => setForm((f) => ({ ...f, stock: e.target.value }))}
                inputMode="numeric"
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium">Lead time (días)</span>
              <input
                className={field}
                value={form.leadTimeDays}
                onChange={(e) => setForm((f) => ({ ...f, leadTimeDays: e.target.value }))}
                inputMode="numeric"
              />
            </label>
            <label className="text-sm sm:col-span-2">
              <span className="mb-1 block font-medium">URL ficha técnica</span>
              <input
                className={field}
                placeholder="https://…pdf o cargue un archivo abajo"
                value={form.datasheetUrl}
                onChange={(e) => setForm((f) => ({ ...f, datasheetUrl: e.target.value }))}
              />
            </label>
            {editingId ? (
              <label className="text-sm sm:col-span-2">
                <span className="mb-1 block font-medium">PDF ficha técnica</span>
                <input
                  type="file"
                  accept="application/pdf,image/*"
                  className="w-full text-sm"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file || !editingId) return;
                    await saveDatasheetFile(editingId, file);
                    setFlash("Ficha técnica guardada");
                  }}
                />
              </label>
            ) : (
              <p className="text-xs text-[#6d7c74] sm:col-span-2">
                Guarde el equipo primero para adjuntar el PDF de la ficha.
              </p>
            )}
            <label className="text-sm sm:col-span-2">
              <span className="mb-1 block font-medium">Notas internas</span>
              <textarea
                className={field}
                rows={2}
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.isDefault}
                onChange={(e) => setForm((f) => ({ ...f, isDefault: e.target.checked }))}
              />
              Usar por defecto en cotizador
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
              />
              Activo
            </label>
          </div>
        </form>

        <footer className="os-drawer-foot">
          {editingId ? (
            <button
              type="button"
              className="os-icon-btn is-danger"
              aria-label="Eliminar equipo"
              title="Eliminar"
              onClick={() => removeItem(editingId)}
            >
              <Trash2 size={16} />
            </button>
          ) : null}
          <button type="button" className="os-btn os-btn-ghost" onClick={closeDrawer}>
            Cerrar
          </button>
          <button type="submit" className="os-btn os-btn-primary" onClick={handleSubmit}>
            {editingId ? "Guardar equipo" : "Agregar al catálogo"}
          </button>
        </footer>
        </aside>
      </div>

      {flash ? (
        <div className="os-toast" role="status">
          {flash}
        </div>
      ) : null}
    </AppShell>
  );
}

function InlinePrice({
  priceCOP,
  priceUSD,
  onCommit,
}: {
  priceCOP: number;
  priceUSD: number;
  onCommit: (raw: string) => void;
}) {
  const [draft, setDraft] = useState(String(priceCOP));
  useEffect(() => {
    setDraft(String(priceCOP));
  }, [priceCOP]);

  return (
    <label className="os-inv-cost">
      <span>Costo COP</span>
      <input
        value={draft}
        inputMode="numeric"
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => onCommit(draft)}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
      />
      <em>{usdFmt.format(priceUSD)}</em>
    </label>
  );
}
