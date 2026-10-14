"use client";

import { Callout, DeliverableShell, DocH2 } from "@/components/deliverables/DeliverableShell";
import {
  cloneWarranties,
  visibleWarrantyItems,
  yearsLabel,
} from "@/lib/warranties";
import type { EpcProposal } from "@/types/proposal";

const num = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 1 });

export function UserManual({ proposal: p }: { proposal: EpcProposal }) {
  const warranties = visibleWarrantyItems(
    cloneWarranties(p.warranties),
    p.includeBattery
  );

  return (
    <DeliverableShell
      proposal={p}
      kicker="Entrega de obra · Manual de usuario"
      title={`Su planta ${num.format(p.systemKwp)} kWp`}
      subtitle={`Manual personalizado para ${p.clientName}. Se entrega cuando el sistema cotizado queda instalado y energizado. Guárdelo con las fichas técnicas y el certificado de puesta en marcha.`}
    >
      <section className="overflow-hidden rounded-2xl border border-[#0f2a1f] bg-[#0f2a1f] text-white">
        <div className="grid gap-0 sm:grid-cols-2">
          <div className="px-5 py-5">
            <p className="text-[11px] tracking-[0.18em] text-[#d4b46a] uppercase">
              Cédula de la planta
            </p>
            <dl className="mt-3 space-y-1.5 text-sm">
              <Row k="Cliente" v={p.clientName} />
              <Row k="Sitio" v={`${p.clientCity} · ${p.mountLabel}`} />
              <Row k="Potencia DC" v={`${num.format(p.systemKwp)} kWp`} />
              <Row k="Inversor" v={`${p.inverterKwAc} kW AC · ${p.inverterLabel}`} />
              <Row k="Módulos" v={`${p.panelCount} × ${p.panelWatts} W · ${p.panelLabel}`} />
              {p.includeBattery ? (
                <Row k="Batería" v={`${p.batteryKwh} kWh · ${p.batteryLabel}`} />
              ) : (
                <Row k="Batería" v="No incluida en este alcance" />
              )}
            </dl>
          </div>
          <div className="border-t border-white/10 px-5 py-5 sm:border-l sm:border-t-0">
            <p className="text-[11px] tracking-[0.18em] text-[#d4b46a] uppercase">
              Contactos GENERA
            </p>
            <p className="mt-3 text-sm leading-6 text-[#c9d7cf]">
              Soporte: 317 455 3288 · 302 106 6719
              <br />
              Correo: info@generasolutions.co
              <br />
              Emergencia eléctrica del predio: corte el breaker de la planta y
              llame. No abra el inversor.
            </p>
          </div>
        </div>
      </section>

      <section>
        <DocH2>1. Cómo se opera (día a día)</DocH2>
        <p className="mt-2 text-sm leading-7 text-[#4d5c55]">
          Una planta bien entregada casi no se toca. El inversor debe quedar en
          modo automático. Usted no «prende el sol» cada mañana.
        </p>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-6 text-[#4d5c55]">
          <li>Revise la app de monitoreo: producción del día vs. días parecidos.</li>
          <li>Si hay baterías, confirme que cargan de día y respaldan de noche según el modo dejado en la entrega.</li>
          <li>No cubra paneles, no cuelgue ropa en la estructura, no apile cosas en el inversor.</li>
          <li>Si va a hacer obra en techo o pintura, avise a GENERA antes de desconectar.</li>
        </ol>
      </section>

      <section>
        <DocH2>2. Cómo se lee el monitoreo</DocH2>
        <p className="mt-2 text-sm leading-7 text-[#4d5c55]">
          La curva típica sube con el sol, baja con nubes y cae a cero de noche
          {p.includeBattery ? " (la batería puede seguir alimentando cargas)" : ""}.
          Un día nublado no es una falla. Una semana en cero, o un inversor en
          rojo, sí lo es: escriba o llame.
        </p>
        <Callout title="Regla práctica">
          Si la app dice que hubo producción y la factura no bajó, no asuma que
          «el sistema no sirve». Pida la revisión factura vs. producción (mes 1
          y 3) que va con su contrato.
        </Callout>
      </section>

      <section>
        <DocH2>3. Emergencias</DocH2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-[#c45c4a]/40 bg-[#fde8e8] px-4 py-3 text-sm leading-6 text-[#6b2a22]">
            <p className="font-semibold">Corte ya</p>
            <p className="mt-1">
              Humo, olor a quemado, agua dentro del tablero, o un golpe fuerte
              en el inversor: abra el breaker de la planta (le indicamos cuál
              en la entrega) y no lo rearme. Llame a GENERA.
            </p>
          </div>
          <div className="rounded-2xl border border-[#ddd6c8] bg-[#fbfaf6] px-4 py-3 text-sm leading-6 text-[#4d5c55]">
            <p className="font-semibold text-[#12241c]">No es emergencia</p>
            <p className="mt-1">
              Día nublado, lluvia, una alerta de firmware, o la app desactualizada
              por Wi-Fi. Revise internet del datalogger y escríbanos en horario
              hábil.
            </p>
          </div>
        </div>
      </section>

      <section>
        <DocH2>4. Equipos de esta cotización</DocH2>
        <ul className="mt-3 space-y-2">
          {(p.datasheets ?? []).map((d) => (
            <li
              key={d.itemId}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#eee9de] px-3 py-2 text-sm"
            >
              <span>
                <strong>{d.label}</strong>
                <span className="text-[#6d7c74]">
                  {" "}
                  · {d.brand} · {d.model}
                </span>
              </span>
              {d.datasheetUrl ? (
                <a
                  className="text-[#1f6b45] underline"
                  href={d.datasheetUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Ficha del fabricante
                </a>
              ) : (
                <span className="text-xs text-[#8a7f70]">
                  Ficha en el paquete de entrega / inventario GENERA
                </span>
              )}
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-[#6d7c74]">
          El set completo también está en la cotización, pestaña Fichas técnicas.
        </p>
      </section>

      <section>
        <DocH2>5. Garantías que aplican a su planta</DocH2>
        <ul className="mt-3 space-y-1 text-sm leading-6">
          {warranties.map((item) => (
            <li key={item.id}>
              <strong>{item.label}:</strong> {yearsLabel(item.years)}
              {item.detail.trim() ? ` · ${item.detail.trim()}` : ""}
            </li>
          ))}
        </ul>
        <p className="mt-2 text-sm text-[#4d5c55]">
          El primer año GENERA intermedia el trámite con el fabricante si el
          bono de gestor de garantías quedó incluido en su oferta.
        </p>
      </section>

      <Callout title="Este manual no reemplaza RETIE ni al fabricante">
        Es la hoja de ruta GENERA para vivir con su planta. Los datos eléctricos
        oficiales quedan en el certificado de puesta en marcha y en las fichas
        del fabricante.
      </Callout>
    </DeliverableShell>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-[#8aa398]">{k}</dt>
      <dd className="text-right">{v}</dd>
    </div>
  );
}
