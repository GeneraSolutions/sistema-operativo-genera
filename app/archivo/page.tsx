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

  function refresh() {
    setQuotes(loadSavedQuotes());
    setVisits(loadSavedVisits());
  }

  useEffect(() => {
    refresh();
    const localQuotes = loadSavedQuotes();
    const localVisits = loadSavedVisits();
    void fetch("/api/archivo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({
        quotes: localQuotes,
        visits: localVisits,
      }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) return;
        const quotes = mergeQuotes(loadSavedQuotes(), data.quotes ?? []);
        const visits = mergeVisits(loadSavedVisits(), data.visits ?? []);
        setQuotes(quotes);
        setVisits(visits);
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

  return (
    <AppShell
      title="Archivo"
      subtitle="Cotizaciones y visitas guardadas"
    >
      <p className="mb-6 max-w-3xl text-sm leading-6 text-[#4d5c55]">
        Use <strong>Guardar cotización</strong> en el cotizador y{" "}
        <strong>Guardar visita técnica</strong> en visitas. Quedan en el
        servidor: cualquier persona del equipo las ve en Archivo, desde el
        celular o el computador.
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

      <section>
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
    </AppShell>
  );
}
