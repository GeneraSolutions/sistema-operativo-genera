import { loadTaxConfig } from "@/lib/colombia-tax";
import { getDatasheetFile } from "@/lib/datasheets";
import { categoryLabel, loadInventory } from "@/lib/inventory";
import type { ObraJob } from "@/lib/obra";
import { obraLabel } from "@/lib/obra";
import {
  calculateParametricQuote,
  type QuoteQuantities,
} from "@/lib/quote-engine";
import {
  loadSavedQuotes,
  resolveQuoteLines,
  type SavedQuote,
} from "@/lib/saved-quotes";
import { getSavedVisit } from "@/lib/saved-visits";
import { GRID_LABELS, ROOF_LABELS } from "@/lib/site-visit";
import type { InventoryItem } from "@/types/inventory";

export const BIZAGI_UPME_URL = "https://automatizacion-upme.bizagi.com/#";

export interface UpmeCheck {
  id: string;
  ok: boolean;
  label: string;
  hint: string;
}

export interface UpmeEquipmentRow {
  itemId: string;
  label: string;
  brand: string;
  model: string;
  qty: number;
  unit: string;
  capacity?: number;
  datasheetUrl?: string;
  localFile?: { name: string; url: string };
}

export interface UpmePack {
  job: ObraJob;
  quote?: SavedQuote;
  equipment: UpmeEquipmentRow[];
  checks: UpmeCheck[];
  readyCount: number;
  missingCount: number;
  annualKwh: number;
  peakSunHours: number;
  saleCOP: number;
  ivaCOP: number;
  rentaBaseCOP: number;
  applyLey1715: boolean;
  lat?: number;
  lon?: number;
  visitBits: { label: string; value: string }[];
  pasteText: string;
}

const EMPTY_QTY: QuoteQuantities = {
  panels: 0,
  inverters: 0,
  batteries: 0,
  structure: 0,
  cabling: 0,
  protectionDc: 0,
  protectionAc: 0,
};

const cop = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

const num = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 1 });

function findItem(items: InventoryItem[], id?: string) {
  if (!id) return null;
  return items.find((i) => i.id === id) ?? null;
}

export async function buildUpmePack(job: ObraJob): Promise<UpmePack> {
  const items = loadInventory();
  const quote = job.quoteId
    ? loadSavedQuotes().find((q) => q.id === job.quoteId)
    : undefined;
  const visit = job.visitId ? getSavedVisit(job.visitId)?.visit : undefined;

  const lines = quote ? resolveQuoteLines(quote) ?? quote.quoteLines ?? [] : [];
  const equipment: UpmeEquipmentRow[] = [];
  const seen = new Set<string>();

  for (const line of lines) {
    if (!line.itemId || seen.has(line.itemId)) continue;
    seen.add(line.itemId);
    const item = findItem(items, line.itemId);
    const local = await getDatasheetFile(line.itemId).catch(() => null);
    equipment.push({
      itemId: line.itemId,
      label:
        line.label ||
        item?.name ||
        categoryLabel(item?.category || line.key),
      brand: item?.brand || "",
      model: item?.model || "",
      qty: line.qty,
      unit: item?.unit || "und",
      capacity: item?.capacity,
      datasheetUrl: item?.datasheetUrl,
      localFile: local ?? undefined,
    });
  }

  let annualKwh = 0;
  let peakSunHours = quote?.peakSunHours || 4.5;
  let saleCOP = 0;
  let ivaCOP = 0;
  const applyLey1715 = quote ? quote.applyLey1715 !== false : false;
  const kwp = Number(job.kwp || quote?.systemKwp || 0);

  if (quote) {
    const selection = {
      panel: findItem(items, quote.equipmentIds.panel),
      inverter: findItem(items, quote.equipmentIds.inverter),
      battery: findItem(items, quote.equipmentIds.battery),
      structure: findItem(items, quote.equipmentIds.structure),
      cabling: findItem(items, quote.equipmentIds.cabling),
      protectionDc: findItem(items, quote.equipmentIds.protectionDc),
      protectionAc: findItem(items, quote.equipmentIds.protectionAc),
    };
    const breakdown = calculateParametricQuote({
      systemKwp: quote.systemKwp,
      peakSunHours: quote.peakSunHours,
      includeBattery: quote.includeBattery,
      batteryKwh: quote.batteryKwh,
      cableMetersPerKwp: 12,
      mount: quote.mount,
      energyTariffCOP: quote.energyTariff,
      selection,
      quantities: quote.qty || EMPTY_QTY,
      quoteLines: lines.length ? lines : undefined,
      inventory: items,
      overheadPercent: quote.overheadPercent ?? quote.softCostPercent ?? 3,
      chargeIva: quote.chargeIva,
      engineeringSaleCOP: quote.engineeringSaleCOP ?? 0,
      engineeringCostCOP: quote.engineeringCostCOP ?? 0,
      technicians: quote.technicians ?? 3,
      dailyWageCOP: quote.dailyWageCOP ?? 90_000,
      laborDays: quote.executionDays,
      laborSaleCOP: quote.laborSaleCOP ?? 0,
      laborMarginPercent: quote.laborMarginPercent ?? 25,
      targetNetProfitCOP: quote.targetNetProfitCOP ?? 0,
      clientWithholds: quote.clientWithholds ?? true,
      clientGranContribuyente: quote.clientGranContribuyente ?? false,
      taxConfig: loadTaxConfig(),
      engAddons: quote.engAddons,
      applyLey1715,
      addonMarginPercent: quote.laborMarginPercent ?? 25,
    });
    annualKwh = breakdown.annualGenerationKWh;
    saleCOP = breakdown.pl.saleNetCOP;
    ivaCOP = breakdown.pl.ivaCOP;
  } else if (kwp > 0) {
    annualKwh = Math.round(kwp * peakSunHours * 365 * 0.8);
  }

  const rentaBaseCOP = applyLey1715 ? Math.round(saleCOP * 0.5) : 0;
  const lat = visit?.lat ?? quote?.siteLat;
  const lon = visit?.lon ?? quote?.siteLon;

  const visitBits = visit
    ? [
        { label: "Sitio", value: visit.location || job.siteName || "—" },
        { label: "Red", value: GRID_LABELS[visit.gridType] },
        { label: "Cubierta", value: ROOF_LABELS[visit.roofType] },
        {
          label: "Área útil",
          value: visit.usefulAreaM2 ? `${visit.usefulAreaM2} m²` : "—",
        },
        {
          label: "Orientación / inclinación",
          value: `${visit.orientation || "—"} · ${visit.tiltDeg}°`,
        },
      ]
    : [];

  const withSheet = equipment.filter((e) => e.datasheetUrl || e.localFile);
  const checks: UpmeCheck[] = [
    {
      id: "quote",
      ok: Boolean(quote),
      label: "Cotización ligada",
      hint: quote
        ? quote.name
        : "Ligue una cotización en la ficha de Obra. De ahí salen kWp, equipos y fichas.",
    },
    {
      id: "equipos",
      ok: equipment.length > 0,
      label: "Lista de bienes (marca / modelo / cantidad)",
      hint:
        equipment.length > 0
          ? `${equipment.length} equipos de la cotización`
          : "Sin líneas de equipo. Abra la cotización, guárdela y vuelva.",
    },
    {
      id: "fichas",
      ok: equipment.length > 0 && withSheet.length === equipment.length,
      label: "Ficha técnica de cada bien",
      hint:
        equipment.length === 0
          ? "Pendiente de equipos."
          : withSheet.length === equipment.length
            ? "Todas las partidas tienen ficha o PDF."
            : `Faltan fichas en ${equipment.length - withSheet.length} partidas. Cárguelas en Inventario.`,
    },
    {
      id: "nit",
      ok: Boolean(job.upmeNit?.trim()),
      label: "NIT o cédula del solicitante (dueño del proyecto)",
      hint: "En Bizagi el usuario SUU suele ser este número, no el de Genera.",
    },
    {
      id: "tipo",
      ok: Boolean(job.upmePersonType),
      label: "Persona natural o jurídica",
      hint: "Define si sube cédula o certificado de existencia.",
    },
    {
      id: "existencia",
      ok: job.upmePersonType === "natural" || Boolean(job.upmeCertExistencia),
      label: "Certificado de existencia / documento de identidad",
      hint: "El PDF se adjunta en Bizagi. Marque aquí cuando ya lo tenga a mano.",
    },
    {
      id: "registro",
      ok: Boolean(job.upmeRegistroGen?.trim()),
      label: "Radicado del registro de generación UPME",
      hint: "Es otro trámite UPME, distinto del certificado de incentivos.",
    },
    {
      id: "tarifa",
      ok: Boolean(job.upmeTarifaPaid),
      label: "Pago de la tarifa UPME",
      hint: "Acredite el pago en Bizagi. Anote la referencia en Obra.",
    },
    {
      id: "ley",
      ok: applyLey1715,
      label: "Proyecto marcado Ley 1715 / 2099",
      hint: applyLey1715
        ? "La cotización aplica incentivos."
        : "Encienda Ley 1715 en el cotizador si el proyecto califica.",
    },
  ];

  const readyCount = checks.filter((c) => c.ok).length;
  const missingCount = checks.length - readyCount;

  const pasteLines = [
    `PROYECTO: ${obraLabel(job)}`,
    `TIPO: FNCE · Solar fotovoltaica · autoconsumo / generación`,
    `NORMA: Ley 1715 de 2014 · Ley 2099 de 2021 · Res. UPME 563 de 2026`,
    `SOLICITANTE: ${job.upmeRepName || job.clientName}`,
    `TIPO PERSONA: ${job.upmePersonType === "juridica" ? "Jurídica" : job.upmePersonType === "natural" ? "Natural" : "—"}`,
    `NIT / CÉDULA: ${job.upmeNit || "—"}`,
    `CORREO: ${job.upmeEmail || "—"}`,
    `TELÉFONO: ${job.upmePhone || "—"}`,
    `DIRECCIÓN: ${job.upmeAddress || visit?.location || job.siteName || "—"}`,
    `MUNICIPIO: ${job.city || quote?.clientCity || "—"}`,
    `CAPACIDAD: ${job.kwp || quote?.systemKwp || "—"} kWp`,
    `GENERACIÓN AÑO 1 (PR 0,8): ${annualKwh ? `${num.format(annualKwh)} kWh/año` : "—"}`,
    `HSP: ${num.format(peakSunHours)} kWh/m²·día`,
    lat != null && lon != null
      ? `COORDENADAS: ${lat}, ${lon}`
      : "COORDENADAS: —",
    `VALOR INVERSIÓN (neto oferta): ${saleCOP ? cop.format(saleCOP) : "—"}`,
    `IVA OFERTA: ${ivaCOP ? cop.format(ivaCOP) : "—"}`,
    applyLey1715
      ? `DEDUCCIÓN RENTA 50% (base): ${rentaBaseCOP ? cop.format(rentaBaseCOP) : "—"}`
      : "DEDUCCIÓN RENTA: no marcada en cotización",
    `RADICADO REGISTRO GENERACIÓN: ${job.upmeRegistroGen || "—"}`,
    `PAGO TARIFA UPME: ${job.upmeTarifaPaid ? `Sí · ${job.upmeTarifaRef || "sin referencia"}` : "Pendiente"}`,
    "",
    "BIENES (marca · modelo · cantidad · ficha):",
    ...equipment.map((e) => {
      const sheet = e.localFile?.name || e.datasheetUrl || "SIN FICHA";
      return `- ${e.label}: ${e.brand} ${e.model} · ${e.qty} ${e.unit}${e.capacity ? ` · ${e.capacity}` : ""} · ${sheet}`;
    }),
  ];

  return {
    job,
    quote,
    equipment,
    checks,
    readyCount,
    missingCount,
    annualKwh,
    peakSunHours,
    saleCOP,
    ivaCOP,
    rentaBaseCOP,
    applyLey1715,
    lat,
    lon,
    visitBits,
    pasteText: pasteLines.join("\n"),
  };
}
