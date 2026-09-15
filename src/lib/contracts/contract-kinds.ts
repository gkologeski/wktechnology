// Tipos de documento de contrato do ponto de vista do usuário.
// No banco a informação está em duas colunas (`document_kind` + `role`);
// aqui viram uma única escolha em português, usada no formulário de criação,
// na tela de padrões e na ação de workflow.

export type ContractKind = "provider" | "client" | "amendment";

export const CONTRACT_KINDS: ContractKind[] = ["provider", "client", "amendment"];

export const CONTRACT_KIND_LABEL: Record<ContractKind, string> = {
  provider: "Contrato de prestação",
  client: "Contrato de compra",
  amendment: "Aditivo",
};

export const CONTRACT_KIND_HINT: Record<ContractKind, string> = {
  provider: "Nós prestamos o serviço para a contraparte.",
  client: "Nós contratamos o serviço de um fornecedor.",
  amendment: "Altera um contrato já existente (principal).",
};

export function isContractKind(v: unknown): v is ContractKind {
  return typeof v === "string" && (CONTRACT_KINDS as string[]).includes(v);
}

/** Converte a escolha do usuário nas colunas reais do contrato. */
export function kindToColumns(
  kind: ContractKind,
  role?: "provider" | "client" | null,
): { document_kind: "main" | "amendment"; role: "provider" | "client" } {
  if (kind === "amendment") {
    return { document_kind: "amendment", role: role === "client" ? "client" : "provider" };
  }
  return { document_kind: "main", role: kind };
}

/** Converte as colunas do contrato na escolha do usuário. */
export function columnsToKind(
  documentKind: string | null | undefined,
  role: string | null | undefined,
): ContractKind {
  if (documentKind === "amendment") return "amendment";
  return role === "client" ? "client" : "provider";
}
