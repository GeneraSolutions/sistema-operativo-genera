import { DEMO_EPC_PROPOSAL } from "@/lib/demo-epc-proposal";
import { persistGet, persistSet } from "@/lib/persist";
import type { EpcProposal } from "@/types/proposal";

function keyFor(id: string) {
  return `genera:proposal:${id}`;
}

export async function saveProposalServer(proposal: EpcProposal): Promise<void> {
  await persistSet(keyFor(proposal.id), proposal);
}

export async function getProposalServer(id: string): Promise<EpcProposal | null> {
  if (id === DEMO_EPC_PROPOSAL.id) return DEMO_EPC_PROPOSAL;
  const stored = await persistGet<EpcProposal>(keyFor(id));
  return stored ?? null;
}
