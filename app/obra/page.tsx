"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";
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
import { loadSavedQuotes, pinActiveQuote } from "@/lib/saved-quotes";
import {
  OPEN_QUOTE_KEY,
  OPEN_VISIT_KEY,
  loadSavedVisits,
} from "@/lib/saved-visits";
import { emptyPlant, upsertPlant } from "@/lib/technical-reports";

const field =
  "w-full rounded-xl border border-[#d8d2c4] bg-[#fbfaf6] px-3 py-2.5 text-sm";

const TONE: Record<ObraStatus, string> = {
  "por-iniciar": "bg-[#f7f4ee] text-[#6d7c74]",
  "en-obra": "bg-[#fff4e5] text-[#9a5b00]",
  tramites: "bg-[#eef4fa] text-[#2a5f8f]",
  energizado: "bg-[#e8f6ee] text-[#1f6b45]",
  cerrado: "bg-[#eee8dc] text-[#4d5c55]",
};

function persistCloud(obras: ObraJob[]) {
  void fetch("/api/archivo", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ obras }),
  }).catch(() => undefined);
}

export default function ObraPage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<ObraJob[]>([]);
  const [draft, setDraft] = useState<ObraJob>(() => emptyObra());
  const [filter, setFilter] = useState<"todas" | ObraStatus>("todas");
  const [flash, setFlash] = useState("");
  const [quotes, setQuotes] = useState<ReturnType<typeof loadSavedQuotes>>([]);
  const [visits, setVisits] = useState<ReturnType<typeof loadSavedVisits>>([]);

  useEffect(() => {
    setQuotes(loadSavedQuotes());
    setVisits(loadSavedVisits());
    const local = loadObras();
    setJobs(local);
    const openId = sessionStorage.getItem(OPEN_OBRA_KEY);
    if (openId) {
      const found = local.find((j) => j.id === openId);
      if (found) setDraft({ ...emptyObra(), ...found });
      sessionStorage.removeItem(OPEN_OBRA_KEY);
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
        if (stillOpen) setDraft({ ...emptyObra(), ...stillOpen });
      })
      .catch(() => undefined);
  }, []);

  const counts = useMemo(() => {
    const map = {
      "por-iniciar": 0,
      "en-obra": 0,
      tramites: 0,
      energizado: 0,
      cerrado: 0,
    } as Record<ObraStatus, number>;
    for (const j of jobs) map[j.status] += 1;
    return map;
  }, [jobs]);

  const visible = jobs.filter((j) =>
    filter === "todas" ? true : j.status === filter
  );

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

  function tramiteSelect(
    key: "upme" | "retie" | "operadorRed",
    label: string
  ) {
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
    <AppShell title="Obra" subtitle="Avance · cuadrilla · RETIE / UPME">
      <p className="mb-5 max-w-3xl text-sm leading-6 text-[#4d5c55]">
        Una ficha por proyecto ganado: de cotización a energización. Trámites
        UPME, RETIE y operador de red, compras frente a lo cotizado y enlace a
        visita, cotizador y O&M.
      </p>
      {flash ? (
        <p className="mb-3 rounded-xl bg-[#e8f6ee] px-4 py-2 text-sm text-[#1f6b45]">
          {flash}
        </p>
      ) : null}

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
        {(Object.keys(OBRA_STATUS_LABELS) as ObraStatus[]).map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setFilter((f) => (f === id ? "todas" : id))}
            className={`rounded-2xl border px-4 py-3 text-left ${
              filter === id ? "border-[#1f6b45]" : "border-[#ddd6c8]"
            } ${TONE[id]}`}
          >
            <p className="text-2xl font-semibold">{counts[id]}</p>
            <p className="text-[11px] font-semibold uppercase tracking-wide">
              {OBRA_STATUS_LABELS[id]}
            </p>
          </button>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
        <section className="rounded-2xl border border-[#ddd6c8] bg-white">
          <div className="flex items-center justify-between gap-3 border-b border-[#eee8dc] px-4 py-3">
            <h2 className="font-semibold">Tablero de obra</h2>
            <button
              type="button"
              className="text-sm font-semibold text-[#1f6b45] underline"
              onClick={() => setFilter("todas")}
            >
              Ver todas
            </button>
          </div>
          {visible.length === 0 ? (
            <p className="px-4 py-8 text-sm text-[#6d7c74]">
              No hay obras en este filtro. Cree una a la derecha o tómela de
              una cotización guardada.
            </p>
          ) : (
            <ul className="divide-y divide-[#eee8dc]">
              {visible.map((j) => (
                <li key={j.id} className="px-4 py-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold">{obraLabel(j)}</p>
                      <p className="text-xs text-[#6d7c74]">
                        {j.kwp ? `${j.kwp} kWp · ` : ""}
                        Avance {j.progress}% · compras {j.compras}
                        {j.crew ? ` · ${j.crew}` : ""}
                      </p>
                      <p className="text-[11px] text-[#6d7c74]">
                        UPME {TRAMITE_LABELS[j.upme]} · RETIE{" "}
                        {TRAMITE_LABELS[j.retie]} · OR{" "}
                        {TRAMITE_LABELS[j.operadorRed]}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${TONE[j.status]}`}
                    >
                      {OBRA_STATUS_LABELS[j.status]}
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#eee8dc]">
                    <div
                      className="h-full bg-[#1f6b45]"
                      style={{ width: `${Math.min(100, j.progress)}%` }}
                    />
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="text-xs font-semibold text-[#1f6b45] underline"
                      onClick={() => setDraft({ ...emptyObra(), ...j })}
                    >
                      Editar
                    </button>
                    {j.quoteId ? (
                      <button
                        type="button"
                        className="text-xs font-semibold text-[#1f6b45] underline"
                        onClick={() => {
                          pinActiveQuote(j.quoteId!);
                          sessionStorage.setItem(OPEN_QUOTE_KEY, j.quoteId!);
                          window.location.assign(
                            `/cotizador?quote=${encodeURIComponent(j.quoteId!)}`
                          );
                        }}
                      >
                        Cotización
                      </button>
                    ) : null}
                    {j.visitId ? (
                      <button
                        type="button"
                        className="text-xs font-semibold text-[#1f6b45] underline"
                        onClick={() => {
                          sessionStorage.setItem(OPEN_VISIT_KEY, j.visitId!);
                          router.push("/visita-tecnica");
                        }}
                      >
                        Visita
                      </button>
                    ) : null}
                    <a
                      href="/om"
                      className="text-xs font-semibold text-[#1f6b45] underline"
                    >
                      O&M
                    </a>
                    <button
                      type="button"
                      className="text-xs font-semibold text-[#9b2c2c] underline"
                      onClick={() => {
                        if (!confirm("¿Quitar esta obra?")) return;
                        const next = deleteObra(j.id);
                        setJobs(next);
                        persistCloud(next);
                        void fetch(`/api/archivo?obra=${j.id}`, {
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

        <section className="rounded-2xl border border-[#ddd6c8] bg-white p-5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-semibold">
              {jobs.some((j) => j.id === draft.id) ? "Editar obra" : "Nueva obra"}
            </h2>
            <button
              type="button"
              className="text-xs font-semibold text-[#1f6b45] underline"
              onClick={() => setDraft(emptyObra())}
            >
              Limpiar
            </button>
          </div>

          {quotes.length ? (
            <label className="mt-3 block text-sm">
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
                {(Object.keys(OBRA_STATUS_LABELS) as ObraStatus[]).map((id) => (
                  <option key={id} value={id}>
                    {OBRA_STATUS_LABELS[id]}
                  </option>
                ))}
              </select>
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
            <label className="text-sm">
              <span className="mb-1 block font-medium">Avance %</span>
              <input
                type="number"
                min={0}
                max={100}
                className={field}
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
            {tramiteSelect("upme", "UPME / Ley 1715")}
            {tramiteSelect("retie", "RETIE")}
            {tramiteSelect("operadorRed", "Operador de red")}
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
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-xl bg-[#0f2a1f] px-4 py-2.5 text-sm font-semibold text-white"
              onClick={saveDraft}
            >
              Guardar obra
            </button>
            <button
              type="button"
              className="rounded-xl border border-[#1f6b45] px-4 py-2.5 text-sm font-semibold text-[#1f6b45]"
              onClick={() => {
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
              }}
            >
              Pasar a O&M
            </button>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
