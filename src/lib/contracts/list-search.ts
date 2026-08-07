// Valores padrão dos parâmetros de busca da grid de contratos (/contracts).
// Usado por telas que precisam voltar para a grid com a listagem plana.
export const DEFAULT_CONTRACTS_SEARCH = {
  groupBy: "none" as const,
  page: 1,
  pageSize: 50,
  q: "",
  role: "",
  status: "",
  assignee: "",
  companyId: "",
  companyName: "",
  legalEntityId: "",
  startsFrom: "",
  startsTo: "",
  endsFrom: "",
  endsTo: "",
};
