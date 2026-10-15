"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { BrandLogo } from "@/components/BrandLogo";
import { loadObras, obraLabel } from "@/lib/obra";
import {
  BIZAGI_UPME_URL,
  buildUpmePack,
  type UpmePack,
} from "@/lib/upme-pack";

const cop = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});
const num = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 1 });

function UpmeInner() {
  const searchParams = useSearchParams();
  const obraId = searchParams.get("obra");
  const [pack, setPack] = useState<UpmePack | null>(null);
  const [missing, setMissing] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!obraId) {
      setMissing(true);
      return;
    }
    const job = loadObras().find((j) => j.id === obraId);
    if (!job) {
      setMissing(true);
      return;
    }
    void buildUpmePack(job).then(setPack);
  }, [obraId]);

  if (missing) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f4efe4] px-6 text-[#4d5c55]">
        <p>
          No hay obra para este expediente.{" "}
          <Link href="/obra" className="font-semibold text-[#1f6b45] underline">
            Volver a Obra
          </Link>
        </p>
      </div>
    );
  }

  if (!pack) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f4efe4] text-[#4d5c55]">
        Armando expediente UPME…
      </div>
    );
  }

  const { job, pasteText } = pack;

  async function copyPaste() {
    try {
      await navigator.clipboard.writeText(pasteText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#f4efe4] text-[#1a241c]">
      <header className="print:hidden sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 border-b border-[#ddd6c8] bg-[#f4efe4]/95 px-4 py-3 backdrop-blur">
        <Link href="/obra" className="flex items-center gap-2 text-sm">
          <BrandLogo height={28} />
          Volver a Obra
        </Link>
        <div className="flex flex-wrap gap-2">
          <a
            href={BIZAGI_UPME_URL}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg border border-[#1f6b45] px-3 py-1.5 text-sm font-semibold text-[#1f6b45]"
          >
            Abrir Bizagi UPME
          </a>
          <button
            type="button"
            onClick={() => void copyPaste()}
            className="rounded-lg border border-[#0f2a1f] px-3 py-1.5 text-sm font-medium"
          >
            {copied ? "Copiado" : "Copiar para pegar en Bizagi"}
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-lg bg-[#0f2a1f] px-3 py-1.5 text-sm font-medium text-white"
          >
            Imprimir / PDF
          </button>
        </div>
      </header>

      <article className="mx-auto max-w-3xl px-5 py-10 print:max-w-none print:px-0 print:py-0">
        <div className="rounded-[28px] border border-[#d4b46a]/50 bg-white px-6 py-8 shadow-[0_20px_50px_rgba(18,36,28,0.08)] print:rounded-none print:border-0 print:px-0 print:py-0 print:shadow-none">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <BrandLogo height={56} />
            <p className="text-right text-[11px] leading-5 text-[#6d7c74]">
              Genera Solutions SAS
              <br />
              Expediente interno · no reemplaza la radicación SUU
            </p>
          </div>
          <p className="mt-8 text-[11px] font-semibold tracking-[0.22em] uppercase text-[#8a6b2a]">
            Certificado incentivos · Ley 1715 / 2099 · Res. UPME 563 de 2026
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#12241c]">
            Expediente UPME
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-[#4d5c55]">
            {obraLabel(job)}. Pegue los datos en Bizagi, adjunte las fichas y
            los PDF que el checklist marque. El certificado lo emite la UPME
            en su aplicativo, no este documento.
          </p>

          <section className="mt-8">
            <h2 className="text-lg font-semibold">Listo para radicar</h2>
            <p className="mt-1 text-sm text-[#6d7c74]">
              {pack.readyCount} de {pack.checks.length} requisitos internos
              cubiertos.
            </p>
            <ul className="mt-3 space-y-2">
              {pack.checks.map((c) => (
                <li
                  key={c.id}
                  className={`rounded-xl border px-3 py-2 text-sm ${
                    c.ok
                      ? "border-[#cfe8d8] bg-[#f3faf6]"
                      : "border-[#f0d4d4] bg-[#fdf6f6]"
                  }`}
                >
                  <p className="font-medium">
                    {c.ok ? "Listo" : "Falta"} · {c.label}
                  </p>
                  <p className="text-xs leading-5 text-[#6d7c74]">{c.hint}</p>
                </li>
              ))}
            </ul>
          </section>

          <section className="mt-8">
            <h2 className="text-lg font-semibold">Datos del proyecto</h2>
            <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
              <Row label="Cliente / proyecto" value={job.clientName} />
              <Row label="Sitio" value={job.siteName || "—"} />
              <Row label="Municipio" value={job.city || pack.quote?.clientCity || "—"} />
              <Row
                label="Capacidad"
                value={`${job.kwp || pack.quote?.systemKwp || "—"} kWp`}
              />
              <Row
                label="Generación año 1"
                value={
                  pack.annualKwh
                    ? `${num.format(pack.annualKwh)} kWh (PR 0,8)`
                    : "—"
                }
              />
              <Row label="HSP" value={`${num.format(pack.peakSunHours)} kWh/m²·día`} />
              <Row
                label="Coordenadas"
                value={
                  pack.lat != null && pack.lon != null
                    ? `${pack.lat}, ${pack.lon}`
                    : "—"
                }
              />
              <Row
                label="Persona"
                value={
                  job.upmePersonType === "juridica"
                    ? "Jurídica"
                    : job.upmePersonType === "natural"
                      ? "Natural"
                      : "—"
                }
              />
              <Row label="NIT / cédula" value={job.upmeNit || "—"} />
              <Row label="Representante / contacto" value={job.upmeRepName || "—"} />
              <Row label="Correo" value={job.upmeEmail || "—"} />
              <Row label="Teléfono" value={job.upmePhone || "—"} />
              <Row label="Dirección" value={job.upmeAddress || "—"} />
              <Row
                label="Registro generación"
                value={job.upmeRegistroGen || "—"}
              />
              <Row
                label="Tarifa UPME"
                value={
                  job.upmeTarifaPaid
                    ? `Pagada${job.upmeTarifaRef ? ` · ${job.upmeTarifaRef}` : ""}`
                    : "Pendiente"
                }
              />
              <Row
                label="Inversión neta oferta"
                value={pack.saleCOP ? cop.format(pack.saleCOP) : "—"}
              />
              <Row
                label="Base deducción renta 50%"
                value={
                  pack.applyLey1715 && pack.rentaBaseCOP
                    ? cop.format(pack.rentaBaseCOP)
                    : "—"
                }
              />
            </dl>
          </section>

          {pack.visitBits.length ? (
            <section className="mt-8">
              <h2 className="text-lg font-semibold">Levantamiento de visita</h2>
              <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                {pack.visitBits.map((b) => (
                  <Row key={b.label} label={b.label} value={b.value} />
                ))}
              </dl>
            </section>
          ) : null}

          <section className="mt-8">
            <h2 className="text-lg font-semibold">Bienes y fichas técnicas</h2>
            <p className="mt-1 text-sm leading-6 text-[#4d5c55]">
              Res. UPME 563 de 2026: ficha o catálogo con marca, modelo,
              referencia, fabricante y parámetros. Abra cada ficha y adjúntela
              en Bizagi.
            </p>
            {pack.equipment.length === 0 ? (
              <p className="mt-3 text-sm text-[#9b2c2c]">
                No hay equipos. Ligue y guarde la cotización en Obra.
              </p>
            ) : (
              <ul className="mt-4 space-y-3">
                {pack.equipment.map((e) => {
                  const href = e.localFile?.url || e.datasheetUrl;
                  return (
                    <li
                      key={e.itemId}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#eee8dc] px-3 py-3"
                    >
                      <div>
                        <p className="font-medium">
                          {e.brand} {e.model}
                        </p>
                        <p className="text-xs text-[#6d7c74]">
                          {e.label} · {e.qty} {e.unit}
                          {e.capacity ? ` · ${e.capacity}` : ""}
                        </p>
                      </div>
                      {href ? (
                        <a
                          href={href}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-lg bg-[#0f2a1f] px-3 py-1.5 text-xs font-semibold text-white"
                        >
                          {e.localFile ? e.localFile.name : "Ficha fabricante"}
                        </a>
                      ) : (
                        <span className="text-xs font-semibold text-[#9b2c2c]">
                          Sin ficha
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="mt-8">
            <h2 className="text-lg font-semibold">Memoria de cálculo</h2>
            <p className="mt-2 text-sm leading-6 text-[#4d5c55]">
              Sistema de {job.kwp || pack.quote?.systemKwp || "—"} kWp. Energía
              anual estimada {pack.annualKwh ? num.format(pack.annualKwh) : "—"}{" "}
              kWh con HSP {num.format(pack.peakSunHours)} y factor de
              desempeño 0,8, coherente con el cotizador. La oferta neta es{" "}
              {pack.saleCOP ? cop.format(pack.saleCOP) : "—"}.
              {pack.applyLey1715
                ? ` Base tentativa de deducción de renta (50%): ${
                    pack.rentaBaseCOP ? cop.format(pack.rentaBaseCOP) : "—"
                  }.`
                : " La cotización no tiene Ley 1715 activa."}{" "}
              Esta memoria alimenta el aplicativo; la UPME evalúa y certifica.
            </p>
            {pack.quote ? (
              <p className="mt-2 text-xs text-[#6d7c74]">
                Origen: cotización «{pack.quote.name}». Imprima también la
                propuesta comercial como oferta de servicios.
              </p>
            ) : null}
          </section>

          <section className="mt-8 print:hidden">
            <h2 className="text-lg font-semibold">Cómo radicar</h2>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm leading-6 text-[#4d5c55]">
              <li>Complete en Obra NIT, tipo de persona y radicado de generación.</li>
              <li>Copie el bloque de datos y ábralo en Bizagi (SUU del cliente).</li>
              <li>Adjunte fichas, oferta, certificado de existencia y pago de tarifa.</li>
              <li>Marque UPME como radicado en la ficha de Obra.</li>
            </ol>
          </section>
        </div>
        <footer className="mt-8 pb-8 text-center text-xs leading-5 text-[#6d7c74] print:mt-6">
          Genera Solutions SAS · 317 455 3288
          <br />
          www.generasolutions.com.co
        </footer>
      </article>
      <style>{`
        @media print {
          header { display: none !important; }
          @page { margin: 14mm; }
          body { background: white !important; }
        }
      `}</style>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-[#fbfaf6] px-3 py-2">
      <dt className="text-[11px] uppercase tracking-wide text-[#6d7c74]">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

export default function UpmePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#f4efe4]">
          Cargando expediente…
        </div>
      }
    >
      <UpmeInner />
    </Suspense>
  );
}
