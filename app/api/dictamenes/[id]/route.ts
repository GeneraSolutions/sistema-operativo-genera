import { NextRequest, NextResponse } from "next/server";
import { getSharedRuling } from "@/lib/report-share-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE = { "Cache-Control": "no-store, max-age=0" };

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const ruling = await getSharedRuling(id);
  if (!ruling) {
    return NextResponse.json(
      { error: "No encontrado." },
      { status: 404, headers: NO_STORE }
    );
  }
  return NextResponse.json({ ruling }, { headers: NO_STORE });
}
