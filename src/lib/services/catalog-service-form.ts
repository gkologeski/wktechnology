// Regras puras do formulário "Associar serviço ao contrato".
// Cargo, senioridade e stack só fazem sentido quando o serviço aloca ou
// seleciona pessoas; serviços de projeto (consultoria, fábrica) não pedem perfil.

export type ContractServiceType = "one_time" | "recurring" | "usage_based" | "milestone";

export type CatalogServiceShape = { service_type: string | null; unit: string | null };

/** Sem serviço escolhido mantém os campos visíveis; projeto esconde o perfil. */
export function catalogServiceUsesProfile(item: CatalogServiceShape | null): boolean {
  if (!item) return true;
  return item.service_type !== "project";
}

/** Cobrança sugerida a partir do cadastro do catálogo (sempre editável). */
export function defaultBillingTypeFor(item: CatalogServiceShape | null): ContractServiceType {
  if (!item) return "recurring";
  if (item.service_type === "one_off") return "one_time";
  if (item.service_type === "project") return item.unit === "hour" ? "usage_based" : "milestone";
  return "recurring";
}
