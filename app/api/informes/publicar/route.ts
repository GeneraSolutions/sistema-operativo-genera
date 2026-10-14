import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth/request";
import { saveSharedReport } from "@/lib/report-share-server";
import type { TechnicalReport } from "@/lib/technical-reports";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const session = getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }
  try {
    const report = (await req.json()) as TechnicalReport;
    if (!report?.id || !report.kind) {
      return NextResponse.json({ error: "Informe inválido." }, { status: 400 });
    }
    const stamped: TechnicalReport = {
      ...report,
      status: report.status === "borrador" ? "publicado" : report.status,
      savedBy: report.savedBy || session.username,
      savedByName: report.savedByName || session.name,
    };
    await saveSharedReport(stamped);
    return NextResponse.json({ id: stamped.id, ok: true });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Error";
    return NextResponse.json({ error: detail }, { status: 500 });
  }
}
