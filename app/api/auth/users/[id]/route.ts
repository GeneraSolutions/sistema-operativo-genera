import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth/request";
import { canAccessModule, type Role } from "@/lib/auth/roles";
import { isKnownRole, listCustomRoles } from "@/lib/auth/custom-roles";
import { deleteUser, updateUser } from "@/lib/auth/store";

export const runtime = "nodejs";

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }
  const { id } = await ctx.params;
  const body = (await req.json()) as {
    name?: string;
    role?: Role;
    active?: boolean;
    password?: string;
  };
  const custom = await listCustomRoles();
  const managingTeam = canAccessModule(session.role, "equipo", custom);
  const self = session.id === id;
  if (!managingTeam && !self) {
    return NextResponse.json({ error: "Sin permiso." }, { status: 403 });
  }
  if (!managingTeam && self) {
    if (body.role != null || body.active != null) {
      return NextResponse.json(
        { error: "No puede cambiar su cargo ni estado." },
        { status: 403 }
      );
    }
  }
  if (body.role && !(await isKnownRole(body.role))) {
    return NextResponse.json({ error: "Cargo no válido." }, { status: 400 });
  }
  if (body.role === "ceo" && session.role !== "ceo") {
    return NextResponse.json(
      { error: "Solo el CEO puede asignar el cargo de CEO." },
      { status: 403 }
    );
  }
  try {
    const user = await updateUser(id, body);
    return NextResponse.json({ user });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Error";
    return NextResponse.json({ error: detail }, { status: 400 });
  }
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }
  if (!canAccessModule(session.role, "equipo", await listCustomRoles())) {
    return NextResponse.json({ error: "Sin permiso." }, { status: 403 });
  }
  const { id } = await ctx.params;
  if (id === session.id) {
    return NextResponse.json(
      { error: "No puede eliminarse a sí mismo." },
      { status: 400 }
    );
  }
  try {
    await deleteUser(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Error";
    return NextResponse.json({ error: detail }, { status: 400 });
  }
}
