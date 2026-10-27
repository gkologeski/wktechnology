// Cópia de um agente SDR (playbook + persona). Função pura: decide o que é
// copiado; a gravação acontece em `duplicateSdrAgent` com o cliente do usuário
// (RLS + RBAC). A cópia nasce desativada, sem versão publicada e sem número
// de canal vinculado, para nunca responder clientes antes de ser revisada.

/** Colunas que pertencem ao registro, não ao conteúdo do agente. */
const NOT_COPIED = new Set(["id", "created_at", "updated_at", "owner_id", "workspace_id", "enabled"]);

export const SDR_AGENT_NAME_MAX = 120;

type VersionLike = {
  status: string;
  persona: unknown;
  flow?: unknown;
  tool_config?: unknown;
  notes?: string | null;
};

/** Nome livre para a cópia: "X (cópia)", "X (cópia 2)"… sem passar de 120 caracteres. */
export function copyName(name: string, taken: Iterable<string>): string {
  const used = new Set([...taken].map((n) => n.trim().toLocaleLowerCase("pt-BR")));
  const base = name.trim() || "Agente";
  for (let n = 1; n < 1000; n++) {
    const suffix = n === 1 ? " (cópia)" : ` (cópia ${n})`;
    const candidate = base.slice(0, SDR_AGENT_NAME_MAX - suffix.length).trimEnd() + suffix;
    if (!used.has(candidate.toLocaleLowerCase("pt-BR"))) return candidate;
  }
  return base.slice(0, SDR_AGENT_NAME_MAX);
}

/** Conteúdo do playbook copiado: tudo, exceto identificação, dono, datas e o "ativo". */
export function playbookCopyFields(
  source: Record<string, unknown>,
  taken: Iterable<string>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(source)) {
    if (!NOT_COPIED.has(key)) out[key] = value;
  }
  out.name = copyName(String(source.name ?? ""), taken);
  out.enabled = false;
  return out;
}

/**
 * Persona da cópia: o rascunho (edições mais recentes) ou, sem rascunho, a
 * versão publicada. Sempre entra como rascunho v1; publicar segue o fluxo normal.
 */
export function personaCopy(versions: ReadonlyArray<VersionLike>) {
  const src =
    versions.find((v) => v.status === "draft") ?? versions.find((v) => v.status === "published");
  if (!src) return null;
  return {
    version: 1,
    status: "draft" as const,
    persona: src.persona ?? {},
    flow: src.flow ?? null,
    tool_config: src.tool_config ?? null,
    notes: src.notes ?? null,
    copiedFrom: src.status as "draft" | "published",
  };
}
