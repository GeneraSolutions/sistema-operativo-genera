"use client";

import { DeliverableShell, DocH2 } from "@/components/deliverables/DeliverableShell";
import { GENERA_LEGAL } from "@/lib/company-legal";
import { formatNit } from "@/lib/client-party";
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

function todayLabel() {
  return new Date().toLocaleDateString("es-CO", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function CommercialContract({ proposal: p }: { proposal: EpcProposal }) {
  const equipos = p.kind === "equipos";
  const nit = formatNit(p.clientNit || "", p.clientDv);
  const warranties = visibleWarrantyItems(
    cloneWarranties(p.warranties),
    p.includeBattery
  );
  const title = equipos
    ? "Contrato de suministro de equipos"
    : "Contrato de suministro e instalación de sistema solar fotovoltaico";

  return (
    <DeliverableShell
      proposal={p}
      accent="official"
      kicker="Documento contractual · Genera Solutions SAS"
      title={title}
      subtitle={`Elaborado a partir de la cotización ${p.id.slice(0, 8).toUpperCase()} del ${p.createdAt}. Las partes lo revisan para decidir el cierre. No sustituye la firma manuscrita o electrónica de ambas partes.`}
    >
      <p className="text-sm leading-7 text-[#4d5c55]">
        En {p.clientCity || GENERA_LEGAL.city}, a {todayLabel()}, se celebran el
        presente contrato entre:
      </p>

      <section className="rounded-2xl border border-[#eee8dc] bg-[#fbfaf6] p-4 text-sm leading-7">
        <p>
          <strong>EL CONTRATISTA:</strong> {GENERA_LEGAL.name}
          {GENERA_LEGAL.nit ? `, NIT ${GENERA_LEGAL.nit}` : ""}, con domicilio en{" "}
          {GENERA_LEGAL.city}, correo {GENERA_LEGAL.email}, teléfono{" "}
          {GENERA_LEGAL.phone}. En adelante, «Genera Solutions SAS».
        </p>
        <p className="mt-3">
          <strong>EL CONTRATANTE:</strong> {p.clientName}
          {nit ? `, identificado con NIT ${nit}` : ""}
          {p.clientAddress ? `, con dirección en ${p.clientAddress}` : ""}
          {p.clientCity ? `, ${p.clientCity}` : ""}
          {p.clientEmail ? `. Correo: ${p.clientEmail}` : ""}
          {p.clientPhone ? `. Teléfono: ${p.clientPhone}` : ""}. En adelante, «el
          Cliente».
        </p>
      </section>

      <section>
        <DocH2>Artículo 1. Objeto</DocH2>
        {equipos ? (
          <p className="text-sm leading-7 text-[#4d5c55]">
            Genera Solutions SAS se obliga a vender y entregar al Cliente los equipos descritos
            en la cotización anexa, en las cantidades y especificaciones allí
            indicadas. Este contrato <strong>no incluye</strong> instalación,
            ingeniería de detalle, visita técnica, obra civil, trámites RETIE,
            UPME ni conexión ante el operador de red, salvo que se pacte por
            escrito en un documento posterior.
          </p>
        ) : (
          <p className="text-sm leading-7 text-[#4d5c55]">
            Genera Solutions SAS se obliga a suministrar e instalar un sistema solar
            fotovoltaico de {num.format(p.systemKwp)} kWp, según la cotización
            anexa: {p.panelCount} módulos {p.panelLabel}; inversor {p.inverterLabel}{" "}
            ({num.format(p.inverterKwAc)} kW AC)
            {p.includeBattery ? `; almacenamiento ${p.batteryLabel}` : ""}.
            Montaje: {p.mountLabel}. El alcance técnico es el de las categorías
            comerciales de esa oferta.
          </p>
        )}
      </section>

      <section>
        <DocH2>Artículo 2. Anexo — la cotización</DocH2>
        <p className="text-sm leading-7 text-[#4d5c55]">
          La cotización comercial identificada con el código{" "}
          <strong>{p.id}</strong>, vigencia {p.validUntilDays} días, forma parte
          integral de este contrato. En caso de contradicción entre este texto y
          la cotización sobre precio, cantidades o equipos, prevalece la
          cotización publicada. En lo demás, prevalece este contrato.
        </p>
        <div className="mt-3 overflow-hidden rounded-xl border border-[#eee8dc]">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#f7f4ee] text-xs uppercase tracking-wide text-[#6d7c74]">
              <tr>
                <th className="px-3 py-2">Ítem</th>
                <th className="px-3 py-2 text-right">Cant.</th>
              </tr>
            </thead>
            <tbody>
              {p.commercialLines.map((line) => (
                <tr key={line.index} className="border-t border-[#eee8dc]">
                  <td className="px-3 py-2">
                    <p className="font-medium">{line.title}</p>
                    {line.description ? (
                      <p className="text-xs text-[#6d7c74]">{line.description}</p>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 text-right">{line.qty}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <DocH2>Artículo 3. Precio e impuestos</DocH2>
        <p className="text-sm leading-7 text-[#4d5c55]">
          El valor del contrato es <strong>{cop.format(p.totalCOP)}</strong>{" "}
          {p.ivaCOP > 0
            ? `(subtotal ${cop.format(p.subtotalCOP)} + IVA ${cop.format(p.ivaCOP)})`
            : "(sin IVA en el alcance cotizado, o IVA no aplicado a estos ítems)"}
          . Los precios están en pesos colombianos. Si el Cliente es agente
          retenedor, aplicará las retenciones de ley al momento de pagar la
          factura
          {p.withholdingsNote ? `: ${p.withholdingsNote}` : "."} Variaciones de
          TRM, aranceles o fletes posteriores a la vigencia de la cotización
          podrán ajustarse de común acuerdo si afectan equipos importados aún no
          despachados.
        </p>
      </section>

      <section>
        <DocH2>Artículo 4. Forma de pago</DocH2>
        <p className="text-sm leading-7 text-[#4d5c55]">
          Modalidad: <strong>{p.payment.modality}</strong>. {p.payment.summary}.
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[#4d5c55]">
          {p.payment.installments.map((row) => (
            <li key={row.key}>
              {row.label}
              {row.percent != null ? ` (${row.percent}%)` : ""}:{" "}
              {cop.format(row.amountCOP)} — {row.hint}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-sm leading-7 text-[#4d5c55]">
          El pago se hace contra factura de Genera Solutions SAS. Mientras exista saldo, la
          propiedad de los equipos permanece en cabeza de Genera Solutions SAS. El retraso
          superior a quince (15) días calendario autoriza a Genera Solutions SAS a suspender
          despachos o la obra, sin perjuicio de cobrar intereses de mora a la
          tasa máxima legal.
        </p>
      </section>

      <section>
        <DocH2>
          {equipos ? "Artículo 5. Entrega" : "Artículo 5. Plazo de ejecución"}
        </DocH2>
        {equipos ? (
          <p className="text-sm leading-7 text-[#4d5c55]">
            El plazo de despacho de referencia es de {p.executionDays} días
            hábiles tras el pago que habilite el pedido, sujeto a stock y a
            tiempos de importación informados. El riesgo de la cosa se
            transfiere al Cliente con la entrega en el sitio o transportador
            convenido. El Cliente verifica cantidades y estado aparente al
            recibir; reclamos por faltantes o daños de transporte se
            comunican por escrito dentro de las setenta y dos (72) horas
            siguientes.
          </p>
        ) : (
          <p className="text-sm leading-7 text-[#4d5c55]">
            El plazo de ejecución estimado es de {p.executionDays} días hábiles
            desde el cumplimiento del anticipo y de las condiciones de sitio a
            cargo del Cliente (acceso, punto de conexión, permisos de
            cubierta/predio). Retrasos imputables al Cliente, al operador de
            red, a autoridad o a fuerza mayor no constituyen incumplimiento de
            Genera Solutions SAS y desplazan el cronograma en igual medida.
          </p>
        )}
      </section>

      <section>
        <DocH2>Artículo 6. Obligaciones de las partes</DocH2>
        <p className="text-sm font-semibold text-[#12241c]">Genera Solutions SAS se obliga a:</p>
        <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-[#4d5c55]">
          {equipos ? (
            <>
              <li>Entregar los equipos cotizados, nuevos y de procedencia lícita.</li>
              <li>Facturar conforme a la ley colombiana y al RUT del Cliente.</li>
              <li>Trasladar las garantías de fábrica según el artículo 7.</li>
            </>
          ) : (
            <>
              <li>Ejecutar el alcance de la cotización con personal idóneo.</li>
              <li>Cumplir NTC 2050, RETIE y normas aplicables al montaje cotizado.</li>
              <li>Entregar al Cliente la documentación pactada (fichas, certificado, manual) según el momento comercial acordado.</li>
            </>
          )}
        </ul>
        <p className="mt-3 text-sm font-semibold text-[#12241c]">
          El Cliente se obliga a:
        </p>
        <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-[#4d5c55]">
          <li>Pagar en los plazos del artículo 4.</li>
          <li>Suministrar información veraz (incluido RUT) para facturación y retenciones.</li>
          {equipos ? (
            <li>
              Recibir los equipos y disponer de sitio seguro. La instalación, si
              la requiere, es un contrato distinto.
            </li>
          ) : (
            <>
              <li>
                Facilitar acceso al predio, energía de obra, puntos de anclaje
                y condiciones de cubiertas/estructura aptas. Daños preexistentes
                de la edificación no son a cargo de Genera Solutions SAS.
              </li>
              <li>
                Tramitar o colaborar en permisos de copropiedad, operador de red,
                UPME u otros que no estén expresamente incluidos en la
                cotización.
              </li>
            </>
          )}
        </ul>
      </section>

      <section>
        <DocH2>Artículo 7. Garantías</DocH2>
        {warranties.length ? (
          <ul className="list-disc space-y-1 pl-5 text-sm text-[#4d5c55]">
            {warranties.map((item) => (
              <li key={item.id}>
                {item.label}: {yearsLabel(item.years)}
                {item.detail.trim() ? ` · ${item.detail.trim()}` : ""}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm leading-7 text-[#4d5c55]">
            Garantías de fábrica de los equipos listados, según el fabricante.
          </p>
        )}
        {p.warranties?.notes ? (
          <p className="mt-2 text-sm leading-7 text-[#4d5c55]">
            {p.warranties.notes}
          </p>
        ) : null}
        <p className="mt-3 text-sm leading-7 text-[#4d5c55]">
          Las garantías de producto las cubre el fabricante. Genera Solutions SAS gestiona el
          canal de reclamo durante el periodo indicado, siempre que el Cliente
          haya pagado el contrato y no haya alterado, sobrecargado o instalado
          indebidamente los equipos. Quedan excluidos daños por mal manejo,
          humedad, descargas atmosféricas, vandalismo, conexión incorrecta por
          terceros y uso distinto al previsto.
        </p>
      </section>

      {!equipos ? (
        <section>
          <DocH2>Artículo 8. Generación y ahorros</DocH2>
          <p className="text-sm leading-7 text-[#4d5c55]">
            Las cifras de generación ({num.format(p.annualGenerationKWh)} kWh/año
            de referencia) y de ahorro en la cotización son estimaciones con
            base en HSP, tarifa e hipótesis de la oferta. No constituyen
            resultado financiero garantizado. El consumo real, sombras, suciedad,
            degradación, recortes de red y cambios tarifarios del comercializador
            pueden apartarse de la proyección. El Cliente lo declara entendido
            al firmar.
          </p>
        </section>
      ) : null}

      <section>
        <DocH2>{equipos ? "Artículo 8" : "Artículo 9"}. Limitación de responsabilidad</DocH2>
        <p className="text-sm leading-7 text-[#4d5c55]">
          La responsabilidad total de Genera Solutions SAS por este contrato, incluida culpa
          leve, se limita al valor efectivamente pagado por el Cliente. No hay
          lugar a lucro cesante, daño emergente indirecto ni pérdida de ahorros
          esperados. Esta limitación no aplica en dolo o culpa grave de Genera Solutions SAS,
          ni en lesiones a personas imputables a ella. El Cliente mantiene
          asegurada su edificación y bienes. Genera Solutions SAS no responde por la estructura
          existente del predio ni por redes internas ajenas al alcance cotizado.
        </p>
      </section>

      <section>
        <DocH2>{equipos ? "Artículo 9" : "Artículo 10"}. Fuerza mayor</DocH2>
        <p className="text-sm leading-7 text-[#4d5c55]">
          Guerra, pandemia, desastres naturales, actos de autoridad, escasez
          extraordinaria de fletes o de equipos del fabricante, y fallas del
          operador de red ajenas a Genera Solutions SAS, suspenden plazos mientras dure el
          evento. La parte afectada informa a la otra tan pronto le sea posible.
        </p>
      </section>

      <section>
        <DocH2>{equipos ? "Artículo 10" : "Artículo 11"}. Terminación</DocH2>
        <p className="text-sm leading-7 text-[#4d5c55]">
          Cualquiera puede terminar por incumplimiento grave no subsanado en diez
          (10) días hábiles desde el requerimiento escrito. Si el Cliente
          desiste sin causa después de pedido de equipos, Genera Solutions SAS retiene los
          costos ya comprometidos y hasta el treinta por ciento (30%) del valor
          del contrato como cláusula penal, sin perjuicio de mayores daños
          demostrados. Lo pagado de más, si lo hay, se reembolsa en treinta (30)
          días. La terminación no extingue cláusulas de precio, garantías,
          limitación de responsabilidad ni confidencialidad.
        </p>
      </section>

      <section>
        <DocH2>{equipos ? "Artículo 11" : "Artículo 12"}. Datos personales y confidencialidad</DocH2>
        <p className="text-sm leading-7 text-[#4d5c55]">
          Los datos del Cliente (incluido el RUT) se usan para cotizar, facturar
          y ejecutar este contrato, conforme a la Ley 1581 de 2012. El Cliente
          autoriza ese tratamiento. Ninguna parte divulga precios, diseños ni
          información técnica de la otra, salvo obligación legal.
        </p>
      </section>

      <section>
        <DocH2>{equipos ? "Artículo 12" : "Artículo 13"}. Ley y controversias</DocH2>
        <p className="text-sm leading-7 text-[#4d5c55]">
          Se rige por la ley colombiana. Las partes intentan arreglo directo en
          quince (15) días hábiles. De persistir, son competentes los jueces de
          la República de Colombia en el domicilio del Cliente o, a elección de
          Genera Solutions SAS, en el del CONTRATISTA. Se pacta la cláusula de integridad: este
          contrato y la cotización anexa son el acuerdo completo y sustituyen
          tratativas previas sobre el mismo objeto.
        </p>
      </section>

      <section>
        <DocH2>{equipos ? "Artículo 13" : "Artículo 14"}. Aceptación</DocH2>
        <p className="text-sm leading-7 text-[#4d5c55]">
          El Cliente declara haber leído la cotización y este contrato, y que la
          información de identificación es correcta. La aceptación puede
          constar por firma manuscrita, firma electrónica o correo inequívoco
          desde la dirección {p.clientEmail || "registrada en la cotización"}.
        </p>
      </section>

      <section className="grid gap-8 pt-4 sm:grid-cols-2">
        <SignBlock
          role="EL CONTRATANTE"
          name={p.clientName}
          extra={nit ? `NIT ${nit}` : p.clientCity}
        />
        <SignBlock
          role="EL CONTRATISTA"
          name={GENERA_LEGAL.name}
          extra={GENERA_LEGAL.nit ? `NIT ${GENERA_LEGAL.nit}` : GENERA_LEGAL.email}
        />
      </section>

      <p className="text-[11px] leading-5 text-[#6d7c74]">
        Plantilla generada por el Sistema Operativo Solar de Genera Solutions SAS a partir de
        la cotización. Es un documento comercial de trabajo. Un abogado
        colombiano puede revisarlo antes de usarlo en operaciones de alto valor
        o con cláusulas especiales (PPA, financiación, predios en copropiedad).
      </p>
    </DeliverableShell>
  );
}

function SignBlock({
  role,
  name,
  extra,
}: {
  role: string;
  name: string;
  extra?: string;
}) {
  return (
    <div className="text-sm">
      <p className="text-[11px] font-semibold tracking-[0.16em] text-[#8a6b2a] uppercase">
        {role}
      </p>
      <div className="mt-12 border-t border-[#12241c] pt-2">
        <p className="font-medium">{name}</p>
        {extra ? <p className="text-xs text-[#6d7c74]">{extra}</p> : null}
        <p className="mt-1 text-xs text-[#6d7c74]">Nombre, firma y documento</p>
      </div>
    </div>
  );
}
