import type { MountPreference } from "@/lib/quote-engine";

export type AddonGroup = "engineering" | "site";

export interface AddonDef {
  id: string;
  group: AddonGroup;
  label: string;
  hint: string;
}

export interface AddonState {
  id: string;
  enabled: boolean;
  manual: boolean;
  costCOP: number;
  saleCOP: number;
  extraQty: number;
}

export interface AddonContext {
  systemKwp: number;
  technicians: number;
  days: number;
  dailyWageCOP: number;
  mount: MountPreference;
  applyLey1715: boolean;
  equipmentSaleCOP: number;
  marginPercent: number;
  extraOvertimeDays?: number;
}

export interface ResolvedAddon extends AddonDef {
  enabled: boolean;
  manual: boolean;
  costCOP: number;
  saleCOP: number;
  extraQty: number;
  suggestedCostCOP: number;
}

export const ENG_LABOR_ADDON_DEFS: AddonDef[] = [
  {
    id: "visit",
    group: "engineering",
    label: "Visita técnica y levantamiento",
    hint: "Desplazamiento, mediciones, sombras y acta de sitio.",
  },
  {
    id: "electrical_design",
    group: "engineering",
    label: "Diseño eléctrico (unifilar y memoria)",
    hint: "Cálculo, unifilar, selectividad y memoria de ingeniería.",
  },
  {
    id: "structural",
    group: "engineering",
    label: "Diseño estructural NSR-10",
    hint: "Cargas de cubierta o cimentación. Más crítico en suelo y pérgola.",
  },
  {
    id: "retie",
    group: "engineering",
    label: "Dictamen RETIE / organismo de inspección",
    hint: "Inspección, dictamen y cierre del reglamento técnico.",
  },
  {
    id: "upme",
    group: "engineering",
    label: "Trámite UPME / Ley 1715",
    hint: "Expediente de incentivos y radicación.",
  },
  {
    id: "or_connection",
    group: "engineering",
    label: "Conexión al operador de red",
    hint: "Estudio, medidor bidireccional, visitas y acometida de medida.",
  },
  {
    id: "asbuilt",
    group: "engineering",
    label: "As-built, protocolos y entrega",
    hint: "Planos finales, pruebas, actas y carpeta del cliente.",
  },
  {
    id: "supervisor",
    group: "site",
    label: "Residente / maestro RETIE en obra",
    hint: "Alguien distinto a la cuadrilla de montaje. Un jornal de mando.",
  },
  {
    id: "viaticos",
    group: "site",
    label: "Viáticos de personal",
    hint: "Alimentación, peajes, hotel. Activa si el predio no es local.",
  },
  {
    id: "epp",
    group: "site",
    label: "EPP, trabajo en altura y SST",
    hint: "Arnés, línea de vida, certificados y exámenes por persona.",
  },
  {
    id: "lifting",
    group: "site",
    label: "Izaje, grúa y andamios",
    hint: "Alquiler de equipo de izaje o andamio certificado.",
  },
  {
    id: "civil",
    group: "site",
    label: "Obra civil / techo / zanjas",
    hint: "Bases, refuerzo de cubierta, canaletas o caseta de tableros.",
  },
  {
    id: "bonds",
    group: "site",
    label: "Pólizas (cumplimiento, calidad, RCE)",
    hint: "Sugerido 1.2% de la venta de equipos. Típico en C&I y público.",
  },
  {
    id: "overtime",
    group: "site",
    label: "Recargo jornada extra / domingo",
    hint: "Días extra de obra en horario no hábil. Indica cuántos días.",
  },
  {
    id: "commissioning",
    group: "site",
    label: "Puesta en marcha y capacitación",
    hint: "Energización, app de monitoreo y acta de entrega.",
  },
  {
    id: "om_year1",
    group: "site",
    label: "Mantenimiento preventivo año 1",
    hint: "La propuesta lo incluye; aquí se provisiona la visita.",
  },
];

function clamp(n: number, min: number, max: number) {
  return Math.round(Math.min(max, Math.max(min, n)));
}

export function suggestAddonCost(id: string, ctx: AddonContext): number {
  const kwp = Math.max(0, ctx.systemKwp);
  const tech = Math.max(0, ctx.technicians);
  const days = Math.max(0, ctx.days);
  const daily = Math.max(0, ctx.dailyWageCOP);
  switch (id) {
    case "visit":
      return clamp(400_000 + 12_000 * kwp, 400_000, 2_500_000);
    case "electrical_design":
      return clamp(1_000_000 + 80_000 * kwp, 1_200_000, 18_000_000);
    case "structural":
      return clamp(700_000 + 45_000 * kwp, 700_000, 12_000_000);
    case "retie":
      return clamp(1_600_000 + 30_000 * kwp, 1_600_000, 12_000_000);
    case "upme":
      return clamp(900_000 + 8_000 * kwp, 900_000, 4_000_000);
    case "or_connection":
      return clamp(1_200_000 + 35_000 * kwp, 1_200_000, 10_000_000);
    case "asbuilt":
      return clamp(400_000 + 15_000 * kwp, 400_000, 4_000_000);
    case "supervisor":
      return Math.round(260_000 * Math.max(days, 1));
    case "viaticos":
      return Math.round(120_000 * tech * Math.max(days, 1));
    case "epp":
      return Math.round(280_000 * Math.max(tech, 1));
    case "lifting":
      return clamp(900_000 + 50_000 * kwp, 800_000, 15_000_000);
    case "civil":
      return ctx.mount === "suelo"
        ? clamp(150_000 * kwp, 1_000_000, 40_000_000)
        : clamp(35_000 * kwp, 0, 8_000_000);
    case "bonds":
      return Math.round(Math.max(0, ctx.equipmentSaleCOP) * 0.012);
    case "overtime":
      return Math.round(Math.max(0, ctx.extraOvertimeDays ?? 0) * tech * daily * 2);
    case "commissioning":
      return clamp(tech * daily * 1.6 + 400_000, 600_000, 5_000_000);
    case "om_year1":
      return clamp(600_000 + 20_000 * kwp, 600_000, 8_000_000);
    default:
      return 0;
  }
}

export function defaultEnabledFor(id: string, ctx: AddonContext): boolean {
  switch (id) {
    case "visit":
    case "electrical_design":
    case "retie":
    case "or_connection":
    case "asbuilt":
    case "epp":
    case "commissioning":
    case "om_year1":
      return true;
    case "upme":
      return ctx.applyLey1715;
    case "structural":
      return ctx.mount !== "cubierta";
    case "lifting":
      return ctx.systemKwp >= 12 || ctx.mount === "suelo";
    case "civil":
      return ctx.mount === "suelo";
    default:
      return false;
  }
}

export function saleFromCost(cost: number, marginPercent: number) {
  return Math.round(Math.max(0, cost) * (1 + Math.max(0, marginPercent) / 100));
}

export function marginFromSale(cost: number, saleCOP: number) {
  if (cost <= 0) return 0;
  const margin = ((Math.max(0, saleCOP) / cost) - 1) * 100;
  return Math.round(Math.max(0, margin) * 10) / 10;
}

export function emptyAddonState(): AddonState[] {
  return ENG_LABOR_ADDON_DEFS.map((d) => ({
    id: d.id,
    enabled: false,
    manual: false,
    costCOP: 0,
    saleCOP: 0,
    extraQty: d.id === "overtime" ? 0 : 0,
  }));
}

export function resolveEngLaborAddons(
  state: AddonState[] | undefined,
  ctx: AddonContext
): ResolvedAddon[] {
  const byId = new Map((state ?? []).map((s) => [s.id, s]));
  return ENG_LABOR_ADDON_DEFS.map((def) => {
    const prev = byId.get(def.id);
    const extraQty = prev?.extraQty ?? 0;
    const suggestedCostCOP = suggestAddonCost(def.id, {
      ...ctx,
      extraOvertimeDays: extraQty,
    });
    const enabled = prev?.enabled ?? defaultEnabledFor(def.id, ctx);
    const manual = Boolean(prev?.manual);
    const costCOP = manual
      ? Math.max(0, Math.round(prev?.costCOP ?? suggestedCostCOP))
      : suggestedCostCOP;
    const saleCOP = manual
      ? Math.max(0, Math.round(prev?.saleCOP ?? saleFromCost(costCOP, ctx.marginPercent)))
      : saleFromCost(costCOP, ctx.marginPercent);
    return {
      ...def,
      enabled,
      manual,
      costCOP,
      saleCOP,
      extraQty,
      suggestedCostCOP,
    };
  });
}

export function addonsToState(resolved: ResolvedAddon[]): AddonState[] {
  return resolved.map((a) => ({
    id: a.id,
    enabled: a.enabled,
    manual: a.manual,
    costCOP: a.costCOP,
    saleCOP: a.saleCOP,
    extraQty: a.extraQty,
  }));
}

export function sumEnabledAddons(
  addons: ResolvedAddon[],
  group?: AddonGroup
) {
  return addons
    .filter((a) => a.enabled && (!group || a.group === group))
    .reduce(
      (acc, a) => {
        acc.cost += a.costCOP;
        acc.sale += a.saleCOP;
        return acc;
      },
      { cost: 0, sale: 0 }
    );
}
