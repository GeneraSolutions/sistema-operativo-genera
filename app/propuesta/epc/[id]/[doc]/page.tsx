"use client";

import { useParams } from "next/navigation";
import { CommercialContract } from "@/components/deliverables/CommercialContract";
import { CommissioningCert } from "@/components/deliverables/CommissioningCert";
import { FirstBillGuide } from "@/components/deliverables/FirstBillGuide";
import { QuoteExplainer } from "@/components/deliverables/QuoteExplainer";
import { UserManual } from "@/components/deliverables/UserManual";
import { useProposalDoc } from "@/components/deliverables/useProposalDoc";
import { MissingProposal } from "@/components/proposal/MissingProposal";

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
  return <View proposal={proposal} />;
}
