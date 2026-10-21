"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { WorkFold } from "@/components/WorkFold";
import { RulingDocument } from "@/components/informes/RulingDocument";
import { RulingEngineerChat } from "@/components/informes/RulingEngineerChat";
import { loadSpecialistManuals } from "@/lib/specialist-manuals";
import { compressVisitPhoto } from "@/lib/site-visit";
import {
  MAX_RULING_PHOTOS,
  emptyRuling,
  photoLabel,
  reindexPhotoCaptions,
  removeRulingPhoto,
  rulingPhotos,
  withSyncedCover,
  type PhotoRuling,
} from "@/lib/photo-ruling";

export default function DictamenPage() {
  const [ruling, setRuling] = useState<PhotoRuling>(() => emptyRuling());
  const [analyzing, setAnalyzing] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [flash, setFlash] = useState("");
  const [error, setError] = useState("");
  const [offline, setOffline] = useState(false);
  const [retieManualChars, setRetieManualChars] = useState(0);
  const [notesOpen, setNotesOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const photos = rulingPhotos(ruling);

  useEffect(() => {
    setRetieManualChars(
      loadSpecialistManuals().retie?.trim().length ?? 0
    );
  }, []);

  function commit(next: PhotoRuling) {
    setRuling(withSyncedCover(next));
  }

  async function onFile(files: FileList | null) {
    if (!files?.length) return;
    setError("");
    const room = MAX_RULING_PHOTOS - photos.length;
    const extras = await Promise.all(
      [...files].slice(0, room).map(async (file, i) => ({
        id: crypto.randomUUID(),
        caption: photoLabel(photos.length + i),
        dataUrl: await compressVisitPhoto(file),
        notaCampo: "",
      }))
    );
    commit({
      ...ruling,
      photos: reindexPhotoCaptions(
        [...rulingPhotos(ruling), ...extras].slice(0, MAX_RULING_PHOTOS)
      ),
    });
  }

  async function analizar() {
    const shots = rulingPhotos(ruling);
    if (!shots.length) {
      setError("Suba al menos una fotografía.");
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
          photos: shots,
          siteNote: ruling.siteNote,
          inspector: ruling.inspector,
          fieldNotes: ruling.fieldNotes,
          manuals: loadSpecialistManuals(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al analizar");
      setOffline(Boolean(data.offline));
      commit({
        ...ruling,
        resumen: data.resumen || "",
        lecturaPorFoto: data.lecturaPorFoto || [],
        hallazgos: data.hallazgos || [],
        conformidades: data.conformidades || [],
        limites: data.limites || "",
      });
      setFlash(
        data.offline
          ? "Borrador local. Configure OPENAI_API_KEY para leer las fotos en vivo."
          : "Dictamen listo. Edite cualquier punto o déjelo como lo dictó la IA. Use el chat para afinar."
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setAnalyzing(false);
    }
  }

  async function shareLink() {
    const shots = rulingPhotos(ruling);
    if (!shots.length) {
      setError("Suba y analice fotos antes de compartir.");
      return;
    }
    setSharing(true);
    setError("");
    try {
      const payload = withSyncedCover({
        ...ruling,
        id: ruling.id || crypto.randomUUID(),
      });
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
      subtitle="RETIE · NTC 2050 · hasta 12 fotos"
    >
      <p className="os-page-intro mb-4 max-w-3xl text-sm leading-6 text-[#4d5c55] print:hidden">
        Interventoría visual de Genera Solutions. Cada foto se llama foto1,
        foto2… La anotación va junto a esa imagen. Después de analizar puede
        editar cada hallazgo, quitar fotos o dejar el texto de la IA.
      </p>
      <p className="mb-5 print:hidden text-sm text-[#4d5c55]">
        Manual RETIE:{" "}
        {retieManualChars > 0
          ? `${retieManualChars.toLocaleString("es-CO")} caracteres`
          : "sin pegar"}
        {" · "}
        <Link href="/inteligencia" className="font-semibold text-[#1f6b45] underline">
          Inteligencia
        </Link>
        {" · "}
        <Link href="/informes" className="font-semibold text-[#1f6b45] underline">
          Informes
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
          disabled={analyzing || !photos.length}
          onClick={() => void analizar()}
        >
          {analyzing ? "Leyendo las fotos…" : "Analizar como interventor"}
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
        <section className="os-panel rounded-2xl border border-[#ddd6c8] bg-white p-5">
          <h2 className="font-semibold">Evidencia</h2>
          <p className="os-page-intro mt-1 text-xs text-[#6d7c74]">
            {photos.length} de {MAX_RULING_PHOTOS} fotos. Quedan foto1, foto2…
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="text-sm sm:col-span-2">
              <span className="mb-1 block font-medium">
                Ingeniero que realiza la interventoría
              </span>
              <input
                className={field}
                value={ruling.inspector}
                onChange={(e) =>
                  setRuling((p) => ({ ...p, inspector: e.target.value }))
                }
                placeholder="Nombre. En el dictamen sale como Ingeniero…"
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
            multiple
            className="sr-only"
            onChange={(e) => {
              void onFile(e.target.files);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            className="mt-3 inline-flex items-center rounded-xl bg-[#1f6b45] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            disabled={photos.length >= MAX_RULING_PHOTOS}
            onClick={() => fileRef.current?.click()}
          >
            Anexar fotos
          </button>
          {photos.length ? (
            <div className="mt-3 grid grid-cols-2 gap-2">
              {photos.map((p, i) => (
                <div key={p.id} className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.dataUrl}
                    alt=""
                    className="h-28 w-full rounded-xl object-cover"
                  />
                  <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-[#8a6b2a]">
                    foto{i + 1}
                  </p>
                  <button
                    type="button"
                    className="absolute right-1 top-1 rounded-full bg-white/90 px-2 text-xs"
                    onClick={() => commit(removeRulingPhoto(ruling, p.id))}
                  >
                    ×
                  </button>
                  <textarea
                    className="mt-1 w-full rounded-lg border border-[#d8d2c4] px-2 py-1 text-[11px]"
                    rows={2}
                    value={p.notaCampo || ""}
                    placeholder={`Nota de foto${i + 1}`}
                    onChange={(e) =>
                      commit({
                        ...ruling,
                        photos: photos.map((x) =>
                          x.id === p.id
                            ? { ...x, notaCampo: e.target.value }
                            : x
                        ),
                      })
                    }
                  />
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-[#6d7c74]">
              Anexe tablero, tierras, conectores, anclajes, etiquetas y detalles
              de no conformidad.
            </p>
          )}
        </section>
        <div className="space-y-4">
          <section className="os-panel rounded-2xl border border-[#ddd6c8] bg-white p-5">
            <WorkFold
              title="Complemento para ingeniería"
              open={notesOpen}
              onToggle={() => setNotesOpen((v) => !v)}
            >
            <p className="os-page-intro text-xs leading-5 text-[#6d7c74]">
              Solo lo que no cabe en una foto. Lo de cada imagen va en la nota
              de esa foto.
            </p>
            <textarea
              className={`${field} mt-3`}
              rows={4}
              value={ruling.fieldNotes}
              onChange={(e) =>
                setRuling((p) => ({ ...p, fieldNotes: e.target.value }))
              }
              placeholder="Ej.: El dueño reporta disparos del termomagnético al mediodía…"
            />
            </WorkFold>
          </section>
          <RulingEngineerChat ruling={ruling} onRuling={commit} />
        </div>
      </div>

      <div className="os-panel print:hidden mt-8 rounded-2xl border border-[#ddd6c8] bg-white">
        <p className="border-b border-[#eee8dc] px-5 py-3 text-xs font-semibold tracking-wide text-[#8a6b2a] uppercase">
          Dictamen editable · lo que no toque queda como lo dictó la IA
        </p>
        <RulingDocument ruling={ruling} editable onChange={commit} />
      </div>
      <div className="hidden print:block">
        <RulingDocument ruling={ruling} />
      </div>
    </AppShell>
  );
}
