"use client";

import { useEffect, useMemo, useState } from "react";
import { DeliverableShell, DocH2 } from "@/components/deliverables/DeliverableShell";
import type { EpcProposal } from "@/types/proposal";

const num = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 2 });

type CertFields = {
  energizedAt: string;
  retieRef: string;
  legalizationRef: string;
  technician: string;
  notes: string;
};

function keyFor(id: string) {
  return `genera.commissioning.${id}`;
}

function loadFields(id: string): CertFields {
  try {
    const raw = localStorage.getItem(keyFor(id));
    if (raw) return { ...emptyFields(), ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
  return emptyFields();
}

function emptyFields(): CertFields {
  return {
    energizedAt: "",
    retieRef: "",
    legalizationRef: "",
    technician: "",
    notes: "",
  };
}

export function CommissioningCert({ proposal: p }: { proposal: EpcProposal }) {
  const serial = useMemo(() => {
    const compact = p.id.replace(/[^a-zA-Z0-9]/g, "").slice(0, 8).toUpperCase();
    return `GEN-PM-${compact || "00000000"}`;
  }, [p.id]);
  const [fields, setFields] = useState<CertFields>(emptyFields);

  useEffect(() => {
    setFields(loadFields(p.id));
  }, [p.id]);

  function patch(partial: Partial<CertFields>) {
    setFields((prev) => {
      const next = { ...prev, ...partial };
      try {
        localStorage.setItem(keyFor(p.id), JSON.stringify(next));
      } catch {
        /* quota */
      }
      return next;
    });
  }

  return (
    <DeliverableShell
      proposal={p}
      kicker="Documento oficial · Puesta en marcha"
      title="Certificado de puesta en marcha"
      subtitle="Constancia de Genera Solutions SAS de que la planta cotizada fue energizada. Completar fecha RETIE y referencias al momento de la entrega; luego imprimir o exportar PDF."
      accent="official"
    >
      <div className="rounded-2xl border-2 border-[#d4b46a] bg-[#fffdf6] px-5 py-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.2em] text-[#8a6b2a] uppercase">
              Número de certificado
            </p>
            <p className="mt-1 font-mono text-2xl font-semibold tracking-wide text-[#12241c]">
              {serial}
            </p>
          </div>
          <p className="max-w-xs text-right text-xs leading-5 text-[#6d7c74]">
            Válido como soporte para seguros, bancos, contabilidad y auditorías
            internas. No reemplaza el dictamen RETIE del organismo de
            inspección.
          </p>
        </div>
      </div>

      <section>
        <DocH2>Datos de la planta</DocH2>
        <table className="mt-3 w-full text-sm">
          <tbody>
            {[
              ["Titular", p.clientName],
              ["Ubicación", p.clientCity],
              ["Potencia DC instalada", `${num.format(p.systemKwp)} kWp`],
              ["Potencia AC inversor", `${num.format(p.inverterKwAc)} kW`],
              ["Módulos", `${p.panelCount} × ${p.panelWatts} W · ${p.panelLabel}`],
              ["Inversor", p.inverterLabel],
              [
                "Almacenamiento",
                p.includeBattery
                  ? `${p.batteryKwh} kWh · ${p.batteryLabel}`
                  : "No aplica en este alcance",
              ],
              ["Montaje", `${p.mountLabel} · ${p.roofType}`],
            ].map(([k, v]) => (
              <tr key={k} className="border-t border-[#eee9de]">
                <th className="w-40 py-2 pr-3 text-left font-medium text-[#6d7c74]">
                  {k}
                </th>
                <td className="py-2 text-[#12241c]">{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section>
        <DocH2>Campos de cierre de obra</DocH2>
        <p className="mt-1 text-xs text-[#6d7c74] print:hidden">
          Genera Solutions SAS completa estos datos el día de la energización. Quedan en este
          equipo para reimprimir el certificado.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Field
            label="Fecha de energización"
            type="date"
            value={fields.energizedAt}
            onChange={(v) => patch({ energizedAt: v })}
          />
          <Field
            label="Referencia dictamen RETIE"
            value={fields.retieRef}
            onChange={(v) => patch({ retieRef: v })}
            placeholder="N.° de dictamen / organismo"
          />
          <Field
            label="Legalización comercializador / UPME"
            value={fields.legalizationRef}
            onChange={(v) => patch({ legalizationRef: v })}
            placeholder="Radicado o cuenta contrato"
          />
          <Field
            label="Técnico / ingeniero responsable"
            value={fields.technician}
            onChange={(v) => patch({ technician: v })}
            placeholder="Nombre quien energiza"
          />
        </div>
        <label className="mt-3 block text-sm">
          <span className="mb-1 block font-medium">Observaciones de entrega</span>
          <textarea
            rows={3}
            className="w-full rounded-xl border border-[#d8d2c4] bg-[#fbfaf6] px-3 py-2 print:border-0 print:bg-transparent"
            value={fields.notes}
            onChange={(e) => patch({ notes: e.target.value })}
          />
        </label>
      </section>

      <section className="grid gap-8 sm:grid-cols-2">
        <SignLine title="Por Genera Solutions SAS" hint="Ingeniería / representante" />
        <SignLine title="Por el cliente" hint={p.clientName} />
      </section>

      <p className="text-xs leading-5 text-[#6d7c74]">
        Genera Solutions SAS certifica que la planta descrita corresponde al
        alcance de la cotización asociada y que, a la fecha de energización
        indicada, el sistema quedó operativo. Cualquier modificación de
        potencia, marca o cantidad de equipos anula este certificado hasta
        emitir uno nuevo.
      </p>
    </DeliverableShell>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium">{label}</span>
      <input
        type={type}
        className="w-full rounded-xl border border-[#d8d2c4] bg-[#fbfaf6] px-3 py-2.5 print:border-0 print:bg-transparent print:px-0"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

function SignLine({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="pt-10">
      <div className="border-t border-[#12241c] pt-2">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-[#6d7c74]">{hint}</p>
      </div>
    </div>
  );
}
