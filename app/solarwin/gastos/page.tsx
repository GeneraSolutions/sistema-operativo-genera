"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  Download,
  Handshake,
  Link2,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import {
  activeEnvios,
  blankEnvio,
  blankGasto,
  buildSolarwinSummary,
  emptySolarwinBundle,
  formatCOP,
  gastosOfEnvio,
  loadSolarwinBundle,
  mergeSolarwinBundle,
  persistSolarwinCloud,
  removeEnvio,
  removeGasto,
  saveSolarwinBundle,
  totalsAll,
  totalsForEnvio,
  upsertEnvio,
  upsertGasto,
  type EnvioTotals,
  type SolarwinBundle,
  type SolarwinEnvio,
  type SolarwinGasto,
} from "@/lib/solarwin";

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

function Stat({
  label,
  value,
  tone,
  hint,
}: {
  label: string;
  value: string;
  tone?: "ok" | "bad" | "muted";
  hint?: string;
}) {
  const color =
    tone === "bad"
      ? "text-[#9b3b2e]"
      : tone === "ok"
        ? "text-[#0f6b45]"
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
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
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
        <label className="text-sm sm:col-span-3">
          Notas (opcional)
          <input
            className={`${field} mt-1`}
            value={draft.notes || ""}
            onChange={(e) => onChange({ ...draft, notes: e.target.value })}
            placeholder="Referencia de transferencia, proyecto, quién lo envió…"
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

function GastoRow({
  gasto,
  onSave,
  onDelete,
}: {
  gasto: SolarwinGasto;
  onSave: (next: SolarwinGasto) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(gasto);

  if (editing) {
    return (
      <li className="rounded-xl border border-[#cfe3d6] bg-[#f4faf6] p-3">
        <div className="grid gap-2 sm:grid-cols-[1fr_9rem_9rem]">
          <input
            className={field}
            list="sw-suggest"
            value={draft.concept}
            onChange={(e) => setDraft({ ...draft, concept: e.target.value })}
            placeholder="Concepto"
          />
          <input
            type="number"
            inputMode="numeric"
            min={0}
            className={field}
            value={draft.amountCOP || ""}
            onChange={(e) =>
              setDraft({ ...draft, amountCOP: Number(e.target.value) || 0 })
            }
          />
          <input
            type="date"
            className={field}
            value={draft.date}
            onChange={(e) => setDraft({ ...draft, date: e.target.value })}
          />
        </div>
        <input
          className={`${field} mt-2`}
          value={draft.notes || ""}
          onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
          placeholder="Nota (opcional)"
        />
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            className="os-btn os-btn-primary text-xs"
            disabled={!draft.concept.trim() || !draft.amountCOP}
            onClick={() => {
              onSave(draft);
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
    <li className="flex items-start justify-between gap-3 rounded-xl border border-[#eee8dc] bg-white px-3 py-2.5">
      <div className="min-w-0">
        <p className="text-sm font-medium text-[#10231a]">{gasto.concept}</p>
        <p className="text-xs text-[#6d7c74]">
          {gasto.date}
          {gasto.notes ? ` · ${gasto.notes}` : ""}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <span className="mr-2 text-sm font-semibold tabular-nums text-[#9b3b2e]">
          − {formatCOP(gasto.amountCOP)}
        </span>
        <button
          type="button"
          className="os-icon-btn"
          title="Editar gasto"
          aria-label="Editar gasto"
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
          title="Eliminar gasto"
          aria-label="Eliminar gasto"
          onClick={onDelete}
        >
          <Trash2 size={14} />
        </button>
      </div>
    </li>
  );
}

function EnvioCard({
  envio,
  bundle,
  expanded,
  onToggle,
  onEdit,
  onDelete,
  onAddGasto,
  onSaveGasto,
  onDeleteGasto,
  onPdf,
  onLink,
  busy,
}: {
  envio: SolarwinEnvio;
  bundle: SolarwinBundle;
  expanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onPdf: () => void;
  onLink: () => void;
  busy: boolean;
  onAddGasto: (g: SolarwinGasto) => void;
  onSaveGasto: (g: SolarwinGasto) => void;
  onDeleteGasto: (id: string) => void;
}) {
  const totals = totalsForEnvio(bundle, envio.id);
  const gastos = gastosOfEnvio(bundle, envio.id);
  const [draft, setDraft] = useState<SolarwinGasto>(() => blankGasto(envio.id));
  const conceptRef = useRef<HTMLInputElement>(null);
  const over = totals.excedeCOP > 0;

  function submit() {
    if (!draft.concept.trim() || !draft.amountCOP) return;
    onAddGasto(draft);
    setDraft({ ...blankGasto(envio.id), date: draft.date });
    conceptRef.current?.focus();
  }

  return (
    <section className="os-panel rounded-2xl border border-[#ddd6c8] bg-white p-5">
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
            <span className="block text-base font-semibold text-[#10231a]">
              {envio.concept || "Envío de Solar win"}
            </span>
            <span className="block text-xs text-[#6d7c74]">
              {envio.date} · {gastos.length}{" "}
              {gastos.length === 1 ? "gasto" : "gastos"}
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
          Gastado {formatCOP(totals.gastadoCOP)} · {totals.usedPercent}% del
          envío
        </p>
      </div>

      {expanded ? (
        <div className="mt-4 space-y-4">
          <div className="rounded-xl border border-dashed border-[#cfd6cc] bg-[#fbfaf6] p-3">
            <p className="text-sm font-semibold">Registrar gasto o compra</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_9rem_9rem]">
              <input
                ref={conceptRef}
                className={field}
                list="sw-suggest"
                value={draft.concept}
                onChange={(e) => setDraft({ ...draft, concept: e.target.value })}
                onKeyDown={(e) => e.key === "Enter" && submit()}
                placeholder="Concepto (ej. Almuerzo cuadrilla)"
              />
              <input
                type="number"
                inputMode="numeric"
                min={0}
                className={field}
                value={draft.amountCOP || ""}
                onChange={(e) =>
                  setDraft({ ...draft, amountCOP: Number(e.target.value) || 0 })
                }
                onKeyDown={(e) => e.key === "Enter" && submit()}
                placeholder="Monto COP"
              />
              <input
                type="date"
                className={field}
                value={draft.date}
                onChange={(e) => setDraft({ ...draft, date: e.target.value })}
              />
            </div>
            <input
              className={`${field} mt-2`}
              value={draft.notes || ""}
              onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder="Nota (opcional)"
            />
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <button
                type="button"
                className="os-btn os-btn-primary"
                disabled={!draft.concept.trim() || !draft.amountCOP}
                onClick={submit}
              >
                <Plus size={16} />
                Agregar gasto
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

          {gastos.length ? (
            <ul className="space-y-2">
              {gastos.map((g) => (
                <GastoRow
                  key={g.id}
                  gasto={g}
                  onSave={onSaveGasto}
                  onDelete={() => onDeleteGasto(g.id)}
                />
              ))}
            </ul>
          ) : (
            <p className="text-sm text-[#6d7c74]">
              Aún no hay gastos en este envío.
            </p>
          )}

          <div className="flex flex-wrap gap-2 border-t border-[#eee8dc] pt-3">
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

  const envios = activeEnvios(bundle);
  const all = totalsAll(bundle);
  const over = all.excedeCOP > 0;

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
        n ? ` y sus ${n} gastos` : ""
      }?`
    );
    if (ok) apply(removeEnvio(bundleRef.current, envio.id));
  }

  /** Publica un corte congelado y devuelve su URL pública. */
  async function publish(envioId?: string): Promise<string> {
    const res = await fetch("/api/solarwin/publicar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bundle: bundleRef.current, envioId }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.id) {
      throw new Error(data.error || "No se pudo generar el documento.");
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
      setFlash("PDF listo · en la ventana elige “Guardar como PDF”.");
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
        setFlash("Enlace copiado. Quien lo abra ve las cuentas a esta fecha.");
      } catch {
        window.prompt("Copia este enlace:", url);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo crear el enlace.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!flash) return;
    const t = window.setTimeout(() => setFlash(null), 5000);
    return () => window.clearTimeout(t);
  }, [flash]);

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
                Suma de todos los envíos menos todos los gastos registrados.
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
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <Stat label="Total enviado" value={formatCOP(all.enviadoCOP)} />
            <Stat
              label="Total gastado"
              value={formatCOP(all.gastadoCOP)}
              hint={`${all.usedPercent}% de lo enviado`}
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
            busy={busy}
            onPdf={() => void sharePdf(envio.id)}
            onLink={() => void shareLink(envio.id)}
            onAddGasto={(g) => apply(upsertGasto(bundleRef.current, g))}
            onSaveGasto={(g) => apply(upsertGasto(bundleRef.current, g))}
            onDeleteGasto={(id) => apply(removeGasto(bundleRef.current, id))}
          />
        ))}
      </div>
    </AppShell>
  );
}
