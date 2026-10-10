"use client";

import Link from "next/link";
import { AppShell } from "@/components/AppShell";

export default function SinAccesoPage() {
  return (
    <AppShell title="Sin acceso" subtitle="Permisos de cargo">
      <div className="rounded-2xl border border-[#ddd6c8] bg-white p-8">
        <h2 className="text-xl font-semibold">Este módulo no está en su cargo</h2>
        <p className="mt-2 max-w-xl text-sm leading-6 text-[#4d5c55]">
          Su usuario está activo, pero este apartado está reservado a otros
          roles. Si necesita acceso, pídalo al CEO o a gerencia operativa.
        </p>
        <Link
          href="/inteligencia"
          className="mt-4 inline-block rounded-xl bg-[#0f2a1f] px-4 py-2.5 text-sm font-semibold text-white"
        >
          Ir a Inteligencia
        </Link>
      </div>
    </AppShell>
  );
}
