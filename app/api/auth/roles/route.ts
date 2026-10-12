import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth/request";
import { canAccessModule, type AppModule } from "@/lib/auth/roles";
import {
  allRoleOptions,
  createCustomRole,
  deleteCustomRole,
  listCustomRoles,
} from "@/lib/auth/custom-roles";

export const runtime = "nodejs";

export async function GET() {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }
  const custom = await listCustomRoles();
  return NextResponse.json({
    roles: await allRoleOptions(),
    customRoles: custom,
  });
}

export async function POST(req: NextRequest) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }
  if (!canAccessModule(session.role, "equipo", await listCustomRoles())) {
    return NextResponse.json({ error: "Sin permiso." }, { status: 403 });
  }
  try {
    const body = (await req.json()) as {
      label?: string;
      modules?: AppModule[];
    };
    const role = await createCustomRole({
      label: body.label ?? "",
      modules: body.modules ?? [],
    });
    return NextResponse.json({ role, roles: await allRoleOptions() });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Error";
    return NextResponse.json({ error: detail }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }
  if (!canAccessModule(session.role, "equipo", await listCustomRoles())) {
    return NextResponse.json({ error: "Sin permiso." }, { status: 403 });
  }
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id") ?? "";
  try {
    await deleteCustomRole(id);
    return NextResponse.json({ ok: true, roles: await allRoleOptions() });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Error";
    return NextResponse.json({ error: detail }, { status: 400 });
  }
}
