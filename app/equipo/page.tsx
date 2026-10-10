"use client";

import { FormEvent, useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { ROLE_LABELS, ROLES, type Role } from "@/lib/auth/roles";

interface TeamUser {
  id: string;
  username: string;
  name: string;
  role: Role;
  active: boolean;
  createdAt: string;
}

export default function EquipoPage() {
  const [users, setUsers] = useState<TeamUser[]>([]);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [form, setForm] = useState({
    name: "",
    username: "",
    password: "",
    role: "comercial" as Role,
  });

  async function load() {
    const res = await fetch("/api/auth/users");
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "No se pudo cargar el equipo");
      return;
    }
    setUsers(data.users);
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
    setForm({ name: "", username: "", password: "", role: "comercial" });
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
    void load();
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
        className="mb-8 grid gap-3 rounded-2xl border border-[#ddd6c8] bg-white p-5 sm:grid-cols-2 lg:grid-cols-5"
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
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-end">
          <button
            type="submit"
            className="w-full rounded-xl bg-[#0f2a1f] px-3 py-2.5 text-sm font-semibold text-white"
          >
            Crear usuario
          </button>
        </div>
      </form>

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
                <td className="px-4 py-3">{ROLE_LABELS[u.role]}</td>
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
