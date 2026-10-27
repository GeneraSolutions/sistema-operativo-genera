"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  Camera,
  Check,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  FileText,
  History,
  Link2,
  Plus,
  Printer,
  Save,
  Sparkles,
  Stethoscope,
  Sun,
  Trash2,
  Wrench,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import type { OsTone } from "@/components/OsKpi";
import { WorkFold } from "@/components/WorkFold";
import { ReportDocument } from "@/components/informes/ReportDocument";
import { loadSpecialistManuals } from "@/lib/specialist-manuals";
import { compressVisitPhoto } from "@/lib/site-visit";
import {
  OPEN_OM_PLANT_KEY,
  OPEN_REPORT_KIND_KEY,
  OPEN_REPORT_KEY,
  REPORT_KIND_HINTS,
  REPORT_KIND_LABELS,
  deleteSavedReport,
  emptyReport,
  loadPlants,
  loadSavedReports,
  retargetKind,
  saveReportSnapshot,
  upsertPlant,
  type CheckStatus,
  type PlantProfile,
  type ReportKind,
  type ReportStatus,
  type TechnicalReport,
} from "@/lib/technical-reports";
import { markMaintenanceDone } from "@/lib/om";

const KINDS = Object.keys(REPORT_KIND_LABELS) as ReportKind[];

const KIND_ICONS: Record<ReportKind, LucideIcon> = {
  "inspeccion-fv": Sun,
  "inspeccion-electrica": Zap,
  "pre-mantenimiento": Stethoscope,
  "post-mantenimiento": ClipboardCheck,
};

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
const CHECK_OPTS: { id: CheckStatus; label: string }[] = [
  { id: "pendiente", label: "Pend." },
  { id: "ok", label: "OK" },
  { id: "no", label: "No" },
  { id: "na", label: "N/A" },
];

const field =
  "w-full rounded-xl border border-[#d8d2c4] bg-[#fbfaf6] px-3 py-2.5 text-sm";

export default function InformesPage() {
  const [report, setReport] = useState<TechnicalReport>(() =>
    emptyReport("inspeccion-fv")
  );
  const [folds, setFolds] = useState({
    plant: true,
    campo: true,
    checklist: false,
    fotos: false,
    capitulos: false,
    recientes: true,
    preview: false,
  });
  const [recentOpen, setRecentOpen] = useState(false);
  const recentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!recentOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!recentRef.current?.contains(e.target as Node)) setRecentOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setRecentOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [recentOpen]);
  const [plants, setPlants] = useState<PlantProfile[]>([]);
  const [saved, setSaved] = useState(() =>
    typeof window === "undefined" ? [] : loadSavedReports()
  );
  const [flash, setFlash] = useState("");
  const [error, setError] = useState("");
  const [drafting, setDrafting] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [offline, setOffline] = useState(false);
  const photoRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setPlants(loadPlants());
    const openId = sessionStorage.getItem(OPEN_REPORT_KEY);
    const plantId = sessionStorage.getItem(OPEN_OM_PLANT_KEY);
    const kind = sessionStorage.getItem(OPEN_REPORT_KIND_KEY) as
      | ReportKind
      | null;
    if (openId) {
      sessionStorage.removeItem(OPEN_REPORT_KEY);
      const row = loadSavedReports().find((r) => r.id === openId);
      if (row) setReport(row.report);
    } else if (plantId) {
      sessionStorage.removeItem(OPEN_OM_PLANT_KEY);
      sessionStorage.removeItem(OPEN_REPORT_KIND_KEY);
      const plant = loadPlants().find((p) => p.id === plantId);
      const next = emptyReport(
        kind === "pre-mantenimiento" || kind === "post-mantenimiento"
          ? kind
          : "pre-mantenimiento"
      );
      if (plant) {
        next.plant = plant;
        next.purpose =
          kind === "post-mantenimiento"
            ? `Informe post-mantenimiento de ${plant.clientName || "la planta"}.`
            : `Diagnóstico pre-mantenimiento de ${plant.clientName || "la planta"}.`;
      }
      setReport(next);
    }
    setSaved(loadSavedReports());
  }, []);

  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(""), 3600);
    return () => clearTimeout(t);
  }, [flash]);

  function removeSaved(id: string) {
    if (!confirm("¿Quitar este informe del archivo?")) return;
    deleteSavedReport(id);
    void fetch(`/api/archivo?report=${id}`, { method: "DELETE" });
    setSaved(loadSavedReports());
  }

  function patch(next: Partial<TechnicalReport>) {
    setReport((prev) => ({
      ...prev,
      ...next,
      updatedAt: new Date().toISOString(),
    }));
  }

  function patchPlant(next: Partial<PlantProfile>) {
    setReport((prev) => ({
      ...prev,
      plant: { ...prev.plant, ...next },
      updatedAt: new Date().toISOString(),
    }));
  }

  function persist(next = report) {
    const row = saveReportSnapshot({ report: next, id: next.id });
    setSaved(loadSavedReports());
    void fetch("/api/archivo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ report: row }),
    }).catch(() => undefined);
    return row;
  }

  async function redactar() {
    setDrafting(true);
    setError("");
    setFlash("");
    try {
      const res = await fetch("/api/informes/redactar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          report,
          manuals: loadSpecialistManuals(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al redactar");
      setOffline(Boolean(data.offline));
      const next: TechnicalReport = {
        ...report,
        findings: data.sintesis || report.findings,
        recommendations: data.recomendaciones || report.recommendations,
        nextSteps: data.proximosPasos || report.nextSteps,
        chapters: data.chapters ?? report.chapters,
        status: "revisado",
        updatedAt: new Date().toISOString(),
      };
      setReport(next);
      persist(next);
      setFlash(
        data.offline
          ? "Borrador local (sin clave de inteligencia). Revise y complete."
          : "La mesa redactó los capítulos. Revise, ajuste y apruebe cada uno."
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setDrafting(false);
    }
  }

  async function addPhotos(files: FileList | null) {
    if (!files?.length) return;
    const extras = await Promise.all(
      [...files].slice(0, 12).map(async (file, i) => ({
        id: crypto.randomUUID(),
        caption: `foto${report.photos.length + i + 1}`,
        dataUrl: await compressVisitPhoto(file),
      }))
    );
    setReport((prev) => ({
      ...prev,
      photos: [...prev.photos, ...extras].slice(0, 12),
    }));
  }

  function saveAll() {
    let plant = report.plant;
    if (report.kind === "post-mantenimiento" && report.visitDate) {
      plant = markMaintenanceDone(plant, report.visitDate);
      setReport((prev) => ({ ...prev, plant }));
    }
    const nextPlants = upsertPlant(plant);
    setPlants(nextPlants);
    void fetch("/api/archivo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plants: nextPlants }),
    }).catch(() => undefined);
    persist({ ...report, plant });
    setFlash(
      report.kind === "post-mantenimiento"
        ? "Informe guardado. O&M actualizó último mantenimiento y la próxima fecha."
        : "Informe guardado en Archivo y planta recordada."
    );
  }

  function publish() {
    const next: TechnicalReport = {
      ...report,
      status: "publicado",
      chapters: report.chapters.map((c) => ({ ...c, approved: true })),
      updatedAt: new Date().toISOString(),
    };
    setReport(next);
    persist(next);
    setFlash("Informe publicado. Use Imprimir / PDF o Compartir enlace.");
  }

  async function shareLink() {
    setSharing(true);
    setError("");
    try {
      const next: TechnicalReport = {
        ...report,
        status: "publicado",
        updatedAt: new Date().toISOString(),
      };
      setReport(next);
      persist(next);
      const res = await fetch("/api/informes/publicar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          data.error ||
            "No se pudo publicar el enlace. Intente de nuevo en un minuto."
        );
      }
      const url = `${window.location.origin}/informe/${next.id}`;
      await navigator.clipboard?.writeText(url);
      setFlash("Enlace copiado · abriendo vista limpia…");
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al compartir");
    } finally {
      setSharing(false);
    }
  }

  const preMantenimiento = report.kind === "pre-mantenimiento";
  const checkTotal = report.checklist.length;
  const checkAnswered = report.checklist.filter((c) => c.status !== "pendiente").length;
  const checkFails = report.checklist.filter((c) => c.status === "no").length;
  const chaptersWritten = report.chapters.filter((c) => c.body.trim()).length;
  const chaptersApproved = report.chapters.filter((c) => c.approved).length;
  const fieldDone =
    Boolean(report.plant.clientName.trim()) &&
    checkTotal > 0 &&
    checkAnswered === checkTotal;
  const draftDone = report.chapters.length > 0 && chaptersApproved === report.chapters.length;
  const published = report.status === "publicado";
  const plantHistory = saved.filter(
    (row) =>
      row.report.id !== report.id &&
      ((report.plant.id && row.report.plant.id === report.plant.id) ||
        (report.plant.clientName.trim() &&
          row.report.plant.clientName.trim().toLowerCase() ===
            report.plant.clientName.trim().toLowerCase()))
  );

  return (
    <AppShell
      title="Informes técnicos"
      subtitle="Inspección · O&M · mesa redonda"
      actions={
        <>
          <span className="os-pill os-report-status" data-tone={STATUS_TONE[report.status]}>
            {STATUS_LABEL[report.status]}
          </span>
          <div className="os-menu" ref={recentRef}>
            <button
              type="button"
              className="os-btn os-btn-ghost"
              aria-expanded={recentOpen}
              onClick={() => setRecentOpen((v) => !v)}
            >
              <History size={16} />
              Recientes
              <ChevronDown size={15} />
            </button>
            {recentOpen ? (
              <div className="os-menu-pop" role="menu">
                <button
                  type="button"
                  role="menuitem"
                  className="os-menu-item"
                  onClick={() => {
                    setRecentOpen(false);
                    setReport(emptyReport(report.kind));
                    setFlash("Nuevo informe en blanco.");
                  }}
                >
                  <Plus size={15} />
                  <span>Nuevo informe en blanco</span>
                </button>
                <p className="os-menu-label">Informes guardados</p>
                {saved.length === 0 ? (
                  <p className="os-menu-empty">Aún no hay informes guardados.</p>
                ) : (
                  saved.slice(0, 8).map((row) => (
                    <div key={row.id} className="os-menu-row">
                      <button
                        type="button"
                        role="menuitem"
                        className="os-menu-item"
                        aria-current={row.report.id === report.id ? "true" : undefined}
                        onClick={() => {
                          setRecentOpen(false);
                          setReport(row.report);
                        }}
                      >
                        <FileText size={15} />
                        <span>
                          {row.report.plant.clientName || "Sin cliente"} ·{" "}
                          {REPORT_KIND_LABELS[row.report.kind]}
                        </span>
                      </button>
                      <button
                        type="button"
                        className="os-icon-btn is-danger is-sm"
                        aria-label="Quitar informe"
                        title="Quitar"
                        onClick={() => removeSaved(row.id)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))
                )}
                <a href="/archivo" className="os-menu-foot">
                  Ver todo el archivo
                </a>
              </div>
            ) : null}
          </div>
          <button type="button" className="os-btn os-btn-primary" onClick={saveAll}>
            <Save size={16} />
            Guardar
          </button>
        </>
      }
    >
      <div className="os-kinds print:hidden" role="tablist" aria-label="Tipo de informe">
        {KINDS.map((kind) => {
          const Icon = KIND_ICONS[kind];
          return (
            <button
              key={kind}
              type="button"
              role="tab"
              aria-selected={report.kind === kind}
              onClick={() => setReport((prev) => retargetKind(prev, kind))}
              className="os-kind"
            >
              <span className="os-kind-icon">
                <Icon size={17} />
              </span>
              <span className="min-w-0">
                <span className="os-kind-title">{REPORT_KIND_LABELS[kind]}</span>
                <span className="os-kind-hint">{REPORT_KIND_HINTS[kind]}</span>
              </span>
            </button>
          );
        })}
      </div>

      <ol className="os-flow print:hidden">
        <li className="os-flow-step" data-done={fieldDone ? "true" : undefined}>
          <span className="os-flow-num">{fieldDone ? <Check size={15} /> : 1}</span>
          <div className="min-w-0 flex-1">
            <p className="os-flow-title">Levantar en campo</p>
            <p className="os-flow-hint">
              Checklist {checkAnswered} de {checkTotal}
              {checkFails ? ` · ${checkFails} con falla` : ""} · {report.photos.length} fotos
            </p>
          </div>
        </li>
        <li className="os-flow-step" data-done={draftDone ? "true" : undefined}>
          <span className="os-flow-num">{draftDone ? <Check size={15} /> : 2}</span>
          <div className="min-w-0 flex-1">
            <p className="os-flow-title">Redactar y aprobar</p>
            <p className="os-flow-hint">
              {chaptersWritten === 0
                ? "La mesa redacta con lo que se levantó"
                : `${chaptersApproved} de ${report.chapters.length} capítulos aprobados`}
            </p>
          </div>
          <button
            type="button"
            className="os-btn os-btn-gold os-btn-sm"
            disabled={drafting}
            onClick={() => void redactar()}
          >
            <Sparkles size={14} />
            {drafting ? "Redactando…" : chaptersWritten ? "Redactar de nuevo" : "Redactar"}
          </button>
        </li>
        <li className="os-flow-step" data-done={published ? "true" : undefined}>
          <span className="os-flow-num">{published ? <Check size={15} /> : 3}</span>
          <div className="min-w-0 flex-1">
            <p className="os-flow-title">Publicar y entregar</p>
            <p className="os-flow-hint">
              {published ? "Publicado · listo para el cliente" : "PDF o enlace limpio para el cliente"}
            </p>
          </div>
          <div className="os-flow-actions">
            {published ? null : (
              <button type="button" className="os-btn os-btn-ghost os-btn-sm" onClick={publish}>
                <BadgeCheck size={14} />
                Publicar
              </button>
            )}
            <button type="button" className="os-btn os-btn-ghost os-btn-sm" onClick={() => window.print()}>
              <Printer size={14} />
              PDF
            </button>
            <button
              type="button"
              className="os-btn os-btn-ghost os-btn-sm"
              disabled={sharing}
              onClick={() => void shareLink()}
            >
              <Link2 size={14} />
              {sharing ? "Publicando…" : "Enlace"}
            </button>
          </div>
        </li>
      </ol>

      {error ? (
        <div className="os-alert print:hidden" data-tone="danger">
          <AlertTriangle size={16} />
          <span>{error}</span>
        </div>
      ) : null}
      {offline ? (
        <div className="os-alert print:hidden" data-tone="warn">
          <AlertTriangle size={16} />
          <span>
            La redacción automática no está disponible en este momento. Se dejó un
            borrador base: revise y complete cada capítulo a mano.
          </span>
        </div>
      ) : null}
      {preMantenimiento ? (
        <div className="os-alert print:hidden" data-tone="info">
          <Wrench size={16} />
          <span>
            Con el diagnóstico listo, cotice el mantenimiento para este cliente.
          </span>
          <a href="/cotizador?nueva=1" className="os-btn os-btn-ghost os-btn-sm">
            Cotizar mantenimiento
          </a>
        </div>
      ) : null}

      <div className="print:hidden grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <div className="space-y-4">
          <section className="os-panel rounded-2xl border border-[#ddd6c8] bg-white p-5">
            <WorkFold
              title="Planta / cliente"
              open={folds.plant}
              onToggle={() => setFolds((s) => ({ ...s, plant: !s.plant }))}
            >
            {plants.length ? (
              <label className="mt-3 block text-sm">
                <span className="mb-1 block font-medium">Reutilizar planta</span>
                <select
                  className={field}
                  value=""
                  onChange={(e) => {
                    const plant = plants.find((p) => p.id === e.target.value);
                    if (plant) patchPlant(plant);
                  }}
                >
                  <option value="">Seleccionar…</option>
                  {plants.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.clientName || "Sin nombre"} · {p.siteName || p.city}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="text-sm">
                <span className="mb-1 block font-medium">Cliente</span>
                <input
                  className={field}
                  value={report.plant.clientName}
                  onChange={(e) => patchPlant({ clientName: e.target.value })}
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block font-medium">Sitio / predio</span>
                <input
                  className={field}
                  value={report.plant.siteName}
                  onChange={(e) => patchPlant({ siteName: e.target.value })}
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block font-medium">Ciudad</span>
                <input
                  className={field}
                  value={report.plant.city}
                  onChange={(e) => patchPlant({ city: e.target.value })}
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block font-medium">Dirección</span>
                <input
                  className={field}
                  value={report.plant.address}
                  onChange={(e) => patchPlant({ address: e.target.value })}
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block font-medium">kWp</span>
                <input
                  className={field}
                  value={report.plant.kwp}
                  onChange={(e) => patchPlant({ kwp: e.target.value })}
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block font-medium">Inversor</span>
                <input
                  className={field}
                  value={report.plant.inverter}
                  onChange={(e) => patchPlant({ inverter: e.target.value })}
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block font-medium">Año instalación</span>
                <input
                  className={field}
                  value={report.plant.yearInstalled}
                  onChange={(e) =>
                    patchPlant({ yearInstalled: e.target.value })
                  }
                />
              </label>
              <label className="flex items-end gap-2 pb-2 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={report.plant.ours}
                  onChange={(e) => patchPlant({ ours: e.target.checked })}
                />
                Planta instalada por Genera Solutions SAS
              </label>
            </div>
            <label className="mt-3 block text-sm">
              <span className="mb-1 block font-medium">Notas de planta</span>
              <textarea
                className={field}
                rows={2}
                value={report.plant.notes}
                onChange={(e) => patchPlant({ notes: e.target.value })}
              />
            </label>
            </WorkFold>
          </section>

          <section className="os-panel rounded-2xl border border-[#ddd6c8] bg-white p-5">
            <WorkFold
              title="Campo"
              open={folds.campo}
              onToggle={() => setFolds((s) => ({ ...s, campo: !s.campo }))}
            >
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm">
                <span className="mb-1 block font-medium">Inspector</span>
                <input
                  className={field}
                  value={report.inspector}
                  onChange={(e) => patch({ inspector: e.target.value })}
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block font-medium">Fecha visita</span>
                <input
                  type="date"
                  className={field}
                  value={report.visitDate}
                  onChange={(e) => patch({ visitDate: e.target.value })}
                />
              </label>
            </div>
            <label className="mt-3 block text-sm">
              <span className="mb-1 block font-medium">Objeto</span>
              <textarea
                className={field}
                rows={2}
                value={report.purpose}
                onChange={(e) => patch({ purpose: e.target.value })}
                placeholder="Por qué se hace este informe…"
              />
            </label>
            <label className="mt-3 block text-sm">
              <span className="mb-1 block font-medium">
                Hallazgos / notas de campo
              </span>
              <textarea
                className={field}
                rows={4}
                value={report.findings}
                onChange={(e) => patch({ findings: e.target.value })}
                placeholder="Lo que vio el inspector. La mesa lo usa como hecho, no lo inventa."
              />
            </label>
            <label className="mt-3 block text-sm">
              <span className="mb-1 block font-medium">
                Complemento para ingeniería
              </span>
              <textarea
                className={field}
                rows={4}
                value={report.engineeringNotes ?? ""}
                onChange={(e) => patch({ engineeringNotes: e.target.value })}
                placeholder="Norma que quiere aplicar, no conformidades que ya vio, corrección pedida al cliente, mediciones que la foto no muestra…"
              />
            </label>
            </WorkFold>
          </section>

          <section className="os-panel rounded-2xl border border-[#ddd6c8] bg-white p-5">
            <WorkFold
              title="Checklist"
              open={folds.checklist}
              onToggle={() =>
                setFolds((s) => ({ ...s, checklist: !s.checklist }))
              }
            >
            <ul className="space-y-3">
              {report.checklist.map((item) => (
                <li
                  key={item.id}
                  className="rounded-xl border border-[#eee8dc] p-3"
                >
                  <p className="text-sm font-medium">{item.label}</p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {CHECK_OPTS.map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        className="os-check-opt"
                        data-opt={opt.id}
                        aria-pressed={item.status === opt.id}
                        onClick={() =>
                          patch({
                            checklist: report.checklist.map((c) =>
                              c.id === item.id ? { ...c, status: opt.id } : c
                            ),
                          })
                        }
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  <input
                    className={`${field} mt-2`}
                    placeholder="Nota"
                    value={item.note}
                    onChange={(e) =>
                      patch({
                        checklist: report.checklist.map((c) =>
                          c.id === item.id ? { ...c, note: e.target.value } : c
                        ),
                      })
                    }
                  />
                </li>
              ))}
            </ul>
            </WorkFold>
          </section>
        </div>

        <div className="space-y-4">
          <section className="os-panel rounded-2xl border border-[#ddd6c8] bg-white p-5">
            <WorkFold
              title="Fotos"
              open={folds.fotos}
              onToggle={() => setFolds((s) => ({ ...s, fotos: !s.fotos }))}
            >
            <p className="os-page-intro text-xs text-[#6d7c74]">
              Hasta 12 evidencias. Ponga pie de foto; la mesa no ve la imagen,
              sí el texto. El dictamen fotográfico sí lee las fotos.
            </p>
            <input
              ref={photoRef}
              type="file"
              accept="image/*"
              multiple
              className="sr-only"
              onChange={(e) => {
                void addPhotos(e.target.files);
                if (photoRef.current) photoRef.current.value = "";
              }}
            />
            <button
              type="button"
              className="mt-3 inline-flex items-center rounded-xl bg-[#1f6b45] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              disabled={report.photos.length >= 12}
              onClick={() => photoRef.current?.click()}
            >
              Anexar fotos
            </button>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {report.photos.map((p, i) => (
                <div key={p.id} className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.dataUrl}
                    alt=""
                    className="h-28 w-full rounded-xl object-cover"
                  />
                  <button
                    type="button"
                    className="absolute right-1 top-1 rounded-full bg-white/90 px-2 text-xs"
                    onClick={() =>
                      patch({
                        photos: report.photos
                          .filter((x) => x.id !== p.id)
                          .map((x, idx) => ({ ...x, caption: `foto${idx + 1}` })),
                      })
                    }
                  >
                    ×
                  </button>
                  <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-[#8a6b2a]">
                    foto{i + 1}
                  </p>
                </div>
              ))}
            </div>
            </WorkFold>
          </section>

          <section className="os-panel rounded-2xl border border-[#ddd6c8] bg-white p-5">
            <WorkFold
              title="Capítulos de la mesa"
              open={folds.capitulos}
              onToggle={() =>
                setFolds((s) => ({ ...s, capitulos: !s.capitulos }))
              }
            >
            <p className="os-page-intro text-xs text-[#6d7c74]">
              Redacte con la mesa y luego edite o apruebe cada especialista.
            </p>
            <div className="mt-3 space-y-4">
              {report.chapters.map((ch) => (
                <div
                  key={ch.specialistId}
                  className="os-chapter rounded-xl border border-[#eee8dc] p-3"
                  data-approved={ch.approved ? "true" : undefined}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="flex items-center gap-1.5 text-sm font-semibold">
                      {ch.approved ? <CheckCircle2 size={15} className="text-[#1f8a55]" /> : null}
                      {ch.title}
                    </p>
                    <label className="os-chapter-approve flex items-center gap-1 text-[11px]">
                      <input
                        type="checkbox"
                        checked={ch.approved}
                        onChange={(e) =>
                          patch({
                            chapters: report.chapters.map((c) =>
                              c.specialistId === ch.specialistId
                                ? { ...c, approved: e.target.checked }
                                : c
                            ),
                          })
                        }
                      />
                      Aprobado
                    </label>
                  </div>
                  <textarea
                    className={`${field} mt-2`}
                    rows={6}
                    value={ch.body}
                    onChange={(e) =>
                      patch({
                        chapters: report.chapters.map((c) =>
                          c.specialistId === ch.specialistId
                            ? { ...c, body: e.target.value, approved: false }
                            : c
                        ),
                      })
                    }
                    placeholder="Vacío hasta redactar con la mesa…"
                  />
                </div>
              ))}
            </div>
            <label className="mt-4 block text-sm">
              <span className="mb-1 block font-medium">Recomendaciones</span>
              <textarea
                className={field}
                rows={4}
                value={report.recommendations}
                onChange={(e) => patch({ recommendations: e.target.value })}
              />
            </label>
            <label className="mt-3 block text-sm">
              <span className="mb-1 block font-medium">Próximos pasos</span>
              <textarea
                className={field}
                rows={3}
                value={report.nextSteps}
                onChange={(e) => patch({ nextSteps: e.target.value })}
              />
            </label>
            </WorkFold>
          </section>

          <section className="os-panel rounded-2xl border border-[#ddd6c8] bg-white p-5">
            <WorkFold
              title="Historial de esta planta"
              open={folds.recientes}
              onToggle={() =>
                setFolds((s) => ({ ...s, recientes: !s.recientes }))
              }
            >
            {plantHistory.length === 0 ? (
              <p className="mt-2 text-sm text-[#6d7c74]">
                {report.plant.clientName.trim()
                  ? "No hay otros informes guardados de esta planta."
                  : "Elija o escriba la planta para ver sus informes anteriores."}
              </p>
            ) : (
              <ul className="os-history">
                {plantHistory.slice(0, 8).map((row) => (
                  <li key={row.id}>
                    <button
                      type="button"
                      className="os-history-item"
                      onClick={() => setReport(row.report)}
                    >
                      <span className="os-history-date">
                        {row.report.visitDate || row.savedAt.slice(0, 10)}
                      </span>
                      <span className="os-history-name">
                        {REPORT_KIND_LABELS[row.report.kind]}
                      </span>
                      <span className="os-pill" data-tone={STATUS_TONE[row.report.status]}>
                        {STATUS_LABEL[row.report.status]}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            </WorkFold>
          </section>

          <a href="/informes/dictamen" className="os-callout print:hidden">
            <span className="os-kind-icon">
              <Camera size={17} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="os-kind-title">Dictamen fotográfico RETIE / NTC 2050</span>
              <span className="os-kind-hint">
                Una foto, no conformidad propuesta con articulado. No sustituye al
                organismo de inspección.
              </span>
            </span>
            <ArrowRight size={16} className="os-callout-go" />
          </a>
        </div>
      </div>

      <div className="hidden print:block">
        <ReportDocument report={report} />
      </div>
      <div className="os-panel print:hidden mt-8 rounded-2xl border border-[#ddd6c8] bg-white p-5">
        <WorkFold
          title="Vista previa del PDF"
          open={folds.preview}
          onToggle={() => setFolds((s) => ({ ...s, preview: !s.preview }))}
        >
          <ReportDocument report={report} />
        </WorkFold>
      </div>

      {flash ? (
        <div className="os-toast print:hidden" role="status">
          {flash}
        </div>
      ) : null}
    </AppShell>
  );
}
