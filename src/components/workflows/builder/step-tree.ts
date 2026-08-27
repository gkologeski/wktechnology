import {
  Zap,
  Clock,
  GitBranch,
  Mail,
  Bell,
  Webhook,
  Users,
  UserPlus,
  Briefcase,
  ArrowRight,
  X,
  Sparkles,
  Building2,
  Handshake,
  Ticket,
  CheckSquare,
  Contact,
  Copy,
  Link2,
  Link2Off,
  Eraser,
  PlusIcon,
  MessageCircle,
  SplitSquareHorizontal,
  GitFork,
  CalendarClock,
  Wand2,
  Hash,
  MessageSquare,
  ClipboardList,
} from "lucide-react";
import { ACTION_LABELS, type WorkflowAction, type WorkflowActionType } from "@/lib/workflows/types";
import { conditionsSummary } from "@/lib/workflows/conditions";

export type FieldOpt = {
  name: string;
  label: string;
  type?: "text" | "number" | "currency" | "date" | "select" | "boolean";
  options?: { value: string; label: string }[];
  /** Campo de referência: usa seletor com busca por nome (grava o ID). */
  ref?: "user" | "company" | "contact" | "pipeline";
  /** Campo controlado pelo sistema (não deve virar variável de texto). */
  system?: boolean;
};

export const ACTION_ICONS: Record<WorkflowActionType, typeof Zap> = {
  set_field: Sparkles,
  set_substatus: Sparkles,
  create_activity: Mail,
  create_survey_activity: ClipboardList,
  open_deal_dialog: Handshake,
  assign_to: UserPlus,
  rotate_assign: Users,
  add_to_sequence: Mail,
  send_notification: Bell,
  webhook: Webhook,
  delay: Clock,
  branch_if: GitBranch,
  create_ats_job: Briefcase,
  advance_ats_application_stage: ArrowRight,
  create_ats_candidate: UserPlus,
  assign_recruiter: UserPlus,
  create_lead: Sparkles,
  create_contact: Contact,
  create_company: Building2,
  create_deal: Handshake,
  create_ticket: Ticket,
  create_task: CheckSquare,
  copy_field_from_association: Copy,
  associate_records: Link2,
  disassociate_records: Link2Off,
  clear_field: Eraser,
  increment_field: PlusIcon,
  send_email: Mail,
  send_whatsapp: MessageCircle,
  switch_by_value: SplitSquareHorizontal,
  branch_multi: GitFork,
  delay_until_date: CalendarClock,
  format_data: Wand2,
  send_slack: Hash,
  send_teams: MessageSquare,
  approval_step: CheckSquare,
  create_record: PlusIcon,
  update_record: Sparkles,
  delete_record: Eraser,
};

export function defaultActionOfType(type: WorkflowActionType): WorkflowAction {
  switch (type) {
    case "set_field":
      return { type, field: "status", value: "" };
    case "set_substatus":
      return { type, substatus_id: "" };
    case "create_activity":
      return { type, subject: "Nova tarefa", activity_type: "task" };
    case "create_survey_activity":
      return { type, source: "prospecting_questionnaire", source_id: "" };
    case "open_deal_dialog":
      return { type, due_rule: "last_business_day_of_month" };
    case "assign_to":
      return { type, user_id: "" };
    case "rotate_assign":
      return { type, rule_id: "" };
    case "add_to_sequence":
      return { type, sequence_id: "" };
    case "send_notification":
      return { type, title: "Atenção" };
    case "webhook":
      return { type, url: "https://" };
    case "delay":
      return { type, amount: 1, unit: "hours" };
    case "branch_if":
      return { type, filters: [], then: [], else: [] };
    case "create_ats_job":
      return { type, title: "Vaga para {{name}}", headcount: 1 };
    case "advance_ats_application_stage":
      return { type, stage_value: "" };
    case "create_ats_candidate":
      return { type, full_name: "{{full_name}}" };
    case "assign_recruiter":
      return { type, user_id: "", target: "auto" };
    case "create_lead":
      return { type, first_name: "" };
    case "create_contact":
      return { type, first_name: "" };
    case "create_company":
      return { type, name: "" };
    case "create_deal":
      return { type, name: "Novo negócio", currency: "BRL" };
    case "create_ticket":
      return { type, subject: "" };
    case "create_task":
      return { type, subject: "" };
    case "copy_field_from_association":
      return { type, association: "", source_field: "", target_field: "" };
    case "associate_records":
      return { type, association: "", target_id: "" };
    case "disassociate_records":
      return { type, association: "" };
    case "clear_field":
      return { type, field: "" };
    case "increment_field":
      return { type, field: "score", amount: 1 };
    case "send_email":
      return { type, subject: "Assunto", body: "Corpo do email" };
    case "send_whatsapp":
      return { type, body: "" };
    case "switch_by_value":
      return { type, field: "status", cases: [], default: [] };
    case "branch_multi":
      return { type, branches: [], else: [] };
    case "delay_until_date":
      return { type, field: "expected_close_date", offset_amount: 0, offset_unit: "days" };
    case "format_data":
      return { type, op: "upper", source_field: "name", target_var: "formatted" };
    case "send_slack":
      return { type, text: "Notificação de workflow: {{name}}" };
    case "send_teams":
      return {
        type,
        webhook_url: "https://outlook.office.com/webhook/...",
        text: "Notificação de workflow: {{name}}",
      };
    case "approval_step":
      return { type, title: "Aprovar {{name}}", note: "", halt_on_reject: true };
    case "create_record":
      return { type, table: "activities", values: {} };
    case "update_record":
      return { type, table: "activities", target_id: "{{id}}", values: {} };
    case "delete_record":
      return { type, table: "activities", target_id: "{{id}}" };
  }
}

// ============================================================================
// Path: um passo é endereçado por um array de índices (branches criam níveis).
// Ex: [0] = 1º passo topo. [1,"then",0] = 1º passo do ramo "sim" do 2º passo.
// ============================================================================
export type BranchKey = "then" | "else" | "default" | `case:${number}`;
export type StepPath = Array<number | BranchKey>;

export function isBranchKey(seg: unknown): seg is BranchKey {
  return (
    seg === "then" ||
    seg === "else" ||
    seg === "default" ||
    (typeof seg === "string" && /^case:\d+$/.test(seg))
  );
}

/** Lista de ações filhas de um ramo (then/else de branch_if, case/default de switch). */
export function getBranchList(a: WorkflowAction, key: BranchKey): WorkflowAction[] | null {
  if (a.type === "branch_if") {
    if (key === "then" || key === "else") return a[key] ?? [];
    return null;
  }
  if (a.type === "switch_by_value") {
    if (key === "default") return a.default ?? [];
    if (typeof key === "string" && key.startsWith("case:")) {
      const i = Number(key.slice(5));
      const c = a.cases?.[i];
      return c ? (c.actions ?? []) : null;
    }
  }
  return null;
}

/** Substitui a lista de ações filhas de um ramo, preservando o restante da ação. */
export function setBranchList(
  a: WorkflowAction,
  key: BranchKey,
  list: WorkflowAction[],
): WorkflowAction {
  if (a.type === "branch_if" && (key === "then" || key === "else")) {
    return { ...a, [key]: list };
  }
  if (a.type === "switch_by_value") {
    if (key === "default") return { ...a, default: list };
    if (typeof key === "string" && key.startsWith("case:")) {
      const i = Number(key.slice(5));
      return {
        ...a,
        cases: (a.cases ?? []).map((c, ci) => (ci === i ? { ...c, actions: list } : c)),
      };
    }
  }
  return a;
}

// ---------------------------------------------------------------------------
// Saídas registradas por passo (espelha `detail` de cada ação em engine.server).
// Usadas para oferecer, nas condições, valores de passos anteriores.
// ---------------------------------------------------------------------------
export const STEP_OUTPUT_KEYS: Partial<
  Record<WorkflowActionType, { key: string; label: string }[]>
> = {
  create_lead: [
    { key: "id", label: "ID do lead criado" },
    { key: "first_name", label: "Nome" },
  ],
  create_contact: [
    { key: "id", label: "ID do contato criado" },
    { key: "first_name", label: "Nome" },
  ],
  create_company: [
    { key: "id", label: "ID da empresa criada" },
    { key: "name", label: "Nome" },
  ],
  create_deal: [
    { key: "id", label: "ID do negócio criado" },
    { key: "name", label: "Nome" },
  ],
  create_ticket: [
    { key: "id", label: "ID do ticket criado" },
    { key: "subject", label: "Assunto" },
  ],
  create_record: [
    { key: "id", label: "ID do registro criado" },
    { key: "table", label: "Tabela" },
  ],
  update_record: [
    { key: "id", label: "ID do registro atualizado" },
    { key: "table", label: "Tabela" },
  ],
  create_activity: [{ key: "subject", label: "Assunto" }],
  create_survey_activity: [
    { key: "activity_id", label: "ID da atividade de pesquisa" },
    { key: "subject", label: "Assunto" },
  ],
  open_deal_dialog: [
    { key: "activity_id", label: "ID da intenção criada" },
    { key: "pipeline_id", label: "Pipeline sugerido" },
  ],
  create_task: [{ key: "subject", label: "Assunto" }],
  set_field: [
    { key: "field", label: "Campo" },
    { key: "value", label: "Valor aplicado" },
  ],
  increment_field: [
    { key: "from", label: "Valor anterior" },
    { key: "to", label: "Novo valor" },
  ],
  clear_field: [{ key: "field", label: "Campo" }],
  assign_to: [{ key: "user_id", label: "Usuário atribuído" }],
  rotate_assign: [{ key: "assigned_to", label: "Usuário atribuído" }],
  format_data: [
    { key: "value", label: "Resultado" },
    { key: "target_var", label: "Variável de destino" },
  ],
  approval_step: [
    { key: "approval_id", label: "ID da aprovação" },
    { key: "approver", label: "Aprovador" },
  ],
  webhook: [{ key: "status", label: "Status HTTP" }],
  send_email: [
    { key: "to", label: "Destinatário" },
    { key: "subject", label: "Assunto" },
  ],
  send_notification: [
    { key: "title", label: "Título" },
    { key: "user_id", label: "Usuário notificado" },
  ],
  branch_if: [{ key: "branch", label: "Ramo executado" }],
};

/** Lista de passos irmãos anteriores ao passo em `path`, no mesmo nível. */
export function siblingsOfPath(
  actions: WorkflowAction[],
  path: StepPath,
): { list: WorkflowAction[]; index: number } {
  if (path.length === 0) return { list: [], index: -1 };
  const head = path[0];
  if (typeof head !== "number") return { list: [], index: -1 };
  if (path.length === 1) return { list: actions, index: head };
  const parent = actions[head];
  const branch = path[1];
  if (!parent || !isBranchKey(branch)) return { list: [], index: -1 };
  const children = getBranchList(parent, branch);
  if (!children) return { list: [], index: -1 };
  return siblingsOfPath(children, path.slice(2) as StepPath);
}

/** Nomes de variáveis do fluxo (`{{vars.X}}`) criadas por passos de formatação. */
export function collectFlowVarNames(actions: WorkflowAction[]): string[] {
  const out: string[] = [];
  const walk = (list: WorkflowAction[]) => {
    for (const a of list) {
      if (!a) continue;
      if (a.type === "format_data" && a.target_var) out.push(a.target_var);
      if (a.type === "branch_if") {
        walk(a.then ?? []);
        walk(a.else ?? []);
      }
      if (a.type === "switch_by_value") {
        for (const c of a.cases ?? []) walk(c.actions ?? []);
        walk(a.default ?? []);
      }
      if (a.type === "branch_multi") {
        for (const b of a.branches ?? []) walk(b.actions ?? []);
        walk(a.else ?? []);
      }
    }
  };
  walk(actions);
  return out;
}

/** Opções de campo referenciando saídas de passos anteriores (`steps.N.campo`). */
export function priorStepFieldOptions(
  actions: WorkflowAction[],
  path: StepPath | null,
): FieldOpt[] {
  if (!path) return [];
  const { list, index } = siblingsOfPath(actions, path);
  if (index <= 0) return [];
  const out: FieldOpt[] = [];
  for (let i = 0; i < index; i++) {
    const a = list[i];
    if (!a) continue;
    const keys = STEP_OUTPUT_KEYS[a.type] ?? [{ key: "id", label: "ID" }];
    for (const k of keys) {
      out.push({
        name: `steps.${i}.${k.key}`,
        label: `Passo ${i + 1} · ${ACTION_LABELS[a.type]} · ${k.label}`,
      });
    }
  }
  return out;
}

/** Metadados dos passos anteriores (tipo + rótulo) para opções de referência. */
export function priorStepMeta(
  actions: WorkflowAction[],
  path: StepPath | null,
): Array<{ index: number; type: string; label: string }> {
  if (!path) return [];
  const { list, index } = siblingsOfPath(actions, path);
  if (index <= 0) return [];
  const out: Array<{ index: number; type: string; label: string }> = [];
  for (let i = 0; i < index; i++) {
    const a = list[i];
    if (!a) continue;
    out.push({ index: i, type: a.type, label: ACTION_LABELS[a.type] ?? a.type });
  }
  return out;
}

export function getStep(actions: WorkflowAction[], path: StepPath): WorkflowAction | null {
  if (path.length === 0) return null;
  const [head, ...rest] = path;
  if (typeof head !== "number") return null;
  const a = actions[head];
  if (!a) return null;
  if (rest.length === 0) return a;
  const branch = rest[0];
  if (!isBranchKey(branch)) return null;
  const children = getBranchList(a, branch);
  if (!children) return null;
  return getStep(children, rest.slice(1) as StepPath);
}

export function updateStep(
  actions: WorkflowAction[],
  path: StepPath,
  updater: (a: WorkflowAction) => WorkflowAction,
): WorkflowAction[] {
  if (path.length === 0) return actions;
  const [head, ...rest] = path;
  if (typeof head !== "number") return actions;
  return actions.map((a, i) => {
    if (i !== head) return a;
    if (rest.length === 0) return updater(a);
    const branch = rest[0];
    if (!isBranchKey(branch)) return a;
    const children = getBranchList(a, branch);
    if (!children) return a;
    return setBranchList(a, branch, updateStep(children, rest.slice(1) as StepPath, updater));
  });
}

export function removeStep(actions: WorkflowAction[], path: StepPath): WorkflowAction[] {
  if (path.length === 0) return actions;
  const [head, ...rest] = path;
  if (typeof head !== "number") return actions;
  if (rest.length === 0) return actions.filter((_, i) => i !== head);
  return actions.map((a, i) => {
    if (i !== head) return a;
    const branch = rest[0];
    if (!isBranchKey(branch)) return a;
    const children = getBranchList(a, branch);
    if (!children) return a;
    return setBranchList(a, branch, removeStep(children, rest.slice(1) as StepPath));
  });
}

// Lista de ações endereçada por `parentPath` ([] = topo).
export function listAt(actions: WorkflowAction[], parentPath: StepPath): WorkflowAction[] | null {
  if (parentPath.length === 0) return actions;
  const [head, ...rest] = parentPath;
  if (typeof head !== "number") return null;
  const a = actions[head];
  if (!a) return null;
  const branch = rest[0];
  if (!isBranchKey(branch)) return null;
  const children = getBranchList(a, branch);
  if (!children) return null;
  return listAt(children, rest.slice(1) as StepPath);
}

// Insere ação no fim de uma lista endereçada por `parentPath`.
// parentPath = [] → topo. parentPath = [2, "then"] → dentro do ramo then do passo 2.

export function insertStep(
  actions: WorkflowAction[],
  parentPath: StepPath,
  newAction: WorkflowAction,
): WorkflowAction[] {
  if (parentPath.length === 0) return [...actions, newAction];
  const [head, ...rest] = parentPath;
  if (typeof head !== "number") {
    // parentPath começa por chave de ramo — só existe no contexto recursivo.
    return actions;
  }
  return actions.map((a, i) => {
    if (i !== head) return a;
    if (rest.length === 0) return a;
    const branch = rest[0];
    if (!isBranchKey(branch)) return a;
    const children = getBranchList(a, branch);
    if (!children) return a;
    const remaining = rest.slice(1) as StepPath;
    if (remaining.length === 0) return setBranchList(a, branch, [...children, newAction]);
    return setBranchList(a, branch, insertStep(children, remaining, newAction));
  });
}

// Insere ação em posição específica dentro do array endereçado por parentPath.
export function insertStepAt(
  actions: WorkflowAction[],
  parentPath: StepPath,
  index: number,
  newAction: WorkflowAction,
): WorkflowAction[] {
  if (parentPath.length === 0) {
    const copy = [...actions];
    const clamped = Math.max(0, Math.min(index, copy.length));
    copy.splice(clamped, 0, newAction);
    return copy;
  }
  const [head, ...rest] = parentPath;
  if (typeof head !== "number") return actions;
  return actions.map((a, i) => {
    if (i !== head) return a;
    const branch = rest[0];
    if (!isBranchKey(branch)) return a;
    const list = getBranchList(a, branch);
    if (!list) return a;
    const remaining = rest.slice(1) as StepPath;
    if (remaining.length === 0) {
      const copy = [...list];
      const clamped = Math.max(0, Math.min(index, copy.length));
      copy.splice(clamped, 0, newAction);
      return setBranchList(a, branch, copy);
    }
    return setBranchList(a, branch, insertStepAt(list, remaining, index, newAction));
  });
}

// True se `target` está dentro (ou é igual a) `source`.
export function isDescendantOrSelf(target: StepPath, source: StepPath): boolean {
  if (target.length < source.length) return false;
  for (let i = 0; i < source.length; i++) {
    if (target[i] !== source[i]) return false;
  }
  return true;
}

// Move um passo para um novo destino. Retorna null se inválido / no-op.
export function moveStepTo(
  actions: WorkflowAction[],
  from: StepPath,
  to: { parentPath: StepPath; index: number },
): { actions: WorkflowAction[]; newPath: StepPath } | null {
  if (from.length === 0) return null;
  if (isDescendantOrSelf(to.parentPath, from)) return null;
  const step = getStep(actions, from);
  if (!step) return null;
  const fromParent = from.slice(0, -1) as StepPath;
  const fromIndex = from[from.length - 1] as number;
  const sameParent = JSON.stringify(fromParent) === JSON.stringify(to.parentPath);
  let targetIndex = to.index;
  if (sameParent) {
    if (targetIndex === fromIndex || targetIndex === fromIndex + 1) return null;
    if (targetIndex > fromIndex) targetIndex -= 1;
  }
  const afterRemove = removeStep(actions, from);
  const afterInsert = insertStepAt(afterRemove, to.parentPath, targetIndex, step);
  return { actions: afterInsert, newPath: [...to.parentPath, targetIndex] };
}

// ============================================================================
// Componente principal
// ============================================================================
export function countSteps(actions: WorkflowAction[]): number {
  let n = 0;
  for (const a of actions) {
    n += 1;
    if (a.type === "branch_if") {
      n += countSteps(a.then ?? []) + countSteps(a.else ?? []);
    } else if (a.type === "switch_by_value") {
      n += (a.cases ?? []).reduce((s, c) => s + countSteps(c.actions ?? []), 0);
      n += countSteps(a.default ?? []);
    } else if (a.type === "branch_multi") {
      n += (a.branches ?? []).reduce((s, b) => s + countSteps(b.actions ?? []), 0);
      n += countSteps(a.else ?? []);
    }
  }
  return n;
}

export type DescribeLabels = {
  labelForUser: (id: string | null | undefined) => string;
  labelForCompany: (id: string | null | undefined) => string;
  labelForPipeline: (id: string | null | undefined) => string;
  labelForSequence: (id: string | null | undefined) => string;
  labelForRule: (id: string | null | undefined) => string;
};

export function describeAction(a: WorkflowAction, labels?: DescribeLabels): string {
  // Fallback quando labels não é passado: hash curto.
  const short = (id: string | null | undefined, prefix: string) =>
    id ? `${prefix} ${id.slice(0, 8)}…` : "—";
  const L: DescribeLabels = labels ?? {
    labelForUser: (id) => (id ? `usuário ${id.slice(0, 8)}…` : "—"),
    labelForCompany: (id) => short(id, "empresa"),
    labelForPipeline: (id) => short(id, "pipeline"),
    labelForSequence: (id) => short(id, "sequência"),
    labelForRule: (id) => short(id, "regra"),
  };

  switch (a.type) {
    case "set_field":
      return `${a.field} = ${String(a.value ?? "")}`;
    case "create_activity":
      return `${a.activity_type ?? "task"}: ${a.subject}`;
    case "create_survey_activity":
      return a.source_id ? a.subject || "Pesquisa pendente" : "Selecione a pesquisa";
    case "open_deal_dialog":
      return a.pipeline_id ? L.labelForPipeline(a.pipeline_id) : "pipeline padrão de negócios";
    case "assign_to":
      return a.user_id ? L.labelForUser(a.user_id) : "—";
    case "rotate_assign":
      return a.rule_id ? L.labelForRule(a.rule_id) : "—";
    case "add_to_sequence":
      return a.sequence_id ? L.labelForSequence(a.sequence_id) : "—";
    case "send_notification":
      return a.title;
    case "webhook":
      return a.url;
    case "delay":
      return `${a.amount} ${a.unit}`;
    case "branch_if":
      return conditionsSummary(a.filters);
    case "create_ats_job":
      return `${a.headcount ?? 1}× ${a.title}`;
    case "advance_ats_application_stage":
      return `→ ${a.stage_value || "—"}`;
    case "create_ats_candidate":
      return a.full_name;
    case "assign_recruiter":
      return `${a.target ?? "auto"} · ${a.user_id ? L.labelForUser(a.user_id) : "—"}`;
    case "create_lead":
      return `lead: ${a.first_name || "—"}`;
    case "create_contact":
      return `contato: ${a.first_name || "—"}`;
    case "create_company":
      return `empresa: ${a.name || "—"}`;
    case "create_deal":
      return `negócio: ${a.name || "—"}`;
    case "create_ticket":
      return `ticket: ${a.subject || "—"}`;
    case "create_task":
      return `tarefa: ${a.subject || "—"}`;
    case "copy_field_from_association":
      return `${a.association}.${a.source_field} → ${a.target_field}`;
    case "associate_records":
      // target_id pode ser UUID ou token {{...}} — só encurta se parecer UUID.
      return `${a.association} = ${
        /^[0-9a-f-]{36}$/i.test(a.target_id) ? a.target_id.slice(0, 8) + "…" : a.target_id
      }`;
    case "disassociate_records":
      return `remover ${a.association}`;
    case "clear_field":
      return `limpar ${a.field}`;
    case "increment_field":
      return `${a.field} += ${a.amount}`;
    case "send_email":
      return `email: ${a.subject || "—"}`;
    case "send_whatsapp":
      return `whatsapp: ${a.template_name || a.body?.slice(0, 30) || "—"}`;
    case "switch_by_value":
      return `switch ${a.field} · ${a.cases.length} case(s)`;
    case "branch_multi":
      return `${a.branches.length} ramo(s) + senão`;
    case "delay_until_date":
      return `até ${a.field}${a.offset_amount ? ` ${a.offset_amount > 0 ? "+" : ""}${a.offset_amount}${(a.offset_unit ?? "days")[0]}` : ""}`;
    default:
      return "";
  }
}

// ============================================================================
// Fase 5 — forms simples para novas ações
// ============================================================================
