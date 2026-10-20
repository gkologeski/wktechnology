// Rótulos e formatação da tela do importador Clockify. Client-safe.

/** 3725 → "1h 02min 05s" (segundos preservados, sem arredondar). */
export function formatSeconds(total: number | null | undefined): string {
  const s = Math.max(0, Math.floor(total ?? 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h.toLocaleString("pt-BR")}h ${String(m).padStart(2, "0")}min ${String(sec).padStart(2, "0")}s`;
}

export function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

export const RUN_STATUS_LABEL: Record<string, string> = {
  queued: "Na fila",
  running: "Em execução",
  paused: "Pausada",
  cancel_requested: "Cancelando…",
  cancelled: "Cancelada",
  completed: "Concluída",
  failed: "Falhou",
};

export const RUN_KIND_LABEL: Record<string, string> = {
  dry_run: "Prévia (simulação)",
  import: "Importação",
};

export const PHASE_LABEL: Record<string, string> = {
  start: "Preparando",
  workspace: "Workspace",
  users: "Usuários",
  groups: "Grupos",
  clients: "Clientes",
  projects: "Projetos",
  tasks: "Tarefas",
  tags: "Etiquetas",
  custom_fields: "Campos personalizados",
  approvals: "Aprovações",
  expenses: "Despesas",
  invoices: "Faturas",
  holidays: "Feriados",
  time_off_policies: "Políticas de folga",
  time_entries: "Apontamentos",
  in_progress: "Cronômetros abertos",
  reconcile: "Conciliação com relatório",
  mappings: "Mapeamentos",
  plan: "Prévia dos apontamentos",
  projects_write: "Gravando projetos",
  members_write: "Gravando membros",
  tasks_write: "Gravando tarefas",
  entries_write: "Gravando apontamentos",
  done: "Finalizando",
};

export const CAPABILITY_LABEL: Record<string, string> = {
  collected: "Coletado",
  empty: "Sem registros",
  forbidden: "Sem permissão",
  not_available: "Indisponível no plano/API",
  failed: "Falhou",
  not_collected: "Não coletado",
};

export const ENTITY_LABEL: Record<string, string> = {
  workspace: "Configuração do workspace",
  user: "Usuários",
  group: "Grupos",
  client: "Clientes",
  project: "Projetos",
  task: "Tarefas",
  tag: "Etiquetas",
  custom_field: "Campos personalizados",
  approval_request: "Aprovações",
  time_entry: "Apontamentos",
  expense: "Despesas",
  invoice: "Faturas",
  holiday: "Feriados",
  time_off_policy: "Políticas de folga",
  report_summary: "Relatório resumido (conciliação)",
};

export const STAGING_STATUS_LABEL: Record<string, string> = {
  staged: "Coletado",
  ready: "Pronto para importar",
  imported: "Importado",
  pending_review: "Revisar",
  unsupported: "Sem equivalente",
  rejected: "Recusado",
  skipped: "Ignorado",
};

export const DECISION_LABEL: Record<string, string> = {
  auto: "Automático (e-mail)",
  confirmed: "Vinculado",
  create: "Criar novo",
  ignore: "Ignorar",
  pending: "Pendente",
};

export const MAPPING_NOTE_LABEL: Record<string, string> = {
  sem_email: "Sem e-mail no Clockify",
  email_duplicado_origem: "E-mail repetido no Clockify",
  email_duplicado_destino: "E-mail em mais de um membro",
  sem_membro: "Nenhum membro com este e-mail",
  membro_duplicado: "Dois usuários do Clockify no mesmo membro",
};

/** Tom do selo de situação (StatusBadge) para conexões e execuções. */
type Tone = "open" | "onhold" | "closed" | "draft";

export function toneFor(status: string): Tone {
  if (["connected", "completed"].includes(status)) return "open";
  if (["failed", "cancelled"].includes(status)) return "closed";
  if (
    ["running", "queued", "connecting", "paused", "cancel_requested", "configured"].includes(status)
  )
    return "onhold";
  return "draft";
}
