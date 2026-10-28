"use client";

import { DocSection, DocSheet, formatDocDate } from "@/components/informes/DocSheet";
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
      <article className="gen-doc-finding" data-tone={h.criticidad || "observacion"}>
        <header>
          <span className="gen-doc-mark">
            {SEVERITY_LABELS[h.criticidad] || h.criticidad}
          </span>
          <strong>{h.titulo}</strong>
        </header>
        {h.hechos ? <p>{h.hechos}</p> : null}
        {h.norma || h.articulo ? (
          <p className="gen-doc-cite">
            {h.norma}
            {h.articulo ? ` · ${h.articulo}` : ""}
          </p>
        ) : null}
        {h.fundamento ? <p>{h.fundamento}</p> : null}
        {h.accion ? (
          <p>
            <strong>Corrección. </strong>
            {h.accion}
          </p>
        ) : null}
      </article>
    );
  }

  return (
    <div className="gen-doc-finding gen-doc-edit" data-tone={h.criticidad || "observacion"}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <select
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
              Foto {i + 1}
            </option>
          ))}
        </select>
        {onRemove ? (
          <button type="button" className="gen-doc-link" data-tone="bad" onClick={onRemove}>
            Quitar hallazgo
          </button>
        ) : null}
      </div>
      <input
        value={h.titulo}
        placeholder="Título del hallazgo"
        onChange={(e) => onChange({ ...h, titulo: e.target.value })}
      />
      <textarea
        rows={3}
        value={h.hechos}
        placeholder="Hechos (lo que se ve o lo declarado en esta foto)"
        onChange={(e) => onChange({ ...h, hechos: e.target.value })}
      />
      <div className="grid gap-2 sm:grid-cols-2">
        <select
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
          value={h.articulo}
          placeholder="Artículo / numeral"
          onChange={(e) => onChange({ ...h, articulo: e.target.value })}
        />
      </div>
      <textarea
        rows={2}
        value={h.fundamento}
        placeholder="Fundamento"
        onChange={(e) => onChange({ ...h, fundamento: e.target.value })}
      />
      <textarea
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

  const photoLabel =
    photos.length === 1 ? "1 foto" : `${photos.length} fotos`;

  return (
    <DocSheet
      kicker="Genera Solutions SAS · Dictamen fotográfico"
      title="Interventoría RETIE / NTC 2050"
      meta={[inspectorDisplayName(ruling.inspector), photoLabel]
        .filter(Boolean)
        .join(" · ")}
      facts={[
        { label: "Inspector", value: inspectorDisplayName(ruling.inspector) },
        { label: "Fecha", value: formatDocDate(ruling.createdAt) },
        { label: "Evidencia", value: photoLabel },
        {
          label: "Sitio",
          value: ruling.siteNote.length > 90 ? "" : ruling.siteNote,
        },
      ]}
      legal={
        <>
          Memoria de interventoría Genera Solutions SAS (RETIE / NTC 2050 y normas
          conexas). No reemplaza el dictamen de un organismo de inspección
          acreditado ONAC ni la firma del ingeniero competente. Verificar
          numerales en la edición vigente.
        </>
      }
    >
      {ruling.siteNote.length > 90 ? (
        <DocSection title="Sitio / contexto">
          <p className="gen-doc-prose">{ruling.siteNote}</p>
        </DocSection>
      ) : null}

      {ruling.resumen || editable ? (
        <DocSection title="Síntesis de interventoría">
          {editable ? (
            <textarea
              className="gen-doc-field mt-2"
              rows={5}
              value={ruling.resumen}
              placeholder="Puede dejar el texto de la IA o reescribirlo."
              onChange={(e) => patch({ resumen: e.target.value })}
            />
          ) : (
            <p className="gen-doc-prose">{ruling.resumen}</p>
          )}
        </DocSection>
      ) : null}

      {photos.length ? (
        <DocSection title="Evidencia, hallazgos y no conformidades">
          <div className="gen-doc-stack">
            {photos.map((p, i) => {
              const n = i + 1;
              const lectura = ruling.lecturaPorFoto?.find(
                (row) => Number(row.indice) === n
              );
              const items = ruling.hallazgos.filter((h) => Number(h.foto) === n);
              return (
                <article key={p.id} className="gen-doc-photo">
                  <header>
                    <p>Foto {n}</p>
                    {editable ? (
                      <button
                        type="button"
                        className="gen-doc-link"
                        data-tone="bad"
                        onClick={() => onChange?.(removeRulingPhoto(ruling, p.id))}
                      >
                        Quitar foto
                      </button>
                    ) : null}
                  </header>
                  <div className="gen-doc-photo-grid">
                    <figure>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.dataUrl} alt={`Foto ${n}`} />
                      {p.notaCampo || editable ? (
                        <figcaption>
                          {editable ? (
                            <textarea
                              className="gen-doc-field"
                              rows={2}
                              value={p.notaCampo || ""}
                              placeholder={`Anotación de Foto ${n} (va junto a esta imagen)`}
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
                            p.notaCampo
                          )}
                        </figcaption>
                      ) : null}
                    </figure>
                    <div className="gen-doc-stack">
                      {editable ? (
                        <label className="gen-doc-edit">
                          <span className="text-sm font-medium">Lectura</span>
                          <textarea
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
                        <p className="gen-doc-prose">
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
                        <p className="gen-doc-hint">
                          {ruling.resumen
                            ? "Sin no conformidad asignada a esta foto."
                            : "Analice como interventor para ver hallazgos junto a cada imagen."}
                        </p>
                      )}
                      {editable ? (
                        <button
                          type="button"
                          className="gen-doc-link"
                          onClick={() =>
                            patch({
                              hallazgos: [...ruling.hallazgos, emptyFinding(n)],
                            })
                          }
                        >
                          Añadir hallazgo a Foto {n}
                        </button>
                      ) : null}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </DocSection>
      ) : null}

      {leftover.length ? (
        <DocSection title="Hallazgos sin foto asignada">
          <div className="gen-doc-stack">
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
          </div>
        </DocSection>
      ) : null}

      {ruling.conformidades.length || editable ? (
        <DocSection title="Lo que se ve conforme">
          {editable ? (
            <div className="gen-doc-stack">
              {ruling.conformidades.map((c, i) => (
                <div key={`conf-${i}`} className="flex items-start gap-2">
                  <textarea
                    className="gen-doc-field"
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
                    className="gen-doc-link shrink-0"
                    data-tone="bad"
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
                </div>
              ))}
              <button
                type="button"
                className="gen-doc-link"
                onClick={() =>
                  patch({ conformidades: [...ruling.conformidades, ""] })
                }
              >
                Añadir conformidad
              </button>
            </div>
          ) : (
            <ul className="gen-doc-list">
              {ruling.conformidades.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          )}
        </DocSection>
      ) : null}

      {ruling.limites || editable ? (
        <DocSection title="Límites de la evidencia">
          {editable ? (
            <textarea
              className="gen-doc-field mt-2"
              rows={4}
              value={ruling.limites}
              placeholder="Qué no se puede afirmar con estas fotos."
              onChange={(e) => patch({ limites: e.target.value })}
            />
          ) : (
            <p className="gen-doc-prose">{ruling.limites}</p>
          )}
        </DocSection>
      ) : null}
    </DocSheet>
  );
}
