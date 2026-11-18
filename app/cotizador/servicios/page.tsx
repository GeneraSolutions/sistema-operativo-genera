"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { ClientIdFields } from "@/components/ClientIdFields";
import { ClientRutPanel } from "@/components/ClientRutPanel";
import { ContractCedulaCheck } from "@/components/deliverables/ContractCedulaCheck";
import { ParticularTermsEditor } from "@/components/deliverables/ParticularTermsEditor";
import { EpcProposalView } from "@/components/proposal/EpcProposalView";
import { isAliadoRole } from "@/lib/auth/roles";
import {
  clientWithholdsFromParty,
  displayClientName,
  emptyClientParty,
  withholdingNote,
  type ClientIdType,
  type ClientParty,
} from "@/lib/client-party";
import {
  DEFAULT_TAX_CONFIG,
  loadTaxConfig,
  type ColombiaTaxConfig,
} from "@/lib/colombia-tax";
import { saleFromCost } from "@/lib/eng-labor-addons";
import { IVA_RATE } from "@/lib/pricing";
import {
  blankServiceLine,
  buildServiceProposal,
  MAX_SERVICE_LINES,
  serviceLineFromInventory,
  serviceQuoteTotals,
} from "@/lib/service-quote";
import {
  contractReleased,
  datasheetsReleased,
  resolveClientDeliverables,
} from "@/lib/proposal-bonuses";
import { saveProposal } from "@/lib/proposal-store";
import {
  categoryLabel,
  groupInventoryByCategory,
  loadCustomCategories,
  loadInventory,
} from "@/lib/inventory";
import {
  ACTIVE_QUOTE_KEY,
  getStoredQuoteLines,
  loadSavedQuotes,
  mergeQuotes,
  pinActiveQuote,
  putQuoteLines,
  quotesForCotizador,
  saveQuoteSnapshot,
  type SavedQuote,
} from "@/lib/saved-quotes";
import { OPEN_QUOTE_KEY } from "@/lib/saved-visits";
import { cloneWarranties, type SystemWarranties } from "@/lib/warranties";
import type { CustomCategory, InventoryItem } from "@/types/inventory";
import type {
  ParticularTerm,
  PaymentKind,
  ProposalToggles,
} from "@/types/proposal";
import type { QuoteLineInput } from "@/lib/quote-engine";

function localISODate(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const cop = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

const field =
  "w-full rounded-xl border border-[#d8d2c4] bg-[#fbfaf6] px-3 py-2.5";

function CotizadorServiciosInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [sessionUser, setSessionUser] = useState<{
    username: string;
    name: string;
    role: string;
  } | null>(null);
  const aliado = isAliadoRole(sessionUser?.role);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [customCats, setCustomCats] = useState<CustomCategory[]>([]);
  const [quoteLines, setQuoteLines] = useState<QuoteLineInput[]>([]);
  const [serviceDescription, setServiceDescription] = useState(
    "Instalación de sistema fotovoltaico según visita y alcance acordado con el cliente."
  );
  const [addItemId, setAddItemId] = useState("");
  const [addItemQuery, setAddItemQuery] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientCity, setClientCity] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientAddress, setClientAddress] = useState("");
  const [clientNit, setClientNit] = useState("");
  const [clientDv, setClientDv] = useState("");
  const [clientIdType, setClientIdType] = useState<ClientIdType>("nit");
  const [clientParty, setClientParty] = useState<ClientParty>(emptyClientParty);
  const [chargeIva, setChargeIva] = useState(true);
  const [clientWithholds, setClientWithholds] = useState(false);
  const [clientGranContribuyente, setClientGranContribuyente] = useState(false);
  const [taxConfig, setTaxConfig] = useState<ColombiaTaxConfig>(DEFAULT_TAX_CONFIG);
  const [validUntilDays, setValidUntilDays] = useState(15);
  const [issuedAt, setIssuedAt] = useState(() => localISODate());
  const [advancePercent, setAdvancePercent] = useState(50);
  const [paymentKind, setPaymentKind] = useState<PaymentKind>("two_shot");
  const [particularTerms, setParticularTerms] = useState<ParticularTerm[]>([]);
  const [warranties, setWarranties] = useState<SystemWarranties>({
    items: [],
    notes:
      "Garantías según ítems del inventario y alcance de servicio pactado con Genera Solutions SAS.",
  });
  const [partnerCompanyName, setPartnerCompanyName] = useState("");
  const [partnerLogoDataUrl, setPartnerLogoDataUrl] = useState("");
  const [savedQuotes, setSavedQuotes] = useState<SavedQuote[]>([]);
  const [saveFlash, setSaveFlash] = useState("");
  const [linkFlash, setLinkFlash] = useState("");
  const [publishingLink, setPublishingLink] = useState(false);
  const [commercialProposalId, setCommercialProposalId] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [toggles, setToggles] = useState<ProposalToggles>({
    showTir: false,
    showRoiPayback: false,
    showDeductionLey1715: false,
    showIvaAranceles: false,
    showDepreciacion: false,
    showCharts: false,
    deliverables: {
      fichas: false,
      explicacion: false,
      manual: false,
      "primera-factura": false,
      certificado: false,
      contrato: false,
    },
  });
  const editingQuoteId = useRef<string | undefined>(undefined);

  const visibleQuotes = quotesForCotizador(savedQuotes, {
    aliado,
    username: sessionUser?.username,
    kind: "servicios",
  });
  const activeInventory = inventory.filter((i) => i.active);
  const grouped = groupInventoryByCategory(
    activeInventory,
    customCats,
    addItemQuery
  );

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.user) setSessionUser(data.user);
      })
      .catch(() => null);
  }, []);

  useEffect(() => {
    const items = loadInventory();
    setInventory(items);
    setCustomCats(loadCustomCategories());
    setTaxConfig(loadTaxConfig());
    const openId =
      searchParams.get("quote") ||
      (typeof window !== "undefined"
        ? sessionStorage.getItem(OPEN_QUOTE_KEY) ||
          sessionStorage.getItem(ACTIVE_QUOTE_KEY)
        : null);
    const localQuotes = loadSavedQuotes();
    for (const q of localQuotes) {
      if (q.quoteLines?.length) putQuoteLines(q.id, q.quoteLines);
    }
    setSavedQuotes(localQuotes);
    if (openId) {
      const q = localQuotes.find((row) => row.id === openId);
      if (q?.kind === "equipos") {
        window.location.replace(
          `/cotizador/equipos?quote=${encodeURIComponent(openId)}`
        );
        return;
      }
      if (q?.kind === "epc" || (q && !q.kind && q.systemKwp)) {
        window.location.replace(
          `/cotizador?quote=${encodeURIComponent(openId)}`
        );
        return;
      }
      if (q?.kind === "servicios") loadQuote(q, items);
    }
    void fetch("/api/archivo", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data?.quotes) return;
        const merged = mergeQuotes(loadSavedQuotes(), data.quotes);
        merged.forEach((row) => {
          try {
            saveQuoteSnapshot(row, { replaceLines: false });
          } catch {
            /* quota */
          }
        });
        setSavedQuotes(merged);
        if (openId) {
          const q = merged.find((row) => row.id === openId);
          if (q?.kind === "servicios") loadQuote(q, items);
        }
      });
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totals = useMemo(
    () =>
      serviceQuoteTotals(quoteLines, inventory, {
        chargeIva,
        clientWithholds,
        clientGranContribuyente,
        taxConfig,
      }),
    [
      quoteLines,
      inventory,
      chargeIva,
      clientWithholds,
      clientGranContribuyente,
      taxConfig,
    ]
  );

  const liveProposal = useMemo(() => {
    if (!hydrated) return null;
    const proposal = buildServiceProposal({
      id: commercialProposalId || "preview",
      issuedAt,
      validUntilDays,
      clientName,
      clientCity,
      clientEmail,
      clientPhone,
      clientAddress,
      clientNit,
      clientDv,
      clientIdType,
      withholdingsNote:
        clientNit || clientParty.nit
          ? withholdingNote({
              ...clientParty,
              agenteRetenedorFuente:
                clientWithholds || clientParty.agenteRetenedorFuente,
              granContribuyente: clientGranContribuyente,
            })
          : undefined,
      partnerLogoDataUrl: aliado ? partnerLogoDataUrl : undefined,
      companyName: aliado ? partnerCompanyName : undefined,
      paymentKind,
      advancePercent,
      totals,
      serviceDescription,
      warranties,
      particularTerms,
    });
    return { ...proposal, toggles };
  }, [
    hydrated,
    commercialProposalId,
    issuedAt,
    validUntilDays,
    clientName,
    clientCity,
    clientEmail,
    clientPhone,
    clientAddress,
    clientNit,
    clientDv,
    clientIdType,
    clientParty,
    clientWithholds,
    clientGranContribuyente,
    aliado,
    partnerLogoDataUrl,
    partnerCompanyName,
    paymentKind,
    advancePercent,
    totals,
    serviceDescription,
    warranties,
    particularTerms,
    toggles,
  ]);

  function applyParty(party: ClientParty) {
    setClientParty(party);
    const name = displayClientName(party);
    if (name) setClientName(name);
    if (party.city) setClientCity(party.city);
    if (party.email) setClientEmail(party.email);
    if (party.phone) setClientPhone(party.phone);
    if (party.address) setClientAddress(party.address);
    if (party.nit) setClientNit(party.nit);
    if (party.dv && party.idType !== "cc") setClientDv(party.dv);
    setClientIdType(party.idType || "nit");
    if (party.idType === "cc") setClientDv("");
    setClientWithholds(clientWithholdsFromParty(party));
    setClientGranContribuyente(
      party.granContribuyente || party.agenteRetenedorIva
    );
  }

  function patchLine(key: string, patch: Partial<QuoteLineInput>) {
    setQuoteLines((rows) =>
      rows.map((row) => (row.key === key ? { ...row, ...patch } : row))
    );
  }

  function addCustomLine() {
    setQuoteLines((rows) => {
      if (rows.length >= MAX_SERVICE_LINES) return rows;
      return [...rows, blankServiceLine("Descripción del servicio")];
    });
  }

  function addFromInventory(itemId: string) {
    const id = itemId || addItemId;
    const item = inventory.find((i) => i.id === id);
    if (!item) return;
    setQuoteLines((rows) => {
      if (rows.length >= MAX_SERVICE_LINES) return rows;
      return [...rows, serviceLineFromInventory(item, 1)];
    });
    setAddItemId("");
  }

  function loadQuote(q: SavedQuote, items?: InventoryItem[]) {
    editingQuoteId.current = q.id;
    pinActiveQuote(q.id);
    setClientName(q.clientName);
    setClientCity(q.clientCity);
    setClientEmail(q.clientEmail || "");
    setClientPhone(q.clientPhone || "");
    setClientAddress(q.clientAddress || "");
    setClientNit(q.clientNit || "");
    setClientDv(q.clientDv || "");
    setClientIdType(q.clientIdType || q.clientParty?.idType || "nit");
    if (q.clientParty) setClientParty({ ...emptyClientParty(), ...q.clientParty });
    setClientWithholds(q.clientWithholds ?? false);
    setClientGranContribuyente(q.clientGranContribuyente ?? false);
    setChargeIva(q.chargeIva);
    setValidUntilDays(q.validUntilDays ?? 15);
    setIssuedAt(q.issuedAt || localISODate());
    setAdvancePercent(q.advancePercent || 50);
    setPaymentKind(
      q.paymentKind === "one_shot" || q.paymentKind === "two_shot"
        ? q.paymentKind
        : "two_shot"
    );
    setCommercialProposalId(q.commercialProposalId ?? "");
    if (q.toggles) setToggles(q.toggles);
    if (q.warranties) setWarranties(cloneWarranties(q.warranties));
    setParticularTerms(q.particularTerms ?? []);
    if (q.partnerCompanyName) setPartnerCompanyName(q.partnerCompanyName);
    if (q.partnerLogoDataUrl) setPartnerLogoDataUrl(q.partnerLogoDataUrl);
    setServiceDescription(
      q.serviceDescription ||
        "Instalación de sistema fotovoltaico según visita y alcance acordado con el cliente."
    );
    const lines = getStoredQuoteLines(q.id) ?? q.quoteLines ?? [];
    setQuoteLines(lines.slice(0, MAX_SERVICE_LINES));
    void items;
  }

  function snapshotCurrent(name?: string): SavedQuote {
    return {
      id: editingQuoteId.current || crypto.randomUUID(),
      kind: "servicios",
      name:
        name ||
        `${clientName || "Servicios"} · ${quoteLines.length} ítem${
          quoteLines.length === 1 ? "" : "s"
        }`,
      savedAt: new Date().toISOString(),
      serviceDescription,
      clientName: clientName || "Cliente",
      clientCity,
      clientEmail,
      clientPhone,
      clientAddress,
      clientNit,
      clientDv,
      clientIdType,
      clientParty,
      systemKwp: 0,
      peakSunHours: 0,
      energyTariff: 0,
      includeBattery: false,
      batteryKwh: 0,
      mount: "cubierta",
      softCostPercent: 0,
      overheadPercent: 0,
      clientWithholds,
      clientGranContribuyente,
      chargeIva,
      applyLey1715: false,
      monthlyConsumption: 0,
      executionDays: 5,
      validUntilDays,
      issuedAt,
      advancePercent,
      paymentKind,
      twoStartPercent: advancePercent,
      equipmentIds: {},
      qty: {
        panels: 0,
        inverters: 0,
        batteries: 0,
        structure: 0,
        cabling: 0,
        protectionDc: 0,
        protectionAc: 0,
      },
      quoteLines,
      qtyLocked: true,
      toggles,
      warranties: cloneWarranties(warranties),
      particularTerms,
      commercialProposalId: commercialProposalId || undefined,
      channel: aliado ? "aliado" : "genera",
      savedBy: sessionUser?.username,
      savedByName: sessionUser?.name,
      partnerCompanyName: aliado ? partnerCompanyName : undefined,
      partnerLogoDataUrl: aliado ? partnerLogoDataUrl : undefined,
    };
  }

  async function persistQuote(q: SavedQuote) {
    try {
      editingQuoteId.current = q.id;
      const saved = saveQuoteSnapshot({ ...q, qtyLocked: true }, { replaceLines: true });
      putQuoteLines(saved.id, saved.quoteLines ?? []);
      pinActiveQuote(saved.id);
      sessionStorage.setItem(OPEN_QUOTE_KEY, saved.id);
      const url = new URL(window.location.href);
      url.searchParams.set("quote", saved.id);
      router.replace(`${url.pathname}${url.search}`, { scroll: false });
      setSavedQuotes(loadSavedQuotes());
      const res = await fetch("/api/archivo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quote: saved }),
      });
      if (res.ok) {
        const data = await res.json().catch(() => null);
        if (data?.quotes) {
          const merged = mergeQuotes(loadSavedQuotes(), data.quotes);
          merged.forEach((row) => {
            try {
              saveQuoteSnapshot(row, { replaceLines: false });
            } catch {
              /* quota */
            }
          });
          saveQuoteSnapshot(saved, { replaceLines: true });
          putQuoteLines(saved.id, saved.quoteLines ?? []);
          setSavedQuotes(loadSavedQuotes());
        }
      }
      setSaveFlash(
        res.ok
          ? "Cotización de servicios guardada."
          : "Se guardó en este equipo, pero no llegó al servidor."
      );
    } catch {
      setSaveFlash("No se pudo guardar.");
    }
    window.setTimeout(() => setSaveFlash(""), 4000);
  }

  async function publishCommercial(opts?: {
    fichas?: boolean;
    contrato?: boolean;
    open?: boolean;
    doc?: "quote" | "contrato";
  }) {
    if (!liveProposal) return;
    const id = commercialProposalId || crypto.randomUUID();
    const fichas = opts?.fichas ?? datasheetsReleased(toggles);
    const contrato =
      opts?.contrato ??
      (opts?.doc === "contrato" ? true : contractReleased(toggles));
    const nextToggles = {
      ...toggles,
      deliverables: {
        ...resolveClientDeliverables(toggles),
        fichas,
        contrato,
      },
    };
    setToggles(nextToggles);
    setCommercialProposalId(id);
    const proposal = { ...liveProposal, id, toggles: nextToggles };
    saveProposal(proposal);
    setPublishingLink(true);
    try {
      const res = await fetch("/api/propuestas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(proposal),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setLinkFlash(data.error || "No se pudo publicar.");
        return;
      }
    } catch {
      setLinkFlash("Sin conexión para publicar.");
      return;
    } finally {
      setPublishingLink(false);
    }
    const saved = snapshotCurrent();
    saved.commercialProposalId = id;
    saved.toggles = nextToggles;
    void persistQuote(saved);
    const path =
      opts?.doc === "contrato"
        ? `/propuesta/epc/${id}/contrato`
        : `/propuesta/epc/${id}`;
    await navigator.clipboard?.writeText(`${window.location.origin}${path}`).catch(
      () => undefined
    );
    setLinkFlash(
      opts?.doc === "contrato"
        ? "Enlace del contrato copiado."
        : "Enlace copiado."
    );
    if (opts?.open !== false) {
      window.open(path, "_blank", "noopener,noreferrer");
    }
    window.setTimeout(() => setLinkFlash(""), 4500);
  }

  function setPayMode(value: "one_shot" | "two_shot") {
    setPaymentKind(value);
    setAdvancePercent(value === "one_shot" ? 100 : 50);
  }

  return (
    <AppShell
      title="Cotizador de servicios"
      subtitle="Instalación, cargadores u otros · descripción libre + inventario"
      actions={
        <>
          <button
            type="button"
            className="os-btn os-btn-primary"
            onClick={() => void persistQuote(snapshotCurrent())}
          >
            Guardar cotización
          </button>
          <button
            type="button"
            className="os-btn os-btn-ghost"
            disabled={!liveProposal || publishingLink || quoteLines.length === 0}
            onClick={() => void publishCommercial()}
          >
            {publishingLink ? "Publicando…" : "Publicar enlace"}
          </button>
        </>
      }
    >
      {saveFlash ? <p className="mb-3 text-sm text-[#1f6b45]">{saveFlash}</p> : null}
      {linkFlash ? <p className="mb-3 text-sm text-[#1f6b45]">{linkFlash}</p> : null}

      {visibleQuotes.length ? (
        <p className="os-page-intro mb-4 text-xs text-[#6b6458]">
          Recientes:{" "}
          {visibleQuotes.slice(0, 6).map((q) => (
            <button
              key={q.id}
              type="button"
              className="mr-2 underline"
              onClick={() => loadQuote(q)}
            >
              {q.name}
            </button>
          ))}
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="min-w-0 space-y-5 lg:order-1">
          <section className="os-panel rounded-2xl border border-[#ddd6c8] bg-white p-5">
            <ClientRutPanel
              party={clientParty}
              onChange={setClientParty}
              onApply={applyParty}
            />
          </section>

          <section className="os-panel rounded-2xl border border-[#ddd6c8] bg-white p-5">
            <h2 className="font-semibold">Cliente</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="block text-sm sm:col-span-2">
                <span className="mb-1 block font-medium">Nombre</span>
                <input
                  className={field}
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium">Correo</span>
                <input
                  className={field}
                  type="email"
                  value={clientEmail}
                  onChange={(e) => setClientEmail(e.target.value)}
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium">Teléfono</span>
                <input
                  className={field}
                  value={clientPhone}
                  onChange={(e) => setClientPhone(e.target.value)}
                />
              </label>
              <label className="block text-sm sm:col-span-2">
                <span className="mb-1 block font-medium">Dirección</span>
                <input
                  className={field}
                  value={clientAddress}
                  onChange={(e) => setClientAddress(e.target.value)}
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium">Ciudad</span>
                <input
                  className={field}
                  value={clientCity}
                  onChange={(e) => setClientCity(e.target.value)}
                />
              </label>
              <div className="sm:col-span-2">
                <ClientIdFields
                  idType={clientIdType}
                  number={clientNit}
                  dv={clientDv}
                  onType={(next) => {
                    setClientIdType(next);
                    if (next === "cc") setClientDv("");
                    setClientParty((p) => ({
                      ...p,
                      idType: next,
                      dv: next === "cc" ? "" : p.dv,
                      personType: next === "cc" ? "natural" : p.personType,
                    }));
                  }}
                  onNumber={(next) => {
                    setClientNit(next);
                    setClientParty((p) => ({ ...p, nit: next }));
                  }}
                  onDv={(next) => {
                    setClientDv(next);
                    setClientParty((p) => ({ ...p, dv: next }));
                  }}
                />
              </div>
            </div>
            <label className="mt-3 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={clientWithholds}
                onChange={(e) => setClientWithholds(e.target.checked)}
              />
              Cliente agente retenedor
            </label>
            <label className="mt-2 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={clientGranContribuyente}
                onChange={(e) => setClientGranContribuyente(e.target.checked)}
              />
              Gran contribuyente
            </label>
            <label className="mt-2 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={chargeIva}
                onChange={(e) => setChargeIva(e.target.checked)}
              />
              Cobrar IVA en ítems gravados
            </label>
            <div className="mt-4">
              <ContractCedulaCheck
                clientName={clientName}
                clientIdType={clientIdType}
                clientNit={clientNit}
                clientDv={clientDv}
              />
            </div>
          </section>

          <section className="os-panel rounded-2xl border border-[#ddd6c8] bg-white p-5">
            <h2 className="font-semibold">Descripción del alcance</h2>
            <p className="mt-1 text-sm text-[#4d5c55]">
              Usted la escribe. Sale en la propuesta al cliente.
            </p>
            <textarea
              className={`${field} mt-3 min-h-[120px]`}
              value={serviceDescription}
              onChange={(e) => setServiceDescription(e.target.value)}
              placeholder="Ej.: Instalación de cargadores Wallbox 7 kW en parqueadero, con canalización y puesta a tierra…"
            />
          </section>

          <section className="os-panel rounded-2xl border border-[#ddd6c8] bg-white p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-semibold">
                Ítems ({quoteLines.length}/{MAX_SERVICE_LINES})
              </h2>
              <button
                type="button"
                className="rounded-xl border border-[#0f3d2e] px-3 py-2 text-sm font-semibold text-[#0f3d2e]"
                disabled={quoteLines.length >= MAX_SERVICE_LINES}
                onClick={addCustomLine}
              >
                + Ítem libre
              </button>
            </div>
            <p className="mt-1 text-sm text-[#4d5c55]">
              Agregue servicios a mano o productos del inventario. Edite
              descripción, cantidad y precio.
            </p>

            <div className="mt-3 flex flex-wrap items-end gap-2 rounded-2xl border border-dashed border-[#d8d2c4] p-3">
              <label className="min-w-[140px] flex-1 text-sm">
                <span className="mb-1 block font-medium">Buscar inventario</span>
                <input
                  className={field}
                  value={addItemQuery}
                  onChange={(e) => setAddItemQuery(e.target.value)}
                  placeholder="Marca, modelo…"
                  disabled={quoteLines.length >= MAX_SERVICE_LINES}
                />
              </label>
              <label className="min-w-[200px] flex-[2] text-sm">
                <span className="mb-1 block font-medium">Producto</span>
                <select
                  className={field}
                  value={addItemId}
                  disabled={quoteLines.length >= MAX_SERVICE_LINES}
                  onChange={(e) => setAddItemId(e.target.value)}
                >
                  <option value="">
                    {grouped.length ? "Seleccionar…" : "Sin coincidencias"}
                  </option>
                  {grouped.map((g) => (
                    <optgroup
                      key={g.id}
                      label={`${g.label} (${g.items.length})`}
                    >
                      {g.items.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.brand} · {item.model || item.name}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className="rounded-xl bg-[#0f3d2e] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                disabled={!addItemId || quoteLines.length >= MAX_SERVICE_LINES}
                onClick={() => addFromInventory(addItemId)}
              >
                Agregar del inventario
              </button>
            </div>

            <div className="mt-4 space-y-3">
              {quoteLines.length === 0 ? (
                <p className="text-sm text-[#6d7c74]">
                  Aún no hay ítems. Sume un servicio libre o del inventario.
                </p>
              ) : null}
              {quoteLines.map((line) => {
                const item = inventory.find((i) => i.id === line.itemId);
                const sale = saleFromCost(line.costUnitCOP, line.marginPercent);
                const lineIva =
                  chargeIva && line.applyIva
                    ? Math.round(sale * IVA_RATE)
                    : 0;
                return (
                  <div
                    key={line.key}
                    className="rounded-xl border border-[#eee8dc] p-3 text-sm"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs text-[#6d7c74]">
                        {item
                          ? `${categoryLabel(item.category)} · inventario`
                          : "Ítem libre"}{" "}
                        · {cop.format(sale)} / und
                        {lineIva ? ` · IVA ${cop.format(lineIva)}` : " · sin IVA"}
                      </p>
                      <button
                        type="button"
                        className="text-xs font-semibold text-[#9b2c2c] underline"
                        onClick={() =>
                          setQuoteLines((rows) =>
                            rows.filter((r) => r.key !== line.key)
                          )
                        }
                      >
                        Quitar
                      </button>
                    </div>
                    <label className="mt-2 block">
                      Descripción
                      <textarea
                        className={`${field} mt-1 min-h-[64px]`}
                        value={line.label || ""}
                        onChange={(e) =>
                          patchLine(line.key, { label: e.target.value })
                        }
                      />
                    </label>
                    <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                      <label>
                        Cantidad
                        <input
                          type="number"
                          min={0}
                          step="any"
                          className={`${field} mt-1`}
                          value={line.qty}
                          onChange={(e) =>
                            patchLine(line.key, {
                              qty: Math.max(0, Number(e.target.value) || 0),
                            })
                          }
                        />
                      </label>
                      <label>
                        Precio unit. (costo)
                        <input
                          type="number"
                          min={0}
                          className={`${field} mt-1`}
                          value={line.costUnitCOP}
                          onChange={(e) =>
                            patchLine(line.key, {
                              costUnitCOP: Math.max(
                                0,
                                Number(e.target.value) || 0
                              ),
                            })
                          }
                        />
                      </label>
                      {!aliado ? (
                        <label>
                          Margen %
                          <input
                            type="number"
                            className={`${field} mt-1`}
                            value={line.marginPercent}
                            onChange={(e) =>
                              patchLine(line.key, {
                                marginPercent: Number(e.target.value) || 0,
                              })
                            }
                          />
                        </label>
                      ) : null}
                    </div>
                    <label className="mt-3 flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={Boolean(line.applyIva)}
                        onChange={(e) =>
                          patchLine(line.key, { applyIva: e.target.checked })
                        }
                      />
                      IVA 19% en este ítem
                    </label>
                  </div>
                );
              })}
            </div>

            <dl className="os-quote-sum mt-4">
              <div>
                <dt>Subtotal</dt>
                <dd>{cop.format(totals.subtotalCOP)}</dd>
              </div>
              <div>
                <dt>IVA</dt>
                <dd>{cop.format(totals.ivaCOP)}</dd>
              </div>
              <div data-tone="ok">
                <dt>Total</dt>
                <dd>{cop.format(totals.totalCOP)}</dd>
              </div>
            </dl>
          </section>

          <section className="os-panel rounded-2xl border border-[#ddd6c8] bg-white p-5">
            <h2 className="font-semibold">Pago y vigencia</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                className={`rounded-xl px-4 py-2.5 text-sm font-semibold ${
                  paymentKind === "one_shot"
                    ? "bg-[#0f2a1f] text-white"
                    : "border border-[#d8d2c4] bg-white"
                }`}
                onClick={() => setPayMode("one_shot")}
              >
                1 solo contado
              </button>
              <button
                type="button"
                className={`rounded-xl px-4 py-2.5 text-sm font-semibold ${
                  paymentKind === "two_shot"
                    ? "bg-[#0f2a1f] text-white"
                    : "border border-[#d8d2c4] bg-white"
                }`}
                onClick={() => setPayMode("two_shot")}
              >
                2 contados
              </button>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {paymentKind === "two_shot" ? (
                <label className="block text-sm">
                  Anticipo %
                  <input
                    type="number"
                    min={1}
                    max={99}
                    className={`${field} mt-1`}
                    value={advancePercent}
                    onChange={(e) =>
                      setAdvancePercent(
                        Math.min(99, Math.max(1, Number(e.target.value) || 50))
                      )
                    }
                  />
                </label>
              ) : null}
              <label className="block text-sm">
                Vigencia (días)
                <input
                  type="number"
                  min={1}
                  max={45}
                  className={`${field} mt-1`}
                  value={validUntilDays}
                  onChange={(e) =>
                    setValidUntilDays(
                      Math.min(45, Math.max(1, Number(e.target.value) || 15))
                    )
                  }
                />
              </label>
              <label className="block text-sm">
                Fecha
                <input
                  type="date"
                  className={`${field} mt-1`}
                  value={issuedAt}
                  onChange={(e) => setIssuedAt(e.target.value)}
                />
              </label>
            </div>
            <div className="mt-4">
              <ParticularTermsEditor
                terms={particularTerms}
                onChange={setParticularTerms}
              />
            </div>
          </section>
        </div>

        <div className="min-w-0 lg:order-2">
          {liveProposal ? (
            <EpcProposalView proposal={liveProposal} embedded />
          ) : (
            <p className="text-sm text-[#6d7c74]">Preparando propuesta…</p>
          )}
        </div>
      </div>
    </AppShell>
  );
}

export default function CotizadorServiciosPage() {
  return (
    <Suspense
      fallback={
        <AppShell title="Cotizador de servicios" subtitle="Cargando…">
          <p className="text-sm text-[#6d7c74]">Cargando…</p>
        </AppShell>
      }
    >
      <CotizadorServiciosInner />
    </Suspense>
  );
}
