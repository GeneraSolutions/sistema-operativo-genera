"use client";

import { useEffect, useState } from "react";
import { isPdfFile, renderBillPdf } from "@/lib/bill-pdf";
import { localISODate, type SolarwinGasto } from "@/lib/solarwin";

/** Tamaño máximo (caracteres del data URL) de la foto que se guarda. */
const STORE_MAX_CHARS = 110_000;
const OCR_MAX_CHARS = 1_600_000;

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("No se pudo leer el archivo."));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Imagen no válida."));
    img.src = src;
  });
}

/** Redibuja la imagen a JPEG hasta que quepa en `maxChars`. */
async function compress(
  dataUrl: string,
  maxSide: number,
  maxChars: number
): Promise<string> {
  const img = await loadImage(dataUrl);
  let side = maxSide;
  let out = dataUrl;
  for (let round = 0; round < 6; round++) {
    const scale = Math.min(1, side / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.width * scale));
    canvas.height = Math.max(1, Math.round(img.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) return out;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    for (const q of [0.62, 0.5, 0.4]) {
      out = canvas.toDataURL("image/jpeg", q);
      if (out.length <= maxChars) return out;
    }
    side = Math.round(side * 0.8);
  }
  return out;
}

export interface ReceiptResult {
  /** Campos del gasto a aplicar (solo rellena lo que estaba vacío). */
  patch: Partial<SolarwinGasto>;
  /** Mensaje corto para mostrar al usuario. */
  message: string;
}

/**
 * Comprime el comprobante (foto o PDF) y, si hay lectura automática,
 * completa concepto, monto y fecha cuando están vacíos.
 */
export async function attachReceipt(
  file: File,
  current: Pick<SolarwinGasto, "concept" | "amountCOP" | "date">
): Promise<ReceiptResult> {
  if (file.size > 14_000_000) {
    throw new Error("Archivo muy pesado (máx. ~14 MB).");
  }

  let source = "";
  let pdfText = "";
  if (isPdfFile(file)) {
    const rendered = await renderBillPdf(file, 1);
    source = rendered.pages[0]?.dataUrl || "";
    pdfText = rendered.text || "";
  } else {
    source = await readAsDataUrl(file);
  }
  if (!source) throw new Error("No se pudo leer el comprobante.");

  const stored = await compress(source, 1000, STORE_MAX_CHARS);
  const patch: Partial<SolarwinGasto> = {
    receiptDataUrl: stored,
    receiptId: crypto.randomUUID(),
    receiptUp: false,
    receiptName: file.name,
  };

  let message = "Comprobante adjunto.";
  try {
    const forOcr =
      source.length > OCR_MAX_CHARS
        ? await compress(source, 1600, OCR_MAX_CHARS)
        : source;
    const res = await fetch("/api/gastos/factura", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        imageDataUrl: forOcr || undefined,
        pdfText: pdfText || undefined,
        fileName: file.name,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.reading && !data.offline) {
      const r = data.reading as {
        supplier?: string;
        date?: string;
        totalCOP?: number;
        lines?: { name?: string }[];
      };
      const filled: string[] = [];
      if (!current.concept.trim()) {
        const first = r.lines?.find((l) => l.name?.trim())?.name?.trim();
        const label = [r.supplier?.trim(), first].filter(Boolean).join(" · ");
        if (label) {
          patch.concept = label.slice(0, 120);
          filled.push("concepto");
        }
      }
      if (!current.amountCOP && r.totalCOP && r.totalCOP > 0) {
        patch.amountCOP = Math.round(r.totalCOP);
        filled.push("monto");
      }
      if (r.date && /^\d{4}-\d{2}-\d{2}$/.test(r.date) && current.date === localISODate()) {
        patch.date = r.date;
        filled.push("fecha");
      }
      if (filled.length) {
        message = `Comprobante leído · completé ${filled.join(", ")}. Revísalo.`;
      }
    }
  } catch {
    /* la lectura automática es opcional */
  }
  return { patch, message };
}

/** Sube la foto al servidor (se guarda aparte de las cuentas). */
export async function uploadReceipt(
  id: string,
  dataUrl: string
): Promise<boolean> {
  try {
    const res = await fetch("/api/solarwin/foto", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, dataUrl }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

const photoCache = new Map<string, string>();

/** Baja una foto del servidor (con caché en memoria). */
export async function fetchReceipt(id: string): Promise<string | null> {
  const hit = photoCache.get(id);
  if (hit) return hit;
  try {
    const res = await fetch(`/api/solarwin/foto/${encodeURIComponent(id)}`);
    if (!res.ok) return null;
    const data = (await res.json()) as { dataUrl?: string };
    if (!data.dataUrl) return null;
    photoCache.set(id, data.dataUrl);
    return data.dataUrl;
  } catch {
    return null;
  }
}

/** URL de la foto: la copia local si existe; si no, se baja del servidor. */
export function useReceiptUrl(
  g: Pick<SolarwinGasto, "receiptDataUrl" | "receiptId">
): string | null {
  const [remote, setRemote] = useState<{ id: string; url: string } | null>(null);
  const id = g.receiptId;
  const local = g.receiptDataUrl || "";
  useEffect(() => {
    if (local || !id) return;
    let alive = true;
    fetchReceipt(id).then((url) => {
      if (alive && url) setRemote({ id, url });
    });
    return () => {
      alive = false;
    };
  }, [local, id]);
  if (local) return local;
  return remote && remote.id === id ? remote.url : null;
}
