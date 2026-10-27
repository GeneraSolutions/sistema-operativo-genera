"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarRange,
  ClipboardCheck,
  FileBadge,
  FileSpreadsheet,
  HardHat,
  MapPin,
  Plus,
  ShoppingCart,
  Trash2,
  Users,
  Wrench,
  X,
  Zap,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { OsKpi, type OsTone } from "@/components/OsKpi";
import {
  OBRA_STATUS_LABELS,
  OPEN_OBRA_KEY,
  TRAMITE_LABELS,
  deleteObra,
  emptyObra,
  loadObras,
  mergeObras,
  obraLabel,
  replaceObras,
  upsertObra,
  type ObraJob,
  type ObraStatus,
  type TramiteStatus,
} from "@/lib/obra";
import { daysUntil } from "@/lib/om";
import { takeNewFlag } from "@/lib/os-command";
import { loadSavedQuotes, pinActiveQuote } from "@/lib/saved-quotes";
import {
  OPEN_QUOTE_KEY,
  OPEN_VISIT_KEY,
  loadSavedVisits,
} from "@/lib/saved-visits";
import { emptyPlant, upsertPlant } from "@/lib/technical-reports";

const field =
  "w-full rounded-xl border border-[#d8d2c4] bg-[#fbfaf6] px-3 py-2.5 text-sm";

const STATUSES = Object.keys(OBRA_STATUS_LABELS) as ObraStatus[];

const TRAMITE_TONE: Record<TramiteStatus, OsTone> = {
  pendiente: "warn",
  radicado: "info",
  aprobado: "ok",
  na: "neutral",
};

const TRAMITE_SHORT: Record<TramiteStatus, string> = {
  pendiente: "Pendiente",
  radicado: "Radicado",
  aprobado: "Aprobado",
  na: "N/A",
};

const COMPRAS_LABELS: Record<ObraJob["compras"], string> = {
  pendiente: "Compras pendientes",
  parcial: "Compras parciales",
  completo: "Compras completas",
};

const dateFmt = new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short" });

function shortDate(iso: string) {
  const t = Date.parse(`${iso}T12:00:00`);
  return Number.isFinite(t) ? dateFmt.format(t) : "";
}

function persistCloud(obras: ObraJob[]) {
  void fetch("/api/archivo", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ obras }),
  }).catch(() => undefined);
}

function isActive(j: ObraJob) {
  return j.status !== "energizado" && j.status !== "cerrado";
}

function isLate(j: ObraJob) {
  if (!isActive(j) || !j.endTarget) return false;
  const d = daysUntil(j.endTarget);
  return d !== null && d < 0;
}

function pendingTramites(j: ObraJob) {
  return [j.upme, j.retie, j.operadorRed].filter(
    (s) => s === "pendiente" || s === "radicado"
  ).length;
}

export default function ObraPage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<ObraJob[]>([]);
  const [draft, setDraft] = useState<ObraJob>(() => emptyObra());
  const [filter, setFilter] = useState<"todas" | ObraStatus>("todas");
  const [flash, setFlash] = useState("");
  const [quotes, setQuotes] = useState<ReturnType<typeof loadSavedQuotes>>([]);
  const [visits, setVisits] = useState<ReturnType<typeof loadSavedVisits>>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    setQuotes(loadSavedQuotes());
    setVisits(loadSavedVisits());
    const local = loadObras();
    setJobs(local);
    const openId = sessionStorage.getItem(OPEN_OBRA_KEY);
    if (openId) {
      const found = local.find((j) => j.id === openId);
      if (found) {
        setDraft({ ...emptyObra(), ...found });
        setDrawerOpen(true);
      }
      sessionStorage.removeItem(OPEN_OBRA_KEY);
    } else if (takeNewFlag()) {
      newJob();
    }
    void fetch("/api/archivo", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data?.obras) return;
        const merged = mergeObras(loadObras(), data.obras);
        replaceObras(merged);
        setJobs(merged);
        const stillOpen = openId
          ? merged.find((j) => j.id === openId)
          : undefined;
        if (stillOpen) {
          setDraft({ ...emptyObra(), ...stillOpen });
          setDrawerOpen(true);
        }
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(""), 3200);
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
    const map = Object.fromEntries(STATUSES.map((s) => [s, 0])) as Record<
      ObraStatus,
      number
    >;
    for (const j of jobs) map[j.status] += 1;
    return map;
  }, [jobs]);

  const active = jobs.filter(isActive);
  const activeKwp = active.reduce((s, j) => s + (Number(j.kwp) || 0), 0);
  const withTramites = active.filter((j) => pendingTramites(j) > 0).length;
  const late = active.filter(isLate).length;
  const avgProgress = active.length
    ? Math.round(active.reduce((s, j) => s + (Number(j.progress) || 0), 0) / active.length)
    : 0;

  const visible = jobs.filter((j) =>
    filter === "todas" ? true : j.status === filter
  );
  const isExisting = jobs.some((j) => j.id === draft.id);

  function openJob(j: ObraJob) {
    setDraft({ ...emptyObra(), ...j });
    setDrawerOpen(true);
  }

  function newJob() {
    setDraft(emptyObra());
    setDrawerOpen(true);
  }

  function saveDraft() {
    if (!draft.clientName.trim()) {
      setFlash("Indique al menos el cliente.");
      return;
    }
    const next = upsertObra(draft);
    setJobs(next);
    persistCloud(next);
    setFlash("Obra guardada.");
  }

  function removeJob(j: ObraJob) {
    if (!confirm("¿Quitar esta obra?")) return;
    const next = deleteObra(j.id);
    setJobs(next);
    persistCloud(next);
    void fetch(`/api/archivo?obra=${j.id}`, { method: "DELETE" });
    setDrawerOpen(false);
    setFlash("Obra eliminada.");
  }

  function openQuote(quoteId: string) {
    pinActiveQuote(quoteId);
    sessionStorage.setItem(OPEN_QUOTE_KEY, quoteId);
    window.location.assign(`/cotizador?quote=${encodeURIComponent(quoteId)}`);
  }

  function openUpme() {
    if (!draft.clientName.trim()) {
      setFlash("Indique al menos el cliente.");
      return;
    }
    const next = upsertObra(draft);
    setJobs(next);
    persistCloud(next);
    router.push(`/obra/upme?obra=${encodeURIComponent(draft.id)}`);
  }

  function passToOm() {
    const plant = emptyPlant();
    plant.clientName = draft.clientName;
    plant.siteName = draft.siteName;
    plant.city = draft.city;
    plant.kwp = draft.kwp;
    plant.ours = true;
    plant.notes = `Alta desde obra ${obraLabel(draft)}`;
    const plants = upsertPlant(plant);
    void fetch("/api/archivo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plants }),
    }).catch(() => undefined);
    const next = upsertObra({ ...draft, plantId: plant.id });
    setJobs(next);
    persistCloud(next);
    setDraft((p) => ({ ...p, plantId: plant.id }));
    setFlash("Planta creada en O&M. Complete el calendario allá.");
    router.push("/om");
  }

  function tramiteSelect(key: "upme" | "retie" | "operadorRed", label: string) {
    return (
      <label className="text-sm">
        <span className="mb-1 block font-medium">{label}</span>
        <select
          className={field}
          value={draft[key]}
          onChange={(e) =>
            setDraft((p) => ({
              ...p,
              [key]: e.target.value as TramiteStatus,
            }))
          }
        >
          {(Object.keys(TRAMITE_LABELS) as TramiteStatus[]).map((id) => (
            <option key={id} value={id}>
              {TRAMITE_LABELS[id]}
            </option>
          ))}
        </select>
      </label>
    );
  }

  return (
    <AppShell
      title="Obra"
      subtitle="De cotización ganada a energización: avance, cuadrilla y trámites"
      actions={
        <button type="button" className="os-btn os-btn-primary" onClick={newJob}>
          <Plus size={16} />
          Nueva obra
        </button>
      }
    >
      <div className="os-kpis">
        <OsKpi
          icon={HardHat}
          tone="info"
          label="Obras activas"
          value={active.length}
          hint={activeKwp > 0 ? `${activeKwp.toLocaleString("es-CO")} kWp en ejecución` : "Sin kWp registrados"}
        />
        <OsKpi
          icon={Zap}
          tone="ok"
          label="Avance promedio"
          value={`${avgProgress}%`}
          hint={`${counts.energizado} energizadas`}
        />
        <OsKpi
          icon={FileBadge}
          tone={withTramites > 0 ? "warn" : "neutral"}
          label="Con trámites abiertos"
          value={withTramites}
          hint="UPME, RETIE u operador de red"
        />
        <OsKpi
          icon={CalendarRange}
          tone={late > 0 ? "danger" : "neutral"}
          label="Fuera de fecha"
          value={late}
          hint={late > 0 ? "Pasaron la meta de entrega" : "Todo dentro de la meta"}
        />
      </div>

      <div className="os-board-bar">
        <div className="os-chips">
          <button
            type="button"
            className="os-chip"
            aria-pressed={filter === "todas"}
            onClick={() => setFilter("todas")}
          >
            Todas <span>{jobs.length}</span>
          </button>
          {STATUSES.map((id) => (
            <button
              key={id}
              type="button"
              className="os-chip"
              aria-pressed={filter === id}
              onClick={() => setFilter((f) => (f === id ? "todas" : id))}
            >
              {OBRA_STATUS_LABELS[id]} <span>{counts[id]}</span>
            </button>
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        <section className="os-work">
          <div className="os-empty">
            <span className="os-empty-icon">
              <HardHat size={20} />
            </span>
            <p className="os-empty-title">
              {jobs.length === 0 ? "Aún no hay obras" : "No hay obras en este filtro"}
            </p>
            <p className="os-empty-hint">
              Las oportunidades ganadas en Pipeline pasan aquí. También puede crear
              una obra desde una cotización guardada.
            </p>
            <button type="button" className="os-btn os-btn-ghost os-btn-sm" onClick={newJob}>
              <Plus size={14} />
              Nueva obra
            </button>
          </div>
        </section>
      ) : (
        <div className="os-tiles">
          {visible.map((j) => {
            const progress = Math.min(100, Math.max(0, Number(j.progress) || 0));
            const late = isLate(j);
            return (
              <button
                key={j.id}
                type="button"
                className="os-tile"
                data-obra={j.status}
                onClick={() => openJob(j)}
              >
                <div className="os-tile-head">
                  <div className="min-w-0">
                    <p className="os-tile-title">{j.clientName || "Sin cliente"}</p>
                    {j.siteName || j.city ? (
                      <p className="os-card-sub">
                        <MapPin size={12} />
                        {[j.siteName, j.city].filter(Boolean).join(" · ")}
                      </p>
                    ) : null}
                  </div>
                  <span className="os-obra-pill" data-obra={j.status}>
                    {OBRA_STATUS_LABELS[j.status]}
                  </span>
                </div>

                <div className="os-progress">
                  <div className="os-progress-top">
                    <span>Avance</span>
                    <strong>{progress}%</strong>
                  </div>
                  <div className="os-progress-track">
                    <span className="os-progress-bar" style={{ width: `${progress}%` }} />
                  </div>
                </div>

                <div className="os-tramites">
                  {(
                    [
                      ["UPME", j.upme],
                      ["RETIE", j.retie],
                      ["OR", j.operadorRed],
                    ] as const
                  ).map(([name, s]) => (
                    <span key={name} className="os-tramite" data-tone={TRAMITE_TONE[s]}>
                      <span className="os-tramite-name">{name}</span>
                      <span className="os-tramite-state">{TRAMITE_SHORT[s]}</span>
                    </span>
                  ))}
                </div>

                <div className="os-tile-foot">
                  {j.kwp ? (
                    <span className="os-tag">
                      <Zap size={11} />
                      {j.kwp} kWp
                    </span>
                  ) : null}
                  <span className="os-tag" data-compras={j.compras}>
                    <ShoppingCart size={11} />
                    {COMPRAS_LABELS[j.compras]}
                  </span>
                  {j.crew ? (
                    <span className="os-tag">
                      <Users size={11} />
                      {j.crew}
                    </span>
                  ) : null}
                  {j.endTarget ? (
                    <span className={`os-tag ${late ? "is-late" : ""}`}>
                      <CalendarRange size={11} />
                      {late ? "Vencida " : "Meta "}
                      {shortDate(j.endTarget)}
                    </span>
                  ) : null}
                </div>
              </button>
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
        aria-label={isExisting ? "Editar obra" : "Nueva obra"}
      >
        <header className="os-drawer-head">
          <div className="min-w-0">
            <p className="os-drawer-kicker">{isExisting ? "Editar obra" : "Nueva obra"}</p>
            <h2 className="os-drawer-title">{draft.clientName.trim() || "Sin cliente"}</h2>
            <span className="os-obra-pill" data-obra={draft.status}>
              {OBRA_STATUS_LABELS[draft.status]}
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

        <div className="os-drawer-actions">
          {draft.quoteId ? (
            <button type="button" className="os-btn os-btn-ghost os-btn-sm" onClick={() => openQuote(draft.quoteId!)}>
              <FileSpreadsheet size={14} />
              Cotización
            </button>
          ) : null}
          {draft.visitId ? (
            <button
              type="button"
              className="os-btn os-btn-ghost os-btn-sm"
              onClick={() => {
                sessionStorage.setItem(OPEN_VISIT_KEY, draft.visitId!);
                router.push("/visita-tecnica");
              }}
            >
              <ClipboardCheck size={14} />
              Visita
            </button>
          ) : null}
          <button type="button" className="os-btn os-btn-ghost os-btn-sm" onClick={openUpme}>
            <FileBadge size={14} />
            Expediente UPME
          </button>
          <button type="button" className="os-btn os-btn-ghost os-btn-sm" onClick={passToOm}>
            <Wrench size={14} />
            Pasar a O&M
          </button>
        </div>

        <div className="os-drawer-body">
          {quotes.length ? (
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Desde cotización</span>
              <select
                className={field}
                value={draft.quoteId || ""}
                onChange={(e) => {
                  const q = quotes.find((x) => x.id === e.target.value);
                  if (!q) {
                    setDraft((p) => ({ ...p, quoteId: "", quoteName: "" }));
                    return;
                  }
                  setDraft((p) => ({
                    ...p,
                    quoteId: q.id,
                    quoteName: q.name,
                    clientName: q.clientName || p.clientName,
                    city: q.clientCity || p.city,
                    kwp: String(q.systemKwp || p.kwp),
                  }));
                }}
              >
                <option value="">Seleccionar…</option>
                {quotes.map((q) => (
                  <option key={q.id} value={q.id}>
                    {q.name} · {q.clientName} · {q.systemKwp} kWp
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {visits.length ? (
            <label className="mt-3 block text-sm">
              <span className="mb-1 block font-medium">Visita ligada</span>
              <select
                className={field}
                value={draft.visitId || ""}
                onChange={(e) => {
                  const v = visits.find((x) => x.id === e.target.value);
                  if (!v) {
                    setDraft((p) => ({ ...p, visitId: "" }));
                    return;
                  }
                  setDraft((p) => ({
                    ...p,
                    visitId: v.id,
                    clientName: v.visit.clientName || p.clientName,
                    city: p.city,
                    siteName: v.visit.location || p.siteName,
                  }));
                }}
              >
                <option value="">Ninguna</option>
                {visits.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.visit.clientName || "Visita"} · {v.visit.visitDate}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <p className="os-drawer-section">Proyecto</p>
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
            <label className="text-sm">
              <span className="mb-1 block font-medium">kWp</span>
              <input
                className={field}
                value={draft.kwp}
                onChange={(e) => setDraft((p) => ({ ...p, kwp: e.target.value }))}
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium">Estado</span>
              <select
                className={field}
                value={draft.status}
                onChange={(e) =>
                  setDraft((p) => ({
                    ...p,
                    status: e.target.value as ObraStatus,
                  }))
                }
              >
                {STATUSES.map((id) => (
                  <option key={id} value={id}>
                    {OBRA_STATUS_LABELS[id]}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <p className="os-drawer-section">Ejecución</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm sm:col-span-2">
              <span className="mb-1 flex items-center justify-between font-medium">
                Avance
                <strong className="text-[#1f6b45]">{draft.progress}%</strong>
              </span>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                className="w-full accent-[#1f6b45]"
                value={draft.progress}
                onChange={(e) =>
                  setDraft((p) => ({
                    ...p,
                    progress: Math.min(100, Math.max(0, Number(e.target.value) || 0)),
                  }))
                }
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium">Inicio</span>
              <input
                type="date"
                className={field}
                value={draft.startDate}
                onChange={(e) =>
                  setDraft((p) => ({ ...p, startDate: e.target.value }))
                }
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium">Meta entrega</span>
              <input
                type="date"
                className={field}
                value={draft.endTarget}
                onChange={(e) =>
                  setDraft((p) => ({ ...p, endTarget: e.target.value }))
                }
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium">Energización</span>
              <input
                type="date"
                className={field}
                value={draft.energizedAt}
                onChange={(e) =>
                  setDraft((p) => ({ ...p, energizedAt: e.target.value }))
                }
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium">Cuadrilla</span>
              <input
                className={field}
                value={draft.crew}
                onChange={(e) => setDraft((p) => ({ ...p, crew: e.target.value }))}
                placeholder="3 técnicos · residente…"
              />
            </label>
            <label className="text-sm sm:col-span-2">
              <span className="mb-1 block font-medium">Compras vs cotizado</span>
              <select
                className={field}
                value={draft.compras}
                onChange={(e) =>
                  setDraft((p) => ({
                    ...p,
                    compras: e.target.value as ObraJob["compras"],
                  }))
                }
              >
                <option value="pendiente">Pendiente</option>
                <option value="parcial">Parcial</option>
                <option value="completo">Completo</option>
              </select>
            </label>
          </div>

          <p className="os-drawer-section">Trámites</p>
          <div className="grid gap-3 sm:grid-cols-3">
            {tramiteSelect("upme", "UPME / Ley 1715")}
            {tramiteSelect("retie", "RETIE")}
            {tramiteSelect("operadorRed", "Operador de red")}
          </div>

          <div className="mt-5 rounded-2xl border border-[#eee8dc] bg-[#fbfaf6] p-4">
            <h3 className="text-sm font-semibold">Datos para el certificado UPME</h3>
            <p className="mt-1 text-xs leading-5 text-[#6d7c74]">
              El solicitante en Bizagi es el dueño del proyecto. Genera arma el
              expediente; la radicación la hace quien tiene el usuario SUU.
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="text-sm">
                <span className="mb-1 block font-medium">Tipo de persona</span>
                <select
                  className={field}
                  value={draft.upmePersonType || ""}
                  onChange={(e) =>
                    setDraft((p) => ({
                      ...p,
                      upmePersonType: e.target.value as ObraJob["upmePersonType"],
                    }))
                  }
                >
                  <option value="">Seleccionar…</option>
                  <option value="natural">Natural</option>
                  <option value="juridica">Jurídica</option>
                </select>
              </label>
              <label className="text-sm">
                <span className="mb-1 block font-medium">NIT o cédula</span>
                <input
                  className={field}
                  value={draft.upmeNit || ""}
                  onChange={(e) =>
                    setDraft((p) => ({ ...p, upmeNit: e.target.value }))
                  }
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block font-medium">
                  Representante / contacto
                </span>
                <input
                  className={field}
                  value={draft.upmeRepName || ""}
                  onChange={(e) =>
                    setDraft((p) => ({ ...p, upmeRepName: e.target.value }))
                  }
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block font-medium">Correo</span>
                <input
                  className={field}
                  value={draft.upmeEmail || ""}
                  onChange={(e) =>
                    setDraft((p) => ({ ...p, upmeEmail: e.target.value }))
                  }
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block font-medium">Teléfono</span>
                <input
                  className={field}
                  value={draft.upmePhone || ""}
                  onChange={(e) =>
                    setDraft((p) => ({ ...p, upmePhone: e.target.value }))
                  }
                />
              </label>
              <label className="text-sm sm:col-span-2">
                <span className="mb-1 block font-medium">Dirección del predio</span>
                <input
                  className={field}
                  value={draft.upmeAddress || ""}
                  onChange={(e) =>
                    setDraft((p) => ({ ...p, upmeAddress: e.target.value }))
                  }
                />
              </label>
              <label className="text-sm sm:col-span-2">
                <span className="mb-1 block font-medium">
                  Radicado registro de generación UPME
                </span>
                <input
                  className={field}
                  value={draft.upmeRegistroGen || ""}
                  onChange={(e) =>
                    setDraft((p) => ({ ...p, upmeRegistroGen: e.target.value }))
                  }
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block font-medium">Referencia pago tarifa</span>
                <input
                  className={field}
                  value={draft.upmeTarifaRef || ""}
                  onChange={(e) =>
                    setDraft((p) => ({ ...p, upmeTarifaRef: e.target.value }))
                  }
                />
              </label>
              <label className="flex items-center gap-2 text-sm sm:col-span-2">
                <input
                  type="checkbox"
                  checked={Boolean(draft.upmeTarifaPaid)}
                  onChange={(e) =>
                    setDraft((p) => ({ ...p, upmeTarifaPaid: e.target.checked }))
                  }
                />
                Tarifa UPME pagada
              </label>
              <label className="flex items-center gap-2 text-sm sm:col-span-2">
                <input
                  type="checkbox"
                  checked={Boolean(draft.upmeCertExistencia)}
                  onChange={(e) =>
                    setDraft((p) => ({
                      ...p,
                      upmeCertExistencia: e.target.checked,
                    }))
                  }
                />
                Ya tengo certificado de existencia o cédula para adjuntar
              </label>
            </div>
          </div>
          <label className="mt-3 block text-sm">
            <span className="mb-1 block font-medium">Notas de obra</span>
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
              aria-label="Quitar obra"
              title="Quitar obra"
              onClick={() => removeJob(draft)}
            >
              <Trash2 size={16} />
            </button>
          ) : null}
          <button type="button" className="os-btn os-btn-ghost" onClick={() => setDrawerOpen(false)}>
            Cerrar
          </button>
          <button type="button" className="os-btn os-btn-primary" onClick={saveDraft}>
            Guardar obra
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
