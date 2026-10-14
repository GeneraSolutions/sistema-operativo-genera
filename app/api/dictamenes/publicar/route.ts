import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth/request";
import { saveSharedRuling } from "@/lib/report-share-server";
import type { PhotoRuling } from "@/lib/photo-ruling";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const session = getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }
  try {
    const ruling = (await req.json()) as PhotoRuling;
    if (!ruling?.id || !ruling.imageDataUrl) {
      return NextResponse.json(
        { error: "Falta la foto del dictamen." },
        { status: 400 }
      );
    }
    const stamped: PhotoRuling = {
      ...ruling,
      savedBy: ruling.savedBy || session.username,
      savedByName: ruling.savedByName || session.name,
    };
    await saveSharedRuling(stamped);
    return NextResponse.json({ id: stamped.id, ok: true });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Error";
    return NextResponse.json({ error: detail }, { status: 500 });
  }
}
