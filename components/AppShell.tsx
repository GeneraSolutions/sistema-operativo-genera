"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/cotizador", label: "Cotizador", hint: "Paramétrico" },
  { href: "/inventario", label: "Inventario", hint: "Catálogo & TRM" },
  { href: "/inteligencia", label: "Inteligencia", hint: "Especialistas AI" },
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

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <header className="border-b border-[#1a3d2e] bg-[#0f2a1f]">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-4">
          <div className="min-w-0">
            <Link href="/cotizador" className="group block">
              <p className="text-[11px] font-semibold tracking-[0.28em] text-[#d4b46a] uppercase">
                Genera Solutions SAS
              </p>
              <h1 className="mt-0.5 truncate text-xl font-semibold text-white group-hover:text-[#e8d9a8]">
                Sistema Operativo Solar
              </h1>
            </Link>
            <p className="mt-1 text-sm text-[#c9d7cf]">
              {title}
              {subtitle ? (
                <span className="text-[#8aa398]"> · {subtitle}</span>
              ) : null}
            </p>
          </div>

          <nav className="flex flex-wrap gap-1 rounded-xl bg-[#0a1f17] p-1 ring-1 ring-[#1f4636]">
            {NAV.map((item) => {
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
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-8">{children}</main>
    </div>
  );
}
