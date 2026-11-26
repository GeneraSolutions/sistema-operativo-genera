import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth/request";
import { sessionAllowsModule } from "@/lib/auth/roles";
import { saveSolarwinStatement } from "@/lib/solarwin-share-server";
import {
  mergeSolarwinBundle,
  emptySolarwinBundle,
  type SolarwinBundle,
  type SolarwinStatement,
} from "@/lib/solarwin";

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
    const body = (await req.json()) as {
      bundle?: SolarwinBundle;
      envioId?: string;
    };
    const normalized = mergeSolarwinBundle(
      emptySolarwinBundle(),
      body.bundle
    );
    let envios = normalized.envios.filter((e) => !e.deletedAt);
    if (body.envioId) envios = envios.filter((e) => e.id === body.envioId);
    if (!envios.length) {
      return NextResponse.json(
        { error: "No hay envíos para publicar." },
        { status: 400 }
      );
    }
    const ids = new Set(envios.map((e) => e.id));
    const gastos = normalized.gastos.filter(
      (g) => !g.deletedAt && ids.has(g.envioId)
    );
    const statement: SolarwinStatement = {
      id: randomUUID(),
      createdAt: new Date().toISOString(),
      createdByName: session.name,
      envioId: body.envioId || undefined,
      bundle: { envios, gastos },
    };
    await saveSolarwinStatement(statement);
    return NextResponse.json({ id: statement.id, ok: true });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Error";
    return NextResponse.json({ error: detail }, { status: 500 });
  }
}
