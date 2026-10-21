// Regras puras da alocação (client-safe): papel dos contratos, rateio por cliente e
// ordenação dos projetos pelo contrato de prestação.

export type ContractRoleInfo = { role: string | null; document_kind: string | null };

/** Mensagem de erro quando o contrato não serve para o campo; null quando válido. */
export function contractFieldError(
  field: "provider" | "purchase",
  c: ContractRoleInfo | null,
): string | null {
  if (!c) return "Contrato não encontrado ou sem acesso.";
  if (c.document_kind === "amendment") return "Aditivos não podem ser usados na alocação.";
  if (field === "provider" && c.role !== "provider")
    return "O campo Contrato de prestação aceita apenas contratos de prestação.";
  if (field === "purchase" && c.role !== "client")
    return "O campo Contrato de compra aceita apenas contratos de compra.";
  return null;
}

export type CompanySplit = { company_id: string; pct: number };

/** Valida o rateio: vazio é permitido; senão empresas únicas e soma exata de 100%. */
export function splitsError(splits: CompanySplit[]): string | null {
  if (splits.length === 0) return null;
  const ids = new Set<string>();
  for (const s of splits) {
    if (!s.company_id) return "Escolha a empresa de cada linha do rateio.";
    if (ids.has(s.company_id)) return "A mesma empresa aparece mais de uma vez no rateio.";
    ids.add(s.company_id);
    if (!(s.pct > 0 && s.pct <= 100)) return "Cada percentual deve ser maior que 0 e até 100.";
  }
  const total = Math.round(splits.reduce((a, s) => a + s.pct, 0) * 100) / 100;
  if (total !== 100) return `A soma do rateio deve ser 100% (atual: ${total}%).`;
  return null;
}

export type ProjectOption = { id: string; name: string; contract_id?: string | null };

/** Separa os projetos do contrato de prestação (primeiro) dos demais, mantendo a ordem. */
export function groupProjectsByContract<T extends ProjectOption>(
  projects: T[],
  contractId: string | null,
): { fromContract: T[]; others: T[] } {
  if (!contractId) return { fromContract: [], others: projects };
  const fromContract: T[] = [];
  const others: T[] = [];
  for (const p of projects) (p.contract_id === contractId ? fromContract : others).push(p);
  return { fromContract, others };
}
