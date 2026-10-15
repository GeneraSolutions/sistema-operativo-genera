"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import {
  OM_CONTRACT_LABELS,
  OM_STATUS_LABELS,
  addMonths,
  daysUntil,
  markMaintenanceDone,
  omStatus,
  plantLabel,
  type OmStatus,
} from "@/lib/om";
import {
  OPEN_OM_PLANT_KEY,
  OPEN_REPORT_KIND_KEY,
  deletePlant,
  emptyPlant,
  loadPlants,
  mergePlants,
  replacePlants,
  upsertPlant,
  type OmContract,
  type PlantProfile,
} from "@/lib/technical-reports";

const field =
  "w-full rounded-xl border border-[#d8d2c4] bg-[#fbfaf6] px-3 py-2.5 text-sm";

const STATUS_TONE: Record<OmStatus, string> = {
  vencido: "bg-[#fde8e8] text-[#9b2c2c]",
  proximo: "bg-[#fff4e5] text-[#9a5b00]",
  "al-dia": "bg-[#e8f6ee] text-[#1f6b45]",
  "sin-fecha": "bg-[#f7f4ee] text-[#6d7c74]",
};

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function persistCloud(plants: PlantProfile[]) {
  void fetch("/api/archivo", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ plants }),
  }).catch(() => undefined);
}

export default function OmPage() {
  const router = useRouter();
  const [plants, setPlants] = useState<PlantProfile[]>([]);
  const [draft, setDraft] = useState<PlantProfile>(() => emptyPlant());
  const [filter, setFilter] = useState<"todas" | OmStatus>("todas");
  const [flash, setFlash] = useState("");

  useEffect(() => {
    const local = loadPlants();
    setPlants(local);
    const openId = sessionStorage.getItem(OPEN_OM_PLANT_KEY);
    if (openId) {
      const found = local.find((p) => p.id === openId);
      if (found) setDraft({ ...emptyPlant(), ...found });
      sessionStorage.removeItem(OPEN_OM_PLANT_KEY);
    }
    void fetch("/api/archivo", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data?.plants) return;
        const merged = mergePlants(loadPlants(), data.plants);
        replacePlants(merged);
        setPlants(merged);
        const stillOpen = openId
          ? merged.find((p) => p.id === openId)
          : undefined;
        if (stillOpen) setDraft({ ...emptyPlant(), ...stillOpen });
      })
      .catch(() => undefined);
  }, []);

  const counts = useMemo(() => {
    const list = plants.map(omStatus);
    return {
      vencido: list.filter((s) => s === "vencido").length,
      proximo: list.filter((s) => s === "proximo").length,
      "al-dia": list.filter((s) => s === "al-dia").length,
      "sin-fecha": list.filter((s) => s === "sin-fecha").length,
    };
  }, [plants]);

  const visible = plants
    .filter((p) => (filter === "todas" ? true : omStatus(p) === filter))
    .sort((a, b) => {
      const da = daysUntil(a.nextMaintenance);
      const db = daysUntil(b.nextMaintenance);
      if (da === null && db === null) return 0;
      if (da === null) return 1;
      if (db === null) return -1;
      return da - db;
    });

  function saveDraft() {
    if (!draft.clientName.trim()) {
      setFlash("Indique al menos el cliente.");
      return;
    }
    const next = upsertPlant(draft);
    setPlants(next);
    persistCloud(next);
    setFlash("Planta guardada en O&M y Archivo.");
  }

  function openReport(plant: PlantProfile, kind: "pre-mantenimiento" | "post-mantenimiento") {
    sessionStorage.setItem(OPEN_OM_PLANT_KEY, plant.id);
    sessionStorage.setItem(OPEN_REPORT_KIND_KEY, kind);
    router.push("/informes");
  }

  return (
    <AppShell title="O&M" subtitle="Plantas · calendario · contratos">
      <p className="mb-5 max-w-3xl text-sm leading-6 text-[#4d5c55]">
        Cartera de plantas en operación. Un vencimiento abre el diagnóstico
        pre-mantenimiento; al cerrar el servicio, el informe post y la próxima
        fecha. El dictamen fotográfico queda a un clic.
      </p>
      {flash ? (
        <p className="mb-3 rounded-xl bg-[#e8f6ee] px-4 py-2 text-sm text-[#1f6b45]">
          {flash}
        </p>
      ) : null}

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {(
          [
            ["vencido", counts.vencido],
            ["proximo", counts.proximo],
            ["al-dia", counts["al-dia"]],
            ["sin-fecha", counts["sin-fecha"]],
          ] as const
        ).map(([id, n]) => (
          <button
            key={id}
            type="button"
            onClick={() => setFilter((f) => (f === id ? "todas" : id))}
            className={`rounded-2xl border px-4 py-3 text-left ${
              filter === id ? "border-[#1f6b45]" : "border-[#ddd6c8] bg-white"
            } ${STATUS_TONE[id]}`}
          >
            <p className="text-2xl font-semibold">{n}</p>
            <p className="text-xs font-semibold uppercase tracking-wide">
              {OM_STATUS_LABELS[id]}
            </p>
          </button>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
        <section className="rounded-2xl border border-[#ddd6c8] bg-white">
          <div className="flex items-center justify-between gap-3 border-b border-[#eee8dc] px-4 py-3">
            <h2 className="font-semibold">Cartera</h2>
            <button
              type="button"
              className="text-sm font-semibold text-[#1f6b45] underline"
              onClick={() => setFilter("todas")}
            >
              Ver todas
            </button>
          </div>
          {visible.length === 0 ? (
            <p className="px-4 py-8 text-sm text-[#6d7c74]">
              Aún no hay plantas en este filtro. Cargue una a la derecha o
              reutilice las de Informes.
            </p>
          ) : (
            <ul className="divide-y divide-[#eee8dc]">
              {visible.map((p) => {
                const status = omStatus(p);
                const d = daysUntil(p.nextMaintenance);
                return (
                  <li key={p.id} className="px-4 py-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold">{plantLabel(p)}</p>
                        <p className="text-xs text-[#6d7c74]">
                          {p.kwp ? `${p.kwp} kWp · ` : ""}
                          {OM_CONTRACT_LABELS[p.contract || "ninguno"]}
                          {p.nextMaintenance
                            ? ` · próximo ${p.nextMaintenance}`
                            : ""}
                          {d !== null ? ` · ${d} días` : ""}
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_TONE[status]}`}
                      >
                        {OM_STATUS_LABELS[status]}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="text-xs font-semibold text-[#1f6b45] underline"
                        onClick={() => setDraft({ ...emptyPlant(), ...p })}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        className="text-xs font-semibold text-[#1f6b45] underline"
                        onClick={() => openReport(p, "pre-mantenimiento")}
                      >
                        Diagnóstico
                      </button>
                      <button
                        type="button"
                        className="text-xs font-semibold text-[#1f6b45] underline"
                        onClick={() => openReport(p, "post-mantenimiento")}
                      >
                        Post-mant.
                      </button>
                      <a
                        href="/informes/dictamen"
                        className="text-xs font-semibold text-[#1f6b45] underline"
                      >
                        Dictamen foto
                      </a>
                      <button
                        type="button"
                        className="text-xs font-semibold text-[#1f6b45] underline"
                        onClick={() => {
                          const date = todayISO();
                          const next = upsertPlant(markMaintenanceDone(p, date));
                          setPlants(next);
                          persistCloud(next);
                          setFlash(
                            `Mantenimiento registrado. Próxima visita ${addMonths(date, p.intervalMonths || 12)}.`
                          );
                        }}
                      >
                        Hecho hoy
                      </button>
                      <button
                        type="button"
                        className="text-xs font-semibold text-[#9b2c2c] underline"
                        onClick={() => {
                          if (!confirm("¿Quitar esta planta de O&M?")) return;
                          const next = deletePlant(p.id);
                          setPlants(next);
                          persistCloud(next);
                          void fetch(`/api/archivo?plant=${p.id}`, {
                            method: "DELETE",
                          });
                        }}
                      >
                        Quitar
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border border-[#ddd6c8] bg-white p-5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-semibold">
              {plants.some((p) => p.id === draft.id) ? "Editar planta" : "Nueva planta"}
            </h2>
            <button
              type="button"
              className="text-xs font-semibold text-[#1f6b45] underline"
              onClick={() => setDraft(emptyPlant())}
            >
              Limpiar
            </button>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="text-sm sm:col-span-2">
              <span className="mb-1 block font-medium">Cliente</span>
              <input
                className={field}
                value={draft.clientName}
                onChange={(e) =>
                  setDraft((p) => ({ ...p, clientName: e.target.value }))
                }
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium">Sitio</span>
              <input
                className={field}
                value={draft.siteName}
                onChange={(e) =>
                  setDraft((p) => ({ ...p, siteName: e.target.value }))
                }
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium">Ciudad</span>
              <input
                className={field}
                value={draft.city}
                onChange={(e) => setDraft((p) => ({ ...p, city: e.target.value }))}
              />
            </label>
            <label className="text-sm sm:col-span-2">
              <span className="mb-1 block font-medium">Dirección</span>
              <input
                className={field}
                value={draft.address}
                onChange={(e) =>
                  setDraft((p) => ({ ...p, address: e.target.value }))
                }
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium">kWp</span>
              <input
                className={field}
                value={draft.kwp}
                onChange={(e) => setDraft((p) => ({ ...p, kwp: e.target.value }))}
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium">Inversor</span>
              <input
                className={field}
                value={draft.inverter}
                onChange={(e) =>
                  setDraft((p) => ({ ...p, inverter: e.target.value }))
                }
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium">Contacto</span>
              <input
                className={field}
                value={draft.contact || ""}
                onChange={(e) =>
                  setDraft((p) => ({ ...p, contact: e.target.value }))
                }
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium">Contrato</span>
              <select
                className={field}
                value={draft.contract || "ninguno"}
                onChange={(e) =>
                  setDraft((p) => ({
                    ...p,
                    contract: e.target.value as OmContract,
                  }))
                }
              >
                {(Object.keys(OM_CONTRACT_LABELS) as OmContract[]).map((id) => (
                  <option key={id} value={id}>
                    {OM_CONTRACT_LABELS[id]}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium">Cada (meses)</span>
              <input
                type="number"
                min={1}
                className={field}
                value={draft.intervalMonths || 12}
                onChange={(e) =>
                  setDraft((p) => ({
                    ...p,
                    intervalMonths: Math.max(1, Number(e.target.value) || 12),
                  }))
                }
              />
            </label>
            <label className="flex items-end gap-2 pb-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={draft.ours}
                onChange={(e) =>
                  setDraft((p) => ({ ...p, ours: e.target.checked }))
                }
              />
              Instalada por GENERA
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium">Último mantenimiento</span>
              <input
                type="date"
                className={field}
                value={draft.lastMaintenance || ""}
                onChange={(e) =>
                  setDraft((p) => ({ ...p, lastMaintenance: e.target.value }))
                }
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium">Próximo</span>
              <input
                type="date"
                className={field}
                value={draft.nextMaintenance || ""}
                onChange={(e) =>
                  setDraft((p) => ({ ...p, nextMaintenance: e.target.value }))
                }
              />
            </label>
          </div>
          <label className="mt-3 block text-sm">
            <span className="mb-1 block font-medium">Notas</span>
            <textarea
              className={field}
              rows={3}
              value={draft.notes}
              onChange={(e) => setDraft((p) => ({ ...p, notes: e.target.value }))}
            />
          </label>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-xl bg-[#0f2a1f] px-4 py-2.5 text-sm font-semibold text-white"
              onClick={saveDraft}
            >
              Guardar planta
            </button>
            <button
              type="button"
              className="rounded-xl border border-[#d8d2c4] bg-white px-4 py-2.5 text-sm font-semibold"
              onClick={() => {
                if (!draft.lastMaintenance && !draft.nextMaintenance) {
                  const last = todayISO();
                  setDraft((p) => ({
                    ...p,
                    lastMaintenance: last,
                    nextMaintenance: addMonths(last, p.intervalMonths || 12),
                  }));
                  return;
                }
                if (draft.lastMaintenance) {
                  setDraft((p) => ({
                    ...p,
                    nextMaintenance: addMonths(
                      p.lastMaintenance || todayISO(),
                      p.intervalMonths || 12
                    ),
                  }));
                }
              }}
            >
              Calcular próxima fecha
            </button>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
