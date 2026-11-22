import type { PreparationData } from "./types";

export const purposeLabels = {
  client: "Atendimento a cliente",
  internal: "Uso interno da empresa",
  shared_management: "Gestão compartilhada entre projetos",
};
export const purposeDescriptions = {
  client:
    "Sua empresa contrata o fornecedor ou profissional para atender um cliente. O CNPJ da contratante deve ser o mesmo do negócio ou contrato comercial de origem.",
  internal:
    "Contratação para necessidades internas da sua empresa, sem origem em uma venda a cliente. Não use esta opção para contornar uma divergência de CNPJ.",
  shared_management:
    "Estrutura de gestão que atende mais de um projeto, sem vincular a contratação a uma única venda.",
};
export function changePreparationPurpose(
  value: PreparationData,
  purpose: PreparationData["purpose"],
): PreparationData {
  return {
    ...value,
    purpose,
    deal_id: null,
    additional_deal_ids: [],
    commercial_contract_id: null,
    release_condition:
      purpose !== "client" && value.release_condition === "also_client_acceptance"
        ? "wk_acceptance_invoice"
        : value.release_condition,
  };
}
