// Papel da chave em cada workspace do Clockify, a partir de GET /workspaces?roles=...
// Sem prova (filtro indisponível/negado), o papel é "unknown" — nunca presumido admin.

export type ClockifyAccess = "owner" | "admin" | "not_admin" | "unknown";

export const CLOCKIFY_ACCESS_LABEL: Record<ClockifyAccess, string> = {
  owner: "Proprietário",
  admin: "Administrador",
  not_admin: "Sem acesso administrativo",
  unknown: "Permissão não verificada",
};

/** Só proprietário/administrador lê horas de todos os usuários; o resto bloqueia a prévia. */
export function canReadWholeWorkspace(access: string | null | undefined): boolean {
  return access === "owner" || access === "admin";
}

/**
 * ownerIds/adminIds = ids devolvidos pelos filtros de papel; null = filtro falhou.
 * O filtro de admin do Clockify não inclui proprietários, por isso são duas consultas.
 */
export function classifyAccess(
  workspaceId: string,
  ownerIds: Set<string> | null,
  adminIds: Set<string> | null,
): ClockifyAccess {
  const id = workspaceId.toLowerCase();
  if (ownerIds?.has(id)) return "owner";
  if (adminIds?.has(id)) return "admin";
  if (ownerIds && adminIds) return "not_admin";
  return "unknown";
}

function normName(s: string | null | undefined) {
  return (s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/**
 * Sugere a origem pelo nome igual ao do workspace do ERP, só quando há exatamente um.
 * É apenas destaque visual: a escolha continua manual e por ID.
 */
export function suggestSourceId(
  workspaces: Array<{ id: string; name: string }>,
  erpWorkspaceName: string | null | undefined,
): string | null {
  const target = normName(erpWorkspaceName);
  if (!target) return null;
  const hits = workspaces.filter((w) => normName(w.name) === target);
  return hits.length === 1 ? hits[0].id : null;
}
