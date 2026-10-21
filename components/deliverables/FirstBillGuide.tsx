"use client";

import { Callout, DeliverableShell, DocH2 } from "@/components/deliverables/DeliverableShell";
import type { EpcProposal } from "@/types/proposal";

const cop = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});
const num = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });

export function FirstBillGuide({ proposal: p }: { proposal: EpcProposal }) {
  const monthlyGen = Math.round(p.annualGenerationKWh / 12);
  const monthlyUse = p.monthlyEnergy[0]
    ? Math.round(
        p.monthlyEnergy.reduce((a, m) => a + m.consumptionKWh, 0) / 12
      )
    : 0;

  return (
    <DeliverableShell
      proposal={p}
      kicker="Post conexión · Guía de factura"
      title="Su primera factura con solar, sin sustos"
      subtitle={`${p.clientName}: cuando los paneles se conectan, la factura del comercializador cambia de cara. Esta guía explica las tres palabras que importan y por qué el primer ciclo casi nunca se parece al segundo.`}
    >
      <section className="grid gap-3 sm:grid-cols-3">
        <BillCard
          title="Autoconsumo"
          lead="Sol que se usó en la casa o la empresa"
          body="Esa energía no pasa por el medidor de compra. Es el ahorro más limpio: kWh que ya no le compra al comercializador."
        />
        <BillCard
          title="Excedentes"
          lead="Sol que sobró y salió a la red"
          body="Si produce más de lo que está usando, el medidor registra exportación. Eso suele aparecer como un crédito o un saldo, no como un «premio» en efectivo el mismo día."
        />
        <BillCard
          title="Cargo fijo / comercializador"
          lead="Lo que no se apaga con el sol"
          body="El comercializador sigue cobrando cargos de comercializar, alumbrado o contribución según su estrato o tipo de usuario. El solar baja el consumo; no borra toda la factura."
        />
      </section>

      <section>
        <DocH2>Una imagen mental</DocH2>
        <div className="mt-3 overflow-hidden rounded-2xl border border-[#ddd6c8]">
          <div className="grid sm:grid-cols-3">
            <Flow
              from="Sol"
              to="Sus cargas"
              note="Autoconsumo. Ni entra ni sale de la red. Es el mejor kWh."
            />
            <Flow
              from="Sol de más"
              to="La red"
              note="Excedente. Queda registrado para cruzar en la factura."
            />
            <Flow
              from="La red"
              to="Sus cargas"
              note="De noche o con nubes. Sigue apareciendo como consumo."
            />
          </div>
        </div>
      </section>

      <section>
        <DocH2>Por qué la primera factura se ve «rara»</DocH2>
        <ol className="mt-3 space-y-3 text-sm leading-6 text-[#4d5c55]">
          <li>
            <strong className="text-[#12241c]">El ciclo se parte.</strong> El
            comercializador no espera al 1° del mes. Si Genera Solutions SAS energizó un
            martes, esa factura mezcla días sin solar y días con solar. Eso se
            llama prorrateo: no es un error, es una cuenta a medias.
          </li>
          <li>
            <strong className="text-[#12241c]">Hay lecturas viejas y nuevas.</strong>{" "}
            A veces llega un ajuste del medidor anterior, una reliquidación o un
            estimado. Compárela con la app de monitoreo, no con el recuerdo del
            mes pasado.
          </li>
          <li>
            <strong className="text-[#12241c]">El sol no es un sueldo fijo.</strong>{" "}
            Esta planta está dimensionada para unos{" "}
            {num.format(monthlyGen)} kWh/mes de generación y un consumo de
            referencia de {num.format(monthlyUse)} kWh/mes. Un mes de invierno
            andino no se parece a un mes seco.
          </li>
        </ol>
        <Callout title="Qué sí esperar en un mes «normal»">
          Ahorro energético de referencia en esta cotización:{" "}
          <strong>{cop.format(p.annualEnergySavingsCOP)}</strong> al año, unos{" "}
          {cop.format(Math.round(p.annualEnergySavingsCOP / 12))} al mes, con
          tarifa {cop.format(Math.round(p.annualEnergySavingsCOP / Math.max(p.annualGenerationKWh, 1)))}
          /kWh de trabajo. No incluye el vaivén de la contribución ni de cargos
          fijos.
        </Callout>
      </section>

      <section>
        <DocH2>Cómo leer la hoja del comercializador</DocH2>
        <div className="mt-3 overflow-hidden rounded-2xl border border-[#ddd6c8] bg-[#fbfaf6] font-mono text-sm">
          <div className="grid grid-cols-[1fr_auto] gap-2 border-b border-[#eee9de] px-4 py-2 text-xs tracking-wide text-[#8a6b2a] uppercase">
            <span>Concepto (ejemplo de lectura)</span>
            <span>Qué significa</span>
          </div>
          {[
            ["Consumo activo kWh", "Lo que aún le compró a la red"],
            ["Energía inyectada / excedentes", "Lo que exportó su planta"],
            ["Comercialización / cargo fijo", "No lo apaga el panel"],
            ["Contribución / subsidio", "Regla del usuario, no de Genera Solutions SAS"],
            ["Saldo a favor", "Cruce de excedentes; no siempre es plata líquida"],
          ].map(([a, b]) => (
            <div
              key={a}
              className="grid grid-cols-[1fr_auto] gap-3 border-t border-[#eee9de] px-4 py-2.5"
            >
              <span className="font-sans text-[#12241c]">{a}</span>
              <span className="max-w-[14rem] text-right font-sans text-xs text-[#6d7c74]">
                {b}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section>
        <DocH2>Sesión breve incluida</DocH2>
        <p className="mt-2 text-sm leading-7 text-[#4d5c55]">
          Cuando llegue la primera factura real, agende 20–30 minutos con
          Genera Solutions SAS. Lleve el PDF del comercializador y la captura del monitoreo
          del mismo periodo. Juntos marcamos cada renglón. Si el bono de
          «revisión mes 1 y mes 3» está en su oferta, esa cita ya está pagada.
        </p>
      </section>
    </DeliverableShell>
  );
}

function BillCard({
  title,
  lead,
  body,
}: {
  title: string;
  lead: string;
  body: string;
}) {
  return (
    <article className="rounded-2xl border border-[#ddd6c8] bg-white px-4 py-4">
      <p className="text-[11px] font-semibold tracking-[0.16em] text-[#1f6b45] uppercase">
        {title}
      </p>
      <p className="mt-2 font-medium text-[#12241c]">{lead}</p>
      <p className="mt-2 text-sm leading-6 text-[#4d5c55]">{body}</p>
    </article>
  );
}

function Flow({ from, to, note }: { from: string; to: string; note: string }) {
  return (
    <div className="border-b border-[#eee9de] px-4 py-4 sm:border-b-0 sm:border-r sm:last:border-r-0">
      <p className="text-sm font-semibold text-[#12241c]">
        {from} → {to}
      </p>
      <p className="mt-2 text-xs leading-5 text-[#6d7c74]">{note}</p>
    </div>
  );
}
