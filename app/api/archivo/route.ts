import { NextRequest, NextResponse } from "next/server";
import {
  loadArchivoQuotes,
  loadArchivoVisits,
  removeArchivoQuote,
  removeArchivoVisit,
  upsertArchivoQuote,
  upsertArchivoVisit,
} from "@/lib/archivo-server";
import { getSessionFromCookies } from "@/lib/auth/request";
import { canAccessModule } from "@/lib/auth/roles";
import { listCustomRoles } from "@/lib/auth/custom-roles";
import type { SavedQuote } from "@/lib/saved-quotes";
import type { SavedVisit } from "@/lib/saved-visits";

export const runtime = "nodejs";

async function requireArchivo() {
  const session = await getSessionFromCookies();
  if (!session) return { error: NextResponse.json({ error: "No autenticado." }, { status: 401 }) };
  const custom = await listCustomRoles();
  if (!canAccessModule(session.role, "archivo", custom)) {
    return { error: NextResponse.json({ error: "Sin permiso." }, { status: 403 }) };
  }
  return { session };
}

export async function GET() {
  const gate = await requireArchivo();
  if ("error" in gate && gate.error) return gate.error;
  return NextResponse.json({
    quotes: await loadArchivoQuotes(),
    visits: await loadArchivoVisits(),
  });
}

export async function POST(req: NextRequest) {
  const gate = await requireArchivo();
  if ("error" in gate && gate.error) return gate.error;
  const body = (await req.json()) as {
    quote?: SavedQuote;
    visit?: SavedVisit;
  };
  if (body.quote?.id) await upsertArchivoQuote(body.quote);
  if (body.visit?.id) await upsertArchivoVisit(body.visit);
  return NextResponse.json({
    quotes: await loadArchivoQuotes(),
    visits: await loadArchivoVisits(),
  });
}

export async function DELETE(req: NextRequest) {
  const gate = await requireArchivo();
  if ("error" in gate && gate.error) return gate.error;
  const { searchParams } = new URL(req.url);
  const quoteId = searchParams.get("quote");
  const visitId = searchParams.get("visit");
  if (quoteId) await removeArchivoQuote(quoteId);
  if (visitId) await removeArchivoVisit(visitId);
  return NextResponse.json({ ok: true });
}
