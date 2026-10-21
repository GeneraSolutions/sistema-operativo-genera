"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { WorkFold } from "@/components/WorkFold";
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
import { loadSavedQuotes, pinActiveQuote } from "@/lib/saved-quotes";
import {
  OPEN_QUOTE_KEY,
  OPEN_VISIT_KEY,
  loadSavedVisits,
} from "@/lib/saved-visits";

const field =
  "w-full rounded-xl border border-[#d8d2c4] bg-[#fbfaf6] px-3 py-2.5 text-sm";

const TONE: Record<LeadStage, string> = {
  lead: "bg-[#f7f4ee] text-[#6d7c74]",
  calificado: "bg-[#eef4fa] text-[#2a5f8f]",
  visita: "bg-[#e8f0fb] text-[#1f4f8a]",
  cotizado: "bg-[#fff4e5] text-[#9a5b00]",
  negociacion: "bg-[#f3eef8] text-[#5b3d7a]",
  ganado: "bg-[#e8f6ee] text-[#1f6b45]",
  perdido: "bg-[#f8ecec] text-[#9b2c2c]",
};

const cop = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

const STAGES = Object.keys(LEAD_STAGE_LABELS) as LeadStage[];

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function PipelinePage() {
  const router = useRouter();
  const [leads, setLeads] = useState<CommercialLead[]>([]);
  const [draft, setDraft] = useState<CommercialLead>(() => emptyLead());
  const [filter, setFilter] = useState<"todas" | LeadStage>("todas");
  const [flash, setFlash] = useState("");
  const [quotes, setQuotes] = useState<ReturnType<typeof loadSavedQuotes>>([]);
  const [visits, setVisits] = useState<ReturnType<typeof loadSavedVisits>>([]);
  const [formOpen, setFormOpen] = useState(false);

  useEffect(() => {
    if (leads.some((l) => l.id === draft.id)) setFormOpen(true);
  }, [draft.id, leads]);

  useEffect(() => {
    setQuotes(loadSavedQuotes());
    setVisits(loadSavedVisits());
    const local = loadLeads();
    setLeads(local);
    const openId = sessionStorage.getItem(OPEN_LEAD_KEY);
    if (openId) {
      const found = local.find((l) => l.id === openId);
      if (found) setDraft({ ...emptyLead(), ...found });
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
        if (stillOpen) setDraft({ ...emptyLead(), ...stillOpen });
      })
      .catch(() => undefined);
  }, []);

  const counts = useMemo(() => {
    const map = Object.fromEntries(STAGES.map((s) => [s, 0])) as Record<
      LeadStage,
      number
    >;
    for (const l of leads) map[l.stage] += 1;
    return map;
  }, [leads]);

  const openValue = leads
    .filter((l) => l.stage !== "ganado" && l.stage !== "perdido")
    .reduce((sum, l) => sum + (Number(l.estimatedValue) || 0), 0);

  const dueToday = leads.filter(
    (l) =>
      l.nextActionDate &&
      l.nextActionDate <= todayISO() &&
      l.stage !== "ganado" &&
      l.stage !== "perdido"
  ).length;

  const visible = leads.filter((l) =>
    filter === "todas" ? true : l.stage === filter
  );

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
    <AppShell title="Pipeline comercial" subtitle="Leads · cotización · cierre">
      <p className="os-page-intro mb-5 max-w-3xl text-sm leading-6 text-[#4d5c55]">
        Antes de cotizar: contactos, visita y negociación. Al ganar, pasa a
        Obra; la cotización y la visita quedan ligadas a la misma ficha.
      </p>
      {flash ? (
        <p className="mb-3 rounded-xl bg-[#e8f6ee] px-4 py-2 text-sm text-[#1f6b45]">
          {flash}
        </p>
      ) : null}

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="os-stat rounded-2xl border border-[#ddd6c8] bg-white px-4 py-3">
          <p className="text-2xl font-semibold text-[#0f2a1f]">{leads.length}</p>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#6d7c74]">
            Oportunidades
          </p>
        </div>
        <div className="os-stat rounded-2xl border border-[#ddd6c8] bg-white px-4 py-3">
          <p className="text-2xl font-semibold text-[#0f2a1f]">
            {cop.format(openValue)}
          </p>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#6d7c74]">
            Valor abierto
          </p>
        </div>
        <div className="os-stat rounded-2xl border border-[#ddd6c8] bg-white px-4 py-3">
          <p className="text-2xl font-semibold text-[#0f2a1f]">{dueToday}</p>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#6d7c74]">
            Seguimiento vencido
          </p>
        </div>
        <div className="os-stat rounded-2xl border border-[#ddd6c8] bg-white px-4 py-3">
          <p className="text-2xl font-semibold text-[#1f6b45]">
            {counts.ganado}
          </p>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#6d7c74]">
            Ganados
          </p>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-2 lg:grid-cols-7">
        {STAGES.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setFilter((f) => (f === id ? "todas" : id))}
            className={`os-stat rounded-2xl border px-3 py-3 text-left ${
              filter === id ? "border-[#1f6b45]" : "border-[#ddd6c8]"
            } ${TONE[id]}`}
          >
            <p className="text-xl font-semibold">{counts[id]}</p>
            <p className="text-[11px] font-semibold uppercase tracking-wide">
              {LEAD_STAGE_LABELS[id]}
            </p>
          </button>
        ))}
      </div>

      <div className="mb-6 overflow-x-auto">
        <div className="flex min-w-[980px] gap-3">
          {STAGES.filter((s) => s !== "perdido").map((stage) => {
            const col = leads.filter((l) => l.stage === stage);
            return (
              <div
                key={stage}
                className="w-[160px] shrink-0 rounded-2xl border border-[#eee8dc] bg-[#fbfaf6] p-2"
              >
                <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-[#6d7c74]">
                  {LEAD_STAGE_LABELS[stage]}
                </p>
                {col.length === 0 ? (
                  <p className="px-1 text-xs text-[#8aa398]">—</p>
                ) : (
                  col.map((l) => (
                    <button
                      key={l.id}
                      type="button"
                      onClick={() => setDraft({ ...emptyLead(), ...l })}
                      className="mb-2 w-full rounded-xl border border-[#ddd6c8] bg-white px-2 py-2 text-left hover:border-[#1f6b45]"
                    >
                      <p className="truncate text-xs font-semibold">
                        {l.clientName || "Sin cliente"}
                      </p>
                      <p className="truncate text-[11px] text-[#6d7c74]">
                        {l.kwp ? `${l.kwp} kWp` : l.city || l.owner || "—"}
                      </p>
                    </button>
                  ))
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
        <section className="os-panel rounded-2xl border border-[#ddd6c8] bg-white">
          <div className="flex items-center justify-between gap-3 border-b border-[#eee8dc] px-4 py-3">
            <h2 className="font-semibold">Oportunidades</h2>
            <button
              type="button"
              className="text-sm font-semibold text-[#1f6b45] underline"
              onClick={() => setFilter("todas")}
            >
              Ver todas
            </button>
          </div>
          {visible.length === 0 ? (
            <p className="px-4 py-5 text-sm text-[#6d7c74]">
              No hay fichas en este filtro.
              <span className="os-page-intro mt-1 block text-xs">
                Cree una a la derecha.
              </span>
            </p>
          ) : (
            <ul className="divide-y divide-[#eee8dc]">
              {visible.map((l) => (
                <li key={l.id} className="px-4 py-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold">{leadLabel(l)}</p>
                      <p className="text-xs text-[#6d7c74]">
                        {l.kwp ? `${l.kwp} kWp · ` : ""}
                        {l.estimatedValue
                          ? `${cop.format(l.estimatedValue)} · `
                          : ""}
                        {LEAD_SOURCE_LABELS[l.source]}
                        {l.owner ? ` · ${l.owner}` : ""}
                      </p>
                      {l.nextAction ? (
                        <p className="text-[11px] text-[#6d7c74]">
                          Siguiente: {l.nextAction}
                          {l.nextActionDate ? ` · ${l.nextActionDate}` : ""}
                        </p>
                      ) : null}
                    </div>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${TONE[l.stage]}`}
                    >
                      {LEAD_STAGE_LABELS[l.stage]}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="text-xs font-semibold text-[#1f6b45] underline"
                      onClick={() => setDraft({ ...emptyLead(), ...l })}
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      className="text-xs font-semibold text-[#1f6b45] underline"
                      onClick={() => openQuoteFromLead(l)}
                    >
                      Cotizar
                    </button>
                    {l.quoteId ? (
                      <button
                        type="button"
                        className="text-xs font-semibold text-[#1f6b45] underline"
                        onClick={() => {
                          pinActiveQuote(l.quoteId!);
                          sessionStorage.setItem(OPEN_QUOTE_KEY, l.quoteId!);
                          window.location.assign(
                            `/cotizador?quote=${encodeURIComponent(l.quoteId!)}`
                          );
                        }}
                      >
                        Ver cotización
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="text-xs font-semibold text-[#1f6b45] underline"
                      onClick={() => openVisitFromLead(l)}
                    >
                      Visita
                    </button>
                    {l.stage !== "ganado" ? (
                      <button
                        type="button"
                        className="text-xs font-semibold text-[#1f6b45] underline"
                        onClick={() => passToObra(l)}
                      >
                        Pasar a obra
                      </button>
                    ) : (
                      <a
                        href="/obra"
                        className="text-xs font-semibold text-[#1f6b45] underline"
                      >
                        Obra
                      </a>
                    )}
                    <button
                      type="button"
                      className="text-xs font-semibold text-[#9b2c2c] underline"
                      onClick={() => {
                        if (!confirm("¿Quitar esta oportunidad?")) return;
                        const next = deleteLead(l.id);
                        setLeads(next);
                        persistLeadsCloud(next);
                        void fetch(`/api/archivo?lead=${l.id}`, {
                          method: "DELETE",
                        });
                      }}
                    >
                      Quitar
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="os-panel rounded-2xl border border-[#ddd6c8] bg-white p-5">
          <WorkFold
            title={
              leads.some((l) => l.id === draft.id)
                ? "Editar oportunidad"
                : "Nueva oportunidad"
            }
            open={formOpen}
            onToggle={() => setFormOpen((v) => !v)}
            actions={
              <button
                type="button"
                className="text-xs font-semibold text-[#1f6b45] underline"
                onClick={() => setDraft(emptyLead())}
              >
                Limpiar
              </button>
            }
          >

          {quotes.length ? (
            <label className="mt-3 block text-sm">
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
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-xl bg-[#0f2a1f] px-4 py-2.5 text-sm font-semibold text-white"
              onClick={saveDraft}
            >
              Guardar
            </button>
            <button
              type="button"
              className="rounded-xl border border-[#1f6b45] px-4 py-2.5 text-sm font-semibold text-[#1f6b45]"
              onClick={() => openQuoteFromLead(draft)}
            >
              Cotizar
            </button>
            <button
              type="button"
              className="rounded-xl border border-[#1f6b45] px-4 py-2.5 text-sm font-semibold text-[#1f6b45]"
              onClick={() => passToObra(draft)}
            >
              Pasar a obra
            </button>
          </div>
          </WorkFold>
        </section>
      </div>
    </AppShell>
  );
}
