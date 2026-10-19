/**
 * Bloqueio comercial das campanhas: não enviar a quem já é cliente (negócio
 * ganho ou contrato ativo) nem a quem tem negociação aberta. Regras puras.
 */
export type CommercialFlag = "customer" | "open_deal";

export type CommercialOptions = { excludeCustomers: boolean; excludeOpenDeals: boolean };

export const COMMERCIAL_LABEL: Record<CommercialFlag, string> = {
  customer: "Já é cliente",
  open_deal: "Negociação em aberto",
};

/** Estágio de negócio: ganho, perdido ou aberto. */
export function dealState(stage: string | null | undefined): "won" | "lost" | "open" {
  const s = String(stage ?? "").toLowerCase();
  if (s === "won" || s === "closedwon" || s === "ganho") return "won";
  if (s === "lost" || s === "closedlost" || s === "perdido") return "lost";
  return "open";
}

/** Motivo do bloqueio, respeitando as opções da campanha. Cliente prevalece. */
export function commercialBlock(
  flags: Set<CommercialFlag> | undefined,
  opts: CommercialOptions,
): CommercialFlag | null {
  if (!flags) return null;
  if (opts.excludeCustomers && flags.has("customer")) return "customer";
  if (opts.excludeOpenDeals && flags.has("open_deal")) return "open_deal";
  return null;
}

export function splitCommercial<T>(
  items: T[],
  keyOf: (item: T) => string,
  flags: Map<string, Set<CommercialFlag>>,
  opts: CommercialOptions,
  overrides: Set<string>,
): {
  kept: (T & { overrideCommercial: boolean })[];
  removed: (T & { commercialReason: CommercialFlag })[];
} {
  const kept: (T & { overrideCommercial: boolean })[] = [];
  const removed: (T & { commercialReason: CommercialFlag })[] = [];
  for (const it of items) {
    const key = keyOf(it);
    const reason = commercialBlock(flags.get(key), opts);
    if (!reason) kept.push({ ...it, overrideCommercial: false });
    else if (overrides.has(key)) kept.push({ ...it, overrideCommercial: true });
    else removed.push({ ...it, commercialReason: reason });
  }
  return { kept, removed };
}
