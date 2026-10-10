import { cookies } from "next/headers";
import { NextRequest } from "next/server";
import {
  SESSION_COOKIE,
  decodeSession,
  type SessionUser,
} from "@/lib/auth/session";

export async function getSessionFromCookies(): Promise<SessionUser | null> {
  const jar = await cookies();
  return decodeSession(jar.get(SESSION_COOKIE)?.value);
}

export function getSessionFromRequest(req: NextRequest): SessionUser | null {
  return decodeSession(req.cookies.get(SESSION_COOKIE)?.value);
}
