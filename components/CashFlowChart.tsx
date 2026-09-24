"use client";

import type { YearCashFlow } from "@/types/financials";

const copCompact = new Intl.NumberFormat("es-CO", {
  notation: "compact",
  maximumFractionDigits: 1,
});

export function CashFlowChart({
  cashFlows,
  height = 180,
}: {
  cashFlows: YearCashFlow[];
  height?: number;
}) {
  const rows = cashFlows.filter((r) => r.year > 0);
  if (rows.length === 0) return null;

  const maxAbs = Math.max(
    ...rows.map((r) => Math.abs(r.cumulativeCashFlowCOP)),
    ...rows.map((r) => Math.abs(r.energySavingsCOP)),
    1
  );

  const w = 640;
  const h = height;
  const pad = { t: 16, r: 12, b: 28, l: 44 };
  const innerW = w - pad.l - pad.r;
  const innerH = h - pad.t - pad.b;
  const zeroY = pad.t + innerH / 2;

  const xAt = (i: number) =>
    pad.l + (i / Math.max(rows.length - 1, 1)) * innerW;
  const yAt = (v: number) =>
    zeroY - (v / maxAbs) * (innerH / 2 - 4);

  const cumulativePath = rows
    .map((r, i) => {
      const cmd = i === 0 ? "M" : "L";
      return `${cmd}${xAt(i).toFixed(1)},${yAt(r.cumulativeCashFlowCOP).toFixed(1)}`;
    })
    .join(" ");

  const savingsPath = rows
    .map((r, i) => {
      const cmd = i === 0 ? "M" : "L";
      return `${cmd}${xAt(i).toFixed(1)},${yAt(r.energySavingsCOP).toFixed(1)}`;
    })
    .join(" ");

  return (
    <div className="w-full overflow-hidden rounded-xl bg-gradient-to-br from-[#0f2a1f] to-[#163d2c] p-4 text-white">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[10px] tracking-[0.2em] text-[#d4b46a] uppercase">
            Proyección 25 años
          </p>
          <p className="text-sm font-medium text-[#e8f0ec]">
            Flujo acumulado vs. ahorro energético
          </p>
        </div>
        <div className="flex gap-4 text-xs text-[#a8c4b6]">
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-4 bg-[#d4b46a]" /> Acumulado
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-4 bg-[#5ecf9a]" /> Ahorro anual
          </span>
        </div>
      </div>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="h-auto w-full"
        role="img"
        aria-label="Gráfico de flujo de caja a 25 años"
      >
        <line
          x1={pad.l}
          y1={zeroY}
          x2={w - pad.r}
          y2={zeroY}
          stroke="#2a5a45"
          strokeDasharray="4 4"
        />
        <path
          d={savingsPath}
          fill="none"
          stroke="#5ecf9a"
          strokeWidth="2"
          opacity="0.85"
        />
        <path
          d={cumulativePath}
          fill="none"
          stroke="#d4b46a"
          strokeWidth="2.5"
        />
        {rows
          .filter((_, i) => i % 5 === 0 || i === rows.length - 1)
          .map((r) => {
            const i = rows.indexOf(r);
            return (
              <text
                key={r.year}
                x={xAt(i)}
                y={h - 8}
                textAnchor="middle"
                fill="#8aa398"
                fontSize="10"
              >
                A{r.year}
              </text>
            );
          })}
        <text x={4} y={pad.t + 8} fill="#8aa398" fontSize="9">
          {copCompact.format(maxAbs)}
        </text>
        <text x={4} y={h - pad.b} fill="#8aa398" fontSize="9">
          -{copCompact.format(maxAbs)}
        </text>
      </svg>
    </div>
  );
}
