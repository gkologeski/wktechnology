// Regras puras das superfícies públicas/autenticadas endurecidas (sem acesso a dados).

/** Status único que libera leitura e contagem pública de uma landing page. */
export function publishedLandingStatus(): "published" {
  return "published";
}

export type LpCountDecision = "record" | "skip" | "reject";

/** Cada visitante conta uma vez por tipo; conversão exige visita anterior do mesmo visitante. */
export function decideLpCount(
  seen: ReadonlySet<string>,
  eventType: "view" | "conversion" | "click",
): LpCountDecision {
  if (eventType === "conversion" && !seen.has("view")) return "reject";
  if (eventType !== "click" && seen.has(eventType)) return "skip";
  return "record";
}

/** Categorias públicas = somente as que contêm artigo publicado. */
export function publishedCategoryIds(
  articles: ReadonlyArray<{ category_id: string | null; published?: boolean | null }>,
): string[] {
  return [
    ...new Set(
      articles
        .filter((a) => a.published !== false)
        .map((a) => a.category_id)
        .filter((id): id is string => !!id),
    ),
  ];
}

export function assertPublishedKbArticle<T extends { published?: boolean | null }>(
  row: T | null | undefined,
): T {
  if (!row || row.published !== true) throw new Error("Artigo não encontrado.");
  return row;
}

const CLOSED_INTERVIEW_STATUSES: ReadonlySet<string> = new Set([
  "canceled",
  "cancelled",
  "completed",
  "done",
  "no_show",
]);

/** Link público de entrevista deixa de aceitar envios quando a entrevista foi encerrada. */
export function isClosedInterviewStatus(status: unknown): boolean {
  return CLOSED_INTERVIEW_STATUSES.has(String(status ?? ""));
}

/** E-mail digitado pelo visitante não prova identidade: sessão nasce sem vínculo a Contato/Lead. */
export function unverifiedVisitorIdentity() {
  return {
    status: "not_found" as const,
    contactId: null,
    leadId: null,
    matchedCount: 0,
  };
}

/** Só um caminho de rota simples entra no contexto do assistente; texto livre é descartado. */
export function safeAgentPagePath(raw: unknown): string {
  return typeof raw === "string" && /^\/[A-Za-z0-9/_.$-]{0,199}$/.test(raw) ? raw : "";
}

/** Cargo/pacote só é atribuível se for deste workspace ou de sistema (sem workspace). */
export function assertAssignableRows(
  rows: ReadonlyArray<{ id: string; workspace_id: string | null; is_system: boolean | null }>,
  workspaceId: string,
  ids: readonly string[],
): void {
  const allowed = new Set(
    rows
      .filter(
        (r) => r.workspace_id === workspaceId || (r.is_system === true && r.workspace_id === null),
      )
      .map((r) => r.id),
  );
  if (ids.some((id) => !allowed.has(id)))
    throw new Error("Cargo ou pacote de permissões não pertence a este workspace.");
}
