import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth/request";
import { canAccessModule, isAliadoRole } from "@/lib/auth/roles";
import { listCustomRoles } from "@/lib/auth/custom-roles";
import {
  DEFAULT_ALIADO_INSTALL,
  normalizeInstallConfig,
  type AliadoInstallConfig,
} from "@/lib/aliado-install";
import { persistGet, persistSet } from "@/lib/persist";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const KEY = "genera:aliado-install";
const NO_STORE = { "Cache-Control": "no-store, max-age=0" };

async function loadConfig(): Promise<AliadoInstallConfig> {
  const stored = await persistGet<AliadoInstallConfig>(KEY);
  return normalizeInstallConfig(stored ?? DEFAULT_ALIADO_INSTALL);
}

export async function GET() {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }
  const custom = await listCustomRoles();
  const ok =
    isAliadoRole(session.role) ||
    canAccessModule(session.role, "cotizador", custom) ||
    canAccessModule(session.role, "equipo", custom);
  if (!ok) {
    return NextResponse.json({ error: "Sin permiso." }, { status: 403 });
  }
  return NextResponse.json({ config: await loadConfig() }, { headers: NO_STORE });
}

export async function PUT(req: NextRequest) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }
  const custom = await listCustomRoles();
  if (!canAccessModule(session.role, "equipo", custom)) {
    return NextResponse.json({ error: "Sin permiso." }, { status: 403 });
  }
  const body = (await req.json()) as { config?: AliadoInstallConfig };
  const config = normalizeInstallConfig({
    ...body.config,
    updatedAt: new Date().toISOString(),
  });
  await persistSet(KEY, config);
  return NextResponse.json({ config }, { headers: NO_STORE });
}
