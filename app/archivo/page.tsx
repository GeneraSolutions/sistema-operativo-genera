"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import {
  clearActiveQuote,
  deleteSavedQuote,
  loadSavedQuotes,
  mergeQuotes,
  pinActiveQuote,
  putQuoteLines,
  saveQuoteSnapshot,
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
  type SavedReport,
} from "@/lib/technical-reports";

function when(iso: string) {
  try {
    return new Date(iso).toLocaleString("es-CO", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

export default function ArchivoPage() {
  const router = useRouter();
  const [quotes, setQuotes] = useState<SavedQuote[]>([]);
  const [visits, setVisits] = useState<SavedVisit[]>([]);
  const [reports, setReports] = useState<SavedReport[]>([]);

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
        const quotes = mergeQuotes(loadSavedQuotes(), data.quotes ?? []);
        const visits = mergeVisits(loadSavedVisits(), data.visits ?? []);
        const reports = mergeReports(loadSavedReports(), data.reports ?? []);
        setQuotes(quotes);
        setVisits(visits);
        setReports(reports);
        quotes.forEach((q) => {
          try {
            saveQuoteSnapshot(q, { replaceLines: false });
            if (q.quoteLines?.length) putQuoteLines(q.id, q.quoteLines);
          } catch {
            /* quota */
          }
        });
        visits.forEach((v) => {
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
        reports.forEach((r) => {
          try {
            saveReportSnapshot({ report: r.report, id: r.id });
          } catch {
            /* quota */
          }
        });
      })
      .catch(() => undefined);
  }, []);

  function openQuote(id: string) {
    pinActiveQuote(id);
    sessionStorage.setItem(OPEN_QUOTE_KEY, id);
    window.location.assign(`/cotizador?quote=${encodeURIComponent(id)}`);
  }

  function openVisit(id: string) {
    sessionStorage.setItem(OPEN_VISIT_KEY, id);
    router.push("/visita-tecnica");
  }

  function openReport(id: string) {
    sessionStorage.setItem(OPEN_REPORT_KEY, id);
    router.push("/informes");
  }

  return (
    <AppShell
      title="Archivo"
      subtitle="Cotizaciones, visitas e informes"
    >
      <p className="mb-6 max-w-3xl text-sm leading-6 text-[#4d5c55]">
        Use <strong>Guardar</strong> en cotizador, visitas e informes. Quedan
        en el servidor: cualquier persona del equipo las ve en Archivo, desde
        el celular o el computador.
      </p>

      <section className="mb-8">
        <div className="mb-3 flex items-end justify-between gap-3">
          <h2 className="text-lg font-semibold text-[#0f2a1f]">
            Cotizaciones
          </h2>
          <a
            href="/cotizador?nueva=1"
            onClick={() => {
              sessionStorage.removeItem(OPEN_QUOTE_KEY);
              clearActiveQuote();
            }}
            className="text-sm font-semibold text-[#1f6b45] underline"
          >
            Nueva cotización
          </a>
        </div>
        {quotes.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-[#ddd6c8] bg-white px-4 py-8 text-sm text-[#6d7c74]">
            Aún no hay cotizaciones guardadas.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-[#ddd6c8] bg-white">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#f7f4ee] text-xs uppercase tracking-wide text-[#6d7c74]">
                <tr>
                  <th className="px-4 py-3">Nombre</th>
                  <th className="px-4 py-3">Cliente</th>
                  <th className="px-4 py-3">Ciudad</th>
                  <th className="px-4 py-3">Potencia</th>
                  <th className="px-4 py-3">Registró</th>
                  <th className="px-4 py-3">Guardada</th>
                  <th className="px-4 py-3">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {quotes.map((q) => (
                  <tr key={q.id} className="border-t border-[#eee8dc]">
                    <td className="px-4 py-3 font-medium">{q.name}</td>
                    <td className="px-4 py-3">{q.clientName}</td>
                    <td className="px-4 py-3">{q.clientCity}</td>
                    <td className="px-4 py-3">{q.systemKwp} kWp</td>
                    <td className="px-4 py-3">{q.savedByName || q.savedBy || "—"}</td>
                    <td className="px-4 py-3 text-[#6d7c74]">{when(q.savedAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-3">
                        <button
                          type="button"
                          className="text-xs font-semibold text-[#1f6b45] underline"
                          onClick={() => openQuote(q.id)}
                        >
                          Abrir
                        </button>
                        <button
                          type="button"
                          className="text-xs font-semibold text-[#9b2c2c] underline"
                          onClick={() => {
                            if (!confirm("¿Quitar esta cotización del archivo?"))
                              return;
                            deleteSavedQuote(q.id);
                            void fetch(`/api/archivo?quote=${q.id}`, {
                              method: "DELETE",
                            });
                            refresh();
                          }}
                        >
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mb-8">
        <div className="mb-3 flex items-end justify-between gap-3">
          <h2 className="text-lg font-semibold text-[#0f2a1f]">
            Visitas técnicas
          </h2>
          <a
            href="/visita-tecnica"
            className="text-sm font-semibold text-[#1f6b45] underline"
          >
            Nueva visita
          </a>
        </div>
        {visits.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-[#ddd6c8] bg-white px-4 py-8 text-sm text-[#6d7c74]">
            Aún no hay visitas guardadas. En Visitas pulse Guardar visita
            técnica.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-[#ddd6c8] bg-white">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#f7f4ee] text-xs uppercase tracking-wide text-[#6d7c74]">
                <tr>
                  <th className="px-4 py-3">Cliente</th>
                  <th className="px-4 py-3">Lugar</th>
                  <th className="px-4 py-3">Técnico</th>
                  <th className="px-4 py-3">Fecha visita</th>
                  <th className="px-4 py-3">Guardada</th>
                  <th className="px-4 py-3">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {visits.map((v) => (
                  <tr key={v.id} className="border-t border-[#eee8dc]">
                    <td className="px-4 py-3 font-medium">
                      {v.visit.clientName || "Sin nombre"}
                    </td>
                    <td className="px-4 py-3">{v.visit.location || "—"}</td>
                    <td className="px-4 py-3">{v.visit.technician || "—"}</td>
                    <td className="px-4 py-3">{v.visit.visitDate}</td>
                    <td className="px-4 py-3 text-[#6d7c74]">{when(v.savedAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-3">
                        <button
                          type="button"
                          className="text-xs font-semibold text-[#1f6b45] underline"
                          onClick={() => openVisit(v.id)}
                        >
                          Abrir
                        </button>
                        <button
                          type="button"
                          className="text-xs font-semibold text-[#9b2c2c] underline"
                          onClick={() => {
                            if (!confirm("¿Quitar esta visita del archivo?"))
                              return;
                            deleteSavedVisit(v.id);
                            void fetch(`/api/archivo?visit=${v.id}`, {
                              method: "DELETE",
                            });
                            refresh();
                          }}
                        >
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <div className="mb-3 flex items-end justify-between gap-3">
          <h2 className="text-lg font-semibold text-[#0f2a1f]">
            Informes técnicos
          </h2>
          <a
            href="/informes"
            className="text-sm font-semibold text-[#1f6b45] underline"
          >
            Nuevo informe
          </a>
        </div>
        {reports.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-[#ddd6c8] bg-white px-4 py-8 text-sm text-[#6d7c74]">
            Aún no hay informes. En Informes pulse Guardar en Archivo.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-[#ddd6c8] bg-white">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#f7f4ee] text-xs uppercase tracking-wide text-[#6d7c74]">
                <tr>
                  <th className="px-4 py-3">Tipo</th>
                  <th className="px-4 py-3">Cliente</th>
                  <th className="px-4 py-3">Sitio</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3">Fecha visita</th>
                  <th className="px-4 py-3">Guardada</th>
                  <th className="px-4 py-3">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((r) => (
                  <tr key={r.id} className="border-t border-[#eee8dc]">
                    <td className="px-4 py-3 font-medium">
                      {REPORT_KIND_LABELS[r.report.kind]}
                    </td>
                    <td className="px-4 py-3">
                      {r.report.plant.clientName || "Sin nombre"}
                    </td>
                    <td className="px-4 py-3">
                      {r.report.plant.siteName || r.report.plant.city || "—"}
                    </td>
                    <td className="px-4 py-3">{r.report.status}</td>
                    <td className="px-4 py-3">{r.report.visitDate}</td>
                    <td className="px-4 py-3 text-[#6d7c74]">
                      {when(r.savedAt)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-3">
                        <button
                          type="button"
                          className="text-xs font-semibold text-[#1f6b45] underline"
                          onClick={() => openReport(r.id)}
                        >
                          Abrir
                        </button>
                        <button
                          type="button"
                          className="text-xs font-semibold text-[#9b2c2c] underline"
                          onClick={() => {
                            if (!confirm("¿Quitar este informe del archivo?"))
                              return;
                            deleteSavedReport(r.id);
                            void fetch(`/api/archivo?report=${r.id}`, {
                              method: "DELETE",
                            });
                            refresh();
                          }}
                        >
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </AppShell>
  );
}
