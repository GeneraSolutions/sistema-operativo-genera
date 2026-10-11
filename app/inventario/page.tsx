"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import {
  MOUNT_LABELS,
  slugCategory,
  type EquipmentCategory,
  type InventoryItem,
  type StructureMountType,
  type TrmConfig,
} from "@/types/inventory";
import { saveDatasheetFile } from "@/lib/datasheets";
import { getPriceHistory, recordPrice } from "@/lib/price-history";
import { saleUnitCOP } from "@/lib/pricing";
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

export default function InventarioPage() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [trm, setTrm] = useState<TrmConfig>({ trm: 4125, source: "", updatedAt: "" });
  const [trmInput, setTrmInput] = useState("4125");
  const [filter, setFilter] = useState<EquipmentCategory | "all">("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [priceEditMode, setPriceEditMode] = useState<"COP" | "USD">("COP");
  const [savedFlash, setSavedFlash] = useState("");
  const [query, setQuery] = useState("");
  const [openCats, setOpenCats] = useState<Partial<Record<string, boolean>>>(
    {}
  );
  const [customCats, setCustomCats] = useState<{ id: string; label: string }[]>(
    []
  );
  const [newGroupName, setNewGroupName] = useState("");

  const CATEGORIES = allCategoryIds(customCats);

  useEffect(() => {
    const inv = loadInventory();
    const t = loadTrm();
    setItems(inv);
    setTrm(t);
    setTrmInput(String(t.trm));
    setCustomCats(loadCustomCategories());
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((i) => {
      if (filter !== "all" && i.category !== filter) return false;
      if (!q) return true;
      return `${i.name} ${i.brand} ${i.model}`.toLowerCase().includes(q);
    });
  }, [items, filter, query]);

  const grouped = useMemo(
    () =>
      CATEGORIES.map((category) => ({
        category,
        items: filtered.filter((i) => i.category === category),
      })).filter((g) => (filter === "all" ? true : g.category === filter)),
    [filtered, filter, customCats]
  );

  function isCatOpen(category: EquipmentCategory) {
    if (filter !== "all") return true;
    if (query.trim()) return true;
    return Boolean(openCats[category]);
  }

  function persist(next: InventoryItem[]) {
    setItems(next);
    saveInventory(next);
    setSavedFlash("Catálogo guardado");
    window.setTimeout(() => setSavedFlash(""), 1800);
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
    persist(converted);
  }

  function onPriceChange(field: "COP" | "USD", raw: string) {
    setPriceEditMode(field);
    if (field === "COP") {
      const cop = Number(raw.replace(/\s/g, "").replace(",", "."));
      setForm((f) => ({
        ...f,
        priceCOP: raw,
        priceUSD: Number.isFinite(cop)
          ? String(copToUsd(cop, trm.trm))
          : f.priceUSD,
      }));
    } else {
      const usd = Number(raw.replace(/\s/g, "").replace(",", "."));
      setForm((f) => ({
        ...f,
        priceUSD: raw,
        priceCOP: Number.isFinite(usd)
          ? String(usdToCop(usd, trm.trm))
          : f.priceCOP,
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
      )
    );
    setSavedFlash("Precio actualizado");
  }

  function startEdit(item: InventoryItem) {
    window.scrollTo({ top: 0, behavior: "smooth" });
    setOpenCats((s) => ({ ...s, [item.category]: true }));
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
  }

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const priceCOP = Number(form.priceCOP);
    const priceUSD = Number(form.priceUSD);
    if (!form.name.trim() || !Number.isFinite(priceCOP) || !Number.isFinite(priceUSD)) {
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
    persist(next);
    resetForm();
  }

  function setAsDefault(id: string) {
    const target = items.find((i) => i.id === id);
    if (!target) return;
    const next = items.map((i) => ({
      ...i,
      isDefault:
        i.id === id
          ? true
          : i.category === target.category
            ? false
            : i.isDefault,
    }));
    persist(next);
  }

  function toggleActive(id: string) {
    persist(
      items.map((i) =>
        i.id === id ? { ...i, active: !i.active, updatedAt: new Date().toISOString() } : i
      )
    );
  }

  function removeItem(id: string) {
    persist(items.filter((i) => i.id !== id));
    if (editingId === id) resetForm();
  }

  return (
    <AppShell title="Catálogo y precios" subtitle="Equipos · TRM · Defaults del cotizador">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold">Inventario de equipos</h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-[#4d5c55]">
            Puede cambiar el precio COP de cada equipo en la lista (se guarda al
            salir del campo o al pulsar Enter). El cotizador usa esos valores de
            inmediato. La TRM solo actualiza el equivalente en USD; no pisa sus COP.
          </p>
          <button
            type="button"
            className="mt-3 text-sm font-medium text-[#1f6b45] underline"
            onClick={() => {
              persist(restoreOfficialCatalog());
              setSavedFlash("Lista oficial restaurada");
            }}
          >
            Restaurar lista oficial de precios Genera
          </button>
        </div>
        {savedFlash ? (
          <span className="rounded-full bg-[#1f6b45]/15 px-3 py-1 text-xs font-semibold text-[#1f6b45]">
            {savedFlash}
          </span>
        ) : null}
      </div>

      <section className="mb-8 grid gap-4 rounded-2xl border border-[#ddd6c8] bg-white p-5 lg:grid-cols-[1fr_auto]">
        <div>
          <p className="text-xs tracking-[0.2em] text-[#8a6b2a] uppercase">TRM</p>
          <h3 className="mt-1 text-lg font-semibold">Tasa Representativa del Mercado</h3>
          <p className="mt-1 text-sm text-[#4d5c55]">
            Actual: <strong>{copFmt.format(trm.trm)}</strong> por USD
            {trm.source ? ` · ${trm.source}` : ""}
          </p>
          <p className="mt-1 text-xs text-[#6d7c74]">
            Al aplicar TRM se recalcula el USD a partir del COP (el peso colombiano
            es la fuente de verdad).
          </p>
        </div>
        <div className="flex items-end gap-2">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-[#4d5c55]">
              Nueva TRM (COP/USD)
            </span>
            <input
              className="w-40 rounded-xl border border-[#d8d2c4] bg-[#fbfaf6] px-3 py-2.5 outline-none ring-[#1f6b45] focus:ring-2"
              value={trmInput}
              onChange={(e) => setTrmInput(e.target.value)}
              inputMode="decimal"
            />
          </label>
          <button
            type="button"
            onClick={handleTrmSave}
            className="rounded-xl bg-[#0f2a1f] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#163d2c]"
          >
            Aplicar TRM
          </button>
        </div>
      </section>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.15fr)]">
        <section className="rounded-2xl border border-[#ddd6c8] bg-white p-5 shadow-[0_12px_40px_rgba(18,36,28,0.06)]">
          <h3 className="text-lg font-semibold">
            {editingId ? "Editar equipo" : "Nuevo equipo"}
          </h3>
          <div className="mt-3 flex flex-wrap items-end gap-2 rounded-xl bg-[#f7f4ee] p-3">
            <label className="min-w-[180px] flex-1 text-sm">
              <span className="mb-1 block font-medium">Nuevo grupo</span>
              <input
                className="w-full rounded-xl border border-[#d8d2c4] bg-white px-3 py-2"
                placeholder="Ej. Iluminación LED"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
              />
            </label>
            <button
              type="button"
              className="rounded-xl bg-[#0f3d2e] px-3 py-2 text-sm font-semibold text-white"
              onClick={() => {
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
                setOpenCats((s) => ({ ...s, [id]: true }));
                setNewGroupName("");
                setSavedFlash("Grupo creado");
              }}
            >
              Agregar grupo
            </button>
          </div>
          <form className="mt-4 space-y-3" onSubmit={handleSubmit}>
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Categoría</span>
              <select
                className="w-full rounded-xl border border-[#d8d2c4] bg-[#fbfaf6] px-3 py-2.5"
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

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="mb-1 block font-medium">Nombre</span>
                <input
                  className="w-full rounded-xl border border-[#d8d2c4] bg-[#fbfaf6] px-3 py-2.5"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  required
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium">Marca</span>
                <input
                  className="w-full rounded-xl border border-[#d8d2c4] bg-[#fbfaf6] px-3 py-2.5"
                  value={form.brand}
                  onChange={(e) => setForm((f) => ({ ...f, brand: e.target.value }))}
                />
              </label>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="mb-1 block font-medium">Modelo</span>
                <input
                  className="w-full rounded-xl border border-[#d8d2c4] bg-[#fbfaf6] px-3 py-2.5"
                  value={form.model}
                  onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))}
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium">Unidad</span>
                <input
                  className="w-full rounded-xl border border-[#d8d2c4] bg-[#fbfaf6] px-3 py-2.5"
                  value={form.unit}
                  onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
                />
              </label>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="mb-1 block font-medium">Costo COP</span>
                <input
                  className="w-full rounded-xl border border-[#d8d2c4] bg-[#fbfaf6] px-3 py-2.5"
                  value={form.priceCOP}
                  onChange={(e) => onPriceChange("COP", e.target.value)}
                  inputMode="decimal"
                  required
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium">Precio USD</span>
                <input
                  className="w-full rounded-xl border border-[#d8d2c4] bg-[#fbfaf6] px-3 py-2.5"
                  value={form.priceUSD}
                  onChange={(e) => onPriceChange("USD", e.target.value)}
                  inputMode="decimal"
                  required
                />
              </label>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="mb-1 block font-medium">Capacidad (Wp / kW / kWh)</span>
                <input
                  className="w-full rounded-xl border border-[#d8d2c4] bg-[#fbfaf6] px-3 py-2.5"
                  value={form.capacity}
                  onChange={(e) => setForm((f) => ({ ...f, capacity: e.target.value }))}
                  inputMode="decimal"
                />
              </label>
              {form.category === "structure" ? (
                <label className="block text-sm">
                  <span className="mb-1 block font-medium">Tipo de montaje</span>
                  <select
                    className="w-full rounded-xl border border-[#d8d2c4] bg-[#fbfaf6] px-3 py-2.5"
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
              ) : (
                <div />
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="mb-1 block font-medium">Stock (und)</span>
                <input
                  className="w-full rounded-xl border border-[#d8d2c4] bg-[#fbfaf6] px-3 py-2.5"
                  value={form.stock}
                  onChange={(e) => setForm((f) => ({ ...f, stock: e.target.value }))}
                  inputMode="numeric"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium">Lead time (días)</span>
                <input
                  className="w-full rounded-xl border border-[#d8d2c4] bg-[#fbfaf6] px-3 py-2.5"
                  value={form.leadTimeDays}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, leadTimeDays: e.target.value }))
                  }
                  inputMode="numeric"
                />
              </label>
            </div>
            <label className="block text-sm">
              <span className="mb-1 block font-medium">URL ficha técnica</span>
              <input
                className="w-full rounded-xl border border-[#d8d2c4] bg-[#fbfaf6] px-3 py-2.5"
                placeholder="https://…pdf o cargue un archivo abajo"
                value={form.datasheetUrl}
                onChange={(e) =>
                  setForm((f) => ({ ...f, datasheetUrl: e.target.value }))
                }
              />
            </label>
            {editingId ? (
              <label className="block text-sm">
                <span className="mb-1 block font-medium">PDF ficha técnica</span>
                <input
                  type="file"
                  accept="application/pdf,image/*"
                  className="w-full text-sm"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file || !editingId) return;
                    await saveDatasheetFile(editingId, file);
                    setSavedFlash("Ficha técnica guardada");
                  }}
                />
              </label>
            ) : (
              <p className="text-xs text-[#6d7c74]">
                Guarde el equipo primero para adjuntar el PDF de la ficha.
              </p>
            )}
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Notas internas</span>
              <textarea
                className="w-full rounded-xl border border-[#d8d2c4] bg-[#fbfaf6] px-3 py-2.5"
                rows={2}
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </label>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="mb-1 block font-medium">Ganancia %</span>
                <input
                  className="w-full rounded-xl border border-[#d8d2c4] bg-[#fbfaf6] px-3 py-2.5"
                  value={form.marginPercent}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, marginPercent: e.target.value }))
                  }
                  inputMode="decimal"
                />
              </label>
              <label className="flex items-end gap-2 pb-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.applyIva}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, applyIva: e.target.checked }))
                  }
                />
                Aplica IVA 19%
              </label>
            </div>
            {Number(form.priceCOP) > 0 ? (
              <p className="text-sm text-[#4d5c55]">
                Precio de venta:{" "}
                <strong>
                  {copFmt.format(
                    Math.round(
                      Number(form.priceCOP) *
                        (1 + (Number(form.marginPercent) || 0) / 100)
                    )
                  )}
                </strong>
              </p>
            ) : null}

            <div className="flex flex-wrap gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.isDefault}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, isDefault: e.target.checked }))
                  }
                />
                Usar por defecto en cotizador
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, active: e.target.checked }))
                  }
                />
                Activo
              </label>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="submit"
                className="flex-1 rounded-xl bg-[#d4b46a] px-4 py-3 text-sm font-semibold text-[#12241c] hover:bg-[#c7a45a]"
              >
                {editingId ? "Actualizar" : "Agregar al catálogo"}
              </button>
              {editingId ? (
                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded-xl border border-[#d8d2c4] px-4 py-3 text-sm font-medium"
                >
                  Cancelar
                </button>
              ) : null}
            </div>
          </form>
        </section>

        <section className="space-y-4">
          <input
            className="w-full rounded-xl border border-[#d8d2c4] bg-white px-3 py-2.5 text-sm outline-none ring-[#1f6b45] focus:ring-2"
            placeholder="Buscar por nombre, marca o modelo…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="flex flex-wrap gap-1.5">
            <FilterChip
              active={filter === "all"}
              onClick={() => setFilter("all")}
              label="Todos"
            />
            {CATEGORIES.map((c) => (
              <FilterChip
                key={c}
                active={filter === c}
                onClick={() => setFilter(c as EquipmentCategory)}
                label={categoryLabel(c, customCats)}
              />
            ))}
          </div>

          <div className="space-y-2">
            {grouped.map((group) => {
              const open = isCatOpen(group.category);
              return (
                <section
                  key={group.category}
                  className="overflow-hidden rounded-2xl border border-[#ddd6c8] bg-white"
                >
                  <button
                    type="button"
                    aria-expanded={open}
                    onClick={() =>
                      setOpenCats((s) => ({
                        ...s,
                        [group.category]: !isCatOpen(group.category),
                      }))
                    }
                    className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                  >
                    <div>
                      <h3 className="text-base font-semibold">
                        {categoryLabel(group.category, customCats)}
                      </h3>
                      <p className="text-xs text-[#6d7c74]">
                        {group.items.length} equipo
                        {group.items.length === 1 ? "" : "s"}
                        {!open && group.items[0]
                          ? ` · ${group.items[0].brand}`
                          : ""}
                      </p>
                    </div>
                    <span
                      aria-hidden
                      className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#fbfaf6] text-lg font-semibold text-[#1f6b45]"
                    >
                      {open ? "−" : "+"}
                    </span>
                  </button>
                  {open ? (
                    <div className="space-y-3 border-t border-[#eee8dc] px-3 py-3">
                      {group.items.length === 0 ? (
                        <p className="px-1 py-4 text-center text-sm text-[#6d7c74]">
                          No hay equipos en esta categoría.
                        </p>
                      ) : (
                        group.items.map((item) => (
                          <article
                            key={item.id}
                            className={`rounded-xl border bg-[#fbfaf6] p-4 shadow-sm transition ${
                              item.active
                                ? "border-[#ddd6c8]"
                                : "border-dashed border-[#c9bfad] opacity-70"
                            }`}
                          >
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div>
                                <p className="text-[10px] font-semibold tracking-[0.18em] text-[#8a6b2a] uppercase">
                                  {item.mountType
                                    ? MOUNT_LABELS[item.mountType]
                                    : categoryLabel(item.category, customCats)}
                                </p>
                                <h4 className="mt-0.5 text-base font-semibold">
                                  {item.name}
                                </h4>
                                <p className="text-sm text-[#4d5c55]">
                                  {item.brand} {item.model}
                                  {item.capacity != null
                                    ? ` · ${item.capacity} ${
                                        item.unit === "módulo" &&
                                        item.category === "panel"
                                          ? "Wp"
                                          : ""
                                      }`
                                    : ""}
                                </p>
                              </div>
                              <div className="flex flex-wrap items-end justify-end gap-3">
                                <InlinePrice
                                  priceCOP={item.priceCOP}
                                  priceUSD={item.priceUSD}
                                  onCommit={(raw) =>
                                    updatePriceCOP(item.id, raw)
                                  }
                                />
                                <label className="min-w-[88px] text-right text-sm">
                                  <span className="block text-[10px] font-semibold tracking-wide text-[#8a6b2a] uppercase">
                                    Ganancia %
                                  </span>
                                  <input
                                    className="mt-0.5 w-full rounded-lg border border-[#d8d2c4] bg-white px-2 py-1.5 text-right font-semibold outline-none ring-[#1f6b45] focus:ring-2"
                                    defaultValue={item.marginPercent ?? 0}
                                    key={`${item.id}-m-${item.marginPercent}`}
                                    inputMode="decimal"
                                    onBlur={(e) => {
                                      const m = Number(
                                        e.target.value.replace(",", ".")
                                      );
                                      if (!Number.isFinite(m)) return;
                                      persist(
                                        items.map((i) =>
                                          i.id === item.id
                                            ? {
                                                ...i,
                                                marginPercent: m,
                                                updatedAt:
                                                  new Date().toISOString(),
                                              }
                                            : i
                                        )
                                      );
                                    }}
                                  />
                                </label>
                                <label className="flex items-center gap-1 pb-2 text-[11px] text-[#4d5c55]">
                                  <input
                                    type="checkbox"
                                    checked={item.applyIva}
                                    onChange={(e) =>
                                      persist(
                                        items.map((i) =>
                                          i.id === item.id
                                            ? {
                                                ...i,
                                                applyIva: e.target.checked,
                                                updatedAt:
                                                  new Date().toISOString(),
                                              }
                                            : i
                                        )
                                      )
                                    }
                                  />
                                  IVA
                                </label>
                              </div>
                              <p className="mt-1 w-full text-right text-xs text-[#1f6b45]">
                                Venta {copFmt.format(saleUnitCOP(item))}
                                {item.applyIva ? " + IVA" : " sin IVA"}
                                {item.stock != null
                                  ? ` · Stock ${item.stock}`
                                  : ""}
                                {item.leadTimeDays
                                  ? ` · ${item.leadTimeDays} días`
                                  : ""}
                              </p>
                              {getPriceHistory(item.id).length > 1 ? (
                                <p className="mt-1 w-full text-right text-[10px] text-[#8a7f70]">
                                  Historial:{" "}
                                  {getPriceHistory(item.id)
                                    .slice(-4)
                                    .map((h) => copFmt.format(h.priceCOP))
                                    .join(" → ")}
                                </p>
                              ) : null}
                            </div>

                            <div className="mt-3 flex flex-wrap items-center gap-2">
                              {item.isDefault ? (
                                <span className="rounded-full bg-[#1f6b45] px-2.5 py-0.5 text-[10px] font-bold tracking-wide text-white uppercase">
                                  Default cotizador
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setAsDefault(item.id)}
                                  className="rounded-full bg-[#f0ebe3] px-2.5 py-0.5 text-[10px] font-semibold tracking-wide text-[#4d5c55] uppercase hover:bg-[#1f6b45] hover:text-white"
                                >
                                  Usar por defecto
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => toggleActive(item.id)}
                                className="rounded-full px-2.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase ring-1 ring-[#d8d2c4]"
                              >
                                {item.active ? "Desactivar" : "Activar"}
                              </button>
                              <button
                                type="button"
                                onClick={() => startEdit(item)}
                                className="rounded-full px-2.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase ring-1 ring-[#d8d2c4]"
                              >
                                Editar
                              </button>
                              <button
                                type="button"
                                onClick={() => removeItem(item.id)}
                                className="rounded-full px-2.5 py-0.5 text-[10px] font-semibold tracking-wide text-[#9b2c2c] uppercase ring-1 ring-[#e8cfcf]"
                              >
                                Eliminar
                              </button>
                            </div>
                          </article>
                        ))
                      )}
                    </div>
                  ) : null}
                </section>
              );
            })}
            {filtered.length === 0 && filter !== "all" ? (
              <p className="rounded-2xl border border-dashed border-[#c9bfad] p-8 text-center text-sm text-[#6d7c74]">
                No hay equipos en esta categoría.
              </p>
            ) : null}
          </div>
        </section>
      </div>
    </AppShell>
  );
}

function parseCopInput(raw: string): number {
  const compact = raw.replace(/\s/g, "").replace(/[.$]/g, "").replace(",", ".");
  const n = Number(compact);
  return n;
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
    <div className="min-w-[160px] text-right">
      <label className="block text-[10px] font-semibold tracking-wide text-[#8a6b2a] uppercase">
        Precio COP
      </label>
      <input
        className="mt-0.5 w-full rounded-lg border border-[#d8d2c4] bg-[#fbfaf6] px-2 py-1.5 text-right text-base font-semibold outline-none ring-[#1f6b45] focus:ring-2"
        value={draft}
        inputMode="numeric"
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => onCommit(draft)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.currentTarget.blur();
          }
        }}
      />
      <p className="mt-0.5 text-xs text-[#6d7c74]">{usdFmt.format(priceUSD)}</p>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
        active
          ? "bg-[#0f2a1f] text-white"
          : "bg-white text-[#4d5c55] ring-1 ring-[#d8d2c4] hover:bg-[#f7f4ee]"
      }`}
    >
      {label}
    </button>
  );
}
