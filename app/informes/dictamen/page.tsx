"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { RulingDocument } from "@/components/informes/RulingDocument";
import { compressVisitPhoto } from "@/lib/site-visit";
import { emptyRuling, type PhotoRuling } from "@/lib/photo-ruling";

export default function DictamenPage() {
  const [ruling, setRuling] = useState<PhotoRuling>(() => emptyRuling());
  const [analyzing, setAnalyzing] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [flash, setFlash] = useState("");
  const [error, setError] = useState("");
  const [offline, setOffline] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function onFile(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setError("");
    const dataUrl = await compressVisitPhoto(file);
    setRuling((prev) => ({
      ...emptyRuling(),
      inspector: prev.inspector,
      siteNote: prev.siteNote,
      imageDataUrl: dataUrl,
      imageCaption: file.name.replace(/\.[^.]+$/, ""),
    }));
  }

  async function analizar() {
    if (!ruling.imageDataUrl) {
      setError("Suba una fotografía primero.");
      return;
    }
    setAnalyzing(true);
    setError("");
    setFlash("");
    try {
      const res = await fetch("/api/informes/dictamen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageDataUrl: ruling.imageDataUrl,
          caption: ruling.imageCaption,
          siteNote: ruling.siteNote,
          inspector: ruling.inspector,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al analizar");
      setOffline(Boolean(data.offline));
      setRuling((prev) => ({
        ...prev,
        resumen: data.resumen || "",
        hallazgos: data.hallazgos || [],
        conformidades: data.conformidades || [],
        limites: data.limites || "",
      }));
      setFlash(
        data.offline
          ? "Borrador local. Configure OPENAI_API_KEY para leer la foto en vivo."
          : "Dictamen listo. Revise citas y criticidad antes de compartir."
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setAnalyzing(false);
    }
  }

  async function shareLink() {
    if (!ruling.imageDataUrl) {
      setError("Suba y analice una foto antes de compartir.");
      return;
    }
    setSharing(true);
    setError("");
    try {
      const payload = { ...ruling, id: ruling.id || crypto.randomUUID() };
      setRuling(payload);
      const res = await fetch("/api/dictamenes/publicar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "No se pudo publicar el enlace.");
      }
      const url = `${window.location.origin}/dictamen/${payload.id}`;
      await navigator.clipboard?.writeText(url);
      setFlash("Enlace copiado · abriendo vista limpia…");
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al compartir");
    } finally {
      setSharing(false);
    }
  }

  const field =
    "w-full rounded-xl border border-[#d8d2c4] bg-[#fbfaf6] px-3 py-2.5 text-sm";

  return (
    <AppShell
      title="Dictamen fotográfico"
      subtitle="RETIE · NTC 2050 · una foto"
    >
      <p className="mb-4 max-w-3xl text-sm leading-6 text-[#4d5c55] print:hidden">
        Herramienta aparte de los cuatro informes. Suba una foto de tablero,
        cubierta, tierras o arreglo: el inspector virtual propone no
        conformidades con cita a RETIE, NTC 2050 y, si aplica, NSR-10, RETILAP
        o SST. El ingeniero revisa; no reemplaza ONAC.
      </p>
      <p className="mb-5 print:hidden">
        <Link href="/informes" className="text-sm font-semibold text-[#1f6b45] underline">
          Volver a informes
        </Link>
      </p>

      {flash ? (
        <p className="mb-3 rounded-xl bg-[#e8f6ee] px-4 py-2 text-sm text-[#1f6b45] print:hidden">
          {flash}
        </p>
      ) : null}
      {error ? (
        <p className="mb-3 rounded-xl bg-[#fde8e8] px-4 py-2 text-sm text-[#9b2c2c] print:hidden">
          {error}
        </p>
      ) : null}
      {offline ? (
        <p className="mb-3 text-xs text-[#8a6b2a] print:hidden">
          Modo demo sin clave de inteligencia.
        </p>
      ) : null}

      <div className="print:hidden mb-4 flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded-xl bg-[#d4b46a] px-4 py-2.5 text-sm font-semibold text-[#12241c] disabled:opacity-50"
          disabled={analyzing || !ruling.imageDataUrl}
          onClick={() => void analizar()}
        >
          {analyzing ? "Leyendo la foto…" : "Analizar no conformidad"}
        </button>
        <button
          type="button"
          className="rounded-xl border border-[#1f6b45] px-4 py-2.5 text-sm font-semibold text-[#1f6b45] disabled:opacity-50"
          disabled={sharing || !ruling.resumen}
          onClick={() => void shareLink()}
        >
          {sharing ? "Publicando…" : "Compartir enlace"}
        </button>
        <button
          type="button"
          className="rounded-xl border border-[#d8d2c4] bg-white px-4 py-2.5 text-sm font-semibold"
          onClick={() => window.print()}
        >
          Imprimir / PDF
        </button>
      </div>

      <div className="print:hidden grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-[#ddd6c8] bg-white p-5">
          <h2 className="font-semibold">Evidencia</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="text-sm">
              <span className="mb-1 block font-medium">Inspector</span>
              <input
                className={field}
                value={ruling.inspector}
                onChange={(e) =>
                  setRuling((p) => ({ ...p, inspector: e.target.value }))
                }
              />
            </label>
            <label className="text-sm sm:col-span-2">
              <span className="mb-1 block font-medium">Sitio / contexto</span>
              <input
                className={field}
                value={ruling.siteNote}
                onChange={(e) =>
                  setRuling((p) => ({ ...p, siteNote: e.target.value }))
                }
                placeholder="Tablero AC cubierta bodega, Medellín…"
              />
            </label>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="mt-3 text-sm"
            onChange={(e) => void onFile(e.target.files)}
          />
          <label className="mt-3 block text-sm">
            <span className="mb-1 block font-medium">Pie de foto</span>
            <input
              className={field}
              value={ruling.imageCaption}
              onChange={(e) =>
                setRuling((p) => ({ ...p, imageCaption: e.target.value }))
              }
            />
          </label>
          {ruling.imageDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={ruling.imageDataUrl}
              alt=""
              className="mt-3 max-h-72 w-full rounded-2xl object-contain bg-[#f7f4ee]"
            />
          ) : (
            <p className="mt-3 text-sm text-[#6d7c74]">
              Tome o suba una foto nítida: tablero abierto, tierra, conector,
              anclaje o etiqueta.
            </p>
          )}
        </section>
        <section className="rounded-2xl border border-[#ddd6c8] bg-white p-5 text-sm leading-6 text-[#4d5c55]">
          <h2 className="font-semibold text-[#12241c]">Qué mira el modelo</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>RETIE: identificaciones, protecciones, tierras, canalización.</li>
            <li>NTC 2050: tableros, conductores, empalmes, Art. 110 / 250.</li>
            <li>NSR-10 si hay estructura o cubierta.</li>
            <li>RETILAP solo alumbrado; Resolución 5018 / SST si hay riesgo.</li>
            <li>CREG si se ve frontera o medición de autogeneración.</li>
          </ul>
          <p className="mt-3">
            Si la foto no muestra un dato, el dictamen lo deja en límites. Usted
            corrige el texto igual que un capítulo de informe.
          </p>
        </section>
      </div>

      <div className="print:hidden mt-8 rounded-2xl border border-[#ddd6c8] bg-white">
        <p className="border-b border-[#eee8dc] px-5 py-3 text-xs font-semibold tracking-wide text-[#8a6b2a] uppercase">
          Vista previa
        </p>
        <RulingDocument ruling={ruling} />
      </div>
      <div className="hidden print:block">
        <RulingDocument ruling={ruling} />
      </div>
    </AppShell>
  );
}
