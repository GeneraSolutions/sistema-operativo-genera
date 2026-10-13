import { EpcProposalView } from "@/components/proposal/EpcProposalView";
import { MissingProposal } from "@/components/proposal/MissingProposal";
import { getProposalServer } from "@/lib/proposal-server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function EpcProposalPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const proposal = await getProposalServer(id);
  if (!proposal) return <MissingProposal />;
  return <EpcProposalView proposal={proposal} />;
}
