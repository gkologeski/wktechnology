// Compact number/currency formatters (pt-BR) to keep KPI cards from overflowing.
// Full value should always be exposed via `title=` for accessibility.

export function compactNumber(v: number): string {
  const n = Number(v ?? 0);
  if (!Number.isFinite(n)) return "0";
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1_000_000_000)
    return `${sign}${(abs / 1_000_000_000).toFixed(abs >= 10_000_000_000 ? 0 : 1).replace(".", ",")} bi`;
  if (abs >= 1_000_000)
    return `${sign}${(abs / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1).replace(".", ",")} mi`;
  if (abs >= 1_000)
    return `${sign}${(abs / 1_000).toFixed(abs >= 10_000 ? 0 : 1).replace(".", ",")} mil`;
  return `${sign}${abs.toLocaleString("pt-BR")}`;
}

export function compactBRL(v: number): string {
  const n = Number(v ?? 0);
  if (!Number.isFinite(n)) return "R$ 0";
  const abs = Math.abs(n);
  // Só compacta acima de 100k para preservar precisão em valores comuns.
  if (abs < 100_000) {
    try {
      return new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
        maximumFractionDigits: 0,
      }).format(n);
    } catch {
      return `R$ ${n.toFixed(0)}`;
    }
  }
  const sign = n < 0 ? "-" : "";
  if (abs >= 1_000_000_000)
    return `${sign}R$ ${(abs / 1_000_000_000).toFixed(1).replace(".", ",")} bi`;
  if (abs >= 1_000_000) return `${sign}R$ ${(abs / 1_000_000).toFixed(1).replace(".", ",")} mi`;
  return `${sign}R$ ${(abs / 1_000).toFixed(0)} mil`;
}

export function fullBRL(v: number): string {
  try {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v ?? 0);
  } catch {
    return `R$ ${(v ?? 0).toFixed(2)}`;
  }
}
