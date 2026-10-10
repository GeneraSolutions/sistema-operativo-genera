"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { EpcProposalView } from "@/components/proposal/EpcProposalView";
import { loadProposalRemote } from "@/lib/proposal-store";
import type { EpcProposal } from "@/types/proposal";

export default function EpcProposalPage() {
  const params = useParams<{ id: string }>();
  const [proposal, setProposal] = useState<EpcProposal | null | undefined>(
    undefined
  );

  useEffect(() => {
    let cancelled = false;
    loadProposalRemote(params.id).then((p) => {
      if (!cancelled) setProposal(p);
    });
    return () => {
      cancelled = true;
    };
  }, [params.id]);

  if (proposal === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#070b16] text-[#c5d4ea]">
        Cargando propuesta EPC…
      </div>
    );
  }

  if (!proposal) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#070b16] px-6 text-center text-[#c5d4ea]">
        <p className="text-lg text-white">No encontramos esta propuesta.</p>
        <p className="max-w-md text-sm">
          El enlace comercial se publica en el servidor al generarlo. Si es
          antiguo, vuelva a emitir el enlace desde el cotizador.
        </p>
        <Link
          href="/cotizador"
          className="rounded-lg bg-[#14b8a6] px-4 py-2 text-sm font-semibold text-[#041018]"
        >
          Ir al cotizador
        </Link>
      </div>
    );
  }

  return <EpcProposalView proposal={proposal} />;
}
