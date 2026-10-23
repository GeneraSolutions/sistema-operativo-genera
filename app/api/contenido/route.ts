import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth/request";
import { listCustomRoles } from "@/lib/auth/custom-roles";
import { canAccessModule } from "@/lib/auth/roles";
import {
  mergeContent,
  sanitizePiece,
  type ContentPiece,
} from "@/lib/content";
import { persistGet, persistSet } from "@/lib/persist";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const KEY = "genera:contenido";
const DELETED_KEY = "genera:contenido:deleted";
const NO_STORE = { "Cache-Control": "no-store, max-age=0" };

function asIdList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.map((id) => String(id || "").trim()).filter(Boolean))].slice(
    -500
  );
}

async function requireContenido() {
  const session = await getSessionFromCookies();
  if (!session) {
    return { error: NextResponse.json({ error: "No autenticado." }, { status: 401 }) };
  }
  const custom = await listCustomRoles();
  if (!canAccessModule(session.role, "contenido", custom)) {
    return { error: NextResponse.json({ error: "Sin permiso." }, { status: 403 }) };
  }
  return { session };
}

export async function GET() {
  const gate = await requireContenido();
  if (gate.error) return gate.error;
  const deletedIds = asIdList(await persistGet<string[]>(DELETED_KEY));
  const stored = (await persistGet<ContentPiece[]>(KEY)) ?? [];
  const pieces = mergeContent([], stored, deletedIds);
  return NextResponse.json({ pieces, deletedIds }, { headers: NO_STORE });
}

export async function POST(req: NextRequest) {
  const gate = await requireContenido();
  if (gate.error) return gate.error;
  const body = (await req.json().catch(() => ({}))) as {
    pieces?: ContentPiece[];
    deletedIds?: string[];
  };
  const incoming = Array.isArray(body.pieces) ? body.pieces : [];
  const stored = (await persistGet<ContentPiece[]>(KEY)) ?? [];
  const deletedIds = asIdList([
    ...((await persistGet<string[]>(DELETED_KEY)) ?? []),
    ...(body.deletedIds ?? []),
  ]);
  const merged = mergeContent(incoming, stored, deletedIds);
  await persistSet(KEY, merged);
  await persistSet(DELETED_KEY, deletedIds);
  return NextResponse.json({ pieces: merged, deletedIds, ok: true }, { headers: NO_STORE });
}
