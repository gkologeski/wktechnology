import type { PreparationData } from "./types";
export type PreparationOrigin = {
  source: "project" | "deal" | "commercial_contract";
  id: string;
  title: string;
  legal_entity_id: string | null;
  legal_entity_name: string | null;
  cnpj: string | null;
  active: boolean | null;
  deal_id: string | null;
  contract_id: string | null;
};
export const originLabels = {
  project: "Projeto",
  deal: "Negócio",
  commercial_contract: "Contrato comercial",
};
/** Human-readable preview only. The save RPC remains authoritative. */
export function preparationOriginProblems(form: PreparationData, origins: PreparationOrigin[]) {
  const issues: string[] = [];
  if (form.purpose !== "client") return issues;
  const dealSet = form.deal_id ? [form.deal_id, ...form.additional_deal_ids] : [];
  for (const origin of origins) {
    const label = `${originLabels[origin.source]} “${origin.title}”`;
    if (origin.legal_entity_id && origin.active !== true)
      issues.push(
        `${label}: a entidade da origem está inativa ou indisponível. Confira o cadastro de origem; não troque a finalidade para contornar a divergência.`,
      );
    if (origin.legal_entity_id && origin.legal_entity_id !== form.legal_entity_id)
      issues.push(
        `${label} usa ${origin.legal_entity_name ?? "uma entidade legal indisponível"}${origin.cnpj ? ` (CNPJ ${origin.cnpj})` : " (CNPJ não informado)"}. A solicitação deve usar a mesma entidade legal ativa.`,
      );
    if (
      origin.source === "commercial_contract" &&
      form.deal_id &&
      !dealSet.includes(origin.deal_id ?? "")
    )
      issues.push(
        "O contrato comercial não está vinculado a nenhum dos negócios escolhidos. Use uma única origem comercial ou confira os vínculos nos cadastros.",
      );
    if (origin.source === "project" && form.deal_id && !dealSet.includes(origin.deal_id ?? ""))
      issues.push(
        "O projeto não está vinculado a nenhum dos negócios escolhidos. Confira o cadastro do projeto ou remova esse vínculo da solicitação.",
      );
    if (
      origin.source === "project" &&
      form.commercial_contract_id &&
      origin.contract_id !== form.commercial_contract_id
    )
      issues.push(
        "O projeto não está vinculado ao contrato comercial escolhido. Confira o cadastro do projeto ou remova esse vínculo da solicitação.",
      );
  }
  return issues;
}
