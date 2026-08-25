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

/** Evidências mostradas ao usuário para validar uma sugestão antes de aplicar. */
export type LinkEvidence = {
  pending: LinkEvidenceSide;
  target: LinkEvidenceSide;
  referenced_number: string | null;
  overlapping_period: boolean | null;
  /** Algum dos lados tem papel gravado divergente dos CNPJs extraídos. */
  role_conflict: boolean;
};

export type LinkEvidenceSide = {
  role_label: string;
  /** Papel calculado a partir dos nossos CNPJs (null quando não foi possível inferir). */
  role_inferred: "provider" | "client" | null;
  /** Papel gravado divergente do papel inferido pelos CNPJs. */
  role_conflict: boolean;
  contracting_name: string | null;
  contracting_cnpj: string | null;
  contracting_is_ours: boolean;
  counterparty_name: string | null;
  counterparty_cnpj: string | null;
  counterparty_is_ours: boolean;
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
  evidence?: LinkEvidence;
};

export type OwnEntity = { cnpjDigits: string; name: string; tradeName: string | null };

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
 * Papel calculado a partir dos CNPJs/nomes extraídos e das empresas do workspace:
 * nossa empresa como CONTRATADA ⇒ prestação; como CONTRATANTE ⇒ compra.
 * Devolve `null` quando não há evidência suficiente (ou quando ambos os lados
 * apontam para a nossa empresa / nenhum deles aponta).
 */
export function inferRoleFromParties(
  c: ContractLinkMeta,
  own: OwnEntity[],
): "provider" | "client" | null {
  if (!own.length) return null;
  const weAreContracting = isOwnParty(own, c.contracting_cnpj, c.contracting_name);
  const weAreCounterparty = isOwnParty(own, c.counterparty_cnpj, c.counterparty_name);
  if (weAreContracting === weAreCounterparty) return null;
  return weAreCounterparty ? "provider" : "client";
}

/** Papel gravado contradiz o papel inferido pelos CNPJs extraídos? */
export function roleMismatch(c: ContractLinkMeta, own: OwnEntity[]): boolean {
  const inferred = inferRoleFromParties(c, own);
  return inferred !== null && inferred !== c.role;
}

/** Papel efetivo usado na análise: o inferido pelos CNPJs tem prioridade. */
export function effectiveRole(c: ContractLinkMeta, own: OwnEntity[]): "provider" | "client" {
  return inferRoleFromParties(c, own) ?? c.role;
}

/**
 * Verifica se uma sugestão é estruturalmente válida:
 *  - ids existem e são distintos;
 *  - aditivo aponta para contrato principal do MESMO papel;
 *  - compra aponta para prestação (pai) e prestação aponta para compra (filho).
 * Quando as empresas do workspace são informadas, o papel usado é o inferido
 * pelos CNPJs — assim um `role` gravado errado não gera par impossível.
 */
export function isValidSuggestion(
  suggestion: { pending_id: string; target_id: string; kind: LinkKind },
  pending: ContractLinkMeta | undefined,
  target: ContractLinkMeta | undefined,
  own: OwnEntity[] = [],
): boolean {
  if (!pending || !target) return false;
  if (pending.id === target.id) return false;

  const pendingRole = effectiveRole(pending, own);
  const targetRole = effectiveRole(target, own);

  if (suggestion.kind === "amendment") {
    if (pending.document_kind !== "amendment") return false;
    if (target.document_kind === "amendment") return false;
    return pendingRole === targetRole;
  }

  if (pending.document_kind === "amendment") return false;
  if (target.document_kind === "amendment") return false;
  if (pendingRole === "client") return targetRole === "provider";
  if (pendingRole === "provider") return targetRole === "client";
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

export const SUGGESTION_STATUS_LABEL: Record<string, string> = {
  proposed: "Proposta",
  applied: "Aplicada",
  dismissed: "Ignorada",
  superseded: "Reavaliada",
};

const ROLE_SIDE_LABEL: Record<string, string> = {
  provider: "Prestação (somos a CONTRATADA)",
  client: "Compra (somos a CONTRATANTE)",
};

function toEvidenceSide(c: ContractLinkMeta, own: OwnEntity[]): LinkEvidenceSide {
  const inferred = inferRoleFromParties(c, own);
  const conflict = inferred !== null && inferred !== c.role;
  return {
    role_label:
      c.document_kind === "amendment"
        ? `Aditivo · ${ROLE_SIDE_LABEL[c.role] ?? c.role}`
        : (ROLE_SIDE_LABEL[c.role] ?? c.role),
    role_inferred: inferred,
    role_conflict: conflict,
    contracting_name: c.contracting_name,
    contracting_cnpj: c.contracting_cnpj,
    contracting_is_ours: isOwnParty(own, c.contracting_cnpj, c.contracting_name),
    counterparty_name: c.counterparty_name ?? c.company_name,
    counterparty_cnpj: c.counterparty_cnpj,
    counterparty_is_ours: isOwnParty(own, c.counterparty_cnpj, c.counterparty_name),
    starts_at: c.starts_at,
    ends_at: c.ends_at,
  };
}

/** Vigências se sobrepõem? `null` quando faltam datas para comparar. */
export function periodsOverlap(a: ContractLinkMeta, b: ContractLinkMeta): boolean | null {
  const aStart = a.starts_at ? Date.parse(a.starts_at) : null;
  const bStart = b.starts_at ? Date.parse(b.starts_at) : null;
  if (aStart === null || bStart === null) return null;
  const aEnd = a.ends_at ? Date.parse(a.ends_at) : Number.POSITIVE_INFINITY;
  const bEnd = b.ends_at ? Date.parse(b.ends_at) : Number.POSITIVE_INFINITY;
  return aStart <= bEnd && bStart <= aEnd;
}

/** Monta o objeto de evidências (papéis, CNPJs, vigências, número citado). */
export function buildSuggestionEvidence(
  pending: ContractLinkMeta,
  target: ContractLinkMeta,
  own: OwnEntity[],
  referencedNumber: string | null = null,
): LinkEvidence {
  const pendingSide = toEvidenceSide(pending, own);
  const targetSide = toEvidenceSide(target, own);
  return {
    pending: pendingSide,
    target: targetSide,
    referenced_number: referencedNumber,
    overlapping_period: periodsOverlap(pending, target),
    role_conflict: pendingSide.role_conflict || targetSide.role_conflict,
  };
}

export const ROLE_INFERRED_LABEL: Record<"provider" | "client", string> = {
  provider: "Prestação (somos a CONTRATADA)",
  client: "Compra (somos a CONTRATANTE)",
};
