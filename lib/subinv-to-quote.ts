import { productKey, type SubInventarioItem } from "@/lib/gastos";
import { loadInventory } from "@/lib/inventory";
import type { QuoteLineInput } from "@/lib/quote-engine";
import {
  ACTIVE_QUOTE_KEY,
  loadSavedQuotes,
  pinActiveQuote,
  quoteDeskPath,
  type SavedQuote,
} from "@/lib/saved-quotes";
import { OPEN_QUOTE_KEY } from "@/lib/saved-visits";

/** Handoff Sub inventario → cotizador (sessionStorage). */
export const PENDING_SUBINV_QUOTE_KEY = "genera:pending-subinv-quote";

/** Margen de venta por defecto si el ítem no está en inventario. */
export const DEFAULT_SUBINV_SALE_MARGIN = 20;

export interface PendingSubinvQuote {
  lines: QuoteLineInput[];
  sourceLabel?: string;
  projectName?: string;
  createdAt: string;
}

function normalizeName(name: string): string {
  return productKey(name);
}

/** Convierte ítems del Sub inventario en líneas de cotización (costo = precio cotizado). */
export function subItemsToQuoteLines(
  items: SubInventarioItem[]
): QuoteLineInput[] {
  const inventory = typeof window !== "undefined" ? loadInventory() : [];
  const byKey = new Map(
    inventory.map((it) => [
      normalizeName(`${it.brand} ${it.model || it.name}`),
      it,
    ])
  );
  const byName = new Map(inventory.map((it) => [normalizeName(it.name), it]));

  return items
    .filter((r) => r.name.trim() && Number(r.qty) > 0)
    .map((r) => {
      const matched =
        byName.get(normalizeName(r.name)) ||
        byKey.get(normalizeName(r.name)) ||
        null;
      return {
        key: `gasto-${r.id}`,
        itemId: matched?.id || "",
        qty: Number(r.qty) > 0 ? Number(r.qty) : 1,
        costUnitCOP: Math.max(0, Math.round(Number(r.unitPriceCOP) || 0)),
        marginPercent:
          matched?.marginPercent ?? DEFAULT_SUBINV_SALE_MARGIN,
        applyIva: matched?.applyIva ?? true,
        label: r.name.trim(),
      } satisfies QuoteLineInput;
    });
}

/** Fusiona líneas entrantes por key (actualiza si ya existían). Respeta cupo máximo. */
export function mergeQuoteLinesWithSub(
  existing: QuoteLineInput[],
  incoming: QuoteLineInput[],
  maxLines?: number
): { lines: QuoteLineInput[]; added: number; updated: number; skipped: number } {
  const result = existing.map((l) => ({ ...l }));
  let added = 0;
  let updated = 0;
  let skipped = 0;
  for (const line of incoming) {
    const idx = result.findIndex((l) => l.key === line.key);
    if (idx >= 0) {
      result[idx] = { ...line };
      updated += 1;
      continue;
    }
    if (maxLines !== undefined && result.length >= maxLines) {
      skipped += 1;
      continue;
    }
    result.push({ ...line });
    added += 1;
  }
  return { lines: result, added, updated, skipped };
}

export function queueSubItemsForQuote(
  items: SubInventarioItem[],
  meta?: { sourceLabel?: string; projectName?: string }
): PendingSubinvQuote {
  const payload: PendingSubinvQuote = {
    lines: subItemsToQuoteLines(items),
    sourceLabel: meta?.sourceLabel,
    projectName: meta?.projectName,
    createdAt: new Date().toISOString(),
  };
  if (typeof window !== "undefined") {
    sessionStorage.setItem(PENDING_SUBINV_QUOTE_KEY, JSON.stringify(payload));
  }
  return payload;
}

export function peekPendingSubinvQuote(): PendingSubinvQuote | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(PENDING_SUBINV_QUOTE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingSubinvQuote;
    if (!parsed?.lines?.length) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearPendingSubinvQuote(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(PENDING_SUBINV_QUOTE_KEY);
}

/** Lee y limpia el handoff pendiente. */
export function consumePendingSubinvQuote(): PendingSubinvQuote | null {
  const pending = peekPendingSubinvQuote();
  if (pending) clearPendingSubinvQuote();
  return pending;
}

/**
 * Encola ítems y abre el cotizador de Solo equipos
 * (mesa natural para materiales de cotizaciones/facturas).
 */
export function sendSubItemsToCotizador(
  items: SubInventarioItem[],
  meta?: { sourceLabel?: string; projectName?: string }
): { ok: boolean; message: string; href?: string } {
  const queued = queueSubItemsForQuote(items, meta);
  if (!queued.lines.length) {
    return {
      ok: false,
      message: "No hay ítems con nombre y unidades para cotizar.",
    };
  }

  const activeId =
    sessionStorage.getItem(OPEN_QUOTE_KEY) ||
    sessionStorage.getItem(ACTIVE_QUOTE_KEY);
  const quotes = loadSavedQuotes();
  const active = activeId
    ? quotes.find((q) => q.id === activeId)
    : undefined;
  const target: SavedQuote | undefined =
    active?.kind === "equipos"
      ? active
      : quotes.find((q) => q.kind === "equipos");

  if (target) {
    pinActiveQuote(target.id);
    sessionStorage.setItem(OPEN_QUOTE_KEY, target.id);
    return {
      ok: true,
      message: `${queued.lines.length} ítem(s) listos en la cotización de equipos.`,
      href: quoteDeskPath(target),
    };
  }

  return {
    ok: true,
    message: `${queued.lines.length} ítem(s) listos para una cotización de equipos.`,
    href: "/cotizador/equipos?desde=subinv",
  };
}
