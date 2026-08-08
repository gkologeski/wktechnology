// Regra compartilhada da fila de vinculação manual de contratos.
// Módulo puro (sem imports de servidor) para que a lista e a contagem
// usem exatamente o mesmo critério de pendência.

export type PendingLinkRow = {
  id: string;
  role: "provider" | "client";
  document_kind: string;
  number: string | null;
  title: string;
  status: string;
  starts_at: string | null;
  ends_at: string | null;
  company_name: string | null;
  contracting_name: string | null;
  contracting_cnpj: string | null;
  referenced_numbers: string[];
  reason: string;
};

export type PendingLinkSource = {
  id: string;
  role: "provider" | "client";
  number: string | null;
  title: string;
  status: string;
  starts_at: string | null;
  ends_at: string | null;
  parent_contract_id: string | null;
  document_kind?: string | null;
  amendment_of_id?: string | null;
  metadata: Record<string, unknown> | null;
  companies?: { name: string | null } | null;
};

export function computePendingLinks(
  all: PendingLinkSource[],
  opts: { role?: "provider" | "client" | "amendment" | "all"; search?: string } = {},
): PendingLinkRow[] {
  const parentIds = new Set(
    all.map((r) => r.parent_contract_id).filter((v): v is string => Boolean(v)),
  );
  const term = (opts.search ?? "").trim().toLowerCase();
  const roleFilter = opts.role && opts.role !== "all" ? opts.role : null;

  const pending: PendingLinkRow[] = [];
  for (const row of all) {
    if (row.metadata?.["link_dismissed"] === true) continue;
    const referenced = Array.isArray(row.metadata?.["referenced_contract_numbers"])
      ? (row.metadata?.["referenced_contract_numbers"] as string[])
      : [];

    const isAmendment = row.document_kind === "amendment";

    let reason: string | null = null;
    if (isAmendment) {
      // Aditivo herda o vínculo do contrato principal: a única pendência
      // possível é não ter contrato principal definido.
      if (!row.amendment_of_id) reason = "Aditivo sem contrato principal";
    } else if (row.role === "client" && !row.parent_contract_id) {
      reason = referenced.length
        ? `Número citado (${referenced.join(", ")}) não encontrado`
        : "Nenhum número de contrato citado no documento";
    } else if (row.role === "provider" && !parentIds.has(row.id)) {
      reason = "Sem contrato de compra vinculado";
    }
    if (!reason) continue;
    if (roleFilter === "amendment") {
      if (!isAmendment) continue;
    } else if (roleFilter && (isAmendment || row.role !== roleFilter)) {
      continue;
    }
    if (
      term &&
      !`${row.title} ${row.number ?? ""} ${row.companies?.name ?? ""}`.toLowerCase().includes(term)
    ) {
      continue;
    }

    pending.push({
      id: row.id,
      role: row.role,
      document_kind: row.document_kind ?? "main",
      number: row.number,
      title: row.title,
      status: row.status,
      starts_at: row.starts_at,
      ends_at: row.ends_at,
      company_name: row.companies?.name ?? null,
      contracting_name: (row.metadata?.["contracting_name_extracted"] as string | null) ?? null,
      contracting_cnpj: (row.metadata?.["contracting_cnpj_extracted"] as string | null) ?? null,
      referenced_numbers: referenced,
      reason,
    });
  }
  return pending;
}
