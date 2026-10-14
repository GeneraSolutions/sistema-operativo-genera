"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { BrandLogo } from "@/components/BrandLogo";
import type { EpcProposal } from "@/types/proposal";

export function DeliverableShell({
  proposal,
  kicker,
  title,
  subtitle,
  children,
  accent = "kit",
}: {
  proposal: EpcProposal;
  kicker: string;
  title: string;
  subtitle: string;
  children: ReactNode;
  accent?: "kit" | "official";
}) {
  const gold = accent === "official";
  return (
    <div className="deliverable min-h-screen bg-[#f4efe4] text-[#1a241c]">
      <header className="print:hidden sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 border-b border-[#ddd6c8] bg-[#f4efe4]/95 px-4 py-3 backdrop-blur">
        <Link href={`/propuesta/epc/${proposal.id}`} className="flex items-center gap-2 text-sm">
          <BrandLogo height={28} />
          Volver a la cotización
        </Link>
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-lg bg-[#0f2a1f] px-3 py-1.5 text-sm font-medium text-white"
        >
          Imprimir / PDF
        </button>
      </header>

      <article className="mx-auto max-w-3xl px-5 py-10 print:max-w-none print:px-0 print:py-0">
        <div
          className={`rounded-[28px] border px-6 py-8 print:rounded-none print:border-0 print:px-0 print:py-0 ${
            gold
              ? "border-[#d4b46a]/50 bg-white shadow-[0_20px_50px_rgba(18,36,28,0.08)]"
              : "border-[#ddd6c8] bg-white shadow-[0_20px_50px_rgba(18,36,28,0.06)]"
          }`}
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <BrandLogo height={56} />
            <p className="text-right text-[11px] leading-5 text-[#6d7c74]">
              Genera Solutions SAS
              <br />
              {proposal.clientCity} · {proposal.clientName}
            </p>
          </div>
          <p
            className={`mt-8 text-[11px] font-semibold tracking-[0.22em] uppercase ${
              gold ? "text-[#8a6b2a]" : "text-[#1f6b45]"
            }`}
          >
            {kicker}
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#12241c]">
            {title}
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-[#4d5c55]">{subtitle}</p>
          <div className="mt-8 space-y-10">{children}</div>
        </div>
        <footer className="mt-8 pb-8 text-center text-xs leading-5 text-[#6d7c74] print:mt-6">
          Genera Solutions SAS · 317 455 3288 · 302 106 6719
          <br />
          www.generasolutions.com.co
        </footer>
      </article>
      <style>{`
        @media print {
          header { display: none !important; }
          @page { margin: 14mm; }
          body { background: white !important; }
        }
      `}</style>
    </div>
  );
}

export function DocH2({ children }: { children: ReactNode }) {
  return (
    <h2 className="text-lg font-semibold text-[#12241c]">{children}</h2>
  );
}

export function Callout({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <aside className="rounded-2xl border border-[#1f6b45]/25 bg-[#e8f6ee] px-4 py-3">
      <p className="text-xs font-semibold tracking-wide text-[#1f6b45] uppercase">
        {title}
      </p>
      <div className="mt-1 text-sm leading-6 text-[#244a38]">{children}</div>
    </aside>
  );
}
