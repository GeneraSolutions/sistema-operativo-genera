import type { MonthlyEnergyPoint } from "@/types/proposal";

export function MonthlyEnergyChart({ data }: { data: MonthlyEnergyPoint[] }) {
  const width = 920;
  const height = 260;
  const pad = { l: 44, r: 16, t: 20, b: 36 };
  const innerW = width - pad.l - pad.r;
  const innerH = height - pad.t - pad.b;
  const rawMax = Math.max(
    1,
    ...data.flatMap((d) => [d.generationKWh, d.consumptionKWh])
  );
  const maxY = Math.ceil(rawMax / 200) * 200;
  const x = (i: number) => pad.l + (i / Math.max(data.length - 1, 1)) * innerW;
  const y = (v: number) => pad.t + innerH - (v / maxY) * innerH;

  const genPath = data
    .map((d, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(d.generationKWh)}`)
    .join(" ");
  const areaPath = `${genPath} L ${x(data.length - 1)} ${y(0)} L ${x(0)} ${y(0)} Z`;
  const consPath = data
    .map((d, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(d.consumptionKWh)}`)
    .join(" ");

  const tickStep = maxY <= 800 ? 200 : maxY <= 2000 ? 400 : 800;
  const ticks: number[] = [];
  for (let t = 0; t <= maxY; t += tickStep) ticks.push(t);

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full min-w-[520px]">
        {ticks.map((t) => (
          <g key={t}>
            <line
              x1={pad.l}
              x2={width - pad.r}
              y1={y(t)}
              y2={y(t)}
              stroke="#1e2d4a"
              strokeDasharray="3 6"
            />
            <text x={8} y={y(t) + 4} fill="#6b7c99" fontSize="11">
              {t}
            </text>
          </g>
        ))}
        <path d={areaPath} fill="url(#genFill)" opacity="0.35" />
        <path d={genPath} fill="none" stroke="#f5b942" strokeWidth="2.5" />
        <path
          d={consPath}
          fill="none"
          stroke="#94a3b8"
          strokeWidth="2"
          strokeDasharray="5 5"
        />
        {data.map((d, i) => (
          <text
            key={d.month}
            x={x(i)}
            y={height - 10}
            textAnchor="middle"
            fill="#8aa0c2"
            fontSize="11"
          >
            {d.month}
          </text>
        ))}
        <defs>
          <linearGradient id="genFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f5b942" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#f5b942" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>
      <div className="mt-1 flex justify-center gap-6 text-xs text-[#8aa0c2]">
        <span className="inline-flex items-center gap-2">
          <i className="h-0.5 w-6 bg-[#f5b942]" /> Generación Solar
        </span>
        <span className="inline-flex items-center gap-2">
          <i className="h-px w-6 border-t border-dashed border-slate-400" /> Consumo
          Cliente
        </span>
      </div>
    </div>
  );
}
