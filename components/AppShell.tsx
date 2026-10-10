"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { BrandLogo } from "@/components/BrandLogo";
import {
  ROLE_LABELS,
  canAccessModule,
  defaultHomeForRole,
  type AppModule,
  type Role,
} from "@/lib/auth/roles";

const NAV: { href: string; label: string; hint: string; module: AppModule }[] = [
  { href: "/cotizador", label: "Cotizador", hint: "Paramétrico", module: "cotizador" },
  { href: "/inventario", label: "Inventario", hint: "Catálogo & TRM", module: "inventario" },
  { href: "/inteligencia", label: "Inteligencia", hint: "Especialistas AI", module: "inteligencia" },
  { href: "/equipo", label: "Equipo", hint: "Usuarios y cargos", module: "equipo" },
];

export function AppShell({
  children,
  title,
  subtitle,
}: {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
}) {
  const pathname = usePathname();
  const [me, setMe] = useState<{
    name: string;
    username: string;
    role: Role;
  } | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.user) setMe(data.user);
      })
      .catch(() => null);
  }, []);

  const nav = NAV.filter((item) =>
    me ? canAccessModule(me.role, item.module) : item.module !== "equipo"
  );

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <header className="border-b border-[#1a3d2e] bg-[#0f2a1f]">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-4">
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-3">
              <BrandLogo height={44} />
              <Link
                href={me ? defaultHomeForRole(me.role) : "/inteligencia"}
                className="group min-w-0"
              >
                <p className="text-[11px] font-semibold tracking-[0.28em] text-[#d4b46a] uppercase">
                  Genera Solutions SAS
                </p>
                <h1 className="mt-0.5 truncate text-xl font-semibold text-white group-hover:text-[#e8d9a8]">
                  Sistema Operativo Solar
                </h1>
              </Link>
            </div>
            <p className="mt-1 text-sm text-[#c9d7cf]">
              {title}
              {subtitle ? (
                <span className="text-[#8aa398]"> · {subtitle}</span>
              ) : null}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <nav className="flex flex-wrap gap-1 rounded-xl bg-[#0a1f17] p-1 ring-1 ring-[#1f4636]">
              {nav.map((item) => {
                const active = pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`rounded-lg px-3.5 py-2 text-sm transition ${
                      active
                        ? "bg-[#1f6b45] font-semibold text-white shadow-sm"
                        : "text-[#c9d7cf] hover:bg-[#143528] hover:text-white"
                    }`}
                  >
                    <span className="block leading-tight">{item.label}</span>
                    <span
                      className={`block text-[10px] tracking-wide uppercase ${
                        active ? "text-[#b8e0cc]" : "text-[#6d8a7c]"
                      }`}
                    >
                      {item.hint}
                    </span>
                  </Link>
                );
              })}
            </nav>
            {me ? (
              <div className="text-right">
                <p className="text-sm font-semibold text-white">{me.name}</p>
                <p className="text-[10px] uppercase tracking-wide text-[#d4b46a]">
                  {ROLE_LABELS[me.role]}
                </p>
                <button
                  type="button"
                  onClick={() => void logout()}
                  className="mt-1 text-[11px] text-[#c9d7cf] underline"
                >
                  Cerrar sesión
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-8">{children}</main>
    </div>
  );
}
