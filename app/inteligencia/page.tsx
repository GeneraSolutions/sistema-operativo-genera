"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
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
import { ROLE_LABELS, type Role } from "@/lib/auth/roles";

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

export default function InteligenciaPage() {
  const [mode, setMode] = useState<"specialist" | "mesa">("specialist");
  const [specialistId, setSpecialistId] = useState<SpecialistId>("fotovoltaico");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [offlineNote, setOfflineNote] = useState(false);
  const [suggestedKwp, setSuggestedKwp] = useState("50");
  const [manuals, setManuals] = useState<SpecialistManuals>({});
  const [manualDraft, setManualDraft] = useState("");
  const [manualSaved, setManualSaved] = useState(false);
  const [consultas, setConsultas] = useState<TeamConsulta[]>([]);
  const [viewerId, setViewerId] = useState("");
  const [viewerRole, setViewerRole] = useState<Role | "">("");
  const [openConsulta, setOpenConsulta] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const active = useMemo(
    () => SPECIALISTS.find((s) => s.id === specialistId)!,
    [specialistId]
  );

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
  }, []);

  useEffect(() => {
    setManualDraft(manuals[specialistId] ?? "");
    setManualSaved(false);
  }, [specialistId, manuals]);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, loading]);

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
      setOfflineNote(Boolean(data.offline));
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.reply as string,
          label: data.label as string,
        },
      ]);

      // Heurística: extraer kWp sugerido del texto
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
    window.print();
  }

  function clearChat() {
    setMessages([]);
    setError("");
  }

  const cotizadorHref = `/cotizador?kwp=${encodeURIComponent(suggestedKwp)}&ley1715=1`;

  return (
    <AppShell
      title="Centro de Inteligencia"
      subtitle="14 especialistas · Manual GENERA · Colombia"
    >
      <div className="mb-6">
        <h2 className="text-2xl font-semibold">Especialistas virtuales</h2>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-[#4d5c55]">
          Catorce perfiles para no dejar pasar diseño, obra, SST, RETIE, O&M,
          comercial, compras ni licencias. Pegue el manual de cada uno: manda
          sobre el conocimiento genérico. La{" "}
          <strong>Mesa Redonda</strong> cruza a todo el equipo.
        </p>
      </div>

      <div className="mb-4 flex flex-wrap gap-2 print:hidden">
        <button
          type="button"
          onClick={() => setMode("specialist")}
          className={`rounded-xl px-4 py-2.5 text-sm font-semibold ${
            mode === "specialist"
              ? "bg-[#1f6b45] text-white"
              : "bg-white ring-1 ring-[#d8d2c4]"
          }`}
        >
          Especialista individual
        </button>
        <button
          type="button"
          onClick={() => setMode("mesa")}
          className={`rounded-xl px-4 py-2.5 text-sm font-semibold ${
            mode === "mesa"
              ? "bg-[#0f2a1f] text-white"
              : "bg-white ring-1 ring-[#d8d2c4]"
          }`}
        >
          Mesa Redonda
        </button>
      </div>

      {mode === "specialist" ? (
        <div className="mb-6 space-y-5 print:hidden">
          {specialistsByGroup().map((block) => (
            <div key={block.group}>
              <p className="mb-2 text-[11px] font-semibold tracking-[0.2em] text-[#8a6b2a] uppercase">
                {block.label}
              </p>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {block.items.map((s) => {
                  const selected = specialistId === s.id;
                  const hasManual = Boolean(manuals[s.id]?.trim());
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setSpecialistId(s.id)}
                      className={`rounded-2xl border p-4 text-left transition ${
                        selected
                          ? "border-transparent bg-[#0f2a1f] text-white shadow-lg"
                          : "border-[#ddd6c8] bg-white hover:border-[#1f6b45]/40"
                      }`}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span
                          className="inline-block rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase"
                          style={{
                            backgroundColor: selected
                              ? "rgba(212,180,106,0.2)"
                              : `${s.accent}18`,
                            color: selected ? "#d4b46a" : s.accent,
                          }}
                        >
                          {s.shortTitle}
                        </span>
                        {hasManual ? (
                          <span
                            className={`text-[10px] font-semibold ${
                              selected ? "text-[#d4b46a]" : "text-[#1f6b45]"
                            }`}
                          >
                            Manual
                          </span>
                        ) : null}
                      </span>
                      <p className="mt-2 text-base font-semibold">{s.name}</p>
                      <p
                        className={`text-sm ${selected ? "text-[#c9d7cf]" : "text-[#4d5c55]"}`}
                      >
                        {s.title}
                      </p>
                      <p
                        className={`mt-2 text-xs leading-5 ${
                          selected ? "text-[#a8c4b6]" : "text-[#6d7c74]"
                        }`}
                      >
                        {s.description}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mb-6 rounded-2xl border border-[#1a3d2e] bg-gradient-to-br from-[#0f2a1f] to-[#163d2c] p-5 text-white print:hidden">
          <p className="text-[11px] font-semibold tracking-[0.24em] text-[#d4b46a] uppercase">
            Mesa Redonda activa
          </p>
          <h3 className="mt-1 text-xl font-semibold">
            Consulta cruzada de los 14 especialistas
          </h3>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#c9d7cf]">
            Diseño, potencia, SCADA, O&M, SST, RETIE, tributario, contratos,
            comercial, compras y ambiental. Si hay manuales pegados, la mesa los
            usa como doctrina GENERA.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {SPECIALISTS.map((s) => (
              <span
                key={s.id}
                className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] text-[#e8f0ec]"
              >
                {s.shortTitle}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <section className="flex min-h-[480px] flex-col overflow-hidden rounded-2xl border border-[#ddd6c8] bg-white shadow-[0_12px_40px_rgba(18,36,28,0.06)]">
          <div className="flex items-center justify-between border-b border-[#eee8dc] px-5 py-3">
            <div>
              <p className="text-xs tracking-[0.18em] text-[#8a6b2a] uppercase">
                Sesión
              </p>
              <p className="font-semibold">
                {mode === "mesa" ? "Mesa Redonda" : active.title}
              </p>
            </div>
            <button
              type="button"
              onClick={clearChat}
              className="text-xs font-semibold text-[#6d7c74] underline print:hidden"
            >
              Limpiar
            </button>
          </div>

          <div
            ref={scrollRef}
            id="informe-tecnico"
            className="flex-1 space-y-4 overflow-y-auto px-5 py-4"
          >
            {messages.length === 0 ? (
              <div className="rounded-xl bg-[#f7f4ee] p-5 text-sm leading-6 text-[#4d5c55]">
                <p className="font-medium text-[#12241c]">Ejemplos de consulta</p>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  <li>
                    Dimensionar un sistema 120 kWp en cubierta metálica en Medellín
                    con BESS 40 kWh.
                  </li>
                  <li>
                    Checklist CREG 174 para AGPE 80 kWp ante Enel Colombia.
                  </li>
                  <li>
                    Cláusulas críticas en un contrato EPC + PPA a 15 años.
                  </li>
                </ul>
              </div>
            ) : null}

            {messages.map((m, i) => (
              <div
                key={i}
                className={`max-w-[95%] rounded-2xl px-4 py-3 text-sm leading-6 whitespace-pre-wrap ${
                  m.role === "user"
                    ? "ml-auto bg-[#1f6b45] text-white"
                    : "bg-[#f7f4ee] text-[#12241c] ring-1 ring-[#eee8dc]"
                }`}
              >
                {m.role === "assistant" && m.label ? (
                  <p className="mb-1 text-[10px] font-bold tracking-[0.16em] text-[#8a6b2a] uppercase">
                    {m.label}
                  </p>
                ) : null}
                {m.content}
              </div>
            ))}

            {loading ? (
              <p className="text-sm text-[#6d7c74]">Analizando con el equipo…</p>
            ) : null}
            {error ? (
              <p className="text-sm font-medium text-[#9b2c2c]">{error}</p>
            ) : null}
            {offlineNote ? (
              <p className="text-xs text-[#8a6b2a]">
                Modo demo: configure OPENAI_API_KEY en .env.local para respuestas
                en vivo.
              </p>
            ) : null}
          </div>

          <form
            onSubmit={sendMessage}
            className="border-t border-[#eee8dc] p-4 print:hidden"
          >
            <textarea
              className="w-full resize-none rounded-xl border border-[#d8d2c4] bg-[#fbfaf6] px-4 py-3 text-sm outline-none ring-[#1f6b45] focus:ring-2"
              rows={3}
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
              disabled={loading || !input.trim()}
              className="mt-3 w-full rounded-xl bg-[#d4b46a] px-4 py-3 text-sm font-semibold text-[#12241c] uppercase disabled:opacity-50 hover:bg-[#c7a45a]"
            >
              {loading ? "Procesando…" : "Enviar consulta"}
            </button>
          </form>
        </section>

        <aside className="space-y-4 print:hidden">
          <div className="rounded-2xl border border-[#ddd6c8] bg-white p-5">
            <p className="text-xs tracking-[0.18em] text-[#8a6b2a] uppercase">
              Prompt de sistema
            </p>
            <h3 className="mt-1 font-semibold">
              {mode === "mesa" ? "Moderador Mesa Redonda" : active.name}
            </h3>
            <p className="mt-2 max-h-32 overflow-y-auto text-xs leading-5 text-[#4d5c55]">
              {mode === "mesa"
                ? "Síntesis de los 14 flancos. Los manuales pegados mandan sobre el modelo genérico."
                : active.systemPrompt.slice(0, 420) + "…"}
            </p>
          </div>

          {mode === "specialist" ? (
            <div className="rounded-2xl border border-[#ddd6c8] bg-white p-5">
              <p className="text-xs tracking-[0.18em] text-[#8a6b2a] uppercase">
                Manual GENERA
              </p>
              <h3 className="mt-1 font-semibold">Doctrina de {active.shortTitle}</h3>
              <p className="mt-1 text-xs leading-5 text-[#4d5c55]">
                {active.manualHint} Se guarda en este navegador y se inyecta en
                cada consulta de este perfil.
              </p>
              <textarea
                className="mt-3 w-full resize-y rounded-xl border border-[#d8d2c4] bg-[#fbfaf6] px-3 py-2.5 text-xs leading-5 outline-none ring-[#1f6b45] focus:ring-2"
                rows={10}
                placeholder="Pegue aquí procedimientos, checklists, marcas homologadas, lo que nunca se improvisa…"
                value={manualDraft}
                onChange={(e) => {
                  setManualDraft(e.target.value);
                  setManualSaved(false);
                }}
              />
              <div className="mt-2 flex items-center justify-between gap-2">
                <span className="text-[11px] text-[#8a7f70]">
                  {manualDraft.trim().length.toLocaleString("es-CO")} caracteres
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const next = upsertSpecialistManual(
                      specialistId,
                      manualDraft,
                      manuals
                    );
                    setManuals(next);
                    setManualSaved(true);
                  }}
                  className="rounded-xl bg-[#0f2a1f] px-3 py-2 text-xs font-semibold text-white"
                >
                  {manualSaved ? "Manual guardado" : "Guardar manual"}
                </button>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-[#ddd6c8] bg-white p-5 text-xs leading-5 text-[#4d5c55]">
              <p className="font-semibold text-[#12241c]">Manuales en la mesa</p>
              <p className="mt-1">
                {
                  SPECIALISTS.filter((s) => manuals[s.id]?.trim()).length
                }{" "}
                de {SPECIALISTS.length} perfiles tienen doctrina pegada. Cargue
                manuales en modo especialista; la mesa los lee todos.
              </p>
            </div>
          )}

          <div className="rounded-2xl border border-[#ddd6c8] bg-white p-5">
            <p className="text-xs tracking-[0.18em] text-[#8a6b2a] uppercase">
              Equipo
            </p>
            <h3 className="mt-1 font-semibold">Consultas del personal</h3>
            <p className="mt-1 text-xs leading-5 text-[#4d5c55]">
              {viewerRole === "ceo"
                ? "Como CEO ve todas las consultas, incluidas las suyas (privadas para el resto)."
                : "Ve las consultas del equipo. Las del CEO no aparecen aquí."}
            </p>
            <div className="mt-3 max-h-80 space-y-2 overflow-y-auto">
              {consultas.length === 0 ? (
                <p className="text-xs text-[#6d7c74]">Aún no hay consultas visibles.</p>
              ) : (
                consultas.map((c) => {
                  const mine = c.userId === viewerId;
                  const ceoPrivate = c.role === "ceo";
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() =>
                        setOpenConsulta((id) => (id === c.id ? null : c.id))
                      }
                      className="w-full rounded-xl bg-[#f7f4ee] px-3 py-2 text-left text-xs"
                    >
                      <p className="font-semibold text-[#12241c]">
                        {c.userName}
                        {mine ? " · usted" : ""}
                        {ceoPrivate && mine ? " · privada" : ""}
                      </p>
                      <p className="text-[10px] uppercase tracking-wide text-[#8a6b2a]">
                        {ROLE_LABELS[c.role]} · {c.specialistLabel}
                      </p>
                      <p className="mt-1 line-clamp-2 text-[#4d5c55]">{c.question}</p>
                      {openConsulta === c.id ? (
                        <div className="mt-2 whitespace-pre-wrap border-t border-[#eee8dc] pt-2 text-[#12241c]">
                          <p className="font-medium">Pregunta</p>
                          <p>{c.question}</p>
                          <p className="mt-2 font-medium">Respuesta</p>
                          <p>{c.answer}</p>
                        </div>
                      ) : null}
                    </button>
                  );
                })
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-[#ddd6c8] bg-white p-5">
            <h3 className="font-semibold">Exportar / Cotizador</h3>
            <p className="mt-1 text-sm text-[#4d5c55]">
              Genere el informe técnico en PDF o envíe parámetros al cotizador
              paramétrico.
            </p>
            <label className="mt-3 block text-sm">
              <span className="mb-1 block font-medium">kWp sugerido</span>
              <input
                className="w-full rounded-xl border border-[#d8d2c4] bg-[#fbfaf6] px-3 py-2.5"
                value={suggestedKwp}
                onChange={(e) => setSuggestedKwp(e.target.value)}
              />
            </label>
            <div className="mt-3 flex flex-col gap-2">
              <button
                type="button"
                onClick={exportPdf}
                disabled={messages.length === 0}
                className="rounded-xl bg-[#0f2a1f] px-4 py-3 text-sm font-semibold text-white disabled:opacity-40"
              >
                Exportar informe técnico (PDF)
              </button>
              <Link
                href={cotizadorHref}
                className="rounded-xl bg-[#d4b46a] px-4 py-3 text-center text-sm font-semibold text-[#12241c]"
              >
                Enviar parámetros al Cotizador
              </Link>
            </div>
          </div>

          <div className="rounded-2xl bg-[#f7f4ee] p-4 text-xs leading-5 text-[#4d5c55]">
            <p className="font-semibold text-[#12241c]">API OpenAI</p>
            <p className="mt-1">
              Endpoint <code className="text-[#1f6b45]">/api/inteligencia</code>.
              Variable de entorno <code>OPENAI_API_KEY</code>. Modelo opcional:{" "}
              <code>OPENAI_MODEL</code> (default gpt-4o-mini).
            </p>
          </div>
        </aside>
      </div>
    </AppShell>
  );
}
