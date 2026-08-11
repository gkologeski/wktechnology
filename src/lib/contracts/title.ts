// Padronização do título de contratos: `PREFIXO CONTRATANTE X CONTRATADA`.
// Módulo client-safe (usado na importação, no formulário e na ação em lote).

export type ContractTitleParts = {
  /** "provider" = somos a CONTRATADA; "client" = somos a CONTRATANTE. */
  role?: string | null;
  serviceType?: string | null;
  documentKind?: string | null;
  amendmentNumber?: string | null;
  /** Nome da CONTRATANTE, quando conhecido. */
  contractingName?: string | null;
  /** Nome da contraparte extraído/cadastrado. */
  counterpartyName?: string | null;
  /** Nome da nossa entidade legal (quando identificada). */
  ownName?: string | null;
  /** Nomes das nossas entidades legais do workspace (para identificar qual lado é nosso). */
  ownNames?: (string | null | undefined)[] | null;
  /** Início da vigência (ISO) — usado para o sufixo do ano. */
  startsAt?: string | null;
  /** Sufixo com o ano da vigência. Ativo por padrão; passe `false` para omitir. */
  includeYear?: boolean;
};

/** Motivo pelo qual não foi possível calcular o título padronizado. */
export type TitleSkipReason = "missing_parties" | "same_parties";


const PRESTACAO_PREFIX = "[PRESTAÇÃO]";
const COMPRA_PREFIX = "[COMPRA]";


const COMPANY_SUFFIXES =
  /\b(ltda|limitada|s\/?a|sa|s\.a|me|epp|eireli|mei|cia|companhia|sociedade|empresa)\b/gi;

const MAX_PARTY_CHARS = 40;

/** Normaliza a razão social para uso no título: maiúsculas, sem sufixos societários. */
export function normalizePartyName(value: string | null | undefined): string | null {
  const raw = (value ?? "").trim();
  if (!raw) return null;
  let name = raw
    .replace(/[.,;]+/g, " ")
    .replace(COMPANY_SUFFIXES, " ")
    .replace(/\s{2,}/g, " ")
    .trim()
    .toUpperCase();
  if (!name) name = raw.trim().toUpperCase();
  if (name.length > MAX_PARTY_CHARS) {
    name =
      name
        .slice(0, MAX_PARTY_CHARS)
        .replace(/[\s-]+\S*$/, "")
        .trim() || name.slice(0, MAX_PARTY_CHARS);
  }
  // Remove pontuação/conectores soltos nas pontas (ex.: "GM KOLOGESKI &").
  name = name.replace(/^[\s&/\-–—+.]+|[\s&/\-–—+.]+$/g, "").trim();
  return name || null;
}

function prefixFor(parts: ContractTitleParts): string {
  return parts.role === "client" ? COMPRA_PREFIX : PRESTACAO_PREFIX;
}


/** Resolve quem é CONTRATANTE e quem é CONTRATADA a partir dos dados disponíveis. */
export function resolveContractParties(parts: ContractTitleParts): {
  contracting: string | null;
  contracted: string | null;
} {
  const contractingRaw = parts.contractingName?.trim() || null;
  const counterparty = parts.counterpartyName?.trim() || null;
  const own = parts.ownName?.trim() || null;

  if (parts.role === "client") {
    // Somos a CONTRATANTE; a contraparte é a CONTRATADA.
    return {
      contracting: normalizePartyName(contractingRaw || own),
      contracted: normalizePartyName(counterparty),
    };
  }
  // Somos a CONTRATADA (prestação).
  return {
    contracting: normalizePartyName(contractingRaw || counterparty),
    contracted: normalizePartyName(own || (contractingRaw ? counterparty : null)),
  };
}

/**
 * Monta o título padronizado. Retorna `null` quando as partes não são
 * suficientes — nesse caso o chamador deve manter o título original.
 */
export function buildContractTitle(parts: ContractTitleParts): string | null {
  const { contracting, contracted } = resolveContractParties(parts);
  if (!contracting || !contracted || contracting === contracted) return null;

  const segments: string[] = [];
  if (parts.documentKind === "amendment") {
    const num = (parts.amendmentNumber ?? "").trim();
    segments.push(num ? `[ADITIVO ${num.toUpperCase()}]` : "[ADITIVO]");
  }
  segments.push(prefixFor(parts));
  let title = `${segments.join(" ")} ${contracting} X ${contracted}`;

  if (parts.includeYear !== false) {
    const year = (parts.startsAt ?? "").slice(0, 4);
    if (/^\d{4}$/.test(year)) title = `${title} — ${year}`;
  }
  return title;
}
