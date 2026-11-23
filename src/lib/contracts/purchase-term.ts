// Vigência sugerida para o contrato de compra derivado de uma venda: cobre o prazo
// da venda, dos aditivos ativos e do projeto vinculado. O usuário pode ajustar depois.
export type TermSource = { starts_at?: string | null; ends_at?: string | null };

const day = (v: string | null | undefined) => (v ? v.slice(0, 10) : null);

export function suggestPurchaseTerm(
  sources: TermSource[],
  today: string,
): { starts_at: string; ends_at: string | null } {
  const ends = sources.map((s) => day(s.ends_at)).filter((d): d is string => !!d).sort();
  const starts = sources.map((s) => day(s.starts_at)).filter((d): d is string => !!d).sort();
  const t = day(today)!;
  // Não começa no passado: o fornecedor só atua a partir da contratação.
  const start = starts[0] && starts[0] > t ? starts[0] : t;
  const end = ends.length ? ends[ends.length - 1]! : null;
  return { starts_at: start, ends_at: end && end >= start ? end : null };
}
