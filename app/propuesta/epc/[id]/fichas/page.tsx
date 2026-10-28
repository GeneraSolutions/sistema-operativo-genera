"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { DocSheet } from "@/components/informes/DocSheet";
import { getDatasheetFile } from "@/lib/datasheets";
import { datasheetsReleased } from "@/lib/proposal-bonuses";
import { loadProposalRemote } from "@/lib/proposal-store";
import type { EquipmentDatasheet, EpcProposal } from "@/types/proposal";

type Row = EquipmentDatasheet & { localUrl?: string; fileName?: string };

export default function FichasTecnicasPage() {
  const params = useParams<{ id: string }>();
  const [proposal, setProposal] = useState<EpcProposal | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadProposalRemote(params.id).then((p) => {
      if (cancelled) return;
      setProposal(p);
      setLoaded(true);
      if (!p || !datasheetsReleased(p.toggles)) return;
      Promise.all(
        (p.datasheets ?? []).map(async (d) => {
          const local = await getDatasheetFile(d.itemId);
          return {
            ...d,
            localUrl: local?.url,
            fileName: local?.name,
          };
        })
      ).then((next) => {
        if (!cancelled) setRows(next);
      });
    });
    return () => {
      cancelled = true;
    };
  }, [params.id]);

  if (!loaded) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f4efe4] text-[#4d5c55]">
        Cargando fichas…
      </div>
    );
  }

  if (!proposal) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f4efe4] text-[#4d5c55]">
        No hay propuesta para estas fichas.
      </div>
    );
  }

  const released = datasheetsReleased(proposal.toggles);

  return (
    <div className="min-h-screen bg-[#f4efe4] text-[#12241c]">
      <header className="gen-doc-bar print:hidden">
        <p>Fichas técnicas</p>
        <Link href={`/propuesta/epc/${proposal.id}`}>Volver a la cotización</Link>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <DocSheet
          kicker={released ? "Paquete de entrega" : "Aún no disponible"}
          title="Fichas técnicas"
          meta={
            released
              ? `Documentación de los equipos del sistema de ${proposal.clientName} · ${proposal.systemKwp} kWp. Conserve este paquete con el acta de entrega y el certificado de puesta en marcha.`
              : undefined
          }
          facts={[
            { label: "Cliente", value: proposal.clientName },
            { label: "Sistema", value: `${proposal.systemKwp} kWp` },
          ]}
          legal={
            <>
              Genera Solutions SAS · Fichas técnicas del proyecto{" "}
              {proposal.id.slice(0, 8)}
            </>
          }
        >
          {released ? (
            <ul className="gen-doc-list">
              {rows.map((row) => {
                const href = row.localUrl || row.datasheetUrl;
                return (
                  <li key={row.itemId}>
                    <strong>
                      {row.brand} {row.model}
                    </strong>
                    <p>{row.label}</p>
                    {href ? (
                      <a href={href} target="_blank" rel="noreferrer" className="gen-doc-link">
                        Abrir ficha {row.fileName ? `(${row.fileName})` : "PDF"}
                      </a>
                    ) : (
                      <p>Pendiente de cargar en Inventario</p>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="gen-doc-prose">
              Genera Solutions SAS entrega las fichas técnicas cuando hay anticipo de
              obra o al cierre del proyecto. Si ya pagó el anticipo, pida a su
              asesor que libere este paquete: usará el mismo enlace de la
              cotización.
            </p>
          )}
        </DocSheet>
      </main>
    </div>
  );
}
