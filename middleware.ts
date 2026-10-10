import { NextRequest, NextResponse } from "next/server";
import { canAccessModule, moduleFromPath } from "@/lib/auth/roles";
import { SESSION_COOKIE, authSecret } from "@/lib/auth/session-public";
import type { Role } from "@/lib/auth/roles";

function isPublic(pathname: string): boolean {
  if (pathname.startsWith("/_next")) return true;
  if (pathname.startsWith("/login")) return true;
  if (pathname.startsWith("/propuesta")) return true;
  if (pathname.startsWith("/api/auth/login")) return true;
  if (pathname.startsWith("/api/auth/logout")) return true;
  if (pathname.startsWith("/api/propuestas/")) return true;
  if (pathname === "/favicon.ico") return true;
  if (/\.(?:png|jpg|jpeg|gif|svg|webp|ico|css|js|map)$/i.test(pathname)) {
    return true;
  }
  return false;
}

async function hmacBase64Url(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(data)
  );
  const bytes = new Uint8Array(sig);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function readSession(
  req: NextRequest
): Promise<{ id: string; role: Role; username: string; name: string } | null> {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = await hmacBase64Url(authSecret(), body);
  if (expected.length !== sig.length) return null;
  let mismatch = 0;
  for (let i = 0; i < expected.length; i++) {
    mismatch |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
  }
  if (mismatch !== 0) return null;
  try {
    const b64 = body.replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const json = new TextDecoder().decode(bytes);
    const payload = JSON.parse(json) as {
      id: string;
      username: string;
      name: string;
      role: Role;
      exp: number;
    };
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
    if (!payload.id || !payload.role) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (isPublic(pathname)) return NextResponse.next();

  const session = await readSession(req);
  if (!session) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "No autenticado." }, { status: 401 });
    }
    const login = new URL("/login", req.url);
    login.searchParams.set("next", pathname);
    return NextResponse.redirect(login);
  }

  const mod = moduleFromPath(pathname);
  if (mod && !canAccessModule(session.role, mod)) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Sin permiso." }, { status: 403 });
    }
    return NextResponse.redirect(new URL("/sin-acceso", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
