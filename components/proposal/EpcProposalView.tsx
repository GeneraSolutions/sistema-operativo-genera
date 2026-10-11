"use client";

import { BrandLogo } from "@/components/BrandLogo";
import { MonthlyEnergyChart } from "@/components/proposal/MonthlyEnergyChart";
import type { EpcProposal } from "@/types/proposal";

const cop = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

const num = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 1 });

function formatProposalDate(iso: string) {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("es-CO", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function SectionHead({
  n,
  title,
  subtitle,
}: {
  n: number;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="mb-5 flex items-end gap-3">
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#14b8a6] text-sm font-bold text-[#041018]">
        {n}
      </span>
      <div>
        <h2 className="text-lg font-semibold tracking-wide text-white uppercase">
          {title}
        </h2>
        <p className="text-sm text-[#8aa0c2]">{subtitle}</p>
      </div>
    </div>
  );
}

function SpecCard({
  badge,
  badgeClass,
  value,
  hint,
}: {
  badge: string;
  badgeClass: string;
  value: string;
  hint: string;
}) {
  return (
    <article className="rounded-2xl border border-[#1e2d4a] bg-[#10182c] p-4">
      <p className={`text-[10px] font-bold tracking-[0.16em] uppercase ${badgeClass}`}>
        {badge}
      </p>
      <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
      <p className="mt-1 text-xs leading-5 text-[#8aa0c2]">{hint}</p>
    </article>
  );
}

export function EpcProposalView({
  proposal: p,
  embedded = false,
}: {
  proposal: EpcProposal;
  embedded?: boolean;
}) {
  const co2Kg = Math.round(p.annualGenerationKWh * 0.126);
  const co2T = co2Kg / 1000;
  const trees = Math.round(co2Kg / 21);
  const km = Math.round(co2Kg / 0.192);

  return (
    <div className={`proposal-print bg-[#070b16] text-[#e8eef8] ${embedded ? "" : "min-h-screen"}`}>
      <header className={`sticky top-0 z-20 flex items-center justify-between border-b border-[#1a2744] bg-[#070b16]/90 px-5 py-3 backdrop-blur print:static ${embedded ? "print:hidden" : ""}`}>
        <div className="flex items-center gap-2 text-sm text-[#c5d4ea]">
          <BrandLogo height={28} variant="card" className="!rounded-lg !px-1.5 !py-1" />
          {p.companyName} · Cotización EPC
        </div>
        <div className="flex items-center gap-2 print:hidden">
          <a
            href={`/propuesta/epc/${p.id}/fichas`}
            className="rounded-lg border border-[#2a3d63] bg-[#121a2e] px-3 py-1.5 text-sm text-[#5eead4] hover:bg-[#1a2744]"
          >
            Fichas técnicas
          </a>
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-lg border border-[#2a3d63] bg-[#121a2e] px-3 py-1.5 text-sm text-white hover:bg-[#1a2744]"
          >
            Imprimir / PDF
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-10">
        <div className="text-center">
          <GeneraMark height={p.logoHeight ?? 80} />
          <p className="mt-4 inline-flex rounded-full bg-[#14352c] px-3 py-1 text-[11px] font-semibold tracking-[0.18em] text-[#5eead4] uppercase">
            {p.companyTag}
          </p>
          <h1 className="mt-3 text-3xl font-semibold text-white">{p.clientName}</h1>
          <p className="mt-1 text-sm text-[#8aa0c2]">
            Fecha: {formatProposalDate(p.createdAt)} · Vigencia: {p.validUntilDays}{" "}
            días
          </p>
        </div>

        {p.siteImageDataUrl ? (
          <div className="mt-8 overflow-hidden rounded-3xl border border-[#1e2d4a]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={p.siteImageDataUrl}
              alt={`Lugar del proyecto · ${p.clientName}`}
              className="max-h-[420px] w-full object-cover"
            />
          </div>
        ) : null}

        <div className="mt-8 grid gap-3 md:grid-cols-3">
          <InfoTile label="Cliente" value={p.clientName} hint={p.clientCity} />
          <InfoTile
            label="Forma de pago"
            value={`${p.payment.advancePercent}% anticipo y ${p.payment.deliveryPercent}% a la entrega`}
          />
          <InfoTile
            label="Tiempo de ejecución"
            value={`${p.executionDays} días hábiles`}
          />
        </div>

        <section className="mt-12">
          <SectionHead
            n={1}
            title="Especificaciones del sistema"
            subtitle="Capacidad, equipos principales y perfil energético"
          />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <SpecCard
              badge="Capacidad total"
              badgeClass="text-amber-300"
              value={`${num.format(p.systemKwp)} kWp`}
              hint={`${num.format(p.inverterKwAc)} kW AC (inversores)`}
            />
            <SpecCard
              badge="Inversores"
              badgeClass="text-sky-300"
              value={`1 × ${num.format(p.inverterKwAc)} kW`}
              hint={p.inverterLabel}
            />
            <SpecCard
              badge="Paneles"
              badgeClass="text-emerald-300"
              value={`${p.panelCount} × ${p.panelWatts}W`}
              hint={p.panelLabel}
            />
            <SpecCard
              badge="Baterías"
              badgeClass="text-violet-300"
              value={p.includeBattery ? `${p.batteryKwh} kWh` : "No incluida"}
              hint={p.includeBattery ? p.batteryLabel : "Solo autoconsumo / red"}
            />
          </div>

          {p.toggles.showCharts ? (
            <div className="mt-4 rounded-2xl border border-[#1e2d4a] bg-[#10182c] p-5">
              <div className="mb-2 flex items-baseline justify-between">
                <h3 className="text-sm font-semibold tracking-wide text-white uppercase">
                  Generación solar vs. consumo del cliente
                </h3>
                <p className="text-xs text-[#6b7c99]">kWh / mes · estimación Colombia</p>
              </div>
              <MonthlyEnergyChart data={p.monthlyEnergy} />
            </div>
          ) : null}
        </section>

        <section className="mt-12">
          <h2 className="text-xl font-semibold text-white">
            Propuesta Técnica — Sistemas Incluidos
          </h2>
          <p className="mt-1 text-sm text-[#8aa0c2]">
            {num.format(p.systemKwp)} kWp · 8 categorías · Ingeniería integral validada
          </p>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {p.bundles.map((b) => (
              <article
                key={b.index}
                className="rounded-2xl border bg-[#10182c] p-4"
                style={{ borderColor: `${b.accent}55` }}
              >
                <p
                  className="text-[11px] font-bold tracking-[0.16em] uppercase"
                  style={{ color: b.accent }}
                >
                  {b.index}. {b.title}
                </p>
                <p className="mt-2 text-sm leading-6 text-[#c5d4ea]">{b.description}</p>
                {b.detail ? (
                  <p className="mt-3 border-t border-[#1e2d4a] pt-2 text-sm text-white">
                    {b.detail}
                  </p>
                ) : null}
              </article>
            ))}
          </div>
          <p className="mt-4 text-center text-xs text-[#6b7c99]">
            Ingeniería integral · NTC 2050 · NSR-10 — {p.companyName}
          </p>
        </section>

        <section className="mt-12">
          <SectionHead
            n={2}
            title="Equipos y servicios"
            subtitle="Technical Bundling · 8 categorías comerciales"
          />
          <div className="overflow-hidden rounded-2xl border border-[#1e2d4a] bg-[#10182c]">
            <div className="border-b border-[#1e2d4a] px-4 py-3 text-xs font-semibold tracking-[0.16em] text-[#8aa0c2] uppercase">
              Suministros y servicios integrales · 8 categorías
            </div>
            <table className="w-full text-left text-sm">
              <thead className="text-[#6b7c99]">
                <tr>
                  <th className="px-4 py-2 font-medium">#</th>
                  <th className="px-4 py-2 font-medium">Descripción</th>
                  <th className="px-4 py-2 text-right font-medium">Cant.</th>
                </tr>
              </thead>
              <tbody>
                {p.commercialLines.map((line) => (
                  <tr key={line.index} className="border-t border-[#1e2d4a]">
                    <td className="px-4 py-3 text-[#8aa0c2]">{line.index}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-white">{line.title}</p>
                      <p className="text-xs leading-5 text-[#8aa0c2]">{line.description}</p>
                    </td>
                    <td className="px-4 py-3 text-right text-white">{line.qty}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="space-y-1 border-t border-[#1e2d4a] bg-[#0c1426] px-4 py-4 text-sm">
              <Row k="Total proyecto" v={cop.format(p.totalCOP)} strong />
              <p className="pt-1 text-xs text-[#6b7c99]">
                {p.ivaCOP > 0
                  ? "Inversión llave en mano. El desglose de costos unitarios es interno de Genera."
                  : "Inversión llave en mano. IVA no aplicado en esta oferta."}
              </p>
            </div>
          </div>
        </section>

        <section className="mt-12">
          <SectionHead
            n={3}
            title="Incentivos tributarios"
            subtitle="Ley 1715 de 2014 · Ley 2099 de 2021"
          />
          <div className="grid gap-3 sm:grid-cols-2">
            {p.toggles.showIvaAranceles ? (
              <TaxCard
                label="Devolución IVA"
                value={cop.format(p.taxes.ivaRefundCOP)}
                hint="Recupere el 100% del IVA pagado en equipos gravados"
              />
            ) : null}
            {p.toggles.showDeductionLey1715 ? (
              <TaxCard
                label="Deducción renta (50%)"
                value={cop.format(p.taxes.rentaDeductionBaseCOP)}
                hint="Deduzca hasta el 50% de la inversión en renta"
              />
            ) : null}
            {p.toggles.showDepreciacion ? (
              <TaxCard
                label="Depreciación acelerada"
                value={cop.format(p.taxes.acceleratedDepreciationCOP)}
                hint={`Activo depreciado en 3 años · ${cop.format(p.taxes.annualDepreciationCOP)}/año (33.33%) · Ley 2099`}
              />
            ) : null}
            {p.toggles.showIvaAranceles ? (
              <TaxCard
                label="Exclusión IVA paneles"
                value="100%"
                hint="Paneles solares excluidos de IVA — Ley 1715/2099"
              />
            ) : null}
          </div>
          <ul className="mt-5 grid gap-2 text-sm text-[#c5d4ea] sm:grid-cols-2">
            {[
              "Ahorro significativo en facturas de energía",
              "Energía limpia y reducción de huella de carbono",
              "Independencia y resiliencia energética",
              "Equipos certificados con garantía de fábrica",
              "Incentivos tributarios Ley 1715 / 2099",
              "Monitoreo en tiempo real de la planta",
            ].map((item) => (
              <li key={item} className="flex gap-2">
                <span className="text-[#14b8a6]">✓</span>
                {item}
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-12">
          <SectionHead
            n={4}
            title="Forma de pago"
            subtitle={`Modalidad: ${p.payment.modality}`}
          />
          <div className="grid gap-3 md:grid-cols-2">
            <PayCard
              label="Anticipo"
              amount={cop.format(p.payment.advanceCOP)}
              pct={`${p.payment.advancePercent} % del total`}
              total={cop.format(p.totalCOP)}
            />
            <PayCard
              label="Entrega"
              amount={cop.format(p.payment.deliveryCOP)}
              pct={`${p.payment.deliveryPercent} % del total`}
              total={cop.format(p.totalCOP)}
            />
          </div>
        </section>

        <section className="mt-12">
          <SectionHead
            n={5}
            title="Retorno de inversión (ROI)"
            subtitle="Proyección financiera a 25 años"
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <TaxCard
              label="Ahorro anual energía"
              value={cop.format(p.annualEnergySavingsCOP)}
              hint="100% factura"
            />
            {p.toggles.showDeductionLey1715 ? (
              <TaxCard
                label="Ahorro fiscal renta (año 1)"
                value={cop.format(p.year1TaxSavingsCOP)}
                hint="50% ÷ 15 años · 35% renta · Ley 1715"
              />
            ) : null}
            <TaxCard
              label="Ahorro total 25 años"
              value={cop.format(p.total25ySavingsCOP)}
              hint="Energía + tributario"
            />
            <TaxCard
              label="Ahorro anual total"
              value={cop.format(p.blendedAnnualSavingsCOP)}
              hint="Energía + tributario + IVA recuperable año 1"
            />
            {p.toggles.showRoiPayback ? (
              <>
                <TaxCard
                  label="ROI 25 años"
                  value={`${num.format(p.roiPercentage)}%`}
                  hint={`Payback ${num.format(p.paybackYearsSimple)} años`}
                />
                <TaxCard
                  label="VAN @ 12%"
                  value={cop.format(p.npvCOP)}
                  hint={
                    p.toggles.showTir
                      ? `TIR ${num.format(p.irrPercentage)}%`
                      : "Valor actual neto"
                  }
                />
              </>
            ) : null}
          </div>
        </section>

        <section className="mt-12">
          <SectionHead
            n={6}
            title="Bonos y compromisos GENERA"
            subtitle="Valor agregado incluido en su propuesta"
          />
          <div className="grid gap-3 md:grid-cols-2">
            {p.bonuses.map((b) => (
              <article
                key={b.id}
                className="rounded-2xl border border-[#1e2d4a] bg-[#10182c] p-4"
              >
                <h3 className="font-semibold text-white">{b.title}</h3>
                <p className="mt-1 text-xs font-medium text-[#5eead4]">{b.tagline}</p>
                <p className="mt-2 text-sm leading-6 text-[#c5d4ea]">{b.description}</p>
              </article>
            ))}
          </div>
          <p className="mt-3 text-xs text-[#6b7c99]">
            * Bonos y compromisos sujetos a condiciones del contrato y alcance del
            proyecto cotizado.
          </p>
        </section>

        <section className="mt-12">
          <SectionHead
            n={7}
            title="Impacto ambiental"
            subtitle="Factor emisión SIN · 0.126 kg CO₂/kWh"
          />
          <div className="grid gap-3 sm:grid-cols-3">
            <TaxCard label="CO₂ evitado" value={`${num.format(co2T)} t`} hint={`${num.format(co2Kg)} kg / año`} />
            <TaxCard label="Árboles equivalente" value={`${trees}`} hint="equivalente anual" />
            <TaxCard label="Km no recorridos" value={`${num.format(km)} km`} hint="gasolina / año" />
          </div>
          <p className="mt-3 text-sm text-[#8aa0c2]">
            Generación estimada: {num.format(p.annualGenerationKWh)} kWh/año · 4.5 h-sol/día
            Colombia
          </p>
        </section>

        <section className="mt-12 grid gap-6 md:grid-cols-2">
          <div>
            <h2 className="text-lg font-semibold text-white">Mantenimiento</h2>
            <p className="mt-2 text-sm leading-6 text-[#c5d4ea]">
              Mantenimiento preventivo anual recomendado: limpieza de paneles, inspección
              de estructura y conexiones, revisión de inversores y monitoreo. Primer
              mantenimiento incluido el primer año posterior a la puesta en marcha.
            </p>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Garantías</h2>
            <p className="mt-2 text-sm leading-6 text-[#c5d4ea]">
              Paneles: 25 años producto · 25 años rendimiento (≥80%). Inversores: 10 años
              fábrica. Baterías: según fabricante 10 años. Estructura: 10 años corrosión.
              Mano de obra GENERA: 1 año.
            </p>
          </div>
        </section>

        <section className="mt-12 grid gap-6 md:grid-cols-2">
          <div>
            <h2 className="text-lg font-semibold text-white">Marco legal</h2>
            <ul className="mt-2 space-y-1 text-sm text-[#c5d4ea]">
              <li>Ley 1715 de 2014</li>
              <li>Ley 2099 de 2021</li>
              <li>RETIE · UPME</li>
            </ul>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Condiciones de venta</h2>
            <ul className="mt-2 space-y-1 text-sm text-[#c5d4ea]">
              <li>Cotización válida por {p.validUntilDays} días calendario</li>
              <li>Precios sujetos a disponibilidad de equipos</li>
              <li>No incluye obras civiles ni adecuaciones MT salvo mención expresa</li>
            </ul>
          </div>
        </section>

        <footer className="mt-16 border-t border-[#1e2d4a] py-10 text-center">
          <p className="max-w-2xl mx-auto text-sm leading-6 text-[#c5d4ea]">
            Transformando el sol en su mejor inversión: en {p.companyName} combinamos
            excelencia técnica y normativa para garantizarle energía limpia, ahorro real y
            respaldo absoluto durante toda la vida útil de su planta.
          </p>
          <div className="mt-6 grid gap-3 text-sm sm:grid-cols-3">
            <p>
              <span className="block text-xs text-[#6b7c99]">Correo</span>
              info@generasolutions.co
            </p>
            <p>
              <span className="block text-xs text-[#6b7c99]">Página web</span>
              www.generasolutions.com.co
            </p>
            <p>
              <span className="block text-xs text-[#6b7c99]">Contacto</span>
              317 455 3288 · 302 106 6719
            </p>
          </div>
          <p className="mt-6 text-xs text-[#6b7c99]">
            {p.companyName} · Energía limpia · Futuro brillante
          </p>
        </footer>
      </div>
    </div>
  );
}

function InfoTile({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <article className="rounded-2xl border border-[#1e2d4a] bg-[#10182c] p-4">
      <p className="text-[10px] font-bold tracking-[0.18em] text-[#8aa0c2] uppercase">
        {label}
      </p>
      <p className="mt-2 font-medium text-white">{value}</p>
      {hint ? <p className="text-sm text-[#8aa0c2]">{hint}</p> : null}
    </article>
  );
}

function TaxCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <article className="rounded-2xl border border-[#1e2d4a] bg-[#10182c] p-4">
      <p className="text-[10px] font-bold tracking-[0.16em] text-[#5eead4] uppercase">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
      <p className="mt-1 text-xs leading-5 text-[#8aa0c2]">{hint}</p>
    </article>
  );
}

function PayCard({
  label,
  amount,
  pct,
  total,
}: {
  label: string;
  amount: string;
  pct: string;
  total: string;
}) {
  return (
    <article className="rounded-2xl border border-[#1e2d4a] bg-[#10182c] p-5">
      <p className="text-[10px] font-bold tracking-[0.16em] text-[#f5b942] uppercase">
        {label}
      </p>
      <p className="mt-2 text-3xl font-semibold text-white">{amount}</p>
      <p className="mt-1 text-sm text-[#c5d4ea]">{pct}</p>
      <p className="mt-3 text-xs text-[#6b7c99]">Total proyecto: {total}</p>
    </article>
  );
}

function Row({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between ${strong ? "text-lg font-semibold text-white" : "text-[#c5d4ea]"}`}>
      <span>{k}</span>
      <span>{v}</span>
    </div>
  );
}

function GeneraMark({ height }: { height: number }) {
  return (
    <div className="flex justify-center">
      <BrandLogo height={height} variant="card" />
    </div>
  );
}
