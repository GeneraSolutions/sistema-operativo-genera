"use client";

import { useEffect } from "react";

/** Abre el diálogo de impresión (Guardar como PDF) si la URL trae ?imprimir=1. */
export function AutoPrint() {
  useEffect(() => {
    if (!new URLSearchParams(window.location.search).has("imprimir")) return;
    const t = window.setTimeout(() => window.print(), 700);
    return () => window.clearTimeout(t);
  }, []);
  return null;
}
