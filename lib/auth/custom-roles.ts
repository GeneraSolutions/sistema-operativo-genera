import {
  ROLE_LABELS,
  ROLES,
  isBuiltinRole,
  modulesForRole,
  slugRole,
  type AppModule,
  type CustomRoleDef,
} from "@/lib/auth/roles";
import {
  readRolesDirectoryCookie,
  writeRolesDirectoryCookie,
} from "@/lib/auth/directory-cookie";
import { persistGet, persistSet } from "@/lib/persist";

const ROLES_KEY = "genera:custom-roles";

declare global {
  // eslint-disable-next-line no-var
  var __generaRoleCache: CustomRoleDef[] | undefined;
}

function mergeRoles(...lists: (CustomRoleDef[] | null | undefined)[]): CustomRoleDef[] {
  const byId = new Map<string, CustomRoleDef>();
  for (const list of lists) {
    for (const role of list ?? []) {
      if (!role?.id) continue;
      byId.set(role.id, role);
    }
  }
  return [...byId.values()].sort((a, b) => a.label.localeCompare(b.label, "es"));
}

async function writeRoles(roles: CustomRoleDef[]) {
  globalThis.__generaRoleCache = roles;
  await persistSet(ROLES_KEY, roles);
  await writeRolesDirectoryCookie(roles);
}

export async function listCustomRoles(): Promise<CustomRoleDef[]> {
  const stored = await persistGet<CustomRoleDef[]>(ROLES_KEY);
  const fromCookie = await readRolesDirectoryCookie();
  const merged = mergeRoles(globalThis.__generaRoleCache, stored, fromCookie);
  globalThis.__generaRoleCache = merged;
  if (merged.length && (!stored || stored.length < merged.length)) {
    await persistSet(ROLES_KEY, merged).catch(() => undefined);
  }
  return merged;
}

export async function createCustomRole(input: {
  label: string;
  modules: AppModule[];
}): Promise<CustomRoleDef> {
  const label = input.label.trim();
  if (label.length < 3) throw new Error("El cargo necesita un nombre.");
  const modules = [...new Set(input.modules)].filter(Boolean);
  if (!modules.length) {
    throw new Error("Elija al menos un módulo para el cargo.");
  }
  let id = slugRole(label);
  const existing = await listCustomRoles();
  if (isBuiltinRole(id) || existing.some((r) => r.id === id)) {
    id = `${id}-${Date.now().toString(36).slice(-4)}`;
  }
  const role: CustomRoleDef = {
    id,
    label,
    modules,
    createdAt: new Date().toISOString(),
  };
  await writeRoles([role, ...existing]);
  return role;
}

export async function deleteCustomRole(id: string): Promise<void> {
  if (isBuiltinRole(id)) throw new Error("No se puede borrar un cargo de sistema.");
  const existing = await listCustomRoles();
  await writeRoles(existing.filter((r) => r.id !== id));
}

export async function isKnownRole(role: string): Promise<boolean> {
  if (isBuiltinRole(role)) return true;
  const custom = await listCustomRoles();
  return custom.some((r) => r.id === role);
}

export async function allRoleOptions(): Promise<
  { id: string; label: string; builtin: boolean; modules: AppModule[] }[]
> {
  const custom = await listCustomRoles();
  const builtins = ROLES.map((id) => ({
    id,
    label: ROLE_LABELS[id] ?? id,
    builtin: true,
    modules: modulesForRole(id, custom),
  }));
  const extras = custom.map((r) => ({
    id: r.id,
    label: r.label,
    builtin: false,
    modules: r.modules,
  }));
  return [...builtins, ...extras];
}
