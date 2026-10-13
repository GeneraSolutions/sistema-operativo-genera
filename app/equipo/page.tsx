"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import {
  APP_MODULES,
  ROLE_LABELS,
  ROLE_PRESETS,
  type AppModule,
  type Role,
} from "@/lib/auth/roles";

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

function mergeTeam(a: TeamUser[], b: TeamUser[]): TeamUser[] {
  const byUser = new Map<string, TeamUser>();
  for (const user of [...a, ...b]) {
    if (!user?.username) continue;
    byUser.set(user.username.toLowerCase(), user);
  }
  return [...byUser.values()];
}

export default function EquipoPage() {
  const [users, setUsers] = useState<TeamUser[]>([]);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [showCargo, setShowCargo] = useState(false);
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

  const roleLabel = useMemo(() => {
    const map = new Map(roles.map((r) => [r.id, r.label]));
    return (role: string) => map.get(role) || ROLE_LABELS[role] || role;
  }, [roles]);

  async function load() {
    const res = await fetch("/api/auth/users");
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "No se pudo cargar el equipo");
      return;
    }
    const cached = readTeamCache();
    const fromApi = (data.users as TeamUser[]) ?? [];
    const merged = mergeTeam(fromApi, cached);
    setUsers(merged);
    writeTeamCache(merged);
    if (data.roles) setRoles(data.roles);
    if (cached.length > fromApi.length) {
      const sync = await fetch("/api/auth/users/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ users: cached }),
      });
      if (sync.ok) {
        const synced = await sync.json();
        if (Array.isArray(synced.users)) {
          setUsers(synced.users);
          writeTeamCache(synced.users);
        }
      }
    }
  }

  useEffect(() => {
    void load();
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
      const next = mergeTeam(users, [data.user]);
      setUsers(next);
      writeTeamCache(next);
    }
    setForm({ name: "", username: "", password: "", role: form.role });
    setOk(`Usuario ${data.user.username} creado.`);
    void load();
  }

  async function patch(id: string, body: Record<string, unknown>) {
    setError("");
    const res = await fetch(`/api/auth/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "No se pudo actualizar");
      return;
    }
    void load();
  }

  async function remove(id: string) {
    if (!confirm("¿Eliminar este usuario?")) return;
    setError("");
    const res = await fetch(`/api/auth/users/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "No se pudo eliminar");
      return;
    }
    const next = users.filter((u) => u.id !== id);
    setUsers(next);
    writeTeamCache(next);
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
      title="Equipo y cargos"
      subtitle="Usuarios del sistema operativo"
    >
      <p className="mb-6 max-w-3xl text-sm leading-6 text-[#4d5c55]">
        Cree un usuario por persona. El cargo define a qué módulos entra. Las
        consultas de Inteligencia del CEO no las ve nadie más; el CEO sí ve las
        de todo el equipo.
      </p>

      <form
        onSubmit={onCreate}
        className="mb-4 grid gap-3 rounded-2xl border border-[#ddd6c8] bg-white p-5 sm:grid-cols-2 lg:grid-cols-5"
      >
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
            className="w-full rounded-xl bg-[#0f2a1f] px-3 py-2.5 text-sm font-semibold text-white"
          >
            Crear usuario
          </button>
        </div>
      </form>

      <div className="mb-8 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setShowCargo((v) => !v)}
          className="rounded-xl bg-[#1f6b45] px-4 py-2.5 text-sm font-semibold text-white"
        >
          {showCargo ? "Cerrar cargos" : "Crear más cargos"}
        </button>
        <p className="text-sm text-[#4d5c55]">
          Auxiliar, auxiliar eléctrico, coordinador de proyectos y los que
          necesite.
        </p>
      </div>

      {showCargo ? (
        <div className="mb-8 rounded-2xl border border-[#ddd6c8] bg-white p-5">
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
      ) : null}

      {error ? <p className="mb-3 text-sm text-[#9b2c2c]">{error}</p> : null}
      {ok ? <p className="mb-3 text-sm text-[#1f6b45]">{ok}</p> : null}

      <div className="overflow-x-auto rounded-2xl border border-[#ddd6c8] bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-[#f7f4ee] text-xs uppercase tracking-wide text-[#6d7c74]">
            <tr>
              <th className="px-4 py-3">Nombre</th>
              <th className="px-4 py-3">Usuario</th>
              <th className="px-4 py-3">Cargo</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t border-[#eee8dc]">
                <td className="px-4 py-3">{u.name}</td>
                <td className="px-4 py-3">{u.username}</td>
                <td className="px-4 py-3">{roleLabel(u.role)}</td>
                <td className="px-4 py-3">
                  {u.active ? "Activo" : "Inactivo"}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="text-xs font-semibold underline"
                      onClick={() => patch(u.id, { active: !u.active })}
                    >
                      {u.active ? "Desactivar" : "Activar"}
                    </button>
                    {u.role !== "ceo" ? (
                      <button
                        type="button"
                        className="text-xs font-semibold text-[#9b2c2c] underline"
                        onClick={() => remove(u.id)}
                      >
                        Eliminar
                      </button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
