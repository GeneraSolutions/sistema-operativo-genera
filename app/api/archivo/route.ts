import { NextRequest, NextResponse } from "next/server";
import {
  loadArchivoQuotes,
  loadArchivoVisits,
  removeArchivoQuote,
  removeArchivoVisit,
  upsertArchivoQuote,
  upsertArchivoQuotes,
  upsertArchivoVisit,
  upsertArchivoVisits,
} from "@/lib/archivo-server";
import { getSessionFromCookies } from "@/lib/auth/request";
import { canAccessModule } from "@/lib/auth/roles";
import { listCustomRoles } from "@/lib/auth/custom-roles";
import type { SavedQuote } from "@/lib/saved-quotes";
import type { SavedVisit } from "@/lib/saved-visits";

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

export async function GET() {
  const gate = await requireArchivo();
  if ("error" in gate && gate.error) return gate.error;
  return NextResponse.json(
    {
      quotes: await loadArchivoQuotes(),
      visits: await loadArchivoVisits(),
    },
    { headers: NO_STORE }
  );
}

export async function POST(req: NextRequest) {
  const gate = await requireArchivo();
  if ("error" in gate && gate.error) return gate.error;
  const body = (await req.json()) as {
    quote?: SavedQuote;
    quotes?: SavedQuote[];
    visit?: SavedVisit;
    visits?: SavedVisit[];
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
  return NextResponse.json(
    {
      quotes: await loadArchivoQuotes(),
      visits: await loadArchivoVisits(),
    },
    { headers: NO_STORE }
  );
}

export async function DELETE(req: NextRequest) {
  const gate = await requireArchivo();
  if ("error" in gate && gate.error) return gate.error;
  const { searchParams } = new URL(req.url);
  const quoteId = searchParams.get("quote");
  const visitId = searchParams.get("visit");
  if (quoteId) await removeArchivoQuote(quoteId);
  if (visitId) await removeArchivoVisit(visitId);
  return NextResponse.json({ ok: true }, { headers: NO_STORE });
}
