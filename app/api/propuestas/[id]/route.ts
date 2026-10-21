import { NextRequest, NextResponse } from "next/server";
import { proposalForClient } from "@/lib/proposal-bonuses";
import { getProposalServer } from "@/lib/proposal-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE = { "Cache-Control": "no-store, max-age=0" };

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const proposal = await getProposalServer(id);
  if (!proposal) {
    return NextResponse.json(
      { error: "No encontrada." },
      { status: 404, headers: NO_STORE }
    );
  }
  return NextResponse.json(
    { proposal: proposalForClient(proposal) },
    { headers: NO_STORE }
  );
}
