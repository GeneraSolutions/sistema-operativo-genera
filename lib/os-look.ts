export const OS_LOOK_KEY = "genera.os-look.v2";
export const OS_SIDEBAR_KEY = "genera.sidebar";

export type OsLook = "moderno" | "operativo";
export type OsSidebar = "amplio" | "compacto";

export const OS_LOOKS: readonly [OsLook, string][] = [
  ["moderno", "Moderno"],
  ["operativo", "Operativo"],
];

function asLook(raw: string | null): OsLook {
  return raw === "operativo" ? "operativo" : "moderno";
}

export function loadOsLook(): OsLook {
  if (typeof window === "undefined") return "moderno";
  try {
    return asLook(localStorage.getItem(OS_LOOK_KEY));
  } catch {
    return "moderno";
  }
}

export function saveOsLook(look: OsLook) {
  localStorage.setItem(OS_LOOK_KEY, look);
  document.documentElement.dataset.look = look;
  window.dispatchEvent(new Event("genera-os-look"));
}

export function loadOsSidebar(): OsSidebar {
  if (typeof window === "undefined") return "amplio";
  try {
    return localStorage.getItem(OS_SIDEBAR_KEY) === "compacto" ? "compacto" : "amplio";
  } catch {
    return "amplio";
  }
}

export function saveOsSidebar(mode: OsSidebar) {
  localStorage.setItem(OS_SIDEBAR_KEY, mode);
  document.documentElement.dataset.sidebar = mode;
}

export const OS_LOOK_BOOT = `try{var d=document.documentElement;d.setAttribute("data-look",localStorage.getItem("${OS_LOOK_KEY}")==="operativo"?"operativo":"moderno");d.setAttribute("data-sidebar",localStorage.getItem("${OS_SIDEBAR_KEY}")==="compacto"?"compacto":"amplio")}catch(e){document.documentElement.setAttribute("data-look","moderno")}`;
