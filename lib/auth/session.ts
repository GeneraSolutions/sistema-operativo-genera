import { createHmac, timingSafeEqual } from "crypto";
import type { Role } from "@/lib/auth/roles";
import { SESSION_COOKIE, authSecret } from "@/lib/auth/session-public";

export { SESSION_COOKIE, authSecret };
const MAX_AGE_SEC = 60 * 60 * 24 * 7;

export interface SessionUser {
  id: string;
  username: string;
  name: string;
  role: Role;
}

interface SessionPayload extends SessionUser {
  exp: number;
}

function sign(input: string, secret: string): string {
  return createHmac("sha256", secret).update(input).digest("base64url");
}

export function encodeSession(user: SessionUser, secret = authSecret()): string {
  const payload: SessionPayload = {
    ...user,
    exp: Math.floor(Date.now() / 1000) + MAX_AGE_SEC,
  };
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${body}.${sign(body, secret)}`;
}

export function decodeSession(
  token: string | undefined,
  secret = authSecret()
): SessionUser | null {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = sign(body, secret);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8")
    ) as SessionPayload;
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
    if (!payload.id || !payload.username || !payload.role) return null;
    return {
      id: payload.id,
      username: payload.username,
      name: payload.name,
      role: payload.role,
    };
  } catch {
    return null;
  }
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SEC,
  };
}

export function readSessionFromCookieHeader(
  cookieHeader: string | null
): SessionUser | null {
  if (!cookieHeader) return null;
  const parts = cookieHeader.split(";").map((p) => p.trim());
  const raw = parts.find((p) => p.startsWith(`${SESSION_COOKIE}=`));
  if (!raw) return null;
  const token = decodeURIComponent(raw.slice(SESSION_COOKIE.length + 1));
  return decodeSession(token);
}
