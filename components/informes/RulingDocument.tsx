"use client";

import { BrandLogo } from "@/components/BrandLogo";
import {
  SEVERITY_LABELS,
  rulingPhotos,
  type FindingSeverity,
  type PhotoFinding,
  type PhotoRuling,
} from "@/lib/photo-ruling";

const TONE: Record<FindingSeverity, string> = {
  critica: "border-[#9b2c2c] bg-[#fde8e8]",
  mayor: "border-[#b45309] bg-[#fff4e5]",
  menor: "border-[#8a6b2a] bg-[#f7f4ee]",
  observacion: "border-[#2a5f8f] bg-[#eef4fa]",
  conforme: "border-[#1f6b45] bg-[#e8f6ee]",
};

function FindingCard({ h }: { h: PhotoFinding }) {
  return (
    <div
      className={`rounded-2xl border px-3 py-2.5 text-sm ${TONE[h.criticidad] || TONE.observacion}`}
    >
      <p className="font-semibold">
        {SEVERITY_LABELS[h.criticidad] || h.criticidad} · {h.titulo}
      </p>
      {h.hechos ? <p className="mt-1 leading-6">{h.hechos}</p> : null}
      {h.norma || h.articulo ? (
        <p className="mt-2 text-xs">
          <strong>{h.norma}</strong>
          {h.articulo ? ` · ${h.articulo}` : ""}
        </p>
      ) : null}
      {h.fundamento ? <p className="mt-1 leading-6">{h.fundamento}</p> : null}
      {h.accion ? (
        <p className="mt-1 leading-6">
          <strong>Corrección:</strong> {h.accion}
        </p>
      ) : null}
    </div>
  );
}

export function RulingDocument({ ruling }: { ruling: PhotoRuling }) {
  const photos = rulingPhotos(ruling);
  const leftover = ruling.hallazgos.filter((h) => {
    const n = Number(h.foto);
    return !n || !photos[n - 1];
  });

  return (
    <article className="mx-auto max-w-3xl bg-white px-6 py-8 text-[#12241c]">
      <header className="flex items-start justify-between gap-4 border-b border-[#eee8dc] pb-4">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.22em] text-[#8a6b2a] uppercase">
            Genera Solutions SAS · Dictamen fotográfico
          </p>
          <h1 className="mt-1 text-2xl font-semibold">
            Interventoría RETIE / NTC 2050
          </h1>
          <p className="mt-1 text-sm text-[#4d5c55]">
            {ruling.inspector || "Inspector"} ·{" "}
            {new Date(ruling.createdAt).toLocaleDateString("es-CO")} ·{" "}
            {photos.length} foto{photos.length === 1 ? "" : "s"}
          </p>
        </div>
        <BrandLogo height={48} />
      </header>

      {ruling.siteNote ? (
        <p className="mt-4 text-sm">
          <strong>Sitio / contexto:</strong> {ruling.siteNote}
        </p>
      ) : null}

      {ruling.fieldNotes ? (
        <section className="mt-5">
          <h2 className="text-sm font-semibold tracking-wide text-[#1f6b45] uppercase">
            Notas de campo para ingeniería
          </h2>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6">
            {ruling.fieldNotes}
          </p>
        </section>
      ) : null}

      {ruling.resumen ? (
        <section className="mt-6">
          <h2 className="text-sm font-semibold tracking-wide text-[#1f6b45] uppercase">
            Síntesis de interventoría
          </h2>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6">
            {ruling.resumen}
          </p>
        </section>
      ) : null}

      {photos.length ? (
        <section className="mt-8 space-y-8">
          <h2 className="text-sm font-semibold tracking-wide text-[#1f6b45] uppercase">
            Evidencia, hallazgos y no conformidades
          </h2>
          {photos.map((p, i) => {
            const n = i + 1;
            const lectura = ruling.lecturaPorFoto?.find(
              (row) => Number(row.indice) === n
            );
            const items = ruling.hallazgos.filter((h) => Number(h.foto) === n);
            return (
              <div
                key={p.id}
                className="break-inside-avoid rounded-2xl border border-[#eee8dc] p-3"
              >
                <p className="mb-3 text-xs font-semibold tracking-wide text-[#8a6b2a] uppercase">
                  Foto {n}
                  {p.caption ? ` · ${p.caption}` : ""}
                </p>
                <div className="grid gap-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
                  <figure>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={p.dataUrl}
                      alt={p.caption || `Foto ${n}`}
                      className="max-h-72 w-full rounded-xl object-contain bg-[#f7f4ee]"
                    />
                  </figure>
                  <div className="space-y-2">
                    {lectura?.descripcion ? (
                      <p className="whitespace-pre-wrap text-sm leading-6">
                        <strong>Lectura. </strong>
                        {lectura.descripcion}
                      </p>
                    ) : null}
                    {items.length ? (
                      items.map((h, hi) => (
                        <FindingCard key={`${h.titulo}-${hi}`} h={h} />
                      ))
                    ) : (
                      <p className="text-sm text-[#6d7c74]">
                        {ruling.resumen
                          ? "Sin no conformidad asignada a esta foto."
                          : "Analice como interventor para ver hallazgos junto a cada imagen."}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </section>
      ) : null}

      {leftover.length ? (
        <section className="mt-6 space-y-3">
          <h2 className="text-sm font-semibold tracking-wide text-[#1f6b45] uppercase">
            Hallazgos sin foto asignada
          </h2>
          {leftover.map((h, i) => (
            <FindingCard key={`${h.titulo}-x-${i}`} h={h} />
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
            Límites de la evidencia
          </h2>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6">
            {ruling.limites}
          </p>
        </section>
      ) : null}

      <footer className="mt-10 border-t border-[#eee8dc] pt-4 text-xs leading-5 text-[#6d7c74]">
        Memoria de interventoría GENERA con apoyo de visión e inteligencia
        artificial (RETIE / NTC 2050 y normas conexas). No reemplaza el
        dictamen de un organismo de inspección acreditado ONAC ni la firma del
        ingeniero competente. Verificar numerales en la edición vigente.
      </footer>
    </article>
  );
}
