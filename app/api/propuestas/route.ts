import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth/request";
import { saveProposalServer } from "@/lib/proposal-server";
import type { EpcProposal } from "@/types/proposal";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const session = getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }
  try {
    const proposal = (await req.json()) as EpcProposal;
    if (!proposal?.id || !proposal.clientName) {
      return NextResponse.json({ error: "Propuesta inválida." }, { status: 400 });
    }
    await saveProposalServer(proposal);
    return NextResponse.json({ id: proposal.id, ok: true });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Error";
    return NextResponse.json({ error: detail }, { status: 500 });
  }
}
