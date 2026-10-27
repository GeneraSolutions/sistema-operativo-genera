"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Archive,
  Boxes,
  Calculator,
  ClipboardCheck,
  Clapperboard,
  FileText,
  HardHat,
  LayoutDashboard,
  LogOut,
  Menu,
  PackageOpen,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Search,
  Sparkles,
  SquareKanban,
  Users,
  Wrench,
  X,
  type LucideIcon,
} from "lucide-react";
import { OsLookToggle } from "@/components/OsLookToggle";
import { loadOsSidebar, saveOsSidebar, type OsSidebar } from "@/lib/os-look";

export type ShellNavItem = {
  href: string;
  label: string;
  hint: string;
  group: ShellNavGroup;
};

export type ShellNavGroup = "comercial" | "operacion" | "recursos" | "admin";

const GROUP_LABELS: Record<ShellNavGroup, string> = {
  comercial: "Comercial",
  operacion: "Operación",
  recursos: "Recursos",
  admin: "Administración",
};

const GROUP_ORDER: ShellNavGroup[] = ["comercial", "operacion", "recursos", "admin"];

const ICONS: Record<string, LucideIcon> = {
  "/inicio": LayoutDashboard,
  "/pipeline": SquareKanban,
  "/cotizador": Calculator,
  "/cotizador/equipos": PackageOpen,
  "/visita-tecnica": ClipboardCheck,
  "/informes": FileText,
  "/om": Wrench,
  "/obra": HardHat,
  "/archivo": Archive,
  "/inventario": Boxes,
  "/inteligencia": Sparkles,
  "/contenido": Clapperboard,
  "/equipo": Users,
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "G";
}

export function ShellSidebar({
  nav,
  activeHref,
  me,
  onLogout,
  onSearch,
  onNew,
}: {
  nav: ShellNavItem[];
  activeHref: string;
  me: { name: string; roleLabel: string } | null;
  onLogout: () => void;
  onSearch: () => void;
  onNew: () => void;
}) {
  const [mode, setMode] = useState<OsSidebar>("amplio");
  const [open, setOpen] = useState(false);

  useEffect(() => setMode(loadOsSidebar()), []);
  useEffect(() => setOpen(false), [activeHref]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  function toggleMode() {
    const next: OsSidebar = mode === "compacto" ? "amplio" : "compacto";
    saveOsSidebar(next);
    setMode(next);
  }

  const groups = GROUP_ORDER.map((g) => ({
    id: g,
    items: nav.filter((n) => n.group === g),
  })).filter((g) => g.items.length > 0);

  const compact = mode === "compacto";

  return (
    <>
      <div className="os-topbar print:hidden">
        <Link href="/inicio" className="os-topbar-brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icons/icon-192.png" alt="" className="os-side-mark" />
          <span>
            <span className="os-side-kicker">Genera Solutions SAS</span>
            <span className="os-side-title">Sistema Operativo</span>
          </span>
        </Link>
        <button
          type="button"
          className="os-icon-btn"
          onClick={onSearch}
          aria-label="Buscar"
        >
          <Search size={19} />
        </button>
        <button
          type="button"
          className="os-icon-btn"
          onClick={() => setOpen(true)}
          aria-label="Abrir menú"
        >
          <Menu size={20} />
        </button>
      </div>

      <div
        className={`os-side-backdrop print:hidden ${open ? "is-open" : ""}`}
        onClick={() => setOpen(false)}
        aria-hidden
      />

      <aside
        className={`os-side print:hidden ${open ? "is-open" : ""}`}
        aria-label="Navegación principal"
      >
        <div className="os-side-head">
          <Link href="/inicio" className="os-side-brand" title="Sistema Operativo Solar">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icons/icon-192.png" alt="Genera Solutions SAS" className="os-side-mark" />
            <span className="os-side-brand-text">
              <span className="os-side-kicker">Genera Solutions SAS</span>
              <span className="os-side-title">Sistema Operativo</span>
            </span>
          </Link>
          <button
            type="button"
            className="os-icon-btn os-side-close"
            onClick={() => setOpen(false)}
            aria-label="Cerrar menú"
          >
            <X size={18} />
          </button>
        </div>

        <div className="os-side-quick">
          <button
            type="button"
            className="os-side-new"
            onClick={() => {
              setOpen(false);
              onNew();
            }}
            data-tip="Nuevo"
            aria-label="Nuevo"
          >
            <Plus size={17} />
            <span className="os-side-label">Nuevo</span>
          </button>
          <button
            type="button"
            className="os-side-search"
            onClick={() => {
              setOpen(false);
              onSearch();
            }}
            data-tip="Buscar (Ctrl K)"
            aria-label="Buscar"
          >
            <Search size={16} className="os-side-icon" />
            <span className="os-side-label os-side-search-text">Buscar…</span>
            <kbd className="os-kbd os-side-label">Ctrl K</kbd>
          </button>
        </div>

        <nav className="os-side-nav">
          {groups.map((g) => (
            <div key={g.id} className="os-side-group">
              <p className="os-side-group-label">{GROUP_LABELS[g.id]}</p>
              {g.items.map((item) => {
                const Icon = ICONS[item.href] ?? LayoutDashboard;
                const active = item.href === activeHref;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`os-side-link ${active ? "is-active" : ""}`}
                    aria-current={active ? "page" : undefined}
                    data-tip={item.label}
                    title={compact ? undefined : item.hint}
                  >
                    <Icon className="os-side-icon" size={18} strokeWidth={1.75} />
                    <span className="os-side-label">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="os-side-foot">
          <div className="os-side-tools">
            <OsLookToggle className="os-side-look" />
            <button
              type="button"
              className="os-icon-btn os-side-collapse"
              onClick={toggleMode}
              aria-label={compact ? "Expandir menú" : "Compactar menú"}
              title={compact ? "Expandir menú" : "Compactar menú"}
            >
              {compact ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
            </button>
          </div>
          {me ? (
            <div className="os-side-user">
              <span className="os-avatar" aria-hidden>
                {initials(me.name)}
              </span>
              <span className="os-side-user-text">
                <span className="os-side-user-name">{me.name}</span>
                <span className="os-side-user-role">{me.roleLabel}</span>
              </span>
              <button
                type="button"
                className="os-icon-btn os-side-logout"
                onClick={onLogout}
                aria-label="Cerrar sesión"
                title="Cerrar sesión"
              >
                <LogOut size={16} />
              </button>
            </div>
          ) : null}
        </div>
      </aside>
    </>
  );
}

export { GROUP_LABELS as SHELL_GROUP_LABELS };
