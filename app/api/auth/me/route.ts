import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth/request";
import { listCustomRoles } from "@/lib/auth/custom-roles";
import { modulesForRole, roleLabel } from "@/lib/auth/roles";
import { upsertDirectoryFromSession } from "@/lib/auth/store";

export const runtime = "nodejs";

export async function GET() {
  const user = await getSessionFromCookies();
  if (!user) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }
  await upsertDirectoryFromSession(user).catch(() => undefined);
  const custom = await listCustomRoles();
  const modules = modulesForRole(user.role, custom);
  return NextResponse.json({
    user: { ...user, modules },
    roleLabel: roleLabel(user.role, custom),
  });
}
