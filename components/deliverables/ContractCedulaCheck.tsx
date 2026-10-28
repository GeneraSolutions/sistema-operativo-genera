"use client";

import { useRef, useState } from "react";
import { isPdfFile, renderBillPdf } from "@/lib/bill-pdf";
import {
  digitsOnly,
  formatClientDocument,
  namesLikelyMatch,
  type ClientPartyPhoto,
} from "@/lib/client-party";
import { compressVisitPhoto } from "@/lib/site-visit";
import type { ClientIdType } from "@/lib/client-party";

type Reading = {
  fullName: string;
  documentType: string;
  documentNumber: string;
  extras?: string;
};

export function ContractCedulaCheck({
  clientName,
  clientIdType,
  clientNit,
  clientDv,
}: {
  clientName: string;
  clientIdType?: ClientIdType;
  clientNit?: string;
  clientDv?: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [photos, setPhotos] = useState<ClientPartyPhoto[]>([]);
  const [pdfText, setPdfText] = useState("");
  const [reading, setReading] = useState<Reading | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [offline, setOffline] = useState(false);
  const [sessionOk, setSessionOk] = useState<boolean | null>(null);

  const quoteDoc = formatClientDocument(
    clientIdType,
    clientNit || "",
    clientDv
  );
  const quoteDigits = digitsOnly(clientNit || "");

  async function ensureSession() {
    if (sessionOk != null) return sessionOk;
    try {
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      const ok = res.ok;
      setSessionOk(ok);
      return ok;
    } catch {
      setSessionOk(false);
      return false;
    }
  }

  async function addFiles(files: FileList | null) {
    if (!files?.length) return;
    const logged = await ensureSession();
    if (!logged) {
      setError("Inicie sesión en el Sistema Operativo para cruzar la cédula.");
      return;
    }
    const extras: ClientPartyPhoto[] = [];
    let text = pdfText;
    try {
      for (const file of [...files]) {
        if (extras.length + photos.length >= 4) break;
        if (isPdfFile(file)) {
          const rendered = await renderBillPdf(file, 4 - photos.length);
          extras.push(
            ...rendered.pages.map((page) => ({
              id: crypto.randomUUID(),
              dataUrl: page.dataUrl,
              fileName: page.fileName,
            }))
          );
          if (rendered.text) text = [text, rendered.text].filter(Boolean).join("\n\n");
        } else {
          extras.push({
            id: crypto.randomUUID(),
            dataUrl: await compressVisitPhoto(file),
            fileName: file.name,
          });
        }
      }
      setPhotos((prev) => [...prev, ...extras].slice(0, 4));
      setPdfText(text);
      setError("");
      setReading(null);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo abrir el archivo. Pruebe foto o otro PDF."
      );
    }
  }

  async function leer() {
    const logged = await ensureSession();
    if (!logged) {
      setError("Inicie sesión en el Sistema Operativo para cruzar la cédula.");
      return;
    }
    if (!photos.length && !pdfText.trim()) {
      setError("Agregue una foto o un PDF de la cédula.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/cedula/leer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photos, pdfText }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "No se pudo leer la cédula.");
        return;
      }
      setOffline(Boolean(data.offline));
      setReading(data.reading as Reading);
    } catch {
      setError("No hay conexión para leer la cédula.");
    } finally {
      setBusy(false);
    }
  }

  const nameOk = reading
    ? namesLikelyMatch(reading.fullName, clientName)
    : false;
  const docOk = reading
    ? Boolean(quoteDigits) &&
      digitsOnly(reading.documentNumber) === quoteDigits
    : false;

  return (
    <section className="print:hidden rounded-2xl border border-[#d4b46a]/50 bg-[#fffdf6] p-4">
      <p className="text-[11px] font-semibold tracking-[0.16em] text-[#8a6b2a] uppercase">
        Verificar identidad
      </p>
      <p className="mt-1 text-sm leading-6 text-[#4d5c55]">
        Suba foto o PDF de la cédula y crúcelo con lo que ya está en la
        cotización
        {quoteDoc ? ` (${quoteDoc} · ${clientName})` : ` (${clientName})`}
        .
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
          className="rounded-lg bg-[#0f2a1f] px-3 py-1.5 text-sm font-medium text-white"
          onClick={() => fileRef.current?.click()}
        >
          Añadir cédula
        </button>
        <button
          type="button"
          disabled={busy}
          className="rounded-lg border border-[#1f6b45] px-3 py-1.5 text-sm font-medium text-[#1f6b45] disabled:opacity-60"
          onClick={() => void leer()}
        >
          {busy ? "Leyendo…" : "Cruzar con la cotización"}
        </button>
        {photos.length ? (
          <button
            type="button"
            className="rounded-lg px-3 py-1.5 text-sm text-[#6d7c74] underline"
            onClick={() => {
              setPhotos([]);
              setPdfText("");
              setReading(null);
              setError("");
            }}
          >
            Quitar
          </button>
        ) : null}
      </div>
      {error ? <p className="mt-2 text-sm text-[#9b2c2c]">{error}</p> : null}
      {offline ? (
        <p className="mt-2 text-xs text-[#6b6458]">
          Lectura en modo demo. Revise a ojo las fotos.
        </p>
      ) : null}
      {photos.length ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {photos.map((p) => (
            <div
              key={p.id}
              className="h-20 w-14 overflow-hidden rounded-lg border border-[#d8d2c4]"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.dataUrl}
                alt={p.fileName || "Cédula"}
                className="h-full w-full object-cover"
              />
            </div>
          ))}
        </div>
      ) : null}
      {reading ? (
        <div className="mt-3 grid gap-2 text-sm">
          <MatchRow
            ok={nameOk}
            label="Nombre"
            quote={clientName}
            scanned={reading.fullName || "—"}
          />
          <MatchRow
            ok={docOk}
            label="Documento"
            quote={quoteDoc || "Sin documento en la cotización"}
            scanned={
              reading.documentNumber
                ? `${reading.documentType.toUpperCase()} ${reading.documentNumber}`
                : "—"
            }
          />
          {reading.extras ? (
            <p className="text-xs text-[#6d7c74]">{reading.extras}</p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function MatchRow({
  ok,
  label,
  quote,
  scanned,
}: {
  ok: boolean;
  label: string;
  quote: string;
  scanned: string;
}) {
  return (
    <div
      className={`rounded-xl border px-3 py-2 ${
        ok
          ? "border-[#1f6b45]/30 bg-[#e8f6ee] text-[#12241c]"
          : "border-[#c45c4a]/35 bg-[#fde8e8] text-[#6b2a22]"
      }`}
    >
      <p className="text-[11px] font-semibold tracking-wide uppercase">
        {label}: {ok ? "Coincide" : "No coincide"}
      </p>
      <p className="mt-1 text-xs leading-5">
        Cotización / RUT: {quote}
        <br />
        Cédula: {scanned}
      </p>
    </div>
  );
}
