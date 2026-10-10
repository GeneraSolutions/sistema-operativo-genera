import { NextRequest, NextResponse } from "next/server";
import { getProposalServer } from "@/lib/proposal-server";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const proposal = await getProposalServer(id);
  if (!proposal) {
    return NextResponse.json({ error: "No encontrada." }, { status: 404 });
  }
  return NextResponse.json({ proposal });
}
