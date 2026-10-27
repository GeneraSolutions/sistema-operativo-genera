"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  CalendarClock,
  ClipboardCheck,
  FileSpreadsheet,
  HardHat,
  Megaphone,
  PhoneCall,
  Plus,
  TrendingUp,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { copCompact } from "@/lib/format-cop";
import { OsKpi as Kpi, type OsTone as Tone } from "@/components/OsKpi";
import {
  sessionAllowsModule,
  type AppModule,
  type Role,
} from "@/lib/auth/roles";
import {
  LEAD_STAGE_LABELS,
  leadLabel,
  loadLeads,
  mergeLeads,
  pinOpenLead,
  replaceLeads,
  type CommercialLead,
  type LeadStage,
} from "@/lib/pipeline";
import {
  OBRA_STATUS_LABELS,
  OPEN_OBRA_KEY,
  TRAMITE_LABELS,
  loadObras,
  mergeObras,
  obraLabel,
  replaceObras,
  type ObraJob,
  type TramiteStatus,
} from "@/lib/obra";
import {
  OPEN_OM_PLANT_KEY,
  loadPlants,
  mergePlants,
  replacePlants,
  type PlantProfile,
} from "@/lib/technical-reports";
import { daysUntil, omStatus, plantLabel } from "@/lib/om";
import {
  CONTENT_STATUS_LABELS,
  loadContent,
  loadDeletedContentIds,
  mergeContent,
  mondayOf,
  persistContentCloud,
  piecesInWeek,
  replaceContent,
  saveDeletedContentIds,
} from "@/lib/content";

const cop = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

const longDate = new Intl.DateTimeFormat("es-CO", {
  weekday: "long",
  day: "numeric",
  month: "long",
});

const FUNNEL_STAGES: LeadStage[] = [
  "lead",
  "calificado",
  "visita",
  "cotizado",
  "negociacion",
];

function todayISO() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Buenos días";
  if (h < 19) return "Buenas tardes";
  return "Buenas noches";
}

function relativeDays(d: number | null) {
  if (d === null) return "Sin fecha";
  if (d === 0) return "Hoy";
  if (d === 1) return "Mañana";
  if (d === -1) return "Ayer";
  return d < 0 ? `Hace ${Math.abs(d)} días` : `En ${d} días`;
}

function pendingTramite(s: TramiteStatus) {
  return s === "pendiente" || s === "radicado";
}

function obraNeedsAttention(job: ObraJob) {
  if (job.status === "cerrado" || job.status === "energizado") return false;
  return (
    job.status === "tramites" ||
    pendingTramite(job.upme) ||
    pendingTramite(job.retie) ||
    pendingTramite(job.operadorRed)
  );
}

function WorkPanel({
  icon: Icon,
  title,
  href,
  count,
  empty,
  children,
}: {
  icon: LucideIcon;
  title: string;
  href: string;
  count: number;
  empty: { title: string; hint: string; cta: string; ctaHref: string };
  children: React.ReactNode;
}) {
  return (
    <section className="os-work">
      <header className="os-work-head">
        <span className="os-work-icon">
          <Icon size={16} />
        </span>
        <h2 className="os-work-title">{title}</h2>
        {count > 0 ? <span className="os-work-count">{count}</span> : null}
        <Link href={href} className="os-work-link">
          Ver todo
          <ArrowRight size={14} />
        </Link>
      </header>
      {count === 0 ? (
        <div className="os-empty">
          <span className="os-empty-icon">
            <Icon size={20} />
          </span>
          <p className="os-empty-title">{empty.title}</p>
          <p className="os-empty-hint">{empty.hint}</p>
          <Link href={empty.ctaHref} className="os-btn os-btn-ghost os-btn-sm">
            {empty.cta}
          </Link>
        </div>
      ) : (
        <ul className="os-work-list">{children}</ul>
      )}
    </section>
  );
}

function WorkRow({
  href,
  onClick,
  title,
  meta,
  pill,
  tone,
}: {
  href: string;
  onClick?: () => void;
  title: string;
  meta: string;
  pill: string;
  tone: Tone;
}) {
  return (
    <li>
      <Link href={href} onClick={onClick} className="os-work-row">
        <span className="os-work-row-text">
          <span className="os-work-row-title">{title}</span>
          <span className="os-work-row-meta">{meta}</span>
        </span>
        <span className="os-pill" data-tone={tone}>
          {pill}
        </span>
      </Link>
    </li>
  );
}

export default function InicioPage() {
  const [leads, setLeads] = useState<CommercialLead[]>([]);
  const [jobs, setJobs] = useState<ObraJob[]>([]);
  const [plants, setPlants] = useState<PlantProfile[]>([]);
  const [weekPieces, setWeekPieces] = useState(() =>
    piecesInWeek(loadContent(), mondayOf())
  );
  const [me, setMe] = useState<{
    name: string;
    role: Role;
    modules?: string[];
  } | null>(null);
  const [now, setNow] = useState<{ hello: string; date: string } | null>(null);

  useEffect(() => {
    setNow({ hello: greeting(), date: longDate.format(new Date()) });
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.user) {
          setMe({
            name: data.user.name ?? "",
            role: data.user.role,
            modules: data.user.modules,
          });
        }
      })
      .catch(() => null);
  }, []);

  useEffect(() => {
    setLeads(loadLeads());
    setJobs(loadObras());
    setPlants(loadPlants());
    void fetch("/api/archivo", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) return;
        if (data.leads) {
          const merged = mergeLeads(loadLeads(), data.leads);
          replaceLeads(merged);
          setLeads(merged);
        }
        if (data.obras) {
          const merged = mergeObras(loadObras(), data.obras);
          replaceObras(merged);
          setJobs(merged);
        }
        if (data.plants) {
          const merged = mergePlants(loadPlants(), data.plants);
          replacePlants(merged);
          setPlants(merged);
        }
      })
      .catch(() => undefined);
    void fetch("/api/contenido", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data?.pieces) {
          setWeekPieces(piecesInWeek(loadContent(), mondayOf()));
          return;
        }
        const deleted = saveDeletedContentIds([
          ...loadDeletedContentIds(),
          ...(data.deletedIds ?? []),
        ]);
        const merged = mergeContent(loadContent(), data.pieces, deleted);
        replaceContent(merged);
        persistContentCloud(merged);
        setWeekPieces(piecesInWeek(merged, mondayOf()));
      })
      .catch(() =>
        setWeekPieces(piecesInWeek(loadContent(), mondayOf()))
      );
  }, []);

  function can(mod: AppModule) {
    if (!me) return true;
    return sessionAllowsModule(mod, me.role, me.modules);
  }

  const today = todayISO();

  const dueLeads = useMemo(
    () =>
      leads
        .filter(
          (l) =>
            l.stage !== "ganado" &&
            l.stage !== "perdido" &&
            l.nextActionDate &&
            l.nextActionDate <= today
        )
        .sort((a, b) => a.nextActionDate.localeCompare(b.nextActionDate)),
    [leads, today]
  );

  const openLeads = leads.filter(
    (l) => l.stage !== "ganado" && l.stage !== "perdido"
  );
  const openValue = openLeads.reduce(
    (sum, l) => sum + (Number(l.estimatedValue) || 0),
    0
  );

  const funnel = useMemo(() => {
    const rows = FUNNEL_STAGES.map((stage) => {
      const inStage = leads.filter((l) => l.stage === stage);
      return {
        stage,
        count: inStage.length,
        value: inStage.reduce((s, l) => s + (Number(l.estimatedValue) || 0), 0),
      };
    });
    const max = Math.max(1, ...rows.map((r) => r.count));
    const won = leads.filter((l) => l.stage === "ganado");
    const lost = leads.filter((l) => l.stage === "perdido").length;
    const closed = won.length + lost;
    return {
      rows,
      max,
      won: won.length,
      wonValue: won.reduce((s, l) => s + (Number(l.estimatedValue) || 0), 0),
      lost,
      winRate: closed > 0 ? Math.round((won.length / closed) * 100) : null,
    };
  }, [leads]);

  const hotJobs = useMemo(() => jobs.filter(obraNeedsAttention), [jobs]);

  const hotPlants = useMemo(
    () =>
      plants
        .filter((p) => {
          const s = omStatus(p);
          return s === "vencido" || s === "proximo";
        })
        .sort((a, b) => {
          const da = daysUntil(a.nextMaintenance);
          const db = daysUntil(b.nextMaintenance);
          if (da === null) return 1;
          if (db === null) return -1;
          return da - db;
        }),
    [plants]
  );

  const omVencido = plants.filter((p) => omStatus(p) === "vencido").length;
  const omProximo = plants.filter((p) => omStatus(p) === "proximo").length;
  const firstName = me?.name.trim().split(/\s+/)[0] ?? "";

  const actions = (
    <>
      {can("pipeline") ? (
        <Link href="/pipeline" className="os-btn os-btn-ghost">
          <Plus size={16} />
          Nuevo lead
        </Link>
      ) : null}
      {can("cotizador") ? (
        <Link href="/cotizador?nueva=1" className="os-btn os-btn-primary">
          <FileSpreadsheet size={16} />
          Nueva cotización
        </Link>
      ) : null}
    </>
  );

  return (
    <AppShell
      title={now ? `${now.hello}${firstName ? `, ${firstName}` : ""}` : "Hoy"}
      subtitle={
        now
          ? `${now.date.charAt(0).toUpperCase()}${now.date.slice(1)} · lo que pide un paso hoy`
          : "Lo que pide un paso hoy"
      }
      actions={actions}
    >
      <div className="os-kpis">
        {can("pipeline") ? (
          <Kpi
            href="/pipeline"
            icon={TrendingUp}
            tone="ok"
            label="Pipeline abierto"
            value={copCompact(openValue)}
            hint={`${openLeads.length} ${openLeads.length === 1 ? "oportunidad" : "oportunidades"}`}
          />
        ) : null}
        {can("pipeline") ? (
          <Kpi
            href="/pipeline"
            icon={PhoneCall}
            tone={dueLeads.length > 0 ? "warn" : "neutral"}
            label="Seguimientos vencidos"
            value={dueLeads.length}
            hint={dueLeads.length > 0 ? "Llamar o mover hoy" : "Todo al día"}
          />
        ) : null}
        {can("obra") ? (
          <Kpi
            href="/obra"
            icon={HardHat}
            tone={hotJobs.length > 0 ? "info" : "neutral"}
            label="Obras con trámite"
            value={hotJobs.length}
            hint="UPME, RETIE u OR"
          />
        ) : null}
        {can("om") ? (
          <Kpi
            href="/om"
            icon={Wrench}
            tone={omVencido > 0 ? "danger" : omProximo > 0 ? "warn" : "neutral"}
            label="O&M vencidos"
            value={omVencido}
            hint={`${omProximo} más en 30 días`}
          />
        ) : null}
      </div>

      {can("pipeline") ? (
        <section className="os-funnel">
          <header className="os-funnel-head">
            <div>
              <h2 className="os-funnel-title">Embudo comercial</h2>
              <p className="os-funnel-sub">
                Oportunidades por etapa y valor estimado
              </p>
            </div>
            <dl className="os-funnel-stats">
              <div>
                <dt>Ganadas</dt>
                <dd>
                  {funnel.won}
                  {funnel.wonValue > 0 ? (
                    <small>{copCompact(funnel.wonValue)}</small>
                  ) : null}
                </dd>
              </div>
              <div>
                <dt>Perdidas</dt>
                <dd>{funnel.lost}</dd>
              </div>
              <div>
                <dt>Tasa de cierre</dt>
                <dd>{funnel.winRate === null ? "—" : `${funnel.winRate}%`}</dd>
              </div>
            </dl>
          </header>
          {openLeads.length === 0 ? (
            <div className="os-empty os-empty-inline">
              <p className="os-empty-title">Aún no hay oportunidades abiertas</p>
              <p className="os-empty-hint">
                Cada lead que registre en Pipeline aparece aquí según su etapa.
              </p>
              <Link href="/pipeline" className="os-btn os-btn-ghost os-btn-sm">
                <Plus size={14} />
                Registrar primer lead
              </Link>
            </div>
          ) : (
            <ol className="os-funnel-rows">
              {funnel.rows.map((r) => (
                <li key={r.stage} className="os-funnel-row">
                  <span className="os-funnel-stage">
                    {LEAD_STAGE_LABELS[r.stage]}
                  </span>
                  <span className="os-funnel-track">
                    <span
                      className="os-funnel-bar"
                      style={{ width: `${Math.max(r.count > 0 ? 6 : 0, (r.count / funnel.max) * 100)}%` }}
                    />
                  </span>
                  <span className="os-funnel-count">{r.count}</span>
                  <span className="os-funnel-value">
                    {r.value > 0 ? cop.format(r.value) : "—"}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>
      ) : null}

      <div className="os-work-grid">
        {can("pipeline") ? (
          <WorkPanel
            icon={PhoneCall}
            title="Seguimientos"
            href="/pipeline"
            count={dueLeads.length}
            empty={{
              title: "Nada vencido",
              hint: "Ponga fecha de seguimiento a cada lead para verlo aquí cuando toque.",
              cta: "Abrir Pipeline",
              ctaHref: "/pipeline",
            }}
          >
            {dueLeads.slice(0, 6).map((l) => {
              const d = daysUntil(l.nextActionDate);
              return (
                <WorkRow
                  key={l.id}
                  href="/pipeline"
                  onClick={() => pinOpenLead(l.id)}
                  title={leadLabel(l)}
                  meta={`${LEAD_STAGE_LABELS[l.stage]}${l.nextAction ? ` · ${l.nextAction}` : ""}`}
                  pill={relativeDays(d)}
                  tone={d !== null && d < 0 ? "danger" : "warn"}
                />
              );
            })}
          </WorkPanel>
        ) : null}

        {can("obra") ? (
          <WorkPanel
            icon={ClipboardCheck}
            title="Trámites de obra"
            href="/obra"
            count={hotJobs.length}
            empty={{
              title: "Sin trámites pendientes",
              hint: "Las obras ganadas desde Pipeline aparecen aquí mientras tengan UPME, RETIE u OR abiertos.",
              cta: "Abrir Obra",
              ctaHref: "/obra",
            }}
          >
            {hotJobs.slice(0, 6).map((j) => (
              <WorkRow
                key={j.id}
                href="/obra"
                onClick={() => sessionStorage.setItem(OPEN_OBRA_KEY, j.id)}
                title={obraLabel(j)}
                meta={`UPME ${TRAMITE_LABELS[j.upme]} · RETIE ${TRAMITE_LABELS[j.retie]} · OR ${TRAMITE_LABELS[j.operadorRed]}`}
                pill={OBRA_STATUS_LABELS[j.status]}
                tone="info"
              />
            ))}
          </WorkPanel>
        ) : null}

        {can("om") ? (
          <WorkPanel
            icon={CalendarClock}
            title="Calendario O&M"
            href="/om"
            count={hotPlants.length}
            empty={{
              title: "Nada vence en 30 días",
              hint: "Al energizar una obra, pásela a O&M para programar sus mantenimientos.",
              cta: "Abrir O&M",
              ctaHref: "/om",
            }}
          >
            {hotPlants.slice(0, 6).map((p) => {
              const vencido = omStatus(p) === "vencido";
              return (
                <WorkRow
                  key={p.id}
                  href="/om"
                  onClick={() => sessionStorage.setItem(OPEN_OM_PLANT_KEY, p.id)}
                  title={plantLabel(p)}
                  meta={p.nextMaintenance ? `Mantenimiento ${p.nextMaintenance}` : "Sin fecha"}
                  pill={relativeDays(daysUntil(p.nextMaintenance))}
                  tone={vencido ? "danger" : "warn"}
                />
              );
            })}
          </WorkPanel>
        ) : null}

        {can("contenido") ? (
          <WorkPanel
            icon={Megaphone}
            title="Contenido de la semana"
            href="/contenido"
            count={weekPieces.length}
            empty={{
              title: "Aún no hay briefs",
              hint: "En Contenido, pida a Daniela la planeación de la semana.",
              cta: "Planear la semana",
              ctaHref: "/contenido",
            }}
          >
            {weekPieces.slice(0, 6).map((p) => (
              <WorkRow
                key={p.id}
                href="/contenido"
                title={p.title || "Sin título"}
                meta={p.date}
                pill={CONTENT_STATUS_LABELS[p.status]}
                tone="neutral"
              />
            ))}
          </WorkPanel>
        ) : null}
      </div>

      <nav className="os-quick" aria-label="Accesos rápidos">
        {can("cotizador") ? (
          <Link href="/cotizador/equipos" className="os-quick-item">
            <FileSpreadsheet size={16} />
            Cotizar solo equipos
          </Link>
        ) : null}
        {can("visita") ? (
          <Link href="/visita-tecnica" className="os-quick-item">
            <ClipboardCheck size={16} />
            Visita técnica
          </Link>
        ) : null}
        {can("contenido") ? (
          <Link href="/contenido" className="os-quick-item">
            <Megaphone size={16} />
            Contenido
          </Link>
        ) : null}
      </nav>
    </AppShell>
  );
}
