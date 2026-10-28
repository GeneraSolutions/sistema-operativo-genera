"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  FileText,
  History,
  Plus,
  ShoppingCart,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { ROLE_LABELS, type Role } from "@/lib/auth/roles";
import {
  SPECIALISTS,
  specialistsByGroup,
  type SpecialistId,
} from "@/lib/specialists";
import {
  loadSpecialistManuals,
  upsertSpecialistManual,
  type SpecialistManuals,
} from "@/lib/specialist-manuals";

type TeamConsulta = {
  id: string;
  createdAt: string;
  userId: string;
  userName: string;
  username: string;
  role: Role;
  mode: "specialist" | "mesa";
  specialistLabel: string;
  question: string;
  answer: string;
};

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  label?: string;
};

const EXAMPLES = [
  "Dimensionar 120 kWp en cubierta metálica en Medellín con BESS 40 kWh.",
  "Checklist CREG 174 para AGPE 80 kWp ante Enel Colombia.",
  "Cláusulas críticas en un contrato EPC + PPA a 15 años.",
];

const field =
  "w-full rounded-xl border border-[#d8d2c4] bg-[#fbfaf6] px-3 py-2.5 text-sm";

export default function InteligenciaPage() {
  const [mode, setMode] = useState<"specialist" | "mesa">("specialist");
  const [specialistId, setSpecialistId] = useState<SpecialistId>("fotovoltaico");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [suggestedKwp, setSuggestedKwp] = useState("50");
  const [manuals, setManuals] = useState<SpecialistManuals>({});
  const [manualDraft, setManualDraft] = useState("");
  const [flash, setFlash] = useState("");
  const [consultas, setConsultas] = useState<TeamConsulta[]>([]);
  const [viewerId, setViewerId] = useState("");
  const [viewerRole, setViewerRole] = useState<Role | "">("");
  const [menu, setMenu] = useState<"recent" | "more" | null>(null);
  const [drawer, setDrawer] = useState<"manual" | "consulta" | null>(null);
  const [openConsulta, setOpenConsulta] = useState<TeamConsulta | null>(null);
  const recentRef = useRef<HTMLDivElement>(null);
  const moreRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const active = useMemo(
    () => SPECIALISTS.find((s) => s.id === specialistId)!,
    [specialistId]
  );
  const manualsReady = SPECIALISTS.filter((s) => manuals[s.id]?.trim()).length;
  const sessionLabel = mode === "mesa" ? "Mesa Redonda" : active.title;
  const subtitle =
    mode === "mesa"
      ? `Mesa Redonda · ${manualsReady} manuales listos`
      : `${active.name} · ${active.title}`;

  async function loadConsultas() {
    try {
      const res = await fetch("/api/inteligencia/consultas");
      const data = await res.json();
      if (!res.ok) return;
      setConsultas(data.consultas ?? []);
      setViewerId(data.viewerId ?? "");
      setViewerRole(data.viewerRole ?? "");
    } catch {
      /* silencioso */
    }
  }

  useEffect(() => {
    const loaded = loadSpecialistManuals();
    setManuals(loaded);
    void loadConsultas();
    const wanted = new URLSearchParams(window.location.search).get("e");
    if (wanted && SPECIALISTS.some((s) => s.id === wanted)) {
      setSpecialistId(wanted as SpecialistId);
    }
  }, []);

  useEffect(() => {
    setManualDraft(manuals[specialistId] ?? "");
  }, [specialistId, manuals]);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, loading]);

  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(""), 2800);
    return () => clearTimeout(t);
  }, [flash]);

  useEffect(() => {
    if (!menu) return;
    const onDown = (e: MouseEvent) => {
      const node = e.target as Node;
      if (recentRef.current?.contains(node) || moreRef.current?.contains(node)) return;
      setMenu(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenu(null);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menu]);

  useEffect(() => {
    if (!drawer) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeDrawer();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawer]);

  async function sendMessage(e?: FormEvent) {
    e?.preventDefault();
    const text = input.trim();
    if (!text || loading) return;

    const nextHistory = [...messages, { role: "user" as const, content: text }];
    setMessages(nextHistory);
    setInput("");
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/inteligencia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          specialistId: mode === "specialist" ? specialistId : undefined,
          message: text,
          history: nextHistory.map(({ role, content }) => ({ role, content })),
          manuals,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Error en la consulta");
      }
      if (data.offline) {
        setFlash("Modo demo: la respuesta no es en vivo.");
      }
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.reply as string,
          label: data.label as string,
        },
      ]);

      const match = String(data.reply).match(/(\d+(?:[.,]\d+)?)\s*kWp/i);
      if (match) {
        setSuggestedKwp(match[1].replace(",", "."));
      }
      void loadConsultas();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  }

  function exportPdf() {
    if (messages.length === 0) {
      setFlash("Consulte primero para exportar la sesión.");
      return;
    }
    window.print();
  }

  function clearChat() {
    setMessages([]);
    setError("");
  }

  function closeDrawer() {
    setDrawer(null);
    setOpenConsulta(null);
  }

  function openManual() {
    setMenu(null);
    setOpenConsulta(null);
    setDrawer("manual");
  }

  function openRecent(c: TeamConsulta) {
    setMenu(null);
    setOpenConsulta(c);
    setDrawer("consulta");
  }

  function saveManual() {
    const next = upsertSpecialistManual(specialistId, manualDraft, manuals);
    setManuals(next);
    setFlash("Manual GENERA guardado");
  }

  const cotizadorHref = `/cotizador?kwp=${encodeURIComponent(suggestedKwp)}&ley1715=1`;

  return (
    <AppShell
      title="Inteligencia"
      printTitle="Informe de inteligencia"
      subtitle={subtitle}
      actions={
        <>
          {consultas.length > 0 ? (
            <div className="os-menu print:hidden" ref={recentRef}>
              <button
                type="button"
                className="os-btn os-btn-ghost"
                aria-expanded={menu === "recent"}
                onClick={() => setMenu((m) => (m === "recent" ? null : "recent"))}
              >
                <History size={16} />
                Recientes
                <ChevronDown size={15} />
              </button>
              {menu === "recent" ? (
                <div className="os-menu-pop" role="menu">
                  <p className="os-menu-label">
                    {viewerRole === "ceo"
                      ? "Consultas del equipo, incluidas las suyas"
                      : "Consultas del equipo"}
                  </p>
                  {consultas.slice(0, 8).map((c) => {
                    const mine = c.userId === viewerId;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        role="menuitem"
                        className="os-menu-item"
                        onClick={() => openRecent(c)}
                      >
                        <FileText size={15} />
                        <span>
                          {c.specialistLabel}
                          {mine ? " · usted" : ` · ${c.userName}`}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="os-menu print:hidden" ref={moreRef}>
            <button
              type="button"
              className="os-btn os-btn-ghost"
              aria-expanded={menu === "more"}
              onClick={() => setMenu((m) => (m === "more" ? null : "more"))}
            >
              Más
              <ChevronDown size={15} />
            </button>
            {menu === "more" ? (
              <div className="os-menu-pop" role="menu">
                <button
                  type="button"
                  role="menuitem"
                  className="os-menu-item"
                  onClick={openManual}
                >
                  <FileText size={15} />
                  <span>Manual GENERA</span>
                </button>
                <div className="os-menu-kwp">
                  <label>
                    <span>kWp sugerido</span>
                    <input
                      value={suggestedKwp}
                      onChange={(e) => setSuggestedKwp(e.target.value)}
                      inputMode="decimal"
                    />
                  </label>
                </div>
              </div>
            ) : null}
          </div>

          <button
            type="button"
            className="os-btn os-btn-ghost print:hidden"
            onClick={clearChat}
            disabled={messages.length === 0}
          >
            <Trash2 size={16} />
            Limpiar
          </button>
          <button
            type="button"
            className="os-btn os-btn-ghost print:hidden"
            onClick={exportPdf}
            disabled={messages.length === 0}
          >
            <FileText size={16} />
            PDF
          </button>
          <Link href={cotizadorHref} className="os-btn os-btn-primary print:hidden">
            <ShoppingCart size={16} />
            Cotizar {suggestedKwp} kWp
          </Link>
        </>
      }
    >
      <div className="os-intel-split">
        <nav className="os-work os-file-panel os-intel-rail print:hidden" aria-label="Especialistas">
          <button
            type="button"
            className={`os-intel-person${mode === "mesa" ? " is-on" : ""}`}
            aria-current={mode === "mesa" ? "true" : undefined}
            onClick={() => setMode("mesa")}
          >
            <span className="os-work-row-title">Mesa Redonda</span>
            <span className="os-work-row-meta">
              Los 14 perfiles cruzan · {manualsReady} manuales
            </span>
          </button>
          {specialistsByGroup().map((block) => (
            <div key={block.group}>
              <p className="os-intel-group-label">{block.label}</p>
              {block.items.map((s) => {
                const on = mode === "specialist" && specialistId === s.id;
                const hasManual = Boolean(manuals[s.id]?.trim());
                return (
                  <button
                    key={s.id}
                    type="button"
                    className={`os-intel-person${on ? " is-on" : ""}`}
                    aria-current={on ? "true" : undefined}
                    onClick={() => {
                      setMode("specialist");
                      setSpecialistId(s.id);
                    }}
                  >
                    <span className="os-work-row-title">{s.name}</span>
                    <span className="os-work-row-meta">
                      {s.shortTitle}
                      {hasManual ? " · Manual" : ""}
                    </span>
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

      <section className="os-work os-file-panel os-intel-chat">
        <div className="os-intel-chat-head print:hidden">
          <div className="min-w-0">
            <p className="os-drawer-kicker">Consulta</p>
            <p className="os-intel-chat-who">{sessionLabel}</p>
          </div>
          {mode === "specialist" && manuals[specialistId]?.trim() ? (
            <span className="os-pill" data-tone="ok">
              Manual listo
            </span>
          ) : null}
        </div>

        <div ref={scrollRef} id="informe-tecnico" className="os-intel-log">
          {messages.length === 0 ? (
            <div className="os-empty">
              <span className="os-empty-icon">
                <Sparkles size={20} />
              </span>
              <p className="os-empty-title">
                {mode === "mesa" ? "Formule la consulta a la mesa" : `Consulte a ${active.name}`}
              </p>
              <p className="os-empty-hint">
                El manual GENERA, si está pegado, manda sobre el conocimiento genérico.
              </p>
              <div className="os-quick">
                {EXAMPLES.map((example) => (
                  <button
                    key={example}
                    type="button"
                    className="os-quick-item"
                    onClick={() => setInput(example)}
                  >
                    <Plus size={14} />
                    {example}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((m, i) => (
              <div
                key={i}
                className={`os-intel-msg${m.role === "user" ? " is-user" : ""}`}
              >
                {m.role === "assistant" && m.label ? (
                  <p className="os-intel-msg-label">{m.label}</p>
                ) : null}
                <p>{m.content}</p>
              </div>
            ))
          )}
          {loading ? <p className="os-intel-status">Analizando con el equipo…</p> : null}
          {error ? <p className="os-intel-status is-err">{error}</p> : null}
        </div>

        <form onSubmit={sendMessage} className="os-intel-composer print:hidden">
          <textarea
            rows={2}
            placeholder={
              mode === "mesa"
                ? "Formule la consulta para la mesa redonda…"
                : `Consulte a ${active.name}…`
            }
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void sendMessage();
              }
            }}
          />
          <button
            type="submit"
            className="os-btn os-btn-primary"
            disabled={loading || !input.trim()}
          >
            {loading ? "Procesando…" : "Enviar"}
          </button>
        </form>
      </section>
      </div>

      {drawer ? <div className="os-drawer-backdrop" onClick={closeDrawer} /> : null}
      <aside
        className="os-drawer"
        data-open={drawer ? "true" : undefined}
        aria-hidden={!drawer}
        aria-label={drawer === "consulta" ? "Consulta reciente" : "Manual GENERA"}
      >
        <header className="os-drawer-head">
          <div className="min-w-0">
            <p className="os-drawer-kicker">
              {drawer === "consulta" ? "Consulta reciente" : "Manual GENERA"}
            </p>
            <h2 className="os-drawer-title">
              {drawer === "consulta"
                ? openConsulta?.specialistLabel || "Sesión"
                : mode === "mesa"
                  ? "Doctrina de la mesa"
                  : active.shortTitle}
            </h2>
          </div>
          <button type="button" className="os-icon-btn" aria-label="Cerrar" onClick={closeDrawer}>
            <X size={18} />
          </button>
        </header>

        <div className="os-drawer-body">
          {drawer === "consulta" && openConsulta ? (
            <>
              <p className="os-intel-meta">
                {openConsulta.userName}
                {openConsulta.userId === viewerId ? " · usted" : ""}
                {openConsulta.role === "ceo" && openConsulta.userId === viewerId
                  ? " · privada"
                  : ""}
                {" · "}
                {ROLE_LABELS[openConsulta.role] ?? openConsulta.role}
              </p>
              <p className="os-drawer-section">Pregunta</p>
              <p className="whitespace-pre-wrap text-sm leading-6">{openConsulta.question}</p>
              <p className="os-drawer-section">Respuesta</p>
              <p className="whitespace-pre-wrap text-sm leading-6">{openConsulta.answer}</p>
            </>
          ) : mode === "mesa" ? (
            <>
              <p className="text-sm leading-6 text-[#4d5c55]">
                La mesa lee los manuales pegados en cada perfil. Cárguelos en modo
                Especialista.
              </p>
              <p className="mt-3 text-sm font-semibold">
                {manualsReady} / {SPECIALISTS.length} con manual
              </p>
            </>
          ) : (
            <>
              <p className="text-sm leading-6 text-[#4d5c55]">{active.manualHint}</p>
              <p className="os-page-intro mt-2 text-xs">
                Se guarda en este navegador y manda sobre el conocimiento genérico.
              </p>
              <textarea
                className={`${field} mt-3`}
                rows={12}
                placeholder="Pegue procedimientos, checklists y marcas homologadas…"
                value={manualDraft}
                onChange={(e) => setManualDraft(e.target.value)}
              />
              <p className="mt-2 text-xs text-[#8a7f70]">
                {manualDraft.trim().length.toLocaleString("es-CO")} caracteres
              </p>
            </>
          )}
        </div>

        <footer className="os-drawer-foot">
          <button type="button" className="os-btn os-btn-ghost" onClick={closeDrawer}>
            Cerrar
          </button>
          {drawer === "manual" && mode === "specialist" ? (
            <button type="button" className="os-btn os-btn-primary" onClick={saveManual}>
              Guardar manual
            </button>
          ) : null}
          {drawer === "consulta" && openConsulta ? (
            <button
              type="button"
              className="os-btn os-btn-primary"
              onClick={() => {
                setInput(openConsulta.question);
                closeDrawer();
              }}
            >
              Usar esta pregunta
            </button>
          ) : null}
        </footer>
      </aside>

      {flash ? (
        <div className="os-toast" role="status">
          {flash}
        </div>
      ) : null}
    </AppShell>
  );
}
