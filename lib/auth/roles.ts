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

export type BuiltinRole = (typeof ROLES)[number];
export type Role = string;

export const ROLE_LABELS: Record<string, string> = {
  ceo: "Gerente / CEO",
  gerente: "Gerencia operativa",
  comercial: "Asesor comercial",
  ingenieria: "Ingeniería",
  operaciones: "Operaciones y O&M",
  compras: "Compras y logística",
  contabilidad: "Contabilidad",
  sst: "SST / HSE",
};

export type AppModule =
  | "pipeline"
  | "cotizador"
  | "visita"
  | "informes"
  | "om"
  | "obra"
  | "inventario"
  | "inteligencia"
  | "equipo"
  | "archivo";

export const APP_MODULES: { id: AppModule; label: string }[] = [
  { id: "pipeline", label: "Pipeline comercial" },
  { id: "cotizador", label: "Cotizador" },
  { id: "visita", label: "Visitas técnicas" },
  { id: "informes", label: "Informes técnicos" },
  { id: "om", label: "O&M" },
  { id: "obra", label: "Obra" },
  { id: "archivo", label: "Archivo" },
  { id: "inventario", label: "Inventario" },
  { id: "inteligencia", label: "Inteligencia" },
  { id: "equipo", label: "Equipo y cargos" },
];

const MODULE_ROLES: Record<AppModule, string[]> = {
  pipeline: ["ceo", "gerente", "comercial"],
  cotizador: [
    "ceo",
    "gerente",
    "comercial",
    "ingenieria",
    "operaciones",
    "contabilidad",
  ],
  visita: [
    "ceo",
    "gerente",
    "comercial",
    "ingenieria",
    "operaciones",
    "sst",
  ],
  informes: [
    "ceo",
    "gerente",
    "ingenieria",
    "operaciones",
    "sst",
    "comercial",
  ],
  om: ["ceo", "gerente", "operaciones", "ingenieria", "comercial"],
  obra: [
    "ceo",
    "gerente",
    "operaciones",
    "ingenieria",
    "sst",
    "comercial",
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
  archivo: [
    "ceo",
    "gerente",
    "comercial",
    "ingenieria",
    "operaciones",
    "contabilidad",
    "sst",
  ],
};

export interface CustomRoleDef {
  id: string;
  label: string;
  modules: AppModule[];
  createdAt: string;
}

export const ROLE_PRESETS: { label: string; modules: AppModule[] }[] = [
  { label: "Auxiliar", modules: ["visita", "informes", "inteligencia"] },
  { label: "Auxiliar eléctrico", modules: ["visita", "informes", "inteligencia"] },
  { label: "Auxiliar técnico", modules: ["visita", "informes", "om", "inteligencia"] },
  {
    label: "Coordinador de proyectos",
    modules: [
      "pipeline",
      "cotizador",
      "visita",
      "informes",
      "om",
      "obra",
      "inteligencia",
      "inventario",
    ],
  },
];

export function isBuiltinRole(role: string): role is BuiltinRole {
  return (ROLES as readonly string[]).includes(role);
}

export function slugRole(label: string): string {
  const slug = label
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  return slug || `cargo-${Date.now().toString(36)}`;
}

export function modulesForRole(
  role: string,
  custom: CustomRoleDef[] = []
): AppModule[] {
  const extra = custom.find((c) => c.id === role);
  if (extra) return extra.modules;
  return APP_MODULES.map((m) => m.id).filter((mod) =>
    MODULE_ROLES[mod].includes(role)
  );
}

export function canAccessModule(
  role: string,
  mod: AppModule,
  custom: CustomRoleDef[] = []
): boolean {
  const mods = modulesForRole(role, custom);
  if (mod === "archivo") {
    return (
      mods.includes("archivo") ||
      mods.includes("cotizador") ||
      mods.includes("visita") ||
      mods.includes("informes") ||
      mods.includes("om") ||
      mods.includes("obra") ||
      mods.includes("pipeline")
    );
  }
  if (mods.includes(mod)) return true;
  return MODULE_ROLES[mod]?.includes(role) ?? false;
}

export function sessionAllowsModule(
  mod: AppModule,
  role: string,
  sessionModules?: string[]
): boolean {
  // Built-in cargos: ignore the module list frozen in the cookie so new OS
  // modules (Informes, etc.) appear without forcing a new login.
  if (isBuiltinRole(role)) {
    return canAccessModule(role, mod);
  }
  if (mod === "archivo") {
    if (sessionModules?.length) {
      return (
        sessionModules.includes("archivo") ||
        sessionModules.includes("cotizador") ||
        sessionModules.includes("visita") ||
        sessionModules.includes("informes") ||
        sessionModules.includes("om") ||
        sessionModules.includes("obra") ||
        sessionModules.includes("pipeline")
      );
    }
    return canAccessModule(role, "archivo");
  }
  if (sessionModules?.length) return sessionModules.includes(mod);
  return canAccessModule(role, mod);
}

export function roleLabel(role: string, custom: CustomRoleDef[] = []): string {
  const extra = custom.find((c) => c.id === role);
  if (extra) return extra.label;
  return ROLE_LABELS[role] ?? role;
}

export function moduleFromPath(pathname: string): AppModule | null {
  if (pathname.startsWith("/pipeline")) return "pipeline";
  if (pathname.startsWith("/cotizador")) return "cotizador";
  if (pathname.startsWith("/visita-tecnica")) return "visita";
  if (pathname.startsWith("/informes")) return "informes";
  if (pathname.startsWith("/om")) return "om";
  if (pathname.startsWith("/obra")) return "obra";
  if (pathname.startsWith("/inventario")) return "inventario";
  if (pathname.startsWith("/inteligencia")) return "inteligencia";
  if (pathname.startsWith("/equipo")) return "equipo";
  if (pathname.startsWith("/archivo")) return "archivo";
  return null;
}

export function defaultHomeForRole(
  _role?: string,
  _custom: CustomRoleDef[] = []
): string {
  return "/inicio";
}
