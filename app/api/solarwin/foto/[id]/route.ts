import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth/request";
import { sessionAllowsModule } from "@/lib/auth/roles";
import { getSolarwinPhoto } from "@/lib/solarwin-photo-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }
  if (!sessionAllowsModule("solarwin", session.role, session.modules)) {
    return NextResponse.json({ error: "Sin permiso." }, { status: 403 });
  }
  const { id } = await ctx.params;
  const dataUrl = await getSolarwinPhoto(id);
  if (!dataUrl) {
    return NextResponse.json({ error: "No encontrada." }, { status: 404 });
  }
  return NextResponse.json(
    { dataUrl },
    { headers: { "Cache-Control": "private, max-age=3600" } }
  );
}
