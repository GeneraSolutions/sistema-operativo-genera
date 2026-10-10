import type { InventoryItem } from "@/types/inventory";

export const IVA_RATE = 0.19;

export function saleUnitCOP(item: InventoryItem): number {
  const margin = Number.isFinite(item.marginPercent) ? item.marginPercent : 0;
  return Math.round(item.priceCOP * (1 + margin / 100));
}

export function ivaUnitCOP(item: InventoryItem, chargeIva: boolean): number {
  if (!chargeIva || !item.applyIva) return 0;
  return Math.round(saleUnitCOP(item) * IVA_RATE);
}
