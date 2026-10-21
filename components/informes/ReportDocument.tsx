"use client";

import { BrandLogo } from "@/components/BrandLogo";
import {
  REPORT_KIND_LABELS,
  checklistSummary,
  type TechnicalReport,
} from "@/lib/technical-reports";

const STATUS: Record<string, string> = {
  pendiente: "Pendiente",
  ok: "Conforme",
  no: "No conforme",
  na: "No aplica",
};

export function ReportDocument({ report }: { report: TechnicalReport }) {
  const sum = checklistSummary(report.checklist);
  return (
    <article className="informe-print mx-auto max-w-3xl bg-white px-6 py-8 text-[#12241c]">
      <header className="flex items-start justify-between gap-4 border-b border-[#eee8dc] pb-4">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.22em] text-[#8a6b2a] uppercase">
            Genera Solutions SAS · Informe técnico
          </p>
          <h1 className="mt-1 text-2xl font-semibold">
            {REPORT_KIND_LABELS[report.kind]}
          </h1>
          <p className="mt-1 text-sm text-[#4d5c55]">
            {report.plant.clientName || "Cliente"} ·{" "}
            {report.plant.siteName || report.plant.city || "Sitio"} ·{" "}
            {report.visitDate}
          </p>
        </div>
        <BrandLogo className="h-12 w-auto" />
      </header>

      <section className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
        <p>
          <strong>Inspector:</strong> {report.inspector || "—"}
        </p>
        <p>
          <strong>Estado:</strong> {report.status}
        </p>
        <p>
          <strong>Potencia:</strong> {report.plant.kwp || "—"} kWp
        </p>
        <p>
          <strong>Inversor:</strong> {report.plant.inverter || "—"}
        </p>
        <p className="sm:col-span-2">
          <strong>Dirección:</strong> {report.plant.address || "—"},{" "}
          {report.plant.city || ""}
        </p>
        <p className="sm:col-span-2">
          <strong>Origen de la planta:</strong>{" "}
          {report.plant.ours
            ? "Instalación Genera Solutions SAS"
            : "Tercero / no Genera Solutions SAS"}
        </p>
      </section>

      {report.purpose ? (
        <section className="mt-6">
          <h2 className="text-sm font-semibold tracking-wide text-[#1f6b45] uppercase">
            Objeto
          </h2>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6">
            {report.purpose}
          </p>
        </section>
      ) : null}

      {report.findings ? (
        <section className="mt-6">
          <h2 className="text-sm font-semibold tracking-wide text-[#1f6b45] uppercase">
            Síntesis
          </h2>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6">
            {report.findings}
          </p>
        </section>
      ) : null}

      {report.engineeringNotes ? (
        <section className="mt-6">
          <h2 className="text-sm font-semibold tracking-wide text-[#1f6b45] uppercase">
            Complemento para ingeniería
          </h2>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6">
            {report.engineeringNotes}
          </p>
        </section>
      ) : null}

      <section className="mt-6">
        <h2 className="text-sm font-semibold tracking-wide text-[#1f6b45] uppercase">
          Checklist de campo
        </h2>
        <p className="mt-1 text-xs text-[#6d7c74]">
          {sum.ok} conformes · {sum.no} no conformes · {sum.pending} pendientes ·{" "}
          {sum.na} N/A
        </p>
        <ul className="mt-2 space-y-1 text-sm">
          {report.checklist.map((item) => (
            <li key={item.id}>
              <strong>{STATUS[item.status]}.</strong> {item.label}
              {item.note ? ` — ${item.note}` : ""}
            </li>
          ))}
        </ul>
      </section>

      {report.chapters.some((c) => c.body.trim()) ? (
        <section className="mt-6 space-y-5">
          <h2 className="text-sm font-semibold tracking-wide text-[#1f6b45] uppercase">
            Criterio de la mesa técnica
          </h2>
          {report.chapters
            .filter((c) => c.body.trim())
            .map((ch) => (
              <div key={ch.specialistId}>
                <h3 className="font-semibold">
                  {ch.title}
                  {ch.approved ? " · revisado" : ""}
                </h3>
                <p className="mt-1 whitespace-pre-wrap text-sm leading-6">
                  {ch.body}
                </p>
              </div>
            ))}
        </section>
      ) : null}

      {report.recommendations ? (
        <section className="mt-6">
          <h2 className="text-sm font-semibold tracking-wide text-[#1f6b45] uppercase">
            Recomendaciones
          </h2>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6">
            {report.recommendations}
          </p>
        </section>
      ) : null}

      {report.nextSteps ? (
        <section className="mt-6">
          <h2 className="text-sm font-semibold tracking-wide text-[#1f6b45] uppercase">
            Próximos pasos
          </h2>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6">
            {report.nextSteps}
          </p>
        </section>
      ) : null}

      {report.photos.length ? (
        <section className="mt-6">
          <h2 className="text-sm font-semibold tracking-wide text-[#1f6b45] uppercase">
            Registro fotográfico
          </h2>
          <div className="mt-3 grid grid-cols-2 gap-3">
            {report.photos.map((p, i) => (
              <figure key={p.id}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.dataUrl}
                  alt={p.caption || "Evidencia"}
                  className="h-40 w-full rounded-xl object-cover"
                />
                <figcaption className="mt-1 text-xs text-[#6d7c74]">
                  foto{i + 1}
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      ) : null}

      <footer className="mt-10 border-t border-[#eee8dc] pt-4 text-xs leading-5 text-[#6d7c74]">
        Documento interno y/o para el cliente según el estado de publicación.
        El criterio de la mesa redonda es apoyo; la firma técnica es del
        inspector e ingeniería de Genera Solutions SAS. No reemplaza dictamen RETIE
        de un organismo de inspección.
      </footer>
    </article>
  );
}
