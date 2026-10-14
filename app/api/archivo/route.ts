import { NextRequest, NextResponse } from "next/server";
import {
  loadArchivoPlants,
  loadArchivoQuotes,
  loadArchivoReports,
  loadArchivoVisits,
  removeArchivoPlant,
  removeArchivoQuote,
  removeArchivoReport,
  removeArchivoVisit,
  upsertArchivoPlants,
  upsertArchivoQuote,
  upsertArchivoQuotes,
  upsertArchivoReport,
  upsertArchivoReports,
  upsertArchivoVisit,
  upsertArchivoVisits,
} from "@/lib/archivo-server";
import { getSessionFromCookies } from "@/lib/auth/request";
import { canAccessModule } from "@/lib/auth/roles";
import { listCustomRoles } from "@/lib/auth/custom-roles";
import type { SavedQuote } from "@/lib/saved-quotes";
import type { SavedVisit } from "@/lib/saved-visits";
import type { PlantProfile, SavedReport } from "@/lib/technical-reports";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE = { "Cache-Control": "no-store, max-age=0" };

async function requireArchivo() {
  const session = await getSessionFromCookies();
  if (!session) return { error: NextResponse.json({ error: "No autenticado." }, { status: 401 }) };
  const custom = await listCustomRoles();
  if (!canAccessModule(session.role, "archivo", custom)) {
    return { error: NextResponse.json({ error: "Sin permiso." }, { status: 403 }) };
  }
  return { session };
}

async function payload() {
  return {
    quotes: await loadArchivoQuotes(),
    visits: await loadArchivoVisits(),
    reports: await loadArchivoReports(),
    plants: await loadArchivoPlants(),
  };
}

export async function GET() {
  const gate = await requireArchivo();
  if ("error" in gate && gate.error) return gate.error;
  return NextResponse.json(await payload(), { headers: NO_STORE });
}

export async function POST(req: NextRequest) {
  const gate = await requireArchivo();
  if ("error" in gate && gate.error) return gate.error;
  const body = (await req.json()) as {
    quote?: SavedQuote;
    quotes?: SavedQuote[];
    visit?: SavedVisit;
    visits?: SavedVisit[];
    report?: SavedReport;
    reports?: SavedReport[];
    plants?: PlantProfile[];
  };
  const stampQuote = (q: SavedQuote): SavedQuote => ({
    ...q,
    savedBy: q.savedBy || gate.session.username,
    savedByName: q.savedByName || gate.session.name,
  });
  if (body.quote?.id) await upsertArchivoQuote(stampQuote(body.quote));
  if (body.quotes?.length) {
    await upsertArchivoQuotes(body.quotes.map(stampQuote));
  }
  if (body.visit?.id) await upsertArchivoVisit(body.visit);
  if (body.visits?.length) await upsertArchivoVisits(body.visits);
  const stampReport = (r: SavedReport): SavedReport => ({
    ...r,
    report: {
      ...r.report,
      savedBy: r.report.savedBy || gate.session.username,
      savedByName: r.report.savedByName || gate.session.name,
    },
  });
  if (body.report?.id) await upsertArchivoReport(stampReport(body.report));
  if (body.reports?.length) {
    await upsertArchivoReports(body.reports.map(stampReport));
  }
  if (body.plants?.length) await upsertArchivoPlants(body.plants);
  return NextResponse.json(await payload(), { headers: NO_STORE });
}

export async function DELETE(req: NextRequest) {
  const gate = await requireArchivo();
  if ("error" in gate && gate.error) return gate.error;
  const { searchParams } = new URL(req.url);
  const quoteId = searchParams.get("quote");
  const visitId = searchParams.get("visit");
  const reportId = searchParams.get("report");
  const plantId = searchParams.get("plant");
  if (quoteId) await removeArchivoQuote(quoteId);
  if (visitId) await removeArchivoVisit(visitId);
  if (reportId) await removeArchivoReport(reportId);
  if (plantId) await removeArchivoPlant(plantId);
  return NextResponse.json({ ok: true }, { headers: NO_STORE });
}
