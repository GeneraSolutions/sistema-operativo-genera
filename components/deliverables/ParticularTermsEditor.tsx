"use client";

import type { ParticularTerm } from "@/types/proposal";

const field =
  "w-full rounded-xl border border-[#d8d2c4] bg-white px-3 py-2.5 text-sm";

export function ParticularTermsEditor({
  terms,
  onChange,
}: {
  terms: ParticularTerm[];
  onChange: (next: ParticularTerm[]) => void;
}) {
  const written = terms.filter((term) => term.title.trim() || term.body.trim()).length;

  function patch(id: string, next: Partial<ParticularTerm>) {
    onChange(terms.map((term) => (term.id === id ? { ...term, ...next } : term)));
  }

  return (
    <section className="rounded-2xl border border-[#d4b46a]/50 bg-white p-4 print:hidden">
      <p className="text-[11px] font-semibold tracking-[0.16em] text-[#8a6b2a] uppercase">
        Condiciones particulares
      </p>
      <p className="mt-1 text-xs leading-5 text-[#6d7c74]">
        {written
          ? `${written} en este contrato. Prevalecen sobre los artículos estándar solo donde los contradigan. Precio, cantidades y equipos siguen los de la cotización.`
          : "Para un término distinto con este cliente. Si queda vacío, el contrato no incluye este artículo."}
      </p>
      <div className="mt-3 space-y-3">
        {terms.map((term, index) => (
          <div
            key={term.id}
            className="rounded-xl border border-[#eee8dc] bg-[#fbfaf6] p-3"
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-xs font-semibold text-[#12241c]">
                Cláusula {index + 1}
              </p>
              <button
                type="button"
                className="text-xs font-semibold text-[#9b2c2c]"
                onClick={() => onChange(terms.filter((row) => row.id !== term.id))}
              >
                Quitar
              </button>
            </div>
            <input
              className={field}
              value={term.title}
              placeholder="Título, por ejemplo Anticipo del 30%"
              onChange={(e) => patch(term.id, { title: e.target.value })}
            />
            <textarea
              className={`${field} mt-2`}
              rows={3}
              value={term.body}
              placeholder="El texto que verá el cliente en el contrato."
              onChange={(e) => patch(term.id, { body: e.target.value })}
            />
          </div>
        ))}
      </div>
      <button
        type="button"
        className="mt-3 rounded-xl bg-[#0f2a1f] px-3 py-2 text-sm font-medium text-white"
        onClick={() =>
          onChange([
            ...terms,
            { id: crypto.randomUUID(), title: "", body: "" },
          ])
        }
      >
        Añadir cláusula
      </button>
    </section>
  );
}
