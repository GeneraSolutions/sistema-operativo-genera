import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth/request";
import { ROLES, canAccessModule, type Role } from "@/lib/auth/roles";
import { createUser, listUsers } from "@/lib/auth/store";

export const runtime = "nodejs";

export async function GET() {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }
  if (!canAccessModule(session.role, "equipo")) {
    return NextResponse.json({ error: "Sin permiso." }, { status: 403 });
  }
  return NextResponse.json({ users: await listUsers() });
}

export async function POST(req: NextRequest) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }
  if (!canAccessModule(session.role, "equipo")) {
    return NextResponse.json({ error: "Sin permiso." }, { status: 403 });
  }
  try {
    const body = (await req.json()) as {
      username?: string;
      name?: string;
      role?: Role;
      password?: string;
    };
    if (!body.role || !ROLES.includes(body.role)) {
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
    return NextResponse.json({ user });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Error";
    return NextResponse.json({ error: detail }, { status: 400 });
  }
}
