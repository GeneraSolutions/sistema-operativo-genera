"use client";

import { useEffect, useState } from "react";
import { OS_LOOKS, loadOsLook, saveOsLook, type OsLook } from "@/lib/os-look";

export function OsLookToggle({ className = "" }: { className?: string }) {
  const [look, setLook] = useState<OsLook>("moderno");

  useEffect(() => {
    const sync = () => setLook(loadOsLook());
    sync();
    window.addEventListener("genera-os-look", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("genera-os-look", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  function choose(next: OsLook) {
    saveOsLook(next);
    setLook(next);
  }

  return (
    <div
      className={`os-look-toggle print:hidden flex rounded-lg bg-[#0a1f17] p-0.5 ring-1 ring-[#1f4636] ${className}`}
      role="group"
      aria-label="Diseño del sistema"
    >
      {OS_LOOKS.map(([id, label]) => {
        const on = look === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => choose(id)}
            aria-pressed={on}
            className={`os-look-option rounded-md px-2.5 py-1 text-[11px] font-semibold tracking-wide uppercase ${
              on
                ? "bg-[#1f6b45] text-white"
                : "text-[#8aa398] hover:text-white"
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
