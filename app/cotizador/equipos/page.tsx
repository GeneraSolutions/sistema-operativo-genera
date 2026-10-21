"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { ClientIdFields } from "@/components/ClientIdFields";
import { ClientRutPanel } from "@/components/ClientRutPanel";
import { EpcProposalView } from "@/components/proposal/EpcProposalView";
import { WorkFold } from "@/components/WorkFold";
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
  MAX_EQUIPMENT_LINES,
  buildEquipmentProposal,
  equipmentQuoteTotals,
  warrantiesFromQuoteLines,
} from "@/lib/equipment-quote";
import {
  cloneWarranties,
  type SystemWarranties,
  type WarrantyItem,
} from "@/lib/warranties";
import {
  categoryLabel,
  groupInventoryByCategory,
  loadCustomCategories,
  loadInventory,
} from "@/lib/inventory";
import { saveProposal } from "@/lib/proposal-store";
import {
  contractReleased,
  datasheetsReleased,
  resolveClientDeliverables,
} from "@/lib/proposal-bonuses";
import { lineFromItem, type QuoteLineInput } from "@/lib/quote-engine";
import {
  getStoredQuoteLines,
  loadSavedQuotes,
  mergeQuotes,
  pinActiveQuote,
  putQuoteLines,
  quotesForCotizador,
  saveQuoteSnapshot,
  type SavedQuote,
} from "@/lib/saved-quotes";
import type { CustomCategory, InventoryItem } from "@/types/inventory";
import type { PaymentKind, ProposalToggles } from "@/types/proposal";

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

function CotizadorEquiposInner() {
  const searchParams = useSearchParams();
  const [sessionUser, setSessionUser] = useState<{
    username: string;
    name: string;
    role: string;
  } | null>(null);
  const aliado = isAliadoRole(sessionUser?.role);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [customCats, setCustomCats] = useState<CustomCategory[]>([]);
  const [quoteLines, setQuoteLines] = useState<QuoteLineInput[]>([]);
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
  const [warranties, setWarranties] = useState<SystemWarranties>({
    items: [],
    notes:
      "Garantías de fábrica de los equipos de esta oferta. No incluye instalación, ingeniería ni mano de obra de Genera Solutions SAS.",
  });
  const [partnerCompanyName, setPartnerCompanyName] = useState("");
  const [partnerLogoDataUrl, setPartnerLogoDataUrl] = useState("");
  const [savedQuotes, setSavedQuotes] = useState<SavedQuote[]>([]);
  const [saveFlash, setSaveFlash] = useState("");
  const [linkFlash, setLinkFlash] = useState("");
  const [publishingLink, setPublishingLink] = useState(false);
  const [commercialProposalId, setCommercialProposalId] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [costeoOpen, setCosteoOpen] = useState(false);
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
    kind: "equipos",
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
        ? sessionStorage.getItem("genera.open-quote")
        : null);
    const localQuotes = loadSavedQuotes();
    for (const q of localQuotes) {
      if (q.quoteLines?.length) putQuoteLines(q.id, q.quoteLines);
    }
    setSavedQuotes(localQuotes);
    if (openId) {
      const q = localQuotes.find((row) => row.id === openId);
      if (q?.kind === "epc" || (q && q.kind !== "equipos" && q.systemKwp)) {
        window.location.replace(`/cotizador?quote=${encodeURIComponent(openId)}`);
        return;
      }
      if (q) loadQuote(q, items);
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
          if (q?.kind === "equipos") loadQuote(q, items);
        }
      });
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totals = useMemo(
    () =>
      equipmentQuoteTotals(quoteLines, inventory, {
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
    const proposal = buildEquipmentProposal({
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
      warranties,
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
    warranties,
    toggles,
  ]);

  useEffect(() => {
    setWarranties((prev) =>
      warrantiesFromQuoteLines(quoteLines, inventory, prev)
    );
  }, [quoteLines, inventory]);

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

  function addLine(itemId: string) {
    const id = itemId || addItemId;
    const item = inventory.find((i) => i.id === id);
    if (!item) return;
    setQuoteLines((rows) => {
      if (rows.length >= MAX_EQUIPMENT_LINES) return rows;
      return [...rows, lineFromItem(`eq-${crypto.randomUUID().slice(0, 8)}`, item, 1)];
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
    if (q.partnerCompanyName) setPartnerCompanyName(q.partnerCompanyName);
    if (q.partnerLogoDataUrl) setPartnerLogoDataUrl(q.partnerLogoDataUrl);
    const lines =
      getStoredQuoteLines(q.id) ??
      q.quoteLines ??
      [];
    setQuoteLines(lines.slice(0, MAX_EQUIPMENT_LINES));
    void items;
  }

  function snapshotCurrent(name?: string): SavedQuote {
    return {
      id: editingQuoteId.current || crypto.randomUUID(),
      kind: "equipos",
      name:
        name ||
        `${clientName || "Equipos"} · ${quoteLines.length} ítem${
          quoteLines.length === 1 ? "" : "s"
        }`,
      savedAt: new Date().toISOString(),
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
      includeBattery: totals.lines.some((l) => l.category === "battery"),
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
      const url = new URL(window.location.href);
      url.searchParams.set("quote", saved.id);
      window.history.replaceState(null, "", `${url.pathname}${url.search}`);
      setSavedQuotes(loadSavedQuotes());
      const res = await fetch("/api/archivo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quote: saved }),
      });
      setSaveFlash(
        res.ok
          ? "Cotización de equipos guardada."
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
      setLinkFlash("No hay conexión para publicar.");
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
    const url = `${window.location.origin}${path}`;
    await navigator.clipboard?.writeText(url).catch(() => undefined);
    setLinkFlash(
      opts?.doc === "contrato"
        ? "Enlace del contrato copiado. Ábralo, pulse Imprimir / PDF y envíelo al cliente."
        : opts?.contrato !== undefined
          ? contrato
            ? "Contrato liberado. El botón aparece en el enlace de la cotización."
            : "Contrato oculto de nuevo en el enlace del cliente."
          : fichas
            ? "Enlace copiado. Las fichas ya están visibles."
            : "Enlace copiado. Las fichas quedan ocultas hasta que las libere."
    );
    if (opts?.open !== false) {
      window.open(path, "_blank", "noopener,noreferrer");
    }
    window.setTimeout(() => setLinkFlash(""), 4500);
  }

  const field =
    "w-full rounded-xl border border-[#d8d2c4] bg-[#fbfaf6] px-3 py-2.5";

  function setPayMode(value: "one_shot" | "two_shot") {
    setPaymentKind(value);
    setAdvancePercent(value === "one_shot" ? 100 : 50);
  }

  function patchWarranty(id: string, patch: Partial<WarrantyItem>) {
    setWarranties((w) => ({
      ...w,
      items: w.items.map((item) =>
        item.id === id ? { ...item, ...patch } : item
      ),
    }));
  }

  const payModes = (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        className={`rounded-xl px-4 py-2.5 text-sm font-semibold ${
          paymentKind === "one_shot"
            ? "bg-[#0f2a1f] text-white"
            : "border border-[#d8d2c4] bg-white text-[#12241c]"
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
            : "border border-[#d8d2c4] bg-white text-[#12241c]"
        }`}
        onClick={() => setPayMode("two_shot")}
      >
        2 contados
      </button>
    </div>
  );

  return (
    <AppShell
      title="Cotizador de equipos"
      subtitle="Hasta 12 ítems · sin proyecto llave en mano"
    >
      <div className="mb-4 flex flex-wrap gap-2 print:hidden">
        <button
          type="button"
          onClick={() => void persistQuote(snapshotCurrent())}
          className="rounded-full bg-[#d4b46a] px-3 py-1.5 text-xs font-semibold text-[#12241c]"
        >
          Guardar
        </button>
        <button
          type="button"
          disabled={!liveProposal || publishingLink || quoteLines.length === 0}
          onClick={() => void publishCommercial()}
          className="rounded-full bg-[#0f2a1f] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
        >
          {publishingLink ? "Publicando…" : "Publicar enlace"}
        </button>
        <button
          type="button"
          disabled={!liveProposal || publishingLink || quoteLines.length === 0}
          onClick={() => void publishCommercial({ doc: "contrato" })}
          className="rounded-full border border-[#d4b46a] bg-[#fff8e8] px-3 py-1.5 text-xs font-semibold text-[#8a6b2a] disabled:opacity-50"
        >
          Contrato PDF
        </button>
        <button
          type="button"
          disabled={!liveProposal || publishingLink || quoteLines.length === 0}
          onClick={() =>
            void publishCommercial({
              contrato: !contractReleased(toggles),
              open: false,
            })
          }
          className="rounded-full border border-[#d4b46a] px-3 py-1.5 text-xs font-semibold text-[#8a6b2a] disabled:opacity-50"
        >
          {contractReleased(toggles) ? "Ocultar contrato" : "Liberar contrato"}
        </button>
        {commercialProposalId ? (
          <>
            <a
              href={`/propuesta/epc/${commercialProposalId}`}
              className="rounded-full border border-[#1f6b45] px-3 py-1.5 text-xs font-semibold text-[#1f6b45]"
            >
              Ver propuesta
            </a>
            {contractReleased(toggles) ? (
              <a
                href={`/propuesta/epc/${commercialProposalId}/contrato`}
                className="rounded-full border border-[#1f6b45] px-3 py-1.5 text-xs font-semibold text-[#1f6b45]"
              >
                Abrir contrato
              </a>
            ) : null}
          </>
        ) : null}
      </div>
      {saveFlash ? <p className="mb-3 text-sm text-[#1f6b45]">{saveFlash}</p> : null}
      {linkFlash ? <p className="mb-3 text-sm text-[#1f6b45]">{linkFlash}</p> : null}

      <section className="os-panel mb-5 rounded-2xl border border-[#ddd6c8] bg-white p-4 print:hidden">
        <p className="text-[11px] font-semibold tracking-[0.16em] text-[#6d7c74] uppercase">
          Forma de pago
        </p>
        <div className="mt-2">{payModes}</div>
        <p className="mt-2 text-xs text-[#6d7c74]">
          {paymentKind === "one_shot"
            ? "El cliente paga el 100% en un solo contado."
            : `Dos contados: ${advancePercent}% anticipo y ${100 - advancePercent}% contra despacho.`}
        </p>
      </section>

      {visibleQuotes.length ? (
        <p className="os-page-intro mb-4 text-xs text-[#6b6458]">
          Guardadas:{" "}
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
        <div className="min-w-0 lg:order-2">
          {liveProposal ? (
            <EpcProposalView proposal={liveProposal} embedded />
          ) : (
            <p className="text-sm text-[#6d7c74]">Preparando propuesta…</p>
          )}
        </div>
        <div className="space-y-5 lg:order-1">
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
              Cliente agente retenedor (ReteFuente / ReteICA)
            </label>
            <label className="mt-2 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={clientGranContribuyente}
                onChange={(e) => setClientGranContribuyente(e.target.checked)}
              />
              Gran contribuyente (ReteIVA)
            </label>
            <label className="mt-2 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={chargeIva}
                onChange={(e) => setChargeIva(e.target.checked)}
              />
              Cobrar IVA en ítems gravados
            </label>
          </section>

          <section className="os-panel rounded-2xl border border-[#ddd6c8] bg-white p-5">
            <h2 className="font-semibold">
              Equipos ({quoteLines.length}/{MAX_EQUIPMENT_LINES})
            </h2>
            <p className="mt-1 text-sm text-[#4d5c55]">
              {activeInventory.length} referencias en catálogo. Puede sumar hasta{" "}
              {MAX_EQUIPMENT_LINES} en esta cotización (inversor, batería, panel,
              protecciones…).
            </p>
            <div className="mt-3 flex flex-wrap items-end gap-2 rounded-2xl border border-dashed border-[#d8d2c4] p-3">
              <label className="min-w-[140px] flex-1 text-sm">
                <span className="mb-1 block font-medium">Buscar</span>
                <input
                  className={field}
                  value={addItemQuery}
                  onChange={(e) => setAddItemQuery(e.target.value)}
                  placeholder="Marca, modelo o tipo…"
                  disabled={quoteLines.length >= MAX_EQUIPMENT_LINES}
                />
              </label>
              <label className="min-w-[200px] flex-[2] text-sm">
                <span className="mb-1 block font-medium">Agregar del catálogo</span>
                <select
                  className={field}
                  value={addItemId}
                  disabled={quoteLines.length >= MAX_EQUIPMENT_LINES}
                  onChange={(e) => setAddItemId(e.target.value)}
                >
                  <option value="">
                    {grouped.length ? "Seleccionar producto…" : "Sin coincidencias"}
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
                disabled={
                  !addItemId || quoteLines.length >= MAX_EQUIPMENT_LINES
                }
                onClick={() => addLine(addItemId)}
              >
                Agregar producto
              </button>
            </div>
            <div className="mt-4 space-y-3">
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
                      <div>
                        <p className="font-medium">
                          {line.label || item?.name || "Equipo"}
                        </p>
                        <p className="text-xs text-[#6d7c74]">
                          {item ? categoryLabel(item.category) : ""} ·{" "}
                          {cop.format(sale)} / und
                          {lineIva
                            ? ` · IVA ${cop.format(lineIva)}`
                            : " · sin IVA"}
                        </p>
                      </div>
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
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <label>
                        Cantidad
                        <input
                          type="number"
                          min={1}
                          className={`${field} mt-1`}
                          value={line.qty}
                          onChange={(e) => {
                            const n = Math.max(1, Number(e.target.value) || 1);
                            setQuoteLines((rows) =>
                              rows.map((r) =>
                                r.key === line.key ? { ...r, qty: n } : r
                              )
                            );
                          }}
                        />
                      </label>
                      {!aliado ? (
                        <label>
                          Margen %
                          <input
                            type="number"
                            className={`${field} mt-1`}
                            value={line.marginPercent}
                            onChange={(e) => {
                              const n = Number(e.target.value) || 0;
                              setQuoteLines((rows) =>
                                rows.map((r) =>
                                  r.key === line.key
                                    ? { ...r, marginPercent: n }
                                    : r
                                )
                              );
                            }}
                          />
                        </label>
                      ) : null}
                    </div>
                    <label className="mt-3 flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={Boolean(line.applyIva)}
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
                      IVA 19% en este equipo
                    </label>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="os-panel rounded-2xl border border-[#ddd6c8] bg-white p-5">
            <h2 className="font-semibold">Pago y vigencia</h2>
            <div className="mt-3">{payModes}</div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="block text-sm sm:col-span-2">
                Modalidad
                <select
                  className={`${field} mt-1`}
                  value={
                    paymentKind === "one_shot" ? "one_shot" : "two_shot"
                  }
                  onChange={(e) =>
                    setPayMode(e.target.value as "one_shot" | "two_shot")
                  }
                >
                  <option value="one_shot">1 solo contado</option>
                  <option value="two_shot">2 contados</option>
                </select>
              </label>
              {paymentKind === "two_shot" ? (
                <label className="block text-sm">
                  Anticipo %
                  <input
                    type="number"
                    min={0}
                    max={100}
                    className={`${field} mt-1`}
                    value={advancePercent}
                    onChange={(e) =>
                      setAdvancePercent(
                        Math.min(100, Math.max(0, Number(e.target.value) || 0))
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
                  onChange={(e) => setIssuedAt(e.target.value || localISODate())}
                />
              </label>
            </div>
          </section>

          <section className="os-panel rounded-2xl border border-[#ddd6c8] bg-white p-5">
            <h2 className="font-semibold">Garantías de los equipos</h2>
            <p className="mt-1 text-sm text-[#4d5c55]">
              Años de fábrica que verá el cliente en la cotización. Edite cada
              equipo o agregue una partida.
            </p>
            <div className="mt-3 space-y-3">
              {warranties.items.map((item) => (
                <div
                  key={item.id}
                  className="rounded-xl border border-[#eee8dc] p-3"
                >
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={item.enabled}
                      onChange={(e) =>
                        patchWarranty(item.id, { enabled: e.target.checked })
                      }
                    />
                    Incluir en la cotización
                  </label>
                  <div className="mt-2 grid gap-2 sm:grid-cols-[1.4fr_0.5fr]">
                    <label className="block text-sm">
                      Equipo
                      <input
                        className={`${field} mt-1`}
                        value={item.label}
                        onChange={(e) =>
                          patchWarranty(item.id, { label: e.target.value })
                        }
                      />
                    </label>
                    <label className="block text-sm">
                      Años
                      <input
                        type="number"
                        min={0}
                        className={`${field} mt-1`}
                        value={item.years}
                        onChange={(e) =>
                          patchWarranty(item.id, {
                            years: Number(e.target.value) || 0,
                          })
                        }
                      />
                    </label>
                  </div>
                  <label className="mt-2 block text-sm">
                    Detalle
                    <input
                      className={`${field} mt-1`}
                      value={item.detail}
                      placeholder="fábrica, ciclos, ≥80%…"
                      onChange={(e) =>
                        patchWarranty(item.id, { detail: e.target.value })
                      }
                    />
                  </label>
                </div>
              ))}
            </div>
            <button
              type="button"
              className="mt-3 text-sm font-semibold text-[#1f6b45] underline"
              onClick={() =>
                setWarranties((w) => ({
                  ...w,
                  items: [
                    ...w.items,
                    {
                      id: `custom-${crypto.randomUUID().slice(0, 8)}`,
                      label: "Garantía adicional",
                      years: 1,
                      detail: "",
                      enabled: true,
                    },
                  ],
                }))
              }
            >
              Agregar garantía
            </button>
            <label className="mt-3 block text-sm">
              Nota
              <textarea
                rows={2}
                className={`${field} mt-1`}
                value={warranties.notes}
                onChange={(e) =>
                  setWarranties((w) => ({ ...w, notes: e.target.value }))
                }
              />
            </label>
          </section>

          {!aliado ? (
            <section className="os-fold-dark os-panel rounded-2xl border border-[#1a3d2e] bg-[#0f2a1f] p-5 text-[#e8efe9]">
              <WorkFold
                title={`Costeo interno · ${cop.format(totals.totalCOP)}`}
                open={costeoOpen}
                onToggle={() => setCosteoOpen((v) => !v)}
              >
                <p className="text-sm text-[#c9d7cf]">
                  Costo {cop.format(totals.costCOP)} · Venta{" "}
                  {cop.format(totals.subtotalCOP)} · IVA {cop.format(totals.ivaCOP)}
                </p>
                {clientWithholds ? (
                  <p className="mt-2 text-sm text-[#d4b46a]">
                    Retenciones estimadas{" "}
                    {cop.format(totals.pl.taxes.withholdingsCOP)} · caja{" "}
                    {cop.format(totals.pl.cashFromClientCOP)}
                  </p>
                ) : (
                  <p className="mt-2 text-sm text-[#c9d7cf]">
                    Sin retenciones de cliente.
                  </p>
                )}
              </WorkFold>
            </section>
          ) : null}
        </div>
      </div>
    </AppShell>
  );
}

export default function CotizadorEquiposPage() {
  return (
    <Suspense
      fallback={
        <AppShell title="Cotizador de equipos" subtitle="Cargando…">
          <p className="text-sm text-[#6d7c74]">Preparando cotizador de equipos…</p>
        </AppShell>
      }
    >
      <CotizadorEquiposInner />
    </Suspense>
  );
}
