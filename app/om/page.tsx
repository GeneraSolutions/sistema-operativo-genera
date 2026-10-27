"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  CalendarX,
  Camera,
  CheckCircle2,
  ClipboardList,
  Cpu,
  FileCheck2,
  LayoutGrid,
  MapPin,
  Plus,
  Stethoscope,
  Trash2,
  X,
  Zap,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { OsKpi, type OsTone } from "@/components/OsKpi";
import {
  OM_CONTRACT_LABELS,
  OM_STATUS_LABELS,
  addMonths,
  daysUntil,
  markMaintenanceDone,
  omStatus,
  plantLabel,
  type OmStatus,
} from "@/lib/om";
import { takeNewFlag } from "@/lib/os-command";
import {
  OPEN_OM_PLANT_KEY,
  OPEN_REPORT_KIND_KEY,
  deletePlant,
  emptyPlant,
  loadPlants,
  mergePlants,
  replacePlants,
  upsertPlant,
  type OmContract,
  type PlantProfile,
} from "@/lib/technical-reports";

const field =
  "w-full rounded-xl border border-[#d8d2c4] bg-[#fbfaf6] px-3 py-2.5 text-sm";

const STATUS_ORDER: OmStatus[] = ["vencido", "proximo", "al-dia", "sin-fecha"];

const STATUS_TONE: Record<OmStatus, OsTone> = {
  vencido: "danger",
  proximo: "warn",
  "al-dia": "ok",
  "sin-fecha": "neutral",
};

const monthFmt = new Intl.DateTimeFormat("es-CO", { month: "long", year: "numeric" });
const dayFmt = new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short" });

function todayISO() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function fmtDay(iso?: string) {
  if (!iso) return "";
  const t = Date.parse(`${iso}T12:00:00`);
  return Number.isFinite(t) ? dayFmt.format(t) : iso;
}

function countdown(d: number | null) {
  if (d === null) return { big: "—", small: "Sin fecha programada" };
  if (d === 0) return { big: "Hoy", small: "Mantenimiento programado" };
  if (d < 0) return { big: `${Math.abs(d)} d`, small: "de retraso" };
  return { big: `${d} d`, small: "para el próximo" };
}

function persistCloud(plants: PlantProfile[]) {
  void fetch("/api/archivo", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ plants }),
  }).catch(() => undefined);
}

export default function OmPage() {
  const router = useRouter();
  const [plants, setPlants] = useState<PlantProfile[]>([]);
  const [draft, setDraft] = useState<PlantProfile>(() => emptyPlant());
  const [filter, setFilter] = useState<"todas" | OmStatus>("todas");
  const [view, setView] = useState<"cartera" | "calendario">("cartera");
  const [flash, setFlash] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    const local = loadPlants();
    setPlants(local);
    const openId = sessionStorage.getItem(OPEN_OM_PLANT_KEY);
    if (openId) {
      const found = local.find((p) => p.id === openId);
      if (found) {
        setDraft({ ...emptyPlant(), ...found });
        setDrawerOpen(true);
      }
      sessionStorage.removeItem(OPEN_OM_PLANT_KEY);
    } else if (takeNewFlag()) {
      newPlant();
    }
    void fetch("/api/archivo", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data?.plants) return;
        const merged = mergePlants(loadPlants(), data.plants);
        replacePlants(merged);
        setPlants(merged);
        const stillOpen = openId
          ? merged.find((p) => p.id === openId)
          : undefined;
        if (stillOpen) {
          setDraft({ ...emptyPlant(), ...stillOpen });
          setDrawerOpen(true);
        }
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(""), 3600);
    return () => clearTimeout(t);
  }, [flash]);

  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDrawerOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawerOpen]);

  const counts = useMemo(() => {
    const list = plants.map(omStatus);
    return {
      vencido: list.filter((s) => s === "vencido").length,
      proximo: list.filter((s) => s === "proximo").length,
      "al-dia": list.filter((s) => s === "al-dia").length,
      "sin-fecha": list.filter((s) => s === "sin-fecha").length,
    } as Record<OmStatus, number>;
  }, [plants]);

  const totalKwp = plants.reduce((s, p) => s + (Number(p.kwp) || 0), 0);

  const visible = plants
    .filter((p) => (filter === "todas" ? true : omStatus(p) === filter))
    .sort((a, b) => {
      const da = daysUntil(a.nextMaintenance);
      const db = daysUntil(b.nextMaintenance);
      if (da === null && db === null) return 0;
      if (da === null) return 1;
      if (db === null) return -1;
      return da - db;
    });

  const calendar = useMemo(() => {
    const now = new Date();
    const months = Array.from({ length: 12 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const name = monthFmt.format(d);
      return {
        key,
        label: name.charAt(0).toUpperCase() + name.slice(1),
        items: [] as PlantProfile[],
      };
    });
    const overdue: PlantProfile[] = [];
    const byDate = (a: PlantProfile, b: PlantProfile) =>
      (a.nextMaintenance || "").localeCompare(b.nextMaintenance || "");
    for (const p of plants) {
      const next = p.nextMaintenance;
      if (!next) continue;
      if (omStatus(p) === "vencido") {
        overdue.push(p);
        continue;
      }
      const month = months.find((m) => next.startsWith(m.key));
      month?.items.push(p);
    }
    for (const m of months) m.items.sort(byDate);
    overdue.sort(byDate);
    return { months, overdue };
  }, [plants]);

  const isExisting = plants.some((p) => p.id === draft.id);

  function openPlant(p: PlantProfile) {
    setDraft({ ...emptyPlant(), ...p });
    setDrawerOpen(true);
  }

  function newPlant() {
    setDraft(emptyPlant());
    setDrawerOpen(true);
  }

  function saveDraft() {
    if (!draft.clientName.trim()) {
      setFlash("Indique al menos el cliente.");
      return;
    }
    const next = upsertPlant(draft);
    setPlants(next);
    persistCloud(next);
    setFlash("Planta guardada en O&M y Archivo.");
  }

  function doneToday(p: PlantProfile) {
    const date = todayISO();
    const updated = markMaintenanceDone(p, date);
    const next = upsertPlant(updated);
    setPlants(next);
    persistCloud(next);
    if (draft.id === p.id) setDraft({ ...emptyPlant(), ...updated });
    setFlash(
      `Mantenimiento registrado. Próxima visita ${addMonths(date, p.intervalMonths || 12)}.`
    );
  }

  function removePlant(p: PlantProfile) {
    if (!confirm("¿Quitar esta planta de O&M?")) return;
    const next = deletePlant(p.id);
    setPlants(next);
    persistCloud(next);
    void fetch(`/api/archivo?plant=${p.id}`, { method: "DELETE" });
    setDrawerOpen(false);
    setFlash("Planta eliminada de O&M.");
  }

  function openReport(plant: PlantProfile, kind: "pre-mantenimiento" | "post-mantenimiento") {
    sessionStorage.setItem(OPEN_OM_PLANT_KEY, plant.id);
    sessionStorage.setItem(OPEN_REPORT_KIND_KEY, kind);
    router.push("/informes");
  }

  function calcNext() {
    if (!draft.lastMaintenance && !draft.nextMaintenance) {
      const last = todayISO();
      setDraft((p) => ({
        ...p,
        lastMaintenance: last,
        nextMaintenance: addMonths(last, p.intervalMonths || 12),
      }));
      return;
    }
    if (draft.lastMaintenance) {
      setDraft((p) => ({
        ...p,
        nextMaintenance: addMonths(
          p.lastMaintenance || todayISO(),
          p.intervalMonths || 12
        ),
      }));
    }
  }

  return (
    <AppShell
      title="O&M"
      subtitle="Plantas en operación, calendario de mantenimientos y contratos"
      actions={
        <button type="button" className="os-btn os-btn-primary" onClick={newPlant}>
          <Plus size={16} />
          Nueva planta
        </button>
      }
    >
      <div className="os-kpis">
        <OsKpi
          icon={CalendarX}
          tone={counts.vencido > 0 ? "danger" : "neutral"}
          label="Vencidos"
          value={counts.vencido}
          hint={counts.vencido > 0 ? "Programar diagnóstico ya" : "Ninguno atrasado"}
        />
        <OsKpi
          icon={CalendarClock}
          tone={counts.proximo > 0 ? "warn" : "neutral"}
          label="En los próximos 30 días"
          value={counts.proximo}
          hint="Agendar cuadrilla"
        />
        <OsKpi
          icon={CalendarCheck}
          tone="ok"
          label="Al día"
          value={counts["al-dia"]}
          hint={`${counts["sin-fecha"]} sin fecha programada`}
        />
        <OsKpi
          icon={Zap}
          tone="info"
          label="Cartera"
          value={plants.length}
          hint={totalKwp > 0 ? `${totalKwp.toLocaleString("es-CO")} kWp en operación` : "Plantas registradas"}
        />
      </div>

      <div className="os-board-bar">
        <div className="os-seg" role="tablist" aria-label="Vista">
          <button
            type="button"
            role="tab"
            aria-selected={view === "cartera"}
            className="os-seg-btn"
            onClick={() => setView("cartera")}
          >
            <LayoutGrid size={15} />
            Cartera
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view === "calendario"}
            className="os-seg-btn"
            onClick={() => setView("calendario")}
          >
            <CalendarDays size={15} />
            Calendario
          </button>
        </div>
        {view === "cartera" ? (
          <div className="os-chips">
            <button
              type="button"
              className="os-chip"
              aria-pressed={filter === "todas"}
              onClick={() => setFilter("todas")}
            >
              Todas <span>{plants.length}</span>
            </button>
            {STATUS_ORDER.map((id) => (
              <button
                key={id}
                type="button"
                className="os-chip"
                aria-pressed={filter === id}
                onClick={() => setFilter((f) => (f === id ? "todas" : id))}
              >
                {OM_STATUS_LABELS[id]} <span>{counts[id]}</span>
              </button>
            ))}
          </div>
        ) : (
          <p className="os-board-hint">
            Próximos 12 meses según la fecha de cada planta. Toque una para abrirla.
          </p>
        )}
      </div>

      {view === "calendario" ? (
        <div className="os-cal">
          {calendar.overdue.length > 0 ? (
            <section className="os-cal-month is-overdue">
              <header className="os-cal-head">
                <AlertTriangle size={14} />
                <h2>Vencidos</h2>
                <span className="os-col-count">{calendar.overdue.length}</span>
              </header>
              {calendar.overdue.map((p) => (
                <button key={p.id} type="button" className="os-cal-item" onClick={() => openPlant(p)}>
                  <span className="os-cal-date">{fmtDay(p.nextMaintenance)}</span>
                  <span className="os-cal-name">{plantLabel(p)}</span>
                </button>
              ))}
            </section>
          ) : null}
          {calendar.months.map((m) => (
            <section key={m.key} className="os-cal-month">
              <header className="os-cal-head">
                <h2>{m.label}</h2>
                {m.items.length ? <span className="os-col-count">{m.items.length}</span> : null}
              </header>
              {m.items.length === 0 ? (
                <p className="os-cal-empty">Sin mantenimientos</p>
              ) : (
                m.items.map((p) => (
                  <button key={p.id} type="button" className="os-cal-item" onClick={() => openPlant(p)}>
                    <span className="os-cal-date">{fmtDay(p.nextMaintenance)}</span>
                    <span className="os-cal-name">{plantLabel(p)}</span>
                  </button>
                ))
              )}
            </section>
          ))}
        </div>
      ) : visible.length === 0 ? (
        <section className="os-work">
          <div className="os-empty">
            <span className="os-empty-icon">
              <ClipboardList size={20} />
            </span>
            <p className="os-empty-title">
              {plants.length === 0 ? "Aún no hay plantas en O&M" : "No hay plantas en este filtro"}
            </p>
            <p className="os-empty-hint">
              Al energizar una obra, pásela a O&M desde Obra. También puede registrar
              plantas de otros instaladores.
            </p>
            <button type="button" className="os-btn os-btn-ghost os-btn-sm" onClick={newPlant}>
              <Plus size={14} />
              Nueva planta
            </button>
          </div>
        </section>
      ) : (
        <div className="os-tiles">
          {visible.map((p) => {
            const status = omStatus(p);
            const d = daysUntil(p.nextMaintenance);
            const cd = countdown(d);
            return (
              <article key={p.id} className="os-tile os-plant" data-om={status}>
                <button type="button" className="os-tile-open" onClick={() => openPlant(p)}>
                  <div className="os-tile-head">
                    <div className="min-w-0">
                      <p className="os-tile-title">{p.clientName || "Sin cliente"}</p>
                      {p.siteName || p.city ? (
                        <p className="os-card-sub">
                          <MapPin size={12} />
                          {[p.siteName, p.city].filter(Boolean).join(" · ")}
                        </p>
                      ) : null}
                    </div>
                    <span className="os-pill" data-tone={STATUS_TONE[status]}>
                      {OM_STATUS_LABELS[status]}
                    </span>
                  </div>
                  <div className="os-countdown" data-tone={STATUS_TONE[status]}>
                    <span className="os-countdown-big">{cd.big}</span>
                    <span className="os-countdown-small">
                      {cd.small}
                      {p.nextMaintenance ? ` · ${fmtDay(p.nextMaintenance)}` : ""}
                    </span>
                  </div>
                  <div className="os-tile-foot">
                    {p.kwp ? (
                      <span className="os-tag">
                        <Zap size={11} />
                        {p.kwp} kWp
                      </span>
                    ) : null}
                    <span className="os-tag">
                      <FileCheck2 size={11} />
                      {OM_CONTRACT_LABELS[p.contract || "ninguno"]}
                    </span>
                    {p.inverter ? (
                      <span className="os-tag">
                        <Cpu size={11} />
                        {p.inverter}
                      </span>
                    ) : null}
                    {p.ours ? <span className="os-tag is-money">Genera</span> : null}
                  </div>
                </button>
                <div className="os-tile-actions">
                  <button type="button" className="os-btn os-btn-ghost os-btn-sm" onClick={() => openReport(p, "pre-mantenimiento")}>
                    <Stethoscope size={14} />
                    Diagnóstico
                  </button>
                  <button type="button" className="os-btn os-btn-ghost os-btn-sm" onClick={() => doneToday(p)}>
                    <CheckCircle2 size={14} />
                    Hecho hoy
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {drawerOpen ? (
        <div className="os-drawer-backdrop" onClick={() => setDrawerOpen(false)} />
      ) : null}
      <aside
        className="os-drawer"
        data-open={drawerOpen ? "true" : undefined}
        aria-hidden={!drawerOpen}
        aria-label={isExisting ? "Editar planta" : "Nueva planta"}
      >
        <header className="os-drawer-head">
          <div className="min-w-0">
            <p className="os-drawer-kicker">{isExisting ? "Editar planta" : "Nueva planta"}</p>
            <h2 className="os-drawer-title">{draft.clientName.trim() || "Sin cliente"}</h2>
            <span className="os-pill" data-tone={STATUS_TONE[omStatus(draft)]}>
              {OM_STATUS_LABELS[omStatus(draft)]}
            </span>
          </div>
          <button
            type="button"
            className="os-icon-btn"
            aria-label="Cerrar"
            onClick={() => setDrawerOpen(false)}
          >
            <X size={18} />
          </button>
        </header>

        {isExisting ? (
          <div className="os-drawer-actions">
            <button type="button" className="os-btn os-btn-ghost os-btn-sm" onClick={() => openReport(draft, "pre-mantenimiento")}>
              <Stethoscope size={14} />
              Diagnóstico
            </button>
            <button type="button" className="os-btn os-btn-ghost os-btn-sm" onClick={() => openReport(draft, "post-mantenimiento")}>
              <ClipboardList size={14} />
              Post-mantenimiento
            </button>
            <a href="/informes/dictamen" className="os-btn os-btn-ghost os-btn-sm">
              <Camera size={14} />
              Dictamen foto
            </a>
            <button type="button" className="os-btn os-btn-ghost os-btn-sm" onClick={() => doneToday(draft)}>
              <CheckCircle2 size={14} />
              Hecho hoy
            </button>
          </div>
        ) : null}

        <div className="os-drawer-body">
          <p className="os-drawer-section is-first">Planta</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm sm:col-span-2">
              <span className="mb-1 block font-medium">Cliente</span>
              <input
                className={field}
                value={draft.clientName}
                onChange={(e) =>
                  setDraft((p) => ({ ...p, clientName: e.target.value }))
                }
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium">Sitio</span>
              <input
                className={field}
                value={draft.siteName}
                onChange={(e) =>
                  setDraft((p) => ({ ...p, siteName: e.target.value }))
                }
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium">Ciudad</span>
              <input
                className={field}
                value={draft.city}
                onChange={(e) => setDraft((p) => ({ ...p, city: e.target.value }))}
              />
            </label>
            <label className="text-sm sm:col-span-2">
              <span className="mb-1 block font-medium">Dirección</span>
              <input
                className={field}
                value={draft.address}
                onChange={(e) =>
                  setDraft((p) => ({ ...p, address: e.target.value }))
                }
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium">kWp</span>
              <input
                className={field}
                value={draft.kwp}
                onChange={(e) => setDraft((p) => ({ ...p, kwp: e.target.value }))}
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium">Inversor</span>
              <input
                className={field}
                value={draft.inverter}
                onChange={(e) =>
                  setDraft((p) => ({ ...p, inverter: e.target.value }))
                }
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium">Contacto</span>
              <input
                className={field}
                value={draft.contact || ""}
                onChange={(e) =>
                  setDraft((p) => ({ ...p, contact: e.target.value }))
                }
              />
            </label>
            <label className="flex items-end gap-2 pb-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={draft.ours}
                onChange={(e) =>
                  setDraft((p) => ({ ...p, ours: e.target.checked }))
                }
              />
              Instalada por GENERA
            </label>
          </div>

          <p className="os-drawer-section">Contrato y calendario</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">
              <span className="mb-1 block font-medium">Contrato</span>
              <select
                className={field}
                value={draft.contract || "ninguno"}
                onChange={(e) =>
                  setDraft((p) => ({
                    ...p,
                    contract: e.target.value as OmContract,
                  }))
                }
              >
                {(Object.keys(OM_CONTRACT_LABELS) as OmContract[]).map((id) => (
                  <option key={id} value={id}>
                    {OM_CONTRACT_LABELS[id]}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium">Cada (meses)</span>
              <input
                type="number"
                min={1}
                className={field}
                value={draft.intervalMonths || 12}
                onChange={(e) =>
                  setDraft((p) => ({
                    ...p,
                    intervalMonths: Math.max(1, Number(e.target.value) || 12),
                  }))
                }
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium">Último mantenimiento</span>
              <input
                type="date"
                className={field}
                value={draft.lastMaintenance || ""}
                onChange={(e) =>
                  setDraft((p) => ({ ...p, lastMaintenance: e.target.value }))
                }
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium">Próximo</span>
              <input
                type="date"
                className={field}
                value={draft.nextMaintenance || ""}
                onChange={(e) =>
                  setDraft((p) => ({ ...p, nextMaintenance: e.target.value }))
                }
              />
            </label>
            <div className="sm:col-span-2">
              <button type="button" className="os-btn os-btn-ghost os-btn-sm" onClick={calcNext}>
                <CalendarClock size={14} />
                Calcular próxima fecha
              </button>
            </div>
          </div>
          <label className="mt-4 block text-sm">
            <span className="mb-1 block font-medium">Notas</span>
            <textarea
              className={field}
              rows={3}
              value={draft.notes}
              onChange={(e) => setDraft((p) => ({ ...p, notes: e.target.value }))}
            />
          </label>
        </div>

        <footer className="os-drawer-foot">
          {isExisting ? (
            <button
              type="button"
              className="os-icon-btn is-danger"
              aria-label="Quitar planta"
              title="Quitar planta"
              onClick={() => removePlant(draft)}
            >
              <Trash2 size={16} />
            </button>
          ) : null}
          <button type="button" className="os-btn os-btn-ghost" onClick={() => setDrawerOpen(false)}>
            Cerrar
          </button>
          <button type="button" className="os-btn os-btn-primary" onClick={saveDraft}>
            Guardar planta
          </button>
        </footer>
      </aside>

      {flash ? (
        <div className="os-toast" role="status">
          {flash}
        </div>
      ) : null}
    </AppShell>
  );
}
