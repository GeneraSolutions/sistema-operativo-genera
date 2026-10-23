"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
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
  mergeContent,
  mondayOf,
  persistContentCloud,
  piecesInWeek,
  replaceContent,
} from "@/lib/content";

const cop = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

function todayISO() {
  return new Date().toISOString().slice(0, 10);
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

export default function InicioPage() {
  const [leads, setLeads] = useState<CommercialLead[]>([]);
  const [jobs, setJobs] = useState<ObraJob[]>([]);
  const [plants, setPlants] = useState<PlantProfile[]>([]);
  const [weekPieces, setWeekPieces] = useState(() =>
    piecesInWeek(loadContent(), mondayOf())
  );
  const [me, setMe] = useState<{
    role: Role;
    modules?: string[];
  } | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.user) setMe({ role: data.user.role, modules: data.user.modules });
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
        const merged = mergeContent(loadContent(), data.pieces);
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

  const openValue = leads
    .filter((l) => l.stage !== "ganado" && l.stage !== "perdido")
    .reduce((sum, l) => sum + (Number(l.estimatedValue) || 0), 0);

  const hotJobs = useMemo(
    () => jobs.filter(obraNeedsAttention),
    [jobs]
  );

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

  return (
    <AppShell title="Hoy" subtitle="Qué está caliente">
      <p className="os-page-intro mb-5 max-w-3xl text-sm leading-6 text-[#4d5c55]">
        Esto no es un plan semanal: son las fichas que ya piden un paso.
        Toque una y el OS abre Pipeline, Obra u O&M.
      </p>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {can("pipeline") ? (
          <Link
            href="/pipeline"
            className="os-stat rounded-2xl border border-[#ddd6c8] bg-white px-4 py-3 hover:border-[#1f6b45]"
          >
            <p className="text-2xl font-semibold text-[#9a5b00]">{dueLeads.length}</p>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#6d7c74]">
              Seguimientos vencidos
            </p>
            <p className="mt-1 text-xs text-[#6d7c74]">
              Abierto {cop.format(openValue)}
            </p>
          </Link>
        ) : null}
        {can("obra") ? (
          <Link
            href="/obra"
            className="os-stat rounded-2xl border border-[#ddd6c8] bg-white px-4 py-3 hover:border-[#1f6b45]"
          >
            <p className="text-2xl font-semibold text-[#2a5f8f]">{hotJobs.length}</p>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#6d7c74]">
              Obras con trámite
            </p>
          </Link>
        ) : null}
        {can("om") ? (
          <Link
            href="/om"
            className="os-stat rounded-2xl border border-[#ddd6c8] bg-white px-4 py-3 hover:border-[#1f6b45]"
          >
            <p className="text-2xl font-semibold text-[#9b2c2c]">{omVencido}</p>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#6d7c74]">
              O&M vencido
            </p>
          </Link>
        ) : null}
        {can("om") ? (
          <Link
            href="/om"
            className="os-stat rounded-2xl border border-[#ddd6c8] bg-white px-4 py-3 hover:border-[#1f6b45]"
          >
            <p className="text-2xl font-semibold text-[#9a5b00]">{omProximo}</p>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#6d7c74]">
              O&M en 30 días
            </p>
          </Link>
        ) : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {can("pipeline") ? (
          <section className="os-panel rounded-2xl border border-[#ddd6c8] bg-white">
            <div className="flex items-center justify-between gap-2 border-b border-[#eee8dc] px-4 py-3">
              <h2 className="font-semibold">Pipeline · llamar o mover</h2>
              <Link href="/pipeline" className="text-xs font-semibold text-[#1f6b45] underline">
                Abrir
              </Link>
            </div>
            {dueLeads.length === 0 ? (
              <p className="px-4 py-5 text-sm text-[#6d7c74]">
                Nada vencido.
                <span className="os-page-intro mt-1 block text-xs">
                  Ponga fecha de seguimiento en Pipeline.
                </span>
              </p>
            ) : (
              <ul className="divide-y divide-[#eee8dc]">
                {dueLeads.slice(0, 8).map((l) => (
                  <li key={l.id}>
                    <Link
                      href="/pipeline"
                      onClick={() => pinOpenLead(l.id)}
                      className="block px-4 py-3 hover:bg-[#fbfaf6]"
                    >
                      <p className="font-semibold">{leadLabel(l)}</p>
                      <p className="text-xs text-[#6d7c74]">
                        {LEAD_STAGE_LABELS[l.stage]}
                        {l.nextAction ? ` · ${l.nextAction}` : ""}
                        {` · ${l.nextActionDate}`}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ) : null}

        {can("obra") ? (
          <section className="os-panel rounded-2xl border border-[#ddd6c8] bg-white">
            <div className="flex items-center justify-between gap-2 border-b border-[#eee8dc] px-4 py-3">
              <h2 className="font-semibold">Obra · UPME / RETIE / OR</h2>
              <Link href="/obra" className="text-xs font-semibold text-[#1f6b45] underline">
                Abrir
              </Link>
            </div>
            {hotJobs.length === 0 ? (
              <p className="px-4 py-5 text-sm text-[#6d7c74]">
                Sin trámites pendientes.
                <span className="os-page-intro mt-1 block text-xs">
                  Las obras ganadas desde Pipeline aparecen aquí.
                </span>
              </p>
            ) : (
              <ul className="divide-y divide-[#eee8dc]">
                {hotJobs.slice(0, 8).map((j) => (
                  <li key={j.id}>
                    <Link
                      href="/obra"
                      onClick={() => sessionStorage.setItem(OPEN_OBRA_KEY, j.id)}
                      className="block px-4 py-3 hover:bg-[#fbfaf6]"
                    >
                      <p className="font-semibold">{obraLabel(j)}</p>
                      <p className="text-xs text-[#6d7c74]">
                        {OBRA_STATUS_LABELS[j.status]} · UPME{" "}
                        {TRAMITE_LABELS[j.upme]} · RETIE {TRAMITE_LABELS[j.retie]}
                        {" · OR "}
                        {TRAMITE_LABELS[j.operadorRed]}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ) : null}

        {can("om") ? (
          <section className="os-panel rounded-2xl border border-[#ddd6c8] bg-white">
            <div className="flex items-center justify-between gap-2 border-b border-[#eee8dc] px-4 py-3">
              <h2 className="font-semibold">O&M · calendario</h2>
              <Link href="/om" className="text-xs font-semibold text-[#1f6b45] underline">
                Abrir
              </Link>
            </div>
            {hotPlants.length === 0 ? (
              <p className="px-4 py-5 text-sm text-[#6d7c74]">
                Nada vence en 30 días.
                <span className="os-page-intro mt-1 block text-xs">
                  Al energizar, pásela a O&M desde Obra.
                </span>
              </p>
            ) : (
              <ul className="divide-y divide-[#eee8dc]">
                {hotPlants.slice(0, 8).map((p) => {
                  const status = omStatus(p);
                  const d = daysUntil(p.nextMaintenance);
                  return (
                    <li key={p.id}>
                      <Link
                        href="/om"
                        onClick={() =>
                          sessionStorage.setItem(OPEN_OM_PLANT_KEY, p.id)
                        }
                        className="block px-4 py-3 hover:bg-[#fbfaf6]"
                      >
                        <p className="font-semibold">{plantLabel(p)}</p>
                        <p className="text-xs text-[#6d7c74]">
                          {status === "vencido" ? "Vencido" : "Próximo"}
                          {d !== null
                            ? d < 0
                              ? ` · hace ${Math.abs(d)} días`
                              : ` · en ${d} días`
                            : ""}
                          {p.nextMaintenance ? ` · ${p.nextMaintenance}` : ""}
                        </p>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        ) : null}

        {can("contenido") ? (
          <section className="os-panel rounded-2xl border border-[#ddd6c8] bg-white">
            <div className="flex items-center justify-between gap-2 border-b border-[#eee8dc] px-4 py-3">
              <h2 className="font-semibold">Contenido · esta semana</h2>
              <Link
                href="/contenido"
                className="text-xs font-semibold text-[#1f6b45] underline"
              >
                Abrir
              </Link>
            </div>
            {weekPieces.length === 0 ? (
              <p className="px-4 py-5 text-sm text-[#6d7c74]">
                Aún no hay briefs.
                <span className="os-page-intro mt-1 block text-xs">
                  En Contenido, pida la semana a Daniela.
                </span>
              </p>
            ) : (
              <ul className="divide-y divide-[#eee8dc]">
                {weekPieces.slice(0, 8).map((p) => (
                  <li key={p.id}>
                    <Link
                      href="/contenido"
                      className="block px-4 py-3 hover:bg-[#fbfaf6]"
                    >
                      <p className="font-semibold">{p.title || "Sin título"}</p>
                      <p className="text-xs text-[#6d7c74]">
                        {p.date} · {CONTENT_STATUS_LABELS[p.status]}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ) : null}
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {can("pipeline") ? (
          <Link
            href="/pipeline"
            className="rounded-xl border border-[#1f6b45] px-3 py-1.5 text-sm font-semibold text-[#1f6b45]"
          >
            Nuevo lead
          </Link>
        ) : null}
        {can("cotizador") ? (
          <Link
            href="/cotizador?nueva=1"
            className="rounded-xl border border-[#1f6b45] px-3 py-1.5 text-sm font-semibold text-[#1f6b45]"
          >
            Nueva cotización
          </Link>
        ) : null}
        {can("cotizador") ? (
          <Link
            href="/cotizador/equipos"
            className="rounded-xl border border-[#1f6b45] px-3 py-1.5 text-sm font-semibold text-[#1f6b45]"
          >
            Cotizar equipos
          </Link>
        ) : null}
        {can("contenido") ? (
          <Link
            href="/contenido"
            className="rounded-xl border border-[#1f6b45] px-3 py-1.5 text-sm font-semibold text-[#1f6b45]"
          >
            Contenido de la semana
          </Link>
        ) : null}
        {can("visita") ? (
          <Link
            href="/visita-tecnica"
            className="rounded-xl border border-[#1f6b45] px-3 py-1.5 text-sm font-semibold text-[#1f6b45]"
          >
            Visita técnica
          </Link>
        ) : null}
      </div>
    </AppShell>
  );
}
