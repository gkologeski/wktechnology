// Rótulos e tipos da entrega do negócio (TechProjects ciclo 2). Puro, sem acesso a dados.
// As regras (quando cria, vincula, bloqueia) vivem no banco; aqui só a leitura para a tela.

export type DeliveryPendingCode =
  | "no_operational_owner"
  | "project_without_company"
  | "company_mismatch"
  | "planned_hours_missing"
  | "deal_without_company"
  | "no_contract"
  | "contract_ambiguous"
  | "contract_company_mismatch"
  | "items_without_group"
  | "job_failed"
  | "job_pending"
  | "job_skipped"
  | "won_without_project"
  | "policy_disabled";

export const PENDING_LABEL: Record<DeliveryPendingCode, string> = {
  no_operational_owner: "Responsável operacional não definido",
  project_without_company: "Projeto sem empresa cliente",
  company_mismatch: "Empresa do projeto diferente da empresa do negócio",
  planned_hours_missing: "Horas planejadas não definidas",
  deal_without_company: "Negócio sem empresa",
  no_contract: "Sem contrato (não obrigatório)",
  contract_ambiguous: "Mais de um contrato no negócio: escolha no projeto",
  contract_company_mismatch: "Há contrato de outra empresa neste negócio",
  items_without_group: "Itens do negócio sem grupo de entrega",
  job_failed: "A preparação falhou: veja o erro e reprocesse",
  job_pending: "Preparação na fila",
  job_skipped: "Preparação automática não se aplicou a este ganho",
  won_without_project: "Negócio ganho sem projeto",
  policy_disabled: "Criação automática desligada neste workspace",
};

/** Pendências que pedem ação; as demais são informativas. */
export const BLOCKING_PENDING = new Set<DeliveryPendingCode>([
  "no_operational_owner",
  "company_mismatch",
  "contract_ambiguous",
  "contract_company_mismatch",
  "items_without_group",
  "job_failed",
  "won_without_project",
]);

export function pendingLabel(code: string): string {
  return PENDING_LABEL[code as DeliveryPendingCode] ?? code;
}

export type DeliveryJobStatus = "pending" | "running" | "done" | "failed" | "skipped" | "cancelled";

export const JOB_STATUS_LABEL: Record<DeliveryJobStatus, string> = {
  pending: "Na fila",
  running: "Em processamento",
  done: "Concluída",
  failed: "Falhou",
  skipped: "Não aplicada",
  cancelled: "Cancelada",
};

export const SKIP_REASON_LABEL: Record<string, string> = {
  closed_before_activation: "Ganho anterior à ativação da política",
  origin_import: "Ganho vindo de importação (desligado na política)",
  origin_user: "Ganho pela tela (desligado na política)",
  origin_system: "Ganho por API/integração (desligado na política)",
  origin_workflow: "Ganho por workflow (desligado na política)",
  policy_disabled: "Política desligada",
  not_won: "O negócio não está mais ganho",
  deal_deleted: "Negócio excluído",
  deal_left_won: "O negócio saiu de ganho",
};

export const ORIGIN_LABEL: Record<string, string> = {
  user: "Tela",
  system: "API/integração",
  workflow: "Workflow",
  import: "Importação",
  manual: "Ação manual",
};

export const PROJECT_ORIGIN_LABEL: Record<string, string> = {
  deal_auto: "Criado automaticamente do negócio ganho",
  deal_manual: "Criado a partir do negócio",
  deal_history: "Criado na conciliação do histórico",
  manual: "Criado manualmente",
  internal: "Projeto interno",
};

export const REVIEW_LABEL: Record<string, string> = {
  review_deal_left_won: "O negócio saiu de ganho depois do projeto criado",
  review_company_changed: "A empresa do negócio mudou; o projeto não foi alterado",
  review_link_conflict: "Vínculo com empresa diferente da do negócio",
  job_failed: "Preparação falhou após várias tentativas",
};

export const LINK_LABEL: Record<string, string> = {
  primary: "Origem principal",
  consolidated: "Negócio consolidado",
};

export const NATURE_LABEL: Record<string, string> = {
  hunting: "Hunting/recrutamento",
  recurring: "Recorrente",
  project: "Projeto",
  amendment: "Tem aditivo",
  repeat_client: "Cliente recorrente",
};

export const CRITERION_LABEL: Record<string, string> = {
  contract_fk: "Contrato do negócio ligado ao projeto",
  service_line_fk: "Serviço do item do negócio ligado ao projeto",
  company_period: "Mesma empresa (sugestão)",
  manual: "Escolha manual",
};

export const BLOCKED_LABEL: Record<string, string> = {
  deal_not_found: "Negócio não encontrado",
  project_not_found: "Projeto não encontrado",
  deal_not_won: "Negócio não está ganho",
  already_linked: "Já vinculados",
  deal_has_project: "O negócio já tem projeto",
  company_mismatch: "Empresas diferentes — revise individualmente",
};

export const WARNING_LABEL: Record<string, string> = {
  project_has_hours: "Projeto já tem horas (não serão alteradas)",
  project_has_other_deal: "Projeto já atende outro negócio (entra como consolidado)",
  project_without_company: "Projeto sem empresa",
  deal_without_company: "Negócio sem empresa",
};

export const GROUP_NONE = "none";
export const GROUP_DEFAULT = "default";

/** Chave técnica do grupo a partir do nome digitado (minúsculas, sem acento, até 40). */
export function groupKeyFromLabel(label: string): string {
  const k = label
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return k && /^[a-z0-9]/.test(k) ? k : "";
}

export function groupLabel(key: string | null | undefined, label?: string | null): string {
  if (!key || key === GROUP_DEFAULT) return "Entrega única";
  if (key === GROUP_NONE) return "Sem entrega";
  return label?.trim() || key;
}

export type DeliveryOverview = {
  deal: {
    id: string;
    stage_type: "open" | "won" | "lost";
    closed_at: string | null;
    has_company: boolean;
    contracts: number;
  };
  policy: { enabled: boolean; activated_at: string | null; allow_groups: boolean };
  groups_explicit: boolean;
  items: Array<{
    id: string;
    name: string;
    quantity: number;
    unit: string | null;
    cadence: string | null;
    group_key: string | null;
    group_label: string | null;
  }>;
  projects: Array<{
    id: string;
    name: string;
    status: string;
    group_key: string;
    link: "primary" | "consolidated";
    origin: string | null;
    created_at: string;
    visible: boolean;
    assigned_to: string | null;
    assigned_name: string | null;
    company_matches: boolean;
    has_company: boolean;
    has_contract: boolean;
    has_service: boolean;
    pending: DeliveryPendingCode[];
  }>;
  job: {
    id: string;
    status: DeliveryJobStatus;
    origin: string;
    attempts: number;
    max_attempts: number;
    last_error: string | null;
    skip_reason: string | null;
    next_run_at: string;
    created_at: string;
    finished_at: string | null;
  } | null;
  reviews: Array<{
    id: string;
    kind: string;
    created_at: string;
    project_id: string | null;
    note: string | null;
  }>;
  pending: DeliveryPendingCode[];
  can: { create: boolean; link: boolean; groups: boolean; retry: boolean };
};

export type ProjectOrigin = {
  id: string;
  origin: string | null;
  imported_from: Array<"clockify" | "jibble">;
  company: { id: string; name: string } | null;
  contact: { id: string; name: string } | null;
  assigned: { id: string; name: string | null } | null;
  contract_id: string | null;
  service_id: string | null;
  group_key: string | null;
  source_line_item: { id: string; name: string; quantity: number; unit: string | null } | null;
  deals: Array<
    | {
        visible: true;
        id: string;
        name: string;
        link: string;
        group_key: string;
        stage_type: string;
        closed_at: string | null;
      }
    | { visible: false; link: string }
  >;
  reviews: Array<{ id: string; kind: string; created_at: string }>;
  logged_seconds: number;
  pending: DeliveryPendingCode[];
  can: { edit: boolean };
};

/** Resumo de uma linha para o cabeçalho do painel no negócio. */
export function deliveryHeadline(
  o: Pick<DeliveryOverview, "deal" | "projects" | "job" | "policy">,
): {
  tone: "success" | "warning" | "danger" | "neutral";
  text: string;
} {
  if (o.projects.length > 0) {
    const n = o.projects.length;
    return {
      tone: "success",
      text: n === 1 ? "Projeto de entrega ligado" : `${n} projetos de entrega ligados`,
    };
  }
  if (o.deal.stage_type !== "won")
    return {
      tone: "neutral",
      text: "Negócio em aberto: vincule um projeto existente se já houver",
    };
  if (o.job?.status === "failed") return { tone: "danger", text: "A preparação da entrega falhou" };
  if (o.job && (o.job.status === "pending" || o.job.status === "running"))
    return { tone: "warning", text: "Preparando a entrega (fila)" };
  if (!o.policy.enabled)
    return { tone: "warning", text: "Ganho sem projeto: criação automática desligada" };
  return { tone: "warning", text: "Ganho sem projeto de entrega" };
}

export function formatHms(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}
