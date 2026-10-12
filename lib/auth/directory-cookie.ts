import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { authSecret } from "@/lib/auth/session-public";
import type { CustomRoleDef } from "@/lib/auth/roles";

export const USERS_DIR_COOKIE = "genera_directory";
export const ROLES_DIR_COOKIE = "genera_roles";

export type DirectoryUser = {
  id: string;
  username: string;
  name: string;
  role: string;
  active: boolean;
  createdAt: string;
  passwordHash?: string;
  passwordSalt?: string;
};

function sign(input: string, secret: string): string {
  return createHmac("sha256", secret).update(input).digest("base64url");
}

function encodePayload(value: unknown, secret = authSecret()): string {
  const body = Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
  return `${body}.${sign(body, secret)}`;
}

function decodePayload<T>(token: string | undefined, secret = authSecret()): T | null {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = sign(body, secret);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    return JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as T;
  } catch {
    return null;
  }
}

const cookieOpts = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 60 * 60 * 24 * 400,
};

export async function readUsersDirectoryCookie(): Promise<DirectoryUser[] | null> {
  try {
    const jar = await cookies();
    const parsed = decodePayload<DirectoryUser[]>(jar.get(USERS_DIR_COOKIE)?.value);
    return Array.isArray(parsed) && parsed.length ? parsed : null;
  } catch {
    return null;
  }
}

export async function writeUsersDirectoryCookie(
  users: DirectoryUser[]
): Promise<void> {
  try {
    const publicUsers = users.map(
      ({ passwordHash: _h, passwordSalt: _s, ...rest }) => rest
    );
    const jar = await cookies();
    jar.set(USERS_DIR_COOKIE, encodePayload(publicUsers), cookieOpts);
  } catch {
    /* fuera de un request */
  }
}

export async function readRolesDirectoryCookie(): Promise<CustomRoleDef[] | null> {
  try {
    const jar = await cookies();
    const parsed = decodePayload<CustomRoleDef[]>(jar.get(ROLES_DIR_COOKIE)?.value);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export async function writeRolesDirectoryCookie(
  roles: CustomRoleDef[]
): Promise<void> {
  try {
    const jar = await cookies();
    jar.set(ROLES_DIR_COOKIE, encodePayload(roles), cookieOpts);
  } catch {
    /* fuera de un request */
  }
}
