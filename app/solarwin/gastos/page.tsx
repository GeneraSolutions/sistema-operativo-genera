"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import {
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  Download,
  Handshake,
  Link2,
  Lock,
  LockOpen,
  Paperclip,
  Pencil,
  Plus,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import {
  activeEnvios,
  blankEnvio,
  blankGasto,
  bundleForPublish,
  buildSolarwinSummary,
  closeEnvio,
  emptySolarwinBundle,
  formatCOP,
  gastosOfEnvio,
  isDevolucion,
  knownPayers,
  knownProjects,
  loadSolarwinBundle,
  mergeSolarwinBundle,
  persistSolarwinCloud,
  removeEnvio,
  removeGasto,
  reopenEnvio,
  saveSolarwinBundle,
  totalsAll,
  totalsByPayer,
  totalsForEnvio,
  upsertEnvio,
  upsertGasto,
  type EnvioTotals,
  type SolarwinBundle,
  type SolarwinEnvio,
  type SolarwinGasto,
} from "@/lib/solarwin";
import { attachReceipt } from "@/lib/solarwin-receipt";

const field =
  "w-full rounded-xl border border-[#d8d2c4] bg-[#fbfaf6] px-3 py-2.5 text-sm";

const SUGGESTIONS = [
  "Viáticos",
  "Alimentación",
  "Transporte",
  "Hospedaje",
  "Combustible",
  "Peajes",
  "Materiales",
  "Herramienta",
  "Mano de obra",
  "Imprevistos",
];

function longDate(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("es-CO", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function Stat({
  label,
  value,
  tone,
  hint,
}: {
  label: string;
  value: string;
  tone?: "ok" | "bad" | "info";
  hint?: string;
}) {
  const color =
    tone === "bad"
      ? "text-[#9b3b2e]"
      : tone === "ok"
        ? "text-[#0f6b45]"
        : tone === "info"
          ? "text-[#1d5fa8]"
          : "text-[#10231a]";
  return (
    <div className="rounded-xl border border-[#eee8dc] bg-[#fbfaf6] px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-wide text-[#6d7c74]">
        {label}
      </p>
      <p className={`mt-1 text-xl font-semibold tabular-nums ${color}`}>
        {value}
      </p>
      {hint ? <p className="mt-0.5 text-xs text-[#6d7c74]">{hint}</p> : null}
    </div>
  );
}

function UsageBar({ totals }: { totals: EnvioTotals }) {
  const pct = Math.min(100, totals.usedPercent);
  const over = totals.excedeCOP > 0;
  const warn = !over && totals.usedPercent >= 85;
  const fill = over ? "bg-[#c0483a]" : warn ? "bg-[#d99a1f]" : "bg-[#1f8a5b]";
  return (
    <div
      className="h-2.5 w-full overflow-hidden rounded-full bg-[#ece6d8]"
      role="progressbar"
      aria-valuenow={Math.round(totals.usedPercent)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={`h-full rounded-full transition-all ${fill}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function EnvioForm({
  draft,
  isNew,
  onChange,
  onSave,
  onCancel,
}: {
  draft: SolarwinEnvio;
  isNew: boolean;
  onChange: (next: SolarwinEnvio) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="os-panel rounded-2xl border border-[#cfe3d6] bg-[#f4faf6] p-5">
      <h3 className="text-base font-semibold">
        {isNew ? "Dinero que envían" : "Editar envío"}
      </h3>
      <p className="mt-0.5 text-sm text-[#6d7c74]">
        Monto que Solar win le envía a Genera. Los gastos se descuentan de este
        valor.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          Monto enviado (COP)
          <input
            type="number"
            inputMode="numeric"
            min={0}
            autoFocus
            className={`${field} mt-1`}
            value={draft.amountCOP || ""}
            onChange={(e) =>
              onChange({ ...draft, amountCOP: Number(e.target.value) || 0 })
            }
            placeholder="Ej. 2000000"
          />
        </label>
        <label className="text-sm">
          Fecha
          <input
            type="date"
            className={`${field} mt-1`}
            value={draft.date}
            onChange={(e) => onChange({ ...draft, date: e.target.value })}
          />
        </label>
        <label className="text-sm">
          Para qué es
          <input
            className={`${field} mt-1`}
            list="sw-suggest"
            value={draft.concept}
            onChange={(e) => onChange({ ...draft, concept: e.target.value })}
            placeholder="Ej. Viáticos instalación"
          />
        </label>
        <label className="text-sm">
          Proyecto o instalación
          <input
            className={`${field} mt-1`}
            list="sw-projects"
            value={draft.project || ""}
            onChange={(e) => onChange({ ...draft, project: e.target.value })}
            placeholder="Ej. Instalación Sopó 12 kW"
          />
        </label>
        <label className="text-sm sm:col-span-2">
          Notas (opcional)
          <input
            className={`${field} mt-1`}
            value={draft.notes || ""}
            onChange={(e) => onChange({ ...draft, notes: e.target.value })}
            placeholder="Referencia de transferencia, quién lo envió…"
          />
        </label>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          className="os-btn os-btn-primary"
          disabled={!draft.amountCOP}
          onClick={onSave}
        >
          <Check size={16} />
          Guardar envío
        </button>
        <button type="button" className="os-btn os-btn-ghost" onClick={onCancel}>
          Cancelar
        </button>
      </div>
    </div>
  );
}

/** Campos de un gasto o devolución (los usa tanto "agregar" como "editar"). */
function GastoFields({
  draft,
  setDraft,
  onSubmit,
  onFlash,
  conceptRef,
}: {
  draft: SolarwinGasto;
  setDraft: Dispatch<SetStateAction<SolarwinGasto>>;
  onSubmit?: () => void;
  onFlash: (msg: string) => void;
  conceptRef?: React.RefObject<HTMLInputElement | null>;
}) {
  const [reading, setReading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const dev = isDevolucion(draft);
  const enter = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && onSubmit) onSubmit();
  };

  async function onFile(file: File | null) {
    if (!file) return;
    setReading(true);
    onFlash("Leyendo comprobante…");
    try {
      const { patch, message } = await attachReceipt(file, draft);
      setDraft((prev) => ({
        ...prev,
        receiptDataUrl: patch.receiptDataUrl,
        receiptName: patch.receiptName,
        concept: !prev.concept.trim() && patch.concept ? patch.concept : prev.concept,
        amountCOP: !prev.amountCOP && patch.amountCOP ? patch.amountCOP : prev.amountCOP,
        date: patch.date && prev.date === draft.date ? patch.date : prev.date,
      }));
      onFlash(message);
    } catch (e) {
      onFlash(e instanceof Error ? e.message : "No se pudo adjuntar el comprobante.");
    } finally {
      setReading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div>
      <div className="inline-flex rounded-xl border border-[#d8d2c4] bg-white p-0.5 text-xs font-semibold">
        <button
          type="button"
          className={`rounded-lg px-3 py-1.5 ${
            !dev ? "bg-[#0f2a1f] text-white" : "text-[#4d5c55]"
          }`}
          onClick={() => setDraft((d) => ({ ...d, kind: "gasto" }))}
        >
          Gasto o compra
        </button>
        <button
          type="button"
          className={`rounded-lg px-3 py-1.5 ${
            dev ? "bg-[#1d5fa8] text-white" : "text-[#4d5c55]"
          }`}
          onClick={() => setDraft((d) => ({ ...d, kind: "devolucion" }))}
        >
          Devolución a Solar win
        </button>
      </div>

      <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_9rem_9rem]">
        <input
          ref={conceptRef}
          className={field}
          list="sw-suggest"
          value={draft.concept}
          onChange={(e) => setDraft((d) => ({ ...d, concept: e.target.value }))}
          onKeyDown={enter}
          placeholder={
            dev ? "Concepto (opcional: Devolución a Solar win)" : "Concepto (ej. Almuerzo cuadrilla)"
          }
        />
        <input
          type="number"
          inputMode="numeric"
          min={0}
          className={field}
          value={draft.amountCOP || ""}
          onChange={(e) =>
            setDraft((d) => ({ ...d, amountCOP: Number(e.target.value) || 0 }))
          }
          onKeyDown={enter}
          placeholder="Monto COP"
        />
        <input
          type="date"
          className={field}
          value={draft.date}
          onChange={(e) => setDraft((d) => ({ ...d, date: e.target.value }))}
        />
      </div>

      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {!dev ? (
          <input
            className={field}
            list="sw-payers"
            value={draft.paidBy || ""}
            onChange={(e) => setDraft((d) => ({ ...d, paidBy: e.target.value }))}
            onKeyDown={enter}
            placeholder="Quién pagó (ej. Camilo, técnico, caja Genera)"
          />
        ) : null}
        <input
          className={`${field} ${dev ? "sm:col-span-2" : ""}`}
          value={draft.notes || ""}
          onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
          onKeyDown={enter}
          placeholder="Nota (opcional)"
        />
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <input
          ref={fileRef}
          type="file"
          accept="image/*,application/pdf"
          className="hidden"
          onChange={(e) => void onFile(e.target.files?.[0] || null)}
        />
        <button
          type="button"
          className="os-btn os-btn-ghost text-xs"
          disabled={reading}
          onClick={() => fileRef.current?.click()}
        >
          <Paperclip size={14} />
          {reading
            ? "Leyendo…"
            : draft.receiptDataUrl
              ? "Cambiar comprobante"
              : "Adjuntar comprobante (foto o PDF)"}
        </button>
        {draft.receiptDataUrl ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={draft.receiptDataUrl}
              alt="Comprobante"
              className="h-10 w-10 rounded-lg border border-[#ddd6c8] object-cover"
            />
            <span className="max-w-[12rem] truncate text-xs text-[#6d7c74]">
              {draft.receiptName}
            </span>
            <button
              type="button"
              className="os-icon-btn text-[#9b3b2e]"
              title="Quitar comprobante"
              aria-label="Quitar comprobante"
              onClick={() =>
                setDraft((d) => ({
                  ...d,
                  receiptDataUrl: "",
                  receiptName: "",
                }))
              }
            >
              <X size={14} />
            </button>
          </>
        ) : (
          <span className="text-xs text-[#6d7c74]">
            Si adjuntas la factura, intento completar concepto y monto.
          </span>
        )}
      </div>
    </div>
  );
}

function GastoRow({
  gasto,
  locked,
  onSave,
  onDelete,
  onFlash,
  onViewReceipt,
}: {
  gasto: SolarwinGasto;
  locked: boolean;
  onSave: (next: SolarwinGasto) => void;
  onDelete: () => void;
  onFlash: (msg: string) => void;
  onViewReceipt: (url: string, title: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(gasto);
  const dev = isDevolucion(gasto);

  if (editing) {
    return (
      <li className="rounded-xl border border-[#cfe3d6] bg-[#f4faf6] p-3">
        <GastoFields draft={draft} setDraft={setDraft} onFlash={onFlash} />
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            className="os-btn os-btn-primary text-xs"
            disabled={!draft.amountCOP || (!isDevolucion(draft) && !draft.concept.trim())}
            onClick={() => {
              onSave({
                ...draft,
                concept:
                  draft.concept.trim() ||
                  (isDevolucion(draft) ? "Devolución a Solar win" : ""),
              });
              setEditing(false);
            }}
          >
            <Check size={14} />
            Guardar
          </button>
          <button
            type="button"
            className="os-btn os-btn-ghost text-xs"
            onClick={() => {
              setDraft(gasto);
              setEditing(false);
            }}
          >
            <X size={14} />
            Cancelar
          </button>
        </div>
      </li>
    );
  }

  return (
    <li
      className={`flex items-start justify-between gap-3 rounded-xl border px-3 py-2.5 ${
        dev ? "border-[#c9daf0] bg-[#f3f8fe]" : "border-[#eee8dc] bg-white"
      }`}
    >
      <div className="flex min-w-0 items-start gap-3">
        {gasto.receiptDataUrl ? (
          <button
            type="button"
            className="shrink-0"
            title="Ver comprobante"
            onClick={() => onViewReceipt(gasto.receiptDataUrl!, gasto.concept)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={gasto.receiptDataUrl}
              alt="Comprobante"
              className="h-11 w-11 rounded-lg border border-[#ddd6c8] object-cover"
            />
          </button>
        ) : null}
        <div className="min-w-0">
          <p className="text-sm font-medium text-[#10231a]">
            {dev ? (
              <span className="mr-2 rounded-full bg-[#dbe9f9] px-2 py-0.5 text-[11px] font-semibold text-[#1d5fa8]">
                Devolución
              </span>
            ) : null}
            {gasto.concept}
          </p>
          <p className="text-xs text-[#6d7c74]">
            {gasto.date}
            {gasto.paidBy ? ` · pagó ${gasto.paidBy}` : ""}
            {gasto.notes ? ` · ${gasto.notes}` : ""}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <span
          className={`mr-2 text-sm font-semibold tabular-nums ${
            dev ? "text-[#1d5fa8]" : "text-[#9b3b2e]"
          }`}
        >
          − {formatCOP(gasto.amountCOP)}
        </span>
        {!locked ? (
          <>
            <button
              type="button"
              className="os-icon-btn"
              title="Editar"
              aria-label="Editar"
              onClick={() => {
                setDraft(gasto);
                setEditing(true);
              }}
            >
              <Pencil size={14} />
            </button>
            <button
              type="button"
              className="os-icon-btn text-[#9b3b2e]"
              title="Eliminar"
              aria-label="Eliminar"
              onClick={onDelete}
            >
              <Trash2 size={14} />
            </button>
          </>
        ) : null}
      </div>
    </li>
  );
}

function EnvioCard({
  envio,
  bundle,
  expanded,
  busy,
  onToggle,
  onEdit,
  onDelete,
  onPdf,
  onLink,
  onClose,
  onReopen,
  onAddGasto,
  onSaveGasto,
  onDeleteGasto,
  onFlash,
  onViewReceipt,
}: {
  envio: SolarwinEnvio;
  bundle: SolarwinBundle;
  expanded: boolean;
  busy: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onPdf: () => void;
  onLink: () => void;
  onClose: () => void;
  onReopen: () => void;
  onAddGasto: (g: SolarwinGasto) => void;
  onSaveGasto: (g: SolarwinGasto) => void;
  onDeleteGasto: (id: string) => void;
  onFlash: (msg: string) => void;
  onViewReceipt: (url: string, title: string) => void;
}) {
  const totals = totalsForEnvio(bundle, envio.id);
  const gastos = gastosOfEnvio(bundle, envio.id);
  const [draft, setDraft] = useState<SolarwinGasto>(() => blankGasto(envio.id));
  const conceptRef = useRef<HTMLInputElement>(null);
  const over = totals.excedeCOP > 0;
  const closed = Boolean(envio.closedAt);
  const dev = isDevolucion(draft);

  function submit() {
    if (!draft.amountCOP) return;
    if (!dev && !draft.concept.trim()) return;
    onAddGasto({
      ...draft,
      concept: draft.concept.trim() || (dev ? "Devolución a Solar win" : ""),
    });
    setDraft({
      ...blankGasto(envio.id),
      date: draft.date,
      kind: draft.kind,
      paidBy: draft.paidBy,
    });
    conceptRef.current?.focus();
  }

  return (
    <section
      className={`os-panel rounded-2xl border bg-white p-5 ${
        closed ? "border-[#bcd6c6]" : "border-[#ddd6c8]"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <button
          type="button"
          className="flex min-w-0 flex-1 items-start gap-2 text-left"
          onClick={onToggle}
          aria-expanded={expanded}
        >
          {expanded ? (
            <ChevronDown size={18} className="mt-0.5 shrink-0" />
          ) : (
            <ChevronRight size={18} className="mt-0.5 shrink-0" />
          )}
          <span className="min-w-0">
            <span className="flex flex-wrap items-center gap-2 text-base font-semibold text-[#10231a]">
              {envio.concept || "Envío de Solar win"}
              {envio.project ? (
                <span className="rounded-full bg-[#eef3ee] px-2 py-0.5 text-[11px] font-semibold text-[#2f5d46]">
                  {envio.project}
                </span>
              ) : null}
              {closed ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-[#0f2a1f] px-2 py-0.5 text-[11px] font-semibold text-white">
                  <Lock size={11} />
                  Liquidado {longDate(envio.closedAt)}
                </span>
              ) : null}
            </span>
            <span className="block text-xs text-[#6d7c74]">
              {envio.date} · {gastos.length}{" "}
              {gastos.length === 1 ? "movimiento" : "movimientos"}
              {envio.notes ? ` · ${envio.notes}` : ""}
            </span>
          </span>
        </button>
        <div className="text-right">
          <p className="text-xs uppercase tracking-wide text-[#6d7c74]">
            {over ? "Excedido" : "Disponible"}
          </p>
          <p
            className={`text-2xl font-semibold tabular-nums ${
              over ? "text-[#9b3b2e]" : "text-[#0f6b45]"
            }`}
          >
            {over
              ? `− ${formatCOP(totals.excedeCOP)}`
              : formatCOP(totals.disponibleCOP)}
          </p>
          <p className="text-xs text-[#6d7c74]">
            de {formatCOP(totals.enviadoCOP)} enviados
          </p>
        </div>
      </div>

      <div className="mt-3">
        <UsageBar totals={totals} />
        <p className="mt-1 text-xs text-[#6d7c74]">
          Gastado {formatCOP(totals.gastadoCOP)}
          {totals.devueltoCOP > 0
            ? ` · Devuelto ${formatCOP(totals.devueltoCOP)}`
            : ""}{" "}
          · {totals.usedPercent}% del envío
        </p>
      </div>

      {expanded ? (
        <div className="mt-4 space-y-4">
          {!closed ? (
            <div className="rounded-xl border border-dashed border-[#cfd6cc] bg-[#fbfaf6] p-3">
              <p className="text-sm font-semibold">
                {dev ? "Registrar devolución" : "Registrar gasto o compra"}
              </p>
              <div className="mt-2">
                <GastoFields
                  draft={draft}
                  setDraft={setDraft}
                  onSubmit={submit}
                  onFlash={onFlash}
                  conceptRef={conceptRef}
                />
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  className="os-btn os-btn-primary"
                  disabled={!draft.amountCOP || (!dev && !draft.concept.trim())}
                  onClick={submit}
                >
                  {dev ? <Undo2 size={16} /> : <Plus size={16} />}
                  {dev ? "Agregar devolución" : "Agregar gasto"}
                </button>
                {draft.amountCOP > 0 ? (
                  <span className="text-xs text-[#6d7c74]">
                    Quedaría disponible:{" "}
                    <strong
                      className={
                        totals.disponibleCOP - draft.amountCOP < 0
                          ? "text-[#9b3b2e]"
                          : "text-[#0f6b45]"
                      }
                    >
                      {formatCOP(totals.disponibleCOP - draft.amountCOP)}
                    </strong>
                  </span>
                ) : null}
              </div>
            </div>
          ) : (
            <p className="rounded-xl bg-[#f1f6f2] px-3 py-2 text-sm text-[#2f5d46]">
              Cuentas liquidadas. Para agregar o corregir movimientos, reabre el
              envío.
            </p>
          )}

          {gastos.length ? (
            <ul className="space-y-2">
              {gastos.map((g) => (
                <GastoRow
                  key={g.id}
                  gasto={g}
                  locked={closed}
                  onSave={onSaveGasto}
                  onDelete={() => onDeleteGasto(g.id)}
                  onFlash={onFlash}
                  onViewReceipt={onViewReceipt}
                />
              ))}
            </ul>
          ) : (
            <p className="text-sm text-[#6d7c74]">
              Aún no hay movimientos en este envío.
            </p>
          )}

          <div className="flex flex-wrap gap-2 border-t border-[#eee8dc] pt-3">
            {closed ? (
              <button
                type="button"
                className="os-btn os-btn-ghost text-xs"
                onClick={onReopen}
              >
                <LockOpen size={14} />
                Reabrir envío
              </button>
            ) : (
              <button
                type="button"
                className="os-btn os-btn-primary text-xs"
                onClick={onClose}
              >
                <Lock size={14} />
                Liquidar cuentas
              </button>
            )}
            <button
              type="button"
              className="os-btn os-btn-ghost text-xs"
              disabled={busy}
              onClick={onPdf}
            >
              <Download size={14} />
              PDF de este envío
            </button>
            <button
              type="button"
              className="os-btn os-btn-ghost text-xs"
              disabled={busy}
              onClick={onLink}
            >
              <Link2 size={14} />
              Enlace
            </button>
            {!closed ? (
              <>
                <button
                  type="button"
                  className="os-btn os-btn-ghost text-xs"
                  onClick={onEdit}
                >
                  <Pencil size={14} />
                  Editar envío
                </button>
                <button
                  type="button"
                  className="os-btn os-btn-ghost text-xs text-[#9b3b2e]"
                  onClick={onDelete}
                >
                  <Trash2 size={14} />
                  Eliminar envío
                </button>
              </>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}

export default function SolarwinGastosPage() {
  const [bundle, setBundle] = useState<SolarwinBundle>(emptySolarwinBundle);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const [draftEnvio, setDraftEnvio] = useState<SolarwinEnvio | null>(null);
  const [draftIsNew, setDraftIsNew] = useState(true);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [lightbox, setLightbox] = useState<{ url: string; title: string } | null>(
    null
  );
  const bundleRef = useRef(bundle);
  const writeGen = useRef(0);

  const apply = useCallback((next: SolarwinBundle) => {
    bundleRef.current = next;
    writeGen.current += 1;
    try {
      saveSolarwinBundle(next);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar.");
    }
    setBundle(next);
    void persistSolarwinCloud(next);
  }, []);

  useEffect(() => {
    const local = loadSolarwinBundle();
    bundleRef.current = local;
    setBundle(local);
    setReady(true);
    const gen = writeGen.current;
    fetch("/api/archivo", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data?.solarwin || gen !== writeGen.current) return;
        const merged = mergeSolarwinBundle(bundleRef.current, data.solarwin);
        bundleRef.current = merged;
        try {
          saveSolarwinBundle(merged);
        } catch {
          /* se mantiene en memoria */
        }
        setBundle(merged);
        void persistSolarwinCloud(merged);
      })
      .catch(() => null);
  }, []);

  useEffect(() => {
    if (!flash) return;
    const t = window.setTimeout(() => setFlash(null), 5500);
    return () => window.clearTimeout(t);
  }, [flash]);

  useEffect(() => {
    if (!lightbox) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setLightbox(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightbox]);

  const envios = activeEnvios(bundle);
  const all = totalsAll(bundle);
  const over = all.excedeCOP > 0;
  const payers = totalsByPayer(bundle);
  const closedCount = envios.filter((e) => e.closedAt).length;

  function openNew() {
    setDraftIsNew(true);
    setDraftEnvio(blankEnvio());
  }

  function saveEnvio() {
    if (!draftEnvio || !draftEnvio.amountCOP) return;
    apply(upsertEnvio(bundleRef.current, draftEnvio));
    setCollapsed((c) => ({ ...c, [draftEnvio.id]: false }));
    setDraftEnvio(null);
  }

  function deleteEnvio(envio: SolarwinEnvio) {
    const n = gastosOfEnvio(bundleRef.current, envio.id).length;
    const ok = window.confirm(
      `¿Eliminar el envío "${envio.concept || "Solar win"}" de ${formatCOP(envio.amountCOP)}${
        n ? ` y sus ${n} movimientos` : ""
      }?`
    );
    if (ok) apply(removeEnvio(bundleRef.current, envio.id));
  }

  function liquidar(envio: SolarwinEnvio) {
    const t = totalsForEnvio(bundleRef.current, envio.id);
    let msg = `¿Liquidar "${envio.concept || "Solar win"}"? Quedará congelado hasta que lo reabras.`;
    if (t.excedeCOP > 0) {
      msg = `Se gastó ${formatCOP(t.excedeCOP)} más de lo enviado (lo adelantó Genera).\n\n${msg}`;
    } else if (t.disponibleCOP > 0) {
      msg = `Aún quedan ${formatCOP(t.disponibleCOP)} sin gastar ni devolver. Puedes registrar una devolución antes de liquidar.\n\n${msg}`;
    }
    if (!window.confirm(msg)) return;
    apply(closeEnvio(bundleRef.current, envio.id));
    setFlash("Envío liquidado. Genera el PDF para dejar la constancia.");
  }

  /** Publica un corte congelado y devuelve su URL pública. */
  async function publish(envioId?: string): Promise<string> {
    const { bundle: scoped, droppedReceipts } = bundleForPublish(
      bundleRef.current,
      envioId
    );
    const res = await fetch("/api/solarwin/publicar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bundle: scoped, envioId }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.id) {
      throw new Error(data.error || "No se pudo generar el documento.");
    }
    if (droppedReceipts) {
      setFlash(
        "Ojo: había tantos comprobantes que el documento salió sin fotos. Genera uno por envío para incluirlas."
      );
    }
    return `${window.location.origin}/estado-cuenta/${data.id}`;
  }

  async function sharePdf(envioId?: string) {
    // Se abre la pestaña ya (clic del usuario) para que el navegador no la bloquee.
    const tab = window.open("", "_blank");
    setBusy(true);
    setError(null);
    try {
      const url = await publish(envioId);
      if (tab) tab.location.href = `${url}?imprimir=1`;
      else window.location.href = `${url}?imprimir=1`;
      setFlash((f) => f ?? "PDF listo · en la ventana elige “Guardar como PDF”.");
    } catch (e) {
      tab?.close();
      setError(e instanceof Error ? e.message : "No se pudo generar el PDF.");
    } finally {
      setBusy(false);
    }
  }

  async function shareLink(envioId?: string) {
    setBusy(true);
    setError(null);
    try {
      const url = await publish(envioId);
      try {
        await navigator.clipboard.writeText(url);
        setFlash((f) => f ?? "Enlace copiado. Quien lo abra ve las cuentas a esta fecha.");
      } catch {
        window.prompt("Copia este enlace:", url);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo crear el enlace.");
    } finally {
      setBusy(false);
    }
  }

  async function copySummary() {
    try {
      await navigator.clipboard.writeText(buildSolarwinSummary(bundleRef.current));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      setError("No se pudo copiar el resumen.");
    }
  }

  if (!ready) {
    return (
      <AppShell title="Gastos" subtitle="Solar win · Cargando…">
        <p className="text-sm text-[#6d7c74]">Cargando…</p>
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Gastos"
      subtitle="Solar win · dinero enviado y en qué se gastó"
      actions={
        <button type="button" className="os-btn os-btn-primary" onClick={openNew}>
          <Plus size={16} />
          Dinero que envían
        </button>
      }
    >
      <datalist id="sw-suggest">
        {SUGGESTIONS.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
      <datalist id="sw-payers">
        {knownPayers(bundle).map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
      <datalist id="sw-projects">
        {knownProjects(bundle).map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>

      <div className="space-y-5">
        {error ? (
          <p className="rounded-xl border border-[#e4b8b0] bg-[#fbeeeb] px-4 py-2 text-sm text-[#9b3b2e]">
            {error}
          </p>
        ) : null}
        {flash ? (
          <p className="rounded-xl border border-[#cfe3d6] bg-[#f4faf6] px-4 py-2 text-sm text-[#0f6b45]">
            {flash}
          </p>
        ) : null}

        <section className="os-panel rounded-2xl border border-[#ddd6c8] bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 text-base font-semibold">
                <Handshake size={18} />
                Cuenta general con Solar win
              </h2>
              <p className="text-sm text-[#6d7c74]">
                Suma de todos los envíos menos gastos y devoluciones
                {closedCount ? ` · ${closedCount} de ${envios.length} liquidados` : ""}.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="os-btn os-btn-primary text-sm"
                onClick={() => void sharePdf()}
                disabled={!envios.length || busy}
              >
                <Download size={16} />
                {busy ? "Generando…" : "Descargar PDF"}
              </button>
              <button
                type="button"
                className="os-btn os-btn-ghost text-sm"
                onClick={() => void shareLink()}
                disabled={!envios.length || busy}
              >
                <Link2 size={16} />
                Copiar enlace
              </button>
              <button
                type="button"
                className="os-btn os-btn-ghost text-sm"
                onClick={copySummary}
                disabled={!envios.length}
              >
                {copied ? <Check size={16} /> : <Copy size={16} />}
                {copied ? "Texto copiado" : "Copiar como texto"}
              </button>
            </div>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Total enviado" value={formatCOP(all.enviadoCOP)} />
            <Stat
              label="Total gastado"
              value={formatCOP(all.gastadoCOP)}
              hint={`${all.usedPercent}% de lo enviado`}
            />
            <Stat
              label="Devuelto a Solar win"
              value={formatCOP(all.devueltoCOP)}
              tone={all.devueltoCOP > 0 ? "info" : undefined}
            />
            <Stat
              label={over ? "Excedido (Genera adelantó)" : "Saldo disponible"}
              value={over ? `− ${formatCOP(all.excedeCOP)}` : formatCOP(all.disponibleCOP)}
              tone={over ? "bad" : "ok"}
              hint={
                over
                  ? "Se gastó más de lo enviado"
                  : "Lo que queda por gastar o devolver"
              }
            />
          </div>
          <div className="mt-4">
            <UsageBar totals={all} />
          </div>
          {payers.length ? (
            <div className="mt-4 border-t border-[#eee8dc] pt-3">
              <p className="text-xs font-medium uppercase tracking-wide text-[#6d7c74]">
                Quién puso la plata
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {payers.map((p) => (
                  <span
                    key={p.name}
                    className="rounded-full border border-[#e1dac9] bg-[#fbfaf6] px-3 py-1 text-xs"
                  >
                    {p.name}{" "}
                    <strong className="tabular-nums">{formatCOP(p.totalCOP)}</strong>
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </section>

        {draftEnvio ? (
          <EnvioForm
            draft={draftEnvio}
            isNew={draftIsNew}
            onChange={setDraftEnvio}
            onSave={saveEnvio}
            onCancel={() => setDraftEnvio(null)}
          />
        ) : null}

        {envios.length === 0 && !draftEnvio ? (
          <div className="rounded-2xl border border-dashed border-[#cfd6cc] bg-white p-8 text-center">
            <p className="text-sm text-[#6d7c74]">
              Aún no has registrado dinero enviado por Solar win.
            </p>
            <button
              type="button"
              className="os-btn os-btn-primary mt-3"
              onClick={openNew}
            >
              <Plus size={16} />
              Dinero que envían
            </button>
          </div>
        ) : null}

        {envios.map((envio) => (
          <EnvioCard
            key={envio.id}
            envio={envio}
            bundle={bundle}
            busy={busy}
            expanded={collapsed[envio.id] !== true}
            onToggle={() =>
              setCollapsed((c) => ({ ...c, [envio.id]: c[envio.id] !== true }))
            }
            onEdit={() => {
              setDraftIsNew(false);
              setDraftEnvio({ ...envio });
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            onDelete={() => deleteEnvio(envio)}
            onPdf={() => void sharePdf(envio.id)}
            onLink={() => void shareLink(envio.id)}
            onClose={() => liquidar(envio)}
            onReopen={() => apply(reopenEnvio(bundleRef.current, envio.id))}
            onAddGasto={(g) => apply(upsertGasto(bundleRef.current, g))}
            onSaveGasto={(g) => apply(upsertGasto(bundleRef.current, g))}
            onDeleteGasto={(id) => apply(removeGasto(bundleRef.current, id))}
            onFlash={setFlash}
            onViewReceipt={(url, title) => setLightbox({ url, title })}
          />
        ))}
      </div>

      {lightbox ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setLightbox(null)}
        >
          <div className="max-h-full max-w-3xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 flex items-center justify-between text-white">
              <p className="truncate text-sm font-medium">{lightbox.title}</p>
              <button
                type="button"
                className="os-icon-btn text-white"
                onClick={() => setLightbox(null)}
                aria-label="Cerrar"
              >
                <X size={18} />
              </button>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={lightbox.url}
              alt={lightbox.title}
              className="max-h-[85vh] rounded-xl bg-white object-contain"
            />
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}
