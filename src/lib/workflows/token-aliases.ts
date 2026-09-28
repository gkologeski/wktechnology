// Nomes amigáveis das variáveis de workflows. As chaves persistidas por novos
// fluxos ficam em PT-BR (ASCII, minúsculas e snake_case), enquanto o motor
// continua aceitando os nomes técnicos históricos.
import { CONTRACT_FIELD_LABELS } from "@/lib/contracts/workflow-field-meta";
import { ENTITY_LABEL_OVERRIDES, LABELS } from "@/lib/entity-fields-meta";

const STRUCTURAL_ALIASES: Record<string, string[]> = {
  passos: ["steps"],
  variaveis: ["vars"],
  negocio: ["deal", "deal_id"],
  empresa: ["company", "company_id", "company_name"],
  contato_principal: ["primary_contact", "primary_contact_id"],
  contato: ["contact", "contact_id"],
  contrato: ["contract", "contract_id"],
  servicos: ["services"],
  quantidade_itens: ["line_items_count"],
  resumo_itens: ["line_items_summary"],
};

const PREFERRED_STRUCTURAL_ALIAS: Record<string, string> = Object.fromEntries(
  Object.entries(STRUCTURAL_ALIASES).flatMap(([alias, canonicals]) =>
    canonicals.map((canonical) => [canonical, alias]),
  ),
);

const EXPLICIT_FIELD_ALIASES: Record<string, string> = {
  signature_document_id: "id_documento_assinatura",
  metadata: "metadados_tecnicos",
};

/** Converte um rótulo humano em uma chave estável aceita pelo parser de tokens. */
export function normalizeWorkflowTokenName(label: string): string {
  return label
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_");
}

/** Nome PT-BR inserido para uma coluna real. */
export function workflowFieldAlias(fieldName: string, label: string): string {
  const explicit = EXPLICIT_FIELD_ALIASES[fieldName];
  if (explicit) return explicit;
  const normalized = normalizeWorkflowTokenName(label);
  if (fieldName.endsWith("_id") && normalized && !normalized.startsWith("id_")) {
    return `id_${normalized}`;
  }
  return normalized || fieldName.toLocaleLowerCase("pt-BR");
}

/** Traduz um caminho técnico conhecido, preservando índices e nomes do usuário. */
export function localizeWorkflowTokenPath(path: string, leafLabel?: string): string {
  const parts = path.split(".");
  if (parts[0] === "vars") return ["variaveis", ...parts.slice(1)].join(".");
  if (parts[0] === "steps") {
    const leaf = parts.at(-1) ?? "";
    const localizedLeaf = workflowFieldAlias(leaf, LABELS[leaf] ?? leaf);
    return ["passos", ...parts.slice(1, -1), localizedLeaf].join(".");
  }
  if (parts.length === 1) {
    return workflowFieldAlias(path, leafLabel ?? LABELS[path] ?? path);
  }
  return parts
    .map((part, index) =>
      index === parts.length - 1
        ? workflowFieldAlias(part, leafLabel ?? LABELS[part] ?? part)
        : (PREFERRED_STRUCTURAL_ALIAS[part] ?? normalizeWorkflowTokenName(part)),
    )
    .join(".");
}

const aliasCandidates = new Map<string, string[]>();

function addCandidate(alias: string, canonical: string) {
  const current = aliasCandidates.get(alias) ?? [];
  if (!current.includes(canonical)) aliasCandidates.set(alias, [...current, canonical]);
}

for (const [alias, candidates] of Object.entries(STRUCTURAL_ALIASES)) {
  for (const candidate of candidates) addCandidate(alias, candidate);
}

for (const [canonical, label] of Object.entries({ ...LABELS, ...CONTRACT_FIELD_LABELS })) {
  addCandidate(workflowFieldAlias(canonical, label), canonical);
}

for (const labels of Object.values(ENTITY_LABEL_OVERRIDES)) {
  for (const [canonical, label] of Object.entries(labels)) {
    addCandidate(workflowFieldAlias(canonical, label), canonical);
  }
}

/**
 * Resolve um caminho amigável olhando as propriedades realmente disponíveis.
 * Se não houver alias compatível, devolve o próprio caminho para manter o
 * comportamento histórico de tokens técnicos e campos personalizados.
 */
export function resolveWorkflowTokenPath(root: unknown, path: string): string {
  const parts = path.split(".");
  const canonical: string[] = [];
  let cursor: unknown = root;

  for (const part of parts) {
    if (/^\d+$/.test(part)) {
      canonical.push(part);
      if (cursor && typeof cursor === "object") {
        cursor = (cursor as Record<string, unknown>)[part];
      }
      continue;
    }

    const available = cursor && typeof cursor === "object" ? (cursor as Record<string, unknown>) : null;
    const candidates = aliasCandidates.get(part) ?? [];
    const resolved =
      (available && part in available ? part : undefined) ??
      candidates.find((candidate) => available && candidate in available) ??
      candidates[0] ??
      part;
    canonical.push(resolved);
    cursor = available?.[resolved];
  }

  return canonical.join(".");
}
