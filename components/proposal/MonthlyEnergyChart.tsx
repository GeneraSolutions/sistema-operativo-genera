"use client";

import { useState } from "react";
import type { MonthlyEnergyPoint } from "@/types/proposal";

function niceMax(raw: number) {
  if (raw <= 0) return 1;
  const exp = Math.pow(10, Math.floor(Math.log10(raw)));
  const n = raw / exp;
  const nice = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return nice * exp;
}

const chartInk = {
  paper: {
    grid: "#e7e0d4",
    gen: "#c4922a",
    cons: "#1f6b45",
    month: "#6d7c74",
    guide: "#c4bbaa",
    tip: "#fff",
    tipLine: "#e4ddd0",
    tipText: "#12241c",
    legend: "text-[#6d7c74]",
    genBar: "bg-[#c4922a]",
    consBar: "bg-[#1f6b45]",
  },
  deck: {
    grid: "#1e2d4a",
    gen: "#f5b942",
    cons: "#5eead4",
    month: "#8aa0c2",
    guide: "#8aa0c2",
    tip: "#0c1426",
    tipLine: "#1e2d4a",
    tipText: "#e8eef8",
    legend: "text-[#8aa0c2]",
    genBar: "bg-[#f5b942]",
    consBar: "bg-[#5eead4]",
  },
  signal: {
    grid: "#1e3d32",
    gen: "#d4b46a",
    cons: "#7ad0a4",
    month: "#8aa497",
    guide: "#3d5a4c",
    tip: "#0d1a14",
    tipLine: "#2a4638",
    tipText: "#e8f6ee",
    legend: "text-[#8aa497]",
    genBar: "bg-[#d4b46a]",
    consBar: "bg-[#7ad0a4]",
  },
} as const;

export function MonthlyEnergyChart({
  data,
  tone = "paper",
}: {
  data: MonthlyEnergyPoint[];
  tone?: "paper" | "signal" | "deck";
}) {
  const ink = chartInk[tone];
  const [hover, setHover] = useState<number | null>(null);
  const width = 920;
  const height = 280;
  const pad = { l: 52, r: 52, t: 24, b: 40 };
  const innerW = width - pad.l - pad.r;
  const innerH = height - pad.t - pad.b;
  const points = data.map((d) => ({
    month: d.month,
    generationKWh: Math.max(0, d.generationKWh || 0),
    consumptionKWh: Math.max(0, d.consumptionKWh || 0),
  }));
  const maxGen = niceMax(Math.max(1, ...points.map((d) => d.generationKWh)));
  const maxCons = niceMax(Math.max(1, ...points.map((d) => d.consumptionKWh)));
  const x = (i: number) =>
    pad.l + (i / Math.max(points.length - 1, 1)) * innerW;
  const yGen = (v: number) => pad.t + innerH - (v / maxGen) * innerH;
  const yCons = (v: number) => pad.t + innerH - (v / maxCons) * innerH;

  const genPath = points
    .map((d, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${yGen(d.generationKWh)}`)
    .join(" ");
  const areaPath = `${genPath} L ${x(points.length - 1)} ${yGen(0)} L ${x(0)} ${yGen(0)} Z`;
  const consPath = points
    .map((d, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${yCons(d.consumptionKWh)}`)
    .join(" ");

  const genTicks = [0, 0.5, 1].map((t) => Math.round(maxGen * t));
  const consTicks = [0, 0.5, 1].map((t) => Math.round(maxCons * t));
  const active = hover != null ? points[hover] : null;

  return (
    <div className="w-full min-w-0 overflow-x-auto">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-auto w-full"
        onMouseLeave={() => setHover(null)}
      >
        {genTicks.map((t) => (
          <g key={`g-${t}`}>
            <line
              x1={pad.l}
              x2={width - pad.r}
              y1={yGen(t)}
              y2={yGen(t)}
              stroke={ink.grid}
              strokeDasharray="3 6"
            />
            <text x={8} y={yGen(t) + 4} fill={ink.gen} fontSize="11">
              {t.toLocaleString("es-CO")}
            </text>
          </g>
        ))}
        {consTicks.map((t) => (
          <text
            key={`c-${t}`}
            x={width - 8}
            y={yCons(t) + 4}
            textAnchor="end"
            fill={ink.cons}
            fontSize="11"
          >
            {t.toLocaleString("es-CO")}
          </text>
        ))}
        <path d={areaPath} fill="url(#genFill)" opacity="0.35" />
        <path d={genPath} fill="none" stroke={ink.gen} strokeWidth="2.8" />
        <path
          d={consPath}
          fill="none"
          stroke={ink.cons}
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {points.map((d, i) => (
          <g key={d.month}>
            <circle cx={x(i)} cy={yGen(d.generationKWh)} r="3.2" fill={ink.gen} />
            <circle cx={x(i)} cy={yCons(d.consumptionKWh)} r="3.2" fill={ink.cons} />
            <rect
              x={x(i) - innerW / points.length / 2}
              y={pad.t}
              width={innerW / points.length}
              height={innerH}
              fill="transparent"
              onMouseEnter={() => setHover(i)}
            />
            <text
              x={x(i)}
              y={height - 12}
              textAnchor="middle"
              fill={ink.month}
              fontSize="11"
            >
              {d.month}
            </text>
          </g>
        ))}
        {hover != null && active ? (
          <g>
            <line
              x1={x(hover)}
              x2={x(hover)}
              y1={pad.t}
              y2={pad.t + innerH}
              stroke={ink.guide}
              strokeDasharray="4 4"
            />
            <rect
              x={Math.min(x(hover) + 10, width - 220)}
              y={pad.t + 6}
              width={200}
              height={58}
              rx="8"
              fill={ink.tip}
              stroke={ink.tipLine}
            />
            <text
              x={Math.min(x(hover) + 20, width - 210)}
              y={pad.t + 26}
              fill={ink.tipText}
              fontSize="12"
              fontWeight="600"
            >
              {active.month}
            </text>
            <text
              x={Math.min(x(hover) + 20, width - 210)}
              y={pad.t + 42}
              fill={ink.gen}
              fontSize="11"
            >
              Generación {active.generationKWh.toLocaleString("es-CO")} kWh
            </text>
            <text
              x={Math.min(x(hover) + 20, width - 210)}
              y={pad.t + 56}
              fill={ink.cons}
              fontSize="11"
            >
              Consumo {active.consumptionKWh.toLocaleString("es-CO")} kWh
            </text>
          </g>
        ) : null}
        <defs>
          <linearGradient id="genFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={ink.gen} stopOpacity="0.4" />
            <stop offset="100%" stopColor={ink.gen} stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>
      <div
        className={`mt-1 flex flex-wrap justify-center gap-x-6 gap-y-1 text-xs ${ink.legend}`}
      >
        <span className="inline-flex items-center gap-2">
          <i className={`h-0.5 w-6 ${ink.genBar}`} />{" "}
          Generación solar (eje izq.)
        </span>
        <span className="inline-flex items-center gap-2">
          <i className={`h-0.5 w-6 ${ink.consBar}`} />{" "}
          Consumo cliente (eje der.)
        </span>
      </div>
    </div>
  );
}
