"use client";

import { FormEvent, useState } from "react";
import { BrandLogo } from "@/components/BrandLogo";
import { OsLookToggle } from "@/components/OsLookToggle";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo ingresar");
      const next = new URLSearchParams(window.location.search).get("next");
      window.location.href = next || data.home || "/inicio";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="os-login flex min-h-screen items-center justify-center bg-[#0f2a1f] px-4">
      <div className="os-login-card w-full max-w-md rounded-2xl bg-white p-8 shadow-[0_20px_50px_rgba(0,0,0,0.25)]">
        <div className="mb-4 flex justify-end">
          <OsLookToggle />
        </div>
        <BrandLogo height={56} />
        <p className="mt-4 text-[11px] font-semibold tracking-[0.28em] text-[#8a6b2a] uppercase">
          Genera Solutions SAS
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-[#12241c]">
          Sistema Operativo Solar
        </h1>
        <p className="os-page-intro mt-2 text-sm text-[#4d5c55]">
          Ingrese con su usuario y clave. El acceso depende de su cargo.
        </p>
        <form onSubmit={onSubmit} className="mt-6 space-y-3" autoComplete="off">
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Usuario</span>
            <input
              name="usuario"
              autoComplete="off"
              className="w-full rounded-xl border border-[#d8d2c4] bg-[#fbfaf6] px-3 py-2.5"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Clave</span>
            <input
              type="password"
              name="clave"
              autoComplete="new-password"
              className="w-full rounded-xl border border-[#d8d2c4] bg-[#fbfaf6] px-3 py-2.5"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          {error ? (
            <p className="text-sm font-medium text-[#9b2c2c]">{error}</p>
          ) : null}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-[#0f2a1f] px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
          >
            {loading ? "Ingresando…" : "Ingresar"}
          </button>
        </form>
      </div>
    </div>
  );
}
