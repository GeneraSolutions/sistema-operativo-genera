"use client";

import { BrandLogo } from "@/components/BrandLogo";

export function PrintBar({ title }: { title: string }) {
  return (
    <header className="print:hidden sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 border-b border-[#ddd6c8] bg-[#f4efe4]/95 px-4 py-3 backdrop-blur">
      <div className="flex items-center gap-3">
        <BrandLogo height={40} />
        <p className="text-sm font-semibold">{title}</p>
      </div>
      <button
        type="button"
        className="rounded-xl bg-[#0f2a1f] px-4 py-2 text-sm font-semibold text-white"
        onClick={() => window.print()}
      >
        Imprimir / PDF
      </button>
    </header>
  );
}
