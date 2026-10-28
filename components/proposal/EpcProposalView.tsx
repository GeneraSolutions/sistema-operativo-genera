"use client";

import { useEffect, useState, type ReactNode } from "react";
import { BrandLogo } from "@/components/BrandLogo";
import { formatDocDate } from "@/components/informes/DocSheet";
import { EpcProposalClassic } from "@/components/proposal/EpcProposalClassic";
import { MonthlyEnergyChart } from "@/components/proposal/MonthlyEnergyChart";
import { formatClientDocument } from "@/lib/client-party";
import { resolveClientDeliverables } from "@/lib/proposal-bonuses";
import {
  cloneWarranties,
  visibleWarrantyItems,
  yearsLabel,
} from "@/lib/warranties";
import type { EpcProposal } from "@/types/proposal";

const cop = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

const num = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 1 });

const MODEL_KEY = "genera-quote-model";
type QuoteModel = "actual" | "tablero";

function readQuoteModel(value: string | null): QuoteModel | null {
  if (value === "tablero") return "tablero";
  if (value === "actual" || value === "anterior") return "actual";
  return null;
}

function useQuoteModel(): [QuoteModel, (next: QuoteModel) => void] {
  const [model, setModel] = useState<QuoteModel>("tablero");
  useEffect(() => {
    const saved = readQuoteModel(window.localStorage.getItem(MODEL_KEY));
    if (saved) setModel(saved);
    const onStorage = (event: StorageEvent) => {
      if (event.key !== MODEL_KEY) return;
      const next = readQuoteModel(event.newValue);
      if (next) setModel(next);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
  const choose = (next: QuoteModel) => {
    setModel(next);
    window.localStorage.setItem(MODEL_KEY, next);
  };
  return [model, choose];
}

export function EpcProposalView({
  proposal: p,
  embedded = false,
}: {
  proposal: EpcProposal;
  embedded?: boolean;
}) {
  const co2Kg = Math.round(p.annualGenerationKWh * 0.126);
  const co2T = co2Kg / 1000;
  const trees = Math.round(co2Kg / 21);
  const km = Math.round(co2Kg / 0.192);
  const warranties = cloneWarranties(p.warranties);
  const warrantyItems = visibleWarrantyItems(warranties, p.includeBattery);
  const clientDocs = resolveClientDeliverables(p.toggles);
  const isEquipos = p.kind === "equipos";
  const nitLabel = formatClientDocument(
    p.clientIdType,
    p.clientNit || "",
    p.clientDv
  );
  const showLinePrices = p.commercialLines.some(
    (line) => line.saleTotalCOP != null
  );
  const bonuses = p.bonuses.filter(
    (b) => b.id !== "ev-charger" && !/cargador\s*ev/i.test(b.title)
  );
  const pulse: { label: string; value: string; hint: string }[] = [];
  const ledger: { label: string; value: string; hint?: string }[] = [];
  if (!isEquipos) {
    if (p.toggles.showRoiPayback) {
      pulse.push({
        label: "ROI 25 años",
        value: `${num.format(p.roiPercentage)}%`,
        hint: `Payback ${num.format(p.paybackYearsSimple)} años`,
      });
      pulse.push({
        label: "VAN @ 12%",
        value: cop.format(p.npvCOP),
        hint: p.toggles.showTir
          ? `TIR ${num.format(p.irrPercentage)}%`
          : "Valor actual neto",
      });
    }
    pulse.push({
      label: "Ahorro 25 años",
      value: cop.format(p.total25ySavingsCOP),
      hint: "Energía + tributario",
    });
    if (pulse.length < 3) {
      pulse.unshift({
        label: "Ahorro anual",
        value: cop.format(p.annualEnergySavingsCOP),
        hint: "100% factura",
      });
    }
    const shown = new Set(pulse.map((item) => item.label));
    const addMetric = (label: string, value: string, hint?: string) => {
      if (!shown.has(label)) ledger.push({ label, value, hint });
    };
    addMetric("Ahorro anual", cop.format(p.annualEnergySavingsCOP), "100% factura");
    addMetric(
      "Ahorro anual total",
      cop.format(p.blendedAnnualSavingsCOP),
      "Energía + tributario + IVA año 1"
    );
    if (p.toggles.showDeductionLey1715) {
      addMetric(
        "Renta año 1",
        cop.format(p.year1TaxSavingsCOP),
        "50% ÷ 15 años · 35% renta"
      );
      addMetric(
        "Deducción renta",
        cop.format(p.taxes.rentaDeductionBaseCOP),
        "Hasta el 50% de la inversión"
      );
    }
    if (p.toggles.showIvaAranceles) {
      addMetric(
        "Devolución IVA",
        cop.format(p.taxes.ivaRefundCOP),
        "Equipos gravados · Ley 1715/2099"
      );
      addMetric("IVA paneles", "100%", "Excluidos de IVA");
    }
    if (p.toggles.showDepreciacion) {
      addMetric(
        "Depreciación",
        cop.format(p.taxes.acceleratedDepreciationCOP),
        `${cop.format(p.taxes.annualDepreciationCOP)} / año`
      );
    }
    addMetric(
      "Generación",
      `${num.format(p.annualGenerationKWh)} kWh`,
      ["por año", p.peakSunHours ? `${num.format(p.peakSunHours)} HSP` : ""]
        .filter(Boolean)
        .join(" · ")
    );
    addMetric(
      "CO₂ evitado",
      `${num.format(co2T)} t`,
      `${num.format(co2Kg)} kg · ${trees} árboles · ${num.format(km)} km`
    );
  }
  const chapters = [
    !isEquipos ? { id: "gq-sistema", label: "Sistema" } : null,
    { id: "gq-inversion", label: "Inversión" },
    !isEquipos ? { id: "gq-cifras", label: "Cifras" } : null,
    !isEquipos && bonuses.length ? { id: "gq-planta", label: "Planta" } : null,
    { id: "gq-cierre", label: "Cierre" },
  ].filter((item): item is { id: string; label: string } => Boolean(item));
  const index = (id: string) =>
    String(chapters.findIndex((item) => item.id === id) + 1).padStart(2, "0");
  const [model, chooseModel] = useQuoteModel();
  const modelBar = (
    <div className="quote-model-switch print:hidden" role="group" aria-label="Modelo de cotización">
      <span>Modelo</span>
      <button
        type="button"
        aria-pressed={model === "actual"}
        onClick={() => chooseModel("actual")}
      >
        Actual
      </button>
      <button
        type="button"
        aria-pressed={model === "tablero"}
        onClick={() => chooseModel("tablero")}
      >
        Tablero
      </button>
      <em>La cotización que usas hoy, o esta propuesta.</em>
    </div>
  );

  if (model === "actual") {
    return (
      <>
        {modelBar}
        <EpcProposalClassic proposal={p} embedded={embedded} />
      </>
    );
  }

  return (
    <div className={`proposal-print gq is-brief is-signal ${embedded ? "is-embedded" : ""}`}>
      {modelBar}
      <article className="gq-sheet">
        <section className="gq-cover">
          <div className="gq-cover-top">
            <ProposalMark
              height={embedded ? 36 : 44}
              logoUrl={p.partnerLogoDataUrl}
              companyName={p.companyName}
            />
            <p>
              {formatDocDate(p.createdAt)}
              <span> · {p.validUntilDays} días</span>
            </p>
          </div>
          {p.siteImageDataUrl ? (
            <figure className="gq-photo">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.siteImageDataUrl}
                alt={`Lugar del proyecto · ${p.clientName}`}
              />
            </figure>
          ) : null}

          <div className="gq-stage">
            <div>
              <p className="gq-tag">{p.companyTag}</p>
              <h1>{p.clientName}</h1>
              <p className="gq-place">
                {[
                  p.clientCity,
                  nitLabel,
                  isEquipos ? p.clientEmail : "",
                  isEquipos ? p.clientPhone : "",
                  isEquipos ? p.clientAddress : "",
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              <div className="gq-actions print:hidden">
                {clientDocs.contrato ? (
                  <a href={`/propuesta/epc/${p.id}/contrato`}>Contrato</a>
                ) : null}
                {clientDocs.fichas ? (
                  <a href={`/propuesta/epc/${p.id}/fichas`}>Fichas técnicas</a>
                ) : null}
                <button type="button" onClick={() => window.print()}>
                  Imprimir / PDF
                </button>
              </div>
            </div>

            {isEquipos ? (
              <div className="gq-stack">
                <p>Suministro</p>
                <strong>
                  {p.commercialLines.length}
                  <small>{p.commercialLines.length === 1 ? " ítem" : " ítems"}</small>
                </strong>
                <span>Sin instalación · sin obra</span>
              </div>
            ) : (
              <div className="gq-stack">
                <p>Composición</p>
                <strong>
                  {num.format(p.systemKwp)}
                  <small> kWp</small>
                </strong>
                <ul>
                  <li>
                    <span>Paneles</span>
                    <b>
                      {p.panelCount} × {p.panelWatts}W
                    </b>
                    <em>{p.panelLabel}</em>
                  </li>
                  <li>
                    <span>Inversor</span>
                    <b>1 × {num.format(p.inverterKwAc)} kW</b>
                    <em>{p.inverterLabel}</em>
                  </li>
                  <li>
                    <span>Baterías</span>
                    <b>{p.includeBattery ? `${p.batteryKwh} kWh` : "No incluida"}</b>
                    <em>{p.includeBattery ? p.batteryLabel : "Solo autoconsumo / red"}</em>
                  </li>
                </ul>
              </div>
            )}
          </div>
        </section>

        {!isEquipos ? (
          <Chapter id="gq-sistema" n={index("gq-sistema")} title="El sistema">
            <div className="gq-split">
              <div>
                {p.toggles.showCharts ? (
                  <div className="gq-chart">
                    <div className="gq-chart-head">
                      <h3>Generación solar vs. consumo del cliente</h3>
                      <p>
                        kWh / mes · Atlas IDEAM de radiación solar
                        {p.ideamStationName ? ` · ${p.ideamStationName}` : ""}
                      </p>
                    </div>
                    <MonthlyEnergyChart data={p.monthlyEnergy} tone="signal" />
                  </div>
                ) : null}
                <p className="gq-hint">
                  {num.format(p.systemKwp)} kWp · 8 categorías · Ingeniería integral · NTC 2050 ·
                  NSR-10 — {p.companyName}
                </p>
              </div>
              <div className="gq-bundles">
              {p.bundles.map((b) => (
                <article key={b.index}>
                  <span>{String(b.index).padStart(2, "0")}</span>
                  <div>
                    <strong>{b.title}</strong>
                    <p>{b.description}</p>
                    {b.detail ? <em>{b.detail}</em> : null}
                  </div>
                </article>
              ))}
              </div>
            </div>
          </Chapter>
        ) : null}

        <Chapter
          id="gq-inversion"
          n={index("gq-inversion")}
          title="La inversión"
          hint={
            isEquipos
              ? "Suministro de equipos · sin instalación"
              : "Suministros y servicios integrales · 8 categorías"
          }
        >
          <div className="gq-lines">
            {p.commercialLines.map((line) => (
              <article key={line.index}>
                <span>{String(line.index).padStart(2, "0")}</span>
                <div>
                  <strong>{line.title}</strong>
                  <p>{line.description}</p>
                </div>
                <b>
                  {showLinePrices ? cop.format(line.saleTotalCOP ?? 0) : line.qty}
                  {showLinePrices ? <em>× {line.qty}</em> : null}
                </b>
              </article>
            ))}
          </div>
          <p className="gq-hint">
            {isEquipos
              ? "Suministro de equipos. No incluye instalación, ingeniería, visita técnica ni obra civil."
              : "Inversión llave en mano. El desglose de costos unitarios es interno de Genera Solutions SAS."}
          </p>
          {p.withholdingsNote ? <p className="gq-note">{p.withholdingsNote}</p> : null}
          <div className="gq-settle">
          <div className="gq-math">
            <p>
              <span>Subtotal</span>
              <span>{cop.format(p.subtotalCOP)}</span>
            </p>
            <p>
              <span>{p.ivaCOP > 0 ? "IVA (19%)" : "IVA"}</span>
              <span>{p.ivaCOP > 0 ? cop.format(p.ivaCOP) : "No aplicado"}</span>
            </p>
            {p.toggles.showPricePerKwp && p.systemKwp > 0 ? (
              <p>
                <span>Por kWp</span>
                <span>{cop.format(Math.round(p.totalCOP / p.systemKwp))}</span>
              </p>
            ) : null}
          </div>
          <div className="gq-total">
            <span>Valor total</span>
            <strong>{cop.format(p.totalCOP)}</strong>
          </div>
          <div className="gq-pay">
            {p.payment.installments.map((item) => (
              <article key={item.key}>
                <p>{item.label}</p>
                <strong>
                  {item.key === "tarifa"
                    ? `${cop.format(item.amountCOP)}/kWh`
                    : cop.format(item.amountCOP)}
                </strong>
                <span>
                  {item.percent != null ? `${item.percent} % del total` : item.hint}
                </span>
              </article>
            ))}
          </div>
          </div>
          {p.payment.kind === "ppa" ? (
            <p className="gq-prose">
              Modelo PPA: Genera Solutions SAS invierte y opera la planta. El cliente paga la energía
              generada a {cop.format(p.payment.ppaPricePerKWhCOP ?? 0)}/kWh durante{" "}
              {p.payment.ppaYears} años (máximo 25). Inversión de planta (referencia):{" "}
              {cop.format(p.totalCOP)}.
            </p>
          ) : p.payment.kind === "financed" ? (
            <p className="gq-prose">
              Cuota mensual estimada {cop.format(p.payment.monthlyInstallmentCOP ?? 0)}{" "}
              durante {p.payment.financedMonths} meses
              {p.payment.financedEaPercent
                ? ` · TEA ${p.payment.financedEaPercent}%.`
                : " · sin intereses."}
            </p>
          ) : null}
        </Chapter>

        {!isEquipos ? (
          <Chapter id="gq-cifras" n={index("gq-cifras")} title="Las cifras">
            <div className="gq-pulse">
              {pulse.map((item) => (
                <div key={item.label}>
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                  <em>{item.hint}</em>
                </div>
              ))}
            </div>
            <div className="gq-ledger">
              {ledger.map((item, i) => (
                <div
                  key={item.label}
                  className={
                    i === ledger.length - 1 && ledger.length % 2 === 1 ? "is-wide" : undefined
                  }
                >
                  <span>
                    {item.label}
                    {item.hint ? <em>{item.hint}</em> : null}
                  </span>
                  <b>{item.value}</b>
                </div>
              ))}
            </div>
          </Chapter>
        ) : null}

        {!isEquipos && bonuses.length ? (
          <Chapter
            id="gq-planta"
            n={index("gq-planta")}
            title="Con la planta"
            hint="Bonos y compromisos Genera Solutions SAS · valor agregado incluido en su propuesta"
          >
            <div className="gq-pledges">
                {bonuses.map((b, i) => (
                  <article key={b.id}>
                    <span>{String(i + 1).padStart(2, "0")}</span>
                    <div>
                      <strong>{b.title}</strong>
                      <em>{b.tagline}</em>
                      {b.document && clientDocs[b.document.slug] ? (
                        <a href={`/propuesta/epc/${p.id}/${b.document.slug}`}>
                          {b.document.cta}
                        </a>
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>
            <p className="gq-hint">
              * Bonos y compromisos sujetos a condiciones del contrato y alcance del
              proyecto cotizado. Los documentos se personalizan con los equipos de
              esta oferta.
            </p>
          </Chapter>
        ) : null}

        <Chapter id="gq-cierre" n={index("gq-cierre")} title="Cierre" hint="">
          <div className="gq-ledger">
            {isEquipos ? (
              <div className="is-wide">
                <span>
                  Alcance
                  <em>
                    Equipos listados, con ficha de fábrica cuando exista. No incluye
                    instalación, tableros, cableado de obra, RETIE ni trámites UPME.
                  </em>
                </span>
                <b>Suministro</b>
              </div>
            ) : (
              <div className="is-wide">
                <span>
                  Mantenimiento
                  <em>
                    Limpieza de paneles, estructura, conexiones, inversor y monitoreo.
                    Primer año incluido después de la puesta en marcha.
                  </em>
                </span>
                <b>Año 1</b>
              </div>
            )}
            {warrantyItems.map((item) => (
              <div key={item.id}>
                <span>
                  {item.label}
                  {item.detail.trim() ? ` · ${item.detail.trim()}` : ""}
                </span>
                <b>{yearsLabel(item.years)}</b>
              </div>
            ))}
          </div>
          {!warrantyItems.length ? (
            <p className="gq-hint">Garantías según acuerdo comercial de este proyecto.</p>
          ) : null}
          {warranties.notes.trim() ? (
            <p className="gq-hint">{warranties.notes.trim()}</p>
          ) : null}
          <div className="gq-close-grid">
            <div>
              <h3>{isEquipos ? "Facturación" : "Marco legal"}</h3>
              <ul>
                {isEquipos ? (
                  <>
                    <li>Factura de venta de equipos · IVA según ítem</li>
                    {p.withholdingsNote ? (
                      <li>{p.withholdingsNote}</li>
                    ) : (
                      <li>Retenciones según RUT del cliente al momento de facturar</li>
                    )}
                    <li>Garantía de fábrica, no de instalación</li>
                  </>
                ) : (
                  <>
                    <li>Ley 1715 de 2014</li>
                    <li>Ley 2099 de 2021</li>
                    <li>RETIE · UPME</li>
                  </>
                )}
              </ul>
            </div>
            <div>
              <h3>Condiciones de venta</h3>
              <ul>
                <li>Cotización válida por {p.validUntilDays} días calendario</li>
                <li>Precios sujetos a disponibilidad de equipos</li>
                <li>
                  {isEquipos
                    ? "No incluye instalación, ingeniería ni adecuaciones de sitio"
                    : "No incluye obras civiles ni adecuaciones MT salvo mención expresa"}
                </li>
              </ul>
            </div>
          </div>
        </Chapter>

        <footer className="gq-foot">
          <p>
            Transformando el sol en su mejor inversión: en {p.companyName} combinamos
            excelencia técnica y normativa para garantizarle energía limpia, ahorro real y
            respaldo absoluto durante toda la vida útil de su planta.
          </p>
          <div>
            <span>info@generasolutions.co</span>
            <span>www.generasolutions.com.co</span>
            <span>317 455 3288</span>
          </div>
          <small>{p.companyName} · Energía limpia · Futuro brillante</small>
        </footer>
      </article>
    </div>
  );
}

function Chapter({
  id,
  n,
  title,
  hint,
  children,
}: {
  id: string;
  n: string;
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="gq-sec">
      <div className="gq-kicker">
        <span>{n}</span>
        <h2>{title}</h2>
      </div>
      <div>
        {hint ? <p className="gq-hint gq-lead">{hint}</p> : null}
        {children}
      </div>
    </section>
  );
}

function ProposalMark({
  height,
  logoUrl,
  companyName,
}: {
  height: number;
  logoUrl?: string;
  companyName: string;
}) {
  if (logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logoUrl}
        alt={companyName}
        style={{ height, width: "auto", maxWidth: 220 }}
      />
    );
  }
  return <BrandLogo height={height} />;
}
