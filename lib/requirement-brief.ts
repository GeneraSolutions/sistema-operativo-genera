import { matchStationByCity } from "@/lib/ideam-irradiance";
import { QUOTE_PERFORMANCE_RATIO } from "@/lib/quote-engine";
import type { InventoryItem } from "@/types/inventory";

/** Franja nocturna sin medición: la mitad del día, porque el pedido dice que el uso es más de noche. */
const NIGHT_SHARE = 0.5;
/** Litio del inventario: se deja 10% sin usar. Supuesto, no una ficha medida. */
const BATTERY_USABLE = 0.9;

export interface BriefStep {
  title: string;
  body: string;
}

export interface BriefEquipment {
  id: string;
  role: string;
  label: string;
  qty: number;
  detail: string;
}

export interface BriefQuotePreview {
  totalClientCOP: number;
  subtotalCOP: number;
  ivaCOP: number;
  monthlyGenKwh: number;
  annualSavingsCOP: number;
  paybackYears: number;
}

export interface RequirementDraft {
  ok: boolean;
  monthlyKwh: number | null;
  /** Escribió kW al mes. Se lee como energía, que es lo que pide una factura. */
  readKwAsKwh: boolean;
  night: boolean;
  windowLabel: string | null;
  appliances: string[];
  peakSunHours: number;
  cityName: string | null;
  stationName: string | null;
  siteLat: number | null;
  siteLon: number | null;
  /** kWh que la persona ya calculó para la noche. Si viene, no se usa el 50% del día. */
  statedNightKwh: number | null;
  systemKwp: number;
  panelCount: number;
  includeBattery: boolean;
  batteryKwh: number;
  annualNeedKwh: number;
  annualGenKwh: number;
  equipment: BriefEquipment[];
  panelId?: string;
  inverterId?: string;
  batteryId?: string;
  structureId?: string;
  cablingId?: string;
  protectionDcId?: string;
  protectionAcId?: string;
  steps: BriefStep[];
  assumptions: string[];
  gaps: string[];
  /** Lo que la corrección cambió. Vacío si no había nota o no se pudo leer. */
  revisionHeard: string[];
}

const APPLIANCE_RULES: { re: RegExp; label: (match: RegExpMatchArray) => string }[] = [
  { re: /(\d+)\s*bombill\w*(?:\s+led)?/i, label: (m) => `${m[1]} bombillos` },
  { re: /(\d+)\s*neveras?/i, label: (m) => `${m[1]} neveras` },
  { re: /nevera|refrigerador|heladera/i, label: () => "nevera" },
  { re: /c[aá]maras?/i, label: () => "cámaras" },
  { re: /licuadora/i, label: () => "licuadora" },
  { re: /lavadora/i, label: () => "lavadora" },
  { re: /televis|tv\b/i, label: () => "televisor" },
  { re: /microondas/i, label: () => "microondas" },
  { re: /\baire\b|aire acondicionado/i, label: () => "aire acondicionado" },
  { re: /computad|portátil|portatil/i, label: () => "computador" },
  { re: /ducha el[eé]ctrica/i, label: () => "ducha eléctrica" },
  { re: /plancha/i, label: () => "plancha" },
  { re: /estufa/i, label: () => "estufa" },
];

function parseNumber(raw: string): number {
  const t = raw.trim();
  if (/^\d{1,3}(\.\d{3})+$/.test(t)) return Number(t.replace(/\./g, ""));
  return Number(t.replace(",", "."));
}

function active(items: InventoryItem[], category: string): InventoryItem[] {
  return items.filter((item) => item.category === category && item.active !== false);
}

function preferDefault(items: InventoryItem[]): InventoryItem | null {
  return items.find((item) => item.isDefault) ?? items[0] ?? null;
}

function inverterKw(item: InventoryItem): number {
  if (item.category === "inverter" && item.capacity && item.capacity > 0 && item.capacity < 500) {
    return item.capacity;
  }
  const match = `${item.name} ${item.model}`.match(/(\d+(?:[.,]\d+)?)\s*k\s*w/i);
  if (!match) return item.capacity && item.capacity < 500 ? item.capacity : 0;
  return Number(match[1].replace(",", "."));
}

function batteryKwh(item: InventoryItem): number {
  return item.capacity && item.capacity > 0 ? item.capacity : 0;
}

function labelOf(item: InventoryItem): string {
  return `${item.brand} ${item.model || item.name}`.replace(/\s+/g, " ").trim();
}

function pickInverter(items: InventoryItem[], systemKwp: number, house: boolean): InventoryItem | null {
  const pool = active(items, "inverter")
    .map((item) => ({ item, kw: inverterKw(item) }))
    .filter((row) => row.kw > 0);
  const hybrid = pool.filter((row) => /h[ií]brid/i.test(`${row.item.name} ${row.item.model}`));
  const source = house && hybrid.length ? hybrid : pool;
  const covering = source.filter((row) => row.kw + 0.05 >= systemKwp);
  const list = (covering.length ? covering : source).slice().sort((a, b) => a.kw - b.kw);
  return list[0]?.item ?? null;
}

function pickBattery(items: InventoryItem[], neededKwh: number): { item: InventoryItem; count: number } | null {
  const pool = active(items, "battery")
    .map((item) => ({ item, kwh: batteryKwh(item) }))
    .filter((row) => row.kwh > 0);
  if (!pool.length || neededKwh <= 0) return null;
  const ranked = pool
    .map((row) => {
      const count = Math.max(1, Math.ceil(neededKwh / row.kwh));
      const installed = count * row.kwh;
      return { ...row, count, installed, spare: installed - neededKwh };
    })
    .sort((a, b) => a.count - b.count || a.spare - b.spare || Number(b.item.isDefault) - Number(a.item.isDefault));
  const best = ranked[0];
  return best ? { item: best.item, count: best.count } : null;
}

const CITY_SKIP = new Set([
  "esta",
  "este",
  "esto",
  "noche",
  "casa",
  "local",
  "techo",
  "cubierta",
  "inventario",
  "cotizador",
  "borrador",
  "lugar",
  "sistema",
  "factura",
  "consumo",
  "bateria",
  "inversor",
  "paneles",
  "modulos",
]);

interface Revision {
  heard: string[];
  monthlyKwh?: number;
  city?: string;
  dropBattery: boolean;
  nightKwh?: number;
  installedBattery: boolean;
  panels?: number;
  panelDelta?: number;
  kwp?: number;
  inverter?: InventoryItem;
}

function foldText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function pickNamedInverter(items: InventoryItem[], folded: string): InventoryItem | null {
  let best: { item: InventoryItem; score: number } | null = null;
  for (const item of active(items, "inverter")) {
    const brand = foldText(item.brand || "");
    const kw = inverterKw(item);
    let score = 0;
    if (brand.length > 2 && folded.includes(brand)) score += 2;
    if (kw > 0 && new RegExp(`(?:^|\\D)${String(kw).replace(".", "\\.")}\\s*k\\s*w`).test(folded)) {
      score += 3;
    }
    if (score >= 3 && (!best || score > best.score)) best = { item, score };
  }
  return best?.item ?? null;
}

function readRevision(note: string, inventory: InventoryItem[]): Revision {
  const folded = foldText(note);
  const heard: string[] = [];
  const empty: Revision = { heard, dropBattery: false, installedBattery: false };
  if (!folded) return empty;

  const months = [
    ...folded.matchAll(
      /(\d+(?:[.,]\d+)?)\s*(kwh|kw)\s*(?:mensuales|mensual|al mes|por mes|\/\s*mes|mes\b)/g
    ),
  ];
  const lastMonth = months[months.length - 1];
  let monthlyKwh: number | undefined;
  if (lastMonth) {
    const value = parseNumber(lastMonth[1]);
    if (value > 0) {
      monthlyKwh = value;
      heard.push(`consumo de ${value.toLocaleString("es-CO")} kWh al mes`);
    }
  }

  let city: string | undefined;
  const named = [...folded.matchAll(/ciudad de\s+([a-zñ]+)/g)].pop();
  const moved = [...folded.matchAll(/(?:cambiala|ponla|pasala|dejala)\s+(?:a|en)\s+([a-zñ]{4,})/g)].pop();
  const candidate = named?.[1] ?? moved?.[1];
  if (candidate && matchStationByCity(candidate)) city = candidate;
  if (!city) {
    const places = [...folded.matchAll(/\ben\s+([a-zñ]{4,})\b/g)].reverse();
    for (const place of places) {
      if (CITY_SKIP.has(place[1])) continue;
      if (matchStationByCity(place[1])) {
        city = place[1];
        break;
      }
    }
  }
  if (city) heard.push(`ciudad ${city.charAt(0).toUpperCase()}${city.slice(1)}`);

  const dropBattery =
    /sin bateria|quita(?:r|le|la)?(?:\s+la)?\s+bateria|no (?:quiero|lleva|incluye|va)(?:\s+con)?\s+bateria|sin respaldo|sin noche|solo de dia|no es nocturn/.test(
      folded
    );
  if (dropBattery) heard.push("sin batería");

  let nightKwh: number | undefined;
  let installedBattery = false;
  if (!dropBattery) {
    const batteryPhrase = folded.match(
      /bateria(?:\s+\w+){0,4}\s+(\d+(?:[.,]\d+)?)\s*kwh|(\d+(?:[.,]\d+)?)\s*kwh(?:\s+de)?\s+bateria/
    );
    const nightPhrase = folded.match(
      /noche(?:\s+\w+){0,6}\s+(\d+(?:[.,]\d+)?)\s*kwh|(\d+(?:[.,]\d+)?)\s*kwh(?:\s+\w+){0,4}\s+noche/
    );
    if (batteryPhrase) {
      nightKwh = parseNumber(batteryPhrase[1] || batteryPhrase[2]);
      installedBattery = true;
      if (nightKwh > 0) heard.push(`batería de ${nightKwh.toLocaleString("es-CO")} kWh`);
    } else if (nightPhrase) {
      nightKwh = parseNumber(nightPhrase[1] || nightPhrase[2]);
      if (nightKwh > 0) heard.push(`noche de ${nightKwh.toLocaleString("es-CO")} kWh`);
    }
  }

  const panelMatch = folded.match(/(\d+)\s*(?:paneles|modulos)\b/);
  let panels: number | undefined;
  let panelDelta: number | undefined;
  if (panelMatch) {
    panels = Number(panelMatch[1]);
    if (panels > 0) heard.push(`${panels} paneles`);
  } else if (/un panel menos|quita(?:r)? un panel/.test(folded)) {
    panelDelta = -1;
    heard.push("un panel menos");
  } else if (/un panel mas|agrega(?:r)? un panel/.test(folded)) {
    panelDelta = 1;
    heard.push("un panel más");
  }

  const kwpMatch = folded.match(/(\d+(?:[.,]\d+)?)\s*kwp\b/);
  let kwp: number | undefined;
  if (kwpMatch) {
    kwp = parseNumber(kwpMatch[1]);
    if (kwp > 0) heard.push(`${kwp.toLocaleString("es-CO")} kWp`);
  }

  const inverter = pickNamedInverter(inventory, folded);
  if (inverter) heard.push(`inversor ${labelOf(inverter)}`);

  return {
    heard,
    monthlyKwh,
    city,
    dropBattery,
    nightKwh: nightKwh && nightKwh > 0 ? nightKwh : undefined,
    installedBattery,
    panels,
    panelDelta,
    kwp,
    inverter,
  };
}

function nightWindow(text: string): string | null {
  const match = text.match(
    /(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.?\s*m\.?|p\.?\s*m\.?)?\s*(?:a|hasta|-)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.?\s*m\.?|p\.?\s*m\.?)?/i
  );
  if (!match) return null;
  const startMer = match[3] ? ` ${match[3].replace(/\s/g, "")}` : "";
  const endMer = match[6] ? ` ${match[6].replace(/\s/g, "")}` : "";
  return `${match[1]}${match[2] ? `:${match[2]}` : ""}${startMer} a ${match[4]}${match[5] ? `:${match[5]}` : ""}${endMer}`;
}

export function draftRequirement(
  text: string,
  inventory: InventoryItem[],
  peakSunHours: number,
  revision = ""
): RequirementDraft {
  const source = text.replace(/\s+/g, " ").trim();
  const folded = source
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  const gaps: string[] = [];
  const assumptions: string[] = [];
  const appliances = APPLIANCE_RULES.flatMap((rule) => {
    const match = source.match(rule.re);
    return match ? [rule.label(match)] : [];
  }).filter((label, _, all) => !all.some((other) => other !== label && other.includes(label)));

  const energy = folded.match(
    /(\d+(?:[.,]\d+)?)\s*(kwh|kw)\s*(?:mensuales|mensual|al mes|por mes|\/\s*mes|mes\b)/
  );
  const consumed = folded.match(/consum\w*\s+(\d+(?:[.,]\d+)?)\s*(kwh|kw)\b/);
  let monthlyKwh: number | null = null;
  let readKwAsKwh = false;
  const picked = energy ?? consumed;
  if (picked) {
    monthlyKwh = parseNumber(picked[1]);
    readKwAsKwh = picked[2] === "kw";
    if (!Number.isFinite(monthlyKwh) || monthlyKwh <= 0) monthlyKwh = null;
  }
  if (monthlyKwh == null) {
    gaps.push("No leí el consumo del mes. Escríbalo como 600 kWh mes, aunque no diga «al mes».");
  }

  const cityWord = folded.match(/ciudad de\s+([a-zñ]+)/);
  let station = cityWord ? matchStationByCity(cityWord[1]) : null;
  let cityName = cityWord ? cityWord[1].charAt(0).toUpperCase() + cityWord[1].slice(1) : null;
  let hspFromCity = Boolean(station);
  let hsp = station
    ? Math.round((station.annualWh / 1000) * 100) / 100
    : peakSunHours > 0
      ? peakSunHours
      : 4.5;
  if (cityName && !station) {
    assumptions.push(
      `Mencionó ${cityName} y no está en el atlas IDEAM. Las horas de sol siguen siendo las del cotizador.`
    );
  }

  let night = /nocturn|de noche|en la noche|mas de noche|uso nocturno|durante la noche/.test(folded);
  const statedNight = folded.match(
    /calcul\w*[^.]{0,40}?(\d+(?:[.,]\d+)?)\s*kwh\b|unos\s+(\d+(?:[.,]\d+)?)\s*kwh\b/
  );
  let statedNightKwh: number | null = null;
  if (statedNight) {
    const raw = statedNight[1] ?? statedNight[2];
    const value = parseNumber(raw);
    if (Number.isFinite(value) && value > 0 && value !== monthlyKwh) statedNightKwh = value;
  }
  const windowLabel = nightWindow(source);
  const house = /casa|hogar|residenc|apartamento/.test(folded);
  const rev = revision.trim() ? readRevision(revision, inventory) : null;
  let batteryAsInstalled = false;
  if (rev?.heard.length) {
    if (rev.monthlyKwh) {
      monthlyKwh = rev.monthlyKwh;
      readKwAsKwh = false;
    }
    if (rev.city) {
      const next = matchStationByCity(rev.city);
      cityName = rev.city.charAt(0).toUpperCase() + rev.city.slice(1);
      if (next) {
        station = next;
        hspFromCity = true;
        hsp = Math.round((next.annualWh / 1000) * 100) / 100;
      }
    }
    if (rev.dropBattery) {
      night = false;
      statedNightKwh = null;
    } else if (rev.nightKwh) {
      night = true;
      statedNightKwh = rev.nightKwh;
      batteryAsInstalled = rev.installedBattery;
    }
    assumptions.push(`Su corrección: ${rev.heard.join("; ")}.`);
  }

  const annualNeedKwh = monthlyKwh ? monthlyKwh * 12 : 0;
  const divisor = hsp * 365 * QUOTE_PERFORMANCE_RATIO;
  const rawKwp = annualNeedKwh > 0 ? annualNeedKwh / divisor : 0;

  const panel = preferDefault(active(inventory, "panel"));
  const panelWp = panel?.capacity && panel.capacity > 50 ? panel.capacity : 0;
  let panelCount =
    panel && panelWp > 0 && rawKwp > 0 ? Math.max(1, Math.ceil((rawKwp * 1000) / panelWp)) : 0;
  if (rev?.panels) panelCount = rev.panels;
  else if (rev?.panelDelta && panelCount) panelCount = Math.max(1, panelCount + rev.panelDelta);
  else if (rev?.kwp && panelWp > 0) panelCount = Math.max(1, Math.ceil((rev.kwp * 1000) / panelWp));
  const systemKwp = panelCount > 0 ? Math.round((panelCount * panelWp) / 10) / 100 : 0;
  const annualGenKwh =
    systemKwp > 0 ? Math.round(systemKwp * hsp * 365 * QUOTE_PERFORMANCE_RATIO) : 0;

  const inverter =
    rev?.inverter ?? (systemKwp > 0 ? pickInverter(inventory, systemKwp, house || night) : null);
  if (monthlyKwh && !panel) gaps.push("El inventario no tiene un panel activo.");
  if (monthlyKwh && !inverter) gaps.push("El inventario no tiene un inversor que cubra esta potencia.");

  let includeBattery = false;
  let batteryNeed = 0;
  let batteryPick: { item: InventoryItem; count: number } | null = null;
  if (night && (statedNightKwh || monthlyKwh)) {
    includeBattery = true;
    if (statedNightKwh && batteryAsInstalled) {
      batteryNeed = statedNightKwh;
      assumptions.push(
        `La batería quedó en ${statedNightKwh.toLocaleString("es-CO")} kWh porque usted pidió esa capacidad.`
      );
    } else if (statedNightKwh) {
      batteryNeed = statedNightKwh / BATTERY_USABLE;
      assumptions.push(
        `La noche la tomé de su cálculo: ${statedNightKwh.toLocaleString("es-CO")} kWh. No repartí un porcentaje del día. La batería se deja al ${Math.round(BATTERY_USABLE * 100)}% utilizable, así que la capacidad instalada queda un poco por encima.`
      );
    } else if (monthlyKwh) {
      const daily = monthlyKwh / 30;
      batteryNeed = (daily * NIGHT_SHARE) / BATTERY_USABLE;
      assumptions.push(
        `Uso nocturno: tomé el ${Math.round(NIGHT_SHARE * 100)}% del día en esa franja, porque dijo que el uso es más de noche. No es una medición.`
      );
      assumptions.push(
        `La batería se calcula al ${Math.round(BATTERY_USABLE * 100)}% utilizable, para no descargarla por completo.`
      );
    }
    batteryPick = pickBattery(inventory, batteryNeed);
    if (!batteryPick) gaps.push("Pidió noche y el inventario no tiene batería activa.");
  }

  const structure = preferDefault(
    active(inventory, "structure").filter((item) => !item.mountType || item.mountType === "cubierta")
  );
  const cabling = preferDefault(active(inventory, "cabling"));
  const protectionDc = preferDefault(active(inventory, "protection_dc"));
  const protectionAc = preferDefault(active(inventory, "protection_ac"));

  if (readKwAsKwh && monthlyKwh) {
    assumptions.push(
      `Escribió kW al mes. Lo leí como ${monthlyKwh.toLocaleString("es-CO")} kWh al mes, que es la energía de una factura. Si eran ${monthlyKwh.toLocaleString("es-CO")} kW de potencia, no aplique esto.`
    );
  }
  if (appliances.length) {
    assumptions.push(
      `Los equipos de la casa (${appliances.join(", ")}) quedan como contexto. El tamaño sale del consumo mensual, no de sumar nevera y bombillos, porque esa suma no está medida.`
    );
  }
  if (hspFromCity && station && cityName) {
    assumptions.push(
      `Horas de sol: ${hsp.toLocaleString("es-CO")} h, estación ${station.name}. El pedido dice ${cityName}, así que no usé las horas que ya tenía el cotizador. Desempeño ${QUOTE_PERFORMANCE_RATIO}, el mismo de la propuesta.`
    );
  } else {
    assumptions.push(
      `Horas de sol: ${hsp.toLocaleString("es-CO")} h, las que ya tiene el cotizador. Desempeño ${QUOTE_PERFORMANCE_RATIO}, el mismo del motor de la propuesta.`
    );
  }

  const steps: BriefStep[] = [];
  if (cityName && station) {
    steps.push({
      title: "Lugar",
      body: `${cityName} · ${station.name} · ${hsp.toLocaleString("es-CO")} h de sol.`,
    });
  }
  if (monthlyKwh) {
    steps.push({
      title: "Consumo",
      body: `${monthlyKwh.toLocaleString("es-CO")} kWh al mes · ${annualNeedKwh.toLocaleString("es-CO")} kWh al año.`,
    });
    steps.push({
      title: "Potencia",
      body: `${annualNeedKwh.toLocaleString("es-CO")} ÷ (${hsp.toLocaleString("es-CO")} h × 365 × ${QUOTE_PERFORMANCE_RATIO}) = ${rawKwp.toLocaleString("es-CO", { maximumFractionDigits: 2 })} kWp continuos.`,
    });
  }
  if (panel && panelCount) {
    steps.push({
      title: "Paneles del inventario",
      body: `${labelOf(panel)} es de ${panelWp.toLocaleString("es-CO")} W. Hacen falta ${panelCount} módulos: ${systemKwp.toLocaleString("es-CO")} kWp. La generación de referencia queda en ${annualGenKwh.toLocaleString("es-CO")} kWh al año, por encima del pedido, porque el módulo no se parte.`,
    });
  }
  if (inverter) {
    const hybrid = /h[ií]brid/i.test(`${inverter.name} ${inverter.model}`);
    steps.push({
      title: "Inversor",
      body: rev?.inverter
        ? `${labelOf(inverter)} · ${inverterKw(inverter).toLocaleString("es-CO")} kW. Lo dejó usted en la corrección.`
        : `${labelOf(inverter)} · ${inverterKw(inverter).toLocaleString("es-CO")} kW. Es el ${hybrid ? "híbrido" : "inversor"} más cercano del inventario que cubre los ${systemKwp.toLocaleString("es-CO")} kWp.`,
    });
  }
  if (monthlyKwh && annualGenKwh) {
    const perMonth = Math.round(annualGenKwh / 12);
    steps.push({
      title: "Cobertura",
      body:
        perMonth >= monthlyKwh
          ? `La planta da unos ${perMonth.toLocaleString("es-CO")} kWh al mes. La factura es de ${monthlyKwh.toLocaleString("es-CO")} kWh. Queda por encima porque el módulo no se parte.`
          : `La planta da unos ${perMonth.toLocaleString("es-CO")} kWh al mes, por debajo de los ${monthlyKwh.toLocaleString("es-CO")} kWh de la factura.`,
    });
  }
  if (includeBattery && batteryPick) {
    const installed = batteryPick.count * batteryKwh(batteryPick.item);
    const nightLead = statedNightKwh
      ? `Su cálculo de noche es ${statedNightKwh.toLocaleString("es-CO")} kWh. `
      : windowLabel
        ? `Franja ${windowLabel}. `
        : "";
    steps.push({
      title: "Noche",
      body: `${nightLead}Hacen falta unos ${batteryNeed.toLocaleString("es-CO", { maximumFractionDigits: 1 })} kWh utilizables. ${labelOf(batteryPick.item)} trae ${batteryKwh(batteryPick.item).toLocaleString("es-CO")} kWh, así que van ${batteryPick.count} × ${installed.toLocaleString("es-CO")} kWh instalados.`,
    });
  } else if (monthlyKwh) {
    steps.push({
      title: "Noche",
      body: rev?.dropBattery
        ? "Quité la batería porque usted lo pidió. La base queda en autoconsumo."
        : "No pidió respaldo nocturno. La base queda en autoconsumo, sin batería.",
    });
  }

  const equipment: BriefEquipment[] = [];
  if (panel && panelCount) {
    equipment.push({
      id: panel.id,
      role: "Paneles",
      label: labelOf(panel),
      qty: panelCount,
      detail: `${panelWp.toLocaleString("es-CO")} W`,
    });
  }
  if (inverter) {
    equipment.push({
      id: inverter.id,
      role: "Inversor",
      label: labelOf(inverter),
      qty: 1,
      detail: `${inverterKw(inverter).toLocaleString("es-CO")} kW`,
    });
  }
  if (batteryPick) {
    equipment.push({
      id: batteryPick.item.id,
      role: "Batería",
      label: labelOf(batteryPick.item),
      qty: batteryPick.count,
      detail: `${batteryKwh(batteryPick.item).toLocaleString("es-CO")} kWh c/u`,
    });
  }
  if (structure && panelCount) {
    equipment.push({
      id: structure.id,
      role: "Estructura",
      label: labelOf(structure),
      qty: panelCount,
      detail: "Cubierta, predeterminada",
    });
  }
  if (cabling && systemKwp > 0) {
    equipment.push({
      id: cabling.id,
      role: "Cable",
      label: labelOf(cabling),
      qty: Math.ceil(systemKwp * 12),
      detail: "12 m por kWp, como el cotizador",
    });
  }
  if (protectionDc && systemKwp > 0) {
    equipment.push({
      id: protectionDc.id,
      role: "Protección DC",
      label: labelOf(protectionDc),
      qty: Math.max(1, Math.ceil(systemKwp / 50)),
      detail: "Predeterminada",
    });
  }
  if (protectionAc && systemKwp > 0) {
    equipment.push({
      id: protectionAc.id,
      role: "Protección AC",
      label: labelOf(protectionAc),
      qty: Math.max(1, Math.ceil(systemKwp / 50)),
      detail: "Predeterminada",
    });
  }

  return {
    ok: gaps.length === 0 && systemKwp > 0 && Boolean(panel && inverter),
    monthlyKwh,
    readKwAsKwh,
    night,
    windowLabel,
    appliances,
    peakSunHours: hsp,
    cityName,
    stationName: station?.name ?? null,
    siteLat: station?.lat ?? null,
    siteLon: station?.lon ?? null,
    statedNightKwh,
    systemKwp,
    panelCount,
    includeBattery: Boolean(batteryPick),
    batteryKwh: batteryNeed ? Math.round(batteryNeed * 10) / 10 : 0,
    annualNeedKwh,
    annualGenKwh,
    equipment,
    panelId: panel?.id,
    inverterId: inverter?.id,
    batteryId: batteryPick?.item.id,
    structureId: structure?.id,
    cablingId: cabling?.id,
    protectionDcId: protectionDc?.id,
    protectionAcId: protectionAc?.id,
    steps,
    assumptions,
    gaps,
    revisionHeard: rev?.heard ?? [],
  };
}
