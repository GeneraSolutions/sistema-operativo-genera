"use client";

import { Callout, DeliverableShell, DocH2 } from "@/components/deliverables/DeliverableShell";
import {
  cloneWarranties,
  visibleWarrantyItems,
  yearsLabel,
} from "@/lib/warranties";
import type { EpcProposal } from "@/types/proposal";

const cop = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});
const num = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 1 });

const STEPS = [
  {
    n: "01",
    title: "Revisión de esta memoria",
    body: "El cliente y su equipo técnico-financiero validan alcance, precio y condiciones antes de aceptar la oferta.",
  },
  {
    n: "02",
    title: "Cierre comercial",
    body: "Se formalizan alcance, cronograma tentativo y forma de pago consignados en esta cotización.",
  },
  {
    n: "03",
    title: "Ingeniería y suministro",
    body: "Se confirma el diseño con los equipos listados y se gestiona el pedido. El valor asume esa especificación.",
  },
  {
    n: "04",
    title: "Ejecución en sitio",
    body: "Montaje de estructura, módulos, canalización, tableros, inversor y sistema de puesta a tierra.",
  },
  {
    n: "05",
    title: "Puesta en marcha y entrega",
    body: "Energización, trámites RETIE y de red según aplique, certificado, manual de la planta y paquetes de fichas.",
  },
];

export function QuoteExplainer({ proposal: p }: { proposal: EpcProposal }) {
  const warranties = visibleWarrantyItems(
    cloneWarranties(p.warranties),
    p.includeBattery
  );
  const dailyKwh = Math.round(p.annualGenerationKWh / 365);
  const monthlySave = Math.round(p.annualEnergySavingsCOP / 12);

  return (
    <DeliverableShell
      proposal={p}
      kicker="Anexo a la cotización EPC · Genera Solutions SAS"
      title="Memoria explicativa de la propuesta"
      subtitle={`${p.clientName} · sistema de ${num.format(p.systemKwp)} kWp en ${p.clientCity}. Este anexo describe, en lenguaje técnico accesible, el alcance, la estructura de precios, el procedimiento de ejecución y los compromisos incluidos en la oferta.`}
    >
      <section className="grid gap-3 sm:grid-cols-3">
        <Stat
          label="Valor total de la oferta"
          value={cop.format(p.totalCOP)}
          hint={
            p.ivaCOP
              ? `IVA incluido ${cop.format(p.ivaCOP)}`
              : "Presentada sin IVA en este alcance"
          }
        />
        <Stat
          label="Capacidad del sistema"
          value={`${num.format(p.systemKwp)} kWp`}
          hint={`${p.panelCount} módulos · ${p.inverterKwAc} kW AC`}
        />
        <Stat
          label="Ahorro energético año 1"
          value={cop.format(p.annualEnergySavingsCOP)}
          hint={`Referencia mensual ≈ ${cop.format(monthlySave)}`}
        />
      </section>

      <section>
        <DocH2>Objeto de la oferta</DocH2>
        <p className="mt-2 text-sm leading-7 text-[#4d5c55]">
          Genera Solutions SAS cotiza el diseño, suministro e instalación de una
          planta fotovoltaica de <strong>{num.format(p.systemKwp)} kWp</strong>{" "}
          (corriente continua) sobre {p.mountLabel.toLowerCase()}, para{" "}
          {p.clientName}. Con la radiación de {p.clientCity}
          {p.ideamStationName
            ? ` y la estación de referencia IDEAM «${p.ideamStationName}»`
            : ""}
          , la generación estimada es de{" "}
          <strong>{num.format(p.annualGenerationKWh)} kWh/año</strong> (
          {num.format(dailyKwh)} kWh/día en promedio). El valor cubre los equipos,
          la ingeniería, la cuadrilla y las partidas enumeradas en el alcance.
          Todo lo que no figure por escrito queda fuera de esta oferta.
        </p>
      </section>

      <section>
        <DocH2>Estructura del precio</DocH2>
        <p className="mt-2 text-sm leading-6 text-[#4d5c55]">
          La cotización se presenta en tres capas. Así se evita comparar un
          subtotal con el total de otro proponente.
        </p>
        <ol className="mt-3 space-y-3 text-sm leading-6">
          <li className="rounded-2xl border border-[#eee9de] bg-[#fbfaf6] px-4 py-3">
            <strong>1. Subtotal {cop.format(p.subtotalCOP)}</strong>
            <span className="mt-1 block text-[#4d5c55]">
              Valor de venta del alcance: equipos, ingeniería, instalación y
              partidas habilitadas. Es el precio del sistema antes de IVA.
            </span>
          </li>
          <li className="rounded-2xl border border-[#eee9de] bg-[#fbfaf6] px-4 py-3">
            <strong>2. IVA {cop.format(p.ivaCOP)}</strong>
            <span className="mt-1 block text-[#4d5c55]">
              {p.ivaCOP
                ? "Impuesto sobre las partidas gravadas. Los módulos fotovoltaicos pueden gozar de exclusión de IVA (Ley 1715 de 2014 y Ley 2099 de 2021) cuando cumplen los requisitos; inversor, estructura, protecciones y servicios no necesariamente. Por ello el IVA no equivale al 19 % de todo el subtotal."
                : "Esta presentación no cobra IVA al cliente en el motor de cotización."}
            </span>
          </li>
          <li className="rounded-2xl border border-[#1f6b45]/30 bg-[#e8f6ee] px-4 py-3">
            <strong>3. Total {cop.format(p.totalCOP)}</strong>
            <span className="mt-1 block text-[#244a38]">
              Cifra de cierre para aprobación y para comparar ofertas
              equivalentes. La forma de pago de esta propuesta es:{" "}
              {p.payment.modality}.
            </span>
          </li>
        </ol>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {p.payment.installments.map((item) => (
            <div
              key={item.key}
              className="rounded-xl border border-[#ddd6c8] px-3 py-3 text-sm"
            >
              <p className="text-[11px] font-semibold tracking-wide text-[#8a6b2a] uppercase">
                {item.label}
              </p>
              <p className="mt-1 text-lg font-semibold">
                {item.key === "tarifa"
                  ? `${cop.format(item.amountCOP)}/kWh`
                  : cop.format(item.amountCOP)}
              </p>
              <p className="text-xs text-[#6d7c74]">
                {item.percent != null ? `${item.percent}% del total` : item.hint}
              </p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-[#6d7c74]">{p.payment.summary}</p>
      </section>

      <section>
        <DocH2>Alcance técnico, por sistemas</DocH2>
        <p className="mt-2 text-sm leading-6 text-[#4d5c55]">
          Cada renglón es un sistema completo, no un accesorio aislado. Una
          oferta de menor valor solo es comparable si cubre los mismos bloques,
          las mismas potencias y las mismas marcas.
        </p>
        <ul className="mt-4 space-y-2">
          {p.commercialLines.map((line) => (
            <li
              key={line.index}
              className="grid grid-cols-[2.2rem_1fr] gap-3 rounded-2xl border border-[#eee9de] px-3 py-3"
            >
              <span className="grid h-8 w-8 place-items-center rounded-full bg-[#0f2a1f] text-xs font-bold text-[#d4b46a]">
                {String(line.index).padStart(2, "0")}
              </span>
              <div>
                <p className="font-medium text-[#12241c]">{line.title}</p>
                <p className="mt-0.5 text-sm leading-6 text-[#4d5c55]">
                  {line.description}
                  {line.qty > 1 ? ` · cantidad ${line.qty}` : ""}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <DocH2>Exclusiones</DocH2>
        <p className="mt-2 text-sm leading-6 text-[#4d5c55]">
          Salvo mención expresa en esta cotización, no forman parte del precio:
        </p>
        <ul className="mt-3 grid gap-2 text-sm leading-6 text-[#4d5c55] sm:grid-cols-2">
          {[
            "Obras civiles mayores, demolición o reposición de cubierta",
            "Adecuaciones de media tensión no descritas",
            "Licencias municipales, servidumbres o trámites de predio ajenos al alcance eléctrico",
            "Consumos de energía de la obra facturados por el comercializador",
            "Sustitución de marca, modelo o potencia respecto de la lista adjunta",
            "Ampliaciones futuras de la planta (se cotizan por separado)",
          ].map((item) => (
            <li key={item} className="rounded-xl bg-[#fbfaf6] px-3 py-2">
              {item}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <DocH2>Procedimiento de ejecución</DocH2>
        <ol className="mt-4 space-y-2">
          {STEPS.map((step) => (
            <li
              key={step.n}
              className="grid grid-cols-[2.2rem_1fr] gap-3 rounded-2xl bg-[#0f2a1f] px-4 py-4 text-white"
            >
              <span className="grid h-8 w-8 place-items-center rounded-full bg-[#163d2c] text-xs font-bold text-[#d4b46a]">
                {step.n}
              </span>
              <div>
                <p className="text-sm font-semibold leading-6">{step.title}</p>
                <p className="mt-1 text-sm leading-6 text-[#c9d7cf]">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
        <p className="mt-3 text-sm leading-6 text-[#4d5c55]">
          Duración estimada de obra:{" "}
          <strong>{p.executionDays} días hábiles</strong>. La legalización ante
          el operador de red o el comercializador depende de sus calendarios,
          no del de Genera. Vigencia de esta cotización: {p.validUntilDays}{" "}
          días calendario.
        </p>
      </section>

      <section>
        <DocH2>Deducción del 50 % en renta y tratamiento del IVA</DocH2>
        <p className="mt-2 text-sm leading-7 text-[#4d5c55]">
          Usted paga el proyecto ahora:{" "}
          <strong>{cop.format(p.totalCOP)}</strong>. La Ley 1715 / 2099 no le
          rebaja esa cifra en esta factura. El incentivo llega después, en la
          declaración de impuestos, si su contador acredita el proyecto ante la
          DIAN.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-[#eee9de] bg-[#fbfaf6] px-4 py-4 text-sm leading-6 text-[#4d5c55]">
            <p className="text-[11px] font-semibold tracking-wide text-[#8a6b2a] uppercase">
              Deducción del 50 % en renta
            </p>
            <p className="mt-2">
              Sobre la inversión se toma el 50 % como base deducible:{" "}
              <strong className="text-[#12241c]">
                {cop.format(p.taxes.rentaDeductionBaseCOP)}
              </strong>{" "}
              (la mitad de {cop.format(p.subtotalCOP)}). Esa suma se resta de la
              renta líquida, no se gira en efectivo. Con tarifa de renta del 35 %,
              el ahorro fiscal es aproximadamente el 35 % de esa base,
              distribuido hasta en 15 años. En este diseño, el beneficio
              estimado del primer año es{" "}
              <strong className="text-[#12241c]">
                {cop.format(p.year1TaxSavingsCOP)}
              </strong>
              . En corto: no le entregan la mitad de la planta; le dejan
              deducir la mitad y el impuesto baja sobre esa deducción.
            </p>
          </div>
          <div className="rounded-2xl border border-[#eee9de] bg-[#fbfaf6] px-4 py-4 text-sm leading-6 text-[#4d5c55]">
            <p className="text-[11px] font-semibold tracking-wide text-[#8a6b2a] uppercase">
              IVA de paneles y devolución
            </p>
            <p className="mt-2">
              Los módulos fotovoltaicos van con exclusión de IVA: ese renglón no
              se grava. El IVA de esta oferta (
              <strong className="text-[#12241c]">{cop.format(p.ivaCOP)}</strong>
              ) recae sobre inversor, estructura, protecciones y servicios. Si
              es responsable de IVA, ese impuesto suele ser descontable o
              susceptible de devolución según la Ley 1715; la referencia de
              esta cotización es{" "}
              <strong className="text-[#12241c]">
                {cop.format(p.taxes.ivaRefundCOP || p.ivaCOP)}
              </strong>
              . Quien no es responsable de IVA no recupera ese saldo por esta
              vía. Lo confirma su contador, no Genera.
            </p>
          </div>
        </div>
      </section>

      <section>
        <DocH2>Garantías del diseño cotizado</DocH2>
        <ul className="mt-3 space-y-1 text-sm leading-6">
          {warranties.map((item) => (
            <li key={item.id}>
              <strong>{item.label}:</strong> {yearsLabel(item.years)}
              {item.detail.trim() ? ` · ${item.detail.trim()}` : ""}
            </li>
          ))}
        </ul>
      </section>

      {p.bonuses.length ? (
        <section>
          <DocH2>Bonos y compromisos incluidos</DocH2>
          <p className="mt-2 text-sm leading-6 text-[#4d5c55]">
            Los siguientes ítems forman parte de esta propuesta porque fueron
            habilitados para el cliente. Si un compromiso no aparece en esta
            lista, no está incluido ni se entiende prometido.
          </p>
          <ol className="mt-4 space-y-3">
            {p.bonuses.map((b, i) => (
              <li
                key={b.id}
                className="rounded-2xl border border-[#eee9de] bg-[#fbfaf6] px-4 py-3"
              >
                <p className="text-[11px] font-semibold tracking-wide text-[#8a6b2a] uppercase">
                  Compromiso {String(i + 1).padStart(2, "0")}
                </p>
                <p className="mt-1 font-medium text-[#12241c]">{b.title}</p>
                <p className="text-xs font-medium text-[#1f6b45]">{b.tagline}</p>
                <p className="mt-2 text-sm leading-6 text-[#4d5c55]">
                  {b.description}
                </p>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      <Callout title="Criterio para comparar esta oferta">
        Solicite a cualquier otro proponente la misma potencia DC, la misma
        potencia AC de inversor, las mismas marcas, estructura certificada,
        protecciones, cuadrilla y legalización. Una cifra inferior suele
        corresponder a un alcance menor. El valor de referencia para aprobar
        esta propuesta es <strong>{cop.format(p.totalCOP)}</strong>.
      </Callout>

      <section className="rounded-[24px] bg-[#0f2a1f] px-6 py-8 text-white">
        <p className="text-[11px] font-semibold tracking-[0.2em] text-[#d4b46a] uppercase">
          Invitación a decidir
        </p>
        <h2 className="mt-3 text-2xl font-semibold leading-8">
          El sol ya está en su cubierta. Lo que falta es ponerlo a trabajar
          para {p.clientName}.
        </h2>
        <p className="mt-4 text-sm leading-7 text-[#c9d7cf]">
          Cada mes que esta planta no entra en operación, su casa, negocio y/o
          empresa sigue comprando al comercializador los{" "}
          {num.format(p.annualGenerationKWh / 12)} kWh que este diseño ya puede
          producir. No es un gasto: es adelantar {cop.format(p.totalCOP)} para
          dejar de pagar una factura que, de otro modo, se va a repetir durante
          veinticinco años.
        </p>
        <p className="mt-4 border-t border-white/15 pt-4 text-sm leading-7 text-white">
          Autorice el inicio hoy. Una llamada al{" "}
          <strong>317 455 3288</strong> basta
          para confirmar el cierre, bloquear el suministro y fijar fecha de
          montaje. El resto lo ejecuta Genera.
        </p>
      </section>
    </DeliverableShell>
  );
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-2xl border border-[#eee9de] bg-[#fbfaf6] px-4 py-4">
      <p className="text-[11px] font-semibold tracking-wide text-[#8a6b2a] uppercase">
        {label}
      </p>
      <p className="mt-1 text-xl font-semibold text-[#12241c]">{value}</p>
      <p className="mt-1 text-xs leading-5 text-[#6d7c74]">{hint}</p>
    </div>
  );
}

