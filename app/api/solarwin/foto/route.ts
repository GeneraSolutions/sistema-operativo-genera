import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth/request";
import { sessionAllowsModule } from "@/lib/auth/roles";
import { saveSolarwinPhoto } from "@/lib/solarwin-photo-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const session = getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }
  if (!sessionAllowsModule("solarwin", session.role, session.modules)) {
    return NextResponse.json({ error: "Sin permiso." }, { status: 403 });
  }
  try {
    const body = (await req.json()) as { id?: string; dataUrl?: string };
    if (!body.id || !body.dataUrl) {
      return NextResponse.json({ error: "Faltan datos." }, { status: 400 });
    }
    await saveSolarwinPhoto(body.id, body.dataUrl);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Error";
    return NextResponse.json({ error: detail }, { status: 400 });
  }
}
