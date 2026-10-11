"""Parse IDEAM atlas PDF into lib/ideam-stations.ts (GHI Wh/m2/day)."""
from __future__ import annotations

import re
from pathlib import Path

from pypdf import PdfReader

PDF = Path(r"c:\Users\Admin\Downloads\ATLAS+RADIACION+SOLAR+UV+Y+OZONO+DE+COLOMBIA (1).pdf")
OUT = Path(__file__).resolve().parents[1] / "lib" / "ideam-stations.ts"

NUM = re.compile(r"-?\d+(?:[.,]\d+)?")
PERIOD = re.compile(
    r"(ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic)-\d{2}\s+a\s+",
    re.I,
)


def to_float(s: str) -> float:
    return float(s.replace(",", "."))


def parse_rows(text: str) -> list[dict]:
    rows: list[dict] = []
    buf = ""
    for raw in text.splitlines():
        line = raw.strip()
        if not line:
            continue
        buf = f"{buf} {line}".strip() if buf else line
        period = PERIOD.search(buf)
        if not period:
            # keep buffering short names that wrap
            if len(buf) > 400:
                buf = line
            continue
        body = buf[: period.start()]
        nums = [to_float(n) for n in NUM.findall(body)]
        buf = ""
        if len(nums) < 16:
            continue
        lat, lon, elev = nums[-16], nums[-15], nums[-14]
        months = nums[-13:-1]
        annual = nums[-1]
        if not (-5.5 <= lat <= 14.5 and -83 <= lon <= -66):
            continue
        if any(m < 1200 or m > 9000 for m in months):
            continue
        name = body
        name = re.sub(r"-?\d+(?:[.,]\d+)?(?:\s+-?\d+(?:[.,]\d+)?){14,}\s*$", "", name).strip()
        if re.search(r"Anexo|PROMEDIOS|Estaci[oó]n Municipio|Valor promedio", name, re.I):
            name = re.split(r"(?:información\)ENE|NOV DIC)\s+", name)[-1].strip()
        name = re.sub(r"^.*?DIC\s+", "", name).strip()
        name = re.sub(r"\s+", " ", name)
        rows.append(
            {
                "name": name,
                "lat": round(lat, 4),
                "lon": round(lon, 4),
                "elev": int(round(elev)),
                "wh": [round(m, 1) for m in months],
                "annual": round(annual, 1),
            }
        )
    return rows


def main() -> None:
    reader = PdfReader(str(PDF))
    chunks: list[str] = []
    for i, page in enumerate(reader.pages):
        t = page.extract_text() or ""
        if "Wh/m" in t and ("ENE" in t or "Ene" in t):
            chunks.append(t)
    rows = parse_rows("\n".join(chunks))
    # dedupe by lat,lon keep first (anexo 3/11/12 overlap)
    seen: dict[tuple[float, float], dict] = {}
    for row in rows:
        key = (row["lat"], row["lon"])
        if key not in seen:
            seen[key] = row
        else:
            # prefer more complete name
            if len(row["name"]) > len(seen[key]["name"]):
                seen[key]["name"] = row["name"]
    stations = sorted(seen.values(), key=lambda r: (r["lat"], r["lon"], r["name"]))
    print("stations", len(stations))
    lines = [
        "/** Irradiación global media diaria (Wh/m²·día) — Atlas IDEAM de radiación solar de Colombia. */",
        "export interface IdeamStation {",
        "  id: string;",
        "  name: string;",
        "  lat: number;",
        "  lon: number;",
        "  elev: number;",
        "  /** Wh/m² por día, ene..dic */",
        "  wh: number[];",
        "  annualWh: number;",
        "}",
        "",
        "export const IDEAM_STATIONS: IdeamStation[] = [",
    ]
    for i, s in enumerate(stations):
        sid = f"ideam-{i:03d}"
        name = s["name"].replace("\\", " ").replace('"', "'")
        wh = ", ".join(f"{v:.1f}" for v in s["wh"])
        lines.append(
            f'  {{ id: "{sid}", name: "{name}", lat: {s["lat"]}, lon: {s["lon"]}, elev: {s["elev"]}, wh: [{wh}], annualWh: {s["annual"]:.1f} }},'
        )
    lines.append("];")
    lines.append("")
    OUT.write_text("\n".join(lines), encoding="utf-8")
    print("wrote", OUT)


if __name__ == "__main__":
    main()
