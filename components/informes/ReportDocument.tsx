"use client";

import {
  REPORT_KIND_LABELS,
  checklistSummary,
  type ReportStatus,
  type TechnicalReport,
} from "@/lib/technical-reports";
import { DocSection, DocSheet, formatDocDate } from "@/components/informes/DocSheet";

const CHECK: Record<string, string> = {
  pendiente: "Pendiente",
  ok: "Conforme",
  no: "No conforme",
  na: "No aplica",
};

const REPORT_STATUS: Record<ReportStatus, string> = {
  borrador: "Borrador",
  revisado: "Revisado",
  publicado: "Publicado",
};

export function ReportDocument({ report }: { report: TechnicalReport }) {
  const sum = checklistSummary(report.checklist);
  const site = report.plant.siteName || report.plant.city;
  const address = [report.plant.address, report.plant.city]
    .filter(Boolean)
    .join(", ");

  return (
    <DocSheet
      kicker="Genera Solutions SAS · Informe técnico"
      title={REPORT_KIND_LABELS[report.kind]}
      meta={[report.plant.clientName, site].filter(Boolean).join(" · ")}
      facts={[
        { label: "Cliente", value: report.plant.clientName },
        { label: "Sitio", value: site },
        { label: "Fecha", value: formatDocDate(report.visitDate) },
        { label: "Inspector", value: report.inspector },
        { label: "Estado", value: REPORT_STATUS[report.status] || report.status },
        {
          label: "Potencia",
          value: report.plant.kwp ? `${report.plant.kwp} kWp` : "",
        },
        { label: "Inversor", value: report.plant.inverter },
        { label: "Dirección", value: address },
        {
          label: "Origen",
          value: report.plant.ours
            ? "Instalación Genera Solutions SAS"
            : "Tercero / no Genera Solutions SAS",
        },
      ]}
      legal={
        <>
          Documento interno y/o para el cliente según el estado de publicación.
          El criterio de la mesa redonda es apoyo; la firma técnica es del
          inspector e ingeniería de Genera Solutions SAS. No reemplaza dictamen RETIE
          de un organismo de inspección.
        </>
      }
    >
      {report.purpose ? (
        <DocSection title="Objeto">
          <p className="gen-doc-prose">{report.purpose}</p>
        </DocSection>
      ) : null}

      {report.findings ? (
        <DocSection title="Síntesis">
          <p className="gen-doc-prose">{report.findings}</p>
        </DocSection>
      ) : null}

      {report.engineeringNotes ? (
        <DocSection title="Complemento para ingeniería">
          <p className="gen-doc-prose">{report.engineeringNotes}</p>
        </DocSection>
      ) : null}

      <DocSection
        title="Checklist de campo"
        hint={`${sum.ok} conformes · ${sum.no} no conformes · ${sum.pending} pendientes · ${sum.na} N/A`}
      >
        <table className="gen-doc-checks">
          <tbody>
            {report.checklist.map((item) => (
              <tr key={item.id}>
                <td>
                  <span className="gen-doc-mark" data-tone={item.status}>
                    {CHECK[item.status] || item.status}
                  </span>
                </td>
                <td>
                  <strong>{item.label}</strong>
                  {item.note ? <p>{item.note}</p> : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </DocSection>

      {report.chapters.some((chapter) => chapter.body.trim()) ? (
        <DocSection title="Criterio de la mesa técnica">
          {report.chapters
            .filter((chapter) => chapter.body.trim())
            .map((chapter) => (
              <div key={chapter.specialistId} className="gen-doc-chapter">
                <h3>
                  {chapter.title}
                  {chapter.approved ? (
                    <span className="gen-doc-mark" data-tone="ok">
                      Revisado
                    </span>
                  ) : null}
                </h3>
                <p>{chapter.body}</p>
              </div>
            ))}
        </DocSection>
      ) : null}

      {report.recommendations ? (
        <DocSection title="Recomendaciones">
          <p className="gen-doc-prose">{report.recommendations}</p>
        </DocSection>
      ) : null}

      {report.nextSteps ? (
        <DocSection title="Próximos pasos">
          <p className="gen-doc-prose">{report.nextSteps}</p>
        </DocSection>
      ) : null}

      {report.photos.length ? (
        <DocSection title="Registro fotográfico">
          <div className="gen-doc-photos">
            {report.photos.map((photo, index) => (
              <figure key={photo.id}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.dataUrl}
                  alt={photo.caption || `Foto ${index + 1}`}
                />
                <figcaption>{photo.caption || `Foto ${index + 1}`}</figcaption>
              </figure>
            ))}
          </div>
        </DocSection>
      ) : null}
    </DocSheet>
  );
}
