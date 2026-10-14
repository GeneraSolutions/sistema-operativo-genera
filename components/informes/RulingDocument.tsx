"use client";

import { BrandLogo } from "@/components/BrandLogo";
import {
  SEVERITY_LABELS,
  type FindingSeverity,
  type PhotoRuling,
} from "@/lib/photo-ruling";

const TONE: Record<FindingSeverity, string> = {
  critica: "border-[#9b2c2c] bg-[#fde8e8]",
  mayor: "border-[#b45309] bg-[#fff4e5]",
  menor: "border-[#8a6b2a] bg-[#f7f4ee]",
  observacion: "border-[#2a5f8f] bg-[#eef4fa]",
  conforme: "border-[#1f6b45] bg-[#e8f6ee]",
};

export function RulingDocument({ ruling }: { ruling: PhotoRuling }) {
  return (
    <article className="mx-auto max-w-3xl bg-white px-6 py-8 text-[#12241c]">
      <header className="flex items-start justify-between gap-4 border-b border-[#eee8dc] pb-4">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.22em] text-[#8a6b2a] uppercase">
            Genera Solutions SAS · Dictamen fotográfico
          </p>
          <h1 className="mt-1 text-2xl font-semibold">
            Lectura RETIE / NTC 2050
          </h1>
          <p className="mt-1 text-sm text-[#4d5c55]">
            {ruling.inspector || "Inspector"} ·{" "}
            {new Date(ruling.createdAt).toLocaleDateString("es-CO")}
          </p>
        </div>
        <BrandLogo height={48} />
      </header>

      {ruling.siteNote ? (
        <p className="mt-4 text-sm">
          <strong>Sitio / contexto:</strong> {ruling.siteNote}
        </p>
      ) : null}

      {ruling.imageDataUrl ? (
        <figure className="mt-5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={ruling.imageDataUrl}
            alt={ruling.imageCaption || "Evidencia"}
            className="max-h-[420px] w-full rounded-2xl object-contain bg-[#f7f4ee]"
          />
          <figcaption className="mt-1 text-xs text-[#6d7c74]">
            {ruling.imageCaption || "Evidencia de campo"}
          </figcaption>
        </figure>
      ) : null}

      {ruling.resumen ? (
        <section className="mt-6">
          <h2 className="text-sm font-semibold tracking-wide text-[#1f6b45] uppercase">
            Síntesis
          </h2>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6">
            {ruling.resumen}
          </p>
        </section>
      ) : null}

      {ruling.hallazgos.length ? (
        <section className="mt-6 space-y-3">
          <h2 className="text-sm font-semibold tracking-wide text-[#1f6b45] uppercase">
            Hallazgos
          </h2>
          {ruling.hallazgos.map((h, i) => (
            <div
              key={`${h.titulo}-${i}`}
              className={`rounded-2xl border px-4 py-3 text-sm ${TONE[h.criticidad] || TONE.observacion}`}
            >
              <p className="font-semibold">
                {SEVERITY_LABELS[h.criticidad] || h.criticidad} · {h.titulo}
              </p>
              <p className="mt-1 leading-6">{h.hechos}</p>
              <p className="mt-2 text-xs">
                <strong>{h.norma}</strong>
                {h.articulo ? ` · ${h.articulo}` : ""}
              </p>
              <p className="mt-1 leading-6">{h.fundamento}</p>
              <p className="mt-1 leading-6">
                <strong>Acción:</strong> {h.accion}
              </p>
            </div>
          ))}
        </section>
      ) : null}

      {ruling.conformidades.length ? (
        <section className="mt-6">
          <h2 className="text-sm font-semibold tracking-wide text-[#1f6b45] uppercase">
            Lo que se ve conforme
          </h2>
          <ul className="mt-2 list-disc pl-5 text-sm leading-6">
            {ruling.conformidades.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {ruling.limites ? (
        <section className="mt-6">
          <h2 className="text-sm font-semibold tracking-wide text-[#1f6b45] uppercase">
            Límites de la foto
          </h2>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6">
            {ruling.limites}
          </p>
        </section>
      ) : null}

      <footer className="mt-10 border-t border-[#eee8dc] pt-4 text-xs leading-5 text-[#6d7c74]">
        Apoyo técnico GENERA con inteligencia artificial y criterio RETIE / NTC
        2050. No reemplaza el dictamen de un organismo de inspección acreditado
        ONAC ni la firma del ingeniero competente. Verificar numerales en la
        edición vigente de la norma.
      </footer>
    </article>
  );
}
