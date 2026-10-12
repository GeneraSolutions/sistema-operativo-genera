import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth/request";
import { canAccessModule, type Role } from "@/lib/auth/roles";
import { allRoleOptions, isKnownRole, listCustomRoles } from "@/lib/auth/custom-roles";
import { createUser, listUsers } from "@/lib/auth/store";

export const runtime = "nodejs";

export async function GET() {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }
  const custom = await listCustomRoles();
  if (!canAccessModule(session.role, "equipo", custom)) {
    return NextResponse.json({ error: "Sin permiso." }, { status: 403 });
  }
  return NextResponse.json({
    users: await listUsers(),
    roles: await allRoleOptions(),
  });
}

export async function POST(req: NextRequest) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }
  const custom = await listCustomRoles();
  if (!canAccessModule(session.role, "equipo", custom)) {
    return NextResponse.json({ error: "Sin permiso." }, { status: 403 });
  }
  try {
    const body = (await req.json()) as {
      username?: string;
      name?: string;
      role?: Role;
      password?: string;
    };
    if (!body.role || !(await isKnownRole(body.role))) {
      return NextResponse.json({ error: "Cargo no válido." }, { status: 400 });
    }
    if (body.role === "ceo" && session.role !== "ceo") {
      return NextResponse.json(
        { error: "Solo el CEO puede crear otro CEO." },
        { status: 403 }
      );
    }
    const user = await createUser({
      username: body.username ?? "",
      name: body.name ?? "",
      role: body.role,
      password: body.password ?? "",
    });
    return NextResponse.json({ user, roles: await allRoleOptions() });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Error";
    return NextResponse.json({ error: detail }, { status: 400 });
  }
}
