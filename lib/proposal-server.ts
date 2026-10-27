import { DEMO_EPC_PROPOSAL } from "@/lib/demo-epc-proposal";
import { hasDurableStore, persistGet, persistSet } from "@/lib/persist";
import {
  hasSupabaseStore,
  storageGetJson,
  storagePutJson,
} from "@/lib/supabase-storage";
import type { EpcProposal } from "@/types/proposal";

function proposalPath(id: string) {
  return `proposals/${id.replace(/[^a-zA-Z0-9._-]+/g, "-")}.json`;
}

function persistKey(id: string) {
  return `genera:proposal:${id}`;
}

function compactProposal(proposal: EpcProposal, dropImage = false): EpcProposal {
  const image = proposal.siteImageDataUrl || "";
  return {
    ...proposal,
    siteImageDataUrl:
      dropImage || image.length > 80_000 ? undefined : proposal.siteImageDataUrl,
  };
}

async function readProposalFile(id: string): Promise<EpcProposal | null> {
  if (hasSupabaseStore()) {
    const stored = await storageGetJson<EpcProposal>(proposalPath(id));
    if (stored?.id) return stored;
  }
  const local = await persistGet<EpcProposal>(persistKey(id));
  return local?.id ? local : null;
}

async function writeProposalFile(proposal: EpcProposal): Promise<void> {
  await persistSet(persistKey(proposal.id), proposal);
  if (hasSupabaseStore()) {
    await storagePutJson(proposalPath(proposal.id), proposal);
  }
}

export async function saveProposalServer(proposal: EpcProposal): Promise<void> {
  if (process.env.VERCEL && !hasDurableStore()) {
    throw new Error(
      "El enlace comercial no se puede publicar: configure Supabase Storage (NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY)."
    );
  }
  let slim = compactProposal(proposal);
  try {
    await writeProposalFile(slim);
  } catch {
    slim = compactProposal(proposal, true);
    await writeProposalFile(slim);
  }

  let stored: EpcProposal | null = null;
  for (let attempt = 0; attempt < 4; attempt++) {
    stored = await readProposalFile(slim.id);
    if (stored) break;
    await new Promise((resolve) => setTimeout(resolve, 200 * (attempt + 1)));
  }
  if (!stored) {
    throw new Error(
      "La propuesta se envió al almacenamiento pero no se pudo confirmar. Intente de nuevo."
    );
  }
}

export async function getProposalServer(id: string): Promise<EpcProposal | null> {
  if (id === DEMO_EPC_PROPOSAL.id) return DEMO_EPC_PROPOSAL;
  try {
    return await readProposalFile(id);
  } catch {
    return null;
  }
}
