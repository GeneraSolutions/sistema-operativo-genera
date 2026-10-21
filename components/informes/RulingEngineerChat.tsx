"use client";

import { useRef, useState } from "react";
import {
  rulingPhotos,
  type PhotoRuling,
} from "@/lib/photo-ruling";
import { loadSpecialistManuals } from "@/lib/specialist-manuals";
import {
  applyRefinePatch,
  type RefinePatch,
  type RulingChatTurn,
} from "@/lib/ruling-refine";

const field =
  "w-full rounded-xl border border-[#d8d2c4] bg-[#fbfaf6] px-3 py-2.5 text-sm";

export function RulingEngineerChat({
  ruling,
  onRuling,
}: {
  ruling: PhotoRuling;
  onRuling: (next: PhotoRuling) => void;
}) {
  const [turns, setTurns] = useState<RulingChatTurn[]>([]);
  const [input, setInput] = useState("");
  const [target, setTarget] = useState<string>("general");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const boxRef = useRef<HTMLDivElement>(null);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    const history = [...turns, { role: "user" as const, content: text }];
    setTurns(history);
    setInput("");
    setLoading(true);
    setError("");
    try {
      const findingIndex =
        target === "general" ? undefined : Number(target);
      const photos = rulingPhotos(ruling);
      const finding =
        findingIndex != null ? ruling.hallazgos[findingIndex] : undefined;
      const fotoN = Number(finding?.foto);
      const focusPhoto =
        fotoN && photos[fotoN - 1] ? photos[fotoN - 1] : undefined;
      const res = await fetch("/api/informes/dictamen/afinar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          history: turns,
          findingIndex,
          ruling: {
            ...ruling,
            imageDataUrl: "",
            photos: photos.map((p, i) => ({
              id: p.id,
              caption: `foto${i + 1}`,
              dataUrl: "",
              notaCampo: p.notaCampo || "",
            })),
          },
          focusPhoto: focusPhoto
            ? { caption: `foto${fotoN}`, dataUrl: focusPhoto.dataUrl }
            : undefined,
          manuals: loadSpecialistManuals(),
        }),
      });
      const data = (await res.json()) as RefinePatch & { error?: string };
      if (!res.ok) throw new Error(data.error || "No se pudo afinar");
      const reply = data.reply || "Listo. Revise el punto en el dictamen.";
      setTurns([...history, { role: "assistant", content: reply }]);
      onRuling(applyRefinePatch(ruling, data));
      requestAnimationFrame(() => {
        boxRef.current?.scrollTo({
          top: boxRef.current.scrollHeight,
          behavior: "smooth",
        });
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al afinar");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="flex h-full flex-col rounded-2xl border border-[#ddd6c8] bg-white p-5">
      <h2 className="font-semibold">Chat con el ingeniero de IA</h2>
      <p className="os-page-intro mt-1 text-xs leading-5 text-[#6d7c74]">
        Ingeniero Héctor Palacio (RETIE). Elija un hallazgo o el dictamen
        completo, pida el ajuste y el texto del informe se actualiza. Usted
        puede seguir editando a mano.
      </p>
      <label className="mt-3 block text-sm">
        <span className="mb-1 block font-medium">Afina</span>
        <select
          className={field}
          value={target}
          onChange={(e) => setTarget(e.target.value)}
        >
          <option value="general">Dictamen completo</option>
          {ruling.hallazgos.map((h, i) => (
            <option key={h.id || i} value={String(i)}>
              Hallazgo {i + 1}
              {h.foto ? ` · foto${h.foto}` : ""}
              {h.titulo ? ` · ${h.titulo}` : ""}
            </option>
          ))}
        </select>
      </label>
      <div
        ref={boxRef}
        className="mt-3 max-h-56 space-y-2 overflow-y-auto rounded-xl bg-[#f7f4ee] p-3 text-sm"
      >
        {turns.length === 0 ? (
          <p className="text-[#6d7c74]">
            Ej.: «En foto2 cita NTC 2050 Art. 250 y pide varilla visible» o
            «Baja la criticidad: es menor, no mayor».
          </p>
        ) : (
          turns.map((t, i) => (
            <p
              key={`${t.role}-${i}`}
              className={
                t.role === "user"
                  ? "rounded-lg bg-white px-2 py-1.5"
                  : "rounded-lg bg-[#e8f6ee] px-2 py-1.5"
              }
            >
              <strong className="text-[11px] uppercase tracking-wide text-[#8a6b2a]">
                {t.role === "user" ? "Usted" : "Ingeniero Héctor"}
              </strong>
              <span className="mt-0.5 block whitespace-pre-wrap leading-5">
                {t.content}
              </span>
            </p>
          ))
        )}
        {loading ? (
          <p className="text-xs text-[#8a6b2a]">Revisando el punto…</p>
        ) : null}
      </div>
      {error ? (
        <p className="mt-2 text-xs text-[#9b2c2c]">{error}</p>
      ) : null}
      <div className="mt-3 flex gap-2">
        <textarea
          className={field}
          rows={2}
          value={input}
          placeholder="Escriba el ajuste…"
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
        />
        <button
          type="button"
          disabled={loading || !input.trim()}
          className="shrink-0 self-end rounded-xl bg-[#0f2a1f] px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
          onClick={() => void send()}
        >
          Enviar
        </button>
      </div>
    </section>
  );
}
