"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  BarChart3,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Library,
  Link2,
  Plus,
  RefreshCw,
  Sparkles,
  X,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import {
  CONTENT_BANK,
  CONTENT_FORMAT_LABELS,
  CONTENT_NETWORK_LABELS,
  CONTENT_OBJECTIVE_LABELS,
  CONTENT_STATUS_LABELS,
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

const STATUS_TONE: Record<ContentStatus, "neutral" | "info" | "warn" | "ok"> = {
  idea: "neutral",
  aprobado: "info",
  grabado: "warn",
  publicado: "ok",
};

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
      className={`os-cnt-piece${selected ? " is-on" : ""}`}
    >
      <span className="os-pill" data-tone={STATUS_TONE[piece.status]}>
        {CONTENT_STATUS_LABELS[piece.status]}
      </span>
      <span className={`os-cnt-piece-title${compact ? " line-clamp-2" : ""}`}>
        {piece.title || "Sin título"}
      </span>
      {compact ? null : (
        <span className="os-cnt-piece-meta">
          {CONTENT_FORMAT_LABELS[piece.format]} · {CONTENT_NETWORK_LABELS[piece.network]}
        </span>
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
  const [reports, setReports] = useState<ContentWeekReport[]>([]);
  const [reportBusy, setReportBusy] = useState(false);
  const [improveAsk, setImproveAsk] = useState("");
  const [improveBusy, setImproveBusy] = useState(false);
  const [menu, setMenu] = useState(false);
  const [panel, setPanel] = useState<"link" | "numbers" | "bank" | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
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
    if (!menu) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current?.contains(e.target as Node)) return;
      setMenu(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenu(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menu]);

  useEffect(() => {
    if (!panel) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPanel(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [panel]);

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
          ? "Semana lista desde el banco. Modo demo."
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
          ? "Lectura local. Modo demo."
          : "Daniela leyó la semana. La lectura queda en Números."
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
    setPanel(null);
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
          ? "Checklist local. Modo demo."
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
    setPanel(null);
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

  function openPanel(next: "link" | "numbers" | "bank") {
    setMenu(false);
    setPanel(next);
  }

  return (
    <AppShell
      title="Contenido"
      subtitle="Ustedes filman. Daniela propone la semana."
      actions={
        <>
          <div className="os-seg" role="tablist" aria-label="Vista del calendario">
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
                role="tab"
                className="os-seg-btn"
                aria-selected={view === id}
                onClick={() => setViewPersist(id)}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="os-btn os-btn-primary"
            disabled={busy}
            onClick={() => void generarSemana(week.length === 0)}
          >
            <Sparkles size={16} />
            {busy ? "Armando…" : week.length ? "Completar días" : "Pedir semana"}
          </button>
          <div className="os-menu print:hidden" ref={menuRef}>
            <button
              type="button"
              className="os-btn os-btn-ghost"
              aria-expanded={menu}
              onClick={() => setMenu((open) => !open)}
            >
              Más
              <ChevronDown size={15} />
            </button>
            {menu ? (
              <div className="os-menu-pop" role="menu">
                <button
                  type="button"
                  role="menuitem"
                  className="os-menu-item"
                  onClick={() => openPanel("link")}
                >
                  <Link2 size={15} />
                  <span>Analizar enlace</span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="os-menu-item"
                  onClick={() => openPanel("numbers")}
                >
                  <BarChart3 size={15} />
                  <span>Números de la semana</span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="os-menu-item"
                  onClick={() => openPanel("bank")}
                >
                  <Library size={15} />
                  <span>Banco</span>
                </button>
                {week.length ? (
                  <button
                    type="button"
                    role="menuitem"
                    className="os-menu-item"
                    disabled={busy}
                    onClick={() => {
                      setMenu(false);
                      void generarSemana(true);
                    }}
                  >
                    <RefreshCw size={15} />
                    <span>Regenerar ideas</span>
                  </button>
                ) : null}
                <Link
                  href="/inteligencia?e=growth"
                  className="os-menu-foot"
                  onClick={() => setMenu(false)}
                >
                  Preguntar a Daniela
                </Link>
              </div>
            ) : null}
          </div>
        </>
      }
    >

      <div className="os-cnt-split">
        <div>
          <section className="os-work os-file-panel os-cnt-board">
            <div className="os-cnt-board-head">
              <div className="min-w-0">
                <p className="os-cnt-heading">{heading}</p>
                <p className="os-board-hint">
                  {visible.length} {visible.length === 1 ? "pieza" : "piezas"} · {pending}{" "}
                  {pending === 1 ? "pendiente" : "pendientes"}
                </p>
              </div>
              <div className="os-cnt-nav">
                <button type="button" className="os-icon-btn" aria-label="Anterior" onClick={shift}>
                  <ChevronLeft size={18} />
                </button>
                <button type="button" className="os-btn os-btn-ghost os-btn-sm" onClick={goToday}>
                  Hoy
                </button>
                <button type="button" className="os-icon-btn" aria-label="Siguiente" onClick={shiftNext}>
                  <ChevronRight size={18} />
                </button>
              </div>
              <input
                className="os-cnt-ask"
                placeholder="Pedido a Daniela (opcional): esta semana hay visita en Sopó…"
                value={ask}
                onChange={(e) => setAsk(e.target.value)}
              />
            </div>
            {note ? <p className="os-cnt-note">{note}</p> : null}

            {panel === "link" ? (
              <>
                <div className="os-drawer-backdrop" onClick={() => setPanel(null)} />
                <aside className="os-drawer" data-open="true">
                  <header className="os-drawer-head">
                    <div>
                      <p className="os-drawer-kicker">Daniela</p>
                      <h2 className="os-drawer-title">Analizar enlace</h2>
                    </div>
                    <button
                      type="button"
                      className="os-icon-btn"
                      aria-label="Cerrar"
                      onClick={() => setPanel(null)}
                    >
                      <X size={18} />
                    </button>
                  </header>
                  <div className="os-drawer-body">
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
                  </div>
                </aside>
              </>
            ) : null}

            {view === "dia" ? (
              <div className="os-cnt-daylist">
                <div className="os-cnt-daylist-bar">
                  <button
                    type="button"
                    className="os-btn os-btn-ghost os-btn-sm"
                    onClick={() => addEmpty(cursor)}
                  >
                    <Plus size={14} />
                    Pieza
                  </button>
                </div>
                {dayPieces.length === 0 ? (
                  <div className="os-empty">
                    <p className="os-empty-title">Día libre</p>
                    <p className="os-empty-hint">Descanso, o sume una pieza para grabar.</p>
                  </div>
                ) : (
                  <ul>
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
              </div>
            ) : null}

            {view === "semana" ? (
              <div className="os-cnt-week-scroll">
                <div className="os-cnt-week">
                  {days.map((date, index) => {
                    const items = week.filter((p) => p.date === date);
                    return (
                      <section
                        key={date}
                        className={`os-cnt-day${date === today ? " is-today" : ""}`}
                      >
                        <div className="os-cnt-day-head">
                          <button
                            type="button"
                            className="text-left"
                            onClick={() => {
                              setCursor(date);
                              setViewPersist("dia");
                            }}
                          >
                            <span className="os-cnt-day-name">{WEEKDAY_NAMES[index]}</span>
                            <span className="os-cnt-day-num">{Number(date.slice(8))}</span>
                          </button>
                          <button
                            type="button"
                            className="os-icon-btn is-sm"
                            aria-label={`Sumar pieza el ${weekdayLabel(date)}`}
                            onClick={() => addEmpty(date)}
                          >
                            <Plus size={14} />
                          </button>
                        </div>
                        {items.length === 0 ? (
                          <p className="os-cnt-free">Libre</p>
                        ) : (
                          items.map((p) => (
                            <PieceCard
                              key={p.id}
                              piece={p}
                              selected={selectedId === p.id}
                              compact
                              onSelect={() => {
                                setSelectedId(p.id);
                                setCursor(date);
                              }}
                            />
                          ))
                        )}
                      </section>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {view === "mes" ? (
              <div className="os-cnt-month-scroll">
                <div className="os-cnt-month-names">
                  {WEEKDAY_NAMES.map((name) => (
                    <span key={name}>{name}</span>
                  ))}
                </div>
                <div className="os-cnt-month">
                  {grid.map((date) => {
                    const items = pieces.filter((p) => p.date === date);
                    const inMonth = date.startsWith(monthStart.slice(0, 7));
                    return (
                      <div
                        key={date}
                        className={`os-cnt-cell${date === today ? " is-today" : ""}${
                          date === cursor ? " is-on" : ""
                        }${inMonth ? "" : " is-out"}`}
                      >
                        <div className="os-cnt-cell-head">
                          <button type="button" onClick={() => setCursor(date)}>
                            {Number(date.slice(8))}
                          </button>
                          <button
                            type="button"
                            className="os-icon-btn is-sm"
                            aria-label={`Sumar pieza el ${weekdayLabel(date)}`}
                            onClick={() => addEmpty(date)}
                          >
                            <Plus size={12} />
                          </button>
                        </div>
                        <ul>
                          {items.slice(0, 3).map((p) => (
                            <li key={p.id}>
                              <button
                                type="button"
                                className="os-cnt-chip"
                                data-tone={STATUS_TONE[p.status]}
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
                            <li className="os-cnt-more">+{items.length - 3}</li>
                          ) : null}
                        </ul>
                      </div>
                    );
                  })}
                </div>
                <p className="os-board-hint os-cnt-month-hint">
                  Pulse un día para enfocarlo. El + suma una pieza. Pulse el título para abrir el brief.
                </p>
              </div>
            ) : null}
          </section>

          {batches.length > 0 ? (
            <section className="os-work os-file-panel os-cnt-tanda">
              <p className="os-cnt-tanda-kicker">Tanda de grabación</p>
              <div className="os-cnt-batches">
                {batches.map(([lugar, items]) => (
                  <div key={lugar}>
                    <p className="os-cnt-batch-place">
                      {lugar} · {items.length}
                    </p>
                    {items.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setSelectedId(p.id);
                          setCursor(p.date);
                        }}
                      >
                        {p.title || "Sin título"}
                        <span>
                          {CONTENT_STATUS_LABELS[p.status]}
                          {p.owner ? ` · ${p.owner}` : ""}
                        </span>
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </div>

        <aside
          className="os-drawer os-cnt-pane"
          data-open={selected ? "true" : "false"}
        >
          <div className="os-cnt-pane-empty">
            <p className="os-empty-title">El brief aparece aquí</p>
            <p className="os-empty-hint">
              Pulse una pieza o pida la semana a Daniela.
            </p>
          </div>
          {selected ? (
            <>
              <header className="os-drawer-head">
                <div className="min-w-0">
                  <p className="os-drawer-kicker">{weekdayLong(selected.date)}</p>
                  <h2 className="os-drawer-title">{selected.title || "Sin título"}</h2>
                  <span className="os-pill" data-tone={STATUS_TONE[selected.status]}>
                    {CONTENT_STATUS_LABELS[selected.status]}
                  </span>
                </div>
                <button
                  type="button"
                  className="os-icon-btn"
                  aria-label="Cerrar brief"
                  onClick={() => setSelectedId("")}
                >
                  <X size={18} />
                </button>
              </header>
              <div className="os-drawer-actions">
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
                    className={`os-btn os-btn-sm ${
                      selected.status === status ? "os-btn-primary" : "os-btn-ghost"
                    }`}
                    onClick={() => patchSelected({ status })}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="os-drawer-body">
              <label className="os-cnt-field">
                <span>Título</span>
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
              </div>
              <footer className="os-drawer-foot">
                <button
                  type="button"
                  className="os-btn os-btn-ghost is-danger"
                  onClick={() => remove(selected.id)}
                >
                  Quitar
                </button>
                <button
                  type="button"
                  className="os-btn os-btn-ghost"
                  onClick={() => setSelectedId("")}
                >
                  Cerrar
                </button>
              </footer>
            </>
          ) : null}
        </aside>
        {selected ? (
          <div className="os-drawer-backdrop" onClick={() => setSelectedId("")} />
        ) : null}
      </div>

      {panel === "numbers" ? (
        <>
          <div className="os-drawer-backdrop" onClick={() => setPanel(null)} />
          <aside className="os-drawer" data-open="true">
            <header className="os-drawer-head">
              <div>
                <p className="os-drawer-kicker">{heading}</p>
                <h2 className="os-drawer-title">Números de la semana</h2>
              </div>
              <button
                type="button"
                className="os-icon-btn"
                aria-label="Cerrar"
                onClick={() => setPanel(null)}
              >
                <X size={18} />
              </button>
            </header>
            <div className="os-drawer-body">
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
            className="os-btn os-btn-primary mt-3"
            onClick={() => void danielaLeeSemana()}
          >
            {reportBusy ? "Leyendo…" : "Daniela lee la semana"}
          </button>
          {weekReport.analysis ? (
            <pre className="mt-3 whitespace-pre-wrap rounded-xl bg-[#fbfaf6] p-3 text-sm leading-6 text-[#244a38]">
              {weekReport.analysis}
            </pre>
          ) : null}
            </div>
          </aside>
        </>
      ) : null}

      {panel === "bank" ? (
        <>
          <div className="os-drawer-backdrop" onClick={() => setPanel(null)} />
          <aside className="os-drawer" data-open="true">
            <header className="os-drawer-head">
              <div>
                <p className="os-drawer-kicker">Ideas que ya funcionan</p>
                <h2 className="os-drawer-title">Banco</h2>
              </div>
              <button
                type="button"
                className="os-icon-btn"
                aria-label="Cerrar"
                onClick={() => setPanel(null)}
              >
                <X size={18} />
              </button>
            </header>
            <div className="os-drawer-body">
          <p className="os-page-intro mb-3 text-sm">
            Objeciones y momentos reales de venta. Daniela rota esto. Si ya
            están en visita, sumen la pieza al día enfocado.
          </p>
          <ul className="os-cnt-bank">
            {CONTENT_BANK.map((idea) => (
              <li key={idea.id}>
                <div className="os-cnt-bank-top">
                  <p className="font-semibold leading-5">{idea.title}</p>
                  <button
                    type="button"
                    className="os-btn os-btn-ghost os-btn-sm"
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
            </div>
          </aside>
        </>
      ) : null}

      {flash ? (
        <div className="os-toast" role="status">
          {flash}
        </div>
      ) : null}
    </AppShell>
  );
}
