import { IDEAM_STATIONS, type IdeamStation } from "@/lib/ideam-stations";

export const PV_PERFORMANCE_RATIO = 0.8;
export const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
export const MONTH_LABELS = [
  "Ene",
  "Feb",
  "Mar",
  "Abr",
  "May",
  "Jun",
  "Jul",
  "Ago",
  "Sep",
  "Oct",
  "Nov",
  "Dic",
];

function fold(s: string) {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

export function stationById(id?: string) {
  return IDEAM_STATIONS.find((s) => s.id === id) ?? null;
}

export function matchStationByCity(city: string) {
  const q = fold(city).trim();
  if (q.length < 3) return null;
  const scored = IDEAM_STATIONS.map((s) => {
    const n = fold(s.name);
    let score = 0;
    if (n.includes(q)) score = 80 + Math.min(20, q.length);
    else if (q.includes(n.split(" ").pop() || "")) score = 40;
    return { s, score };
  }).filter((x) => x.score > 0);
  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.s ?? null;
}

export function nearestStations(lat: number, lon: number, n = 3) {
  return [...IDEAM_STATIONS]
    .map((s) => ({ s, km: haversineKm(lat, lon, s.lat, s.lon) }))
    .sort((a, b) => a.km - b.km)
    .slice(0, n);
}

export interface IdeamResolve {
  station: IdeamStation;
  neighbors: { station: IdeamStation; km: number }[];
  wh: number[];
  annualWh: number;
  hsp: number;
  distanceKm: number;
  method: "station" | "idw";
  label: string;
}

/** GHI interpolado (inverso de distancia) con las 3 estaciones más cercanas. */
export function resolveIdeamIrradiance(
  lat: number,
  lon: number
): IdeamResolve | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  const near = nearestStations(lat, lon, 3);
  if (!near.length) return null;
  const closest = near[0];
  if (closest.km < 12 || near.length === 1) {
    return {
      station: closest.s,
      neighbors: near.map((x) => ({ station: x.s, km: x.km })),
      wh: closest.s.wh,
      annualWh: closest.s.annualWh,
      hsp: closest.s.annualWh / 1000,
      distanceKm: closest.km,
      method: "station",
      label: closest.s.name,
    };
  }
  const weights = near.map((x) => 1 / Math.max(x.km, 0.5));
  const wSum = weights.reduce((a, b) => a + b, 0);
  const wh = closest.s.wh.map((_, i) =>
    near.reduce((acc, x, idx) => acc + x.s.wh[i] * weights[idx], 0) / wSum
  );
  const annualWh = wh.reduce((a, b) => a + b, 0) / 12;
  return {
    station: closest.s,
    neighbors: near.map((x) => ({ station: x.s, km: x.km })),
    wh: wh.map((v) => Math.round(v * 10) / 10),
    annualWh: Math.round(annualWh * 10) / 10,
    hsp: annualWh / 1000,
    distanceKm: closest.km,
    method: "idw",
    label: `Interpolado · ${closest.s.name}`,
  };
}

export function scaleGhiToHsp(wh: number[], targetHsp: number) {
  const current = wh.reduce((a, b) => a + b, 0) / 12 / 1000;
  if (!current) return wh;
  const f = targetHsp / current;
  return wh.map((v) => Math.round(v * f * 10) / 10);
}

export function monthlyGenerationKWh(
  systemKwp: number,
  monthlyWh: number[],
  pr = PV_PERFORMANCE_RATIO
) {
  return monthlyWh.map((wh, i) =>
    Math.round(systemKwp * (wh / 1000) * DAYS_IN_MONTH[i] * pr)
  );
}

export function annualGenerationFromGhi(
  systemKwp: number,
  monthlyWh: number[],
  pr = PV_PERFORMANCE_RATIO
) {
  return monthlyGenerationKWh(systemKwp, monthlyWh, pr).reduce(
    (a, b) => a + b,
    0
  );
}
