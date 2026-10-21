"use client";

import type { ReactNode } from "react";

export function WorkFold({
  title,
  open,
  onToggle,
  actions,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <>
      <div className="flex items-start justify-between gap-2">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-center justify-between gap-3 text-left"
        >
          <h2 className="font-semibold">{title}</h2>
          <span
            aria-hidden
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#fbfaf6] text-lg font-semibold text-[#1f6b45]"
          >
            {open ? "−" : "+"}
          </span>
        </button>
        {actions}
      </div>
      <div className={open ? "mt-3" : "hidden print:block"}>{children}</div>
    </>
  );
}
