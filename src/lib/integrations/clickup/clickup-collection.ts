// Contrato do checkpoint. Não há corte por quantidade, período ou situação de lançamento.
export type ClickUpTeam = {
  id: string;
  name: string;
  members?: { user?: { id?: number; username?: string; email?: string } }[];
};
export type HierarchyJob = {
  kind: "spaces" | "folders" | "folder_lists" | "space_lists";
  teamId: string;
  teamName: string;
  spaceId?: string;
  spaceName?: string;
  folderId?: string;
  folderName?: string;
  archived: boolean;
};
export type CoverageGap = { entity: string; sourceId: string; subjectId?: string; reason: string };
export type CollectCursor = {
  version?: 2;
  phase?: "organizations" | "hierarchy" | "tasks" | "related" | "time" | "docs" | "done";
  organizationIndex?: number;
  teams?: ClickUpTeam[];
  jobs?: HierarchyJob[];
  listTeams?: Record<string, string>;
  lists: string[];
  index: number;
  page: number;
  archived?: boolean;
  counts: Record<string, { tasks: number; closed: number }>;
  people: Record<string, { username: string | null; email: string | null; tasks: number }>;
  personTeams?: Record<string, string[]>;
  lastTaskId?: string;
  relatedTask?: { id: string; teamId: string };
  relatedStage?: "detail" | "comments" | "attachments";
  commentStart?: { id: string; date: string };
  pendingCommentReplies?: { id: string; teamId: string; taskId: string }[];
  attachmentCursor?: string;
  timeTeam?: number;
  timeAssignee?: number;
  timeUntil?: number;
  timeRangeIndex?: number;
  timeAcceptedRanges?: Record<string, number>;
  pendingTimeHistory?: { id: string; teamId: string }[];
  docsTeam?: number;
  docsArchived?: boolean;
  docsDeleted?: boolean;
  docsCursor?: string;
  pendingDocs?: { id: string; teamId: string }[];
  gaps?: CoverageGap[];
  capabilities?: Record<string, string>;
};

export function initialCollectCursor(teams: ClickUpTeam[], now = Date.now()): CollectCursor {
  // Keep only the fields needed to resume. Original team/member responses go to the
  // protected source ledger, so avatar capabilities and unknown API fields never
  // leak into a checkpoint returned to the browser.
  const checkpointTeams = teams.map((team) => ({
    id: team.id,
    name: team.name,
    ...(Array.isArray(team.members)
      ? {
          members: team.members.map((member) => ({
            ...(member?.user
              ? {
                  user: {
                    id: member.user.id,
                    username: member.user.username,
                    email: member.user.email,
                  },
                }
              : {}),
          })),
        }
      : {}),
  }));
  return {
    version: 2,
    phase: "organizations",
    organizationIndex: 0,
    teams: checkpointTeams,
    jobs: checkpointTeams.flatMap((t) =>
      [false, true].map((archived) => ({
        kind: "spaces" as const,
        teamId: t.id,
        teamName: t.name,
        archived,
      })),
    ),
    lists: [],
    listTeams: {},
    index: 0,
    page: 0,
    archived: false,
    counts: {},
    people: {},
    personTeams: {},
    timeUntil: now + 1,
    gaps: [],
    capabilities: {
      docs_format:
        "A API fornece texto Markdown e metadados; estilos, capas, ícones, comentários de documentos e alguns blocos não são disponibilizados pela origem.",
      deleted_tasks:
        "Tarefas excluídas e versões anteriores à primeira coleta não são expostas por estes endpoints do ClickUp.",
      former_members_time:
        "Horas são consultadas para membros atuais e pessoas históricas identificáveis nas tarefas acessíveis. A origem não enumera ex-membros sem tarefa acessível; a cobertura dessas pessoas não pode ser comprovada.",
    },
  };
}

/** Keep relationship context beside the complete source response, without replacing its fields. */
export function contextualClickUpObservation(
  payload: Record<string, unknown>,
  context: Record<string, string>,
): Record<string, unknown> {
  return {
    ...(payload["id"] == null ? {} : { id: payload["id"] }),
    _source_observation: { payload, context },
  };
}

/** Um last_page ausente não comprova conclusão: uma página cheia exige a seguinte. */
export function taskPageComplete(length: number, lastPage?: boolean): boolean {
  return lastPage === true || length < 100;
}

export function addCoverageGap(cursor: CollectCursor, gap: CoverageGap) {
  const gaps = (cursor.gaps ??= []);
  if (
    !gaps.some(
      (g) =>
        g.entity === gap.entity &&
        g.sourceId === gap.sourceId &&
        g.subjectId === gap.subjectId &&
        g.reason === gap.reason,
    )
  )
    gaps.push(gap);
}

/** Contrato das datas operacionais; dado fora do intervalo JS é preservado na origem, não causa descarte. */
export function validClickUpInstant(ms: unknown): boolean {
  return (
    ms == null || ms === "" || (Number.isFinite(Number(ms)) && Math.abs(Number(ms)) <= 8.64e15)
  );
}

export function clickUpTaskIssues(row: Record<string, unknown>): string[] {
  const issues: string[] = [];
  if (!/^[A-Za-z0-9_-]{1,40}$/.test(String(row["id"] ?? ""))) issues.push("invalid_external_id");
  if (typeof row["name"] !== "string" || !row["name"].trim()) issues.push("task_missing_title");
  if (["start_date", "due_date", "date_created"].some((k) => !validClickUpInstant(row[k])))
    issues.push("invalid_source_date");
  if (row["assignees"] != null && !Array.isArray(row["assignees"]))
    issues.push("invalid_source_assignees");
  return issues;
}

/** Cada subpágina é consultável por identidade própria, preservando também a árvore original. */
export function flattenClickUpPages(pages: Record<string, unknown>[]): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  const pending = [...pages];
  while (pending.length) {
    const page = pending.shift()!;
    out.push(page);
    if (Array.isArray(page["pages"]))
      pending.push(
        ...page["pages"].filter(
          (x): x is Record<string, unknown> => x !== null && typeof x === "object",
        ),
      );
  }
  return out;
}

const object = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

/** One task identity, multiple exact source representations. Listing never replaces an existing detail. */
export function mergeClickUpTaskObservation(
  previous: unknown,
  raw: Record<string, unknown>,
  mode: "list" | "detail",
  listId?: string,
): Record<string, unknown> {
  const old = object(previous),
    observations = object(old["_source_observations"]);
  const lists = { ...object(observations["lists"]) };
  if (mode === "list" && listId) lists[listId] = raw;
  const detail = mode === "detail" ? raw : observations["detail"];
  const primary = detail ? object(detail) : raw;
  return { ...primary, _source_observations: { lists, ...(detail ? { detail } : {}) } };
}

/** API documents numeric epoch filters but no accepted range. A rejected wide range remains a coverage gap. */
export function clickUpTimeRanges(startedAt: number) {
  return [
    { start: -8.64e15, end: 8.64e15 },
    { start: -62135596800000, end: 253402300799999 },
    { start: -2208988800000, end: 4102444800000 },
    { start: 0, end: 4102444800000 },
    { start: 0, end: startedAt },
  ];
}
