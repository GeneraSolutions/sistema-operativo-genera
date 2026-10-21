"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { BrandLogo } from "@/components/BrandLogo";
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
      <div className="flex min-h-screen items-center justify-center bg-[#070b16] text-[#c5d4ea]">
        Cargando fichas…
      </div>
    );
  }

  if (!proposal) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#070b16] text-[#c5d4ea]">
        No hay propuesta para estas fichas.
      </div>
    );
  }

  const released = datasheetsReleased(proposal.toggles);

  return (
    <div className="min-h-screen bg-[#070b16] text-[#e8eef8]">
      <header className="flex items-center justify-between border-b border-[#1a2744] px-5 py-3">
        <BrandLogo height={32} />
        <Link
          href={`/propuesta/epc/${proposal.id}`}
          className="text-sm text-[#5eead4] underline"
        >
          Volver a la cotización
        </Link>
      </header>
      <main className="mx-auto max-w-3xl px-5 py-10">
        <p className="text-[11px] font-semibold tracking-[0.2em] text-[#5eead4] uppercase">
          {released ? "Paquete de entrega" : "Aún no disponible"}
        </p>
        <h1 className="mt-2 text-3xl font-semibold">Fichas técnicas</h1>
        {released ? (
          <>
            <p className="mt-2 text-sm leading-6 text-[#8aa0c2]">
              Documentación de los equipos del sistema de {proposal.clientName} ·{" "}
              {proposal.systemKwp} kWp. Conserve este paquete con el acta de
              entrega y el certificado de puesta en marcha.
            </p>
            <ul className="mt-8 space-y-3">
              {rows.map((row) => {
                const href = row.localUrl || row.datasheetUrl;
                return (
                  <li
                    key={row.itemId}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#1e2d4a] bg-[#10182c] p-4"
                  >
                    <div>
                      <p className="font-medium text-white">
                        {row.brand} {row.model}
                      </p>
                      <p className="text-sm text-[#8aa0c2]">{row.label}</p>
                    </div>
                    {href ? (
                      <a
                        href={href}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-lg bg-[#14b8a6] px-3 py-2 text-sm font-semibold text-[#041018]"
                      >
                        Abrir ficha {row.fileName ? `(${row.fileName})` : "PDF"}
                      </a>
                    ) : (
                      <p className="text-xs text-[#f5b942]">
                        Pendiente de cargar en Inventario
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          </>
        ) : (
          <p className="mt-4 max-w-xl text-sm leading-6 text-[#8aa0c2]">
            Genera Solutions entrega las fichas técnicas cuando hay anticipo de
            obra o al cierre del proyecto. Si ya pagó el anticipo, pida a su
            asesor que libere este paquete: usará el mismo enlace de la
            cotización.
          </p>
        )}
        <p className="mt-8 text-xs text-[#6b7c99]">
          Genera Solutions SAS · Fichas técnicas del proyecto{" "}
          {proposal.id.slice(0, 8)}
        </p>
      </main>
    </div>
  );
}
