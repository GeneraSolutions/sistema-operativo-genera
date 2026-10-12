import { readFileSync } from "fs";
import path from "path";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import {
  modulesForRole,
  type AppModule,
  type Role,
} from "@/lib/auth/roles";
import { listCustomRoles } from "@/lib/auth/custom-roles";
import {
  readUsersDirectoryCookie,
  writeUsersDirectoryCookie,
  type DirectoryUser,
} from "@/lib/auth/directory-cookie";
import type { SessionUser } from "@/lib/auth/session";
import { persistGet, persistSet } from "@/lib/persist";

export const DEFAULT_CEO_USERNAME = "camilo";
export const DEFAULT_CEO_PASSWORD = "GeneraCEO2026";

const USERS_KEY = "genera:users";

export interface StoredUser {
  id: string;
  username: string;
  name: string;
  role: Role;
  passwordHash: string;
  passwordSalt: string;
  active: boolean;
  createdAt: string;
}

export type PublicUser = Omit<StoredUser, "passwordHash" | "passwordSalt">;

declare global {
  // eslint-disable-next-line no-var
  var __generaUserCache: StoredUser[] | undefined;
}

function seedCeo(): StoredUser {
  const { hash, salt } = hashPassword(DEFAULT_CEO_PASSWORD);
  return {
    id: "ceo-camilo-genera",
    username: DEFAULT_CEO_USERNAME,
    name: "Camilo",
    role: "ceo",
    passwordHash: hash,
    passwordSalt: salt,
    active: true,
    createdAt: new Date().toISOString(),
  };
}

function migrateLegacyFile(): StoredUser[] | null {
  if (process.env.VERCEL) return null;
  try {
    const raw = readFileSync(
      path.join(process.cwd(), "data", "users.json"),
      "utf8"
    );
    const parsed = JSON.parse(raw) as StoredUser[];
    return Array.isArray(parsed) && parsed.length ? parsed : null;
  } catch {
    return null;
  }
}

function asStored(user: DirectoryUser | StoredUser): StoredUser {
  return {
    id: user.id,
    username: user.username.trim().toLowerCase(),
    name: user.name,
    role: user.role,
    passwordHash: user.passwordHash ?? "",
    passwordSalt: user.passwordSalt ?? "",
    active: user.active,
    createdAt: user.createdAt,
  };
}

function mergeUserLists(
  ...lists: ((StoredUser | DirectoryUser)[] | null | undefined)[]
): StoredUser[] {
  const byUsername = new Map<string, StoredUser>();
  for (const list of lists) {
    for (const raw of list ?? []) {
      if (!raw?.username) continue;
      const user = asStored(raw);
      const prev = byUsername.get(user.username);
      if (!prev) {
        byUsername.set(user.username, user);
        continue;
      }
      const chosen =
        (user.passwordHash ? 1 : 0) >= (prev.passwordHash ? 1 : 0) ? user : prev;
      if (!chosen.passwordHash) {
        chosen.passwordHash = prev.passwordHash || user.passwordHash;
        chosen.passwordSalt = prev.passwordSalt || user.passwordSalt;
      }
      if (prev.name && chosen.name === chosen.username) chosen.name = prev.name;
      byUsername.set(user.username, chosen);
    }
  }
  const ceo = [...byUsername.values()].filter((u) => u.role === "ceo");
  const rest = [...byUsername.values()]
    .filter((u) => u.role !== "ceo")
    .sort((a, b) => a.name.localeCompare(b.name, "es"));
  return [...ceo, ...rest];
}

async function readUsers(): Promise<StoredUser[]> {
  const stored = await persistGet<StoredUser[]>(USERS_KEY);
  const fromCookie = await readUsersDirectoryCookie();
  const merged = mergeUserLists(
    globalThis.__generaUserCache,
    stored,
    fromCookie
  );
  if (merged.length) {
    globalThis.__generaUserCache = merged;
    if (!stored || stored.length < merged.length) {
      await persistSet(USERS_KEY, merged).catch(() => undefined);
    }
    await writeUsersDirectoryCookie(merged);
    return merged;
  }
  const legacy = migrateLegacyFile();
  if (legacy) {
    await writeUsers(legacy);
    return legacy;
  }
  const ceo = seedCeo();
  await writeUsers([ceo]);
  return [ceo];
}

async function writeUsers(users: StoredUser[]) {
  globalThis.__generaUserCache = users;
  await persistSet(USERS_KEY, users);
  await writeUsersDirectoryCookie(users);
}

export function toPublicUser(user: StoredUser): PublicUser {
  const { passwordHash: _h, passwordSalt: _s, ...rest } = user;
  return rest;
}

export async function listUsers(): Promise<PublicUser[]> {
  return (await readUsers()).map(toPublicUser);
}

export async function findByUsername(
  username: string
): Promise<StoredUser | undefined> {
  const key = username.trim().toLowerCase();
  return (await readUsers()).find((u) => u.username === key);
}

export async function findById(id: string): Promise<StoredUser | undefined> {
  return (await readUsers()).find((u) => u.id === id);
}

export async function authenticate(
  username: string,
  password: string
): Promise<SessionUser | null> {
  const user = await findByUsername(username);
  if (!user || !user.active) return null;
  if (!verifyPassword(password, user.passwordHash, user.passwordSalt)) {
    return null;
  }
  const custom = await listCustomRoles();
  return {
    id: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
    modules: modulesForRole(user.role, custom),
  };
}

export async function createUser(input: {
  username: string;
  name: string;
  role: Role;
  password: string;
}): Promise<PublicUser> {
  const username = input.username.trim().toLowerCase();
  if (!username || !input.password || input.password.length < 8) {
    throw new Error("Usuario y clave de al menos 8 caracteres son obligatorios.");
  }
  const users = await readUsers();
  if (users.some((u) => u.username === username)) {
    throw new Error("Ese usuario ya existe.");
  }
  const { hash, salt } = hashPassword(input.password);
  const user: StoredUser = {
    id: crypto.randomUUID(),
    username,
    name: input.name.trim() || username,
    role: input.role,
    passwordHash: hash,
    passwordSalt: salt,
    active: true,
    createdAt: new Date().toISOString(),
  };
  await writeUsers([user, ...users]);
  return toPublicUser(user);
}

export async function updateUser(
  id: string,
  patch: {
    name?: string;
    role?: Role;
    active?: boolean;
    password?: string;
  }
): Promise<PublicUser> {
  const users = await readUsers();
  const idx = users.findIndex((u) => u.id === id);
  if (idx < 0) throw new Error("Usuario no encontrado.");
  const current = users[idx];
  if (current.role === "ceo" && patch.role && patch.role !== "ceo") {
    const otherCeo = users.some((u) => u.id !== id && u.role === "ceo" && u.active);
    if (!otherCeo) throw new Error("Debe existir al menos un CEO activo.");
  }
  if (current.role === "ceo" && patch.active === false) {
    const otherCeo = users.some((u) => u.id !== id && u.role === "ceo" && u.active);
    if (!otherCeo) throw new Error("No se puede desactivar el único CEO.");
  }
  const next: StoredUser = { ...current };
  if (patch.name != null) next.name = patch.name.trim() || next.name;
  if (patch.role) next.role = patch.role;
  if (typeof patch.active === "boolean") next.active = patch.active;
  if (patch.password) {
    if (patch.password.length < 8) {
      throw new Error("La clave debe tener al menos 8 caracteres.");
    }
    const { hash, salt } = hashPassword(patch.password);
    next.passwordHash = hash;
    next.passwordSalt = salt;
  }
  users[idx] = next;
  await writeUsers(users);
  return toPublicUser(next);
}

export async function deleteUser(id: string): Promise<void> {
  const users = await readUsers();
  const target = users.find((u) => u.id === id);
  if (!target) throw new Error("Usuario no encontrado.");
  if (target.role === "ceo") {
    throw new Error("El usuario CEO no se elimina. Desactívelo solo si hay otro CEO.");
  }
  await writeUsers(users.filter((u) => u.id !== id));
}

export async function sessionModulesFor(role: Role): Promise<AppModule[]> {
  const custom = await listCustomRoles();
  return modulesForRole(role, custom);
}

export async function upsertDirectoryFromSession(session: {
  id: string;
  username: string;
  name: string;
  role: Role;
}): Promise<void> {
  const users = await readUsers();
  const key = session.username.trim().toLowerCase();
  const existing = users.find((u) => u.username === key || u.id === session.id);
  if (existing) {
    if (existing.name === session.name && existing.role === session.role) return;
    existing.name = session.name || existing.name;
    existing.role = session.role || existing.role;
    await writeUsers(users);
    return;
  }
  await writeUsers([
    ...users,
    {
      id: session.id,
      username: key,
      name: session.name || key,
      role: session.role,
      passwordHash: "",
      passwordSalt: "",
      active: true,
      createdAt: new Date().toISOString(),
    },
  ]);
}

export async function syncDirectoryUsers(
  incoming: DirectoryUser[]
): Promise<PublicUser[]> {
  const current = await readUsers();
  const merged = mergeUserLists(current, incoming);
  await writeUsers(merged);
  return merged.map(toPublicUser);
}
