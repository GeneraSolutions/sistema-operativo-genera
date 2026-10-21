export const OS_LOOK_KEY = "genera.os-look";

export type OsLook = "clasico" | "operativo";

export function loadOsLook(): OsLook {
  if (typeof window === "undefined") return "operativo";
  try {
    const raw = localStorage.getItem(OS_LOOK_KEY);
    return raw === "clasico" ? "clasico" : "operativo";
  } catch {
    return "operativo";
  }
}

export function saveOsLook(look: OsLook) {
  localStorage.setItem(OS_LOOK_KEY, look);
  document.documentElement.dataset.look = look;
  window.dispatchEvent(new Event("genera-os-look"));
}

export const OS_LOOK_BOOT = `try{var l=localStorage.getItem("genera.os-look");document.documentElement.setAttribute("data-look",l==="clasico"?"clasico":"operativo")}catch(e){document.documentElement.setAttribute("data-look","operativo")}`;
