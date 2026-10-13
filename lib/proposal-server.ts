import { get as blobGet, put as blobPut } from "@vercel/blob";
import { DEMO_EPC_PROPOSAL } from "@/lib/demo-epc-proposal";
import { hasDurableStore } from "@/lib/persist";
import type { EpcProposal } from "@/types/proposal";

function blobAuth() {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  return token ? { token } : {};
}

function proposalPath(id: string) {
  return `proposals/${id}.json`;
}

function compactProposal(proposal: EpcProposal, dropImage = false): EpcProposal {
  const image = proposal.siteImageDataUrl || "";
  return {
    ...proposal,
    siteImageDataUrl:
      dropImage || image.length > 80_000 ? undefined : proposal.siteImageDataUrl,
  };
}

async function readProposalBlob(id: string): Promise<EpcProposal | null> {
  const result = await blobGet(proposalPath(id), {
    access: "private",
    useCache: false,
    ...blobAuth(),
  });
  if (!result || result.statusCode !== 200 || !result.stream) return null;
  const text = await new Response(result.stream).text();
  if (!text) return null;
  const parsed = JSON.parse(text) as EpcProposal;
  return parsed?.id ? parsed : null;
}

async function writeProposalBlob(proposal: EpcProposal): Promise<void> {
  await blobPut(proposalPath(proposal.id), JSON.stringify(proposal), {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
    cacheControlMaxAge: 0,
    ...blobAuth(),
  });
}

export async function saveProposalServer(proposal: EpcProposal): Promise<void> {
  if (process.env.VERCEL && !hasDurableStore()) {
    throw new Error(
      "El enlace comercial no se puede publicar: falta almacenamiento duradero en Vercel."
    );
  }
  let slim = compactProposal(proposal);
  try {
    await writeProposalBlob(slim);
  } catch {
    slim = compactProposal(proposal, true);
    await writeProposalBlob(slim);
  }

  let stored: EpcProposal | null = null;
  for (let attempt = 0; attempt < 4; attempt++) {
    stored = await readProposalBlob(slim.id);
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
    return await readProposalBlob(id);
  } catch {
    return null;
  }
}
