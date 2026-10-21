"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { SiteMapPicker } from "@/components/SiteMapPicker";
import {
  CANAL_LABELS,
  GRID_LABELS,
  ROOF_LABELS,
  compressVisitPhoto,
  emptySiteVisit,
  loadStoredSiteVisit,
  saveStoredSiteVisit,
  type CanalType,
  type GridType,
  type RoofCoverType,
  type SiteVisit,
} from "@/lib/site-visit";
import {
  OPEN_VISIT_KEY,
  getSavedVisit,
  saveVisitSnapshot,
} from "@/lib/saved-visits";
import {
  OPEN_LEAD_KEY,
  attachVisitToLead,
  loadLeads,
  persistLeadsCloud,
} from "@/lib/pipeline";
import { EnergyBillPanel } from "@/components/EnergyBillPanel";
import { emptyEnergyBill } from "@/lib/energy-bill";

const inputClass =
  "w-full rounded-xl border border-[#d8d2c4] bg-[#fbfaf6] px-3 py-2.5 text-sm";

export default function VisitaTecnicaPage() {
  const router = useRouter();
  const [visit, setVisit] = useState<SiteVisit>(emptySiteVisit);
  const [linked, setLinked] = useState(false);
  const [flash, setFlash] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [savedId, setSavedId] = useState<string | undefined>();
  const photoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const openId = sessionStorage.getItem(OPEN_VISIT_KEY);
    if (openId) {
      sessionStorage.removeItem(OPEN_VISIT_KEY);
      const archived = getSavedVisit(openId);
      if (archived) {
        setVisit(archived.visit);
        setLinked(archived.linked);
        setSavedId(archived.id);
        saveStoredSiteVisit({
          visit: archived.visit,
          linked: archived.linked,
        });
        setHydrated(true);
        return;
      }
    }
    const stored = loadStoredSiteVisit();
    if (stored) {
      setVisit(stored.visit);
      setLinked(stored.linked);
    }
    const leadId = sessionStorage.getItem(OPEN_LEAD_KEY);
    if (leadId && !openId) {
      const lead = loadLeads().find((l) => l.id === leadId);
      if (lead) {
        setVisit((prev) => ({
          ...prev,
          clientName: lead.clientName || prev.clientName,
          location: lead.siteName || lead.city || prev.location,
        }));
      }
    }
    setHydrated(true);
  }, []);

  function persist(nextVisit = visit, nextLinked = linked) {
    saveStoredSiteVisit({ visit: nextVisit, linked: nextLinked });
  }

  function patch<K extends keyof SiteVisit>(key: K, value: SiteVisit[K]) {
    setVisit((prev) => ({ ...prev, [key]: value }));
  }

  async function saveVisit() {
    persist(visit, linked);
    try {
      const archived = saveVisitSnapshot({
        visit,
        linked,
        id: savedId,
      });
      setSavedId(archived.id);
      const res = await fetch("/api/archivo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visit: archived }),
      });
      const leadId = sessionStorage.getItem(OPEN_LEAD_KEY);
      if (leadId) {
        const leads = attachVisitToLead(leadId, archived.id);
        persistLeadsCloud(leads);
        sessionStorage.removeItem(OPEN_LEAD_KEY);
      }
      setFlash(
        res.ok
          ? "Visita técnica guardada. Ya aparece en Archivo en todos los equipos."
          : "Se guardó en este equipo, pero no llegó al servidor. Intente de nuevo."
      );
    } catch {
      setFlash(
        "No se pudo guardar. Quite algunas fotos e intente de nuevo."
      );
    }
    window.setTimeout(() => setFlash(""), 4500);
  }

  function newVisit() {
    const next = emptySiteVisit();
    setVisit(next);
    setLinked(false);
    setSavedId(undefined);
    persist(next, false);
    setFlash("Formulario limpio para una visita nueva.");
    window.setTimeout(() => setFlash(""), 2500);
  }

  function setLink(next: boolean) {
    setLinked(next);
    persist(visit, next);
  }

  async function onPhotos(files: FileList | null) {
    if (!files?.length) return;
    const room = Math.max(0, 8 - visit.photos.length);
    const picked = Array.from(files).slice(0, room);
    const photos = [...visit.photos];
    for (const file of picked) {
      try {
        const dataUrl = await compressVisitPhoto(file);
        photos.push({
          id: crypto.randomUUID(),
          dataUrl,
          name: file.name,
        });
      } catch {
        /* skip broken image */
      }
    }
    const next = { ...visit, photos };
    setVisit(next);
  }

  function goQuote() {
    persist(visit, true);
    setLinked(true);
    router.push("/cotizador?visita=1");
  }

  function exportPdf() {
    persist(visit, linked);
    window.print();
  }

  if (!hydrated) {
    return (
      <AppShell title="Visitas técnicas" subtitle="Levantamiento fotovoltaico">
        <p className="text-sm text-[#6d7c74]">Cargando visita…</p>
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Visitas Técnicas Genera Solutions"
      subtitle="Levantamiento de campo · enlace al cotizador"
    >
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="os-page-hero">
          <h2 className="text-2xl font-semibold text-[#12241c]">
            Levantamiento fotovoltaico
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-[#4d5c55]">
            Registre red, cubierta, recorridos y SST. Al vincular, el cotizador
            usa metros reales de cable y tubería en lugar del estimado por kWp.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={linked}
          onClick={() => setLink(!linked)}
          className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-left shadow-sm ${
            linked
              ? "border-[#1f6b45]/40 bg-[#1f6b45] text-white"
              : "border-[#d8d2c4] bg-white text-[#12241c]"
          }`}
        >
          <span
            className={`flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 ${
              linked ? "bg-white/30" : "bg-[#c4bbb0]"
            }`}
          >
            <span
              className={`h-5 w-5 rounded-full bg-white shadow transition ${
                linked ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </span>
          <span>
            <span className="block text-[10px] font-bold tracking-wider uppercase opacity-80">
              {linked ? "ON" : "OFF"}
            </span>
            <span className="block text-sm font-semibold">
              Vincular al cotizador
            </span>
          </span>
        </button>
      </div>

      {flash ? (
        <p className="mb-4 rounded-xl bg-[#e8f6ee] px-4 py-2 text-sm text-[#1f6b45] print:hidden">
          {flash}
        </p>
      ) : null}

      <div className="grid gap-4">
        <VisitCard title="Datos generales" defaultOpen>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Cliente / proyecto">
              <input
                className={inputClass}
                value={visit.clientName}
                onChange={(e) => patch("clientName", e.target.value)}
              />
            </Field>
            <Field label="Fecha">
              <input
                type="date"
                className={inputClass}
                value={visit.visitDate}
                onChange={(e) => patch("visitDate", e.target.value)}
              />
            </Field>
            <Field label="Técnico responsable">
              <input
                className={inputClass}
                value={visit.technician}
                onChange={(e) => patch("technician", e.target.value)}
              />
            </Field>
            <Field label="Ubicación (nombre del predio / ciudad)">
              <input
                className={inputClass}
                placeholder="Ej. Finca El Sol, Rionegro"
                value={visit.location}
                onChange={(e) => patch("location", e.target.value)}
              />
            </Field>
            <div className="sm:col-span-2">
              <p className="mb-1 text-sm font-medium text-[#12241c]">
                Punto exacto en el mapa
              </p>
              <SiteMapPicker
                lat={visit.lat}
                lon={visit.lon}
                onPick={(lat, lon) =>
                  setVisit((prev) => ({
                    ...prev,
                    lat: Math.round(lat * 1e5) / 1e5,
                    lon: Math.round(lon * 1e5) / 1e5,
                  }))
                }
              />
              {typeof visit.lat === "number" && typeof visit.lon === "number" ? (
                <p className="mt-1 text-xs font-medium text-[#1f6b45]">
                  Lat {visit.lat} · Lon {visit.lon} · se envía al cotizador /
                  IDEAM al vincular
                </p>
              ) : (
                <p className="mt-1 text-xs text-[#6d7c74]">
                  Aún no hay pin. Busca, usa el GPS o toca el mapa.
                </p>
              )}
            </div>
          </div>
        </VisitCard>

        <VisitCard title="Sistema eléctrico existente">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Tipo de red">
              <select
                className={inputClass}
                value={visit.gridType}
                onChange={(e) => patch("gridType", e.target.value as GridType)}
              >
                {(Object.keys(GRID_LABELS) as GridType[]).map((k) => (
                  <option key={k} value={k}>
                    {GRID_LABELS[k]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Breaker principal TNM (A)">
              <input
                type="number"
                min={0}
                className={inputClass}
                value={visit.mainBreakerAmps}
                onChange={(e) =>
                  patch("mainBreakerAmps", Number(e.target.value) || 0)
                }
              />
            </Field>
            <Field label="Espacio en tablero">
              <input
                className={inputClass}
                placeholder="Polos libres, marca, observaciones"
                value={visit.panelSpace}
                onChange={(e) => patch("panelSpace", e.target.value)}
              />
            </Field>
            <Field label="Estado puesta a tierra (SPT)">
              <select
                className={inputClass}
                value={visit.groundingStatus}
                onChange={(e) =>
                  patch(
                    "groundingStatus",
                    e.target.value as SiteVisit["groundingStatus"]
                  )
                }
              >
                <option value="bueno">Bueno</option>
                <option value="regular">Regular</option>
                <option value="deficiente">Deficiente</option>
                <option value="ausente">No hay SPT</option>
              </select>
            </Field>
            <Field label="Tipo de medidor">
              <select
                className={inputClass}
                value={visit.meterType}
                onChange={(e) =>
                  patch("meterType", e.target.value as SiteVisit["meterType"])
                }
              >
                <option value="convencional">Convencional</option>
                <option value="bidireccional">Bidireccional</option>
                <option value="prepago">Prepago</option>
                <option value="inteligente">Inteligente / AMI</option>
              </select>
            </Field>
          </div>
        </VisitCard>

        <VisitCard title="Zona de paneles / techo">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Tipo de cubierta">
              <select
                className={inputClass}
                value={visit.roofType}
                onChange={(e) =>
                  patch("roofType", e.target.value as RoofCoverType)
                }
              >
                {(Object.keys(ROOF_LABELS) as RoofCoverType[]).map((k) => (
                  <option key={k} value={k}>
                    {ROOF_LABELS[k]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Estado estructural">
              <select
                className={inputClass}
                value={visit.structuralState}
                onChange={(e) =>
                  patch(
                    "structuralState",
                    e.target.value as SiteVisit["structuralState"]
                  )
                }
              >
                <option value="bueno">Bueno</option>
                <option value="regular">Regular</option>
                <option value="refuerzo">Requiere refuerzo</option>
              </select>
            </Field>
            <Field label="Orientación">
              <input
                className={inputClass}
                value={visit.orientation}
                onChange={(e) => patch("orientation", e.target.value)}
              />
            </Field>
            <Field label="Inclinación (°)">
              <input
                type="number"
                className={inputClass}
                value={visit.tiltDeg}
                onChange={(e) => patch("tiltDeg", Number(e.target.value) || 0)}
              />
            </Field>
            <Field label="Área útil (m²)">
              <input
                type="number"
                min={0}
                className={inputClass}
                value={visit.usefulAreaM2}
                onChange={(e) =>
                  patch("usefulAreaM2", Number(e.target.value) || 0)
                }
              />
            </Field>
            <Field label="Sombras">
              <select
                className={inputClass}
                value={visit.shading}
                onChange={(e) =>
                  patch("shading", e.target.value as SiteVisit["shading"])
                }
              >
                <option value="ninguna">Ninguna</option>
                <option value="parcial">Parcial</option>
                <option value="critica">Crítica</option>
              </select>
            </Field>
          </div>
        </VisitCard>

        <VisitCard title="Recorridos y canalización">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Distancia paneles → inversor (m)">
              <input
                type="number"
                min={0}
                className={inputClass}
                value={visit.dcRunM}
                onChange={(e) => patch("dcRunM", Number(e.target.value) || 0)}
              />
            </Field>
            <Field label="Distancia inversor → tablero AC (m)">
              <input
                type="number"
                min={0}
                className={inputClass}
                value={visit.acRunM}
                onChange={(e) => patch("acRunM", Number(e.target.value) || 0)}
              />
            </Field>
            <Field label="Tipo de canalización">
              <select
                className={inputClass}
                value={visit.canalType}
                onChange={(e) =>
                  patch("canalType", e.target.value as CanalType)
                }
              >
                {(Object.keys(CANAL_LABELS) as CanalType[]).map((k) => (
                  <option key={k} value={k}>
                    {CANAL_LABELS[k]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Superficie del inversor">
              <select
                className={inputClass}
                value={visit.inverterSurface}
                onChange={(e) =>
                  patch(
                    "inverterSurface",
                    e.target.value as SiteVisit["inverterSurface"]
                  )
                }
              >
                <option value="muro">Muro</option>
                <option value="piso">Piso</option>
                <option value="cuarto">Cuarto técnico</option>
                <option value="poste">Poste / estructura</option>
              </select>
            </Field>
            <Field label="Señal WiFi">
              <select
                className={inputClass}
                value={visit.wifi}
                onChange={(e) =>
                  patch("wifi", e.target.value as SiteVisit["wifi"])
                }
              >
                <option value="si">Sí, estable</option>
                <option value="parcial">Parcial / intermitente</option>
                <option value="no">No hay</option>
              </select>
            </Field>
          </div>
        </VisitCard>

        <VisitCard title="Logística y SST">
          <Field label="Acceso al techo">
            <select
              className={inputClass}
              value={visit.roofAccess}
              onChange={(e) =>
                patch("roofAccess", e.target.value as SiteVisit["roofAccess"])
              }
            >
              <option value="escalera">Escalera de gato / fija</option>
              <option value="interno">Acceso interno</option>
              <option value="andamio">Requiere andamio</option>
              <option value="dificil">Difícil / restringido</option>
            </select>
          </Field>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <Check
              checked={visit.needLifting}
              onChange={(v) => patch("needLifting", v)}
              label="Necesita izaje / grúa"
            />
            <Check
              checked={visit.needScaffold}
              onChange={(v) => patch("needScaffold", v)}
              label="Necesita andamios"
            />
            <Check
              checked={visit.needLifeline}
              onChange={(v) => patch("needLifeline", v)}
              label="Línea de vida / trabajo en altura"
            />
          </div>
          <Field label="Notas de campo">
            <textarea
              className={`${inputClass} mt-3 min-h-24`}
              value={visit.notes}
              onChange={(e) => patch("notes", e.target.value)}
            />
          </Field>
        </VisitCard>

        <VisitCard title="Recibo de energía">
          <EnergyBillPanel
            bill={visit.energyBill ?? emptyEnergyBill()}
            onChange={(energyBill) => patch("energyBill", energyBill)}
          />
        </VisitCard>

        <VisitCard title="Registro fotográfico">
          <input
            ref={photoInputRef}
            type="file"
            accept="image/*"
            multiple
            className="sr-only"
            onChange={(e) => {
              void onPhotos(e.target.files);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-xl bg-[#1f6b45] px-4 py-3 text-sm font-semibold text-white shadow-sm print:hidden"
            onClick={() => photoInputRef.current?.click()}
          >
            Agregar fotos del sitio
          </button>
          <p className="mt-2 text-[11px] text-[#6d7c74] print:hidden">
            Hasta 8 fotos, comprimidas para caber en el navegador. Fachada,
            tablero, cubierta, inversor y sombras.
          </p>
          {visit.photos.length ? (
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {visit.photos.map((p) => (
                <div key={p.id} className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.dataUrl}
                    alt={p.name}
                    className="h-28 w-full rounded-xl object-cover ring-1 ring-[#e4dfd4]"
                  />
                  <button
                    type="button"
                    className="absolute right-1 top-1 rounded-full bg-white/90 px-2 text-xs print:hidden"
                    onClick={() =>
                      patch(
                        "photos",
                        visit.photos.filter((x) => x.id !== p.id)
                      )
                    }
                  >
                    Quitar
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-sm text-[#6d7c74]">Sin fotos aún.</p>
          )}
        </VisitCard>

        <VisitCard title="Hallazgos adicionales">
          <Field label="Cosas que no están en el formulario">
            <textarea
              className={`${inputClass} min-h-24`}
              placeholder="Ej. vecino con queja de sombras, medidor en poste, teja de asbesto, acceso por predio ajeno…"
              value={visit.extraNotes ?? ""}
              onChange={(e) => patch("extraNotes", e.target.value)}
            />
          </Field>
        </VisitCard>
      </div>

      <div className="mt-5 flex flex-wrap gap-3 print:hidden">
        <button
          type="button"
          onClick={saveVisit}
          className="rounded-xl bg-[#0f2a1f] px-4 py-2.5 text-sm font-semibold text-white shadow-sm"
        >
          Guardar visita técnica
        </button>
        <button
          type="button"
          onClick={newVisit}
          className="rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-[#0f2a1f] shadow-sm ring-1 ring-[#d8d2c4]"
        >
          Nueva visita
        </button>
        <Link
          href="/archivo"
          className="rounded-xl px-4 py-2.5 text-sm font-semibold text-[#1f6b45] underline"
        >
          Ver archivo
        </Link>
        <button
          type="button"
          onClick={exportPdf}
          className="rounded-xl bg-[#1d4ed8] px-4 py-2.5 text-sm font-semibold text-white shadow-sm"
        >
          Exportar informe de visita a PDF
        </button>
        <button
          type="button"
          onClick={goQuote}
          className="rounded-xl bg-[#1f6b45] px-4 py-2.5 text-sm font-semibold text-white shadow-sm"
        >
          Ir a cotizar con estos datos
        </button>
        <Link
          href="/cotizador"
          className="rounded-xl px-4 py-2.5 text-sm font-semibold text-[#1f6b45] underline"
        >
          Abrir cotizador
        </Link>
      </div>
    </AppShell>
  );
}

function VisitCard({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="os-fold os-panel rounded-2xl border border-[#ddd6c8] bg-white p-4 shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 text-left print:hidden"
      >
        <h3 className="text-sm font-semibold tracking-wide text-[#1f6b45] uppercase">
          {title}
        </h3>
        <span
          aria-hidden
          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#fbfaf6] text-lg font-semibold text-[#1f6b45]"
        >
          {open ? "−" : "+"}
        </span>
      </button>
      <h3 className="mb-3 hidden text-sm font-semibold tracking-wide text-[#1f6b45] uppercase print:block">
        {title}
      </h3>
      <div className={open ? "mt-3" : "mt-3 hidden print:block"}>{children}</div>
    </section>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-[#12241c]">{label}</span>
      {children}
    </label>
  );
}

function Check({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex items-center gap-2 rounded-xl bg-[#f7f4ee] px-3 py-2 text-sm font-medium">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      {label}
    </label>
  );
}
