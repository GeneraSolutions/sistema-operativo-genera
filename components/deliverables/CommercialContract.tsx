"use client";

import { ContractCedulaCheck } from "@/components/deliverables/ContractCedulaCheck";
import { DeliverableShell, DocH2 } from "@/components/deliverables/DeliverableShell";
import { GENERA_LEGAL } from "@/lib/company-legal";
import { formatClientDocument } from "@/lib/client-party";
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
  const idDoc = formatClientDocument(
    p.clientIdType,
    p.clientNit || "",
    p.clientDv
  );
  const warranties = visibleWarrantyItems(
    cloneWarranties(p.warranties),
    p.includeBattery
  );
  const title = equipos
    ? "Contrato de suministro de equipos"
    : "Contrato de suministro, instalación y puesta en marcha de sistema fotovoltaico";
  const idLabel = idDoc
    ? `identificado con ${idDoc}`
    : "identificado según la cotización anexa";

  return (
    <DeliverableShell
      proposal={p}
      accent="official"
      kicker="Documento contractual · Genera Solutions SAS"
      title={title}
      subtitle={`Elaborado a partir de la cotización ${p.id.slice(0, 8).toUpperCase()} del ${p.createdAt}. Las partes lo revisan para decidir el cierre. No sustituye la firma manuscrita o electrónica de ambas partes.`}
    >
      <p className="text-sm leading-7 text-[#4d5c55]">
        En {p.clientCity || GENERA_LEGAL.city}, a {todayLabel()}, se celebra el
        presente contrato entre:
      </p>

      <section className="rounded-2xl border border-[#eee8dc] bg-[#fbfaf6] p-4 text-sm leading-7">
        <p>
          <strong>EL PROVEEDOR:</strong> {GENERA_LEGAL.name}, persona jurídica
          identificada con NIT {GENERA_LEGAL.nit}, con domicilio en{" "}
          {GENERA_LEGAL.address}, correo {GENERA_LEGAL.email}, teléfono{" "}
          {GENERA_LEGAL.phone}. En adelante, «Genera Solutions SAS» o «el
          Proveedor».
        </p>
        <p className="mt-3">
          <strong>EL CLIENTE:</strong> {p.clientName}, {idLabel}
          {p.clientAddress ? `, con dirección en ${p.clientAddress}` : ""}
          {p.clientCity ? `, ${p.clientCity}` : ""}
          {p.clientEmail ? `. Correo: ${p.clientEmail}` : ""}
          {p.clientPhone ? `. Teléfono: ${p.clientPhone}` : ""}. En adelante, «el
          Cliente».
        </p>
      </section>

      <ContractCedulaCheck proposal={p} />

      <section>
        <DocH2>Artículo 1. Objeto</DocH2>
        {equipos ? (
          <p className="mt-2 text-sm leading-7 text-[#4d5c55]">
            Genera Solutions SAS se obliga a vender y entregar al Cliente los
            equipos descritos en la cotización anexa, en las cantidades y
            especificaciones allí indicadas. Este contrato{" "}
            <strong>no incluye</strong> instalación, ingeniería de detalle,
            visita técnica, obra civil, trámites RETIE, UPME ni conexión ante el
            operador de red, salvo que se pacte por escrito en un documento
            posterior.
          </p>
        ) : (
          <p className="mt-2 text-sm leading-7 text-[#4d5c55]">
            El Cliente adquiere de Genera Solutions SAS el suministro,
            instalación y puesta en marcha de un sistema solar fotovoltaico de{" "}
            {num.format(p.systemKwp)} kWp, según la cotización anexa:{" "}
            {p.panelCount} módulos {p.panelLabel}; inversor {p.inverterLabel} (
            {num.format(p.inverterKwAc)} kW AC)
            {p.includeBattery ? `; almacenamiento ${p.batteryLabel}` : ""}.
            Montaje: {p.mountLabel}. El alcance técnico es el de las categorías
            comerciales de esa oferta.
          </p>
        )}
      </section>

      <section>
        <DocH2>Artículo 2. Anexo — la cotización</DocH2>
        <p className="mt-2 text-sm leading-7 text-[#4d5c55]">
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
        <p className="mt-2 text-sm leading-7 text-[#4d5c55]">
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
        <DocH2>Artículo 4. Forma de pago y propiedad</DocH2>
        <p className="mt-2 text-sm leading-7 text-[#4d5c55]">
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
          El pago se hace contra factura de Genera Solutions SAS, en pesos
          colombianos, por transferencia o el medio que conste en la factura.
          Los equipos permanecen de propiedad de Genera Solutions SAS hasta el
          pago total. El retraso superior a diez (10) días calendario autoriza a
          Genera Solutions SAS a suspender despachos o la obra, ampliar plazos
          en igual medida y, si persiste la mora, retirar equipos o ejercer
          acciones legales, sin que ello constituya incumplimiento del
          Proveedor, y sin perjuicio de intereses de mora a la tasa máxima
          legal.
        </p>
      </section>

      <section>
        <DocH2>
          {equipos ? "Artículo 5. Entrega" : "Artículo 5. Plazo de ejecución"}
        </DocH2>
        {equipos ? (
          <p className="mt-2 text-sm leading-7 text-[#4d5c55]">
            El plazo de despacho de referencia es de {p.executionDays} días
            hábiles tras el pago que habilite el pedido, sujeto a stock y a
            tiempos de importación informados. El riesgo de la cosa se
            transfiere al Cliente con la entrega en el sitio o transportador
            convenido. El Cliente verifica cantidades y estado aparente al
            recibir; reclamos por faltantes o daños de transporte se comunican
            por escrito dentro de las setenta y dos (72) horas siguientes.
          </p>
        ) : (
          <p className="mt-2 text-sm leading-7 text-[#4d5c55]">
            El plazo de suministro e instalación es de {p.executionDays} días
            hábiles desde el anticipo y desde que el Cliente haya habilitado
            acceso, punto de conexión y condiciones de cubierta o predio. Ese
            plazo <strong>no cubre</strong> la legalización, interconexión ni
            los tiempos de la CREG, el operador de red o el comercializador,
            que están fuera del control de Genera Solutions SAS. Si el Cliente
            pide esos trámites, el Proveedor facilita requisitos y los gestiona
            en paralelo, sin que el retraso de autoridad desplace a
            incumplimiento. Retrasos imputables al Cliente, a autoridad o a
            fuerza mayor desplazan el cronograma en igual medida.
          </p>
        )}
      </section>

      {!equipos ? (
        <section>
          <DocH2>Artículo 6. Etapas del proyecto</DocH2>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm leading-6 text-[#4d5c55]">
            <li>
              Verificación de sitio (visita o información que el Cliente
              suministre, si se omite la visita).
            </li>
            <li>
              Dimensionamiento y propuesta técnica de ubicación de módulos y
              equipos, para aprobación del Cliente.
            </li>
            <li>
              Instalación: estructura, módulos y demás componentes del alcance.
            </li>
            <li>Encendido, configuración y puesta en marcha.</li>
            <li>
              Interconexión según el alcance cotizado y, si aplica, acompañamiento
              ante el operador de red.
            </li>
            <li>
              Monitoreo remoto: al Cliente se le crea un usuario visualizador en
              la app o plataforma. Genera Solutions SAS conserva el usuario
              administrativo para ajustes técnicos a distancia. No se entrega
              perfil administrativo al Cliente, para no comprometer garantías ni
              la configuración de fábrica.
            </li>
          </ol>
        </section>
      ) : null}

      <section>
        <DocH2>
          {equipos ? "Artículo 6. Obligaciones de las partes" : "Artículo 7. Obligaciones de las partes"}
        </DocH2>
        <p className="mt-2 text-sm font-semibold text-[#12241c]">
          Genera Solutions SAS se obliga a:
        </p>
        <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-[#4d5c55]">
          {equipos ? (
            <>
              <li>Entregar los equipos cotizados, nuevos y de procedencia lícita.</li>
              <li>Facturar conforme a la ley colombiana y al RUT del Cliente.</li>
              <li>Trasladar las garantías de fábrica según el artículo de garantías.</li>
            </>
          ) : (
            <>
              <li>Ejecutar el alcance de la cotización con personal idóneo.</li>
              <li>
                Cumplir NTC 2050, RETIE y normas aplicables al montaje cotizado.
              </li>
              <li>
                Entregar cotización, propuesta de ubicación, fichas y garantías
                de equipos al finalizar, certificado según el momento pactado, y
                capacitación básica de encendido, apagado, monitoreo y parada de
                emergencia (manual de secuencia).
              </li>
              <li>
                Entregar reporte fotográfico del proceso de instalación.
              </li>
              <li>
                Responder frente al Cliente por el trabajo propio y por el
                subcontratado. Podrá subcontratar total o parcialmente. El
                personal de Genera Solutions SAS o de sus subcontratistas no
                tiene relación laboral con el Cliente.
              </li>
            </>
          )}
        </ul>
        <p className="mt-3 text-sm font-semibold text-[#12241c]">
          El Cliente se obliga a:
        </p>
        <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-[#4d5c55]">
          <li>Pagar en los plazos del artículo 4.</li>
          <li>
            Suministrar información veraz (incluido RUT) para facturación y
            retenciones.
          </li>
          {equipos ? (
            <li>
              Recibir los equipos y disponer de sitio seguro. La instalación, si
              la requiere, es un contrato distinto.
            </li>
          ) : (
            <>
              <li>
                Facilitar acceso al predio, energía de obra, factura de energía
                si se requiere para el dimensionamiento, y condiciones de
                cubierta o estructura aptas. Planos y unifilares son opcionales.
              </li>
              <li>
                Declarar que el inmueble cumple condiciones estructurales,
                eléctricas y de seguridad. Daños o retrasos por deficiencias
                preexistentes no son a cargo de Genera Solutions SAS.
              </li>
              <li>
                Tramitar o colaborar en permisos de copropiedad, operador de
                red, UPME u otros que no estén expresamente incluidos en la
                cotización.
              </li>
              <li>
                Informar cambios de alcance que afecten costo o plazo, antes de
                ejecutarlos.
              </li>
            </>
          )}
        </ul>
      </section>

      {!equipos ? (
        <section>
          <DocH2>Artículo 8. Modificaciones al proyecto</DocH2>
          <p className="mt-2 text-sm leading-7 text-[#4d5c55]">
            Antes de instalar, el Cliente valida la propuesta técnica final de
            distribución de módulos, estructura y equipos. Cualquier cambio
            posterior se notifica por escrito o correo. Si incrementa costos o
            plazos, se cotiza como adicional y se firma un convenio
            modificatorio antes de continuar. Si disminuye costos, la diferencia
            se descuenta del saldo pendiente.
          </p>
        </section>
      ) : null}

      <section>
        <DocH2>
          {equipos ? "Artículo 7. Garantías" : "Artículo 9. Garantías"}
        </DocH2>
        {warranties.length ? (
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[#4d5c55]">
            {warranties.map((item) => (
              <li key={item.id}>
                {item.label}: {yearsLabel(item.years)}
                {item.detail.trim() ? ` · ${item.detail.trim()}` : ""}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm leading-7 text-[#4d5c55]">
            Garantías de fábrica de los equipos listados, según el fabricante.
          </p>
        )}
        {p.warranties?.notes ? (
          <p className="mt-2 text-sm leading-7 text-[#4d5c55]">
            {p.warranties.notes}
          </p>
        ) : null}
        <p className="mt-3 text-sm leading-7 text-[#4d5c55]">
          El detalle de cada equipo está en las fichas técnicas que se
          entregan con el sistema o al liberar fichas. Las garantías de producto
          las cubre el fabricante. El Cliente las hace valer únicamente a través
          de Genera Solutions SAS, que gestiona el canal de reclamo durante el
          periodo indicado, siempre que el contrato esté pagado y no se hayan
          alterado, sobrecargado o instalado indebidamente los equipos. No hay
          garantías adicionales a las de las fichas y a las de este contrato.
        </p>
      </section>

      <section>
        <DocH2>
          {equipos
            ? "Artículo 8. Exclusión de garantías de resultado"
            : "Artículo 10. Generación, ahorros y exclusión de resultado"}
        </DocH2>
        <p className="mt-2 text-sm leading-7 text-[#4d5c55]">
          Genera Solutions SAS no garantiza operación ininterrumpida ni libre de
          errores. La producción estimada tiene un margen de variación de más o
          menos veinte por ciento (±20 %) según clima, suciedad, sombras,
          degradación y recortes de red.
          {!equipos
            ? ` Las cifras de la cotización (${num.format(p.annualGenerationKWh)} kWh/año de referencia) son estimaciones, no un resultado financiero asegurado.`
            : ""}{" "}
          No se garantiza un beneficio económico, ni que bajen los pagos a la
          electrificadora o al comercializador: cambian tarifas, contribución y
          hábitos de consumo. Quedan excluidos daños por uso contrario a
          fichas y manuales, intervención de terceros, humedad, descargas
          atmosféricas, vandalismo y uso distinto al previsto.
        </p>
      </section>

      {!equipos ? (
        <section>
          <DocH2>Artículo 11. Exclusiones de obra civil y eléctrica</DocH2>
          <p className="mt-2 text-sm leading-7 text-[#4d5c55]">
            Salvo pacto escrito, quedan fuera del alcance: reforzamientos
            estructurales; adecuaciones civiles o remodelaciones; modificaciones
            internas de la red del inmueble; cambio de cubierta,
            impermeabilizaciones mayores o sustitución de techos; canalizaciones
            ocultas, cielos rasos, muros, zanjas o excavaciones; y adecuaciones
            para normas no informadas por el Cliente. Cualquier adicional se
            cotiza y contrata aparte.
          </p>
          <p className="mt-3 text-sm leading-7 text-[#4d5c55]">
            Si se detectan condiciones que impidan cumplir RETIE, NTC u otras
            normas, Genera Solutions SAS puede suspender hasta que el Cliente
            las subsane, sin que ello sea incumplimiento del Proveedor.
          </p>
        </section>
      ) : null}

      <section>
        <DocH2>
          {equipos
            ? "Artículo 9. Limitación de responsabilidad"
            : "Artículo 12. Limitación de responsabilidad"}
        </DocH2>
        <p className="mt-2 text-sm leading-7 text-[#4d5c55]">
          La responsabilidad total de Genera Solutions SAS por este contrato,
          incluida culpa leve, se limita al valor efectivamente pagado por el
          Cliente. No hay lugar a lucro cesante, daño emergente indirecto,
          pérdida de ingresos o de producción, daño moral ni expectativas
          económicas no cumplidas. Esta limitación no aplica en dolo o culpa
          grave de Genera Solutions SAS, ni en lesiones a personas imputables a
          ella. El Cliente mantiene asegurada su edificación y bienes. Genera
          Solutions SAS no responde por la estructura existente del predio ni
          por redes internas ajenas al alcance cotizado, ni por daños a
          terceros originados por causas ajenas a su control, uso indebido,
          intervención de terceros, fallas de la red pública o fuerza mayor.
          Tras la puesta en marcha, el Cliente mantiene indemne a Genera
          Solutions SAS frente a reclamaciones de terceros por la operación del
          sistema.
        </p>
      </section>

      <section>
        <DocH2>
          {equipos ? "Artículo 10. Fuerza mayor" : "Artículo 13. Fuerza mayor"}
        </DocH2>
        <p className="mt-2 text-sm leading-7 text-[#4d5c55]">
          Guerra, pandemia, desastres naturales, lluvias extremas, granizo,
          tormentas, deslizamientos, incendios, actos de autoridad, bloqueos,
          paros, fallas de la red pública, retrasos de importación, escasez de
          materiales o de fletes, fallas de fabricante o transportista, y
          restricciones gubernamentales, suspenden plazos mientras dure el
          evento, sin penalidad ni indemnización. La parte afectada informa a
          la otra tan pronto le sea posible.
        </p>
      </section>

      <section>
        <DocH2>
          {equipos ? "Artículo 11. Terminación" : "Artículo 14. Terminación"}
        </DocH2>
        <p className="mt-2 text-sm leading-7 text-[#4d5c55]">
          El Cliente puede desistir sin costo antes de pagar el anticipo.
          Cualquiera puede terminar por incumplimiento grave no subsanado en
          diez (10) días hábiles desde el requerimiento escrito. Si el Cliente
          desiste sin causa después del anticipo o del pedido de equipos, y
          antes de la puesta en operación, Genera Solutions SAS retiene los
          costos ya comprometidos y hasta el cincuenta por ciento (50 %) del valor
          del contrato como cláusula penal, sin perjuicio de mayores daños
          demostrados. Si el sistema ya está en operación y el Cliente pide
          cancelar, liquida el 100 % del valor pactado. Lo pagado de más, si lo
          hay, se reembolsa en treinta (30) días. La terminación no extingue
          cláusulas de precio, garantías, limitación de responsabilidad ni
          confidencialidad.
        </p>
      </section>

      {!equipos ? (
        <section>
          <DocH2>Artículo 15. Aceptación de la instalación</DocH2>
          <p className="mt-2 text-sm leading-7 text-[#4d5c55]">
            Se entiende aceptada la instalación y la puesta en marcha cuando el
            sistema entra en operación y el Cliente no presenta observaciones
            escritas dentro de los cinco (5) días hábiles siguientes.
          </p>
        </section>
      ) : null}

      <section>
        <DocH2>
          {equipos
            ? "Artículo 12. Datos personales, confidencialidad y cesión"
            : "Artículo 16. Datos personales, confidencialidad y cesión"}
        </DocH2>
        <p className="mt-2 text-sm leading-7 text-[#4d5c55]">
          Los datos del Cliente (incluido el RUT) se usan para cotizar, facturar
          y ejecutar este contrato, conforme a la Ley 1581 de 2012. El Cliente
          autoriza ese tratamiento y puede ejercer sus derechos por escrito a{" "}
          {GENERA_LEGAL.email}. Ninguna parte divulga precios, diseños ni
          información técnica, comercial o financiera de la otra, salvo
          obligación legal. El Cliente no cede este contrato sin consentimiento
          escrito de Genera Solutions SAS.
        </p>
      </section>

      <section>
        <DocH2>
          {equipos ? "Artículo 13. Ley y controversias" : "Artículo 17. Ley y controversias"}
        </DocH2>
        <p className="mt-2 text-sm leading-7 text-[#4d5c55]">
          Se rige por la ley colombiana. Las partes declaran celebrarlo de
          buena fe, sin vicios del consentimiento. Intentan arreglo directo en
          quince (15) días hábiles. De persistir, se someten a los jueces de la
          República de Colombia, en el domicilio del Cliente o, a elección de
          Genera Solutions SAS, en Bogotá. Este contrato y la cotización anexa
          son el acuerdo completo y sustituyen tratativas previas sobre el
          mismo objeto.
        </p>
      </section>

      <section>
        <DocH2>
          {equipos ? "Artículo 14. Notificaciones" : "Artículo 18. Notificaciones"}
        </DocH2>
        <p className="mt-2 text-sm leading-7 text-[#4d5c55]">
          <strong>El Cliente:</strong> {p.clientName}
          {p.clientAddress ? ` · ${p.clientAddress}` : ""}
          {p.clientCity ? ` · ${p.clientCity}` : ""}
          {p.clientPhone ? ` · ${p.clientPhone}` : ""}
          {p.clientEmail ? ` · ${p.clientEmail}` : ""}.
        </p>
        <p className="mt-2 text-sm leading-7 text-[#4d5c55]">
          <strong>Genera Solutions SAS:</strong> {GENERA_LEGAL.contactName},{" "}
          {GENERA_LEGAL.contactRole} · {GENERA_LEGAL.address} ·{" "}
          {GENERA_LEGAL.phone} · {GENERA_LEGAL.email}.
        </p>
        <p className="mt-2 text-sm leading-7 text-[#4d5c55]">
          Cada parte actualiza estos datos si cambian. La aceptación puede
          constar por firma manuscrita, firma electrónica o correo inequívoco
          desde {p.clientEmail || "la dirección registrada en la cotización"}.
        </p>
      </section>

      <section className="grid gap-8 pt-4 sm:grid-cols-2">
        <SignBlock
          role="EL CLIENTE"
          name={p.clientName}
          extra={idDoc || p.clientCity}
        />
        <SignBlock
          role="EL PROVEEDOR"
          name={GENERA_LEGAL.name}
          extra={`NIT ${GENERA_LEGAL.nit}`}
        />
      </section>

      <p className="text-[11px] leading-5 text-[#6d7c74]">
        Plantilla generada por el Sistema Operativo Solar de Genera Solutions
        SAS a partir de la cotización. Es un documento comercial de trabajo. Un
        abogado colombiano puede revisarlo antes de usarlo en operaciones de
        alto valor o con cláusulas especiales (PPA, financiación, predios en
        copropiedad).
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
