import { NextRequest, NextResponse } from "next/server";
import {
  acceptSolarwinStatement,
  getSolarwinStatement,
} from "@/lib/solarwin-share-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE = { "Cache-Control": "no-store, max-age=0" };

/** Público: el enlace del documento es la llave. Devuelve si ya fue aceptado. */
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const statement = await getSolarwinStatement(id);
  if (!statement) {
    return NextResponse.json(
      { error: "No encontrado." },
      { status: 404, headers: NO_STORE }
    );
  }
  return NextResponse.json(
    { acceptance: statement.acceptance ?? null },
    { headers: NO_STORE }
  );
}

/** Público: Solar win marca "Revisado y conforme" desde el enlace. */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  try {
    const body = (await req.json()) as { name?: string; note?: string };
    const name = String(body.name || "").trim().slice(0, 80);
    const note = String(body.note || "").trim().slice(0, 500);
    if (name.length < 2) {
      return NextResponse.json(
        { error: "Escriba su nombre para confirmar." },
        { status: 400, headers: NO_STORE }
      );
    }
    const result = await acceptSolarwinStatement(id, {
      name,
      note: note || undefined,
      at: new Date().toISOString(),
    });
    if (!result.ok) {
      return NextResponse.json(
        {
          error:
            result.reason === "notfound"
              ? "No encontrado."
              : "Este documento ya fue confirmado.",
          acceptance: result.acceptance ?? null,
        },
        { status: result.reason === "notfound" ? 404 : 409, headers: NO_STORE }
      );
    }
    return NextResponse.json(
      { ok: true, acceptance: result.acceptance },
      { headers: NO_STORE }
    );
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Error";
    return NextResponse.json({ error: detail }, { status: 500, headers: NO_STORE });
  }
}
