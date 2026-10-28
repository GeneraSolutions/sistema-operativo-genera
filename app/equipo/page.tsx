"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Plus, X } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import {
  APP_MODULES,
  ROLE_LABELS,
  ROLE_PRESETS,
  type AppModule,
  type Role,
} from "@/lib/auth/roles";
import {
  DEFAULT_ALIADO_INSTALL,
  type AliadoInstallConfig,
} from "@/lib/aliado-install";

interface TeamUser {
  id: string;
  username: string;
  name: string;
  role: Role;
  active: boolean;
  createdAt: string;
}

interface RoleOption {
  id: string;
  label: string;
  builtin: boolean;
  modules: AppModule[];
}

const TEAM_CACHE_KEY = "genera:team-directory";

const field =
  "w-full rounded-xl border border-[#d8d2c4] bg-[#fbfaf6] px-3 py-2.5 text-sm";

function readTeamCache(): TeamUser[] {
  try {
    const raw = localStorage.getItem(TEAM_CACHE_KEY);
    const parsed = JSON.parse(raw || "[]") as TeamUser[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeTeamCache(users: TeamUser[]) {
  try {
    localStorage.setItem(TEAM_CACHE_KEY, JSON.stringify(users));
  } catch {
    /* quota */
  }
}

function applyUser(list: TeamUser[], user: TeamUser): TeamUser[] {
  const next = list.map((u) => (u.id === user.id ? user : u));
  if (!next.some((u) => u.id === user.id)) next.push(user);
  return next;
}

export default function EquipoPage() {
  const [users, setUsers] = useState<TeamUser[]>([]);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [menu, setMenu] = useState(false);
  const [panel, setPanel] = useState<"new" | "cargos" | "install" | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [form, setForm] = useState({
    name: "",
    username: "",
    password: "",
    role: "comercial" as Role,
  });
  const [cargoForm, setCargoForm] = useState({
    label: "",
    modules: ["visita", "inteligencia"] as AppModule[],
  });
  const [installConfig, setInstallConfig] = useState<AliadoInstallConfig>(
    DEFAULT_ALIADO_INSTALL
  );

  const roleLabel = useMemo(() => {
    const map = new Map(roles.map((r) => [r.id, r.label]));
    return (role: string) => map.get(role) || ROLE_LABELS[role] || role;
  }, [roles]);
  const selected = users.find((u) => u.id === selectedId) ?? null;
  const activeCount = users.filter((u) => u.active).length;

  async function load() {
    try {
      const res = await fetch("/api/auth/users", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) {
        const cached = readTeamCache();
        if (cached.length) setUsers(cached);
        setError(data.error || "No se pudo cargar el equipo");
        return;
      }
      const fromApi = (data.users as TeamUser[]) ?? [];
      setUsers(fromApi);
      writeTeamCache(fromApi);
      if (data.roles) setRoles(data.roles);
    } catch {
      const cached = readTeamCache();
      if (cached.length) setUsers(cached);
      setError("No se pudo cargar el equipo");
    }
  }

  useEffect(() => {
    if (!menu) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current?.contains(e.target as Node)) return;
      setMenu(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenu(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menu]);

  useEffect(() => {
    if (!panel) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPanel(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [panel]);

  function openPanel(next: "new" | "cargos" | "install") {
    setMenu(false);
    setPanel(next);
  }

  useEffect(() => {
    void load();
    void fetch("/api/aliado/install", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.config) setInstallConfig(data.config);
      })
      .catch(() => undefined);
  }, []);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setError("");
    setOk("");
    const res = await fetch("/api/auth/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "No se pudo crear");
      return;
    }
    if (data.user) {
      const next = applyUser(users, data.user);
      setUsers(next);
      writeTeamCache(next);
    }
    setForm({ name: "", username: "", password: "", role: form.role });
    if (data.user?.id) setSelectedId(data.user.id);
    setPanel(null);
    setOk(`Usuario ${data.user.username} creado.`);
    void load();
  }

  async function patch(id: string, body: Record<string, unknown>) {
    setError("");
    setOk("");
    const res = await fetch(`/api/auth/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "No se pudo actualizar");
      return;
    }
    if (data.user) {
      const next = applyUser(users, data.user);
      setUsers(next);
      writeTeamCache(next);
      setOk(
        data.user.active
          ? `${data.user.name} quedó activo.`
          : `${data.user.name} quedó inactivo. Ya no puede entrar.`
      );
    }
  }

  async function remove(id: string) {
    if (!confirm("¿Eliminar este usuario? No volverá a aparecer al recargar.")) return;
    setError("");
    setOk("");
    const res = await fetch(`/api/auth/users/${id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "No se pudo eliminar");
      return;
    }
    const next = users.filter((u) => u.id !== id);
    setUsers(next);
    writeTeamCache(next);
    if (selectedId === id) setSelectedId("");
    setOk("Usuario eliminado.");
  }

  function toggleModule(mod: AppModule) {
    setCargoForm((f) => ({
      ...f,
      modules: f.modules.includes(mod)
        ? f.modules.filter((m) => m !== mod)
        : [...f.modules, mod],
    }));
  }

  async function createCargo(label: string, modules: AppModule[]) {
    setError("");
    setOk("");
    const res = await fetch("/api/auth/roles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label, modules }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "No se pudo crear el cargo");
      return;
    }
    if (data.roles) setRoles(data.roles);
    if (data.role?.id) {
      setForm((f) => ({ ...f, role: data.role.id }));
    }
    setCargoForm({ label: "", modules: ["visita", "inteligencia"] });
    setOk(`Cargo “${data.role.label}” creado. Ya lo puede asignar a un usuario.`);
  }

  async function onCreateCargo(e: FormEvent) {
    e.preventDefault();
    await createCargo(cargoForm.label, cargoForm.modules);
  }

  async function removeCargo(id: string) {
    if (!confirm("¿Eliminar este cargo? Los usuarios que lo tengan siguen con el mismo id hasta que los cambie."))
      return;
    const res = await fetch(`/api/auth/roles?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "No se pudo borrar el cargo");
      return;
    }
    if (data.roles) setRoles(data.roles);
  }

  return (
    <AppShell
      title="Equipo"
      subtitle="Personas, cargos y acceso"
      actions={
        <>
          <div className="os-menu print:hidden" ref={menuRef}>
            <button
              type="button"
              className="os-btn os-btn-ghost"
              aria-expanded={menu}
              onClick={() => setMenu((open) => !open)}
            >
              Más
              <ChevronDown size={15} />
            </button>
            {menu ? (
              <div className="os-menu-pop" role="menu">
                <button
                  type="button"
                  role="menuitem"
                  className="os-menu-item"
                  onClick={() => openPanel("cargos")}
                >
                  <span>Cargos</span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="os-menu-item"
                  onClick={() => openPanel("install")}
                >
                  <span>Instalación para aliado</span>
                </button>
              </div>
            ) : null}
          </div>
          <button
            type="button"
            className="os-btn os-btn-primary"
            onClick={() => openPanel("new")}
          >
            <Plus size={16} />
            Nuevo usuario
          </button>
        </>
      }
    >
      {panel === "new" ? (
        <>
          <div className="os-drawer-backdrop" onClick={() => setPanel(null)} />
          <aside className="os-drawer" data-open="true" aria-label="Nuevo usuario">
            <header className="os-drawer-head">
              <div>
                <p className="os-drawer-kicker">Acceso</p>
                <h2 className="os-drawer-title">Nuevo usuario</h2>
              </div>
              <button
                type="button"
                className="os-icon-btn"
                aria-label="Cerrar"
                onClick={() => setPanel(null)}
              >
                <X size={18} />
              </button>
            </header>
            <form onSubmit={onCreate} className="os-drawer-body">
        <label className="text-sm lg:col-span-1">
          <span className="mb-1 block font-medium">Nombre</span>
          <input
            className="w-full rounded-xl border border-[#d8d2c4] bg-[#fbfaf6] px-3 py-2"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            required
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium">Usuario</span>
          <input
            className="w-full rounded-xl border border-[#d8d2c4] bg-[#fbfaf6] px-3 py-2"
            value={form.username}
            onChange={(e) =>
              setForm((f) => ({ ...f, username: e.target.value }))
            }
            required
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium">Clave (mín. 8)</span>
          <input
            type="password"
            className="w-full rounded-xl border border-[#d8d2c4] bg-[#fbfaf6] px-3 py-2"
            value={form.password}
            onChange={(e) =>
              setForm((f) => ({ ...f, password: e.target.value }))
            }
            required
            minLength={8}
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium">Cargo</span>
          <select
            className="w-full rounded-xl border border-[#d8d2c4] bg-[#fbfaf6] px-3 py-2"
            value={form.role}
            onChange={(e) =>
              setForm((f) => ({ ...f, role: e.target.value as Role }))
            }
          >
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-end gap-2">
          <button
            type="submit"
            className="os-btn os-btn-primary"
          >
            Crear usuario
          </button>
        </div>
      </form>
          </aside>
        </>
      ) : null}

      {panel === "cargos" ? (
        <>
          <div className="os-drawer-backdrop" onClick={() => setPanel(null)} />
          <aside className="os-drawer" data-open="true" aria-label="Cargos">
            <header className="os-drawer-head">
              <div>
                <p className="os-drawer-kicker">Acceso</p>
                <h2 className="os-drawer-title">Cargos</h2>
              </div>
              <button
                type="button"
                className="os-icon-btn"
                aria-label="Cerrar"
                onClick={() => setPanel(null)}
              >
                <X size={18} />
              </button>
            </header>
            <div className="os-drawer-body">
          <p className="os-page-intro mb-3 text-xs text-[#4d5c55]">
            Auxiliar, auxiliar eléctrico, coordinador de proyectos y los que
            necesite.
          </p>
          <p className="mb-3 text-sm font-semibold text-[#0f2a1f]">
            Cargos rápidos
          </p>
          <div className="mb-5 flex flex-wrap gap-2">
            {ROLE_PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                className="rounded-full border border-[#c9d7cf] bg-[#f7f4ee] px-3 py-1.5 text-sm hover:bg-[#e8f3ec]"
                onClick={() => void createCargo(preset.label, preset.modules)}
              >
                + {preset.label}
              </button>
            ))}
          </div>
          <form onSubmit={onCreateCargo} className="grid gap-4 lg:grid-cols-3">
            <label className="text-sm">
              <span className="mb-1 block font-medium">Nombre del cargo</span>
              <input
                className="w-full rounded-xl border border-[#d8d2c4] bg-[#fbfaf6] px-3 py-2"
                placeholder="Ej. Auxiliar de bodega"
                value={cargoForm.label}
                onChange={(e) =>
                  setCargoForm((f) => ({ ...f, label: e.target.value }))
                }
                required
              />
            </label>
            <div className="text-sm lg:col-span-2">
              <span className="mb-1 block font-medium">Módulos que puede usar</span>
              <div className="flex flex-wrap gap-2">
                {APP_MODULES.filter(
                  (m) => m.id !== "equipo" && m.id !== "archivo"
                ).map((mod) => (
                  <label
                    key={mod.id}
                    className={`cursor-pointer rounded-full border px-3 py-1.5 ${
                      cargoForm.modules.includes(mod.id)
                        ? "border-[#1f6b45] bg-[#e8f3ec] font-medium"
                        : "border-[#ddd6c8] bg-[#fbfaf6]"
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="mr-1.5"
                      checked={cargoForm.modules.includes(mod.id)}
                      onChange={() => toggleModule(mod.id)}
                    />
                    {mod.label}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <button
                type="submit"
                className="rounded-xl bg-[#0f2a1f] px-4 py-2.5 text-sm font-semibold text-white"
              >
                Guardar cargo
              </button>
            </div>
          </form>
          {roles.some((r) => !r.builtin) ? (
            <ul className="mt-5 space-y-2 text-sm">
              {roles
                .filter((r) => !r.builtin)
                .map((r) => (
                  <li
                    key={r.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[#f7f4ee] px-3 py-2"
                  >
                    <span>
                      <strong>{r.label}</strong>
                      <span className="ml-2 text-[#6d7c74]">
                        {r.modules.join(", ")}
                      </span>
                    </span>
                    <button
                      type="button"
                      className="text-xs font-semibold text-[#9b2c2c] underline"
                      onClick={() => void removeCargo(r.id)}
                    >
                      Quitar
                    </button>
                  </li>
                ))}
            </ul>
          ) : null}
            </div>
          </aside>
        </>
      ) : null}

      {panel === "install" ? (
        <>
          <div className="os-drawer-backdrop" onClick={() => setPanel(null)} />
          <aside className="os-drawer" data-open="true" aria-label="Instalación para aliado">
            <header className="os-drawer-head">
              <div>
                <p className="os-drawer-kicker">Aliado</p>
                <h2 className="os-drawer-title">Instalación</h2>
              </div>
              <button
                type="button"
                className="os-icon-btn"
                aria-label="Cerrar"
                onClick={() => setPanel(null)}
              >
                <X size={18} />
              </button>
            </header>
            <div className="os-drawer-body">
          <p className="mb-3 text-xs text-[#6d7c74]">
            Tarifa al aliado: máximo(kWp, piso) × COP/kWp + herramienta + viaje +
            ARL. Los jornales son el piso interno, no se le cobran aparte.
          </p>
          <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <label className="text-sm">
              <span className="mb-1 block text-xs text-[#6d7c74]">Piso (kWp)</span>
              <input
                type="number"
                className="w-full rounded-xl border border-[#d8d2c4] bg-[#fbfaf6] px-3 py-2"
                value={installConfig.minBillableKwp}
                onChange={(e) =>
                  setInstallConfig((c) => ({
                    ...c,
                    minBillableKwp: Math.max(1, Number(e.target.value) || 1),
                  }))
                }
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-xs text-[#6d7c74]">Jornal (COP/día)</span>
              <input
                type="number"
                className="w-full rounded-xl border border-[#d8d2c4] bg-[#fbfaf6] px-3 py-2"
                value={installConfig.dailyWageCOP}
                onChange={(e) =>
                  setInstallConfig((c) => ({
                    ...c,
                    dailyWageCOP: Math.max(0, Number(e.target.value) || 0),
                  }))
                }
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-xs text-[#6d7c74]">ARL por obra</span>
              <input
                type="number"
                className="w-full rounded-xl border border-[#d8d2c4] bg-[#fbfaf6] px-3 py-2"
                value={installConfig.arlPerProjectCOP}
                onChange={(e) =>
                  setInstallConfig((c) => ({
                    ...c,
                    arlPerProjectCOP: Math.max(0, Number(e.target.value) || 0),
                  }))
                }
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-xs text-[#6d7c74]">
                Herramienta COP/kWp
              </span>
              <input
                type="number"
                className="w-full rounded-xl border border-[#d8d2c4] bg-[#fbfaf6] px-3 py-2"
                value={installConfig.toolCopPerKwp}
                onChange={(e) =>
                  setInstallConfig((c) => ({
                    ...c,
                    toolCopPerKwp: Math.max(0, Number(e.target.value) || 0),
                  }))
                }
              />
            </label>
          </div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#8a6b2a]">
            Viajes
          </p>
          <div className="mb-4 grid gap-2 sm:grid-cols-3">
            {installConfig.trips.map((t) => (
              <label key={t.id} className="text-sm">
                <span className="mb-1 block text-xs text-[#6d7c74]">
                  {t.label} (COP)
                </span>
                <input
                  type="number"
                  className="w-full rounded-xl border border-[#d8d2c4] bg-[#fbfaf6] px-3 py-2"
                  value={t.cop}
                  onChange={(e) => {
                    const cop = Math.max(0, Number(e.target.value) || 0);
                    setInstallConfig((c) => ({
                      ...c,
                      trips: c.trips.map((x) =>
                        x.id === t.id ? { ...x, cop } : x
                      ),
                    }));
                  }}
                />
              </label>
            ))}
          </div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#8a6b2a]">
            Franjas COP / kWp
          </p>
          <div className="space-y-2">
            {installConfig.bands.map((band, i) => (
              <div key={band.maxKwp} className="grid gap-2 sm:grid-cols-3">
                <label className="text-sm">
                  <span className="mb-1 block text-xs text-[#6d7c74]">Hasta kWp</span>
                  <input
                    type="number"
                    className="w-full rounded-xl border border-[#d8d2c4] bg-[#fbfaf6] px-3 py-2"
                    value={band.maxKwp}
                    onChange={(e) => {
                      const maxKwp = Math.max(1, Number(e.target.value) || 1);
                      setInstallConfig((c) => ({
                        ...c,
                        bands: c.bands.map((b, j) =>
                          j === i ? { ...b, maxKwp } : b
                        ),
                      }));
                    }}
                  />
                </label>
                <label className="text-sm">
                  <span className="mb-1 block text-xs text-[#6d7c74]">COP / kWp</span>
                  <input
                    type="number"
                    className="w-full rounded-xl border border-[#d8d2c4] bg-[#fbfaf6] px-3 py-2"
                    value={band.copPerKwp}
                    onChange={(e) => {
                      const copPerKwp = Math.max(0, Number(e.target.value) || 0);
                      setInstallConfig((c) => ({
                        ...c,
                        bands: c.bands.map((b, j) =>
                          j === i ? { ...b, copPerKwp } : b
                        ),
                      }));
                    }}
                  />
                </label>
                <label className="text-sm">
                  <span className="mb-1 block text-xs text-[#6d7c74]">Nombre</span>
                  <input
                    className="w-full rounded-xl border border-[#d8d2c4] bg-[#fbfaf6] px-3 py-2"
                    value={band.label}
                    onChange={(e) => {
                      const label = e.target.value;
                      setInstallConfig((c) => ({
                        ...c,
                        bands: c.bands.map((b, j) =>
                          j === i ? { ...b, label } : b
                        ),
                      }));
                    }}
                  />
                </label>
              </div>
            ))}
          </div>
          <button
            type="button"
            className="os-btn os-btn-primary mt-3"
            onClick={async () => {
              setError("");
              const res = await fetch("/api/aliado/install", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ config: installConfig }),
              });
              const data = await res.json();
              if (!res.ok) {
                setError(data.error || "No se guardó la tarifa");
                return;
              }
              if (data.config) setInstallConfig(data.config);
              setOk("Tarifa de instalación para aliado guardada.");
            }}
          >
            Guardar tarifas
          </button>
            </div>
          </aside>
        </>
      ) : null}

      <div className="os-inv-split">
        <section className="os-work os-file-panel">
          <div className="os-inv-sheet-bar">
            <span>
              {users.length} {users.length === 1 ? "persona" : "personas"} · {activeCount}{" "}
              {activeCount === 1 ? "activa" : "activas"}
            </span>
          </div>
          {users.length === 0 ? (
            <div className="os-empty">
              <p className="os-empty-title">Aún no hay personas</p>
              <p className="os-empty-hint">
                Cree un usuario por persona. El cargo define a qué módulos entra.
              </p>
            </div>
          ) : (
            <div className="os-inv-table-wrap">
              <table className="os-inv-table">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Usuario</th>
                    <th>Cargo</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => {
                    const on = selectedId === u.id;
                    return (
                      <tr
                        key={u.id}
                        className={on ? "is-on" : u.active ? "" : "is-off"}
                        onClick={() => setSelectedId(u.id)}
                      >
                        <td>
                          <button type="button" className="os-inv-row-open">
                            <span className="os-work-row-title">{u.name}</span>
                          </button>
                        </td>
                        <td>{u.username}</td>
                        <td>{roleLabel(u.role)}</td>
                        <td>
                          <span className="os-pill" data-tone={u.active ? "ok" : "neutral"}>
                            {u.active ? "Activo" : "Inactivo"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <aside
          className="os-drawer os-inv-pane"
          data-open={selected ? "true" : undefined}
          aria-hidden={!selected}
          aria-label="Ficha de la persona"
        >
          <div className="os-empty os-inv-pane-empty">
            <p className="os-empty-title">La ficha aparece aquí</p>
            <p className="os-empty-hint">
              Pulse una persona para ver el cargo, activarla o quitarla. El CEO no se elimina.
            </p>
          </div>
          {selected ? (
            <>
              <header className="os-drawer-head">
                <div className="min-w-0">
                  <p className="os-drawer-kicker">{selected.username}</p>
                  <h2 className="os-drawer-title">{selected.name}</h2>
                  <span className="os-pill" data-tone={selected.active ? "ok" : "neutral"}>
                    {selected.active ? "Activo" : "Inactivo"}
                  </span>
                </div>
                <button
                  type="button"
                  className="os-icon-btn"
                  aria-label="Cerrar ficha"
                  onClick={() => setSelectedId("")}
                >
                  <X size={18} />
                </button>
              </header>
              <div className="os-drawer-body">
                {selected.role === "ceo" ? (
                  <p className="os-cnt-field">
                    <span>Cargo</span>
                    {roleLabel(selected.role)}
                  </p>
                ) : (
                  <label className="os-cnt-field">
                    <span>Cargo</span>
                    <select
                      className={field}
                      value={selected.role}
                      onChange={(e) => void patch(selected.id, { role: e.target.value })}
                    >
                      {roles.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <p className="os-page-intro mt-4 text-sm">
                  El cargo define a qué módulos entra. Las consultas de Inteligencia del CEO no las ve nadie más.
                </p>
              </div>
              <footer className="os-drawer-foot">
                {selected.role !== "ceo" ? (
                  <button
                    type="button"
                    className="os-btn os-btn-ghost is-danger"
                    onClick={() => void remove(selected.id)}
                  >
                    Eliminar
                  </button>
                ) : (
                  <span />
                )}
                <button
                  type="button"
                  className="os-btn os-btn-ghost"
                  onClick={() => void patch(selected.id, { active: !selected.active })}
                >
                  {selected.active ? "Desactivar" : "Activar"}
                </button>
              </footer>
            </>
          ) : null}
        </aside>
        {selected ? (
          <div className="os-drawer-backdrop" onClick={() => setSelectedId("")} />
        ) : null}
      </div>

      {error || ok ? (
        <div className="os-toast" role="status">
          {error || ok}
        </div>
      ) : null}
    </AppShell>
  );
}
