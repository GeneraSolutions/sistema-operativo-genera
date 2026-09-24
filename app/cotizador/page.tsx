"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { CashFlowChart } from "@/components/CashFlowChart";
import { Toggle } from "@/components/Toggle";
import {
  filterByCategory,
  getDefaultsByCategory,
  loadInventory,
} from "@/lib/inventory";
import {
  calculateParametricQuote,
  type MountPreference,
  type QuoteEquipmentSelection,
} from "@/lib/quote-engine";
import {
  ColombiaSolarFinancials,
  type FinancialMetrics,
  type SolarProjectInput,
} from "@/types/financials";
import type { InventoryItem } from "@/types/inventory";

const copFmt = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

const numFmt = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 2 });

export interface ProposalToggles {
  showTir: boolean;
  showRoiPayback: boolean;
  showDeductionLey1715: boolean;
  showIvaAranceles: boolean;
  showDepreciacion: boolean;
  showCharts: boolean;
}

const DEFAULT_TOGGLES: ProposalToggles = {
  showTir: true,
  showRoiPayback: true,
  showDeductionLey1715: true,
  showIvaAranceles: true,
  showDepreciacion: true,
  showCharts: true,
};

function CotizadorInner() {
  const searchParams = useSearchParams();
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [systemKwp, setSystemKwp] = useState(50);
  const [peakSunHours, setPeakSunHours] = useState(4.5);
  const [energyTariff, setEnergyTariff] = useState(850);
  const [includeBattery, setIncludeBattery] = useState(false);
  const [batteryKwh, setBatteryKwh] = useState(20);
  const [mount, setMount] = useState<MountPreference>("cubierta");
  const [softCostPercent, setSoftCostPercent] = useState(18);
  const [marginPercent, setMarginPercent] = useState(15);
  const [selection, setSelection] = useState<QuoteEquipmentSelection>({
    panel: null,
    inverter: null,
    battery: null,
    structure: null,
    cabling: null,
    protectionDc: null,
    protectionAc: null,
  });
  const [toggles, setToggles] = useState<ProposalToggles>(DEFAULT_TOGGLES);
  const [applyLey1715, setApplyLey1715] = useState(true);
  const [clientName, setClientName] = useState("Cliente Corporativo");
  const [linkFlash, setLinkFlash] = useState("");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const items = loadInventory();
    setInventory(items);
    const defaults = getDefaultsByCategory(items);
    const structures = filterByCategory(items, "structure");
    const mountDefault =
      structures.find((s) => s.isDefault && s.mountType === "cubierta") ||
      structures.find((s) => s.isDefault) ||
      structures[0] ||
      null;
    const protections = filterByCategory(items, "protection");
    const dc =
      protections.find((p) => p.id.includes("dc") || p.name.toLowerCase().includes("dc")) ||
      protections[0] ||
      null;
    const ac =
      protections.find((p) => p.id.includes("ac") || p.name.toLowerCase().includes("ac")) ||
      protections[1] ||
      protections[0] ||
      null;

    setSelection({
      panel: defaults.panel ?? null,
      inverter: defaults.inverter ?? null,
      battery: defaults.battery ?? null,
      structure: mountDefault,
      cabling: defaults.cabling ?? null,
      protectionDc: dc,
      protectionAc: ac,
    });

    const kwpParam = searchParams.get("kwp");
    if (kwpParam) {
      const v = Number(kwpParam);
      if (Number.isFinite(v) && v >= 3 && v <= 5000) setSystemKwp(v);
    }
    const tariffParam = searchParams.get("tarifa");
    if (tariffParam) {
      const v = Number(tariffParam);
      if (Number.isFinite(v) && v > 0) setEnergyTariff(v);
    }
    const ley = searchParams.get("ley1715");
    if (ley === "0" || ley === "false") setApplyLey1715(false);
    const client = searchParams.get("cliente");
    if (client) setClientName(client);

    setHydrated(true);
  }, [searchParams]);

  // Sync structure when mount changes
  useEffect(() => {
    if (!hydrated) return;
    const match =
      filterByCategory(inventory, "structure").find(
        (s) => s.mountType === mount && s.isDefault
      ) ||
      filterByCategory(inventory, "structure").find((s) => s.mountType === mount);
    if (match) {
      setSelection((sel) => ({ ...sel, structure: match }));
    }
  }, [mount, inventory, hydrated]);

  const quote = useMemo(
    () =>
      calculateParametricQuote({
        systemKwp,
        peakSunHours,
        includeBattery,
        batteryKwh,
        cableMetersPerKwp: 12,
        mount,
        energyTariffCOP: energyTariff,
        selection,
        softCostPercent,
        marginPercent,
      }),
    [
      systemKwp,
      peakSunHours,
      includeBattery,
      batteryKwh,
      mount,
      energyTariff,
      selection,
      softCostPercent,
      marginPercent,
    ]
  );

  const metrics: FinancialMetrics | null = useMemo(() => {
    if (quote.totalCapexCOP <= 0 || quote.annualGenerationKWh <= 0) return null;
    const input: SolarProjectInput = {
      systemCostCOP: quote.totalCapexCOP,
      annualGenerationKWh: quote.annualGenerationKWh,
      currentEnergyTariffCOP: energyTariff,
      energyTariffInflation: 0.05,
      degradationRate: 0.005,
      omCostAnnualCOP: Math.round(quote.totalCapexCOP * 0.01),
      omInflation: 0.04,
      discountRate: 0.12,
      projectLifespanYears: 25,
      companyTaxRate: 0.35,
      applyTaxDeduction: applyLey1715 && toggles.showDeductionLey1715,
      deductionYears: 5,
      applyAcceleratedDepreciation: applyLey1715 && toggles.showDepreciacion,
      depreciationYears: 5,
    };
    return ColombiaSolarFinancials.calculate(input);
  }, [quote, energyTariff, applyLey1715, toggles]);

  const scaleLabel =
    systemKwp < 10
      ? "Residencial / Pequeño C&I"
      : systemKwp < 100
        ? "Comercial & Industrial"
        : systemKwp < 1000
          ? "Gran C&I / Mini-granja"
          : "Granja Solar";

  function updateToggle<K extends keyof ProposalToggles>(key: K, value: boolean) {
    setToggles((t) => ({ ...t, [key]: value }));
  }

  function handlePdfPro() {
    window.print();
  }

  function handleCommercialLink() {
    const url = new URL(window.location.href);
    url.searchParams.set("kwp", String(systemKwp));
    url.searchParams.set("tarifa", String(energyTariff));
    url.searchParams.set("ley1715", applyLey1715 ? "1" : "0");
    url.searchParams.set("cliente", clientName);
    url.searchParams.set("preview", "1");
    navigator.clipboard?.writeText(url.toString()).then(() => {
      setLinkFlash("Enlace comercial copiado al portapapeles");
      window.setTimeout(() => setLinkFlash(""), 2500);
    });
  }

  const panels = filterByCategory(inventory, "panel");
  const inverters = filterByCategory(inventory, "inverter");
  const batteries = filterByCategory(inventory, "battery");
  const cabling = filterByCategory(inventory, "cabling");
  const structures = filterByCategory(inventory, "structure").filter(
    (s) => !s.mountType || s.mountType === mount
  );
  const protections = filterByCategory(inventory, "protection");

  return (
    <AppShell
      title="Cotizador paramétrico"
      subtitle="3 kWp → 5.000 kWp · Propuesta comercial en segundos"
    >
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold">Motor de cotización ultra-rápido</h2>
          <p className="mt-1 text-sm text-[#4d5c55]">
            Dimensiona CAPEX desde inventario, aplica Ley 1715 y personaliza la
            propuesta con interruptores.{" "}
            <Link href="/inventario" className="font-medium text-[#1f6b45] underline">
              Gestionar catálogo
            </Link>
          </p>
        </div>
        <div className="rounded-xl bg-[#0f2a1f] px-4 py-2 text-right text-white">
          <p className="text-[10px] tracking-[0.2em] text-[#d4b46a] uppercase">
            Escala
          </p>
          <p className="text-sm font-semibold">{scaleLabel}</p>
        </div>
      </div>

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
        {/* LEFT: inputs */}
        <div className="space-y-6">
          <section className="rounded-2xl border border-[#ddd6c8] bg-white p-5">
            <h3 className="text-lg font-semibold">Parámetros del proyecto</h3>
            <div className="mt-4 space-y-4">
              <label className="block">
                <div className="mb-1.5 flex justify-between text-sm">
                  <span className="font-medium">Potencia (kWp)</span>
                  <span className="font-semibold text-[#1f6b45]">
                    {numFmt.format(systemKwp)} kWp
                  </span>
                </div>
                <input
                  type="range"
                  min={3}
                  max={5000}
                  step={systemKwp < 100 ? 1 : systemKwp < 500 ? 5 : 25}
                  value={systemKwp}
                  onChange={(e) => setSystemKwp(Number(e.target.value))}
                  className="w-full accent-[#1f6b45]"
                />
                <div className="mt-1 flex justify-between text-[10px] text-[#8a7f70]">
                  <span>3 kWp</span>
                  <span>5.000 kWp</span>
                </div>
                <input
                  className="mt-2 w-full rounded-xl border border-[#d8d2c4] bg-[#fbfaf6] px-3 py-2 text-sm"
                  type="number"
                  min={3}
                  max={5000}
                  value={systemKwp}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    if (Number.isFinite(v))
                      setSystemKwp(Math.min(5000, Math.max(3, v)));
                  }}
                />
              </label>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-sm">
                  <span className="mb-1 block font-medium">Horas pico sol (HSP)</span>
                  <input
                    type="number"
                    step={0.1}
                    min={2}
                    max={7}
                    className="w-full rounded-xl border border-[#d8d2c4] bg-[#fbfaf6] px-3 py-2.5"
                    value={peakSunHours}
                    onChange={(e) => setPeakSunHours(Number(e.target.value) || 4.5)}
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block font-medium">Tarifa ($/kWh)</span>
                  <input
                    type="number"
                    className="w-full rounded-xl border border-[#d8d2c4] bg-[#fbfaf6] px-3 py-2.5"
                    value={energyTariff}
                    onChange={(e) => setEnergyTariff(Number(e.target.value) || 850)}
                  />
                </label>
              </div>

              <label className="block text-sm">
                <span className="mb-1 block font-medium">Cliente / proyecto</span>
                <input
                  className="w-full rounded-xl border border-[#d8d2c4] bg-[#fbfaf6] px-3 py-2.5"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                />
              </label>

              <fieldset>
                <legend className="mb-2 text-sm font-medium">Montaje</legend>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      ["cubierta", "Cubierta"],
                      ["suelo", "Suelo"],
                      ["pergola", "Pérgola"],
                    ] as const
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setMount(value)}
                      className={`rounded-lg px-2 py-2 text-sm font-semibold ${
                        mount === value
                          ? "bg-[#1f6b45] text-white"
                          : "bg-[#fbfaf6] ring-1 ring-[#d8d2c4]"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </fieldset>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-sm">
                  <span className="mb-1 block font-medium">Soft costs EPC %</span>
                  <input
                    type="number"
                    className="w-full rounded-xl border border-[#d8d2c4] bg-[#fbfaf6] px-3 py-2.5"
                    value={softCostPercent}
                    onChange={(e) => setSoftCostPercent(Number(e.target.value) || 0)}
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block font-medium">Margen %</span>
                  <input
                    type="number"
                    className="w-full rounded-xl border border-[#d8d2c4] bg-[#fbfaf6] px-3 py-2.5"
                    value={marginPercent}
                    onChange={(e) => setMarginPercent(Number(e.target.value) || 0)}
                  />
                </label>
              </div>

              <div className="rounded-xl border border-[#d8d2c4] bg-[#fbfaf6] p-3">
                <label className="flex items-center gap-2 text-sm font-medium">
                  <input
                    type="checkbox"
                    checked={includeBattery}
                    onChange={(e) => setIncludeBattery(e.target.checked)}
                  />
                  Incluir BESS (baterías de litio)
                </label>
                {includeBattery ? (
                  <label className="mt-2 block text-sm">
                    <span className="mb-1 block">Capacidad BESS (kWh)</span>
                    <input
                      type="number"
                      className="w-full rounded-xl border border-[#d8d2c4] bg-white px-3 py-2"
                      value={batteryKwh}
                      onChange={(e) => setBatteryKwh(Number(e.target.value) || 0)}
                    />
                  </label>
                ) : null}
              </div>

              <label className="flex items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={applyLey1715}
                  onChange={(e) => setApplyLey1715(e.target.checked)}
                />
                Proyecto elegible Ley 1715 / 2099
              </label>
            </div>
          </section>

          <section className="rounded-2xl border border-[#ddd6c8] bg-white p-5">
            <h3 className="text-lg font-semibold">Equipos desde inventario</h3>
            <p className="mt-1 text-xs text-[#6d7c74]">
              Selección dinámica · defaults del catálogo precargados
            </p>
            <div className="mt-4 space-y-3">
              <EquipSelect
                label="Panel"
                items={panels}
                value={selection.panel?.id}
                onChange={(id) =>
                  setSelection((s) => ({
                    ...s,
                    panel: panels.find((p) => p.id === id) ?? null,
                  }))
                }
              />
              <EquipSelect
                label="Inversor"
                items={inverters}
                value={selection.inverter?.id}
                onChange={(id) =>
                  setSelection((s) => ({
                    ...s,
                    inverter: inverters.find((p) => p.id === id) ?? null,
                  }))
                }
              />
              {includeBattery ? (
                <EquipSelect
                  label="Batería"
                  items={batteries}
                  value={selection.battery?.id}
                  onChange={(id) =>
                    setSelection((s) => ({
                      ...s,
                      battery: batteries.find((p) => p.id === id) ?? null,
                    }))
                  }
                />
              ) : null}
              <EquipSelect
                label={`Estructura (${mount})`}
                items={structures}
                value={selection.structure?.id}
                onChange={(id) =>
                  setSelection((s) => ({
                    ...s,
                    structure: structures.find((p) => p.id === id) ?? null,
                  }))
                }
              />
              <EquipSelect
                label="Cableado"
                items={cabling}
                value={selection.cabling?.id}
                onChange={(id) =>
                  setSelection((s) => ({
                    ...s,
                    cabling: cabling.find((p) => p.id === id) ?? null,
                  }))
                }
              />
              <EquipSelect
                label="Protección DC"
                items={protections}
                value={selection.protectionDc?.id}
                onChange={(id) =>
                  setSelection((s) => ({
                    ...s,
                    protectionDc: protections.find((p) => p.id === id) ?? null,
                  }))
                }
              />
              <EquipSelect
                label="Protección AC"
                items={protections}
                value={selection.protectionAc?.id}
                onChange={(id) =>
                  setSelection((s) => ({
                    ...s,
                    protectionAc: protections.find((p) => p.id === id) ?? null,
                  }))
                }
              />
            </div>
          </section>

          <section className="rounded-2xl border border-[#ddd6c8] bg-white p-5 print:hidden">
            <h3 className="text-lg font-semibold">Panel de control · Propuesta</h3>
            <p className="mt-1 text-xs text-[#6d7c74]">
              Interruptores ACTIVABLE / DESACTIVABLE para personalizar la vista del cliente
            </p>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <Toggle
                checked={toggles.showTir}
                onChange={(v) => updateToggle("showTir", v)}
                label="Mostrar TIR"
                description="Tasa Interna de Retorno"
              />
              <Toggle
                checked={toggles.showRoiPayback}
                onChange={(v) => updateToggle("showRoiPayback", v)}
                label="Mostrar ROI y Payback"
                description="Retorno y recuperación de inversión"
              />
              <Toggle
                checked={toggles.showDeductionLey1715}
                onChange={(v) => updateToggle("showDeductionLey1715", v)}
                label="Deducción de Renta Ley 1715 (50%)"
                description="Beneficio tributario en renta"
              />
              <Toggle
                checked={toggles.showIvaAranceles}
                onChange={(v) => updateToggle("showIvaAranceles", v)}
                label="Exención de IVA y Aranceles"
                description="Beneficios aduaneros / IVA"
              />
              <Toggle
                checked={toggles.showDepreciacion}
                onChange={(v) => updateToggle("showDepreciacion", v)}
                label="Depreciación Acelerada"
                description="Activos en 5 años"
              />
              <Toggle
                checked={toggles.showCharts}
                onChange={(v) => updateToggle("showCharts", v)}
                label="Gráficos de flujo y ahorro 25 años"
                description="Visualización ejecutiva"
              />
            </div>
          </section>
        </div>

        {/* RIGHT: preview */}
        <div className="space-y-4">
          <section
            id="propuesta-comercial"
            className="overflow-hidden rounded-2xl border border-[#1a3d2e] bg-white shadow-[0_20px_50px_rgba(15,42,31,0.12)]"
          >
            <div className="bg-gradient-to-br from-[#0f2a1f] via-[#163d2c] to-[#0f2a1f] px-6 py-6 text-white">
              <p className="text-[11px] font-semibold tracking-[0.28em] text-[#d4b46a] uppercase">
                Genera Solutions SAS · Propuesta comercial
              </p>
              <h3 className="mt-2 text-2xl font-semibold">{clientName}</h3>
              <p className="mt-1 text-sm text-[#c9d7cf]">
                Sistema {numFmt.format(systemKwp)} kWp · {quote.moduleCount} módulos ·{" "}
                {quote.inverterCount} inversor(es) · Montaje {mount}
              </p>
              <p className="mt-4 text-3xl font-semibold tracking-tight">
                {copFmt.format(quote.totalCapexCOP)}
              </p>
              <p className="text-sm text-[#a8c4b6]">
                CAPEX total · Generación año 1:{" "}
                {numFmt.format(quote.annualGenerationKWh)} kWh
              </p>
            </div>

            <div className="space-y-5 p-6">
              {metrics && toggles.showRoiPayback ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <MetricCard
                    label="ROI 25 años"
                    value={`${numFmt.format(metrics.roiPercentage)}%`}
                  />
                  <MetricCard
                    label="Payback simple"
                    value={`${numFmt.format(metrics.paybackYearsSimple)} años`}
                  />
                </div>
              ) : null}

              {metrics && toggles.showTir ? (
                <MetricCard
                  label="TIR (Tasa Interna de Retorno)"
                  value={`${numFmt.format(metrics.irrPercentage)}%`}
                  emphasize
                />
              ) : null}

              {metrics ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <MetricCard label="VAN @ 12%" value={copFmt.format(metrics.npvCOP)} />
                  {(toggles.showDeductionLey1715 || toggles.showDepreciacion) &&
                  applyLey1715 ? (
                    <MetricCard
                      label="Ahorro fiscal acumulado"
                      value={copFmt.format(metrics.totalTaxSavingsCOP)}
                    />
                  ) : null}
                </div>
              ) : null}

              {(toggles.showDeductionLey1715 ||
                toggles.showIvaAranceles ||
                toggles.showDepreciacion) &&
              applyLey1715 ? (
                <div className="rounded-xl bg-[#f7f4ee] p-4">
                  <p className="text-xs font-semibold tracking-[0.18em] text-[#8a6b2a] uppercase">
                    Beneficios Ley 1715 / 2099
                  </p>
                  <ul className="mt-2 space-y-1.5 text-sm text-[#4d5c55]">
                    {toggles.showDeductionLey1715 ? (
                      <li>✓ Deducción del 50% de la inversión en renta (hasta 5–15 años)</li>
                    ) : null}
                    {toggles.showIvaAranceles ? (
                      <li>✓ Exención de IVA y aranceles en equipos (sujeto a certificación UPME)</li>
                    ) : null}
                    {toggles.showDepreciacion ? (
                      <li>✓ Depreciación acelerada de activos (mín. 3–5 años)</li>
                    ) : null}
                  </ul>
                </div>
              ) : null}

              {toggles.showCharts && metrics ? (
                <CashFlowChart cashFlows={metrics.cashFlows} />
              ) : null}

              <div>
                <p className="text-xs font-semibold tracking-[0.18em] text-[#8a6b2a] uppercase">
                  Desglose de inversión
                </p>
                <ul className="mt-2 divide-y divide-[#eee8dc] text-sm">
                  {quote.lines.map((line) => (
                    <li
                      key={line.key}
                      className="flex items-start justify-between gap-3 py-2"
                    >
                      <span>
                        <span className="font-medium text-[#12241c]">{line.label}</span>
                        <span className="mt-0.5 block text-xs text-[#6d7c74]">
                          {line.qty} {line.unit} × {copFmt.format(line.unitPriceCOP)}
                        </span>
                      </span>
                      <span className="shrink-0 font-medium">
                        {copFmt.format(line.totalCOP)}
                      </span>
                    </li>
                  ))}
                  <li className="flex justify-between py-2 text-[#4d5c55]">
                    <span>Ingeniería / EPC / trámites ({softCostPercent}%)</span>
                    <span>{copFmt.format(quote.softCostCOP)}</span>
                  </li>
                  <li className="flex justify-between py-2 text-[#4d5c55]">
                    <span>Margen comercial ({marginPercent}%)</span>
                    <span>{copFmt.format(quote.marginCOP)}</span>
                  </li>
                </ul>
              </div>
            </div>
          </section>

          <div className="flex flex-wrap gap-3 print:hidden">
            <button
              type="button"
              onClick={handlePdfPro}
              className="flex-1 rounded-xl bg-[#d4b46a] px-4 py-3.5 text-sm font-semibold tracking-wide text-[#12241c] uppercase hover:bg-[#c7a45a]"
            >
              Generar PDF Pro
            </button>
            <button
              type="button"
              onClick={handleCommercialLink}
              className="flex-1 rounded-xl bg-[#0f2a1f] px-4 py-3.5 text-sm font-semibold tracking-wide text-white uppercase hover:bg-[#163d2c]"
            >
              Obtener Enlace Comercial Interactivo
            </button>
          </div>
          {linkFlash ? (
            <p className="text-center text-sm font-medium text-[#1f6b45] print:hidden">
              {linkFlash}
            </p>
          ) : null}

          <p className="text-center text-xs text-[#8a7f70] print:hidden">
            ¿Necesita un unifilar o concepto CREG?{" "}
            <Link href="/inteligencia" className="font-medium text-[#1f6b45] underline">
              Abrir Centro de Inteligencia
            </Link>
          </p>
        </div>
      </div>
    </AppShell>
  );
}

function EquipSelect({
  label,
  items,
  value,
  onChange,
}: {
  label: string;
  items: InventoryItem[];
  value?: string;
  onChange: (id: string) => void;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium">{label}</span>
      <select
        className="w-full rounded-xl border border-[#d8d2c4] bg-[#fbfaf6] px-3 py-2.5"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="" disabled>
          Seleccionar…
        </option>
        {items.map((item) => (
          <option key={item.id} value={item.id}>
            {item.brand} {item.model || item.name}
            {item.isDefault ? " ★" : ""}
          </option>
        ))}
      </select>
    </label>
  );
}

function MetricCard({
  label,
  value,
  emphasize,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
}) {
  return (
    <div
      className={`rounded-xl p-4 ${
        emphasize
          ? "bg-[#0f2a1f] text-white"
          : "bg-[#f7f4ee] ring-1 ring-[#eee8dc]"
      }`}
    >
      <p
        className={`text-[10px] tracking-[0.18em] uppercase ${
          emphasize ? "text-[#d4b46a]" : "text-[#8a6b2a]"
        }`}
      >
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}

export default function CotizadorPage() {
  return (
    <Suspense
      fallback={
        <AppShell title="Cotizador paramétrico" subtitle="Cargando…">
          <p className="text-sm text-[#6d7c74]">Preparando motor de cotización…</p>
        </AppShell>
      }
    >
      <CotizadorInner />
    </Suspense>
  );
}
