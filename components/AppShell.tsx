"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { OsCommand, type OsCommandMode } from "@/components/OsCommand";
import { clearPrivateCache } from "@/components/PwaSetup";
import {
  SHELL_GROUP_LABELS,
  ShellSidebar,
  type ShellNavGroup,
} from "@/components/ShellSidebar";
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
  group: ShellNavGroup;
  module?: AppModule;
  always?: boolean;
}[] = [
  { href: "/inicio", label: "Hoy", hint: "Qué está caliente", group: "comercial", always: true },
  { href: "/pipeline", label: "Pipeline", hint: "Leads y cierre", group: "comercial", module: "pipeline" },
  { href: "/cotizador", label: "Cotizador", hint: "Paramétrico", group: "comercial", module: "cotizador" },
  { href: "/cotizador/equipos", label: "Solo equipos", hint: "Hasta 12 ítems", group: "comercial", module: "cotizador" },
  { href: "/visita-tecnica", label: "Visitas", hint: "Levantamiento", group: "operacion", module: "visita" },
  { href: "/informes", label: "Informes", hint: "Inspección y O&M", group: "operacion", module: "informes" },
  { href: "/om", label: "O&M", hint: "Plantas y calendario", group: "operacion", module: "om" },
  { href: "/obra", label: "Obra", hint: "Avance y trámites", group: "operacion", module: "obra" },
  { href: "/archivo", label: "Archivo", hint: "Guardados", group: "recursos", module: "archivo" },
  { href: "/inventario", label: "Inventario", hint: "Catálogo & TRM", group: "recursos", module: "inventario" },
  { href: "/inteligencia", label: "Inteligencia", hint: "Especialistas AI", group: "recursos", module: "inteligencia" },
  { href: "/contenido", label: "Contenido", hint: "Calendario y briefs", group: "recursos", module: "contenido" },
  { href: "/equipo", label: "Equipo", hint: "Usuarios y cargos", group: "admin", module: "equipo" },
];

export function AppShell({
  children,
  title,
  printTitle,
  subtitle,
  actions,
}: {
  children: React.ReactNode;
  title: string;
  printTitle?: string;
  subtitle?: string;
  actions?: React.ReactNode;
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

  const nav = useMemo(
    () =>
      NAV.filter((item) => {
        if (me && isAliadoRole(me.role)) {
          return item.module === "cotizador";
        }
        if (item.always) return true;
        if (!item.module) return true;
        if (!me) return item.module !== "equipo";
        return sessionAllowsModule(item.module, me.role, me.modules);
      }),
    [me]
  );

  const [cmd, setCmd] = useState<{ open: boolean; mode: OsCommandMode }>({
    open: false,
    mode: "buscar",
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCmd((c) => ({ open: !c.open, mode: "buscar" }));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const activeHref =
    nav
      .map((n) => n.href)
      .filter((href) => pathname === href || pathname.startsWith(`${href}/`))
      .sort((a, b) => b.length - a.length)[0] ?? "";
  const activeItem = nav.find((n) => n.href === activeHref);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    await clearPrivateCache();
    window.location.href = "/login";
  }

  const roleLabel = me ? me.roleLabel || ROLE_LABELS[me.role] || me.role : "";

  return (
    <div className="os-app min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <ShellSidebar
        nav={nav}
        activeHref={activeHref}
        me={me ? { name: me.name, roleLabel } : null}
        onLogout={() => void logout()}
        onSearch={() => setCmd({ open: true, mode: "buscar" })}
        onNew={() => setCmd({ open: true, mode: "nuevo" })}
      />
      <OsCommand
        open={cmd.open}
        mode={cmd.mode}
        onClose={() => setCmd((c) => ({ ...c, open: false }))}
        nav={nav}
        aliado={Boolean(me && isAliadoRole(me.role))}
        username={me?.username}
      />
      <main className="os-shell-main">
        <div className="os-page-head">
          <div className="os-page-head-text">
            <p className="os-page-crumb">
              <span>Genera OS</span>
              {activeItem ? (
                <>
                  <span aria-hidden>/</span>
                  <span>{SHELL_GROUP_LABELS[activeItem.group]}</span>
                </>
              ) : null}
            </p>
            <h1 className="os-page-title">
              {printTitle ? (
                <>
                  <span className="print:hidden">{title}</span>
                  <span className="hidden print:inline">{printTitle}</span>
                </>
              ) : (
                title
              )}
            </h1>
            {subtitle ? <p className="os-page-sub">{subtitle}</p> : null}
          </div>
          {actions ? <div className="os-page-actions print:hidden">{actions}</div> : null}
        </div>
        {pathname.startsWith("/cotizador") ? (
          <div className="os-subtabs mb-5 flex flex-wrap gap-1 rounded-xl bg-[#0f2a1f] p-1 print:hidden">
            <Link
              href="/cotizador"
              className={`os-subtab rounded-lg px-4 py-2 text-sm font-semibold ${
                pathname === "/cotizador"
                  ? "is-active bg-[#1f6b45] text-white"
                  : "text-[#c9d7cf] hover:bg-[#143528] hover:text-white"
              }`}
            >
              Planta / proyecto
            </Link>
            <Link
              href="/cotizador/equipos"
              className={`os-subtab rounded-lg px-4 py-2 text-sm font-semibold ${
                pathname.startsWith("/cotizador/equipos")
                  ? "is-active bg-[#1f6b45] text-white"
                  : "text-[#c9d7cf] hover:bg-[#143528] hover:text-white"
              }`}
            >
              Solo equipos
            </Link>
          </div>
        ) : null}
        {children}
      </main>
    </div>
  );
}
