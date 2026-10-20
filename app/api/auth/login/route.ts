import { NextRequest, NextResponse } from "next/server";
import { listCustomRoles } from "@/lib/auth/custom-roles";
import { defaultHomeForRole } from "@/lib/auth/roles";
import { encodeSession, sessionCookieOptions, SESSION_COOKIE } from "@/lib/auth/session";
import { authenticate } from "@/lib/auth/store";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { username?: string; password?: string };
    const username = body.username?.trim() ?? "";
    const password = body.password?.trim() ?? "";
    if (!username || !password) {
      return NextResponse.json(
        { error: "Usuario y clave son obligatorios." },
        { status: 400 }
      );
    }
    const user = await authenticate(username, password);
    if (!user) {
      return NextResponse.json(
        { error: "Usuario o clave incorrectos." },
        { status: 401 }
      );
    }
    const custom = await listCustomRoles();
    const res = NextResponse.json({
      user,
      home: defaultHomeForRole(user.role, custom),
    });
    res.cookies.set(SESSION_COOKIE, encodeSession(user), sessionCookieOptions());
    return res;
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Error";
    return NextResponse.json({ error: detail }, { status: 500 });
  }
}
