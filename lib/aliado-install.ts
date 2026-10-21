export interface InstallBand {
  maxKwp: number;
  copPerKwp: number;
  label: string;
}

export type AliadoTripId = "local" | "cercano" | "largo";

export interface AliadoTrip {
  id: AliadoTripId;
  label: string;
  hint: string;
  cop: number;
}

export interface AliadoInstallConfig {
  version: number;
  minBillableKwp: number;
  dailyWageCOP: number;
  arlPerProjectCOP: number;
  toolCopPerKwp: number;
  trips: AliadoTrip[];
  bands: InstallBand[];
  updatedAt?: string;
}

export const INSTALL_CONFIG_VERSION = 2;

export const DEFAULT_INSTALL_BANDS: InstallBand[] = [
  { maxKwp: 10, copPerKwp: 700_000, label: "5–10 kWp" },
  { maxKwp: 20, copPerKwp: 500_000, label: "11–20 kWp" },
  { maxKwp: 50, copPerKwp: 450_000, label: "21–50 kWp" },
  { maxKwp: 5000, copPerKwp: 400_000, label: "Más de 50 kWp" },
];

export const DEFAULT_TRIPS: AliadoTrip[] = [
  {
    id: "local",
    label: "Local",
    hint: "Mismo radio / ciudad",
    cop: 250_000,
  },
  {
    id: "cercano",
    label: "Cercano",
    hint: "Municipio vecino, peaje corto",
    cop: 700_000,
  },
  {
    id: "largo",
    label: "Largo",
    hint: "Otro departamento o varios peajes",
    cop: 1_500_000,
  },
];

export const DEFAULT_ALIADO_INSTALL: AliadoInstallConfig = {
  version: INSTALL_CONFIG_VERSION,
  minBillableKwp: 5,
  dailyWageCOP: 100_000,
  arlPerProjectCOP: 80_000,
  toolCopPerKwp: 50_000,
  trips: DEFAULT_TRIPS,
  bands: DEFAULT_INSTALL_BANDS,
};

function n(value: unknown, fallback: number) {
  const v = Number(value);
  return Number.isFinite(v) ? v : fallback;
}

export function normalizeInstallConfig(
  raw?: Partial<AliadoInstallConfig> | null
): AliadoInstallConfig {
  const legacy =
    !raw?.version ||
    raw.version < INSTALL_CONFIG_VERSION ||
    (raw.bands?.[0]?.copPerKwp ?? 0) >= 1_500_000;

  const bandsSource = legacy
    ? DEFAULT_INSTALL_BANDS
    : raw?.bands?.length
      ? raw.bands
      : DEFAULT_INSTALL_BANDS;

  const bands = bandsSource
    .map((b) => ({
      maxKwp: Math.max(1, Math.round(n(b.maxKwp, 10))),
      copPerKwp: Math.max(0, Math.round(n(b.copPerKwp, 0))),
      label: String(b.label || "").trim() || `${b.maxKwp} kWp`,
    }))
    .sort((a, b) => a.maxKwp - b.maxKwp);

  const trips = DEFAULT_TRIPS.map((d) => {
    const prev = raw?.trips?.find((t) => t.id === d.id);
    return {
      ...d,
      cop: Math.max(0, Math.round(n(prev?.cop, d.cop))),
      label: String(prev?.label || d.label),
      hint: String(prev?.hint || d.hint),
    };
  });

  return {
    version: INSTALL_CONFIG_VERSION,
    minBillableKwp: Math.max(1, Math.round(n(raw?.minBillableKwp, 5))),
    dailyWageCOP: Math.max(0, Math.round(n(raw?.dailyWageCOP, 100_000))),
    arlPerProjectCOP: Math.max(0, Math.round(n(raw?.arlPerProjectCOP, 80_000))),
    toolCopPerKwp: Math.max(0, Math.round(n(raw?.toolCopPerKwp, 50_000))),
    trips,
    bands: bands.length ? bands : DEFAULT_INSTALL_BANDS,
    updatedAt: raw?.updatedAt,
  };
}

export function bandForKwp(
  kwp: number,
  config: AliadoInstallConfig = DEFAULT_ALIADO_INSTALL
): InstallBand | undefined {
  const nKwp = Math.max(0, Number(kwp) || 0);
  const billable = Math.max(nKwp, config.minBillableKwp);
  return (
    config.bands.find((b) => billable <= b.maxKwp) ??
    config.bands[config.bands.length - 1]
  );
}

export function suggestCrew(kwp: number): { technicians: number; days: number } {
  const nKwp = Math.max(0, Number(kwp) || 0);
  if (nKwp <= 10) return { technicians: 2, days: nKwp <= 6 ? 3 : 4 };
  if (nKwp <= 20) return { technicians: 3, days: 5 };
  if (nKwp <= 50) return { technicians: 4, days: 8 };
  return { technicians: 5, days: 12 };
}

export function tripById(
  config: AliadoInstallConfig,
  id?: AliadoTripId | string
): AliadoTrip {
  return config.trips.find((t) => t.id === id) ?? config.trips[0] ?? DEFAULT_TRIPS[0];
}

export interface InstallBreakdown {
  kwp: number;
  billableKwp: number;
  band?: InstallBand;
  laborCOP: number;
  toolsCOP: number;
  tripCOP: number;
  arlCOP: number;
  totalCOP: number;
  trip: AliadoTrip;
  crew: { technicians: number; days: number };
  jornalesCOP: number;
  peopleCostCOP: number;
}

export function suggestInstallBreakdown(
  kwp: number,
  config: AliadoInstallConfig = DEFAULT_ALIADO_INSTALL,
  tripId: AliadoTripId = "local"
): InstallBreakdown {
  const size = Math.max(0, Number(kwp) || 0);
  const billableKwp = Math.max(size, config.minBillableKwp);
  const band = bandForKwp(size, config);
  const laborCOP = Math.round(billableKwp * (band?.copPerKwp ?? 0));
  const toolsCOP = Math.round(size * config.toolCopPerKwp);
  const trip = tripById(config, tripId);
  const tripCOP = trip.cop;
  const arlCOP = config.arlPerProjectCOP;
  const crew = suggestCrew(size);
  const jornalesCOP = crew.technicians * crew.days * config.dailyWageCOP;
  const peopleCostCOP = jornalesCOP + arlCOP;
  return {
    kwp: size,
    billableKwp,
    band,
    laborCOP,
    toolsCOP,
    tripCOP,
    arlCOP,
    totalCOP: laborCOP + toolsCOP + tripCOP + arlCOP,
    trip,
    crew,
    jornalesCOP,
    peopleCostCOP,
  };
}

export function suggestInstallCOP(
  kwp: number,
  config: AliadoInstallConfig = DEFAULT_ALIADO_INSTALL,
  tripId: AliadoTripId = "local"
): number {
  return suggestInstallBreakdown(kwp, config, tripId).totalCOP;
}
