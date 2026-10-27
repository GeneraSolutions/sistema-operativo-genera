const millions = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 1 });

export function copCompact(value: number) {
  const v = Math.round(Number(value) || 0);
  const abs = Math.abs(v);
  if (abs >= 1e9) return `$ ${millions.format(v / 1e9)} mil M`;
  if (abs >= 1e6) return `$ ${millions.format(v / 1e6)} M`;
  if (abs >= 1e3) return `$ ${millions.format(v / 1e3)} mil`;
  return `$ ${v}`;
}
