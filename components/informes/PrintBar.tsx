"use client";

import { BrandLogo } from "@/components/BrandLogo";

export function PrintBar({ title }: { title: string }) {
  return (
    <header className="gen-doc-bar print:hidden">
      <div className="flex items-center gap-3">
        <BrandLogo height={36} />
        <p>{title}</p>
      </div>
      <button type="button" onClick={() => window.print()}>
        Imprimir / PDF
      </button>
    </header>
  );
}
