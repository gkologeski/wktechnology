// Regras puras da sugestão de vínculos entre contratos (sem imports de servidor).
// Usadas tanto pela camada determinística quanto pela validação das respostas da IA.

export type LinkKind = "parent" | "amendment";
export type LinkConfidence = "high" | "medium" | "low";

/** Metadados mínimos de um contrato usados na análise de vínculos. */
export type ContractLinkMeta = {
  id: string;
  role: "provider" | "client";
  document_kind: string;
  number: string | null;
  self_number: string | null;
  title: string;
  company_name: string | null;
  contracting_name: string | null;
  contracting_cnpj: string | null;
  counterparty_name: string | null;
  counterparty_cnpj: string | null;
  starts_at: string | null;
  ends_at: string | null;
};

export type LinkSuggestion = {
  pending_id: string;
  target_id: string;
  kind: LinkKind;
  confidence: LinkConfidence;
  reason: string;
  source: "rule" | "ai";
};

function digits(value: string | null | undefined): string {
  return (value ?? "").replace(/\D/g, "");
}

export function normalizeEntityName(value: string | null | undefined): string {
  return (value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\b(ltda|me|epp|eireli|sa|s\/a|cia|e)\b/g, "")
    .replace(/[^a-z0-9]/g, "");
}

/** Indica se um nome/CNPJ corresponde a uma das entidades legais do workspace. */
export function isOwnParty(
  own: Array<{ cnpjDigits: string; name: string; tradeName: string | null }>,
  cnpj: string | null | undefined,
  name: string | null | undefined,
): boolean {
  const d = digits(cnpj);
  if (d.length === 14 && own.some((e) => e.cnpjDigits === d)) return true;
  const n = normalizeEntityName(name);
  if (n.length < 4) return false;
  return own.some((e) => {
    const a = normalizeEntityName(e.name);
    const b = normalizeEntityName(e.tradeName);
    return (
      (a.length >= 4 && (a === n || a.includes(n) || n.includes(a))) ||
      (b.length >= 4 && (b === n || b.includes(n) || n.includes(b)))
    );
  });
}

/**
 * Verifica se uma sugestão é estruturalmente válida:
 *  - ids existem e são distintos;
 *  - aditivo aponta para contrato principal do MESMO papel;
 *  - compra aponta para prestação (pai) e prestação aponta para compra (filho).
 */
export function isValidSuggestion(
  suggestion: { pending_id: string; target_id: string; kind: LinkKind },
  pending: ContractLinkMeta | undefined,
  target: ContractLinkMeta | undefined,
): boolean {
  if (!pending || !target) return false;
  if (pending.id === target.id) return false;

  if (suggestion.kind === "amendment") {
    if (pending.document_kind !== "amendment") return false;
    if (target.document_kind === "amendment") return false;
    return pending.role === target.role;
  }

  if (pending.document_kind === "amendment") return false;
  if (target.document_kind === "amendment") return false;
  if (pending.role === "client") return target.role === "provider";
  if (pending.role === "provider") return target.role === "client";
  return false;
}

/** Mantém apenas a primeira sugestão por contrato pendente, priorizando confiança. */
export function dedupeSuggestions(items: LinkSuggestion[]): LinkSuggestion[] {
  const order: Record<LinkConfidence, number> = { high: 0, medium: 1, low: 2 };
  const best = new Map<string, LinkSuggestion>();
  for (const item of items) {
    const current = best.get(item.pending_id);
    if (!current) {
      best.set(item.pending_id, item);
      continue;
    }
    const better =
      order[item.confidence] < order[current.confidence] ||
      (order[item.confidence] === order[current.confidence] &&
        item.source === "rule" &&
        current.source === "ai");
    if (better) best.set(item.pending_id, item);
  }
  return Array.from(best.values());
}

export const CONFIDENCE_LABEL: Record<LinkConfidence, string> = {
  high: "Alta",
  medium: "Média",
  low: "Baixa",
};
