"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { WorkFold } from "@/components/WorkFold";
import {
  CONTENT_FORMAT_LABELS,
  CONTENT_NETWORK_LABELS,
  CONTENT_OBJECTIVE_LABELS,
  CONTENT_STATUS_LABELS,
  CONTENT_STATUS_TONE,
  addDays,
  deleteContent,
  emptyPiece,
  loadContent,
  mergeContent,
  mondayOf,
  persistContentCloud,
  piecesInWeek,
  replaceContent,
  upsertContent,
  weekDates,
  weekdayLabel,
  type ContentFormat,
  type ContentNetwork,
  type ContentObjective,
  type ContentPiece,
  type ContentStatus,
} from "@/lib/content";
import { loadSpecialistManuals } from "@/lib/specialist-manuals";

const field =
  "w-full rounded-xl border border-[#d8d2c4] bg-[#fbfaf6] px-3 py-2.5 text-sm";

export default function ContenidoPage() {
  const [weekStart, setWeekStart] = useState(() => mondayOf());
  const [pieces, setPieces] = useState<ContentPiece[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState("");
  const [note, setNote] = useState("");
  const [ask, setAsk] = useState("");
  const [briefOpen, setBriefOpen] = useState(true);

  const week = useMemo(
    () => piecesInWeek(pieces, weekStart),
    [pieces, weekStart]
  );
  const selected = week.find((p) => p.id === selectedId) ?? null;
  const days = weekDates(weekStart);
  const pending = week.filter((p) => p.status !== "publicado").length;

  function commit(next: ContentPiece[]) {
    const saved = replaceContent(next);
    setPieces(saved);
    persistContentCloud(saved);
  }

  useEffect(() => {
    const local = loadContent();
    setPieces(local);
    void fetch("/api/contenido", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data?.pieces) return;
        const merged = mergeContent(loadContent(), data.pieces);
        replaceContent(merged);
        setPieces(merged);
        persistContentCloud(merged);
      })
      .catch(() => undefined);
  }, []);

  async function generarSemana(replaceIdeas: boolean) {
    setBusy(true);
    setFlash("");
    try {
      const manuals = loadSpecialistManuals();
      const res = await fetch("/api/contenido/semana", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          weekStart,
          note: ask,
          manual: manuals.growth,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFlash(data.error || "No se pudo armar la semana.");
        return;
      }
      const incoming = (data.pieces ?? []) as ContentPiece[];
      let next = loadContent();
      if (replaceIdeas) {
        const keep = next.filter((p) => {
          const inWeek = p.date >= weekStart && p.date <= addDays(weekStart, 6);
          if (!inWeek) return true;
          return p.status === "grabado" || p.status === "publicado";
        });
        next = [...keep, ...incoming];
      } else {
        const occupied = new Set(
          piecesInWeek(next, weekStart).map((p) => p.date)
        );
        next = [
          ...next,
          ...incoming.filter((p) => !occupied.has(p.date)),
        ];
      }
      commit(next);
      setNote(data.note || "");
      setFlash(
        data.offline
          ? "Semana lista desde el banco (demo). Con OPENAI_API_KEY Daniela escribe briefs nuevos."
          : "Daniela armó la semana. Aprueben y graben."
      );
      const first = incoming[0];
      if (first) setSelectedId(first.id);
    } catch {
      setFlash("No hay conexión con Daniela.");
    } finally {
      setBusy(false);
      window.setTimeout(() => setFlash(""), 5000);
    }
  }

  function patchSelected(partial: Partial<ContentPiece>) {
    if (!selected) return;
    const next = upsertContent({ ...selected, ...partial });
    setPieces(next);
    persistContentCloud(next);
  }

  function addEmpty(date: string) {
    const piece = emptyPiece({ date, status: "idea" });
    const next = upsertContent(piece);
    setPieces(next);
    persistContentCloud(next);
    setSelectedId(piece.id);
  }

  function remove(id: string) {
    const next = deleteContent(id);
    setPieces(next);
    persistContentCloud(next);
    if (selectedId === id) setSelectedId("");
  }

  return (
    <AppShell
      title="Contenido"
      subtitle="Calendario · briefs · Daniela (Growth)"
    >
      <p className="os-page-intro mb-4 max-w-3xl text-sm leading-6 text-[#4d5c55]">
        Ustedes filman. Daniela propone la semana. El equipo ve el mismo
        tablero: idea, aprobado, grabado, publicado. Un CTA de WhatsApp por
        semana.{" "}
        <Link href="/inteligencia?e=growth" className="font-medium text-[#1f6b45] underline">
          Preguntas sueltas: Inteligencia → Lic. Daniela Ríos
        </Link>
        .
      </p>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="rounded-xl border border-[#d8d2c4] bg-white px-3 py-2 text-sm"
          onClick={() => setWeekStart(addDays(weekStart, -7))}
        >
          Semana anterior
        </button>
        <p className="px-2 text-sm font-semibold">
          Lunes {weekStart}
        </p>
        <button
          type="button"
          className="rounded-xl border border-[#d8d2c4] bg-white px-3 py-2 text-sm"
          onClick={() => setWeekStart(addDays(weekStart, 7))}
        >
          Semana siguiente
        </button>
        <button
          type="button"
          className="rounded-xl border border-[#d8d2c4] bg-white px-3 py-2 text-sm"
          onClick={() => setWeekStart(mondayOf())}
        >
          Esta semana
        </button>
        <span className="text-xs text-[#6d7c74]">
          {week.length} piezas · {pending} pendientes
        </span>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <input
          className={`${field} max-w-md`}
          placeholder="Pedido a Daniela (opcional): esta semana hay visita en Sopó…"
          value={ask}
          onChange={(e) => setAsk(e.target.value)}
        />
        <button
          type="button"
          disabled={busy}
          className="rounded-xl bg-[#0f2a1f] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
          onClick={() => void generarSemana(week.length === 0)}
        >
          {busy ? "Armando…" : week.length ? "Completar días vacíos" : "Pedir semana a Daniela"}
        </button>
        {week.length ? (
          <button
            type="button"
            disabled={busy}
            className="rounded-xl border border-[#d4b46a] bg-[#fff8e8] px-4 py-2.5 text-sm font-semibold text-[#8a6b2a] disabled:opacity-60"
            onClick={() => void generarSemana(true)}
          >
            Regenerar ideas (conserva grabado/publicado)
          </button>
        ) : null}
      </div>
      {note ? (
        <p className="mb-3 rounded-xl bg-[#e8f6ee] px-3 py-2 text-sm text-[#244a38]">
          {note}
        </p>
      ) : null}
      {flash ? <p className="mb-3 text-sm text-[#1f6b45]">{flash}</p> : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {days.map((date) => {
            const items = week.filter((p) => p.date === date);
            return (
              <section
                key={date}
                className="rounded-2xl border border-[#ddd6c8] bg-white p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold tracking-wide text-[#6d7c74] uppercase">
                    {weekdayLabel(date)}
                  </p>
                  <button
                    type="button"
                    className="text-xs text-[#1f6b45] underline"
                    onClick={() => addEmpty(date)}
                  >
                    + pieza
                  </button>
                </div>
                {items.length === 0 ? (
                  <p className="mt-3 text-xs text-[#8a7f70]">Libre. Descanso o grabar tanda.</p>
                ) : (
                  <ul className="mt-2 space-y-2">
                    {items.map((p) => (
                      <li key={p.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedId(p.id)}
                          className={`w-full rounded-xl border px-2.5 py-2 text-left text-sm ${
                            selectedId === p.id
                              ? "border-[#1f6b45] bg-[#e8f6ee]"
                              : "border-[#eee8dc] bg-[#fbfaf6]"
                          }`}
                        >
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${CONTENT_STATUS_TONE[p.status]}`}
                          >
                            {CONTENT_STATUS_LABELS[p.status]}
                          </span>
                          <p className="mt-1 font-semibold leading-5">{p.title || "Sin título"}</p>
                          <p className="text-[11px] text-[#6d7c74]">
                            {CONTENT_FORMAT_LABELS[p.format]} · {CONTENT_NETWORK_LABELS[p.network]}
                          </p>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>

        <div>
          {selected ? (
            <WorkFold
              title="Brief de la pieza"
              open={briefOpen}
              onToggle={() => setBriefOpen((v) => !v)}
            >
              <label className="block text-sm">
                <span className="mb-1 block font-medium">Título</span>
                <input
                  className={field}
                  value={selected.title}
                  onChange={(e) => patchSelected({ title: e.target.value })}
                />
              </label>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <label className="block text-sm">
                  <span className="mb-1 block font-medium">Formato</span>
                  <select
                    className={field}
                    value={selected.format}
                    onChange={(e) =>
                      patchSelected({ format: e.target.value as ContentFormat })
                    }
                  >
                    {Object.entries(CONTENT_FORMAT_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block font-medium">Red</span>
                  <select
                    className={field}
                    value={selected.network}
                    onChange={(e) =>
                      patchSelected({
                        network: e.target.value as ContentNetwork,
                      })
                    }
                  >
                    {Object.entries(CONTENT_NETWORK_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block font-medium">Objetivo</span>
                  <select
                    className={field}
                    value={selected.objective}
                    onChange={(e) =>
                      patchSelected({
                        objective: e.target.value as ContentObjective,
                      })
                    }
                  >
                    {Object.entries(CONTENT_OBJECTIVE_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block font-medium">Estado</span>
                  <select
                    className={field}
                    value={selected.status}
                    onChange={(e) =>
                      patchSelected({ status: e.target.value as ContentStatus })
                    }
                  >
                    {Object.entries(CONTENT_STATUS_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="mt-3 block text-sm">
                <span className="mb-1 block font-medium">Gancho (3 s)</span>
                <textarea
                  className={field}
                  rows={2}
                  value={selected.hook}
                  onChange={(e) => patchSelected({ hook: e.target.value })}
                />
              </label>
              <label className="mt-3 block text-sm">
                <span className="mb-1 block font-medium">Guion</span>
                <textarea
                  className={field}
                  rows={5}
                  value={selected.script}
                  onChange={(e) => patchSelected({ script: e.target.value })}
                />
              </label>
              <label className="mt-3 block text-sm">
                <span className="mb-1 block font-medium">Dónde filmar</span>
                <input
                  className={field}
                  value={selected.location}
                  onChange={(e) => patchSelected({ location: e.target.value })}
                />
              </label>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <label className="block text-sm">
                  <span className="mb-1 block font-medium">Segundos</span>
                  <input
                    className={field}
                    type="number"
                    value={selected.durationSec}
                    onChange={(e) =>
                      patchSelected({ durationSec: Number(e.target.value) || 0 })
                    }
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block font-medium">Quién sale</span>
                  <input
                    className={field}
                    value={selected.owner}
                    onChange={(e) => patchSelected({ owner: e.target.value })}
                  />
                </label>
              </div>
              <label className="mt-3 block text-sm">
                <span className="mb-1 block font-medium">CTA</span>
                <input
                  className={field}
                  value={selected.cta}
                  onChange={(e) => patchSelected({ cta: e.target.value })}
                />
              </label>
              <div className="mt-3 flex flex-wrap gap-2">
                {(
                  [
                    ["aprobado", "Aprobar"],
                    ["grabado", "Ya grabado"],
                    ["publicado", "Publicado"],
                  ] as const
                ).map(([status, label]) => (
                  <button
                    key={status}
                    type="button"
                    className="rounded-xl border border-[#1f6b45] px-3 py-1.5 text-xs font-semibold text-[#1f6b45]"
                    onClick={() => patchSelected({ status })}
                  >
                    {label}
                  </button>
                ))}
                <button
                  type="button"
                  className="rounded-xl px-3 py-1.5 text-xs text-[#9b2c2c] underline"
                  onClick={() => remove(selected.id)}
                >
                  Quitar
                </button>
              </div>
            </WorkFold>
          ) : (
            <p className="rounded-2xl border border-dashed border-[#ddd6c8] p-4 text-sm text-[#6d7c74]">
              Pulse una pieza o pida la semana a Daniela para ver el guion.
            </p>
          )}
        </div>
      </div>
    </AppShell>
  );
}
