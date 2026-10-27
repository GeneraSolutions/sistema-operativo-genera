"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Calculator,
  ClipboardCheck,
  CornerDownLeft,
  HardHat,
  Search,
  SquareKanban,
  UserPlus,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { OBRA_STATUS_LABELS, OPEN_OBRA_KEY, loadObras, obraLabel } from "@/lib/obra";
import { plantLabel } from "@/lib/om";
import { normalizeSearch } from "@/lib/os-command";
import { LEAD_STAGE_LABELS, OPEN_LEAD_KEY, leadLabel, loadLeads } from "@/lib/pipeline";
import {
  clearActiveQuote,
  loadSavedQuotes,
  pinActiveQuote,
  quoteDeskPath,
  quotesForCotizador,
} from "@/lib/saved-quotes";
import { OPEN_QUOTE_KEY, OPEN_VISIT_KEY, loadSavedVisits } from "@/lib/saved-visits";
import { OPEN_OM_PLANT_KEY, loadPlants } from "@/lib/technical-reports";

export type OsCommandMode = "buscar" | "nuevo";

type Item = {
  id: string;
  group: string;
  title: string;
  sub?: string;
  icon: LucideIcon;
  keywords: string;
  run: () => void;
};

const GROUP_ORDER = [
  "Crear",
  "Oportunidades",
  "Cotizaciones",
  "Visitas",
  "Obras",
  "Plantas O&M",
  "Ir a",
];

const PER_GROUP = 6;

function openWith(key: string, id: string, path: string) {
  sessionStorage.setItem(key, id);
  window.location.assign(path);
}

export function OsCommand({
  open,
  mode,
  onClose,
  nav,
  aliado,
  username,
}: {
  open: boolean;
  mode: OsCommandMode;
  onClose: () => void;
  nav: { href: string; label: string; hint: string }[];
  aliado: boolean;
  username?: string;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [items, setItems] = useState<Item[]>([]);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setActive(0);
    const t = window.setTimeout(() => inputRef.current?.focus(), 20);

    const can = (href: string) => nav.some((n) => n.href === href);
    const next: Item[] = [];

    if (can("/pipeline")) {
      next.push({
        id: "new-lead",
        group: "Crear",
        title: "Nueva oportunidad",
        sub: "Pipeline comercial",
        icon: UserPlus,
        keywords: "nuevo lead oportunidad cliente pipeline",
        run: () => window.location.assign("/pipeline?nuevo=1"),
      });
    }
    if (can("/cotizador")) {
      next.push({
        id: "new-quote",
        group: "Crear",
        title: "Nueva cotización",
        sub: "Planta / proyecto",
        icon: Calculator,
        keywords: "nueva cotizacion propuesta cotizador",
        run: () => {
          sessionStorage.removeItem(OPEN_QUOTE_KEY);
          clearActiveQuote();
          window.location.assign("/cotizador?nueva=1");
        },
      });
    }
    if (can("/visita-tecnica")) {
      next.push({
        id: "new-visit",
        group: "Crear",
        title: "Nueva visita técnica",
        sub: "Levantamiento en sitio",
        icon: ClipboardCheck,
        keywords: "nueva visita tecnica levantamiento",
        run: () => {
          sessionStorage.removeItem(OPEN_LEAD_KEY);
          window.location.assign("/visita-tecnica?nuevo=1");
        },
      });
    }
    if (can("/obra")) {
      next.push({
        id: "new-obra",
        group: "Crear",
        title: "Nueva obra",
        sub: "Ejecución y trámites",
        icon: HardHat,
        keywords: "nueva obra proyecto instalacion",
        run: () => window.location.assign("/obra?nuevo=1"),
      });
    }
    if (can("/om")) {
      next.push({
        id: "new-plant",
        group: "Crear",
        title: "Nueva planta O&M",
        sub: "Mantenimiento y contrato",
        icon: Wrench,
        keywords: "nueva planta om mantenimiento",
        run: () => window.location.assign("/om?nuevo=1"),
      });
    }

    if (mode === "buscar") {
      if (can("/pipeline")) {
        for (const l of loadLeads()) {
          next.push({
            id: `lead-${l.id}`,
            group: "Oportunidades",
            title: leadLabel(l),
            sub: [LEAD_STAGE_LABELS[l.stage], l.contact, l.city].filter(Boolean).join(" · "),
            icon: SquareKanban,
            keywords: [l.clientName, l.contact, l.city, l.siteName, l.phone, l.email, l.owner].join(" "),
            run: () => openWith(OPEN_LEAD_KEY, l.id, "/pipeline"),
          });
        }
      }
      if (can("/cotizador")) {
        const quotes = quotesForCotizador(loadSavedQuotes(), { aliado, username });
        for (const q of quotes) {
          next.push({
            id: `quote-${q.id}`,
            group: "Cotizaciones",
            title: q.name || q.clientName || "Cotización",
            sub: [
              q.kind === "equipos"
                ? "Solo equipos"
                : q.systemKwp && !/kwp/i.test(q.name || "")
                  ? `${q.systemKwp} kWp`
                  : "",
              q.clientCity,
              q.savedAt ? new Date(q.savedAt).toLocaleDateString("es-CO") : "",
            ]
              .filter(Boolean)
              .join(" · "),
            icon: Calculator,
            keywords: [q.name, q.clientName, q.clientCity, q.clientNit].join(" "),
            run: () => {
              pinActiveQuote(q.id);
              openWith(OPEN_QUOTE_KEY, q.id, quoteDeskPath(q));
            },
          });
        }
      }
      if (can("/visita-tecnica")) {
        for (const v of loadSavedVisits()) {
          next.push({
            id: `visit-${v.id}`,
            group: "Visitas",
            title: v.visit.clientName || "Visita sin cliente",
            sub: [v.visit.location, new Date(v.savedAt).toLocaleDateString("es-CO")]
              .filter(Boolean)
              .join(" · "),
            icon: ClipboardCheck,
            keywords: [v.visit.clientName, v.visit.location].join(" "),
            run: () => openWith(OPEN_VISIT_KEY, v.id, "/visita-tecnica"),
          });
        }
      }
      if (can("/obra")) {
        for (const j of loadObras()) {
          next.push({
            id: `obra-${j.id}`,
            group: "Obras",
            title: obraLabel(j),
            sub: [OBRA_STATUS_LABELS[j.status], `${Math.round(Number(j.progress) || 0)}%`, j.city]
              .filter(Boolean)
              .join(" · "),
            icon: HardHat,
            keywords: [j.clientName, j.siteName, j.city, j.crew].join(" "),
            run: () => openWith(OPEN_OBRA_KEY, j.id, "/obra"),
          });
        }
      }
      if (can("/om")) {
        for (const p of loadPlants()) {
          next.push({
            id: `plant-${p.id}`,
            group: "Plantas O&M",
            title: plantLabel(p),
            sub: [p.kwp ? `${p.kwp} kWp` : "", p.city, p.nextMaintenance ? `próximo ${p.nextMaintenance}` : ""]
              .filter(Boolean)
              .join(" · "),
            icon: Wrench,
            keywords: [p.clientName, p.siteName, p.city, p.inverter].join(" "),
            run: () => openWith(OPEN_OM_PLANT_KEY, p.id, "/om"),
          });
        }
      }
      for (const n of nav) {
        next.push({
          id: `nav-${n.href}`,
          group: "Ir a",
          title: n.label,
          sub: n.hint,
          icon: ArrowRight,
          keywords: `${n.label} ${n.hint}`,
          run: () => router.push(n.href),
        });
      }
    }

    setItems(next);
    return () => window.clearTimeout(t);
  }, [open, mode, nav, aliado, username, router]);

  const results = useMemo(() => {
    const tokens = normalizeSearch(query).split(/\s+/).filter(Boolean);
    const matched = tokens.length
      ? items.filter((it) => {
          const hay = normalizeSearch(`${it.title} ${it.sub ?? ""} ${it.keywords}`);
          return tokens.every((t) => hay.includes(t));
        })
      : items.filter((it) => ["Crear", "Cotizaciones", "Ir a"].includes(it.group));
    const limit = tokens.length ? PER_GROUP : 4;
    return GROUP_ORDER.map((group) => {
      const inGroup = matched.filter((it) => it.group === group);
      return {
        group,
        items: group === "Crear" || group === "Ir a" ? inGroup : inGroup.slice(0, limit),
      };
    }).filter((g) => g.items.length > 0);
  }, [items, query]);

  const flat = useMemo(() => results.flatMap((g) => g.items), [results]);

  useEffect(() => setActive(0), [query]);

  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>(`[data-idx="${active}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [active]);

  function choose(item: Item | undefined) {
    if (!item) return;
    onClose();
    item.run();
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (flat.length ? (i + 1) % flat.length : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (flat.length ? (i - 1 + flat.length) % flat.length : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      choose(flat[active]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  }

  if (!open) return null;

  let idx = -1;

  return (
    <div className="os-cmd-layer print:hidden" onMouseDown={onClose}>
      <div
        className="os-cmd"
        role="dialog"
        aria-modal="true"
        aria-label={mode === "nuevo" ? "Crear nuevo" : "Buscar en Genera OS"}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="os-cmd-input">
          <Search size={18} />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={
              mode === "nuevo"
                ? "¿Qué quiere crear?"
                : "Buscar clientes, cotizaciones, obras, plantas…"
            }
            aria-label="Buscar"
          />
          <kbd className="os-kbd">Esc</kbd>
        </div>
        <div className="os-cmd-list" ref={listRef}>
          {results.length === 0 ? (
            <p className="os-cmd-empty">
              Sin resultados para “{query.trim()}”.
            </p>
          ) : (
            results.map((g) => (
              <div key={g.group} className="os-cmd-group">
                <p className="os-cmd-group-label">
                  {g.group === "Cotizaciones" && !query.trim() ? "Cotizaciones recientes" : g.group}
                </p>
                {g.items.map((it) => {
                  idx += 1;
                  const i = idx;
                  const Icon = it.icon;
                  return (
                    <button
                      key={it.id}
                      type="button"
                      data-idx={i}
                      className="os-cmd-item"
                      aria-selected={i === active}
                      onMouseMove={() => i !== active && setActive(i)}
                      onClick={() => choose(it)}
                    >
                      <span className="os-cmd-icon" data-create={it.group === "Crear" ? "true" : undefined}>
                        <Icon size={16} />
                      </span>
                      <span className="os-cmd-text">
                        <span className="os-cmd-title">{it.title}</span>
                        {it.sub ? <span className="os-cmd-sub">{it.sub}</span> : null}
                      </span>
                      <CornerDownLeft size={14} className="os-cmd-enter" />
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
        <div className="os-cmd-foot">
          <span>
            <kbd className="os-kbd">↑</kbd>
            <kbd className="os-kbd">↓</kbd> moverse
          </span>
          <span>
            <kbd className="os-kbd">Enter</kbd> abrir
          </span>
          <span className="ml-auto">
            <kbd className="os-kbd">Ctrl</kbd>
            <kbd className="os-kbd">K</kbd> en cualquier pantalla
          </span>
        </div>
      </div>
    </div>
  );
}
