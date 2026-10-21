"use client";

import { useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
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
  type TechnicalReport,
} from "@/lib/technical-reports";
import { markMaintenanceDone } from "@/lib/om";

const KINDS = Object.keys(REPORT_KIND_LABELS) as ReportKind[];
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
    recientes: false,
    preview: false,
  });
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

  return (
    <AppShell
      title="Informes técnicos"
      subtitle="Inspección · O&M · mesa redonda"
    >
      <p className="os-page-intro mb-5 max-w-3xl text-sm leading-6 text-[#4d5c55] print:hidden">
        Cuatro tipos de informe con checklist de campo, fotos y redacción de la
        mesa. El ingeniero revisa cada capítulo. PDF o enlace limpio para el
        cliente. Quedan en Archivo.
      </p>
      <a
        href="/informes/dictamen"
        className="os-panel print:hidden mb-5 flex items-start justify-between gap-3 rounded-2xl border border-[#1f6b45]/30 bg-[#e8f6ee] px-4 py-3"
      >
        <span>
          <span className="block text-sm font-semibold text-[#0f2a1f]">
            Dictamen fotográfico RETIE / NTC 2050
          </span>
          <span className="os-page-intro mt-0.5 block text-[12px] leading-5 text-[#4d5c55]">
            Herramienta aparte: una foto, no conformidad propuesta con articulado.
            No sustituye al organismo de inspección.
          </span>
        </span>
        <span className="shrink-0 text-sm font-semibold text-[#1f6b45]">
          Abrir →
        </span>
      </a>

      {flash ? (
        <p className="mb-3 rounded-xl bg-[#e8f6ee] px-4 py-2 text-sm text-[#1f6b45] print:hidden">
          {flash}
        </p>
      ) : null}
      {error ? (
        <p className="mb-3 rounded-xl bg-[#fde8e8] px-4 py-2 text-sm text-[#9b2c2c] print:hidden">
          {error}
        </p>
      ) : null}
      {offline ? (
        <p className="mb-3 text-xs text-[#8a6b2a] print:hidden">
          Modo demo: configure OPENAI_API_KEY para redacción en vivo.
        </p>
      ) : null}

      <div className="print:hidden mb-4 flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded-xl bg-[#0f2a1f] px-4 py-2.5 text-sm font-semibold text-white"
          onClick={() => {
            setReport(emptyReport(report.kind));
            setFlash("Nuevo informe en blanco.");
          }}
        >
          Nuevo informe
        </button>
        <button
          type="button"
          className="rounded-xl border border-[#d8d2c4] bg-white px-4 py-2.5 text-sm font-semibold"
          onClick={saveAll}
        >
          Guardar en Archivo
        </button>
        <button
          type="button"
          disabled={drafting}
          className="rounded-xl bg-[#d4b46a] px-4 py-2.5 text-sm font-semibold text-[#12241c] disabled:opacity-50"
          onClick={() => void redactar()}
        >
          {drafting ? "Redactando…" : "Redactar con mesa redonda"}
        </button>
        <button
          type="button"
          className="rounded-xl border border-[#1f6b45] px-4 py-2.5 text-sm font-semibold text-[#1f6b45]"
          onClick={publish}
        >
          Publicar
        </button>
        <button
          type="button"
          className="rounded-xl border border-[#d8d2c4] bg-white px-4 py-2.5 text-sm font-semibold"
          onClick={() => window.print()}
        >
          Imprimir / PDF
        </button>
        <button
          type="button"
          disabled={sharing}
          className="rounded-xl border border-[#1f6b45] px-4 py-2.5 text-sm font-semibold text-[#1f6b45] disabled:opacity-50"
          onClick={() => void shareLink()}
        >
          {sharing ? "Publicando…" : "Compartir enlace"}
        </button>
        {preMantenimiento ? (
          <a
            href="/cotizador?nueva=1"
            className="rounded-xl bg-[#1f6b45] px-4 py-2.5 text-sm font-semibold text-white"
          >
            Cotizar mantenimiento
          </a>
        ) : null}
      </div>

      <div className="print:hidden mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {KINDS.map((kind) => {
          const on = report.kind === kind;
          return (
            <button
              key={kind}
              type="button"
              onClick={() => setReport((prev) => retargetKind(prev, kind))}
              className={`os-kind rounded-2xl border px-4 py-3 text-left ${
                on
                  ? "border-[#1f6b45] bg-[#e8f6ee]"
                  : "border-[#ddd6c8] bg-white"
              }`}
            >
              <p className="text-sm font-semibold">{REPORT_KIND_LABELS[kind]}</p>
              <p className="os-page-intro mt-1 text-[11px] leading-4 text-[#6d7c74]">
                {REPORT_KIND_HINTS[kind]}
              </p>
            </button>
          );
        })}
      </div>

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
                        className={`rounded-lg px-2 py-1 text-[11px] font-semibold ${
                          item.status === opt.id
                            ? "bg-[#1f6b45] text-white"
                            : "bg-[#f7f4ee] text-[#4d5c55]"
                        }`}
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
                  className="rounded-xl border border-[#eee8dc] p-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold">{ch.title}</p>
                    <label className="flex items-center gap-1 text-[11px]">
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
              title="Recientes en este equipo"
              open={folds.recientes}
              onToggle={() =>
                setFolds((s) => ({ ...s, recientes: !s.recientes }))
              }
            >
            {saved.length === 0 ? (
              <p className="mt-2 text-sm text-[#6d7c74]">
                Aún no hay informes guardados.
              </p>
            ) : (
              <ul className="mt-2 space-y-2 text-sm">
                {saved.slice(0, 8).map((row) => (
                  <li
                    key={row.id}
                    className="flex items-center justify-between gap-2"
                  >
                    <button
                      type="button"
                      className="text-left font-medium text-[#1f6b45] underline"
                      onClick={() => setReport(row.report)}
                    >
                      {REPORT_KIND_LABELS[row.report.kind]} ·{" "}
                      {row.report.plant.clientName || "Sin cliente"}
                    </button>
                    <button
                      type="button"
                      className="text-xs text-[#9b2c2c] underline"
                      onClick={() => {
                        deleteSavedReport(row.id);
                        void fetch(`/api/archivo?report=${row.id}`, {
                          method: "DELETE",
                        });
                        setSaved(loadSavedReports());
                      }}
                    >
                      Quitar
                    </button>
                  </li>
                ))}
              </ul>
            )}
            </WorkFold>
          </section>
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
    </AppShell>
  );
}
