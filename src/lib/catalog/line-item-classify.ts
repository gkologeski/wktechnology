// Classificação de itens de linha legados (texto livre vindo do HubSpot) nas três
// dimensões do catálogo: linha de serviço (service_catalog), cargo (job_profiles)
// e senioridade. Funções puras, sem acesso a banco — usadas na tela de migração
// e nas server functions que aplicam o mapeamento.

export type ServiceLike = { id: string; name: string; unit?: string | null };
export type JobProfileLike = { id: string; name: string };

/** Remove acentos, pontuação e espaços extras. */
export function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9+#. ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const SENIORITY_TOKENS: Array<{ seniority: string; tokens: string[] }> = [
  { seniority: "estagio", tokens: ["estagio", "estagiario", "trainee"] },
  { seniority: "junior", tokens: ["junior", "jr", "jr.", "i"] },
  { seniority: "pleno", tokens: ["pleno", "pl", "pl.", "ii"] },
  { seniority: "senior", tokens: ["senior", "sr", "sr.", "sn", "iii"] },
  { seniority: "especialista", tokens: ["especialista", "expert", "specialist"] },
  { seniority: "coordenacao", tokens: ["coordenador", "coordenadora", "coordenacao"] },
  { seniority: "gerencia", tokens: ["gerente", "gerencia", "manager"] },
];

/**
 * Extrai a senioridade do nome e devolve o nome sem ela.
 * "Desenvolvedor Delphi Senior" → { base: "desenvolvedor delphi", seniority: "senior" }
 * "Análise de Negócios II" → { base: "analise de negocios", seniority: "pleno" }
 * Cargos cujo próprio nome é a função (Coordenador, Gerente) preservam o token
 * no `base`, porque ali "Coordenador" é o cargo, não o nível.
 */
export function parseSeniority(name: string): { base: string; seniority: string | null } {
  const words = normalize(name).split(" ").filter(Boolean);
  if (words.length === 0) return { base: "", seniority: null };

  for (let i = words.length - 1; i >= 0; i -= 1) {
    const word = words[i] as string;
    const hit = SENIORITY_TOKENS.find((s) => s.tokens.includes(word));
    if (!hit) continue;
    // "Coordenador de RH" / "Gerente de Operações": o token é o cargo em si.
    const isRoleWord = hit.seniority === "coordenacao" || hit.seniority === "gerencia";
    if (isRoleWord) return { base: words.join(" "), seniority: hit.seniority };
    // Numeral romano só vale como nível quando não é a única palavra.
    if (["i", "ii", "iii"].includes(word) && words.length === 1) continue;
    const base = [...words.slice(0, i), ...words.slice(i + 1)].join(" ").trim();
    return { base: base || words.join(" "), seniority: hit.seniority };
  }
  return { base: words.join(" "), seniority: null };
}

type ServiceRule = { match: RegExp; service: RegExp };

/** Regras de palavra-chave → nome da linha de serviço no catálogo. */
const SERVICE_RULES: ServiceRule[] = [
  { match: /fabrica de software|squad|projeto fechado/, service: /fabrica de software/ },
  { match: /hunting|recrutamento|selecao|headhunt/, service: /hunting/ },
  {
    match: /consultoria|diagnostico|mockup|assessment|arquitetura de solucoes|analise de negocios/,
    service: /consultoria/,
  },
  {
    match:
      /(desenvolvedor|programador|dev |devops|qa|quality|test|dba|database|arquiteto|tech lead|lider tecnico|scrum|product owner|po |analista de sistemas|analista de dados|analista de suporte|analista de programacao|designer|ux|ui|infra|sre|cloud|aws|azure|power bi|rpa|sap|salesforce|mobile|front end|back end|fullstack|full stack|node|react|angular|java|delphi|python|php|progress|net|c#)/,
    service: /outsourcing/,
  },
  {
    match:
      /(financeiro|contabil|fiscal|administrativo|faturamento|cobranca|assistente de atendimento|implantacao|backoffice|bpo)/,
    service: /bpo administrativo/,
  },
  {
    match: /(recursos humanos|rh|departamento pessoal|dp |recrutador)/,
    service: /recursos humanos/,
  },
];

/** Sugere a linha de serviço do catálogo para um nome livre de item de linha. */
export function suggestServiceForName(name: string, catalog: ServiceLike[]): string | null {
  const n = normalize(name);
  if (!n) return null;
  for (const rule of SERVICE_RULES) {
    if (!rule.match.test(n)) continue;
    const hit = catalog.find((c) => rule.service.test(normalize(c.name)));
    if (hit) return hit.id;
  }
  return null;
}

function tokens(value: string): Set<string> {
  return new Set(
    normalize(value)
      .split(" ")
      .filter((t) => t.length > 1),
  );
}

/** Similaridade de Dice entre conjuntos de tokens (0..1). */
export function tokenSimilarity(a: string, b: string): number {
  const ta = tokens(a);
  const tb = tokens(b);
  if (ta.size === 0 || tb.size === 0) return 0;
  let shared = 0;
  for (const t of ta) if (tb.has(t)) shared += 1;
  return (2 * shared) / (ta.size + tb.size);
}

export const JOB_MATCH_THRESHOLD = 0.72;

/**
 * Casa o nome (já sem senioridade) com um cargo cadastrado.
 * Primeiro casamento exato normalizado; depois similaridade de tokens acima do
 * limite de confiança. Abaixo disso devolve null — a linha fica para revisão.
 */
export function matchJobProfile(
  base: string,
  profiles: JobProfileLike[],
): { id: string; score: number } | null {
  const n = normalize(base);
  if (!n) return null;
  const exact = profiles.find((p) => normalize(p.name) === n);
  if (exact) return { id: exact.id, score: 1 };

  let best: { id: string; score: number } | null = null;
  for (const p of profiles) {
    const score = tokenSimilarity(n, p.name);
    if (!best || score > best.score) best = { id: p.id, score };
  }
  if (best && best.score >= JOB_MATCH_THRESHOLD) return best;
  return null;
}

export type Suggestion = {
  serviceCatalogId: string | null;
  jobProfileId: string | null;
  seniority: string | null;
  unit: string | null;
  confidence: "alta" | "media" | "nenhuma";
};

/** Sugestão completa (serviço + cargo + senioridade + unidade) para um nome. */
export function suggestForName(
  name: string,
  catalog: ServiceLike[],
  profiles: JobProfileLike[],
): Suggestion {
  const { base, seniority } = parseSeniority(name);
  const serviceCatalogId = suggestServiceForName(name, catalog);
  const job = matchJobProfile(base, profiles);
  const unit = serviceCatalogId
    ? (catalog.find((c) => c.id === serviceCatalogId)?.unit ?? null)
    : null;
  const confidence: Suggestion["confidence"] = !serviceCatalogId
    ? "nenhuma"
    : job && job.score >= 0.95
      ? "alta"
      : "media";
  return {
    serviceCatalogId,
    jobProfileId: job?.id ?? null,
    seniority,
    unit,
    confidence,
  };
}
