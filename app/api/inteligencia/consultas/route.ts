import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth/request";
import { listVisibleIntelligenceLog } from "@/lib/intelligence-log";

export const runtime = "nodejs";

export async function GET() {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }
  return NextResponse.json({
    viewerId: session.id,
    viewerRole: session.role,
    consultas: await listVisibleIntelligenceLog(session),
  });
}
