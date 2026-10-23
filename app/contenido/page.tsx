"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { WorkFold } from "@/components/WorkFold";
import {
  CONTENT_BANK,
  CONTENT_FORMAT_LABELS,
  CONTENT_NETWORK_LABELS,
  CONTENT_OBJECTIVE_LABELS,
  CONTENT_STATUS_LABELS,
  CONTENT_STATUS_TONE,
  WEEKDAY_NAMES,
  addDays,
  addMonths,
  deleteContent,
  emptyPiece,
  emptyWeekReport,
  filmingBatches,
  loadContent,
  loadDeletedContentIds,
  loadWeekReports,
  localYmd,
  mergeContent,
  mergeWeekReports,
  saveDeletedContentIds,
  mondayOf,
  monthGrid,
  monthLabel,
  persistContentCloud,
  pieceFromIdea,
  piecesInWeek,
  replaceContent,
  replaceWeekReports,
  upsertWeekReport,
  startOfMonth,
  upsertContent,
  weekDates,
  weekdayLabel,
  weekdayLong,
  type ContentFormat,
  type ContentNetwork,
  type ContentObjective,
  type ContentPiece,
  type ContentStatus,
  type ContentWeekReport,
} from "@/lib/content";
import { loadSpecialistManuals } from "@/lib/specialist-manuals";
import {
  SPOKEN_SOURCE_LABELS,
  type LinkAnalysis,
  type PublicLinkPreview,
} from "@/lib/content-link";

const field =
  "w-full rounded-xl border border-[#d8d2c4] bg-[#fbfaf6] px-3 py-2.5 text-sm";

const VIEW_KEY = "genera.contenido.vista";
type CalendarView = "dia" | "semana" | "mes";

function readView(): CalendarView {
  if (typeof window === "undefined") return "semana";
  const raw = window.localStorage.getItem(VIEW_KEY);
  if (raw === "dia" || raw === "semana" || raw === "mes") return raw;
  return "semana";
}

function AnalysisList({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div className="rounded-xl border border-[#eee8dc] bg-[#fbfaf6] p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-[#6d7c74]">
        {title}
      </p>
      <ul className="mt-2 list-disc space-y-1 pl-4 text-sm leading-5">
        {items.map((item, i) => (
          <li key={`${title}-${i}`}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function PieceCard({
  piece,
  selected,
  compact,
  onSelect,
}: {
  piece: ContentPiece;
  selected: boolean;
  compact?: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full rounded-xl border px-2.5 py-2 text-left text-sm ${
        selected
          ? "border-[#1f6b45] bg-[#e8f6ee]"
          : "border-[#eee8dc] bg-[#fbfaf6]"
      }`}
    >
      <span
        className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${CONTENT_STATUS_TONE[piece.status]}`}
      >
        {CONTENT_STATUS_LABELS[piece.status]}
      </span>
      <p className={`mt-1 font-semibold leading-5 ${compact ? "line-clamp-2" : ""}`}>
        {piece.title || "Sin título"}
      </p>
      {compact ? null : (
        <p className="text-[11px] text-[#6d7c74]">
          {CONTENT_FORMAT_LABELS[piece.format]} · {CONTENT_NETWORK_LABELS[piece.network]}
        </p>
      )}
    </button>
  );
}

export default function ContenidoPage() {
  const [cursor, setCursor] = useState(() => localYmd());
  const [view, setView] = useState<CalendarView>("semana");
  const [pieces, setPieces] = useState<ContentPiece[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState("");
  const [note, setNote] = useState("");
  const [ask, setAsk] = useState("");
  const [briefOpen, setBriefOpen] = useState(true);
  const [bankOpen, setBankOpen] = useState(false);
  const [tandaOpen, setTandaOpen] = useState(true);
  const [reportOpen, setReportOpen] = useState(true);
  const [reports, setReports] = useState<ContentWeekReport[]>([]);
  const [reportBusy, setReportBusy] = useState(false);
  const [improveAsk, setImproveAsk] = useState("");
  const [improveBusy, setImproveBusy] = useState(false);
  const [linkOpen, setLinkOpen] = useState(true);
  const [videoUrl, setVideoUrl] = useState("");
  const [videoNotes, setVideoNotes] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [preview, setPreview] = useState<PublicLinkPreview | null>(null);
  const [analysis, setAnalysis] = useState<LinkAnalysis | null>(null);

  const today = localYmd();
  const weekStart = mondayOf(cursor);
  const monthStart = startOfMonth(cursor);
  const week = useMemo(
    () => piecesInWeek(pieces, weekStart),
    [pieces, weekStart]
  );
  const monthPieces = useMemo(
    () => pieces.filter((p) => p.date.startsWith(monthStart.slice(0, 7))),
    [pieces, monthStart]
  );
  const dayPieces = useMemo(
    () => pieces.filter((p) => p.date === cursor).sort((a, b) => a.title.localeCompare(b.title, "es")),
    [pieces, cursor]
  );
  const selected = pieces.find((p) => p.id === selectedId) ?? null;
  const days = weekDates(weekStart);
  const grid = monthGrid(cursor);
  const visible =
    view === "dia" ? dayPieces : view === "semana" ? week : monthPieces;
  const pending = visible.filter((p) => p.status !== "publicado").length;
  const batches = useMemo(() => filmingBatches(week), [week]);
  const weekReport =
    reports.find((r) => r.weekStart === weekStart) ?? emptyWeekReport(weekStart);
  const followerDelta = weekReport.followersEnd - weekReport.followersStart;

  function setViewPersist(next: CalendarView) {
    setView(next);
    try {
      window.localStorage.setItem(VIEW_KEY, next);
    } catch {
      /* quota */
    }
  }

  function commit(next: ContentPiece[]) {
    const saved = replaceContent(next);
    setPieces(saved);
    persistContentCloud(saved);
  }

  useEffect(() => {
    setImproveAsk("");
  }, [selectedId]);

  useEffect(() => {
    setView(readView());
    const local = loadContent();
    setPieces(local);
    setReports(loadWeekReports());
    void fetch("/api/contenido", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data?.pieces) return;
        const deleted = saveDeletedContentIds([
          ...loadDeletedContentIds(),
          ...(data.deletedIds ?? []),
        ]);
        const merged = mergeContent(loadContent(), data.pieces, deleted);
        replaceContent(merged);
        setPieces(merged);
        if (data.reports) {
          const nextReports = mergeWeekReports(loadWeekReports(), data.reports);
          replaceWeekReports(nextReports);
          setReports(nextReports);
        }
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
      if (first) {
        setSelectedId(first.id);
        setCursor(first.date);
      }
    } catch {
      setFlash("No hay conexión con Daniela.");
    } finally {
      setBusy(false);
      window.setTimeout(() => setFlash(""), 5000);
    }
  }

  function patchReport(partial: Partial<ContentWeekReport>) {
    const next = upsertWeekReport({ ...weekReport, ...partial });
    setReports(next);
    persistContentCloud(pieces);
  }

  async function danielaLeeSemana() {
    setReportBusy(true);
    setFlash("");
    try {
      const manuals = loadSpecialistManuals();
      const res = await fetch("/api/contenido/rendimiento", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          report: weekReport,
          pieces: week,
          manual: manuals.growth,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFlash(data.error || "No se pudo leer el rendimiento.");
        return;
      }
      if (data.report) {
        const next = upsertWeekReport(data.report);
        setReports(next);
        persistContentCloud(pieces);
      }
      setFlash(
        data.offline
          ? "Lectura local. Con OPENAI_API_KEY Daniela interpreta la semana."
          : "Daniela leyó la semana. Abajo está qué repetir y qué parar."
      );
    } catch {
      setFlash("No hay conexión con Daniela.");
    } finally {
      setReportBusy(false);
      window.setTimeout(() => setFlash(""), 5000);
    }
  }

  async function danielaMejoraPieza() {
    if (!selected) return;
    setImproveBusy(true);
    setFlash("");
    try {
      const manuals = loadSpecialistManuals();
      const res = await fetch("/api/contenido/mejorar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          piece: selected,
          instruction: improveAsk,
          manual: manuals.growth,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFlash(data.error || "No se pudo mejorar la pieza.");
        return;
      }
      if (data.piece) {
        const next = upsertContent({
          ...selected,
          ...data.piece,
          id: selected.id,
          date: selected.date,
        });
        setPieces(next);
        persistContentCloud(next);
      }
      setImproveAsk("");
      setFlash(data.note || "Daniela reescribió esta pieza.");
    } catch {
      setFlash("No hay conexión con Daniela.");
    } finally {
      setImproveBusy(false);
      window.setTimeout(() => setFlash(""), 5000);
    }
  }

  function patchSelected(partial: Partial<ContentPiece>) {
    if (!selected) return;
    const next = upsertContent({ ...selected, ...partial });
    setPieces(next);
    persistContentCloud(next);
  }

  function addFromBank(id: string) {
    const idea = CONTENT_BANK.find((i) => i.id === id);
    if (!idea) return;
    const occupied = new Set(week.map((p) => p.date));
    const date =
      view === "dia"
        ? cursor
        : days.find((d) => !occupied.has(d)) || cursor;
    const piece = pieceFromIdea(idea, date, "instagram");
    const next = upsertContent(piece);
    setPieces(next);
    persistContentCloud(next);
    setSelectedId(piece.id);
    setCursor(date);
  }

  async function analizarEnlace() {
    setAnalyzing(true);
    setFlash("");
    setAnalysis(null);
    setPreview(null);
    try {
      const manuals = loadSpecialistManuals();
      const res = await fetch("/api/contenido/analizar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: videoUrl,
          notes: videoNotes,
          manual: manuals.growth,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFlash(data.error || "No se pudo analizar el enlace.");
        return;
      }
      setPreview(data.preview ?? null);
      setAnalysis(data.analysis ?? null);
      setFlash(
        data.offline
          ? "Checklist local. Con OPENAI_API_KEY Daniela reescribe el guion."
          : "Daniela analizó el enlace. Revisen y sumen la pieza si sirve."
      );
    } catch {
      setFlash("No hay conexión con Daniela.");
    } finally {
      setAnalyzing(false);
      window.setTimeout(() => setFlash(""), 5000);
    }
  }

  function addAnalysisPiece() {
    if (!analysis?.piece) return;
    const p = analysis.piece;
    const piece = emptyPiece({
      date: cursor,
      title: p.title,
      hook: p.hook,
      script: p.script,
      format: p.format,
      network: p.network,
      durationSec: p.durationSec,
      cta: p.cta,
      objective: p.objective,
      location: p.location || analysis.location,
      notes: [
        preview?.url ? `Referencia (no copiar): ${preview.url}` : "",
        analysis.note,
      ]
        .filter(Boolean)
        .join(" · "),
      status: "idea",
    });
    const next = upsertContent(piece);
    setPieces(next);
    persistContentCloud(next);
    setSelectedId(piece.id);
    setFlash("Pieza nueva en el día enfocado. No es el video original: es la versión Genera.");
    window.setTimeout(() => setFlash(""), 5000);
  }

  function addEmpty(date: string) {
    const piece = emptyPiece({ date, status: "idea" });
    const next = upsertContent(piece);
    setPieces(next);
    persistContentCloud(next);
    setSelectedId(piece.id);
    setCursor(date);
  }

  function remove(id: string) {
    const next = deleteContent(id);
    setPieces(next);
    persistContentCloud(next);
    if (selectedId === id) setSelectedId("");
  }

  function goToday() {
    setCursor(today);
  }

  function shift() {
    if (view === "dia") setCursor(addDays(cursor, -1));
    else if (view === "semana") setCursor(addDays(weekStart, -7));
    else setCursor(addMonths(monthStart, -1));
  }

  function shiftNext() {
    if (view === "dia") setCursor(addDays(cursor, 1));
    else if (view === "semana") setCursor(addDays(weekStart, 7));
    else setCursor(addMonths(monthStart, 1));
  }

  const heading =
    view === "dia"
      ? weekdayLong(cursor)
      : view === "semana"
        ? `Semana del ${weekdayLabel(weekStart)}`
        : monthLabel(cursor);

  return (
    <AppShell
      title="Contenido"
      subtitle="Calendario · briefs · Daniela (Growth)"
    >
      <p className="os-page-intro mb-4 max-w-3xl text-sm leading-6 text-[#4d5c55]">
        Ustedes filman. Daniela propone la semana. El equipo ve el mismo
        tablero: idea, aprobado, grabado, publicado. Un CTA de WhatsApp por
        semana. Elija ver un día, la semana o el mes.{" "}
        <Link href="/inteligencia?e=growth" className="font-medium text-[#1f6b45] underline">
          Preguntas sueltas: Inteligencia → Lic. Daniela Ríos
        </Link>
        .
      </p>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex rounded-xl border border-[#d8d2c4] bg-white p-1">
          {(
            [
              ["dia", "Día"],
              ["semana", "Semana"],
              ["mes", "Mes"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
                view === id
                  ? "bg-[#0f2a1f] text-white"
                  : "text-[#4d5c55] hover:bg-[#f7f4ee]"
              }`}
              onClick={() => setViewPersist(id)}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="rounded-xl border border-[#d8d2c4] bg-white px-3 py-2 text-sm"
          onClick={shift}
        >
          Anterior
        </button>
        <p className="px-2 text-sm font-semibold capitalize">{heading}</p>
        <button
          type="button"
          className="rounded-xl border border-[#d8d2c4] bg-white px-3 py-2 text-sm"
          onClick={shiftNext}
        >
          Siguiente
        </button>
        <button
          type="button"
          className="rounded-xl border border-[#d8d2c4] bg-white px-3 py-2 text-sm"
          onClick={goToday}
        >
          Hoy
        </button>
        <span className="text-xs text-[#6d7c74]">
          {visible.length} piezas · {pending} pendientes
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

      <div className="os-panel mb-6 rounded-2xl border border-[#ddd6c8] bg-white p-4">
        <WorkFold
          title="Enlace de redes · Daniela analiza"
          open={linkOpen}
          onToggle={() => setLinkOpen((v) => !v)}
        >
          <p className="os-page-intro mb-3 text-sm">
            Solo el enlace. Daniela saca sola lo que se dice (subtítulos o voz
            a texto) y les devuelve crítica + guion Genera. No transcriban.
            YouTube es el más limpio; en Instagram/TikTok usa el audio si la
            red lo suelta, si no, el texto del post.
          </p>
          <div className="flex flex-wrap gap-2">
            <input
              className={`${field} min-w-[16rem] flex-1`}
              placeholder="https://www.instagram.com/reel/… o TikTok / YouTube"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
            />
            <button
              type="button"
              disabled={analyzing || !videoUrl.trim()}
              className="rounded-xl bg-[#0f2a1f] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
              onClick={() => void analizarEnlace()}
            >
              {analyzing ? "Escuchando…" : "Analizar con Daniela"}
            </button>
          </div>
          <textarea
            className={`${field} mt-2`}
            rows={3}
            placeholder="Contexto nuestro, no el video. Ej.: esta semana hay visita en Sopó."
            value={videoNotes}
            onChange={(e) => setVideoNotes(e.target.value)}
          />
          {preview ? (
            <p className="mt-3 text-sm text-[#4d5c55]">
              {preview.spokenSource
                ? `${SPOKEN_SOURCE_LABELS[preview.spokenSource]} · ${preview.spokenChars} caracteres leídos. `
                : "No hubo audio ni subtítulos. "}
              {preview.note}
            </p>
          ) : null}
          {analysis ? (
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {analysis.saidSummary ? (
                <div className="rounded-xl border border-[#eee8dc] bg-[#fbfaf6] p-3 md:col-span-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#6d7c74]">
                    De qué habla (resumen, no el original)
                  </p>
                  <p className="mt-2 text-sm leading-6">{analysis.saidSummary}</p>
                </div>
              ) : null}
              <AnalysisList title="Audiovisual" items={analysis.audiovisual} />
              <AnalysisList title="Manera de hablar" items={analysis.speech} />
              <AnalysisList title="Lo que dice (riesgo)" items={analysis.claims} />
              <AnalysisList title="Qué sí aprovechamos" items={analysis.keep} />
              <AnalysisList title="Tendencia y retención" items={[...analysis.trends, ...analysis.retention]} />
              <AnalysisList title="Otras ideas (no clones)" items={analysis.nextIdeas} />
              <div className="rounded-xl border border-[#eee8dc] bg-[#fbfaf6] p-3 md:col-span-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-[#6d7c74]">
                  Guion nuevo · {analysis.limited ? "con poco audio; tema inferido" : "versión Genera"}
                </p>
                <p className="mt-2 font-semibold">{analysis.piece.title}</p>
                <p className="mt-1 text-sm">
                  <strong>Gancho:</strong> {analysis.piece.hook}
                </p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6">
                  {analysis.piece.script}
                </p>
                <p className="mt-2 text-xs text-[#6d7c74]">
                  Filmar: {analysis.location || analysis.piece.location} · CTA:{" "}
                  {analysis.piece.cta}
                </p>
                <button
                  type="button"
                  className="mt-3 rounded-xl border border-[#1f6b45] px-3 py-1.5 text-sm font-semibold text-[#1f6b45]"
                  onClick={addAnalysisPiece}
                >
                  Sumar esta pieza al día
                </button>
              </div>
            </div>
          ) : null}
        </WorkFold>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
        <div>
          {view === "dia" ? (
            <section className="rounded-2xl border border-[#ddd6c8] bg-white p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold tracking-wide text-[#6d7c74] uppercase">
                  {weekdayLong(cursor)}
                  {cursor === today ? " · hoy" : ""}
                </p>
                <button
                  type="button"
                  className="text-xs text-[#1f6b45] underline"
                  onClick={() => addEmpty(cursor)}
                >
                  + pieza
                </button>
              </div>
              {dayPieces.length === 0 ? (
                <p className="mt-4 text-sm text-[#8a7f70]">
                  Libre. Descanso o grabar tanda.
                </p>
              ) : (
                <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                  {dayPieces.map((p) => (
                    <li key={p.id}>
                      <PieceCard
                        piece={p}
                        selected={selectedId === p.id}
                        onSelect={() => setSelectedId(p.id)}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ) : null}

          {view === "semana" ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-7">
              {days.map((date) => {
                const items = week.filter((p) => p.date === date);
                return (
                  <section
                    key={date}
                    className={`rounded-2xl border bg-white p-3 ${
                      date === today
                        ? "border-[#1f6b45]"
                        : "border-[#ddd6c8]"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <button
                        type="button"
                        className="text-left text-xs font-semibold tracking-wide text-[#6d7c74] uppercase"
                        onClick={() => {
                          setCursor(date);
                          setViewPersist("dia");
                        }}
                      >
                        {weekdayLabel(date)}
                      </button>
                      <button
                        type="button"
                        className="text-xs text-[#1f6b45] underline"
                        onClick={() => addEmpty(date)}
                      >
                        + pieza
                      </button>
                    </div>
                    {items.length === 0 ? (
                      <p className="mt-3 text-xs text-[#8a7f70]">Libre</p>
                    ) : (
                      <ul className="mt-2 space-y-2">
                        {items.map((p) => (
                          <li key={p.id}>
                            <PieceCard
                              piece={p}
                              selected={selectedId === p.id}
                              compact
                              onSelect={() => {
                                setSelectedId(p.id);
                                setCursor(date);
                              }}
                            />
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                );
              })}
            </div>
          ) : null}

          {view === "mes" ? (
            <div className="overflow-x-auto rounded-2xl border border-[#ddd6c8] bg-white p-3">
              <div className="grid min-w-[640px] grid-cols-7 gap-px bg-[#eee8dc]">
                {WEEKDAY_NAMES.map((name) => (
                  <p
                    key={name}
                    className="bg-[#f7f4ee] px-2 py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-[#6d7c74]"
                  >
                    {name}
                  </p>
                ))}
                {grid.map((date) => {
                  const items = pieces.filter((p) => p.date === date);
                  const inMonth = date.startsWith(monthStart.slice(0, 7));
                  return (
                    <div
                      key={date}
                      className={`min-h-[7.5rem] bg-white p-1.5 text-left align-top ${
                        date === cursor ? "ring-2 ring-inset ring-[#1f6b45]" : ""
                      } ${date === today ? "bg-[#e8f6ee]" : ""} ${
                        inMonth ? "" : "bg-[#fbfaf6] text-[#b0a89c]"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <button
                          type="button"
                          className="text-xs font-semibold"
                          onClick={() => setCursor(date)}
                        >
                          {date.slice(8)}
                        </button>
                        <button
                          type="button"
                          className="text-[10px] text-[#1f6b45] underline"
                          onClick={() => addEmpty(date)}
                        >
                          +
                        </button>
                      </div>
                      <ul className="mt-1 space-y-1">
                        {items.slice(0, 3).map((p) => (
                          <li key={p.id}>
                            <button
                              type="button"
                              className={`block w-full truncate rounded px-1 py-0.5 text-left text-[10px] leading-4 ${CONTENT_STATUS_TONE[p.status]}`}
                              onClick={() => {
                                setSelectedId(p.id);
                                setCursor(date);
                              }}
                            >
                              {p.title || "Sin título"}
                            </button>
                          </li>
                        ))}
                        {items.length > 3 ? (
                          <li className="text-[10px] text-[#6d7c74]">
                            +{items.length - 3}
                          </li>
                        ) : null}
                      </ul>
                    </div>
                  );
                })}
              </div>
              <p className="mt-2 text-xs text-[#6d7c74]">
                Pulse un día para enfocarlo. El + suma una pieza. Pulse el título
                para abrir el brief.
              </p>
            </div>
          ) : null}
        </div>

        <div>
          {selected ? (
            <WorkFold
              title="Brief de la pieza"
              open={briefOpen}
              onToggle={() => setBriefOpen((v) => !v)}
            >
              <p className="mb-2 text-xs text-[#6d7c74]">
                {weekdayLong(selected.date)}
              </p>
              <label className="block text-sm">
                <span className="mb-1 block font-medium">Título</span>
                <input
                  className={field}
                  value={selected.title}
                  onChange={(e) => patchSelected({ title: e.target.value })}
                />
              </label>
              <label className="mt-3 block text-sm">
                <span className="mb-1 block font-medium">Fecha</span>
                <input
                  className={field}
                  type="date"
                  value={selected.date}
                  onChange={(e) => {
                    const date = e.target.value;
                    patchSelected({ date });
                    if (date) setCursor(date);
                  }}
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
              <label className="mt-3 block text-sm">
                <span className="mb-1 block font-medium">Caption (texto al publicar)</span>
                <textarea
                  className={field}
                  rows={3}
                  value={selected.caption}
                  onChange={(e) => patchSelected({ caption: e.target.value })}
                />
              </label>
              <label className="mt-3 block text-sm">
                <span className="mb-1 block font-medium">Primer comentario</span>
                <input
                  className={field}
                  value={selected.firstComment}
                  onChange={(e) =>
                    patchSelected({ firstComment: e.target.value })
                  }
                />
              </label>
              <label className="mt-3 block text-sm">
                <span className="mb-1 block font-medium">Planos (2 o 3)</span>
                <textarea
                  className={field}
                  rows={2}
                  placeholder="Cara 3 s · recibo tapado · tablero"
                  value={selected.shots}
                  onChange={(e) => patchSelected({ shots: e.target.value })}
                />
              </label>
              <label className="mt-2 flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={selected.subtitlesOnScreen}
                  onChange={(e) =>
                    patchSelected({ subtitlesOnScreen: e.target.checked })
                  }
                />
                Subtítulos en pantalla (se ve sin audio)
              </label>
              <label className="mt-2 flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={selected.clientOk}
                  onChange={(e) =>
                    patchSelected({ clientOk: e.target.checked })
                  }
                />
                Cliente autorizó salir en cámara
              </label>
              <label className="mt-4 block text-sm">
                <span className="mb-1 block font-medium">
                  Pedido a Daniela (esta pieza)
                </span>
                <textarea
                  className={field}
                  rows={3}
                  placeholder="Ej.: el gancho es flojo; no hables como comercial; más corto; no me gusta el CTA de WhatsApp…"
                  value={improveAsk}
                  onChange={(e) => setImproveAsk(e.target.value)}
                />
              </label>
              <button
                type="button"
                disabled={improveBusy || !improveAsk.trim()}
                className="mt-2 rounded-xl bg-[#0f2a1f] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                onClick={() => void danielaMejoraPieza()}
              >
                {improveBusy ? "Reescribiendo…" : "Daniela mejora esta pieza"}
              </button>
              {selected.status === "publicado" ? (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <label className="block text-sm col-span-2">
                    <span className="mb-1 block font-medium">Enlace publicado</span>
                    <input
                      className={field}
                      value={selected.publishedUrl}
                      onChange={(e) =>
                        patchSelected({ publishedUrl: e.target.value })
                      }
                    />
                  </label>
                  {(
                    [
                      ["views", "Vistas"],
                      ["likes", "Likes"],
                      ["comments", "Comentarios"],
                      ["conversations", "Recibos / visitas"],
                    ] as const
                  ).map(([key, label]) => (
                    <label key={key} className="block text-sm">
                      <span className="mb-1 block font-medium">{label}</span>
                      <input
                        className={field}
                        type="number"
                        value={selected[key] || ""}
                        onChange={(e) =>
                          patchSelected({
                            [key]: Number(e.target.value) || 0,
                          })
                        }
                      />
                    </label>
                  ))}
                </div>
              ) : null}
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

      <div className="os-panel mt-6 rounded-2xl border border-[#ddd6c8] bg-white p-4">
        <WorkFold
          title="Tanda de grabación (esta semana)"
          open={tandaOpen}
          onToggle={() => setTandaOpen((v) => !v)}
        >
          <p className="os-page-intro mb-3 text-sm">
            Lo aprobado o ya grabado, agrupado por lugar. Una salida, varios
            takes. Pulse la pieza para abrir el brief.
          </p>
          {batches.length === 0 ? (
            <p className="text-sm text-[#6d7c74]">
              Aprueben piezas y aparece el lote por oficina, visita o bodega.
            </p>
          ) : (
            <ul className="space-y-3">
              {batches.map(([lugar, items]) => (
                <li key={lugar}>
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#6d7c74]">
                    {lugar} · {items.length}
                  </p>
                  <ul className="mt-1 space-y-1">
                    {items.map((p) => (
                      <li key={p.id}>
                        <button
                          type="button"
                          className="w-full rounded-xl border border-[#eee8dc] bg-[#fbfaf6] px-3 py-2 text-left text-sm"
                          onClick={() => {
                            setSelectedId(p.id);
                            setCursor(p.date);
                          }}
                        >
                          <span className="font-semibold">{p.title || "Sin título"}</span>
                          <span className="ml-2 text-xs text-[#6d7c74]">
                            {CONTENT_STATUS_LABELS[p.status]} · {p.owner || "quién sale"}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </WorkFold>
      </div>

      <div className="os-panel mt-6 rounded-2xl border border-[#ddd6c8] bg-white p-4">
        <WorkFold
          title="Cómo nos fue · números de la semana"
          open={reportOpen}
          onToggle={() => setReportOpen((v) => !v)}
        >
          <p className="os-page-intro mb-3 text-sm">
            Los copian el viernes desde Instagram, TikTok o YouTube Studio.
            Daniela no entra sola a esas apps. El número que importa: recibos o
            visitas, no solo likes.
          </p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <label className="text-sm">
              <span className="mb-1 block font-medium">Seguidores al inicio</span>
              <input
                className={field}
                type="number"
                value={weekReport.followersStart || ""}
                onChange={(e) =>
                  patchReport({ followersStart: Number(e.target.value) || 0 })
                }
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium">Seguidores al cierre</span>
              <input
                className={field}
                type="number"
                value={weekReport.followersEnd || ""}
                onChange={(e) =>
                  patchReport({ followersEnd: Number(e.target.value) || 0 })
                }
              />
            </label>
            <p className="flex items-end pb-2 text-sm text-[#6d7c74] sm:col-span-2">
              Delta: {followerDelta >= 0 ? "+" : ""}
              {followerDelta}
            </p>
            <label className="text-sm sm:col-span-2">
              <span className="mb-1 block font-medium">Video top (título)</span>
              <input
                className={field}
                value={weekReport.topTitle}
                onChange={(e) => patchReport({ topTitle: e.target.value })}
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium">Vistas del top</span>
              <input
                className={field}
                type="number"
                value={weekReport.topViews || ""}
                onChange={(e) =>
                  patchReport({ topViews: Number(e.target.value) || 0 })
                }
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium">Likes</span>
              <input
                className={field}
                type="number"
                value={weekReport.topLikes || ""}
                onChange={(e) =>
                  patchReport({ topLikes: Number(e.target.value) || 0 })
                }
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium">Comentarios</span>
              <input
                className={field}
                type="number"
                value={weekReport.topComments || ""}
                onChange={(e) =>
                  patchReport({ topComments: Number(e.target.value) || 0 })
                }
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium">Recibos / visitas</span>
              <input
                className={field}
                type="number"
                value={weekReport.conversations || ""}
                onChange={(e) =>
                  patchReport({ conversations: Number(e.target.value) || 0 })
                }
              />
            </label>
            <label className="text-sm sm:col-span-2 lg:col-span-4">
              <span className="mb-1 block font-medium">Nota del equipo</span>
              <textarea
                className={field}
                rows={2}
                placeholder="El de la lluvia se compartió. El de Ley 1715 no."
                value={weekReport.note}
                onChange={(e) => patchReport({ note: e.target.value })}
              />
            </label>
          </div>
          <button
            type="button"
            disabled={reportBusy}
            className="mt-3 rounded-xl bg-[#0f2a1f] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            onClick={() => void danielaLeeSemana()}
          >
            {reportBusy ? "Leyendo…" : "Daniela lee la semana"}
          </button>
          {weekReport.analysis ? (
            <pre className="mt-3 whitespace-pre-wrap rounded-xl bg-[#fbfaf6] p-3 text-sm leading-6 text-[#244a38]">
              {weekReport.analysis}
            </pre>
          ) : null}
        </WorkFold>
      </div>

      <div className="os-panel mt-6 rounded-2xl border border-[#ddd6c8] bg-white p-4">
        <WorkFold
          title="Banco que ya funciona"
          open={bankOpen}
          onToggle={() => setBankOpen((v) => !v)}
        >
          <p className="os-page-intro mb-3 text-sm">
            Objeciones y momentos reales de venta. Daniela rota esto. Si ya
            están en visita, sumen la pieza al día enfocado.
          </p>
          <ul className="grid gap-2 sm:grid-cols-2">
            {CONTENT_BANK.map((idea) => (
              <li
                key={idea.id}
                className="rounded-xl border border-[#eee8dc] bg-[#fbfaf6] px-3 py-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold leading-5">{idea.title}</p>
                  <button
                    type="button"
                    className="shrink-0 text-xs text-[#1f6b45] underline"
                    onClick={() => addFromBank(idea.id)}
                  >
                    Sumar
                  </button>
                </div>
                <p className="mt-1 text-[11px] text-[#6d7c74]">
                  {CONTENT_FORMAT_LABELS[idea.format]} ·{" "}
                  {CONTENT_OBJECTIVE_LABELS[idea.objective]}
                </p>
                <p className="mt-1 text-xs leading-5 text-[#4d5c55]">{idea.why}</p>
              </li>
            ))}
          </ul>
        </WorkFold>
      </div>
    </AppShell>
  );
}
