import { readFileSync } from "fs";
import path from "path";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import type { Role } from "@/lib/auth/roles";
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

function seedCeo(): StoredUser {
  const { hash, salt } = hashPassword(DEFAULT_CEO_PASSWORD);
  return {
    id: crypto.randomUUID(),
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

async function readUsers(): Promise<StoredUser[]> {
  const stored = await persistGet<StoredUser[]>(USERS_KEY);
  if (stored && stored.length) return stored;
  const legacy = migrateLegacyFile();
  if (legacy) {
    await persistSet(USERS_KEY, legacy);
    return legacy;
  }
  const ceo = seedCeo();
  await persistSet(USERS_KEY, [ceo]);
  return [ceo];
}

async function writeUsers(users: StoredUser[]) {
  await persistSet(USERS_KEY, users);
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
  return {
    id: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
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
