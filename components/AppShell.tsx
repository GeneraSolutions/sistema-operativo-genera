"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { BrandLogo } from "@/components/BrandLogo";
import { OsLookToggle } from "@/components/OsLookToggle";
import {
  ROLE_LABELS,
  isAliadoRole,
  sessionAllowsModule,
  type AppModule,
  type Role,
} from "@/lib/auth/roles";

const NAV: {
  href: string;
  label: string;
  hint: string;
  module?: AppModule;
  always?: boolean;
}[] = [
  { href: "/inicio", label: "Hoy", hint: "Qué está caliente", always: true },
  { href: "/pipeline", label: "Pipeline", hint: "Leads y cierre", module: "pipeline" },
  { href: "/cotizador", label: "Cotizador", hint: "Paramétrico", module: "cotizador" },
  { href: "/cotizador/equipos", label: "Solo equipos", hint: "1 a 5 ítems", module: "cotizador" },
  { href: "/visita-tecnica", label: "Visitas", hint: "Levantamiento", module: "visita" },
  { href: "/informes", label: "Informes", hint: "Inspección y O&M", module: "informes" },
  { href: "/om", label: "O&M", hint: "Plantas y calendario", module: "om" },
  { href: "/obra", label: "Obra", hint: "Avance y trámites", module: "obra" },
  { href: "/archivo", label: "Archivo", hint: "Guardados", module: "archivo" },
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
    modules?: string[];
    roleLabel?: string;
  } | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.user) {
          setMe({ ...data.user, roleLabel: data.roleLabel });
        }
      })
      .catch(() => null);
  }, []);

  const nav = NAV.filter((item) => {
    if (me && isAliadoRole(me.role)) {
      return item.module === "cotizador";
    }
    if (item.always) return true;
    if (!item.module) return true;
    if (!me) return item.module !== "equipo";
    return sessionAllowsModule(item.module, me.role, me.modules);
  });

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  return (
    <div className="os-app min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <header className="os-shell-header border-b border-[#1a3d2e] bg-[var(--brand-deep)]">
        <div className="os-shell-inner mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-[var(--shell-header-py)]">
          <div className="os-shell-brand min-w-0">
            <div className="flex min-w-0 items-center gap-3">
              <BrandLogo height={52} className="os-shell-logo" />
              <Link href="/inicio" className="group min-w-0">
                <p className="os-shell-kicker text-[11px] font-semibold tracking-[0.28em] text-[#d4b46a] uppercase">
                  Genera Solutions SAS
                </p>
                <h1 className="os-shell-brand-title mt-0.5 truncate text-xl font-semibold text-white group-hover:text-[#e8d9a8]">
                  Sistema Operativo Solar
                </h1>
              </Link>
            </div>
            <p className="os-shell-page mt-1 text-sm text-[#c9d7cf]">
              {title}
              {subtitle ? (
                <span className="text-[#8aa398]"> · {subtitle}</span>
              ) : null}
            </p>
          </div>

          <div className="os-shell-tools flex flex-wrap items-center gap-3">
            <OsLookToggle />
            <nav className="os-shell-nav flex flex-wrap gap-1 rounded-xl bg-[#0a1f17] p-1 ring-1 ring-[#1f4636]">
              {nav.map((item) => {
                const matches = nav
                  .map((n) => n.href)
                  .filter(
                    (href) =>
                      pathname === href || pathname.startsWith(`${href}/`)
                  )
                  .sort((a, b) => b.length - a.length);
                const active = (matches[0] ?? "") === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={item.hint}
                    className={`os-nav-link rounded-lg px-3.5 py-2 text-sm transition ${
                      active
                        ? "bg-[#1f6b45] font-semibold text-white shadow-sm"
                        : "text-[#c9d7cf] hover:bg-[#143528] hover:text-white"
                    }`}
                  >
                    <span className="block leading-tight">{item.label}</span>
                    <span
                      className={`os-nav-hint block text-[10px] tracking-wide uppercase ${
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
              <div className="os-shell-user text-right">
                <p className="text-sm font-semibold text-white">{me.name}</p>
                <p className="text-[10px] uppercase tracking-wide text-[#d4b46a]">
                  {me.roleLabel || ROLE_LABELS[me.role] || me.role}
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
      <main className="os-shell-main mx-auto max-w-7xl px-6 py-[var(--shell-main-py)]">
        <div className="os-page-bar mb-4 hidden items-end justify-between gap-3 border-b border-[#e4dfd4] pb-3">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#8a6b2a]">
              Mesa de trabajo
            </p>
            <h2 className="truncate text-lg font-semibold text-[#12241c]">{title}</h2>
            {subtitle ? (
              <p className="os-page-bar-sub mt-0.5 truncate text-sm text-[#6d7c74]">
                {subtitle}
              </p>
            ) : null}
          </div>
        </div>
        {pathname.startsWith("/cotizador") ? (
          <div className="mb-5 flex flex-wrap gap-1 rounded-xl bg-[#0f2a1f] p-1 print:hidden">
            <Link
              href="/cotizador"
              className={`rounded-lg px-4 py-2 text-sm font-semibold ${
                pathname === "/cotizador"
                  ? "bg-[#1f6b45] text-white"
                  : "text-[#c9d7cf] hover:bg-[#143528] hover:text-white"
              }`}
            >
              Planta / proyecto
            </Link>
            <Link
              href="/cotizador/equipos"
              className={`rounded-lg px-4 py-2 text-sm font-semibold ${
                pathname.startsWith("/cotizador/equipos")
                  ? "bg-[#1f6b45] text-white"
                  : "text-[#c9d7cf] hover:bg-[#143528] hover:text-white"
              }`}
            >
              Solo equipos (1 a 5)
            </Link>
          </div>
        ) : null}
        {children}
      </main>
    </div>
  );
}
