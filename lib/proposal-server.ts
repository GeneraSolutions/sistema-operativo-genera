import { DEMO_EPC_PROPOSAL } from "@/lib/demo-epc-proposal";
import { hasCloudKv, persistGet, persistSet } from "@/lib/persist";
import type { EpcProposal } from "@/types/proposal";

function keyFor(id: string) {
  return `genera:proposal:${id}`;
}

const LIST_KEY = "genera:public-proposals";

function compactProposal(proposal: EpcProposal, dropImage = false): EpcProposal {
  const image = proposal.siteImageDataUrl || "";
  return {
    ...proposal,
    siteImageDataUrl:
      dropImage || image.length > 80_000 ? undefined : proposal.siteImageDataUrl,
  };
}

export async function saveProposalServer(proposal: EpcProposal): Promise<void> {
  if (process.env.VERCEL && !hasCloudKv()) {
    throw new Error(
      "El enlace comercial no se puede publicar: falta Redis (KV) en Vercel. Storage → Create Database → Upstash Redis."
    );
  }
  let slim = compactProposal(proposal);
  try {
    await persistSet(keyFor(slim.id), slim);
  } catch {
    slim = compactProposal(proposal, true);
    await persistSet(keyFor(slim.id), slim);
  }
  try {
    const list = (await persistGet<EpcProposal[]>(LIST_KEY)) ?? [];
    const next = [
      { ...slim, siteImageDataUrl: undefined },
      ...list.filter((item) => item.id !== slim.id),
    ].slice(0, 80);
    await persistSet(LIST_KEY, next);
  } catch {
    /* el índice es respaldo; la clave individual ya quedó */
  }
}

export async function getProposalServer(id: string): Promise<EpcProposal | null> {
  if (id === DEMO_EPC_PROPOSAL.id) return DEMO_EPC_PROPOSAL;
  const stored = await persistGet<EpcProposal>(keyFor(id));
  if (stored?.id) return stored;
  const list = (await persistGet<EpcProposal[]>(LIST_KEY)) ?? [];
  return list.find((item) => item.id === id) ?? null;
}
