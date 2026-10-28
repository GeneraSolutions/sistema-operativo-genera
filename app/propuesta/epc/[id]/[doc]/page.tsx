"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { CommercialContract } from "@/components/deliverables/CommercialContract";
import { ParticularTermsEditor } from "@/components/deliverables/ParticularTermsEditor";
import { CommissioningCert } from "@/components/deliverables/CommissioningCert";
import { FirstBillGuide } from "@/components/deliverables/FirstBillGuide";
import { QuoteExplainer } from "@/components/deliverables/QuoteExplainer";
import { UserManual } from "@/components/deliverables/UserManual";
import { useProposalDoc } from "@/components/deliverables/useProposalDoc";
import { MissingProposal } from "@/components/proposal/MissingProposal";
import { cleanParticularTerms } from "@/lib/particular-terms";
import { contractReleased } from "@/lib/proposal-bonuses";
import { saveProposal } from "@/lib/proposal-store";
import { loadSavedQuotes, saveQuoteSnapshot } from "@/lib/saved-quotes";
import type { EpcProposal, ParticularTerm } from "@/types/proposal";

const DOCS = {
  explicacion: QuoteExplainer,
  manual: UserManual,
  "primera-factura": FirstBillGuide,
  certificado: CommissioningCert,
  contrato: CommercialContract,
} as const;

type DocKey = keyof typeof DOCS;

export default function ProposalDocumentPage() {
  const params = useParams<{ id: string; doc: string }>();
  const proposal = useProposalDoc(params.id);
  const doc = params.doc as DocKey;
  const View = DOCS[doc];

  if (!View) return <MissingProposal />;
  if (proposal === undefined) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#f4efe4] text-sm text-[#6d7c74]">
        Preparando documento Genera Solutions SAS…
      </div>
    );
  }
  if (!proposal) return <MissingProposal />;
  if (doc === "contrato" && !contractReleased(proposal.toggles)) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#f4efe4] px-6 text-center text-sm text-[#4d5c55]">
        El contrato de esta cotización aún no está liberado. En el cotizador,
        pulse Liberar contrato para que el cliente lo vea.
      </div>
    );
  }
  if (doc === "contrato") {
    return <ContractWithTerms initial={proposal} />;
  }
  return <View proposal={proposal} />;
}

function ContractWithTerms({ initial }: { initial: EpcProposal }) {
  const [proposal, setProposal] = useState(initial);
  const [terms, setTerms] = useState<ParticularTerm[]>(
    initial.particularTerms ?? []
  );
  const [operator, setOperator] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    fetch("/api/auth/me", { cache: "no-store" })
      .then((res) => setOperator(res.ok))
      .catch(() => setOperator(false));
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, []);

  function onTerms(next: ParticularTerm[]) {
    setTerms(next);
    setProposal((current) => {
      const updated = {
        ...current,
        particularTerms: cleanParticularTerms(next),
      };
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => {
        void persistTerms(updated);
      }, 400);
      return updated;
    });
  }

  return (
    <CommercialContract
      proposal={proposal}
      tools={
        operator ? (
          <ParticularTermsEditor terms={terms} onChange={onTerms} />
        ) : null
      }
    />
  );
}

async function persistTerms(proposal: EpcProposal) {
  try {
    saveProposal(proposal);
  } catch {
    /* quota */
  }
  const quote = loadSavedQuotes().find(
    (row) => row.commercialProposalId === proposal.id
  );
  if (quote) {
    const saved = saveQuoteSnapshot(
      { ...quote, particularTerms: proposal.particularTerms },
      { replaceLines: false }
    );
    void fetch("/api/archivo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quote: saved }),
    }).catch(() => undefined);
  }
  await fetch("/api/propuestas", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(proposal),
  }).catch(() => undefined);
}
