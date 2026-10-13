import type { EpcProposal } from "@/types/proposal";
import { DEMO_EPC_PROPOSAL } from "@/lib/demo-epc-proposal";

const KEY = "genera-os-epc-proposals";

function readMap(): Record<string, EpcProposal> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as Record<string, EpcProposal>) : {};
    if (!parsed[DEMO_EPC_PROPOSAL.id]) {
      parsed[DEMO_EPC_PROPOSAL.id] = DEMO_EPC_PROPOSAL;
      window.localStorage.setItem(KEY, JSON.stringify(parsed));
    }
    return parsed;
  } catch {
    return { [DEMO_EPC_PROPOSAL.id]: DEMO_EPC_PROPOSAL };
  }
}

export function saveProposal(proposal: EpcProposal): void {
  const map = readMap();
  map[proposal.id] = proposal;
  window.localStorage.setItem(KEY, JSON.stringify(map));
}

export function getProposal(id: string): EpcProposal | null {
  if (id === DEMO_EPC_PROPOSAL.id) return DEMO_EPC_PROPOSAL;
  return readMap()[id] ?? null;
}

export function listProposals(): EpcProposal[] {
  return Object.values(readMap()).sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt)
  );
}

export async function loadProposalRemote(id: string): Promise<EpcProposal | null> {
  try {
    const res = await fetch(`/api/propuestas/${id}`, { cache: "no-store" });
    if (res.ok) {
      const data = (await res.json()) as { proposal?: EpcProposal };
      if (data.proposal) {
        try {
          saveProposal(data.proposal);
        } catch {
          /* quota */
        }
        return data.proposal;
      }
    }
  } catch {
    /* red */
  }
  return getProposal(id);
}
