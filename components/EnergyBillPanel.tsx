"use client";

import { useRef, useState } from "react";
import {
  MAX_BILL_PHOTOS,
  consumptionForQuote,
  emptyEnergyBill,
  suggestedKwpFromBill,
  tariffForQuote,
  type EnergyBill,
} from "@/lib/energy-bill";
import { isPdfFile, renderBillPdf } from "@/lib/bill-pdf";
import { compressVisitPhoto } from "@/lib/site-visit";
import { WorkFold } from "@/components/WorkFold";

const field =
  "w-full rounded-xl border border-[#d8d2c4] bg-[#fbfaf6] px-3 py-2 text-sm";

export function EnergyBillPanel({
  bill,
  onChange,
  onApply,
  peakSunHours,
  applyLabel = "Usar en la cotización",
}: {
  bill?: EnergyBill | null;
  onChange: (next: EnergyBill) => void;
  onApply?: (next: EnergyBill) => void;
  peakSunHours?: number;
  applyLabel?: string;
}) {
  const value = bill ?? emptyEnergyBill();
  const [reading, setReading] = useState(false);
  const [error, setError] = useState("");
  const [offline, setOffline] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [fieldsOpen, setFieldsOpen] = useState(false);
  const kwh = consumptionForQuote(value);
  const tariff = tariffForQuote(value);
  const suggested =
    peakSunHours && kwh ? suggestedKwpFromBill(value, peakSunHours) : 0;

  function patch(partial: Partial<EnergyBill>) {
    onChange({ ...value, ...partial });
  }

  async function addPhotos(files: FileList | null) {
    if (!files?.length) return;
    const extras: EnergyBill["photos"] = [];
    let pdfText = value.pdfText || "";
    try {
      for (const file of [...files]) {
        const room = MAX_BILL_PHOTOS - value.photos.length - extras.length;
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
        photos: [...value.photos, ...extras].slice(0, MAX_BILL_PHOTOS),
        pdfText,
      });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo abrir el PDF. Pruebe foto o otro archivo."
      );
    }
  }

  async function leer() {
    if (!value.photos.length) {
      setError("Agregue al menos una foto o un PDF del recibo.");
      return;
    }
    setReading(true);
    setError("");
    try {
      const res = await fetch("/api/recibos/leer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          photos: value.photos,
          pdfText: value.pdfText,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo leer el recibo");
      setOffline(Boolean(data.offline));
      onChange({
        ...value,
        ...data.bill,
        photos: value.photos,
        pdfText: value.pdfText,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al leer");
    } finally {
      setReading(false);
    }
  }

  return (
    <div className="space-y-3">
      <p className="os-page-intro text-xs leading-5 text-[#6d7c74]">
        Suba foto o PDF del recibo (frente, reverso e histórico). La lectura
        extrae transformador, circuito, kWh, $/kWh y si hay reactiva. Revise
        los números antes de cotizar.
      </p>
      <input
        ref={fileRef}
        type="file"
        accept="image/*,application/pdf"
        multiple
        className="sr-only"
        onChange={(e) => {
          void addPhotos(e.target.files);
          e.target.value = "";
        }}
      />
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={value.photos.length >= MAX_BILL_PHOTOS}
          className="rounded-xl bg-[#1f6b45] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          onClick={() => fileRef.current?.click()}
        >
          Agregar foto o PDF
        </button>
        <button
          type="button"
          disabled={reading || !value.photos.length}
          className="rounded-xl bg-[#d4b46a] px-4 py-2.5 text-sm font-semibold text-[#12241c] disabled:opacity-50"
          onClick={() => void leer()}
        >
          {reading ? "Leyendo el recibo…" : "Leer recibo"}
        </button>
        {onApply && (kwh > 0 || tariff > 0) ? (
          <button
            type="button"
            className="rounded-xl border border-[#1f6b45] px-4 py-2.5 text-sm font-semibold text-[#1f6b45]"
            onClick={() => onApply(value)}
          >
            {applyLabel}
          </button>
        ) : null}
      </div>
      {error ? (
        <p className="text-sm text-[#9b2c2c]">{error}</p>
      ) : null}
      {offline ? (
        <p className="text-xs text-[#8a6b2a]">
          Sin clave de visión: complete los campos a mano.
        </p>
      ) : null}

      {value.photos.length ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {value.photos.map((p) => (
            <div key={p.id} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.dataUrl}
                alt={p.fileName || ""}
                className="h-24 w-full rounded-xl object-cover bg-[#f7f4ee]"
              />
              {p.fileName ? (
                <p className="mt-0.5 truncate text-[10px] text-[#6d7c74]">
                  {p.fileName}
                </p>
              ) : null}
              <button
                type="button"
                className="absolute right-1 top-1 rounded-full bg-white/90 px-2 text-xs"
                onClick={() =>
                  patch({
                    photos: value.photos.filter((x) => x.id !== p.id),
                  })
                }
              >
                ×
              </button>
            </div>
          ))}
        </div>
      ) : null}

      {kwh || tariff ? (
        <div className="grid gap-2 rounded-2xl border border-[#1f6b45]/30 bg-[#e8f6ee] px-3 py-3 text-sm sm:grid-cols-3">
          <p>
            <span className="block text-[11px] uppercase tracking-wide text-[#4d5c55]">
              Consumo a cotizar
            </span>
            <strong>{kwh.toLocaleString("es-CO")} kWh/mes</strong>
          </p>
          <p>
            <span className="block text-[11px] uppercase tracking-wide text-[#4d5c55]">
              Tarifa efectiva
            </span>
            <strong>
              ${tariff.toLocaleString("es-CO")}
              /kWh
            </strong>
          </p>
          {suggested ? (
            <p>
              <span className="block text-[11px] uppercase tracking-wide text-[#4d5c55]">
                kWp para cubrir el mes
              </span>
              <strong>≈ {suggested} kWp</strong>
            </p>
          ) : null}
        </div>
      ) : null}

      <WorkFold
        title={
          kwh
            ? `Datos del recibo · ${kwh.toLocaleString("es-CO")} kWh`
            : "Datos del recibo"
        }
        open={fieldsOpen}
        onToggle={() => setFieldsOpen((v) => !v)}
      >
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="text-sm">
          <span className="mb-1 block font-medium">Empresa / comercializador</span>
          <input
            className={field}
            value={value.utility}
            onChange={(e) => patch({ utility: e.target.value })}
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium">Operador de red</span>
          <input
            className={field}
            value={value.operator}
            onChange={(e) => patch({ operator: e.target.value })}
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium">N.º transformador</span>
          <input
            className={field}
            value={value.transformerNumber}
            onChange={(e) => patch({ transformerNumber: e.target.value })}
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium">N.º circuito</span>
          <input
            className={field}
            value={value.circuitNumber}
            onChange={(e) => patch({ circuitNumber: e.target.value })}
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium">Carga / demanda (kW)</span>
          <input
            type="number"
            className={field}
            value={value.demandKw || ""}
            onChange={(e) => patch({ demandKw: Number(e.target.value) || 0 })}
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium">Carga contratada</span>
          <input
            className={field}
            value={value.contractedLoad}
            onChange={(e) => patch({ contractedLoad: e.target.value })}
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium">Consumo del mes (kWh)</span>
          <input
            type="number"
            className={field}
            value={value.consumptionKWh || ""}
            onChange={(e) =>
              patch({ consumptionKWh: Number(e.target.value) || 0 })
            }
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium">Promedio 6 meses (kWh)</span>
          <input
            type="number"
            className={field}
            value={value.average6MonthsKWh || ""}
            onChange={(e) =>
              patch({ average6MonthsKWh: Number(e.target.value) || 0 })
            }
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium">Costo $/kWh</span>
          <input
            type="number"
            className={field}
            value={value.unitPriceCOPPerKWh || ""}
            onChange={(e) =>
              patch({ unitPriceCOPPerKWh: Number(e.target.value) || 0 })
            }
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium">Tarifa efectiva $/kWh</span>
          <input
            type="number"
            className={field}
            value={value.effectiveTariffCOPPerKWh || ""}
            onChange={(e) =>
              patch({ effectiveTariffCOPPerKWh: Number(e.target.value) || 0 })
            }
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium">Total factura (COP)</span>
          <input
            type="number"
            className={field}
            value={value.totalCOP || ""}
            onChange={(e) => patch({ totalCOP: Number(e.target.value) || 0 })}
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium">Medidor</span>
          <input
            className={field}
            value={value.meterNumber}
            onChange={(e) => patch({ meterNumber: e.target.value })}
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium">NIC / cuenta</span>
          <input
            className={field}
            value={value.nic || value.accountNumber}
            onChange={(e) => patch({ nic: e.target.value, accountNumber: e.target.value })}
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium">NIÚ</span>
          <input
            className={field}
            value={value.niu}
            onChange={(e) => patch({ niu: e.target.value })}
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium">Estrato</span>
          <input
            className={field}
            value={value.stratum}
            onChange={(e) => patch({ stratum: e.target.value })}
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium">Nivel de tensión</span>
          <input
            className={field}
            value={value.tensionLevel}
            onChange={(e) => patch({ tensionLevel: e.target.value })}
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium">Periodo</span>
          <input
            className={field}
            value={value.periodLabel}
            onChange={(e) => patch({ periodLabel: e.target.value })}
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium">Reactiva (kVArh)</span>
          <input
            type="number"
            className={field}
            value={value.reactiveKvarh || ""}
            onChange={(e) =>
              patch({ reactiveKvarh: Number(e.target.value) || 0 })
            }
          />
        </label>
      </div>
      <div className="flex flex-wrap gap-3">
        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            checked={value.chargesActiveEnergy}
            onChange={(e) => patch({ chargesActiveEnergy: e.target.checked })}
          />
          Cobra energía activa
        </label>
        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            checked={value.chargesReactiveEnergy}
            onChange={(e) => patch({ chargesReactiveEnergy: e.target.checked })}
          />
          Cobra energía reactiva
        </label>
      </div>
      {value.history.length ? (
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-[#8a6b2a]">
            Histórico
          </p>
          <div className="flex flex-wrap gap-1.5 text-xs">
            {value.history.map((h, i) => (
              <span
                key={`${h.label}-${i}`}
                className="rounded-lg bg-[#f7f4ee] px-2 py-1"
              >
                {h.label}: {h.kwh.toLocaleString("es-CO")} kWh
              </span>
            ))}
          </div>
        </div>
      ) : null}
      <label className="block text-sm">
        <span className="mb-1 block font-medium">Otros datos del recibo</span>
        <textarea
          className={field}
          rows={3}
          value={value.extras}
          onChange={(e) => patch({ extras: e.target.value })}
        />
      </label>
      </WorkFold>
    </div>
  );
}
