"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarClock,
  ClipboardCheck,
  FileSpreadsheet,
  HardHat,
  KanbanSquare,
  List,
  MapPin,
  PhoneCall,
  Plus,
  Trash2,
  TrendingUp,
  Trophy,
  X,
  Zap,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { copCompact } from "@/lib/format-cop";
import { OsKpi } from "@/components/OsKpi";
import {
  LEAD_SOURCE_LABELS,
  LEAD_STAGE_LABELS,
  LOST_REASON_LABELS,
  OPEN_LEAD_KEY,
  deleteLead,
  emptyLead,
  leadLabel,
  loadLeads,
  mergeLeads,
  persistLeadsCloud,
  pinOpenLead,
  replaceLeads,
  upsertLead,
  type CommercialLead,
  type LeadSource,
  type LeadStage,
} from "@/lib/pipeline";
import { emptyObra, upsertObra } from "@/lib/obra";
import { daysUntil } from "@/lib/om";
import { loadSavedQuotes, pinActiveQuote } from "@/lib/saved-quotes";
import {
  OPEN_QUOTE_KEY,
  OPEN_VISIT_KEY,
  loadSavedVisits,
} from "@/lib/saved-visits";

const field =
  "w-full rounded-xl border border-[#d8d2c4] bg-[#fbfaf6] px-3 py-2.5 text-sm";

const cop = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

const STAGES = Object.keys(LEAD_STAGE_LABELS) as LeadStage[];

const BOARD_STAGES: LeadStage[] = [
  "lead",
  "calificado",
  "visita",
  "cotizado",
  "negociacion",
  "ganado",
  "perdido",
];

function todayISO() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "");
}

function dueLabel(iso: string) {
  const d = daysUntil(iso);
  if (d === null) return null;
  if (d === 0) return { text: "Hoy", tone: "warn" as const };
  if (d === 1) return { text: "Mañana", tone: "neutral" as const };
  if (d < 0) return { text: `Hace ${Math.abs(d)} d`, tone: "danger" as const };
  return { text: `En ${d} d`, tone: "neutral" as const };
}

function isOpen(l: CommercialLead) {
  return l.stage !== "ganado" && l.stage !== "perdido";
}

export default function PipelinePage() {
  const router = useRouter();
  const [leads, setLeads] = useState<CommercialLead[]>([]);
  const [draft, setDraft] = useState<CommercialLead>(() => emptyLead());
  const [view, setView] = useState<"tablero" | "lista">("tablero");
  const [filter, setFilter] = useState<"todas" | LeadStage>("todas");
  const [flash, setFlash] = useState("");
  const [quotes, setQuotes] = useState<ReturnType<typeof loadSavedQuotes>>([]);
  const [visits, setVisits] = useState<ReturnType<typeof loadSavedVisits>>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overStage, setOverStage] = useState<LeadStage | null>(null);

  useEffect(() => {
    setQuotes(loadSavedQuotes());
    setVisits(loadSavedVisits());
    const local = loadLeads();
    setLeads(local);
    const openId = sessionStorage.getItem(OPEN_LEAD_KEY);
    if (openId) {
      const found = local.find((l) => l.id === openId);
      if (found) {
        setDraft({ ...emptyLead(), ...found });
        setDrawerOpen(true);
      }
      sessionStorage.removeItem(OPEN_LEAD_KEY);
    }
    void fetch("/api/archivo", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data?.leads) return;
        const merged = mergeLeads(loadLeads(), data.leads);
        replaceLeads(merged);
        setLeads(merged);
        const stillOpen = openId
          ? merged.find((l) => l.id === openId)
          : undefined;
        if (stillOpen) {
          setDraft({ ...emptyLead(), ...stillOpen });
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
    const map = Object.fromEntries(STAGES.map((s) => [s, 0])) as Record<
      LeadStage,
      number
    >;
    for (const l of leads) map[l.stage] += 1;
    return map;
  }, [leads]);

  const openLeads = leads.filter(isOpen);
  const openValue = openLeads.reduce(
    (sum, l) => sum + (Number(l.estimatedValue) || 0),
    0
  );
  const today = todayISO();
  const dueToday = openLeads.filter(
    (l) => l.nextActionDate && l.nextActionDate <= today
  ).length;
  const closed = counts.ganado + counts.perdido;
  const winRate = closed > 0 ? Math.round((counts.ganado / closed) * 100) : null;

  const visible = leads.filter((l) =>
    filter === "todas" ? true : l.stage === filter
  );
  const isExisting = leads.some((l) => l.id === draft.id);

  function openLead(l: CommercialLead) {
    setDraft({ ...emptyLead(), ...l });
    setDrawerOpen(true);
  }

  function newLead(stage: LeadStage = "lead") {
    setDraft({ ...emptyLead(), stage });
    setDrawerOpen(true);
  }

  function saveDraft() {
    if (!draft.clientName.trim()) {
      setFlash("Indique al menos el cliente.");
      return;
    }
    const next = upsertLead(draft);
    setLeads(next);
    persistLeadsCloud(next);
    setFlash("Oportunidad guardada.");
  }

  function moveLead(id: string, stage: LeadStage) {
    const lead = leads.find((l) => l.id === id);
    if (!lead || lead.stage === stage) return;
    const next = upsertLead({ ...lead, stage });
    setLeads(next);
    persistLeadsCloud(next);
    if (stage === "perdido") {
      setDraft({ ...emptyLead(), ...lead, stage });
      setDrawerOpen(true);
      setFlash("Marcada como perdida. Indique el motivo.");
    } else {
      setFlash(`${lead.clientName || "Oportunidad"} → ${LEAD_STAGE_LABELS[stage]}`);
    }
  }

  function removeLead(l: CommercialLead) {
    if (!confirm("¿Quitar esta oportunidad?")) return;
    const next = deleteLead(l.id);
    setLeads(next);
    persistLeadsCloud(next);
    void fetch(`/api/archivo?lead=${l.id}`, { method: "DELETE" });
    if (draft.id === l.id) setDrawerOpen(false);
    setFlash("Oportunidad eliminada.");
  }

  function openQuoteFromLead(lead: CommercialLead) {
    pinOpenLead(lead.id);
    const params = new URLSearchParams();
    params.set("nueva", "1");
    if (lead.clientName) params.set("cliente", lead.clientName);
    if (lead.city) params.set("ciudad", lead.city);
    const kwp = Number(lead.kwp);
    if (Number.isFinite(kwp) && kwp >= 3) params.set("kwp", String(kwp));
    router.push(`/cotizador?${params.toString()}`);
  }

  function openSavedQuote(quoteId: string) {
    pinActiveQuote(quoteId);
    sessionStorage.setItem(OPEN_QUOTE_KEY, quoteId);
    window.location.assign(`/cotizador?quote=${encodeURIComponent(quoteId)}`);
  }

  function openVisitFromLead(lead: CommercialLead) {
    pinOpenLead(lead.id);
    if (lead.visitId) {
      sessionStorage.setItem(OPEN_VISIT_KEY, lead.visitId);
    }
    router.push("/visita-tecnica");
  }

  function passToObra(lead: CommercialLead) {
    const job = emptyObra();
    job.clientName = lead.clientName;
    job.siteName = lead.siteName;
    job.city = lead.city;
    job.kwp = lead.kwp;
    job.quoteId = lead.quoteId;
    job.quoteName = lead.quoteName;
    job.visitId = lead.visitId;
    job.notes = `Alta desde pipeline · ${leadLabel(lead)}`;
    const obras = upsertObra(job);
    void fetch("/api/archivo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ obras }),
    }).catch(() => undefined);
    const next = upsertLead({
      ...lead,
      stage: "ganado",
      obraId: job.id,
    });
    setLeads(next);
    persistLeadsCloud(next);
    setDraft((p) => ({ ...p, stage: "ganado", obraId: job.id }));
    setFlash("Obra creada. Complete cuadrilla y trámites allá.");
    router.push("/obra");
  }

  return (
    <AppShell
      title="Pipeline comercial"
      subtitle="Leads, visitas, cotización y cierre en un solo tablero"
      actions={
        <button type="button" className="os-btn os-btn-primary" onClick={() => newLead()}>
          <Plus size={16} />
          Nueva oportunidad
        </button>
      }
    >
      <div className="os-kpis">
        <OsKpi
          icon={TrendingUp}
          tone="ok"
          label="Valor abierto"
          value={copCompact(openValue)}
          hint={cop.format(openValue)}
        />
        <OsKpi
          icon={KanbanSquare}
          tone="info"
          label="Oportunidades abiertas"
          value={openLeads.length}
          hint={`${leads.length} en total`}
        />
        <OsKpi
          icon={PhoneCall}
          tone={dueToday > 0 ? "warn" : "neutral"}
          label="Seguimiento vencido"
          value={dueToday}
          hint={dueToday > 0 ? "Llamar o mover hoy" : "Todo al día"}
        />
        <OsKpi
          icon={Trophy}
          tone="ok"
          label="Ganadas"
          value={counts.ganado}
          hint={winRate === null ? "Sin cierres aún" : `Tasa de cierre ${winRate}%`}
        />
      </div>

      <div className="os-board-bar">
        <div className="os-seg" role="tablist" aria-label="Vista">
          <button
            type="button"
            role="tab"
            aria-selected={view === "tablero"}
            className="os-seg-btn"
            onClick={() => setView("tablero")}
          >
            <KanbanSquare size={15} />
            Tablero
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view === "lista"}
            className="os-seg-btn"
            onClick={() => setView("lista")}
          >
            <List size={15} />
            Lista
          </button>
        </div>
        {view === "tablero" ? (
          <p className="os-board-hint">
            Arrastre una tarjeta para cambiarla de etapa. Tóquela para ver o editar.
          </p>
        ) : (
          <div className="os-chips">
            <button
              type="button"
              className="os-chip"
              aria-pressed={filter === "todas"}
              onClick={() => setFilter("todas")}
            >
              Todas <span>{leads.length}</span>
            </button>
            {STAGES.map((id) => (
              <button
                key={id}
                type="button"
                className="os-chip"
                data-stage={id}
                aria-pressed={filter === id}
                onClick={() => setFilter((f) => (f === id ? "todas" : id))}
              >
                {LEAD_STAGE_LABELS[id]} <span>{counts[id]}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {view === "tablero" ? (
        <div className="os-board">
          {BOARD_STAGES.map((stage) => {
            const col = leads.filter((l) => l.stage === stage);
            const value = col.reduce((s, l) => s + (Number(l.estimatedValue) || 0), 0);
            return (
              <section
                key={stage}
                className="os-col"
                data-stage={stage}
                data-over={overStage === stage && dragId ? "true" : undefined}
                onDragOver={(e) => {
                  if (!dragId) return;
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  if (overStage !== stage) setOverStage(stage);
                }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                    setOverStage((s) => (s === stage ? null : s));
                  }
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  const id = e.dataTransfer.getData("text/plain") || dragId;
                  setOverStage(null);
                  setDragId(null);
                  if (id) moveLead(id, stage);
                }}
              >
                <header className="os-col-head">
                  <span className="os-col-dot" />
                  <h2 className="os-col-title">{LEAD_STAGE_LABELS[stage]}</h2>
                  <span className="os-col-count">{col.length}</span>
                  {value > 0 ? (
                    <span className="os-col-value">{copCompact(value)}</span>
                  ) : null}
                </header>
                <div className="os-col-body">
                  {col.map((l) => {
                    const due = isOpen(l) && l.nextActionDate ? dueLabel(l.nextActionDate) : null;
                    return (
                      <article
                        key={l.id}
                        className="os-card"
                        draggable
                        data-dragging={dragId === l.id ? "true" : undefined}
                        onDragStart={(e) => {
                          e.dataTransfer.setData("text/plain", l.id);
                          e.dataTransfer.effectAllowed = "move";
                          setDragId(l.id);
                        }}
                        onDragEnd={() => {
                          setDragId(null);
                          setOverStage(null);
                        }}
                        onClick={() => openLead(l)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            openLead(l);
                          }
                        }}
                        tabIndex={0}
                        role="button"
                        aria-label={`Abrir ${leadLabel(l)}`}
                      >
                        <p className="os-card-title">{l.clientName || "Sin cliente"}</p>
                        {l.siteName || l.city ? (
                          <p className="os-card-sub">
                            <MapPin size={12} />
                            {[l.siteName, l.city].filter(Boolean).join(" · ")}
                          </p>
                        ) : null}
                        <div className="os-card-tags">
                          {l.kwp ? (
                            <span className="os-tag">
                              <Zap size={11} />
                              {l.kwp} kWp
                            </span>
                          ) : null}
                          {l.estimatedValue ? (
                            <span className="os-tag is-money">
                              {copCompact(l.estimatedValue)}
                            </span>
                          ) : null}
                          {l.quoteId ? (
                            <span className="os-tag" title={l.quoteName || "Cotización ligada"}>
                              <FileSpreadsheet size={11} />
                              Cotización
                            </span>
                          ) : null}
                          {l.visitId ? (
                            <span className="os-tag" title="Visita ligada">
                              <ClipboardCheck size={11} />
                              Visita
                            </span>
                          ) : null}
                        </div>
                        {l.nextAction || due || l.owner ? (
                          <footer className="os-card-foot">
                            <span className="os-card-next">
                              {l.nextAction || (stage === "perdido" && l.lostReason
                                ? LOST_REASON_LABELS[l.lostReason] ?? l.lostReason
                                : "")}
                            </span>
                            {due ? (
                              <span className="os-pill" data-tone={due.tone}>
                                <CalendarClock size={11} />
                                {due.text}
                              </span>
                            ) : null}
                            {l.owner ? (
                              <span className="os-avatar" title={l.owner}>
                                {initials(l.owner).toUpperCase()}
                              </span>
                            ) : null}
                          </footer>
                        ) : null}
                      </article>
                    );
                  })}
                  {stage === "lead" ? (
                    <button type="button" className="os-col-add" onClick={() => newLead("lead")}>
                      <Plus size={14} />
                      Agregar oportunidad
                    </button>
                  ) : col.length === 0 ? (
                    <p className="os-col-empty">Suelte aquí</p>
                  ) : null}
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <section className="os-work">
          {visible.length === 0 ? (
            <div className="os-empty">
              <span className="os-empty-icon">
                <KanbanSquare size={20} />
              </span>
              <p className="os-empty-title">No hay oportunidades en este filtro</p>
              <p className="os-empty-hint">
                Cree una nueva o cambie el filtro de etapa.
              </p>
              <button type="button" className="os-btn os-btn-ghost os-btn-sm" onClick={() => newLead()}>
                <Plus size={14} />
                Nueva oportunidad
              </button>
            </div>
          ) : (
            <ul className="os-work-list">
              {visible.map((l) => {
                const due = isOpen(l) && l.nextActionDate ? dueLabel(l.nextActionDate) : null;
                return (
                  <li key={l.id}>
                    <button type="button" className="os-work-row os-lead-row" onClick={() => openLead(l)}>
                      <span className="os-avatar is-lg">
                        {initials(l.clientName || "?").toUpperCase()}
                      </span>
                      <span className="os-work-row-text">
                        <span className="os-work-row-title">{leadLabel(l)}</span>
                        <span className="os-work-row-meta">
                          {[
                            l.kwp ? `${l.kwp} kWp` : "",
                            l.estimatedValue ? cop.format(l.estimatedValue) : "",
                            LEAD_SOURCE_LABELS[l.source],
                            l.owner,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      </span>
                      {due ? (
                        <span className="os-pill" data-tone={due.tone}>
                          {due.text}
                        </span>
                      ) : null}
                      <span className="os-stage-pill" data-stage={l.stage}>
                        {LEAD_STAGE_LABELS[l.stage]}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      {drawerOpen ? (
        <div className="os-drawer-backdrop" onClick={() => setDrawerOpen(false)} />
      ) : null}
      <aside
        className="os-drawer"
        data-open={drawerOpen ? "true" : undefined}
        aria-hidden={!drawerOpen}
        aria-label={isExisting ? "Editar oportunidad" : "Nueva oportunidad"}
      >
        <header className="os-drawer-head">
          <div className="min-w-0">
            <p className="os-drawer-kicker">
              {isExisting ? "Editar oportunidad" : "Nueva oportunidad"}
            </p>
            <h2 className="os-drawer-title">
              {draft.clientName.trim() || "Sin cliente"}
            </h2>
            <span className="os-stage-pill" data-stage={draft.stage}>
              {LEAD_STAGE_LABELS[draft.stage]}
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
            <button type="button" className="os-btn os-btn-ghost os-btn-sm" onClick={() => openQuoteFromLead(draft)}>
              <FileSpreadsheet size={14} />
              Cotizar
            </button>
            {draft.quoteId ? (
              <button type="button" className="os-btn os-btn-ghost os-btn-sm" onClick={() => openSavedQuote(draft.quoteId!)}>
                Ver cotización
              </button>
            ) : null}
            <button type="button" className="os-btn os-btn-ghost os-btn-sm" onClick={() => openVisitFromLead(draft)}>
              <ClipboardCheck size={14} />
              Visita
            </button>
            {draft.stage !== "ganado" ? (
              <button type="button" className="os-btn os-btn-ghost os-btn-sm" onClick={() => passToObra(draft)}>
                <HardHat size={14} />
                Pasar a obra
              </button>
            ) : (
              <a href="/obra" className="os-btn os-btn-ghost os-btn-sm">
                <HardHat size={14} />
                Ver obra
              </a>
            )}
          </div>
        ) : null}

        <div className="os-drawer-body">
          {quotes.length ? (
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Cotización ligada</span>
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
                    stage:
                      p.stage === "lead" || p.stage === "calificado"
                        ? "cotizado"
                        : p.stage,
                  }));
                }}
              >
                <option value="">Ninguna aún</option>
                {quotes.map((q) => (
                  <option key={q.id} value={q.id}>
                    {q.name} · {q.clientName}
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
                    siteName: v.visit.location || p.siteName,
                    stage:
                      p.stage === "lead" || p.stage === "calificado"
                        ? "visita"
                        : p.stage,
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

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
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
              <span className="mb-1 block font-medium">Contacto</span>
              <input
                className={field}
                value={draft.contact}
                onChange={(e) =>
                  setDraft((p) => ({ ...p, contact: e.target.value }))
                }
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium">Celular</span>
              <input
                className={field}
                value={draft.phone}
                onChange={(e) =>
                  setDraft((p) => ({ ...p, phone: e.target.value }))
                }
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium">Correo</span>
              <input
                className={field}
                value={draft.email}
                onChange={(e) =>
                  setDraft((p) => ({ ...p, email: e.target.value }))
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
              <span className="mb-1 block font-medium">kWp estimado</span>
              <input
                className={field}
                value={draft.kwp}
                onChange={(e) => setDraft((p) => ({ ...p, kwp: e.target.value }))}
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium">Valor estimado COP</span>
              <input
                type="number"
                min={0}
                className={field}
                value={draft.estimatedValue || ""}
                onChange={(e) =>
                  setDraft((p) => ({
                    ...p,
                    estimatedValue: Math.max(0, Number(e.target.value) || 0),
                  }))
                }
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium">Origen</span>
              <select
                className={field}
                value={draft.source}
                onChange={(e) =>
                  setDraft((p) => ({
                    ...p,
                    source: e.target.value as LeadSource,
                  }))
                }
              >
                {(Object.keys(LEAD_SOURCE_LABELS) as LeadSource[]).map((id) => (
                  <option key={id} value={id}>
                    {LEAD_SOURCE_LABELS[id]}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium">Asesor</span>
              <input
                className={field}
                value={draft.owner}
                onChange={(e) =>
                  setDraft((p) => ({ ...p, owner: e.target.value }))
                }
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium">Etapa</span>
              <select
                className={field}
                value={draft.stage}
                onChange={(e) =>
                  setDraft((p) => ({
                    ...p,
                    stage: e.target.value as LeadStage,
                  }))
                }
              >
                {STAGES.map((id) => (
                  <option key={id} value={id}>
                    {LEAD_STAGE_LABELS[id]}
                  </option>
                ))}
              </select>
            </label>
            {draft.stage === "perdido" ? (
              <label className="text-sm">
                <span className="mb-1 block font-medium">Motivo de pérdida</span>
                <select
                  className={field}
                  value={draft.lostReason}
                  onChange={(e) =>
                    setDraft((p) => ({ ...p, lostReason: e.target.value }))
                  }
                >
                  <option value="">Seleccionar…</option>
                  {Object.entries(LOST_REASON_LABELS).map(([id, label]) => (
                    <option key={id} value={id}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <label className="text-sm sm:col-span-2">
              <span className="mb-1 block font-medium">Siguiente acción</span>
              <input
                className={field}
                value={draft.nextAction}
                onChange={(e) =>
                  setDraft((p) => ({ ...p, nextAction: e.target.value }))
                }
                placeholder="Llamar, enviar propuesta, agendar visita…"
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium">Fecha de seguimiento</span>
              <input
                type="date"
                className={field}
                value={draft.nextActionDate}
                onChange={(e) =>
                  setDraft((p) => ({ ...p, nextActionDate: e.target.value }))
                }
              />
            </label>
          </div>
          <label className="mt-3 block text-sm">
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
              aria-label="Quitar oportunidad"
              title="Quitar oportunidad"
              onClick={() => removeLead(draft)}
            >
              <Trash2 size={16} />
            </button>
          ) : null}
          <button
            type="button"
            className="os-btn os-btn-ghost"
            onClick={() => setDrawerOpen(false)}
          >
            Cerrar
          </button>
          <button type="button" className="os-btn os-btn-primary" onClick={saveDraft}>
            Guardar
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
