"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  lat?: number;
  lon?: number;
  onPick: (lat: number, lon: number) => void;
};

const COLOMBIA: [number, number] = [4.57, -74.3];

export function SiteMapPicker({ lat, lon, onPick }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const markerRef = useRef<import("leaflet").CircleMarker | null>(null);
  const onPickRef = useRef(onPick);
  const [geoError, setGeoError] = useState("");
  const [search, setSearch] = useState("");
  const [searching, setSearching] = useState(false);

  onPickRef.current = onPick;

  useEffect(() => {
    let cancelled = false;
    const el = hostRef.current;
    if (!el) return;

    void (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !hostRef.current || mapRef.current) return;

      const start: [number, number] =
        typeof lat === "number" && typeof lon === "number"
          ? [lat, lon]
          : COLOMBIA;
      const map = L.map(hostRef.current, {
        scrollWheelZoom: true,
      }).setView(start, typeof lat === "number" ? 16 : 6);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap",
        maxZoom: 19,
      }).addTo(map);

      const place = (la: number, lo: number, fly = true) => {
        const here: [number, number] = [la, lo];
        if (markerRef.current) markerRef.current.setLatLng(here);
        else {
          markerRef.current = L.circleMarker(here, {
            radius: 9,
            color: "#1f6b45",
            weight: 2,
            fillColor: "#d4b46a",
            fillOpacity: 1,
          }).addTo(map);
        }
        if (fly) map.setView(here, Math.max(map.getZoom(), 16));
      };

      if (typeof lat === "number" && typeof lon === "number") {
        place(lat, lon, false);
      }

      map.on("click", (e) => {
        place(e.latlng.lat, e.latlng.lng);
        onPickRef.current(e.latlng.lat, e.latlng.lng);
      });

      mapRef.current = map;
      requestAnimationFrame(() => map.invalidateSize());
    })();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // Map instance once per mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || typeof lat !== "number" || typeof lon !== "number") return;
    void import("leaflet").then(({ default: L }) => {
      const here: [number, number] = [lat, lon];
      if (markerRef.current) markerRef.current.setLatLng(here);
      else {
        markerRef.current = L.circleMarker(here, {
          radius: 9,
          color: "#1f6b45",
          weight: 2,
          fillColor: "#d4b46a",
          fillOpacity: 1,
        }).addTo(map);
      }
      map.setView(here, Math.max(map.getZoom(), 16));
    });
  }, [lat, lon]);

  function useGps() {
    setGeoError("");
    if (!navigator.geolocation) {
      setGeoError("Este navegador no permite GPS.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onPick(pos.coords.latitude, pos.coords.longitude);
      },
      () => setGeoError("No se pudo leer el GPS. Permite la ubicación o pincha el mapa."),
      { enableHighAccuracy: true, timeout: 12000 }
    );
  }

  async function runSearch() {
    const q = search.trim();
    if (!q) return;
    setSearching(true);
    setGeoError("");
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=co&q=${encodeURIComponent(q)}`;
      const res = await fetch(url, {
        headers: { Accept: "application/json" },
      });
      const rows = (await res.json()) as { lat: string; lon: string }[];
      const hit = rows[0];
      if (!hit) {
        setGeoError("No encontramos ese lugar en Colombia.");
        return;
      }
      onPick(Number(hit.lat), Number(hit.lon));
    } catch {
      setGeoError("No se pudo buscar. Pincha el mapa o usa el GPS.");
    } finally {
      setSearching(false);
    }
  }

  return (
    <div className="mt-2 print:hidden">
      <div className="mb-2 flex flex-wrap gap-2">
        <input
          className="min-w-[180px] flex-1 rounded-xl border border-[#d8d2c4] bg-[#fbfaf6] px-3 py-2 text-sm"
          placeholder="Buscar vereda, barrio o dirección"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void runSearch();
            }
          }}
        />
        <button
          type="button"
          onClick={() => void runSearch()}
          className="rounded-xl bg-[#0f2a1f] px-3 py-2 text-sm font-semibold text-white"
          disabled={searching}
        >
          {searching ? "Buscando…" : "Buscar"}
        </button>
        <button
          type="button"
          onClick={useGps}
          className="rounded-xl bg-[#1f6b45] px-3 py-2 text-sm font-semibold text-white"
        >
          Usar mi ubicación
        </button>
      </div>
      <div
        ref={hostRef}
        className="h-64 w-full overflow-hidden rounded-xl ring-1 ring-[#d8d2c4]"
      />
      <p className="mt-1 text-[11px] text-[#6d7c74]">
        Pincha el mapa en el predio. Esa latitud y longitud van al cotizador para
        interpolar el atlas IDEAM.
      </p>
      {geoError ? (
        <p className="mt-1 text-xs text-[#9b2c2c]">{geoError}</p>
      ) : null}
    </div>
  );
}
