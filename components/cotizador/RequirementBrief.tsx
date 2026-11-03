"use client";

import { useRef, useState } from "react";
import { Check, Mic, Sparkles } from "lucide-react";
import {
  draftRequirement,
  type BriefQuotePreview,
  type RequirementDraft,
} from "@/lib/requirement-brief";
import type { InventoryItem } from "@/types/inventory";

type Dictation = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: {
    results: ArrayLike<ArrayLike<{ transcript: string }>> & { length: number };
  }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

export function RequirementBrief({
  inventory,
  peakSunHours,
  onApply,
  estimate,
}: {
  inventory: InventoryItem[];
  peakSunHours: number;
  onApply: (draft: RequirementDraft) => void;
  estimate: (draft: RequirementDraft) => BriefQuotePreview | null;
}) {
  const [open, setOpen] = useState(true);
  const [basisOpen, setBasisOpen] = useState(false);
  const [text, setText] = useState("");
  const [opinion, setOpinion] = useState("");
  const [draft, setDraft] = useState<RequirementDraft | null>(null);
  const [applied, setApplied] = useState(false);
  const [miss, setMiss] = useState("");
  const [hearing, setHearing] = useState<"pedido" | "opinion" | null>(null);
  const recRef = useRef<{ stop: () => void } | null>(null);

  function dictate(target: "pedido" | "opinion") {
    if (hearing === target) {
      recRef.current?.stop();
      setHearing(null);
      return;
    }
    const host = window as Window & {
      SpeechRecognition?: new () => Dictation;
      webkitSpeechRecognition?: new () => Dictation;
    };
    const Ctor = host.SpeechRecognition || host.webkitSpeechRecognition;
    if (!Ctor) {
      setMiss("Este navegador no dicta. Ábralo en Chrome o Edge y permita el micrófono.");
      return;
    }
    recRef.current?.stop();
    const rec = new Ctor();
    rec.lang = "es-CO";
    rec.interimResults = false;
    rec.continuous = false;
    rec.onresult = (event) => {
      const chunk = Array.from({ length: event.results.length }, (_, index) =>
        event.results[index][0].transcript
      )
        .join(" ")
        .trim();
      if (!chunk) return;
      const write = target === "pedido" ? setText : setOpinion;
      write((prev) => (prev.trim() ? `${prev.trim()} ${chunk}` : chunk));
      setApplied(false);
    };
    rec.onerror = (event) => {
      if (event.error === "not-allowed") {
        setMiss("El micrófono está bloqueado. Permítalo en el navegador y vuelva a pulsar.");
      } else if (event.error !== "aborted" && event.error !== "no-speech") {
        setMiss("No alcancé a oír. Intente de nuevo, cerca del micrófono.");
      }
      setHearing(null);
    };
    rec.onend = () => setHearing(null);
    recRef.current = rec;
    setMiss("");
    setHearing(target);
    try {
      rec.start();
    } catch {
      setHearing(null);
      setMiss("El micrófono no arrancó. Cierre otra pestaña que lo esté usando.");
    }
  }

  function review() {
    setApplied(false);
    setMiss("");
    setBasisOpen(false);
    setDraft(draftRequirement(text, inventory, peakSunHours));
  }

  function correct() {
    const next = draftRequirement(text, inventory, peakSunHours, opinion);
    if (!next.revisionHeard.length) {
      setMiss(
        "No cambié la base. Diga el consumo, los paneles, los kWp, la ciudad, el inversor o si va sin batería."
      );
      setApplied(false);
      return;
    }
    setMiss("");
    setDraft(next);
    setBasisOpen(false);
    if (next.ok) {
      onApply(next);
      setApplied(true);
    } else {
      setApplied(false);
    }
  }

  const preview = draft?.ok ? estimate(draft) : null;
  const money = new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  });
  const num = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 1 });
  const sunHours = draft
    ? draft.peakSunHours.toLocaleString("es-CO", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    : "";

  return (
    <section className="os-brief print:hidden">
      <button
        type="button"
        className="os-brief-toggle"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="os-kits-label">
          <Sparkles size={15} />
          Armar desde el pedido
        </span>
        <span className="os-brief-sign" aria-hidden>
          {open ? "−" : "+"}
        </span>
      </button>
      {!open && preview && draft?.monthlyKwh ? (
        <p className="os-brief-collapsed">
          {draft.systemKwp.toLocaleString("es-CO")} kWp · {money.format(preview.totalClientCOP)}
          {draft.cityName ? ` · ${draft.cityName}` : ""}
        </p>
      ) : null}
      {open ? (
        <div className="os-brief-body">
          <p className="os-brief-lead">
            Escriba qué hay que cubrir. El dictamen sale del inventario. Nada se guarda hasta
            que usted lo deje en el borrador.
          </p>
          <textarea
            className="os-brief-input"
            rows={3}
            value={text}
            placeholder="Necesitamos suplir 300 kWh mensuales para una casa de uso más nocturno, de 6 pm a 11 pm. Tiene nevera, 10 bombillos LED, licuadora y lavadora."
            onChange={(event) => {
              setText(event.target.value);
              setApplied(false);
            }}
          />
          <div className="os-brief-actions">
            <button
              type="button"
              className={`os-btn os-btn-ghost${hearing === "pedido" ? " is-on" : ""}`}
              onClick={() => dictate("pedido")}
            >
              <Mic size={16} />
              {hearing === "pedido" ? "Escuchando…" : "Decirlo"}
            </button>
            <button type="button" className="os-btn os-btn-ghost" onClick={review} disabled={!text.trim()}>
              Revisar con el inventario
            </button>
          </div>
          {draft ? (
            <div className="os-brief-result">
              {preview && draft.monthlyKwh ? (
                <div className="os-brief-decision">
                  <p>
                    {draft.cityName
                      ? `${draft.cityName}${draft.stationName ? ` · ${draft.stationName}` : ""} · ${sunHours} h de sol`
                      : `${sunHours} h de sol, las del cotizador`}
                  </p>
                  <p className="os-brief-cover">
                    {preview.monthlyGenKwh.toLocaleString("es-CO")} kWh al mes para una factura de{" "}
                    {draft.monthlyKwh.toLocaleString("es-CO")} kWh.
                    {preview.monthlyGenKwh >= draft.monthlyKwh
                      ? " La planta queda por encima de la factura."
                      : " La planta queda por debajo de la factura."}
                  </p>
                  <strong>{money.format(preview.totalClientCOP)}</strong>
                  <p>
                    Subtotal {money.format(preview.subtotalCOP)} · IVA {money.format(preview.ivaCOP)}.
                    Ahorro del primer año {money.format(preview.annualSavingsCOP)}. Retorno simple{" "}
                    {num.format(preview.paybackYears)} años, con la tarifa del cotizador.
                  </p>
                  {draft.revisionHeard.length ? (
                    <p>Corregido: {draft.revisionHeard.join("; ")}.</p>
                  ) : null}
                </div>
              ) : null}
              {draft.gaps.length ? (
                <ul className="os-brief-gaps">
                  {draft.gaps.map((gap) => (
                    <li key={gap}>{gap}</li>
                  ))}
                </ul>
              ) : null}
              <div className="os-brief-opinion">
                <label htmlFor="os-brief-opinion">Su punto de vista</label>
                <textarea
                  id="os-brief-opinion"
                  className="os-brief-input"
                  rows={2}
                  value={opinion}
                  placeholder="La noche son 8 kWh, no 5. Déjelo en 8 paneles y sin batería si el local es de día."
                  onChange={(event) => {
                    setOpinion(event.target.value);
                    setMiss("");
                    setApplied(false);
                  }}
                />
                <div className="os-brief-actions">
                  <button
                    type="button"
                    className={`os-btn os-btn-ghost${hearing === "opinion" ? " is-on" : ""}`}
                    onClick={() => dictate("opinion")}
                  >
                    <Mic size={16} />
                    {hearing === "opinion" ? "Escuchando…" : "Decirlo"}
                  </button>
                  <button
                    type="button"
                    className="os-btn os-btn-primary"
                    onClick={correct}
                    disabled={!opinion.trim()}
                  >
                    Corregir y seguir
                  </button>
                </div>
                {miss ? <p className="os-brief-miss">{miss}</p> : null}
              </div>
              <button
                type="button"
                className="os-brief-toggle os-brief-toggle-sub"
                aria-expanded={basisOpen}
                onClick={() => setBasisOpen((value) => !value)}
              >
                <span>En qué se basó</span>
                <span className="os-brief-sign" aria-hidden>
                  {basisOpen ? "−" : "+"}
                </span>
              </button>
              {basisOpen ? (
                <>
                  {draft.steps.length ? (
                    <ol className="os-brief-steps">
                      {draft.steps.map((step) => (
                        <li key={step.title}>
                          <strong>{step.title}</strong>
                          <span>{step.body}</span>
                        </li>
                      ))}
                    </ol>
                  ) : null}
                  {draft.equipment.length ? (
                    <ul className="os-brief-gear">
                      {draft.equipment.map((item) => (
                        <li key={item.role}>
                          <span>{item.role}</span>
                          <b>
                            {item.qty} × {item.label}
                          </b>
                          <em>{item.detail}</em>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {draft.assumptions.length ? (
                    <ul className="os-brief-notes">
                      {draft.assumptions.map((note) => (
                        <li key={note}>{note}</li>
                      ))}
                    </ul>
                  ) : null}
                </>
              ) : null}
              {draft.ok ? (
                <div className="os-brief-actions">
                  <button
                    type="button"
                    className="os-btn os-btn-ghost"
                    onClick={() => {
                      onApply(draft);
                      setApplied(true);
                    }}
                  >
                    <Check size={16} />
                    Dejarla en el cotizador
                  </button>
                  {applied ? (
                    <p className="os-brief-ok">
                      Quedó en el borrador, a la derecha. Siga con la cotización. Aún no está
                      guardada ni enviada.
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
