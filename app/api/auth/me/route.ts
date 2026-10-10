import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth/request";
import { ROLE_LABELS } from "@/lib/auth/roles";

export const runtime = "nodejs";

export async function GET() {
  const user = await getSessionFromCookies();
  if (!user) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }
  return NextResponse.json({
    user,
    roleLabel: ROLE_LABELS[user.role],
  });
}
