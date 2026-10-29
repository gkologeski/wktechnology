// Importador ClickUp -> TechProjects: regras puras (organização proposta e conversão de tarefas).
// Sem acesso a banco ou rede; usado pelo servidor e pelos testes.

export type ErpRef = { id: string; name: string };

export type CuHierarchyList = {
  teamId: string;
  teamName: string;
  spaceId: string;
  spaceName: string;
  folderId: string | null;
  folderName: string | null;
  listId: string;
  listName: string;
};

export type PlannedGroup = {
  team_id: string;
  team_name: string;
  space_ext_id: string;
  space_name: string;
  folder_ext_id: string | null;
  folder_name: string | null;
  list_ext_id: string;
  list_name: string;
  action: "import" | "skip";
  reason: string | null;
  target_space_id: string | null;
  new_space_name: string | null;
  target_project_id: string | null;
  new_project_name: string | null;
  new_project_status: "active" | "done" | null;
  erp_list_name: string;
};

/** Workspaces de teste que ficam fora da importação (decisão do usuário). */
export const CLICKUP_EXCLUDED_TEAMS = ["FS - Cliente Exemplo", "CS", "OS - Logbit"];
/** Workspace principal, cujos espaços viram áreas do TechProjects. */
export const CLICKUP_MAIN_TEAM = "WK Technology";
/** Espaço do TechProjects que recebe os workspaces de clientes de Outsourcing. */
export const CLICKUP_OUTSOURCING_SPACE = "OutSourcing";

/** Nome no ClickUp -> nome do projeto já existente no TechProjects. */
const PROJECT_ALIASES: Record<string, string> = {
  "os activecorp": "os active",
  "os in forma": "os informa",
  "os informa": "os informa",
};

export function normName(s: string | null | undefined): string {
  return (s ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\[arquivado\]|\(arquivado\)/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function isArchivedName(s: string): boolean {
  return /\[arquivado\]|\(arquivado\)/i.test(s);
}

function cleanTeamName(s: string): string {
  return s.replace(/\[arquivado\]|\(arquivado\)/gi, "").trim();
}

const GENERIC_LIST = new Set(["list", "lista", ""]);

type SpaceRule = {
  space: string;
  project: (l: CuHierarchyList) => string;
};

const MAIN_SPACE_RULES: Record<string, SpaceRule> = {
  diretoria: {
    space: "Diretoria",
    project: (l) => `Diretoria › ${l.folderName ?? l.listName}`,
  },
  gestao: { space: "Gestão Técnica", project: () => "Gestão" },
  "fabrica de software": {
    space: "Fábrica de Software",
    project: (l) => {
      const f = l.folderName ?? l.listName;
      if (/brooks/i.test(f)) return "FS - Brooks";
      if (/techprojects/i.test(f)) return "TechProjects";
      return f;
    },
  },
  consultoria: { space: "Consultoria", project: (l) => l.folderName ?? l.listName },
  outsourcing: { space: CLICKUP_OUTSOURCING_SPACE, project: () => "OS - Controles internos" },
};

function findByName(refs: ErpRef[], name: string): ErpRef | undefined {
  const n = normName(name);
  const alias = PROJECT_ALIASES[n] ?? n;
  return refs.find((r) => normName(r.name) === alias);
}

/** Destino proposto para uma lista do ClickUp. Nome igual só vincula a projeto/espaço existente. */
export function planGroup(
  l: CuHierarchyList,
  erp: { projects: ErpRef[]; spaces: ErpRef[] },
): PlannedGroup {
  const base = {
    team_id: l.teamId,
    team_name: l.teamName,
    space_ext_id: l.spaceId,
    space_name: l.spaceName,
    folder_ext_id: l.folderId,
    folder_name: l.folderName,
    list_ext_id: l.listId,
    list_name: l.listName,
    erp_list_name: GENERIC_LIST.has(normName(l.listName))
      ? (l.folderName ?? l.spaceName)
      : l.listName,
  };
  if (CLICKUP_EXCLUDED_TEAMS.some((t) => normName(t) === normName(l.teamName))) {
    return {
      ...base,
      action: "skip",
      reason: "Workspace de teste fora da importação",
      target_space_id: null,
      new_space_name: null,
      target_project_id: null,
      new_project_name: null,
      new_project_status: null,
    };
  }
  let spaceName: string;
  let projectName: string;
  if (normName(l.teamName) === normName(CLICKUP_MAIN_TEAM)) {
    const rule = MAIN_SPACE_RULES[normName(l.spaceName)];
    spaceName = rule?.space ?? l.spaceName;
    projectName = rule ? rule.project(l) : (l.folderName ?? l.listName);
  } else {
    spaceName = CLICKUP_OUTSOURCING_SPACE;
    projectName = cleanTeamName(l.teamName);
  }
  const space = findByName(erp.spaces, spaceName);
  const project = findByName(erp.projects, projectName);
  const archived = isArchivedName(l.teamName) || isArchivedName(l.folderName ?? "");
  return {
    ...base,
    action: "import",
    reason: project ? "Projeto já existe no TechProjects" : null,
    target_space_id: space?.id ?? null,
    new_space_name: space ? null : spaceName,
    target_project_id: project?.id ?? null,
    new_project_name: project ? null : projectName,
    new_project_status: project ? null : archived ? "done" : "active",
  };
}

export type CuTask = {
  id: string;
  name?: string | null;
  text_content?: string | null;
  description?: string | null;
  status?: { status?: string | null; type?: string | null } | null;
  priority?: { priority?: string | null } | null;
  due_date?: string | number | null;
  start_date?: string | number | null;
  date_created?: string | number | null;
  tags?: { name?: string | null }[] | null;
  assignees?: { id: number; username?: string | null; email?: string | null }[] | null;
  parent?: string | null;
  url?: string | null;
  list?: { id: string } | null;
};

export type TaskPayload = {
  title: string;
  description: string | null;
  status: "todo" | "doing" | "review" | "done";
  status_name: string | null;
  priority: "low" | "normal" | "high" | "urgent";
  due_at: string | null;
  start_at: string | null;
  created_at: string | null;
  tags: string[];
  assignees: string[];
  url: string | null;
};

/** Status do ClickUp -> status do TechProjects. Fechado sempre vira concluído. */
export function mapStatus(name: string | null | undefined, type: string | null | undefined) {
  if (type === "closed" || type === "done") return "done" as const;
  const n = normName(name);
  if (/(conclu|finaliz|entregue|done|complete|fechad)/.test(n)) return "done" as const;
  if (/(revis|review|homolog|valida|teste|qa|aprova)/.test(n)) return "review" as const;
  if (/(andamento|progress|fazendo|doing|desenvolv|execu)/.test(n)) return "doing" as const;
  return "todo" as const;
}

export function mapPriority(p: string | null | undefined): TaskPayload["priority"] {
  const v = (p ?? "").toLowerCase();
  return v === "urgent" || v === "high" || v === "low" ? v : "normal";
}

/** Milissegundos do ClickUp -> data local (America/Sao_Paulo) no formato AAAA-MM-DD. */
export function msToLocalDate(
  ms: string | number | null | undefined,
  timeZone = "America/Sao_Paulo",
) {
  if (ms === null || ms === undefined || ms === "") return null;
  const n = Number(ms);
  if (!Number.isFinite(n) || n <= 0) return null;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(n));
  return parts;
}

function msToIso(ms: string | number | null | undefined) {
  const n = Number(ms);
  return Number.isFinite(n) && n > 0 ? new Date(n).toISOString() : null;
}

export function taskPayload(t: CuTask): TaskPayload {
  const desc = (t.text_content ?? t.description ?? "").trim();
  return {
    title: (t.name ?? "").trim().slice(0, 500) || "(sem título)",
    description: desc ? desc.slice(0, 20000) : null,
    status: mapStatus(t.status?.status, t.status?.type),
    status_name: t.status?.status ?? null,
    priority: mapPriority(t.priority?.priority),
    due_at: msToLocalDate(t.due_date),
    start_at: msToLocalDate(t.start_date),
    created_at: msToIso(t.date_created),
    tags: (t.tags ?? [])
      .map((x) => (x.name ?? "").trim())
      .filter(Boolean)
      .slice(0, 30),
    assignees: (t.assignees ?? []).map((a) => String(a.id)),
    url: t.url ?? null,
  };
}

export function isClosed(t: CuTask): boolean {
  return mapStatus(t.status?.status, t.status?.type) === "done";
}
