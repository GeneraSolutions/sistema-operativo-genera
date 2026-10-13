"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AppShell } from "@/components/AppShell";
import { BrandLogo } from "@/components/BrandLogo";
import { EpcProposalView } from "@/components/proposal/EpcProposalView";
import { Toggle } from "@/components/Toggle";
import {
  categoryLabel,
  filterByCategory,
  getDefaultsByCategory,
  loadCustomCategories,
  loadInventory,
} from "@/lib/inventory";
import {
  addonsToState,
  saleFromCost,
  type AddonState,
} from "@/lib/eng-labor-addons";
import {
  applySuggestedQuantities,
  calculateParametricQuote,
  lineFromItem,
  selectionFromLines,
  suggestQuantities,
  type MountPreference,
  type QuoteLineInput,
  type QuoteEquipmentSelection,
} from "@/lib/quote-engine";
import { IVA_RATE } from "@/lib/pricing";
import { loadKits, type EquipmentKit } from "@/lib/kits";
import {
  matchStationByCity,
  resolveIdeamIrradiance,
  scaleGhiToHsp,
} from "@/lib/ideam-irradiance";
import { IDEAM_STATIONS } from "@/lib/ideam-stations";
import { FINANCED_MONTH_OPTIONS } from "@/lib/payment-schedule";
import { buildEpcProposal } from "@/lib/proposal-builder";
import { saveProposal } from "@/lib/proposal-store";
import {
  clearActiveQuote,
  deleteSavedQuote,
  getStoredQuoteLines,
  idsFromSelection,
  loadSavedQuotes,
  mergeQuotes,
  pinActiveQuote,
  putQuoteLines,
  resolveQuoteLines,
  saveQuoteSnapshot,
  type SavedQuote,
} from "@/lib/saved-quotes";
import { OPEN_QUOTE_KEY } from "@/lib/saved-visits";
import {
  applyVisitToAddons,
  applyVisitToQuoteLines,
  isVisitLockedLineKey,
  loadStoredSiteVisit,
  mountFromRoof,
  saveStoredSiteVisit,
  stripVisitQuoteLines,
  visitHasCoords,
  type SiteVisit,
} from "@/lib/site-visit";
import {
  applyCityPreset,
  DEFAULT_TAX_CONFIG,
  loadTaxConfig,
  saveTaxConfig,
  type ColombiaTaxConfig,
} from "@/lib/colombia-tax";
import type { InventoryItem } from "@/types/inventory";
import type { PaymentKind } from "@/types/proposal";

const numFmt = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 2 });
const copFmt = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

function localISODate(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function compressSiteImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const max = 1400;
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext("2d");
      URL.revokeObjectURL(url);
      if (!ctx) {
        reject(new Error("canvas"));
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", 0.78));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("image"));
    };
    img.src = url;
  });
}

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
  const [overheadPercent, setOverheadPercent] = useState(3);
  const [chargeIva, setChargeIva] = useState(true);
  const [engineeringSaleCOP, setEngineeringSaleCOP] = useState(0);
  const [engineeringCostCOP, setEngineeringCostCOP] = useState(0);
  const [technicians, setTechnicians] = useState(3);
  const [dailyWageCOP, setDailyWageCOP] = useState(90_000);
  const [laborSaleCOP, setLaborSaleCOP] = useState(0);
  const [laborMarginPercent, setLaborMarginPercent] = useState(25);
  const [targetNetProfitCOP, setTargetNetProfitCOP] = useState(0);
  const [clientWithholds, setClientWithholds] = useState(true);
  const [clientGranContribuyente, setClientGranContribuyente] = useState(false);
  const [taxConfig, setTaxConfig] = useState<ColombiaTaxConfig>(DEFAULT_TAX_CONFIG);
  const [quoteLines, setQuoteLines] = useState<QuoteLineInput[]>([]);
  const [engAddons, setEngAddons] = useState<AddonState[] | undefined>(
    undefined
  );
  const addonsFrozen = useRef(false);
  const bootedKey = useRef<string | null>(null);
  const editingQuoteId = useRef<string | undefined>(undefined);
  const qtyLockedRef = useRef(false);
  const [qtyLocked, setQtyLocked] = useState(false);

  function lockQuantities(locked: boolean) {
    qtyLockedRef.current = locked;
    setQtyLocked(locked);
  }

  function suggestionsAllowed() {
    return !qtyLockedRef.current && !editingQuoteId.current;
  }

  function pinQuoteInUrl(id: string) {
    pinActiveQuote(id);
    sessionStorage.removeItem(OPEN_QUOTE_KEY);
    const url = new URL(window.location.href);
    url.searchParams.delete("nueva");
    url.searchParams.set("quote", id);
    window.history.replaceState(null, "", `${url.pathname}${url.search}`);
  }
  const [addItemId, setAddItemId] = useState("");
  const [toggles, setToggles] = useState<ProposalToggles>(DEFAULT_TOGGLES);
  const [applyLey1715, setApplyLey1715] = useState(true);
  const [clientName, setClientName] = useState("Cliente Corporativo");
  const [clientCity, setClientCity] = useState("Bogotá");
  const [monthlyConsumption, setMonthlyConsumption] = useState(800);
  const [executionDays, setExecutionDays] = useState(7);
  const [validUntilDays, setValidUntilDays] = useState(15);
  const [issuedAt, setIssuedAt] = useState(() => localISODate());
  const [siteImageDataUrl, setSiteImageDataUrl] = useState("");
  const [logoHeight, setLogoHeight] = useState(80);
  const [siteLat, setSiteLat] = useState(4.71);
  const [siteLon, setSiteLon] = useState(-74.15);
  const [advancePercent, setAdvancePercent] = useState(70);
  const [paymentKind, setPaymentKind] = useState<PaymentKind>("two_shot");
  const [threeStartPercent, setThreeStartPercent] = useState(40);
  const [threeEquipmentPercent, setThreeEquipmentPercent] = useState(40);
  const [financedPercent, setFinancedPercent] = useState(100);
  const [financedMonths, setFinancedMonths] = useState(36);
  const [financedEaPercent, setFinancedEaPercent] = useState(18);
  const [ppaYears, setPpaYears] = useState(15);
  const [ppaPricePerKWh, setPpaPricePerKWh] = useState(650);
  const [linkFlash, setLinkFlash] = useState("");
  const [saveFlash, setSaveFlash] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [visitLinked, setVisitLinked] = useState(false);
  const [siteVisit, setSiteVisit] = useState<SiteVisit | null>(null);
  const [openFolds, setOpenFolds] = useState({
    params: true,
    equipos: false,
    ingenieria: false,
    impuestos: false,
    pago: false,
    costeo: false,
    propuesta: false,
  });
  const [kits, setKits] = useState<EquipmentKit[]>([]);
  const [savedQuotes, setSavedQuotes] = useState<SavedQuote[]>([]);
  const [customCats, setCustomCats] = useState<
    { id: string; label: string }[]
  >([]);

  const selection = useMemo(
    () => selectionFromLines(quoteLines, inventory),
    [quoteLines, inventory]
  );
  const qty = useMemo(
    () => ({
      panels: quoteLines.find((l) => l.key === "panel")?.qty ?? 0,
      inverters: quoteLines.find((l) => l.key === "inverter")?.qty ?? 0,
      batteries: quoteLines.find((l) => l.key === "battery")?.qty ?? 0,
      structure: quoteLines.find((l) => l.key === "structure")?.qty ?? 0,
      cabling: quoteLines.find((l) => l.key === "cabling")?.qty ?? 0,
      protectionDc: quoteLines.find((l) => l.key === "protection_dc")?.qty ?? 0,
      protectionAc: quoteLines.find((l) => l.key === "protection_ac")?.qty ?? 0,
    }),
    [quoteLines]
  );

  const liveSuggested = useMemo(
    () =>
      suggestQuantities(
        systemKwp,
        selection,
        includeBattery,
        batteryKwh,
        12
      ),
    [systemKwp, selection, includeBattery, batteryKwh]
  );

  useEffect(() => {
    const forceNew = searchParams.get("nueva") === "1";
    if (forceNew) {
      clearActiveQuote();
      sessionStorage.removeItem(OPEN_QUOTE_KEY);
    }
    const openId = forceNew
      ? null
      : searchParams.get("quote") || sessionStorage.getItem(OPEN_QUOTE_KEY);
    const bootKey = openId || (forceNew ? "new" : "new");
    if (bootedKey.current === bootKey) return;
    bootedKey.current = bootKey;

    const items = loadInventory();
    setInventory(items);
    setCustomCats(loadCustomCategories());
    const defaults = getDefaultsByCategory(items);
    const structures = filterByCategory(items, "structure");
    const mountDefault =
      structures.find((s) => s.isDefault && s.mountType === "cubierta") ||
      structures.find((s) => s.isDefault) ||
      structures[0] ||
      null;
    const dc =
      defaults.protection_dc ||
      filterByCategory(items, "protection_dc")[0] ||
      null;
    const ac =
      defaults.protection_ac ||
      filterByCategory(items, "protection_ac")[0] ||
      null;

    const kwpStart = (() => {
      const raw = searchParams.get("kwp");
      const v = raw ? Number(raw) : 50;
      return Number.isFinite(v) && v >= 3 && v <= 5000 ? v : 50;
    })();
    const seedSel = {
      panel: defaults.panel ?? null,
      inverter: defaults.inverter ?? null,
      battery: defaults.battery ?? null,
      structure: mountDefault,
      cabling: defaults.cabling ?? null,
      protectionDc: dc,
      protectionAc: ac,
    };
    const suggested = suggestQuantities(kwpStart, seedSel, false, 20, 12);
    const initial: QuoteLineInput[] = [];
    const push = (key: string, item: InventoryItem | null, n: number) => {
      if (item) initial.push(lineFromItem(key, item, n));
    };
    push("panel", seedSel.panel, suggested.panels);
    push("inverter", seedSel.inverter, suggested.inverters);
    push("structure", seedSel.structure, suggested.structure);
    push("cabling", seedSel.cabling, suggested.cabling);
    push("protection_dc", seedSel.protectionDc, suggested.protectionDc);
    push("protection_ac", seedSel.protectionAc, suggested.protectionAc);

    if (openId) pinActiveQuote(openId);
    const saved = openId
      ? loadSavedQuotes().find((q) => q.id === openId)
      : undefined;

    const kwpParam = searchParams.get("kwp");
    if (kwpParam && !openId) {
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

    setKits(loadKits());
    const localQuotes = loadSavedQuotes();
    for (const q of localQuotes) {
      if (q.quoteLines?.length) putQuoteLines(q.id, q.quoteLines);
    }
    setSavedQuotes(localQuotes);
    setTaxConfig(loadTaxConfig());
    if (saved) {
      loadQuote(saved, items);
    } else if (openId) {
      void fetch("/api/archivo")
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          const q = mergeQuotes(
            loadSavedQuotes(),
            data?.quotes ?? []
          ).find((x) => x.id === openId);
          if (q) {
            try {
              saveQuoteSnapshot(q);
            } catch {
              /* quota */
            }
            loadQuote(q, items);
          } else {
            setQuoteLines(getStoredQuoteLines(openId) ?? initial);
          }
        })
        .catch(() =>
          setQuoteLines(getStoredQuoteLines(openId) ?? initial)
        );
    } else {
      lockQuantities(false);
      setQuoteLines(initial);
      if (searchParams.get("visita") === "1") {
        const stored = loadStoredSiteVisit();
        if (stored?.visit) {
          setQuoteLines(applyVisitToQuoteLines(initial, items, stored.visit));
        }
      }
    }
    setHydrated(true);
  }, [searchParams]);

  useEffect(() => {
    if (!hydrated) return;
    const storedVisit = loadStoredSiteVisit();
    if (!storedVisit) return;
    setSiteVisit(storedVisit.visit);
    if (editingQuoteId.current) return;
    const forceLink =
      searchParams.get("visita") === "1" || storedVisit.linked;
    setVisitLinked(forceLink);
    if (searchParams.get("visita") === "1" && !storedVisit.linked) {
      saveStoredSiteVisit({ visit: storedVisit.visit, linked: true });
    }
    if (forceLink && storedVisit.visit.clientName) {
      setClientName(storedVisit.visit.clientName);
    }
    if (forceLink && storedVisit.visit.location) {
      setClientCity(storedVisit.visit.location);
    }
    if (forceLink && visitHasCoords(storedVisit.visit)) {
      applySiteCoords(storedVisit.visit.lat as number, storedVisit.visit.lon as number);
    }
    if (forceLink) setMount(mountFromRoof(storedVisit.visit.roofType));
  }, [hydrated]);

  useEffect(() => {
    if (!hydrated || addonsFrozen.current) return;
    if (!quote.addons.length) return;
    addonsFrozen.current = true;
    setEngAddons(
      addonsToState(quote.addons).map((a) => ({ ...a, manual: true }))
    );
  }, [hydrated, quote.addons]);

  const irradiance = useMemo(
    () => resolveIdeamIrradiance(siteLat, siteLon),
    [siteLat, siteLon]
  );

  const monthlyGhiWh = useMemo(() => {
    if (!irradiance) return undefined;
    return scaleGhiToHsp(irradiance.wh, peakSunHours);
  }, [irradiance, peakSunHours]);

  function applySiteCoords(lat: number, lon: number) {
    setSiteLat(lat);
    setSiteLon(lon);
    const r = resolveIdeamIrradiance(lat, lon);
    if (r) setPeakSunHours(Math.round(r.hsp * 100) / 100);
  }

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
        quantities: qty,
        quoteLines,
        inventory,
        overheadPercent,
        chargeIva,
        engineeringSaleCOP,
        engineeringCostCOP,
        technicians,
        dailyWageCOP,
        laborDays: executionDays,
        laborSaleCOP,
        laborMarginPercent,
        targetNetProfitCOP,
        clientWithholds,
        clientGranContribuyente,
        taxConfig,
        monthlyGhiWh,
        engAddons,
        applyLey1715,
        addonMarginPercent: laborMarginPercent,
      }),
    [
      systemKwp,
      peakSunHours,
      includeBattery,
      batteryKwh,
      mount,
      energyTariff,
      selection,
      qty,
      quoteLines,
      inventory,
      overheadPercent,
      chargeIva,
      engineeringSaleCOP,
      engineeringCostCOP,
      technicians,
      dailyWageCOP,
      executionDays,
      laborSaleCOP,
      laborMarginPercent,
      targetNetProfitCOP,
      clientWithholds,
      clientGranContribuyente,
      taxConfig,
      monthlyGhiWh,
      engAddons,
      applyLey1715,
    ]
  );

  const liveProposal = useMemo(() => {
    if (!hydrated) return null;
    return buildEpcProposal({
      id: "preview",
      clientName,
      clientCity,
      systemKwp,
      peakSunHours,
      energyTariffCOP: energyTariff,
      monthlyConsumptionKWh: monthlyConsumption,
      includeBattery,
      batteryKwh,
      mount,
      executionDays,
      validUntilDays,
      issuedAt,
      siteImageDataUrl: siteImageDataUrl || undefined,
      logoHeight,
      advancePercent,
      paymentKind,
      twoStartPercent: advancePercent,
      threeStartPercent,
      threeEquipmentPercent,
      financedPercent,
      financedMonths,
      financedEaPercent,
      ppaYears,
      ppaPricePerKWhCOP: ppaPricePerKWh,
      siteLat,
      siteLon,
      monthlyGhiWh,
      ideamStationName: irradiance?.label,
      ideamDistanceKm: irradiance?.distanceKm,
      quote,
      selection,
      toggles,
      applyLey1715,
    });
  }, [
    hydrated,
    clientName,
    clientCity,
    systemKwp,
    peakSunHours,
    energyTariff,
    monthlyConsumption,
    includeBattery,
    batteryKwh,
    mount,
    executionDays,
    validUntilDays,
    issuedAt,
    siteImageDataUrl,
    logoHeight,
    advancePercent,
    paymentKind,
    threeStartPercent,
    threeEquipmentPercent,
    financedPercent,
    financedMonths,
    financedEaPercent,
    ppaYears,
    ppaPricePerKWh,
    siteLat,
    siteLon,
    monthlyGhiWh,
    irradiance,
    quote,
    selection,
    toggles,
    applyLey1715,
  ]);

  useEffect(() => {
    if (liveProposal) saveProposal(liveProposal);
  }, [liveProposal]);

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

  async function handleCommercialLink() {
    if (!liveProposal) return;
    const proposal = { ...liveProposal, id: crypto.randomUUID() };
    saveProposal(proposal);
    try {
      const res = await fetch("/api/propuestas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(proposal),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setLinkFlash(
          data.error ||
            "No se pudo publicar en el servidor. Configure KV en Vercel."
        );
        return;
      }
    } catch {
      setLinkFlash("No hay conexión con el servidor para publicar la cotización.");
      return;
    }
    const url = `${window.location.origin}/propuesta/epc/${proposal.id}`;
    navigator.clipboard?.writeText(url).then(() => {
      setLinkFlash("Enlace comercial copiado · abriendo propuesta…");
      window.setTimeout(() => setLinkFlash(""), 2500);
    });
    window.open(url, "_blank", "noopener,noreferrer");
  }

  function applyKit(kit: EquipmentKit) {
    const find = (id?: string) => inventory.find((i) => i.id === id) ?? null;
    setSystemKwp(kit.systemKwp);
    setPeakSunHours(kit.peakSunHours);
    setIncludeBattery(kit.includeBattery);
    setBatteryKwh(kit.batteryKwh);
    setMount(kit.mount);
    setTechnicians(kit.systemKwp < 10 ? 2 : kit.systemKwp < 50 ? 3 : 4);
    const sel: QuoteEquipmentSelection = {
      panel: find(kit.equipment.panel),
      inverter: find(kit.equipment.inverter),
      battery: find(kit.equipment.battery),
      structure: find(kit.equipment.structure),
      cabling: find(kit.equipment.cabling),
      protectionDc: find(kit.equipment.protectionDc),
      protectionAc: find(kit.equipment.protectionAc),
    };
    const suggested = suggestQuantities(
      kit.systemKwp,
      sel,
      kit.includeBattery,
      kit.batteryKwh,
      12
    );
    const next: QuoteLineInput[] = [];
    const add = (key: string, item: InventoryItem | null, n: number) => {
      if (item) next.push(lineFromItem(key, item, n));
    };
    add("panel", sel.panel, suggested.panels);
    add("inverter", sel.inverter, suggested.inverters);
    add("structure", sel.structure, suggested.structure);
    add("cabling", sel.cabling, suggested.cabling);
    add("protection_dc", sel.protectionDc, suggested.protectionDc);
    add("protection_ac", sel.protectionAc, suggested.protectionAc);
    if (kit.includeBattery) add("battery", sel.battery, suggested.batteries);
    lockQuantities(false);
    setQuoteLines(next);
  }

  function withSuggestedQty(lines: QuoteLineInput[], kwp = systemKwp) {
    const sel = selectionFromLines(lines, inventory);
    const suggested = suggestQuantities(
      kwp,
      sel,
      includeBattery,
      batteryKwh,
      12
    );
    return applySuggestedQuantities(lines, suggested, {
      preserveKeys: visitLinked ? ["cabling"] : [],
    });
  }

  function changeSystemKwp(nextKwp: number) {
    setSystemKwp(nextKwp);
    if (!suggestionsAllowed()) return;
    setQuoteLines((lines) => withSuggestedQty(lines, nextKwp));
  }

  function applySuggestion() {
    setQuoteLines((lines) => withSuggestedQty(lines));
  }

  function snapshotCurrent(name?: string): SavedQuote {
    return {
      id: editingQuoteId.current || crypto.randomUUID(),
      name: name || `${clientName} · ${systemKwp} kWp`,
      savedAt: new Date().toISOString(),
      clientName,
      clientCity,
      systemKwp,
      peakSunHours,
      energyTariff,
      includeBattery,
      batteryKwh,
      mount,
      softCostPercent: overheadPercent,
      overheadPercent,
      engineeringSaleCOP,
      engineeringCostCOP,
      technicians,
      dailyWageCOP,
      laborSaleCOP,
      laborMarginPercent,
      targetNetProfitCOP,
      clientWithholds,
      clientGranContribuyente,
      chargeIva,
      applyLey1715,
      monthlyConsumption,
      executionDays,
      validUntilDays,
      issuedAt,
      siteImageDataUrl,
      logoHeight,
      advancePercent,
      paymentKind,
      twoStartPercent: advancePercent,
      threeStartPercent,
      threeEquipmentPercent,
      financedPercent,
      financedMonths,
      financedEaPercent,
      ppaYears,
      ppaPricePerKWhCOP: ppaPricePerKWh,
      siteLat,
      siteLon,
      equipmentIds: idsFromSelection(selection),
      qty,
      quoteLines: quoteLines.map((l) => ({ ...l })),
      qtyLocked: true,
      engAddons: addonsToState(quote.addons),
      toggles,
    };
  }

  function persistQuote(q: SavedQuote) {
    try {
      editingQuoteId.current = q.id;
      lockQuantities(true);
      const saved = saveQuoteSnapshot({ ...q, qtyLocked: true });
      putQuoteLines(saved.id, saved.quoteLines ?? []);
      pinQuoteInUrl(saved.id);
      setSavedQuotes(loadSavedQuotes());
      setSaveFlash("Cotización guardada. Ábrala en Archivo.");
      void fetch("/api/archivo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quote: saved }),
      });
    } catch {
      setSaveFlash(
        "No se pudo guardar. Quite la foto del sitio e intente de nuevo."
      );
    }
    window.setTimeout(() => setSaveFlash(""), 4500);
  }

  function loadQuote(q: SavedQuote, items?: InventoryItem[]) {
    editingQuoteId.current = q.id;
    addonsFrozen.current = true;
    lockQuantities(true);
    pinQuoteInUrl(q.id);
    const catalog = items ?? inventory;
    const find = (id?: string) => catalog.find((i) => i.id === id) ?? null;
    setClientName(q.clientName);
    setClientCity(q.clientCity);
    setSystemKwp(q.systemKwp);
    setPeakSunHours(q.peakSunHours);
    setEnergyTariff(q.energyTariff);
    setIncludeBattery(q.includeBattery);
    setBatteryKwh(q.batteryKwh);
    setMount(q.mount);
    setOverheadPercent(q.overheadPercent ?? q.softCostPercent ?? 3);
    setEngineeringSaleCOP(q.engineeringSaleCOP ?? 0);
    setEngineeringCostCOP(q.engineeringCostCOP ?? 0);
    setTechnicians(q.technicians ?? 3);
    setDailyWageCOP(q.dailyWageCOP ?? 90_000);
    setLaborSaleCOP(q.laborSaleCOP ?? 0);
    setLaborMarginPercent(q.laborMarginPercent ?? 25);
    setTargetNetProfitCOP(q.targetNetProfitCOP ?? 0);
    setClientWithholds(q.clientWithholds ?? true);
    setClientGranContribuyente(q.clientGranContribuyente ?? false);
    setChargeIva(q.chargeIva);
    setApplyLey1715(q.applyLey1715);
    setMonthlyConsumption(q.monthlyConsumption);
    setExecutionDays(q.executionDays);
    setValidUntilDays(q.validUntilDays ?? 15);
    setIssuedAt(q.issuedAt || localISODate());
    setSiteImageDataUrl(q.siteImageDataUrl ?? "");
    setLogoHeight(q.logoHeight ?? 80);
    setAdvancePercent(q.twoStartPercent ?? q.advancePercent);
    setPaymentKind(q.paymentKind ?? "two_shot");
    setThreeStartPercent(q.threeStartPercent ?? 40);
    setThreeEquipmentPercent(q.threeEquipmentPercent ?? 40);
    setFinancedPercent(q.financedPercent ?? 100);
    setFinancedMonths(q.financedMonths ?? 36);
    setFinancedEaPercent(q.financedEaPercent ?? 18);
    setPpaYears(q.ppaYears ?? 15);
    setPpaPricePerKWh(q.ppaPricePerKWhCOP ?? 650);
    setSiteLat(q.siteLat ?? 4.71);
    setSiteLon(q.siteLon ?? -74.15);
    setToggles(q.toggles);
    const restored = resolveQuoteLines(q);
    if (restored) {
      setQuoteLines(restored);
      putQuoteLines(q.id, restored);
    } else {
      const next: QuoteLineInput[] = [];
      const add = (key: string, id: string | undefined, n: number) => {
        const item = find(id);
        if (item) next.push(lineFromItem(key, item, n));
      };
      add("panel", q.equipmentIds.panel, q.qty.panels);
      add("inverter", q.equipmentIds.inverter, q.qty.inverters);
      add("structure", q.equipmentIds.structure, q.qty.structure);
      add("cabling", q.equipmentIds.cabling, q.qty.cabling);
      add("protection_dc", q.equipmentIds.protectionDc, q.qty.protectionDc);
      add("protection_ac", q.equipmentIds.protectionAc, q.qty.protectionAc);
      if (q.includeBattery) {
        add("battery", q.equipmentIds.battery, q.qty.batteries);
      }
      setQuoteLines(next);
    }
    setEngAddons(q.engAddons);
  }

  function patchAddon(id: string, patch: Partial<AddonState>) {
    setEngAddons(
      addonsToState(
        quote.addons.map((a) => (a.id === id ? { ...a, ...patch } : a))
      )
    );
  }

  const marginRate = quote.pl?.netMarginPercent ?? 0;
  const suggestedEngineering = Math.round(quote.pl.saleEquipmentCOP * 0.12);
  const stockWarnings = quote.lines
    .map((line) => {
      const item = inventory.find(
        (i) =>
          i.stock != null &&
          line.label.includes(i.brand) &&
          line.qty > (i.stock ?? Infinity)
      );
      if (!item || item.stock == null) return null;
      if (line.qty <= item.stock) return null;
      return `${item.name}: pide ${line.qty}, stock ${item.stock} · lead ${item.leadTimeDays ?? "?"} días`;
    })
    .filter(Boolean) as string[];

  const activeInventory = inventory.filter((i) => i.active);

  function toggleVisitLink(next: boolean) {
    setVisitLinked(next);
    const stored = loadStoredSiteVisit();
    if (stored) saveStoredSiteVisit({ visit: stored.visit, linked: next });
    else if (siteVisit) saveStoredSiteVisit({ visit: siteVisit, linked: next });
    const v = stored?.visit ?? siteVisit;
    if (next && v) {
      if (v.clientName) setClientName(v.clientName);
      if (v.location) setClientCity(v.location);
      if (visitHasCoords(v)) applySiteCoords(v.lat as number, v.lon as number);
      setMount(mountFromRoof(v.roofType));
      setQuoteLines((lines) => applyVisitToQuoteLines(lines, inventory, v));
      setEngAddons((prev) => applyVisitToAddons(prev, v));
    } else {
      setQuoteLines((lines) => stripVisitQuoteLines(lines));
    }
  }

  function changeMount(value: MountPreference) {
    setMount(value);
    const match =
      filterByCategory(inventory, "structure").find(
        (s) => s.mountType === value && s.isDefault
      ) ||
      filterByCategory(inventory, "structure").find((s) => s.mountType === value);
    if (!match) return;
    setQuoteLines((lines) =>
      lines.map((l) =>
        l.key === "structure"
          ? {
              ...lineFromItem("structure", match, l.qty),
              costUnitCOP: l.costUnitCOP,
              marginPercent: l.marginPercent,
              applyIva: l.applyIva,
            }
          : l
      )
    );
  }

  function toggleBattery(on: boolean) {
    setIncludeBattery(on);
    setQuoteLines((lines) => {
      const hasBat = lines.some((l) => l.key === "battery");
      if (on && !hasBat) {
        const bat = getDefaultsByCategory(inventory).battery;
        if (!bat) return lines;
        const n = Math.max(
          1,
          Math.ceil(batteryKwh / Math.max(bat.capacity ?? 5, 0.1))
        );
        return [...lines, lineFromItem("battery", bat, n)];
      }
      if (!on && hasBat) return lines.filter((l) => l.key !== "battery");
      return lines;
    });
  }

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
            {" · "}
            <Link href="/visita-tecnica" className="font-medium text-[#1f6b45] underline">
              Visita técnica
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
      <div className="mb-4 flex flex-wrap gap-2 print:hidden">
        {kits.map((kit) => (
          <button
            key={kit.id}
            type="button"
            onClick={() => applyKit(kit)}
            className="rounded-full bg-[#0f2a1f] px-3 py-1.5 text-left text-xs text-white hover:bg-[#163d2c]"
            title={kit.hint}
          >
            <span className="font-semibold">{kit.name}</span>
            <span className="mt-0.5 block text-[10px] text-[#b8e0cc]">{kit.hint}</span>
          </button>
        ))}
        <button
          type="button"
          onClick={() => persistQuote(snapshotCurrent())}
          className="rounded-full bg-[#d4b46a] px-3 py-1.5 text-xs font-semibold text-[#12241c]"
        >
          Guardar cotización
        </button>
        {savedQuotes[0] ? (
          <button
            type="button"
            onClick={() => {
              const copy = snapshotCurrent(`Copia · ${savedQuotes[0].name}`);
              copy.clientName = `${copy.clientName} (copia)`;
              persistQuote(copy);
              loadQuote(copy);
            }}
            className="rounded-full ring-1 ring-[#d8d2c4] px-3 py-1.5 text-xs font-semibold"
          >
            Duplicar última
          </button>
        ) : null}
        <a
          href="/archivo"
          className="rounded-full px-3 py-1.5 text-xs font-semibold text-[#1f6b45] underline"
        >
          Ver archivo
        </a>
      </div>
      {saveFlash ? (
        <p className="mb-3 text-sm text-[#1f6b45] print:hidden">{saveFlash}</p>
      ) : null}
      {marginRate < 12 ? (
        <p className="mb-3 rounded-xl bg-[#fff4e5] px-4 py-2 text-sm text-[#9a5b00] print:hidden">
          Alerta de utilidad neta: {numFmt.format(marginRate)}% sobre venta (objetivo
          ≥ 12% después de ICA y renta). Ajuste márgenes, ingeniería o precio de
          cuadrilla.
        </p>
      ) : null}
      {stockWarnings.length > 0 ? (
        <div className="mb-3 rounded-xl bg-[#fde8e8] px-4 py-2 text-sm text-[#9b2c2c] print:hidden">
          {stockWarnings.map((w) => (
            <p key={w}>{w}</p>
          ))}
        </div>
      ) : null}
      {savedQuotes.length > 0 ? (
        <div className="mb-4 print:hidden">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#8a6b2a]">
            Cotizaciones guardadas ·{" "}
            <a href="/archivo" className="normal-case tracking-normal underline">
              ver todas
            </a>
          </p>
          <div className="mt-1 flex flex-wrap gap-2">
            {savedQuotes.slice(0, 6).map((q) => (
              <span key={q.id} className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-1 text-xs ring-1 ring-[#d8d2c4]">
                <button
                  type="button"
                  onClick={() => {
                    pinActiveQuote(q.id);
                    sessionStorage.setItem(OPEN_QUOTE_KEY, q.id);
                    window.location.assign(
                      `/cotizador?quote=${encodeURIComponent(q.id)}`
                    );
                  }}
                >
                  {q.name}
                </button>
                <button
                  type="button"
                  className="text-[#9b2c2c]"
                  onClick={() => {
                    deleteSavedQuote(q.id);
                    setSavedQuotes(loadSavedQuotes());
                  }}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>
      ) : null}

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
        {/* LEFT: inputs */}
        <div className="space-y-3">
          <QuoteFold
            title="Parámetros del proyecto"
            summary={`${numFmt.format(systemKwp)} kWp · ${clientCity} · vigencia ${validUntilDays} d`}
            open={openFolds.params}
            onToggle={() =>
              setOpenFolds((s) => ({ ...s, params: !s.params }))
            }
          >
            <div className="space-y-4">
              <div
                className={`rounded-2xl border px-3 py-3 ${
                  visitLinked
                    ? "border-[#1f6b45]/40 bg-[#e8f6ee]"
                    : "border-[#d8d2c4] bg-[#fbfaf6]"
                }`}
              >
                <button
                  type="button"
                  role="switch"
                  aria-checked={visitLinked}
                  onClick={() => toggleVisitLink(!visitLinked)}
                  className="flex w-full items-start gap-3 text-left"
                >
                  <span
                    className={`mt-0.5 flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 ${
                      visitLinked ? "bg-[#1f6b45]" : "bg-[#c4bbb0]"
                    }`}
                  >
                    <span
                      className={`h-5 w-5 rounded-full bg-white shadow transition ${
                        visitLinked ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </span>
                  <span>
                    <span className="block text-[10px] font-bold tracking-wider uppercase text-[#1f6b45]">
                      {visitLinked ? "ON" : "OFF"} · Vincular datos de Visita Técnica
                      con la Cotización
                    </span>
                    <span className="mt-0.5 block text-xs text-[#4d5c55]">
                      {visitLinked && siteVisit
                        ? `Campo: ${siteVisit.dcRunM} m DC · ${siteVisit.acRunM} m AC · montaje ${mountFromRoof(siteVisit.roofType)}${
                            visitHasCoords(siteVisit)
                              ? ` · ${siteVisit.lat}, ${siteVisit.lon}`
                              : ""
                          }.`
                        : "OFF usa metros genéricos por kWp. Complete la visita técnica para traer metrado real."}
                    </span>
                  </span>
                </button>
                <Link
                  href="/visita-tecnica"
                  className="mt-2 inline-block text-[11px] font-medium text-[#1f6b45] underline"
                >
                  Abrir formulario de visita
                </Link>
              </div>
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
                  onChange={(e) => changeSystemKwp(Number(e.target.value))}
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
                      changeSystemKwp(Math.min(5000, Math.max(3, v)));
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
                    max={8}
                    className="w-full rounded-xl border border-[#d8d2c4] bg-[#fbfaf6] px-3 py-2.5"
                    value={peakSunHours}
                    onChange={(e) => setPeakSunHours(Number(e.target.value) || 4.5)}
                  />
                  <span className="mt-1 block text-xs text-[#6b6458]">
                    Se carga del Ideam y puedes afinarlo; la curva mensual conserva la
                    forma del atlas.
                  </span>
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

              <div className="rounded-2xl border border-[#e4dfd4] bg-[#f7f4ee] p-3">
                <p className="text-sm font-medium">Radiación IDEAM</p>
                <p className="mt-0.5 text-xs text-[#6b6458]">
                  Atlas de radiación solar de Colombia · GHI Wh/m²·día. Coordenadas del
                  predio para interpolar las estaciones más cercanas.
                </p>
                <label className="mt-2 block text-sm">
                  <span className="mb-1 block font-medium">Estación de referencia</span>
                  <select
                    className="w-full rounded-xl border border-[#d8d2c4] bg-[#fbfaf6] px-3 py-2.5"
                    value={irradiance?.station.id ?? ""}
                    onChange={(e) => {
                      const s = IDEAM_STATIONS.find((x) => x.id === e.target.value);
                      if (!s) return;
                      applySiteCoords(s.lat, s.lon);
                    }}
                  >
                    {IDEAM_STATIONS.slice()
                      .sort((a, b) => a.name.localeCompare(b.name, "es"))
                      .map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                  </select>
                </label>
                <div className="mt-2 grid grid-cols-2 gap-3">
                  <label className="block text-sm">
                    <span className="mb-1 block font-medium">Latitud</span>
                    <input
                      type="number"
                      step={0.0001}
                      className="w-full rounded-xl border border-[#d8d2c4] bg-[#fbfaf6] px-3 py-2.5"
                      value={siteLat}
                      onChange={(e) => setSiteLat(Number(e.target.value))}
                      onBlur={() => applySiteCoords(siteLat, siteLon)}
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="mb-1 block font-medium">Longitud</span>
                    <input
                      type="number"
                      step={0.0001}
                      className="w-full rounded-xl border border-[#d8d2c4] bg-[#fbfaf6] px-3 py-2.5"
                      value={siteLon}
                      onChange={(e) => setSiteLon(Number(e.target.value))}
                      onBlur={() => applySiteCoords(siteLat, siteLon)}
                    />
                  </label>
                </div>
                {irradiance ? (
                  <p className="mt-2 text-xs text-[#6b6458]">
                    {irradiance.method === "idw" ? "Interpolado" : "Estación"} ·{" "}
                    {irradiance.label} · {numFmt.format(irradiance.distanceKm)} km · HSP{" "}
                    {numFmt.format(irradiance.hsp)} kWh/m²·día
                  </p>
                ) : null}
              </div>

              <label className="block text-sm">
                <span className="mb-1 block font-medium">Cliente / proyecto</span>
                <input
                  className="w-full rounded-xl border border-[#d8d2c4] bg-[#fbfaf6] px-3 py-2.5"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-sm">
                  <span className="mb-1 block font-medium">Ciudad</span>
                  <input
                    className="w-full rounded-xl border border-[#d8d2c4] bg-[#fbfaf6] px-3 py-2.5"
                    value={clientCity}
                    onChange={(e) => setClientCity(e.target.value)}
                    onBlur={() => {
                      const match = matchStationByCity(clientCity);
                      if (match) applySiteCoords(match.lat, match.lon);
                    }}
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block font-medium">Consumo (kWh/mes)</span>
                  <input
                    type="number"
                    className="w-full rounded-xl border border-[#d8d2c4] bg-[#fbfaf6] px-3 py-2.5"
                    value={monthlyConsumption}
                    onChange={(e) =>
                      setMonthlyConsumption(Number(e.target.value) || 0)
                    }
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block font-medium">Ejecución (días hábiles)</span>
                  <input
                    type="number"
                    className="w-full rounded-xl border border-[#d8d2c4] bg-[#fbfaf6] px-3 py-2.5"
                    value={executionDays}
                    onChange={(e) => setExecutionDays(Number(e.target.value) || 7)}
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block font-medium">Fecha de envío</span>
                  <input
                    type="date"
                    max={localISODate()}
                    className="w-full rounded-xl border border-[#d8d2c4] bg-[#fbfaf6] px-3 py-2.5"
                    value={issuedAt}
                    onChange={(e) => setIssuedAt(e.target.value || localISODate())}
                  />
                  <span className="mt-1 block text-xs text-[#6b6458]">
                    Por defecto hoy. Puedes elegir una fecha anterior.
                  </span>
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block font-medium">
                    Vigencia de la propuesta ({validUntilDays} días)
                  </span>
                  <input
                    type="range"
                    min={1}
                    max={45}
                    className="w-full accent-[#0f3d2e]"
                    value={validUntilDays}
                    onChange={(e) => setValidUntilDays(Number(e.target.value))}
                  />
                  <input
                    type="number"
                    min={1}
                    max={45}
                    className="mt-2 w-full rounded-xl border border-[#d8d2c4] bg-[#fbfaf6] px-3 py-2.5"
                    value={validUntilDays}
                    onChange={(e) => {
                      const n = Number(e.target.value);
                      setValidUntilDays(
                        Number.isFinite(n) ? Math.min(45, Math.max(1, n)) : 15
                      );
                    }}
                  />
                  <span className="mt-1 block text-xs text-[#6b6458]">
                    De 1 a 45 días calendario.
                  </span>
                </label>
              </div>

              <div className="rounded-2xl border border-[#e4dfd4] bg-[#f7f4ee] p-3">
                <p className="text-sm font-medium">Foto del lugar</p>
                <p className="mt-0.5 text-xs text-[#6b6458]">
                  Casa, finca, empresa o cubierta. Se muestra en la cotización.
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <label className="cursor-pointer rounded-xl bg-[#0f3d2e] px-3 py-2 text-sm font-semibold text-white">
                    Adjuntar imagen
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        e.target.value = "";
                        if (!file) return;
                        try {
                          setSiteImageDataUrl(await compressSiteImage(file));
                        } catch {
                          setSiteImageDataUrl("");
                        }
                      }}
                    />
                  </label>
                  {siteImageDataUrl ? (
                    <button
                      type="button"
                      className="rounded-xl border border-[#d8d2c4] px-3 py-2 text-sm"
                      onClick={() => setSiteImageDataUrl("")}
                    >
                      Quitar foto
                    </button>
                  ) : null}
                </div>
                {siteImageDataUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={siteImageDataUrl}
                    alt="Lugar del proyecto"
                    className="mt-3 max-h-40 w-full rounded-xl object-cover"
                  />
                ) : null}
              </div>

              <div className="rounded-2xl border border-[#e4dfd4] bg-[#f7f4ee] p-3">
                <label className="block text-sm">
                  <span className="mb-1 block font-medium">
                    Tamaño del logo en la cotización ({logoHeight} px)
                  </span>
                  <input
                    type="range"
                    min={48}
                    max={140}
                    className="w-full accent-[#0f3d2e]"
                    value={logoHeight}
                    onChange={(e) => setLogoHeight(Number(e.target.value))}
                  />
                </label>
                <div className="mt-3 flex justify-center rounded-xl bg-[#070b16] p-4">
                  <BrandLogo height={logoHeight} />
                </div>
                <p className="mt-2 text-center text-[11px] tracking-widest text-[#6b6458] uppercase">
                  Cotización EPC · Genera
                </p>
              </div>

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
                      onClick={() => changeMount(value)}
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
                  <span className="mb-1 block font-medium">
                    Gastos de obra / logística %
                  </span>
                  <input
                    type="number"
                    className="w-full rounded-xl border border-[#d8d2c4] bg-[#fbfaf6] px-3 py-2.5"
                    value={overheadPercent}
                    onChange={(e) =>
                      setOverheadPercent(Number(e.target.value) || 0)
                    }
                  />
                  <span className="mt-1 block text-[11px] text-[#6d7c74]">
                    Costo interno (viáticos, grúa, fletes). No se suma como línea
                    extra al cliente.
                  </span>
                </label>
                <label className="flex items-end gap-2 pb-2 text-sm font-medium">
                  <input
                    type="checkbox"
                    checked={chargeIva}
                    onChange={(e) => setChargeIva(e.target.checked)}
                  />
                  Cobrar IVA 19% (interno)
                </label>
              </div>

              <div className="rounded-xl border border-[#d8d2c4] bg-[#fbfaf6] p-3">
                <label className="flex items-center gap-2 text-sm font-medium">
                  <input
                    type="checkbox"
                    checked={includeBattery}
                    onChange={(e) => toggleBattery(e.target.checked)}
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
          </QuoteFold>

          <QuoteFold
            title="Forma de pago"
            summary={
              paymentKind === "two_shot"
                ? `Dos contados · ${advancePercent}/${100 - advancePercent}`
                : paymentKind === "three_shot"
                  ? `Tres contados · ${threeStartPercent}/${threeEquipmentPercent}/${Math.max(0, 100 - threeStartPercent - threeEquipmentPercent)}`
                  : paymentKind === "financed"
                    ? `Financiado ${financedPercent}% · ${financedMonths} meses`
                    : `PPA ${ppaYears} años · $${ppaPricePerKWh}/kWh`
            }
            open={openFolds.pago}
            onToggle={() => setOpenFolds((s) => ({ ...s, pago: !s.pago }))}
          >
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    ["two_shot", "2 contados"],
                    ["three_shot", "3 contados"],
                    ["financed", "Financiado"],
                    ["ppa", "PPA"],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setPaymentKind(value)}
                    className={`rounded-lg px-2 py-2 text-sm font-semibold ${
                      paymentKind === value
                        ? "bg-[#1f6b45] text-white"
                        : "bg-[#fbfaf6] ring-1 ring-[#d8d2c4]"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {paymentKind === "two_shot" ? (
                <label className="block text-sm">
                  <span className="mb-1 block font-medium">
                    Anticipo inicial ({advancePercent}%) · resto {100 - advancePercent}% a
                    la entrega
                  </span>
                  <input
                    type="range"
                    min={10}
                    max={90}
                    className="w-full accent-[#0f3d2e]"
                    value={advancePercent}
                    onChange={(e) => setAdvancePercent(Number(e.target.value))}
                  />
                </label>
              ) : null}

              {paymentKind === "three_shot" ? (
                <>
                  <label className="block text-sm">
                    <span className="mb-1 block font-medium">
                      Anticipo inicial ({threeStartPercent}%)
                    </span>
                    <input
                      type="range"
                      min={10}
                      max={80}
                      className="w-full accent-[#0f3d2e]"
                      value={threeStartPercent}
                      onChange={(e) => {
                        const start = Number(e.target.value);
                        setThreeStartPercent(start);
                        if (start + threeEquipmentPercent > 95) {
                          setThreeEquipmentPercent(Math.max(5, 95 - start));
                        }
                      }}
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="mb-1 block font-medium">
                      Entrega de equipos ({threeEquipmentPercent}%)
                    </span>
                    <input
                      type="range"
                      min={5}
                      max={80}
                      className="w-full accent-[#0f3d2e]"
                      value={threeEquipmentPercent}
                      onChange={(e) => {
                        const equip = Number(e.target.value);
                        const maxEquip = Math.max(5, 95 - threeStartPercent);
                        setThreeEquipmentPercent(Math.min(equip, maxEquip));
                      }}
                    />
                  </label>
                  <p className="text-xs text-[#6b6458]">
                    Entrega del proyecto:{" "}
                    {Math.max(0, 100 - threeStartPercent - threeEquipmentPercent)}%
                  </p>
                </>
              ) : null}

              {paymentKind === "financed" ? (
                <>
                  <label className="block text-sm">
                    <span className="mb-1 block font-medium">
                      Porcentaje financiado ({financedPercent}%)
                    </span>
                    <input
                      type="range"
                      min={20}
                      max={100}
                      step={5}
                      className="w-full accent-[#0f3d2e]"
                      value={financedPercent}
                      onChange={(e) => setFinancedPercent(Number(e.target.value))}
                    />
                    <span className="mt-1 block text-xs text-[#6b6458]">
                      {financedPercent >= 100
                        ? "Se financia el 100%."
                        : `${100 - financedPercent}% de cuota inicial.`}
                    </span>
                  </label>
                  <fieldset>
                    <legend className="mb-2 text-sm font-medium">Plazo</legend>
                    <div className="flex flex-wrap gap-2">
                      {FINANCED_MONTH_OPTIONS.map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setFinancedMonths(m)}
                          className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
                            financedMonths === m
                              ? "bg-[#1f6b45] text-white"
                              : "bg-[#fbfaf6] ring-1 ring-[#d8d2c4]"
                          }`}
                        >
                          {m} meses
                        </button>
                      ))}
                    </div>
                  </fieldset>
                  <label className="block text-sm">
                    <span className="mb-1 block font-medium">
                      Tasa efectiva anual TEA (%)
                    </span>
                    <input
                      type="number"
                      min={0}
                      step={0.1}
                      className="w-full rounded-xl border border-[#d8d2c4] bg-[#fbfaf6] px-3 py-2.5"
                      value={financedEaPercent}
                      onChange={(e) =>
                        setFinancedEaPercent(Number(e.target.value) || 0)
                      }
                    />
                    <span className="mt-1 block text-xs text-[#6b6458]">
                      0 = cuotas sin intereses.
                    </span>
                  </label>
                </>
              ) : null}

              {paymentKind === "ppa" ? (
                <>
                  <label className="block text-sm">
                    <span className="mb-1 block font-medium">
                      Plazo del PPA ({ppaYears} años, máx. 25)
                    </span>
                    <input
                      type="range"
                      min={1}
                      max={25}
                      className="w-full accent-[#0f3d2e]"
                      value={ppaYears}
                      onChange={(e) => setPpaYears(Number(e.target.value))}
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="mb-1 block font-medium">Costo del kWh PPA (COP)</span>
                    <input
                      type="number"
                      min={0}
                      className="w-full rounded-xl border border-[#d8d2c4] bg-[#fbfaf6] px-3 py-2.5"
                      value={ppaPricePerKWh}
                      onChange={(e) =>
                        setPpaPricePerKWh(Number(e.target.value) || 0)
                      }
                    />
                    <span className="mt-1 block text-xs text-[#6b6458]">
                      Tarifa actual del cliente: {copFmt.format(energyTariff)}/kWh. El
                      PPA se calcula con la generación IDEAM.
                    </span>
                  </label>
                </>
              ) : null}
            </div>
          </QuoteFold>

          <QuoteFold
            title="Equipos y cantidades"
            summary={`${qty.panels} paneles · ${qty.inverters} inversor(es)`}
            open={openFolds.equipos}
            onToggle={() =>
              setOpenFolds((s) => ({ ...s, equipos: !s.equipos }))
            }
          >
            <p className="text-xs text-[#6d7c74]">
              Precio base del inventario, con margen e IVA por línea. Puede agregar o
              quitar productos; el cliente no ve este desglose.
            </p>
            <div className="mt-3 rounded-xl border border-[#e4dfd4] bg-white px-3 py-2 text-xs text-[#4d5c55]">
              {qtyLocked ? (
                <>
                  <p>
                    Cantidades fijas: se conservan al guardar y al reabrir. La
                    sugerencia por kWp queda en segundo plano (
                    {liveSuggested.panels} paneles · {liveSuggested.cabling} m
                    cable · {liveSuggested.structure} estructura ·{" "}
                    {liveSuggested.protectionDc} prot. DC ·{" "}
                    {liveSuggested.protectionAc} prot. AC).
                  </p>
                  <button
                    type="button"
                    className="mt-1 font-semibold text-[#1f6b45] underline"
                    onClick={applySuggestion}
                  >
                    Aplicar sugerencia ahora
                  </button>
                </>
              ) : (
                <p>
                  Sugerencia automática según kWp y potencia del panel. En cuanto
                  edite una cantidad o guarde, esa edición queda fija.
                </p>
              )}
            </div>
            <div className="mt-4 space-y-3">
              {quoteLines.map((line) => {
                const item = inventory.find((i) => i.id === line.itemId);
                const options = item
                  ? activeInventory.filter((i) => i.category === item.category)
                  : activeInventory;
                return (
                  <div
                    key={line.key}
                    className="rounded-2xl border border-[#e4dfd4] bg-[#fbfaf6] p-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold tracking-wide text-[#6b6458] uppercase">
                        {item
                          ? categoryLabel(item.category, customCats)
                          : "Equipo"}
                      </p>
                      <button
                        type="button"
                        className="text-xs font-medium text-[#9a3b2f] underline"
                        onClick={() =>
                          setQuoteLines((rows) =>
                            rows.filter((r) => r.key !== line.key)
                          )
                        }
                      >
                        Quitar
                      </button>
                    </div>
                    <label className="mt-2 block text-sm">
                      <span className="mb-1 block font-medium">Producto</span>
                      <select
                        className="w-full rounded-xl border border-[#d8d2c4] bg-white px-3 py-2"
                        value={line.itemId}
                        onChange={(e) => {
                          const next = inventory.find((i) => i.id === e.target.value);
                          if (!next) return;
                          setQuoteLines((rows) => {
                            const mapped = rows.map((r) =>
                              r.key === line.key
                                ? lineFromItem(line.key, next, r.qty)
                                : r
                            );
                            return suggestionsAllowed()
                              ? withSuggestedQty(mapped)
                              : mapped;
                          });
                        }}
                      >
                        {options.map((opt) => (
                          <option key={opt.id} value={opt.id}>
                            {opt.brand} {opt.model || opt.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                      <label className="block text-sm">
                        <span className="mb-1 block font-medium">
                          Cant. ({item?.unit || "und"})
                        </span>
                        <input
                          type="number"
                          min={0}
                          className="w-full rounded-xl border border-[#d8d2c4] bg-white px-2 py-2"
                          value={line.qty}
                          onChange={(e) => {
                            const n = Math.max(0, Number(e.target.value) || 0);
                            lockQuantities(true);
                            setQuoteLines((rows) =>
                              rows.map((r) =>
                                r.key === line.key ? { ...r, qty: n } : r
                              )
                            );
                          }}
                        />
                      </label>
                      <label className="block text-sm">
                        <span className="mb-1 block font-medium">Costo COP</span>
                        <input
                          type="number"
                          min={0}
                          className="w-full rounded-xl border border-[#d8d2c4] bg-white px-2 py-2"
                          value={line.costUnitCOP}
                          onChange={(e) => {
                            const n = Math.max(0, Number(e.target.value) || 0);
                            setQuoteLines((rows) =>
                              rows.map((r) =>
                                r.key === line.key ? { ...r, costUnitCOP: n } : r
                              )
                            );
                          }}
                        />
                        {item && item.priceCOP !== line.costUnitCOP ? (
                          <button
                            type="button"
                            className="mt-1 text-[11px] text-[#1f6b45] underline"
                            onClick={() =>
                              setQuoteLines((rows) =>
                                rows.map((r) =>
                                  r.key === line.key
                                    ? { ...r, costUnitCOP: item.priceCOP }
                                    : r
                                )
                              )
                            }
                          >
                            Base {copFmt.format(item.priceCOP)}
                          </button>
                        ) : (
                          <span className="mt-1 block text-[11px] text-[#6b6458]">
                            Precio inventario
                          </span>
                        )}
                      </label>
                      <label className="block text-sm">
                        <span className="mb-1 block font-medium">Ganancia %</span>
                        <input
                          type="number"
                          min={0}
                          step={0.1}
                          className="w-full rounded-xl border border-[#d8d2c4] bg-white px-2 py-2"
                          value={line.marginPercent}
                          onChange={(e) => {
                            const n = Math.max(0, Number(e.target.value) || 0);
                            setQuoteLines((rows) =>
                              rows.map((r) =>
                                r.key === line.key ? { ...r, marginPercent: n } : r
                              )
                            );
                          }}
                        />
                      </label>
                      <label className="flex items-end gap-2 pb-2 text-sm font-medium">
                        <input
                          type="checkbox"
                          checked={line.applyIva}
                          onChange={(e) =>
                            setQuoteLines((rows) =>
                              rows.map((r) =>
                                r.key === line.key
                                  ? { ...r, applyIva: e.target.checked }
                                  : r
                              )
                            )
                          }
                        />
                        IVA 19%
                      </label>
                    </div>
                  </div>
                );
              })}
              <div className="flex flex-wrap items-end gap-2 rounded-2xl border border-dashed border-[#d8d2c4] p-3">
                <label className="min-w-[220px] flex-1 text-sm">
                  <span className="mb-1 block font-medium">Agregar del inventario</span>
                  <select
                    className="w-full rounded-xl border border-[#d8d2c4] bg-white px-3 py-2"
                    value={addItemId}
                    onChange={(e) => setAddItemId(e.target.value)}
                  >
                    <option value="">Seleccionar producto…</option>
                    {activeInventory.map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {categoryLabel(opt.category, customCats)} · {opt.brand}{" "}
                        {opt.model || opt.name}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  className="rounded-xl bg-[#0f3d2e] px-4 py-2 text-sm font-semibold text-white"
                  onClick={() => {
                    const item = inventory.find((i) => i.id === addItemId);
                    if (!item) return;
                    setQuoteLines((rows) => [
                      ...rows,
                      lineFromItem(`extra-${item.id}-${Date.now()}`, item, 1),
                    ]);
                    setAddItemId("");
                  }}
                >
                  Agregar producto
                </button>
              </div>
            </div>
          </QuoteFold>

          <QuoteFold
            title="Ingeniería y cuadrilla"
            summary={`${quote.addons.filter((a) => a.enabled).length} partidas · ${technicians} técnicos`}
            open={openFolds.ingenieria}
            onToggle={() =>
              setOpenFolds((s) => ({ ...s, ingenieria: !s.ingenieria }))
            }
          >
            <p className="text-xs text-[#6d7c74]">
              Prende o apaga cada partida. El valor se sugiere por kWp, personas o
              días; puedes editarlo. El cliente ve el total, no este desglose.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="mb-1 block font-medium">Técnicos en obra</span>
                <input
                  type="number"
                  min={0}
                  className="w-full rounded-xl border border-[#d8d2c4] bg-[#fbfaf6] px-3 py-2.5"
                  value={technicians}
                  onChange={(e) =>
                    setTechnicians(Math.max(0, Number(e.target.value) || 0))
                  }
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium">Jornal diario bruto (COP)</span>
                <input
                  type="number"
                  className="w-full rounded-xl border border-[#d8d2c4] bg-[#fbfaf6] px-3 py-2.5"
                  value={dailyWageCOP}
                  onChange={(e) =>
                    setDailyWageCOP(Math.max(0, Number(e.target.value) || 0))
                  }
                />
                <span className="mt-1 block text-[11px] text-[#6d7c74]">
                  Días = ejecución ({executionDays}). Costo cargado ×{" "}
                  {numFmt.format(quote.labor.factor)}.
                </span>
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium">
                  % ganancia servicios
                </span>
                <input
                  type="number"
                  className="w-full rounded-xl border border-[#d8d2c4] bg-[#fbfaf6] px-3 py-2.5"
                  value={laborMarginPercent}
                  onChange={(e) =>
                    setLaborMarginPercent(Number(e.target.value) || 0)
                  }
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium">
                  Venta cuadrilla al cliente (0 = auto)
                </span>
                <input
                  type="number"
                  className="w-full rounded-xl border border-[#d8d2c4] bg-[#fbfaf6] px-3 py-2.5"
                  value={laborSaleCOP}
                  onChange={(e) =>
                    setLaborSaleCOP(Math.max(0, Number(e.target.value) || 0))
                  }
                />
              </label>
            </div>
            <div className="mt-3 rounded-xl bg-[#fbfaf6] px-3 py-2 text-xs text-[#4d5c55]">
              <p>
                Salario: {copFmt.format(quote.labor.salaryBaseCOP)} · Prestaciones:{" "}
                {copFmt.format(quote.labor.prestacionesCOP)} · Aportes (pensión,
                caja, ARL
                {taxConfig.applyExoneracion114 ? "" : ", salud, SENA, ICBF"}):{" "}
                {copFmt.format(quote.labor.aportesCOP)}
                {quote.labor.auxilioCOP > 0
                  ? ` · Auxilio transporte: ${copFmt.format(quote.labor.auxilioCOP)}`
                  : ""}
              </p>
              <p className="mt-1 font-medium">
                Costo real cuadrilla: {copFmt.format(quote.labor.costCOP)} · Se
                cobra: {copFmt.format(quote.labor.saleCOP)}
              </p>
            </div>

            {(
              [
                ["engineering", "Ingeniería y trámites"],
                ["site", "Obra, SST y extras"],
              ] as const
            ).map(([group, heading]) => (
              <div key={group} className="mt-5">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[#1f6b45]">
                  {heading}
                </p>
                <div className="mt-2 space-y-2">
                  {quote.addons
                    .filter((a) => a.group === group)
                    .map((a) => (
                      <div
                        key={a.id}
                        className={`rounded-xl border px-3 py-2.5 ${
                          a.enabled
                            ? "border-[#1f6b45]/35 bg-white"
                            : "border-[#d8d2c4] bg-[#fbfaf6] opacity-75"
                        }`}
                      >
                        <label className="flex items-start gap-2">
                          <input
                            type="checkbox"
                            className="mt-1"
                            checked={a.enabled}
                            onChange={() =>
                              patchAddon(a.id, { enabled: !a.enabled })
                            }
                          />
                          <span className="min-w-0">
                            <span className="block text-sm font-semibold text-[#12241c]">
                              {a.label}
                            </span>
                            <span className="block text-[11px] text-[#6d7c74]">
                              {a.hint}
                              {a.manual ? " · editado" : ""}
                            </span>
                          </span>
                        </label>
                        {a.id === "overtime" ? (
                          <label className="mt-2 block text-[11px] font-medium">
                            Días extra
                            <input
                              type="number"
                              min={0}
                              className="mt-1 w-full rounded-lg border border-[#d8d2c4] bg-white px-2 py-1.5 text-sm"
                              value={a.extraQty}
                              onChange={(e) =>
                                patchAddon(a.id, {
                                  extraQty: Math.max(
                                    0,
                                    Number(e.target.value) || 0
                                  ),
                                  manual: false,
                                })
                              }
                            />
                          </label>
                        ) : null}
                        {a.enabled ? (
                          <div className="mt-2 grid grid-cols-2 gap-2">
                            <label className="text-[11px] font-medium">
                              Costo
                              <input
                                type="number"
                                className="mt-1 w-full rounded-lg border border-[#d8d2c4] bg-white px-2 py-1.5 text-sm"
                                value={a.costCOP}
                                onChange={(e) => {
                                  const cost = Math.max(
                                    0,
                                    Number(e.target.value) || 0
                                  );
                                  patchAddon(a.id, {
                                    manual: true,
                                    costCOP: cost,
                                    saleCOP: saleFromCost(
                                      cost,
                                      laborMarginPercent
                                    ),
                                  });
                                }}
                              />
                            </label>
                            <label className="text-[11px] font-medium">
                              Venta
                              <input
                                type="number"
                                className="mt-1 w-full rounded-lg border border-[#d8d2c4] bg-white px-2 py-1.5 text-sm"
                                value={a.saleCOP}
                                onChange={(e) =>
                                  patchAddon(a.id, {
                                    manual: true,
                                    costCOP: a.costCOP,
                                    saleCOP: Math.max(
                                      0,
                                      Number(e.target.value) || 0
                                    ),
                                  })
                                }
                              />
                            </label>
                          </div>
                        ) : null}
                        {a.enabled && a.manual ? (
                          <button
                            type="button"
                            className="mt-1 text-[11px] font-medium text-[#1f6b45] underline"
                            onClick={() =>
                              patchAddon(a.id, { manual: false })
                            }
                          >
                            Volver al sugerido{" "}
                            {copFmt.format(a.suggestedCostCOP)}
                          </button>
                        ) : null}
                      </div>
                    ))}
                </div>
              </div>
            ))}

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="mb-1 block font-medium">
                  Ajuste ingeniería venta (COP)
                </span>
                <input
                  type="number"
                  className="w-full rounded-xl border border-[#d8d2c4] bg-[#fbfaf6] px-3 py-2.5"
                  value={engineeringSaleCOP}
                  onChange={(e) =>
                    setEngineeringSaleCOP(Math.max(0, Number(e.target.value) || 0))
                  }
                />
                <button
                  type="button"
                  className="mt-1 text-[11px] font-medium text-[#1f6b45] underline"
                  onClick={() => setEngineeringSaleCOP(suggestedEngineering)}
                >
                  12% equipos {copFmt.format(suggestedEngineering)}
                </button>
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium">
                  Ajuste ingeniería costo (COP)
                </span>
                <input
                  type="number"
                  className="w-full rounded-xl border border-[#d8d2c4] bg-[#fbfaf6] px-3 py-2.5"
                  value={engineeringCostCOP}
                  onChange={(e) =>
                    setEngineeringCostCOP(Math.max(0, Number(e.target.value) || 0))
                  }
                />
              </label>
            </div>
          </QuoteFold>

          <QuoteFold
            title="Impuestos Colombia (interno)"
            summary={`ICA ${taxConfig.icaComercioPerMil}‰ / ${taxConfig.icaServiciosPerMil}‰ · renta ${taxConfig.rentaPercent}%`}
            open={openFolds.impuestos}
            onToggle={() =>
              setOpenFolds((s) => ({ ...s, impuestos: !s.impuestos }))
            }
            printHidden
          >
            <p className="text-xs text-[#6d7c74]">
              ICA es el impuesto municipal real. ReteFuente, ReteICA y ReteIVA las
              retiene el cliente: bajan la caja, no la utilidad (se descuentan en
              la declaración). Renta del 35% se estima sobre la utilidad después
              de ICA. Confirme tasas con su contador; ICA cambia por ciudad.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded-full bg-[#0f2a1f] px-3 py-1.5 text-xs text-white"
                onClick={() => {
                  const next = applyCityPreset(taxConfig, clientCity);
                  setTaxConfig(next);
                  saveTaxConfig(next);
                }}
              >
                Usar ICA de {clientCity || "la ciudad"}
              </button>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {(
                [
                  ["icaComercioPerMil", "ICA equipos (‰)"],
                  ["icaServiciosPerMil", "ICA servicios (‰)"],
                  ["reteIcaOfIcaPercent", "ReteICA (% del ICA)"],
                  ["reteFuenteBienesPercent", "ReteFuente bienes %"],
                  ["reteFuenteServiciosPercent", "ReteFuente servicios %"],
                  ["reteIvaPercent", "ReteIVA % del IVA"],
                  ["rentaPercent", "Renta sociedades %"],
                  ["smmlvCOP", "SMMLV (COP)"],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="block text-sm">
                  <span className="mb-1 block font-medium">{label}</span>
                  <input
                    type="number"
                    step="any"
                    className="w-full rounded-xl border border-[#d8d2c4] bg-[#fbfaf6] px-3 py-2.5"
                    value={taxConfig[key]}
                    onChange={(e) => {
                      const next = {
                        ...taxConfig,
                        [key]: Number(e.target.value) || 0,
                      };
                      setTaxConfig(next);
                      saveTaxConfig(next);
                    }}
                  />
                </label>
              ))}
            </div>
            <fieldset className="mt-3">
              <legend className="mb-1 text-sm font-medium">ARL cuadrilla</legend>
              <div className="flex flex-wrap gap-1">
                {(["I", "II", "III", "IV", "V"] as const).map((cls) => (
                  <button
                    key={cls}
                    type="button"
                    onClick={() => {
                      const next = { ...taxConfig, arlClass: cls };
                      setTaxConfig(next);
                      saveTaxConfig(next);
                    }}
                    className={`rounded-lg px-2 py-1 text-xs font-semibold ${
                      taxConfig.arlClass === cls
                        ? "bg-[#1f6b45] text-white"
                        : "bg-[#fbfaf6] ring-1 ring-[#d8d2c4]"
                    }`}
                  >
                    Clase {cls}
                  </button>
                ))}
              </div>
              <p className="mt-1 text-[11px] text-[#6d7c74]">
                Instalación en altura / cubierta suele ser IV o V.
              </p>
            </fieldset>
            <label className="mt-3 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={taxConfig.applyExoneracion114}
                onChange={(e) => {
                  const next = {
                    ...taxConfig,
                    applyExoneracion114: e.target.checked,
                  };
                  setTaxConfig(next);
                  saveTaxConfig(next);
                }}
              />
              Exoneración art. 114-1 (sin salud/SENA/ICBF si salario menor a 10 SMMLV)
            </label>
            <label className="mt-2 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={clientWithholds}
                onChange={(e) => setClientWithholds(e.target.checked)}
              />
              Cliente agente retenedor (ReteFuente y ReteICA)
            </label>
            <label className="mt-2 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={clientGranContribuyente}
                onChange={(e) => setClientGranContribuyente(e.target.checked)}
              />
              Cliente gran contribuyente (ReteIVA)
            </label>
            <label className="mt-3 block text-sm">
              <span className="mb-1 block font-medium">
                Utilidad neta mínima que quiere ganar (COP)
              </span>
              <input
                type="number"
                className="w-full rounded-xl border border-[#d8d2c4] bg-[#fbfaf6] px-3 py-2.5"
                value={targetNetProfitCOP}
                onChange={(e) =>
                  setTargetNetProfitCOP(Math.max(0, Number(e.target.value) || 0))
                }
              />
              <span className="mt-1 block text-[11px] text-[#6d7c74]">
                0 = 12% sobre costos. El sistema calcula el piso de venta.
              </span>
            </label>
          </QuoteFold>

          <QuoteFold
            title="Costeo y utilidad"
            kicker="Solo interno · no va al cliente"
            summary={`Neto ${copFmt.format(quote.pl.netProfitCOP)} · cliente ${copFmt.format(quote.pl.totalClientCOP)}`}
            open={openFolds.costeo}
            onToggle={() =>
              setOpenFolds((s) => ({ ...s, costeo: !s.costeo }))
            }
            dark
            printHidden
          >
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="text-[#8aa398]">
                  <tr>
                    <th className="py-1 pr-2 font-medium">Ítem</th>
                    <th className="py-1 pr-2 font-medium">Cant.</th>
                    <th className="py-1 pr-2 font-medium">Costo</th>
                    <th className="py-1 pr-2 font-medium">%</th>
                    <th className="py-1 pr-2 font-medium">Venta</th>
                    <th className="py-1 font-medium">IVA</th>
                  </tr>
                </thead>
                <tbody>
                  {quote.lines.map((line) => (
                    <tr key={line.key} className="border-t border-[#1f4636]">
                      <td className="py-1.5 pr-2">{line.label}</td>
                      <td className="py-1.5 pr-2">
                        {line.qty} {line.unit}
                      </td>
                      <td className="py-1.5 pr-2">{copFmt.format(line.costTotalCOP)}</td>
                      <td className="py-1.5 pr-2">{line.marginPercent}%</td>
                      <td className="py-1.5 pr-2">{copFmt.format(line.saleTotalCOP)}</td>
                      <td className="py-1.5">{copFmt.format(line.ivaTotalCOP)}</td>
                    </tr>
                  ))}
                  {engineeringSaleCOP > 0 || engineeringCostCOP > 0 ? (
                    <tr className="border-t border-[#1f4636]">
                      <td className="py-1.5 pr-2">Ajuste ingeniería</td>
                      <td className="py-1.5 pr-2">1 gl</td>
                      <td className="py-1.5 pr-2">
                        {copFmt.format(engineeringCostCOP)}
                      </td>
                      <td className="py-1.5 pr-2">
                        {engineeringSaleCOP
                          ? numFmt.format(
                              ((engineeringSaleCOP - engineeringCostCOP) /
                                engineeringSaleCOP) *
                                100
                            )
                          : 0}
                        %
                      </td>
                      <td className="py-1.5 pr-2">
                        {copFmt.format(engineeringSaleCOP)}
                      </td>
                      <td className="py-1.5">
                        {copFmt.format(
                          chargeIva
                            ? Math.round(engineeringSaleCOP * IVA_RATE)
                            : 0
                        )}
                      </td>
                    </tr>
                  ) : null}
                  {quote.addons
                    .filter((a) => a.enabled && a.group === "engineering")
                    .map((a) => (
                      <tr key={a.id} className="border-t border-[#1f4636]">
                        <td className="py-1.5 pr-2">{a.label}</td>
                        <td className="py-1.5 pr-2">1 gl</td>
                        <td className="py-1.5 pr-2">
                          {copFmt.format(a.costCOP)}
                        </td>
                        <td className="py-1.5 pr-2">
                          {a.saleCOP
                            ? numFmt.format(
                                ((a.saleCOP - a.costCOP) / a.saleCOP) * 100
                              )
                            : 0}
                          %
                        </td>
                        <td className="py-1.5 pr-2">
                          {copFmt.format(a.saleCOP)}
                        </td>
                        <td className="py-1.5">
                          {copFmt.format(
                            chargeIva ? Math.round(a.saleCOP * IVA_RATE) : 0
                          )}
                        </td>
                      </tr>
                    ))}
                  <tr className="border-t border-[#1f4636]">
                    <td className="py-1.5 pr-2">Cuadrilla</td>
                    <td className="py-1.5 pr-2">
                      {quote.labor.technicians} × {quote.labor.days} d
                    </td>
                    <td className="py-1.5 pr-2">
                      {copFmt.format(quote.labor.costCOP)}
                    </td>
                    <td className="py-1.5 pr-2">
                      {quote.labor.saleCOP
                        ? numFmt.format(
                            ((quote.labor.saleCOP - quote.labor.costCOP) /
                              quote.labor.saleCOP) *
                              100
                          )
                        : 0}
                      %
                    </td>
                    <td className="py-1.5 pr-2">
                      {copFmt.format(quote.labor.saleCOP)}
                    </td>
                    <td className="py-1.5">{copFmt.format(quote.labor.ivaCOP)}</td>
                  </tr>
                  {quote.addons
                    .filter((a) => a.enabled && a.group === "site")
                    .map((a) => (
                      <tr key={a.id} className="border-t border-[#1f4636]">
                        <td className="py-1.5 pr-2">{a.label}</td>
                        <td className="py-1.5 pr-2">
                          {a.id === "overtime" ? `${a.extraQty} d` : "1 gl"}
                        </td>
                        <td className="py-1.5 pr-2">
                          {copFmt.format(a.costCOP)}
                        </td>
                        <td className="py-1.5 pr-2">
                          {a.saleCOP
                            ? numFmt.format(
                                ((a.saleCOP - a.costCOP) / a.saleCOP) * 100
                              )
                            : 0}
                          %
                        </td>
                        <td className="py-1.5 pr-2">
                          {copFmt.format(a.saleCOP)}
                        </td>
                        <td className="py-1.5">
                          {copFmt.format(
                            chargeIva ? Math.round(a.saleCOP * IVA_RATE) : 0
                          )}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 text-sm text-[#c9d7cf]">
              <div className="space-y-1">
                <p className="text-[10px] font-semibold tracking-wide text-[#d4b46a] uppercase">
                  Qué se cobra
                </p>
                <p>Equipos: {copFmt.format(quote.pl.saleEquipmentCOP)}</p>
                <p>Ingeniería: {copFmt.format(quote.pl.saleEngineeringCOP)}</p>
                <p>Cuadrilla: {copFmt.format(quote.pl.saleLaborCOP)}</p>
                <p>Subtotal: {copFmt.format(quote.pl.saleNetCOP)}</p>
                <p>IVA: {copFmt.format(quote.pl.ivaCOP)}</p>
                <p className="font-semibold text-white">
                  Total cliente: {copFmt.format(quote.pl.totalClientCOP)}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-semibold tracking-wide text-[#d4b46a] uppercase">
                  En qué sale
                </p>
                <p>Costo equipos: {copFmt.format(quote.pl.costEquipmentCOP)}</p>
                <p>Costo ingeniería: {copFmt.format(quote.pl.costEngineeringCOP)}</p>
                <p>Costo cuadrilla: {copFmt.format(quote.pl.costLaborCOP)}</p>
                <p>Logística ({overheadPercent}%): {copFmt.format(quote.pl.overheadCOP)}</p>
                <p className="font-medium text-white">
                  Costo total: {copFmt.format(quote.pl.totalCostCOP)}
                </p>
                <p>Utilidad bruta: {copFmt.format(quote.pl.grossProfitCOP)}</p>
              </div>
            </div>
            <div className="mt-4 rounded-xl bg-[#0a1f17] p-3 text-sm">
              <p className="text-[10px] font-semibold tracking-wide text-[#d4b46a] uppercase">
                Impuestos y caja
              </p>
              <div className="mt-2 grid gap-1 text-[#c9d7cf] sm:grid-cols-2">
                <p>
                  ICA equipos ({taxConfig.icaComercioPerMil}‰):{" "}
                  {copFmt.format(quote.pl.taxes.icaBienesCOP)}
                </p>
                <p>
                  ICA servicios ({taxConfig.icaServiciosPerMil}‰):{" "}
                  {copFmt.format(quote.pl.taxes.icaServiciosCOP)}
                </p>
                <p>ICA a pagar: {copFmt.format(quote.pl.taxes.icaCOP)}</p>
                <p>ReteICA (caja): {copFmt.format(quote.pl.taxes.reteIcaCOP)}</p>
                <p>
                  ReteFuente bienes: {copFmt.format(quote.pl.taxes.reteFuenteBienesCOP)}
                </p>
                <p>
                  ReteFuente servicios:{" "}
                  {copFmt.format(quote.pl.taxes.reteFuenteServiciosCOP)}
                </p>
                <p>ReteIVA (caja): {copFmt.format(quote.pl.taxes.reteIvaCOP)}</p>
                <p>
                  Renta {taxConfig.rentaPercent}%:{" "}
                  {copFmt.format(quote.pl.taxes.rentaCOP)}
                </p>
              </div>
              <p className="mt-3 text-base font-semibold text-white">
                Ganancia neta: {copFmt.format(quote.pl.netProfitCOP)} (
                {numFmt.format(quote.pl.netMarginPercent)}%)
              </p>
              <p className="mt-1 text-xs text-[#8aa398]">
                El cliente paga {copFmt.format(quote.pl.totalClientCOP)} y retiene{" "}
                {copFmt.format(quote.pl.taxes.withholdingsCOP)}. Caja que entra:{" "}
                {copFmt.format(quote.pl.cashFromClientCOP)}. Después de costos e IVA
                a DIAN: {copFmt.format(quote.pl.cashAfterCostsCOP)}.
              </p>
              <p className="mt-2 text-sm text-[#e8d9a8]">
                Directriz: para ganar al menos{" "}
                {copFmt.format(
                  targetNetProfitCOP || Math.round(quote.pl.totalCostCOP * 0.12)
                )}{" "}
                netos, el subtotal de venta no debería bajar de{" "}
                <span className="font-semibold">
                  {copFmt.format(quote.pl.minSaleForTargetNetCOP)}
                </span>
                {quote.pl.saleNetCOP < quote.pl.minSaleForTargetNetCOP
                  ? " — hoy está por debajo; suba ingeniería, cuadrilla o márgenes de estructura/cable."
                  : " — esta cotización sí cubre el piso."}
              </p>
            </div>
            <div className="mt-4 space-y-2">
              <p className="text-[10px] font-semibold tracking-wide text-[#d4b46a] uppercase">
                A qué sí subir precio (y a qué no)
              </p>
              {quote.tactics.map((t) => (
                <div
                  key={t.category}
                  className="rounded-lg bg-[#0a1f17] px-3 py-2 text-xs"
                >
                  <p className="font-semibold text-white">
                    {t.label}: {numFmt.format(t.currentPercent)}%{" "}
                    <span className="font-normal text-[#8aa398]">
                      (banda {t.minPercent}–{t.maxPercent}%)
                    </span>{" "}
                    {t.status === "bajo"
                      ? "· bajo"
                      : t.status === "alto"
                        ? "· alto"
                        : "· ok"}
                    {t.canRaise ? " · puede subir" : ""}
                  </p>
                  <p className="mt-0.5 text-[#c9d7cf]">{t.advice}</p>
                </div>
              ))}
            </div>
          </QuoteFold>

          <QuoteFold
            title="Panel de control · Propuesta"
            summary="TIR, ROI, Ley 1715 y gráficos para el cliente"
            open={openFolds.propuesta}
            onToggle={() =>
              setOpenFolds((s) => ({ ...s, propuesta: !s.propuesta }))
            }
            printHidden
          >
            <p className="text-xs text-[#6d7c74]">
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
          </QuoteFold>
        </div>

        {/* RIGHT: misma propuesta estilo Vercel, en vivo */}
        <div className="space-y-4">
          <p className="print:hidden text-sm text-[#4d5c55]">
            Esta es la misma cotización que enviabas antes (estilo oscuro EPC). Lo que
            cambias a la izquierda se refleja aquí. El enlace comercial abre esta
            página completa para el cliente.
          </p>
          <section
            id="propuesta-comercial"
            className="overflow-hidden rounded-2xl ring-1 ring-[#1e2d4a] shadow-[0_20px_50px_rgba(7,11,22,0.25)]"
          >
            <div className="max-h-[85vh] overflow-y-auto print:max-h-none">
              {liveProposal ? (
                <EpcProposalView proposal={liveProposal} embedded />
              ) : (
                <div className="bg-[#070b16] p-10 text-center text-[#8aa0c2]">
                  Cargando propuesta…
                </div>
              )}
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

function QuoteFold({
  title,
  summary,
  kicker,
  open,
  onToggle,
  dark,
  printHidden,
  children,
}: {
  title: string;
  summary?: string;
  kicker?: string;
  open: boolean;
  onToggle: () => void;
  dark?: boolean;
  printHidden?: boolean;
  children: ReactNode;
}) {
  return (
    <section
      className={`rounded-2xl border p-4 ${
        dark
          ? "border-[#1a3d2e] bg-[#0f2a1f] text-white"
          : "border-[#ddd6c8] bg-white"
      } ${printHidden ? "print:hidden" : ""}`}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-start justify-between gap-3 text-left"
      >
        <div className="min-w-0">
          {kicker ? (
            <p
              className={`text-[10px] font-semibold tracking-[0.2em] uppercase ${
                dark ? "text-[#d4b46a]" : "text-[#8a6b2a]"
              }`}
            >
              {kicker}
            </p>
          ) : null}
          <h3 className="text-lg font-semibold">{title}</h3>
          {!open && summary ? (
            <p
              className={`mt-0.5 truncate text-xs ${
                dark ? "text-[#8aa398]" : "text-[#6d7c74]"
              }`}
            >
              {summary}
            </p>
          ) : null}
        </div>
        <span
          aria-hidden
          className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg text-lg font-semibold ${
            dark ? "bg-[#163d2c] text-[#d4b46a]" : "bg-[#fbfaf6] text-[#1f6b45]"
          }`}
        >
          {open ? "−" : "+"}
        </span>
      </button>
      {open ? <div className="mt-4">{children}</div> : null}
    </section>
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
