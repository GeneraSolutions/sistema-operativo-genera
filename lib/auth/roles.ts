export const ROLES = [
  "ceo",
  "gerente",
  "comercial",
  "ingenieria",
  "operaciones",
  "compras",
  "contabilidad",
  "sst",
] as const;

export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  ceo: "Gerente / CEO",
  gerente: "Gerencia operativa",
  comercial: "Asesor comercial",
  ingenieria: "Ingeniería",
  operaciones: "Operaciones y O&M",
  compras: "Compras y logística",
  contabilidad: "Contabilidad",
  sst: "SST / HSE",
};

export type AppModule = "cotizador" | "inventario" | "inteligencia" | "equipo";

const MODULE_ROLES: Record<AppModule, Role[]> = {
  cotizador: [
    "ceo",
    "gerente",
    "comercial",
    "ingenieria",
    "operaciones",
    "contabilidad",
  ],
  inventario: ["ceo", "gerente", "compras", "ingenieria", "contabilidad"],
  inteligencia: [
    "ceo",
    "gerente",
    "comercial",
    "ingenieria",
    "operaciones",
    "compras",
    "contabilidad",
    "sst",
  ],
  equipo: ["ceo", "gerente"],
};

export function canAccessModule(role: Role, mod: AppModule): boolean {
  return MODULE_ROLES[mod].includes(role);
}

export function moduleFromPath(pathname: string): AppModule | null {
  if (pathname.startsWith("/cotizador")) return "cotizador";
  if (pathname.startsWith("/inventario")) return "inventario";
  if (pathname.startsWith("/inteligencia")) return "inteligencia";
  if (pathname.startsWith("/equipo")) return "equipo";
  return null;
}

export function defaultHomeForRole(role: Role): string {
  if (canAccessModule(role, "cotizador")) return "/cotizador";
  if (canAccessModule(role, "inteligencia")) return "/inteligencia";
  if (canAccessModule(role, "inventario")) return "/inventario";
  return "/inteligencia";
}
