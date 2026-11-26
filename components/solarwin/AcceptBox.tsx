"use client";

import { useState } from "react";
import type { SolarwinAcceptance } from "@/lib/solarwin";

function when(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("es-CO", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Bogota",
  });
}

/** "Revisado y conforme" para quien recibe el enlace (Solar win). */
export function AcceptBox({
  id,
  initial,
}: {
  id: string;
  initial: SolarwinAcceptance | null;
}) {
  const [acceptance, setAcceptance] = useState(initial);
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/solarwin/aceptar/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, note }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok || res.status === 409) {
        if (data.acceptance) setAcceptance(data.acceptance as SolarwinAcceptance);
        else if (!res.ok) setError(data.error || "No se pudo confirmar.");
        return;
      }
      setError(data.error || "No se pudo confirmar.");
    } catch {
      setError("No se pudo confirmar. Intente de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  if (acceptance) {
    return (
      <section
        className="mx-auto mt-6 max-w-[52rem] rounded-2xl border border-[#bcd6c6] bg-[#f1f8f3] px-5 py-4 text-sm"
        style={{ printColorAdjust: "exact" }}
      >
        <p className="font-semibold text-[#1f6b45]">
          ✓ Revisado y conforme por {acceptance.name}
        </p>
        <p className="mt-0.5 text-[#4d5c55]">{when(acceptance.at)}</p>
        {acceptance.note ? (
          <p className="mt-2 whitespace-pre-wrap text-[#12241c]">
            “{acceptance.note}”
          </p>
        ) : null}
      </section>
    );
  }

  return (
    <section className="mx-auto mt-6 max-w-[52rem] rounded-2xl border border-[#e4ddd0] bg-white px-5 py-4 print:hidden">
      <h2 className="text-sm font-semibold text-[#12241c]">
        ¿Las cuentas están correctas?
      </h2>
      <p className="mt-0.5 text-sm text-[#4d5c55]">
        Confirma que revisaste este estado de cuenta. Quedará registrado con tu
        nombre y la fecha.
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <input
          className="rounded-xl border border-[#d8d2c4] bg-[#fbfaf6] px-3 py-2.5 text-sm"
          placeholder="Tu nombre"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={80}
        />
        <input
          className="rounded-xl border border-[#d8d2c4] bg-[#fbfaf6] px-3 py-2.5 text-sm"
          placeholder="Comentario (opcional)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={500}
        />
      </div>
      {error ? <p className="mt-2 text-sm text-[#9b3b2e]">{error}</p> : null}
      <button
        type="button"
        disabled={busy || name.trim().length < 2}
        onClick={submit}
        className="mt-3 h-10 rounded-xl bg-[#0f2a1f] px-4 text-sm font-semibold text-white disabled:opacity-50"
      >
        {busy ? "Confirmando…" : "Revisado y conforme"}
      </button>
    </section>
  );
}
