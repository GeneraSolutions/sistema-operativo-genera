import type { Metadata } from "next";
import { getProposalServer } from "@/lib/proposal-server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const proposal = await getProposalServer(id);
  const title = proposal
    ? `Cotización EPC · ${proposal.clientName} | Genera Solutions SAS`
    : "Cotización EPC | Genera Solutions SAS";
  const description = proposal
    ? `Propuesta solar de ${proposal.systemKwp} kWp para ${proposal.clientName} en ${proposal.clientCity}.`
    : "Propuesta comercial EPC de Genera Solutions SAS.";
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      locale: "es_CO",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default function ProposalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
