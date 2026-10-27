"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Calculator,
  ClipboardCheck,
  FileText,
  Handshake,
  Plus,
  Search,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { OsKpi, type OsTone } from "@/components/OsKpi";
import { normalizeSearch } from "@/lib/os-command";
import {
  clearActiveQuote,
  deleteSavedQuote,
  loadSavedQuotes,
  mergeQuotes,
  pinActiveQuote,
  putQuoteLines,
  quoteDeskPath,
  saveQuoteSnapshot,
  isAliadoQuote,
  type SavedQuote,
} from "@/lib/saved-quotes";
import {
  OPEN_QUOTE_KEY,
  OPEN_VISIT_KEY,
  deleteSavedVisit,
  loadSavedVisits,
  mergeVisits,
  saveVisitSnapshot,
  type SavedVisit,
} from "@/lib/saved-visits";
import {
  OPEN_REPORT_KEY,
  REPORT_KIND_LABELS,
  deleteSavedReport,
  loadSavedReports,
  mergeReports,
  saveReportSnapshot,
  type ReportStatus,
  type SavedReport,
} from "@/lib/technical-reports";

type Folder = "cotizaciones" | "visitas" | "informes" | "aliados";

const STATUS_LABEL: Record<ReportStatus, string> = {
  borrador: "Borrador",
  revisado: "En revisión",
  publicado: "Publicado",
};

const STATUS_TONE: Record<ReportStatus, OsTone> = {
  borrador: "neutral",
  revisado: "warn",
  publicado: "ok",
};

const whenFmt = new Intl.DateTimeFormat("es-CO", {
  day: "numeric",
  month: "short",
});

function when(iso: string) {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? whenFmt.format(t) : iso;
}

function hay(parts: Array<string | number | undefined | null>) {
  return normalizeSearch(parts.filter(Boolean).join(" "));
}

function matches(query: string, blob: string) {
  const tokens = normalizeSearch(query).split(/\s+/).filter(Boolean);
  if (!tokens.length) return true;
  return tokens.every((t) => blob.includes(t));
}

function newQuote() {
  sessionStorage.removeItem(OPEN_QUOTE_KEY);
  clearActiveQuote();
  window.location.assign("/cotizador?nueva=1");
}

export default function ArchivoPage() {
  const router = useRouter();
  const [quotes, setQuotes] = useState<SavedQuote[]>([]);
  const [visits, setVisits] = useState<SavedVisit[]>([]);
  const [reports, setReports] = useState<SavedReport[]>([]);
  const [folder, setFolder] = useState<Folder>("cotizaciones");
  const [query, setQuery] = useState("");
  const [flash, setFlash] = useState("");

  const generaQuotes = quotes.filter((q) => !isAliadoQuote(q));
  const aliadoQuotes = quotes.filter((q) => isAliadoQuote(q));
  const showAliados = aliadoQuotes.length > 0;

  function refresh() {
    setQuotes(loadSavedQuotes());
    setVisits(loadSavedVisits());
    setReports(loadSavedReports());
  }

  useEffect(() => {
    refresh();
    const localQuotes = loadSavedQuotes();
    const localVisits = loadSavedVisits();
    const localReports = loadSavedReports();
    void fetch("/api/archivo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({
        quotes: localQuotes,
        visits: localVisits,
        reports: localReports,
      }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) return;
        const nextQuotes = mergeQuotes(loadSavedQuotes(), data.quotes ?? []);
        const nextVisits = mergeVisits(loadSavedVisits(), data.visits ?? []);
        const nextReports = mergeReports(loadSavedReports(), data.reports ?? []);
        setQuotes(nextQuotes);
        setVisits(nextVisits);
        setReports(nextReports);
        nextQuotes.forEach((q) => {
          try {
            saveQuoteSnapshot(q, { replaceLines: false });
            if (q.quoteLines?.length) putQuoteLines(q.id, q.quoteLines);
          } catch {
            /* quota */
          }
        });
        nextVisits.forEach((v) => {
          try {
            saveVisitSnapshot({
              visit: v.visit,
              linked: v.linked,
              id: v.id,
            });
          } catch {
            /* quota */
          }
        });
        nextReports.forEach((r) => {
          try {
            saveReportSnapshot({ report: r.report, id: r.id });
          } catch {
            /* quota */
          }
        });
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(""), 3200);
    return () => clearTimeout(t);
  }, [flash]);

  useEffect(() => {
    if (folder === "aliados" && !showAliados) setFolder("cotizaciones");
  }, [folder, showAliados]);

  const visibleQuotes = useMemo(
    () =>
      generaQuotes.filter((q) =>
        matches(
          query,
          hay([q.name, q.clientName, q.clientCity, q.savedByName, q.savedBy, q.kind])
        )
      ),
    [generaQuotes, query]
  );
  const visibleAliados = useMemo(
    () =>
      aliadoQuotes.filter((q) =>
        matches(
          query,
          hay([
            q.name,
            q.clientName,
            q.partnerCompanyName,
            q.savedByName,
            q.savedBy,
          ])
        )
      ),
    [aliadoQuotes, query]
  );
  const visibleVisits = useMemo(
    () =>
      visits.filter((v) =>
        matches(
          query,
          hay([v.visit.clientName, v.visit.location, v.visit.technician])
        )
      ),
    [visits, query]
  );
  const visibleReports = useMemo(
    () =>
      reports.filter((r) =>
        matches(
          query,
          hay([
            r.report.plant.clientName,
            r.report.plant.siteName,
            r.report.plant.city,
            REPORT_KIND_LABELS[r.report.kind],
            r.report.status,
          ])
        )
      ),
    [reports, query]
  );

  function openQuote(q: SavedQuote) {
    pinActiveQuote(q.id);
    sessionStorage.setItem(OPEN_QUOTE_KEY, q.id);
    window.location.assign(quoteDeskPath(q));
  }

  function openVisit(id: string) {
    sessionStorage.setItem(OPEN_VISIT_KEY, id);
    router.push("/visita-tecnica");
  }

  function openReport(id: string) {
    sessionStorage.setItem(OPEN_REPORT_KEY, id);
    router.push("/informes");
  }

  function removeQuote(id: string) {
    if (!confirm("¿Quitar esta cotización del archivo?")) return;
    deleteSavedQuote(id);
    void fetch(`/api/archivo?quote=${id}`, { method: "DELETE" });
    refresh();
    setFlash("Cotización eliminada del archivo.");
  }

  function removeVisit(id: string) {
    if (!confirm("¿Quitar esta visita del archivo?")) return;
    deleteSavedVisit(id);
    void fetch(`/api/archivo?visit=${id}`, { method: "DELETE" });
    refresh();
    setFlash("Visita eliminada del archivo.");
  }

  function removeReport(id: string) {
    if (!confirm("¿Quitar este informe del archivo?")) return;
    deleteSavedReport(id);
    void fetch(`/api/archivo?report=${id}`, { method: "DELETE" });
    refresh();
    setFlash("Informe eliminado del archivo.");
  }

  const kpiCount = showAliados ? 4 : 3;
  const searching = Boolean(query.trim());

  return (
    <AppShell
      title="Archivo"
      subtitle="Documentos guardados del equipo"
      actions={
        <button type="button" className="os-btn os-btn-primary" onClick={newQuote}>
          <Plus size={16} />
          Nueva cotización
        </button>
      }
    >
      <div className="os-kpis" data-n={kpiCount}>
        <OsKpi
          icon={Calculator}
          tone="ok"
          label="Cotizaciones"
          value={generaQuotes.length}
          hint="Planta y solo equipos"
          active={folder === "cotizaciones"}
          onClick={() => setFolder("cotizaciones")}
        />
        <OsKpi
          icon={ClipboardCheck}
          tone="info"
          label="Visitas"
          value={visits.length}
          hint="Levantamientos de campo"
          active={folder === "visitas"}
          onClick={() => setFolder("visitas")}
        />
        <OsKpi
          icon={FileText}
          tone="warn"
          label="Informes"
          value={reports.length}
          hint="Inspección y O&M"
          active={folder === "informes"}
          onClick={() => setFolder("informes")}
        />
        {showAliados ? (
          <OsKpi
            icon={Handshake}
            tone="neutral"
            label="Aliados"
            value={aliadoQuotes.length}
            hint="Canal comercial"
            active={folder === "aliados"}
            onClick={() => setFolder("aliados")}
          />
        ) : null}
      </div>

      <div className="os-board-bar">
        <label className="os-file-search">
          <Search size={16} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar cliente, cotización, visita o informe…"
            aria-label="Buscar en archivo"
          />
        </label>
      </div>

      {folder === "cotizaciones" ? (
        <FileList
          emptyTitle={
            searching
              ? "Ninguna cotización coincide"
              : "Aún no hay cotizaciones en archivo"
          }
          emptyHint={
            searching
              ? "Pruebe con el nombre del cliente o de la propuesta."
              : "Al guardar en el cotizador, el equipo las ve aquí desde cualquier equipo."
          }
          emptyAction={
            searching ? undefined : (
              <button type="button" className="os-btn os-btn-ghost os-btn-sm" onClick={newQuote}>
                <Plus size={14} />
                Nueva cotización
              </button>
            )
          }
          emptyIcon={Calculator}
        >
          {visibleQuotes.map((q) => (
            <FileRow
              key={q.id}
              icon={Calculator}
              title={q.clientName || q.name || "Sin cliente"}
              meta={[
                q.kind === "equipos" ? "Solo equipos" : q.systemKwp ? `${q.systemKwp} kWp` : "",
                q.clientCity,
                q.savedByName || q.savedBy,
                when(q.savedAt),
              ]}
              pill={
                q.kind === "equipos"
                  ? { tone: "info", text: "Solo equipos" }
                  : undefined
              }
              onOpen={() => openQuote(q)}
              onDelete={() => removeQuote(q.id)}
              deleteLabel={`Eliminar ${q.name || q.clientName || "cotización"}`}
            />
          ))}
        </FileList>
      ) : null}

      {folder === "visitas" ? (
        <FileList
          emptyTitle={searching ? "Ninguna visita coincide" : "Aún no hay visitas en archivo"}
          emptyHint={
            searching
              ? "Pruebe con el cliente, el predio o el técnico."
              : "En Visitas, pulse Guardar visita para que quede en el archivo del equipo."
          }
          emptyAction={
            searching ? undefined : (
              <a href="/visita-tecnica?nuevo=1" className="os-btn os-btn-ghost os-btn-sm">
                <Plus size={14} />
                Nueva visita
              </a>
            )
          }
          emptyIcon={ClipboardCheck}
        >
          {visibleVisits.map((v) => (
            <FileRow
              key={v.id}
              icon={ClipboardCheck}
              title={v.visit.clientName || "Sin cliente"}
              meta={[
                v.visit.location,
                v.visit.technician,
                v.visit.visitDate,
                when(v.savedAt),
              ]}
              pill={
                v.linked
                  ? { tone: "ok", text: "Vinculada" }
                  : { tone: "neutral", text: "Sin vincular" }
              }
              onOpen={() => openVisit(v.id)}
              onDelete={() => removeVisit(v.id)}
              deleteLabel={`Eliminar visita de ${v.visit.clientName || "cliente"}`}
            />
          ))}
        </FileList>
      ) : null}

      {folder === "informes" ? (
        <FileList
          emptyTitle={searching ? "Ningún informe coincide" : "Aún no hay informes en archivo"}
          emptyHint={
            searching
              ? "Pruebe con el cliente, el sitio o el tipo de informe."
              : "En Informes, pulse Guardar para dejar el documento en el archivo."
          }
          emptyAction={
            searching ? undefined : (
              <a href="/informes" className="os-btn os-btn-ghost os-btn-sm">
                <Plus size={14} />
                Nuevo informe
              </a>
            )
          }
          emptyIcon={FileText}
        >
          {visibleReports.map((r) => (
            <FileRow
              key={r.id}
              icon={FileText}
              title={r.report.plant.clientName || "Sin cliente"}
              meta={[
                REPORT_KIND_LABELS[r.report.kind],
                r.report.plant.siteName || r.report.plant.city,
                r.report.visitDate,
                when(r.savedAt),
              ]}
              pill={{
                tone: STATUS_TONE[r.report.status],
                text: STATUS_LABEL[r.report.status],
              }}
              onOpen={() => openReport(r.id)}
              onDelete={() => removeReport(r.id)}
              deleteLabel={`Eliminar informe de ${r.report.plant.clientName || "cliente"}`}
            />
          ))}
        </FileList>
      ) : null}

      {folder === "aliados" && showAliados ? (
        <FileList
          emptyTitle={searching ? "Ninguna cotización de aliado coincide" : "Aún no hay cotizaciones de aliado"}
          emptyHint="Solo Genera Solutions SAS ve este cajón."
          emptyIcon={Handshake}
        >
          {visibleAliados.map((q) => (
            <FileRow
              key={q.id}
              icon={Handshake}
              title={q.clientName || q.name || "Sin cliente"}
              meta={[
                q.partnerCompanyName || q.savedByName || q.savedBy,
                q.kind === "equipos" ? "Solo equipos" : q.systemKwp ? `${q.systemKwp} kWp` : "",
                when(q.savedAt),
              ]}
              onOpen={() => openQuote(q)}
            />
          ))}
        </FileList>
      ) : null}

      {flash ? (
        <div className="os-toast" role="status">
          {flash}
        </div>
      ) : null}
    </AppShell>
  );
}

function FileList({
  emptyTitle,
  emptyHint,
  emptyAction,
  emptyIcon: EmptyIcon,
  children,
}: {
  emptyTitle: string;
  emptyHint: string;
  emptyAction?: ReactNode;
  emptyIcon: LucideIcon;
  children: ReactNode;
}) {
  const items = Array.isArray(children) ? children : [children];
  const empty = items.filter(Boolean).length === 0;
  return (
    <section className="os-work os-file-panel">
      {empty ? (
        <div className="os-empty">
          <span className="os-empty-icon">
            <EmptyIcon size={20} />
          </span>
          <p className="os-empty-title">{emptyTitle}</p>
          <p className="os-empty-hint">{emptyHint}</p>
          {emptyAction}
        </div>
      ) : (
        <ul className="os-work-list">{items}</ul>
      )}
    </section>
  );
}

function FileRow({
  icon: Icon,
  title,
  meta,
  pill,
  onOpen,
  onDelete,
  deleteLabel,
}: {
  icon: LucideIcon;
  title: string;
  meta: Array<string | undefined>;
  pill?: { tone: OsTone; text: string };
  onOpen: () => void;
  onDelete?: () => void;
  deleteLabel?: string;
}) {
  return (
    <li className="os-file">
      <button type="button" className="os-work-row os-file-open" onClick={onOpen}>
        <span className="os-file-icon" aria-hidden>
          <Icon size={16} />
        </span>
        <span className="os-work-row-text">
          <span className="os-work-row-title">{title}</span>
          <span className="os-work-row-meta">{meta.filter(Boolean).join(" · ")}</span>
        </span>
        {pill ? (
          <span className="os-pill" data-tone={pill.tone}>
            {pill.text}
          </span>
        ) : null}
      </button>
      {onDelete ? (
        <button
          type="button"
          className="os-icon-btn is-danger is-sm"
          aria-label={deleteLabel || "Eliminar"}
          title="Eliminar"
          onClick={onDelete}
        >
          <Trash2 size={14} />
        </button>
      ) : null}
    </li>
  );
}
