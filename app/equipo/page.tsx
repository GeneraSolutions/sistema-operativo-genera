"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { WorkFold } from "@/components/WorkFold";
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
  const [showCargo, setShowCargo] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
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
  const [installOpen, setInstallOpen] = useState(false);
  const [installConfig, setInstallConfig] = useState<AliadoInstallConfig>(
    DEFAULT_ALIADO_INSTALL
  );

  const roleLabel = useMemo(() => {
    const map = new Map(roles.map((r) => [r.id, r.label]));
    return (role: string) => map.get(role) || ROLE_LABELS[role] || role;
  }, [roles]);

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
      title="Equipo y cargos"
      subtitle="Usuarios del sistema operativo"
    >
      <p className="os-page-intro mb-6 max-w-3xl text-sm leading-6 text-[#4d5c55]">
        Cree un usuario por persona. El cargo define a qué módulos entra. Las
        consultas de Inteligencia del CEO no las ve nadie más; el CEO sí ve las
        de todo el equipo.
      </p>

      <section className="os-panel mb-4 rounded-2xl border border-[#ddd6c8] bg-white p-5">
        <WorkFold
          title="Nuevo usuario"
          open={formOpen}
          onToggle={() => setFormOpen((v) => !v)}
        >
      <form
        onSubmit={onCreate}
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5"
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
        </WorkFold>
      </section>

      <section className="os-panel mb-8 rounded-2xl border border-[#ddd6c8] bg-white p-5">
        <WorkFold
          title="Cargos"
          open={showCargo}
          onToggle={() => setShowCargo((v) => !v)}
        >
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
        </WorkFold>
      </section>

      <section className="os-panel mb-8 rounded-2xl border border-[#ddd6c8] bg-white p-5">
        <WorkFold
          title="Instalación para aliado"
          open={installOpen}
          onToggle={() => setInstallOpen((v) => !v)}
        >
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
            className="mt-3 rounded-xl bg-[#0f2a1f] px-4 py-2.5 text-sm font-semibold text-white"
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
        </WorkFold>
      </section>

      {error ? <p className="mb-3 text-sm text-[#9b2c2c]">{error}</p> : null}
      {ok ? <p className="mb-3 text-sm text-[#1f6b45]">{ok}</p> : null}

      <div className="os-panel overflow-x-auto rounded-2xl border border-[#ddd6c8] bg-white">
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
                      onClick={() => void patch(u.id, { active: !u.active })}
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
