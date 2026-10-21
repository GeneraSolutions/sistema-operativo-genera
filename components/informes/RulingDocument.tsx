"use client";

import { BrandLogo } from "@/components/BrandLogo";
import {
  SEVERITY_LABELS,
  emptyFinding,
  inspectorDisplayName,
  removeRulingPhoto,
  rulingPhotos,
  type FindingSeverity,
  type PhotoFinding,
  type PhotoRuling,
} from "@/lib/photo-ruling";
import { NORMS, SEVERITIES } from "@/lib/ruling-refine";

const TONE: Record<FindingSeverity, string> = {
  critica: "border-[#9b2c2c] bg-[#fde8e8]",
  mayor: "border-[#b45309] bg-[#fff4e5]",
  menor: "border-[#8a6b2a] bg-[#f7f4ee]",
  observacion: "border-[#2a5f8f] bg-[#eef4fa]",
  conforme: "border-[#1f6b45] bg-[#e8f6ee]",
};

const field =
  "w-full rounded-lg border border-[#d8d2c4] bg-white px-2.5 py-1.5 text-sm";

function FindingCard({
  h,
  photoCount,
  editable,
  onChange,
  onRemove,
}: {
  h: PhotoFinding;
  photoCount: number;
  editable?: boolean;
  onChange?: (next: PhotoFinding) => void;
  onRemove?: () => void;
}) {
  if (!editable || !onChange) {
    return (
      <div
        className={`rounded-2xl border px-3 py-2.5 text-sm ${TONE[h.criticidad] || TONE.observacion}`}
      >
        <p className="font-semibold">
          {SEVERITY_LABELS[h.criticidad] || h.criticidad} · {h.titulo}
        </p>
        {h.hechos ? <p className="mt-1 leading-6">{h.hechos}</p> : null}
        {h.norma || h.articulo ? (
          <p className="mt-2 text-xs">
            <strong>{h.norma}</strong>
            {h.articulo ? ` · ${h.articulo}` : ""}
          </p>
        ) : null}
        {h.fundamento ? <p className="mt-1 leading-6">{h.fundamento}</p> : null}
        {h.accion ? (
          <p className="mt-1 leading-6">
            <strong>Corrección:</strong> {h.accion}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div
      className={`space-y-2 rounded-2xl border px-3 py-2.5 text-sm ${TONE[h.criticidad] || TONE.observacion}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <select
          className="rounded-lg border border-[#d8d2c4] bg-white px-2 py-1 text-xs font-semibold"
          value={h.criticidad}
          onChange={(e) =>
            onChange({ ...h, criticidad: e.target.value as FindingSeverity })
          }
        >
          {SEVERITIES.map((s) => (
            <option key={s} value={s}>
              {SEVERITY_LABELS[s]}
            </option>
          ))}
        </select>
        <select
          className="rounded-lg border border-[#d8d2c4] bg-white px-2 py-1 text-xs"
          value={h.foto ?? ""}
          onChange={(e) =>
            onChange({
              ...h,
              foto: e.target.value ? Number(e.target.value) : undefined,
            })
          }
        >
          <option value="">Sin foto</option>
          {Array.from({ length: photoCount }, (_, i) => (
            <option key={i + 1} value={i + 1}>
              foto{i + 1}
            </option>
          ))}
        </select>
        {onRemove ? (
          <button
            type="button"
            className="text-xs font-semibold text-[#9b2c2c] underline"
            onClick={onRemove}
          >
            Quitar hallazgo
          </button>
        ) : null}
      </div>
      <input
        className={field}
        value={h.titulo}
        placeholder="Título del hallazgo"
        onChange={(e) => onChange({ ...h, titulo: e.target.value })}
      />
      <textarea
        className={field}
        rows={3}
        value={h.hechos}
        placeholder="Hechos (lo que se ve o lo declarado en esta foto)"
        onChange={(e) => onChange({ ...h, hechos: e.target.value })}
      />
      <div className="grid gap-2 sm:grid-cols-2">
        <select
          className={field}
          value={NORMS.some((n) => n === h.norma) ? h.norma : "otro"}
          onChange={(e) => onChange({ ...h, norma: e.target.value })}
        >
          {NORMS.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
        <input
          className={field}
          value={h.articulo}
          placeholder="Artículo / numeral"
          onChange={(e) => onChange({ ...h, articulo: e.target.value })}
        />
      </div>
      <textarea
        className={field}
        rows={2}
        value={h.fundamento}
        placeholder="Fundamento"
        onChange={(e) => onChange({ ...h, fundamento: e.target.value })}
      />
      <textarea
        className={field}
        rows={2}
        value={h.accion}
        placeholder="Corrección"
        onChange={(e) => onChange({ ...h, accion: e.target.value })}
      />
    </div>
  );
}

export function RulingDocument({
  ruling,
  editable,
  onChange,
}: {
  ruling: PhotoRuling;
  editable?: boolean;
  onChange?: (next: PhotoRuling) => void;
}) {
  const photos = rulingPhotos(ruling);
  const leftover = ruling.hallazgos.filter((h) => {
    const n = Number(h.foto);
    return !n || !photos[n - 1];
  });

  function patch(next: Partial<PhotoRuling>) {
    onChange?.({ ...ruling, ...next });
  }

  function patchFinding(match: PhotoFinding, next: PhotoFinding) {
    patch({
      hallazgos: ruling.hallazgos.map((h) => {
        if (match.id && h.id === match.id) return next;
        return h === match ? next : h;
      }),
    });
  }

  function dropFinding(match: PhotoFinding) {
    patch({
      hallazgos: ruling.hallazgos.filter((h) =>
        match.id ? h.id !== match.id : h !== match
      ),
    });
  }

  return (
    <article className="mx-auto max-w-3xl bg-white px-6 py-8 text-[#12241c]">
      <header className="flex items-start justify-between gap-4 border-b border-[#eee8dc] pb-4">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.22em] text-[#8a6b2a] uppercase">
            Genera Solutions SAS · Dictamen fotográfico
          </p>
          <h1 className="mt-1 text-2xl font-semibold">
            Interventoría RETIE / NTC 2050
          </h1>
          <p className="mt-1 text-sm text-[#4d5c55]">
            {inspectorDisplayName(ruling.inspector)} ·{" "}
            {new Date(ruling.createdAt).toLocaleDateString("es-CO")} ·{" "}
            {photos.length} foto{photos.length === 1 ? "" : "s"}
          </p>
        </div>
        <BrandLogo height={48} />
      </header>

      {ruling.siteNote ? (
        <p className="mt-4 text-sm">
          <strong>Sitio / contexto:</strong> {ruling.siteNote}
        </p>
      ) : null}

      {ruling.resumen || editable ? (
        <section className="mt-6">
          <h2 className="text-sm font-semibold tracking-wide text-[#1f6b45] uppercase">
            Síntesis de interventoría
          </h2>
          {editable ? (
            <textarea
              className={`${field} mt-2`}
              rows={5}
              value={ruling.resumen}
              placeholder="Puede dejar el texto de la IA o reescribirlo."
              onChange={(e) => patch({ resumen: e.target.value })}
            />
          ) : (
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6">
              {ruling.resumen}
            </p>
          )}
        </section>
      ) : null}

      {photos.length ? (
        <section className="mt-8 space-y-8">
          <h2 className="text-sm font-semibold tracking-wide text-[#1f6b45] uppercase">
            Evidencia, hallazgos y no conformidades
          </h2>
          {photos.map((p, i) => {
            const n = i + 1;
            const lectura = ruling.lecturaPorFoto?.find(
              (row) => Number(row.indice) === n
            );
            const items = ruling.hallazgos.filter((h) => Number(h.foto) === n);
            return (
              <div
                key={p.id}
                className="break-inside-avoid rounded-2xl border border-[#eee8dc] p-3"
              >
                <div className="mb-3 flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold tracking-wide text-[#8a6b2a] uppercase">
                    foto{n}
                  </p>
                  {editable ? (
                    <button
                      type="button"
                      className="text-xs font-semibold text-[#9b2c2c] underline"
                      onClick={() => onChange?.(removeRulingPhoto(ruling, p.id))}
                    >
                      Quitar foto
                    </button>
                  ) : null}
                </div>
                <div className="grid gap-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
                  <figure>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={p.dataUrl}
                      alt={`foto${n}`}
                      className="max-h-72 w-full rounded-xl object-contain bg-[#f7f4ee]"
                    />
                    {p.notaCampo || editable ? (
                      <figcaption className="mt-2">
                        {editable ? (
                          <textarea
                            className={field}
                            rows={2}
                            value={p.notaCampo || ""}
                            placeholder={`Anotación de foto${n} (va junto a esta imagen)`}
                            onChange={(e) =>
                              onChange?.({
                                ...ruling,
                                photos: photos.map((x) =>
                                  x.id === p.id
                                    ? { ...x, notaCampo: e.target.value }
                                    : x
                                ),
                              })
                            }
                          />
                        ) : (
                          <p className="text-xs leading-5 text-[#4d5c55]">
                            {p.notaCampo}
                          </p>
                        )}
                      </figcaption>
                    ) : null}
                  </figure>
                  <div className="space-y-2">
                    {editable ? (
                      <label className="block text-sm">
                        <span className="mb-1 block font-medium">Lectura</span>
                        <textarea
                          className={field}
                          rows={4}
                          value={lectura?.descripcion || ""}
                          placeholder="Deje la lectura de la IA o edítela."
                          onChange={(e) => {
                            const rest = (ruling.lecturaPorFoto || []).filter(
                              (row) => Number(row.indice) !== n
                            );
                            patch({
                              lecturaPorFoto: [
                                ...rest,
                                { indice: n, descripcion: e.target.value },
                              ].sort(
                                (a, b) => Number(a.indice) - Number(b.indice)
                              ),
                            });
                          }}
                        />
                      </label>
                    ) : lectura?.descripcion ? (
                      <p className="whitespace-pre-wrap text-sm leading-6">
                        <strong>Lectura. </strong>
                        {lectura.descripcion}
                      </p>
                    ) : null}
                    {items.length ? (
                      items.map((h, hi) => (
                        <FindingCard
                          key={h.id || `${h.titulo}-${hi}`}
                          h={h}
                          photoCount={photos.length}
                          editable={editable}
                          onChange={(next) => patchFinding(h, next)}
                          onRemove={() => dropFinding(h)}
                        />
                      ))
                    ) : (
                      <p className="text-sm text-[#6d7c74]">
                        {ruling.resumen
                          ? "Sin no conformidad asignada a esta foto."
                          : "Analice como interventor para ver hallazgos junto a cada imagen."}
                      </p>
                    )}
                    {editable ? (
                      <button
                        type="button"
                        className="text-xs font-semibold text-[#1f6b45] underline"
                        onClick={() =>
                          patch({
                            hallazgos: [
                              ...ruling.hallazgos,
                              emptyFinding(n),
                            ],
                          })
                        }
                      >
                        Añadir hallazgo a foto{n}
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </section>
      ) : null}

      {leftover.length ? (
        <section className="mt-6 space-y-3">
          <h2 className="text-sm font-semibold tracking-wide text-[#1f6b45] uppercase">
            Hallazgos sin foto asignada
          </h2>
          {leftover.map((h, i) => (
            <FindingCard
              key={h.id || `${h.titulo}-x-${i}`}
              h={h}
              photoCount={photos.length}
              editable={editable}
              onChange={(next) => patchFinding(h, next)}
              onRemove={() => dropFinding(h)}
            />
          ))}
        </section>
      ) : null}

      {ruling.conformidades.length || editable ? (
        <section className="mt-6">
          <h2 className="text-sm font-semibold tracking-wide text-[#1f6b45] uppercase">
            Lo que se ve conforme
          </h2>
          {editable ? (
            <ul className="mt-2 space-y-2">
              {ruling.conformidades.map((c, i) => (
                <li key={`conf-${i}`} className="flex gap-2">
                  <textarea
                    className={field}
                    rows={2}
                    value={c}
                    onChange={(e) =>
                      patch({
                        conformidades: ruling.conformidades.map((x, j) =>
                          j === i ? e.target.value : x
                        ),
                      })
                    }
                  />
                  <button
                    type="button"
                    className="shrink-0 text-xs text-[#9b2c2c] underline"
                    onClick={() =>
                      patch({
                        conformidades: ruling.conformidades.filter(
                          (_, j) => j !== i
                        ),
                      })
                    }
                  >
                    Quitar
                  </button>
                </li>
              ))}
              <li>
                <button
                  type="button"
                  className="text-xs font-semibold text-[#1f6b45] underline"
                  onClick={() =>
                    patch({
                      conformidades: [...ruling.conformidades, ""],
                    })
                  }
                >
                  Añadir conformidad
                </button>
              </li>
            </ul>
          ) : (
            <ul className="mt-2 list-disc pl-5 text-sm leading-6">
              {ruling.conformidades.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {ruling.limites || editable ? (
        <section className="mt-6">
          <h2 className="text-sm font-semibold tracking-wide text-[#1f6b45] uppercase">
            Límites de la evidencia
          </h2>
          {editable ? (
            <textarea
              className={`${field} mt-2`}
              rows={4}
              value={ruling.limites}
              placeholder="Qué no se puede afirmar con estas fotos."
              onChange={(e) => patch({ limites: e.target.value })}
            />
          ) : (
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6">
              {ruling.limites}
            </p>
          )}
        </section>
      ) : null}

      <footer className="mt-10 border-t border-[#eee8dc] pt-4 text-xs leading-5 text-[#6d7c74]">
        Memoria de interventoría Genera Solutions (RETIE / NTC 2050 y normas
        conexas). No reemplaza el dictamen de un organismo de inspección
        acreditado ONAC ni la firma del ingeniero competente. Verificar
        numerales en la edición vigente.
      </footer>
    </article>
  );
}
