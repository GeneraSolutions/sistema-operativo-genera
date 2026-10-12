import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth/request";
import { canAccessModule } from "@/lib/auth/roles";
import { listCustomRoles } from "@/lib/auth/custom-roles";
import { syncDirectoryUsers } from "@/lib/auth/store";
import type { DirectoryUser } from "@/lib/auth/directory-cookie";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }
  if (!canAccessModule(session.role, "equipo", await listCustomRoles())) {
    return NextResponse.json({ error: "Sin permiso." }, { status: 403 });
  }
  try {
    const body = (await req.json()) as { users?: DirectoryUser[] };
    const users = await syncDirectoryUsers(body.users ?? []);
    return NextResponse.json({ users });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Error";
    return NextResponse.json({ error: detail }, { status: 400 });
  }
}
