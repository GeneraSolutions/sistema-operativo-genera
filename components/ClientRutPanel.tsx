"use client";

import { useRef, useState } from "react";
import { WorkFold } from "@/components/WorkFold";
import { isPdfFile, renderBillPdf } from "@/lib/bill-pdf";
import {
  MAX_RUT_PHOTOS,
  clientWithholdsFromParty,
  emptyClientParty,
  formatNit,
  withholdingNote,
  type ClientParty,
} from "@/lib/client-party";
import { compressVisitPhoto } from "@/lib/site-visit";

const field =
  "w-full rounded-xl border border-[#d8d2c4] bg-[#fbfaf6] px-3 py-2 text-sm";

export function ClientRutPanel({
  party,
  onChange,
  onApply,
}: {
  party?: ClientParty | null;
  onChange: (next: ClientParty) => void;
  onApply?: (next: ClientParty) => void;
}) {
  const value = party ?? emptyClientParty();
  const [reading, setReading] = useState(false);
  const [error, setError] = useState("");
  const [offline, setOffline] = useState(false);
  const [open, setOpen] = useState(true);
  const fileRef = useRef<HTMLInputElement>(null);

  function patch(partial: Partial<ClientParty>) {
    onChange({ ...value, ...partial });
  }

  async function addFiles(files: FileList | null) {
    if (!files?.length) return;
    const extras: ClientParty["photos"] = [];
    let pdfText = value.pdfText || "";
    try {
      for (const file of [...files]) {
        const room = MAX_RUT_PHOTOS - value.photos.length - extras.length;
        if (room <= 0) break;
        if (isPdfFile(file)) {
          const rendered = await renderBillPdf(file, room);
          extras.push(
            ...rendered.pages.map((page) => ({
              id: crypto.randomUUID(),
              dataUrl: page.dataUrl,
              fileName: page.fileName,
            }))
          );
          if (rendered.text) {
            pdfText = [pdfText, rendered.text].filter(Boolean).join("\n\n");
          }
        } else {
          extras.push({
            id: crypto.randomUUID(),
            dataUrl: await compressVisitPhoto(file),
            fileName: file.name,
          });
        }
      }
      onChange({
        ...value,
        photos: [...value.photos, ...extras].slice(0, MAX_RUT_PHOTOS),
        pdfText,
      });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo abrir el archivo. Pruebe foto o otro PDF."
      );
    }
  }

  async function leer() {
    if (!value.photos.length && !value.pdfText.trim()) {
      setError("Agregue al menos una foto o un PDF del RUT.");
      return;
    }
    setReading(true);
    setError("");
    try {
      const res = await fetch("/api/rut/leer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          photos: value.photos,
          pdfText: value.pdfText,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "No se pudo leer el RUT.");
        return;
      }
      const next = data.party as ClientParty;
      setOffline(Boolean(data.offline));
      onChange(next);
      onApply?.(next);
    } catch {
      setError("No hay conexión para leer el RUT.");
    } finally {
      setReading(false);
    }
  }

  const nitLabel = formatNit(value.nit, value.dv);
  const withholds = clientWithholdsFromParty(value);

  return (
    <WorkFold title="RUT del cliente" open={open} onToggle={() => setOpen((v) => !v)}>
      <p className="os-page-intro text-sm text-[#4d5c55]">
        Foto o PDF del RUT. Completa nombre, NIT, correo, teléfono, dirección y
        si el cliente es agente retenedor.
      </p>
      <input
        ref={fileRef}
        type="file"
        accept="image/*,application/pdf"
        multiple
        className="hidden"
        onChange={(e) => {
          void addFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded-xl bg-[#0f2a1f] px-3 py-2 text-sm font-semibold text-white"
          onClick={() => fileRef.current?.click()}
        >
          Subir RUT
        </button>
        <button
          type="button"
          disabled={reading}
          className="rounded-xl bg-[#1f6b45] px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
          onClick={() => void leer()}
        >
          {reading ? "Leyendo…" : "Leer RUT"}
        </button>
        {value.legalName ? (
          <button
            type="button"
            className="rounded-xl border border-[#1f6b45] px-3 py-2 text-sm font-semibold text-[#1f6b45]"
            onClick={() => onApply?.(value)}
          >
            Usar en la cotización
          </button>
        ) : null}
      </div>
      {error ? <p className="mt-2 text-sm text-[#9b2c2c]">{error}</p> : null}
      {offline ? (
        <p className="mt-2 text-xs text-[#6b6458]">
          Lectura en modo demo. Complete los campos a mano.
        </p>
      ) : null}
      {value.photos.length ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {value.photos.map((p) => (
            <div
              key={p.id}
              className="relative h-16 w-12 overflow-hidden rounded-lg border border-[#d8d2c4]"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.dataUrl}
                alt={p.fileName || "RUT"}
                className="h-full w-full object-cover"
              />
              <button
                type="button"
                className="absolute right-0 top-0 bg-black/60 px-1 text-[10px] text-white"
                onClick={() =>
                  patch({ photos: value.photos.filter((x) => x.id !== p.id) })
                }
              >
                ×
              </button>
            </div>
          ))}
        </div>
      ) : null}

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block text-sm sm:col-span-2">
          <span className="mb-1 block font-medium">Razón social / nombre</span>
          <input
            className={field}
            value={value.legalName}
            onChange={(e) => patch({ legalName: e.target.value })}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">NIT</span>
          <input
            className={field}
            value={value.nit}
            onChange={(e) => patch({ nit: e.target.value })}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">DV</span>
          <input
            className={field}
            value={value.dv}
            maxLength={1}
            onChange={(e) => patch({ dv: e.target.value })}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Correo</span>
          <input
            className={field}
            type="email"
            value={value.email}
            onChange={(e) => patch({ email: e.target.value })}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Teléfono</span>
          <input
            className={field}
            value={value.phone}
            onChange={(e) => patch({ phone: e.target.value })}
          />
        </label>
        <label className="block text-sm sm:col-span-2">
          <span className="mb-1 block font-medium">Dirección</span>
          <input
            className={field}
            value={value.address}
            onChange={(e) => patch({ address: e.target.value })}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Ciudad</span>
          <input
            className={field}
            value={value.city}
            onChange={(e) => patch({ city: e.target.value })}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Departamento</span>
          <input
            className={field}
            value={value.department}
            onChange={(e) => patch({ department: e.target.value })}
          />
        </label>
      </div>

      <div className="mt-3 grid gap-2 text-sm">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={value.agenteRetenedorFuente}
            onChange={(e) => patch({ agenteRetenedorFuente: e.target.checked })}
          />
          Agente retenedor en la fuente (ReteFuente)
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={value.agenteRetenedorIca}
            onChange={(e) => patch({ agenteRetenedorIca: e.target.checked })}
          />
          Agente retenedor ICA
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={value.granContribuyente}
            onChange={(e) => patch({ granContribuyente: e.target.checked })}
          />
          Gran contribuyente (ReteIVA)
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={value.autorretenedor}
            onChange={(e) => patch({ autorretenedor: e.target.checked })}
          />
          Autorretenedor
        </label>
      </div>

      {nitLabel || value.legalName ? (
        <p className="mt-3 rounded-xl bg-[#f4f1ea] px-3 py-2 text-xs leading-5 text-[#4d5c55]">
          {nitLabel ? `NIT ${nitLabel}. ` : ""}
          {withholds || value.granContribuyente
            ? withholdingNote(value)
            : "No figura como agente retenedor."}
          {value.responsabilidadesTexto
            ? ` Responsabilidades: ${value.responsabilidadesTexto}.`
            : ""}
        </p>
      ) : null}
    </WorkFold>
  );
}
