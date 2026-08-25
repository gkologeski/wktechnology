// Workflow engine: executa eventos pendentes da fila workflow_events.
// Roda no servidor (chamado pelo endpoint /api/public/hooks/workflows-tick).
import type { SupabaseClient } from "@supabase/supabase-js";
import { applyRotation } from "@/lib/rotation/engine.server";
import type {
  WorkflowAction,
  WorkflowCondition,
  WorkflowEntity,
  WorkflowFilter,
  WorkflowTrigger,
} from "./types";
import { isFilterGroup } from "./types";
import { ACTION_LABELS } from "./types";
import { getPath } from "@/lib/message-tokens";
import { renderWorkflowTokens, toStr } from "./render-tokens";
import { hydrateTriggerAssociations } from "./hydrate-associations.server";
import { checkLeadDuplicate } from "@/lib/leads/lead-duplicate-check";

type AnyRow = Record<string, unknown>;
type LogStep = {
  at: string;
  ok: boolean;
  action: string;
  action_label?: string;
  step_path?: string;
  detail?: unknown;
  error?: string;
};

function assignFieldFor(entity: WorkflowEntity): string {
  switch (entity) {
    case "tickets":
      return "assignee_id";
    case "ats_jobs":
      return "recruiter_id";
    case "ats_interviews":
      return "interviewer_id";
    case "ats_applications":
    case "ats_candidates":
    default:
      return "owner_id";
  }
}

function notificationLinkFor(entity: WorkflowEntity, entityId: string): string | null {
  switch (entity) {
    case "deals":
      return `/deals?id=${entityId}`;
    case "leads":
      return `/leads?id=${entityId}`;
    case "contacts":
      return `/contacts?id=${entityId}`;
    case "companies":
      return `/companies?id=${entityId}`;
    case "tickets":
      return `/tickets?id=${entityId}`;
    case "ats_jobs":
      return `/ats/jobs?id=${entityId}`;
    case "ats_candidates":
      return `/ats/candidates?id=${entityId}`;
    case "ats_applications":
      return `/ats/applications/${entityId}`;
    case "ats_interviews":
      return `/ats/interviews?id=${entityId}`;
    default:
      return null;
  }
}

function getField(obj: AnyRow | null | undefined, path: string): unknown {
  return getPath(obj ?? null, path);
}

/** Alias local: a implementação canônica vive em `./render-tokens`. */
const renderTokens = renderWorkflowTokens;

/**
 * Resolve tokens em valores de `extra_fields` de ações create_*.
 * Strings passam por renderTokens; objetos são percorridos recursivamente
 * (para casos como `custom_fields: { key: "{{campo}}" }`). Demais tipos
 * (number/boolean/null) são preservados.
 */
function resolveExtraFields(
  extra: Record<string, unknown> | undefined,
  after: AnyRow | null,
  vars?: AnyRow,
): Record<string, unknown> {
  if (!extra || typeof extra !== "object") return {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(extra)) {
    if (v == null) {
      out[k] = null;
      continue;
    }
    if (typeof v === "string") {
      const resolved = renderTokens(v, after, vars);
      out[k] = resolved === "" ? null : resolved;
    } else if (Array.isArray(v)) {
      out[k] = v.map((item) => (typeof item === "string" ? renderTokens(item, after, vars) : item));
    } else if (typeof v === "object") {
      out[k] = resolveExtraFields(v as Record<string, unknown>, after, vars);
    } else {
      out[k] = v;
    }
  }
  return out;
}

/**
 * Mescla payload principal com extra_fields, dando precedência ao principal.
 * Se ambos tiverem `custom_fields` (objeto), faz merge em vez de sobrescrever.
 */
function mergeExtra(
  base: Record<string, unknown>,
  extra: Record<string, unknown>,
): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...extra };
  for (const [k, v] of Object.entries(base)) {
    if (v === null || v === undefined) continue;
    merged[k] = v;
  }
  const baseCf = base.custom_fields;
  const extraCf = extra.custom_fields;
  if (
    baseCf &&
    extraCf &&
    typeof baseCf === "object" &&
    !Array.isArray(baseCf) &&
    typeof extraCf === "object" &&
    !Array.isArray(extraCf)
  ) {
    merged.custom_fields = {
      ...(extraCf as Record<string, unknown>),
      ...(baseCf as Record<string, unknown>),
    };
  }
  return merged;
}

function evalFilter(
  f: WorkflowFilter,
  after: AnyRow | null,
  before: AnyRow | null,
  vars?: AnyRow,
): boolean {
  const v = getField(after, f.field);
  // O valor comparado pode referenciar variáveis ou a saída de passos
  // anteriores via token ({{vars.X}} / {{steps.N.campo}}).
  const target =
    typeof f.value === "string" && f.value.includes("{{")
      ? renderTokens(f.value, after, vars)
      : f.value;
  switch (f.op) {
    case "eq":
      return v === target;
    case "neq":
      return v !== target;

    case "in": {
      const list = Array.isArray(target)
        ? target
        : String(target ?? "")
            .split(",")
            .map((s) => s.trim());
      return list.includes(v as never);
    }
    case "contains":
      return typeof v === "string" && v.toLowerCase().includes(String(target ?? "").toLowerCase());
    case "gt":
      return typeof v === "number" && typeof target === "number" && v > target;
    case "lt":
      return typeof v === "number" && typeof target === "number" && v < target;
    case "changed_to": {
      const prev = getField(before, f.field);
      return v === target && prev !== target;
    }

    case "is_empty":
      return v == null || v === "";
    case "is_not_empty":
      return v != null && v !== "";
    default:
      return false;
  }
}

/** Avalia um nó de condição (condição simples ou grupo E/OU aninhado). */
function evalCondition(
  node: WorkflowCondition,
  after: AnyRow | null,
  before: AnyRow | null,
  vars?: AnyRow,
): boolean {
  if (isFilterGroup(node)) {
    const children = node.conditions ?? [];
    // Grupo vazio é neutro (não bloqueia a avaliação).
    if (children.length === 0) return true;
    return node.logic === "or"
      ? children.some((c) => evalCondition(c, after, before, vars))
      : children.every((c) => evalCondition(c, after, before, vars));
  }
  return evalFilter(node, after, before, vars);
}

/** Avalia uma lista de condições no topo, combinando com E (comportamento histórico). */
function evalConditions(
  nodes: WorkflowCondition[] | null | undefined,
  after: AnyRow | null,
  before: AnyRow | null,
  vars?: AnyRow,
): boolean {
  const list = nodes ?? [];
  if (list.length === 0) return true;
  return list.every((c) => evalCondition(c, after, before, vars));
}

interface RunCtx {
  entity: WorkflowEntity;
  entityId: string;
  ownerId: string;
  workspaceId: string;
  after: AnyRow | null;
  before: AnyRow | null;
  /** Fase 5 — variáveis mutáveis do run, populadas por format_data e lidas via {{vars.X}}. */
  vars?: AnyRow;
  /** Fase 5b — usados para vincular workflow_approvals ao run/workflow atuais. */
  workflowId?: string;
  runId?: string;
}

interface RunResult {
  log: LogStep[];
  hadError: boolean;
  // Se != null, execução foi suspensa para retomar depois desse índice na lista de ações.
  suspendedAt?: { runAtIso: string; resumeCursor: number };
  // Fase 5b: aguardando decisão de aprovação (retomada acontece via decideApproval).
  waitingApproval?: { approvalId: string; resumeCursor: number };
}

export async function runActions(
  supabase: SupabaseClient,
  actions: WorkflowAction[],
  ctx: RunCtx,
  startIndex = 0,
  pathPrefix = "",
): Promise<RunResult> {
  const rawLog: LogStep[] = [];
  let currentStep = -1;
  // Registra a saída de cada passo em `ctx.vars.steps.N`, permitindo que
  // condições posteriores referenciem `{{steps.N.campo}}`.
  const log = new Proxy(rawLog, {
    get(target, prop, receiver) {
      if (prop === "push") {
        return (...items: LogStep[]) => {
          for (const item of items) {
            if (currentStep < 0 || !item?.ok) continue;
            const vars = (ctx.vars = ctx.vars ?? {});
            const steps = (vars.steps = (vars.steps as AnyRow) ?? {}) as AnyRow;
            steps[String(currentStep)] = (item.detail as AnyRow) ?? {};
          }
          return Array.prototype.push.apply(target, items);
        };
      }
      return Reflect.get(target, prop, receiver);
    },
  }) as LogStep[];
  for (let i = startIndex; i < actions.length; i++) {
    const action = actions[i];
    currentStep = i;
    const stepPath = pathPrefix ? `${pathPrefix}.${i + 1}` : String(i + 1);
    const annotate = (step: LogStep): LogStep => ({
      ...step,
      action_label:
        ACTION_LABELS[step.action as keyof typeof ACTION_LABELS] ??
        step.action_label ??
        step.action,
      step_path: step.step_path ?? stepPath,
    });

    // Delay: agenda retomada e para aqui.
    if (action.type === "delay") {
      const mult =
        action.unit === "minutes" ? 60_000 : action.unit === "hours" ? 3_600_000 : 86_400_000;
      const ms = Math.max(1, action.amount) * mult;
      const runAtIso = new Date(Date.now() + ms).toISOString();
      log.push(
        annotate({
          at: new Date().toISOString(),
          ok: true,
          action: "delay",
          detail: { amount: action.amount, unit: action.unit, resume_at: runAtIso },
        }),
      );
      return { log: rawLog, hadError: false, suspendedAt: { runAtIso, resumeCursor: i + 1 } };
    }

    // Branch: filtra e executa then/else recursivamente.
    if (action.type === "branch_if") {
      const filters = action.filters ?? [];
      const passes = evalConditions(filters, ctx.after, ctx.before, ctx.vars);
      const branchName = passes ? "then" : "else";
      const branchActions = passes ? (action.then ?? []) : (action.else ?? []);
      log.push(
        annotate({
          at: new Date().toISOString(),
          ok: true,
          action: "branch_if",
          detail: { branch: branchName, filters },
        }),
      );
      const branchRes = await runActions(
        supabase,
        branchActions,
        ctx,
        0,
        `${stepPath}.${branchName}`,
      );
      log.push(...branchRes.log);
      if (branchRes.hadError) return { log: rawLog, hadError: true };
      if (branchRes.suspendedAt) {
        // Delays dentro de branches não são retomáveis nesta versão — reportamos e paramos.
        log.push({
          at: new Date().toISOString(),
          ok: false,
          action: "delay",
          error: "Delays dentro de ramificações ainda não são retomáveis",
        });
        return { log: rawLog, hadError: true };
      }
      continue;
    }

    // Switch por valor: escolhe primeiro case cujo value bate, ou default.
    if (action.type === "switch_by_value") {
      const v = getField(ctx.after, action.field);
      const matched = action.cases.find((c) => c.value === v);
      const branchActions = matched ? matched.actions : (action.default ?? []);
      log.push(
        annotate({
          at: new Date().toISOString(),
          ok: true,
          action: "switch_by_value",
          detail: {
            field: action.field,
            value: v,
            matched: matched ? (matched.label ?? String(matched.value)) : "default",
          },
        }),
      );
      const branchRes = await runActions(
        supabase,
        branchActions,
        ctx,
        0,
        `${stepPath}.${matched ? "case" : "default"}`,
      );
      log.push(...branchRes.log);
      if (branchRes.hadError) return { log: rawLog, hadError: true };
      if (branchRes.suspendedAt) {
        log.push({
          at: new Date().toISOString(),
          ok: false,
          action: "delay",
          error: "Delays dentro de switch_by_value ainda não são retomáveis",
        });
        return { log: rawLog, hadError: true };
      }
      continue;
    }

    // Ramificação múltipla: executa 1ª branch cujos filtros passam, ou else.
    if (action.type === "branch_multi") {
      const matched = action.branches.find((b) =>
        evalConditions(b.filters, ctx.after, ctx.before, ctx.vars),
      );
      const branchActions = matched ? matched.actions : (action.else ?? []);
      log.push(
        annotate({
          at: new Date().toISOString(),
          ok: true,
          action: "branch_multi",
          detail: { matched: matched ? (matched.label ?? "branch") : "else" },
        }),
      );
      const branchRes = await runActions(
        supabase,
        branchActions,
        ctx,
        0,
        `${stepPath}.${matched ? "branch" : "else"}`,
      );
      log.push(...branchRes.log);
      if (branchRes.hadError) return { log: rawLog, hadError: true };
      if (branchRes.suspendedAt) {
        log.push({
          at: new Date().toISOString(),
          ok: false,
          action: "delay",
          error: "Delays dentro de branch_multi ainda não são retomáveis",
        });
        return { log: rawLog, hadError: true };
      }
      continue;
    }

    // Delay até data específica (campo do registro + offset).
    if (action.type === "delay_until_date") {
      const raw = getField(ctx.after, action.field);
      const base = raw ? new Date(String(raw)) : null;
      if (!base || Number.isNaN(base.getTime())) {
        log.push({
          at: new Date().toISOString(),
          ok: false,
          action: "delay_until_date",
          error: `campo ${action.field} não é uma data válida`,
        });
        return { log: rawLog, hadError: true };
      }
      const mult =
        action.offset_unit === "minutes"
          ? 60_000
          : action.offset_unit === "hours"
            ? 3_600_000
            : 86_400_000;
      const target = new Date(base.getTime() + (action.offset_amount ?? 0) * mult);
      if (target.getTime() <= Date.now()) {
        log.push({
          at: new Date().toISOString(),
          ok: true,
          action: "delay_until_date",
          detail: { target: target.toISOString(), skipped: "já no passado" },
        });
        continue;
      }
      const runAtIso = target.toISOString();
      log.push({
        at: new Date().toISOString(),
        ok: true,
        action: "delay_until_date",
        detail: { field: action.field, resume_at: runAtIso },
      });
      return { log: rawLog, hadError: false, suspendedAt: { runAtIso, resumeCursor: i + 1 } };
    }

    // Approval step: cria linha em workflow_approvals e suspende o run.
    if (action.type === "approval_step") {
      const title = (renderTokens(action.title, ctx.after, ctx.vars) as string) || "Aprovação";
      const note = action.note ? (renderTokens(action.note, ctx.after, ctx.vars) as string) : null;
      const approver = action.approver_user_id?.trim() || ctx.ownerId;
      const { data: appr, error: apprErr } = await supabase
        .from("workflow_approvals")
        .insert({
          owner_id: ctx.ownerId,
          workflow_id: ctx.workflowId ?? null,
          run_id: ctx.runId ?? null,
          entity: ctx.entity,
          entity_id: ctx.entityId,
          requested_by: ctx.ownerId,
          approver_user_id: approver,
          resume_cursor: i + 1,
          status: "pending",
          title,
          note,
          event_snapshot: { after: ctx.after, before: ctx.before, vars: ctx.vars ?? null } as never,
        } as never)
        .select("id")
        .single();
      if (apprErr || !appr) {
        log.push({
          at: new Date().toISOString(),
          ok: false,
          action: "approval_step",
          error: apprErr?.message ?? "falha ao criar aprovação",
        });
        return { log: rawLog, hadError: true };
      }
      // Notifica o aprovador.
      await supabase.from("notifications").insert({
        owner_id: ctx.ownerId,
        user_id: approver,
        type: "workflow",
        title: `Aprovação necessária: ${title}`,
        body: note ?? "Uma execução de workflow aguarda sua decisão.",
        entity: "workflows",
        entity_id: ctx.workflowId ?? null,
      } as never);
      log.push({
        at: new Date().toISOString(),
        ok: true,
        action: "approval_step",
        detail: { approval_id: appr.id, approver, title },
      });
      return {
        log: rawLog,
        hadError: false,
        waitingApproval: { approvalId: appr.id as string, resumeCursor: i + 1 },
      };
    }

    const step = annotate(await runAction(supabase, action, ctx));
    log.push(step);
    if (!step.ok) return { log: rawLog, hadError: true };
  }
  return { log: rawLog, hadError: false };
}

async function runAction(
  supabase: SupabaseClient,
  action: Exclude<
    WorkflowAction,
    | { type: "delay" }
    | { type: "branch_if" }
    | { type: "switch_by_value" }
    | { type: "branch_multi" }
    | { type: "delay_until_date" }
    | { type: "approval_step" }
  >,
  ctx: RunCtx,
): Promise<LogStep> {
  const at = new Date().toISOString();
  try {
    switch (action.type) {
      case "set_field": {
        const value = renderTokens(action.value, ctx.after);
        const { error } = await supabase
          .from(ctx.entity)
          .update({ [action.field]: value })
          .eq("id", ctx.entityId);
        if (error) throw new Error(error.message);
        return { at, ok: true, action: "set_field", detail: { field: action.field, value } };
      }
      case "assign_to": {
        const assignField = assignFieldFor(ctx.entity);
        const { error } = await supabase
          .from(ctx.entity)
          .update({ [assignField]: action.user_id })
          .eq("id", ctx.entityId);
        if (error) throw new Error(error.message);
        return {
          at,
          ok: true,
          action: "assign_to",
          detail: { user_id: action.user_id, field: assignField },
        };
      }
      case "rotate_assign": {
        if (ctx.entity !== "leads" && ctx.entity !== "deals" && ctx.entity !== "tickets") {
          throw new Error("rotate_assign suporta apenas leads/deals/tickets");
        }
        const r = await applyRotation(supabase, action.rule_id, ctx.entity, ctx.entityId);
        return {
          at,
          ok: true,
          action: "rotate_assign",
          detail: { rule_id: action.rule_id, assigned_to: r.user_id },
        };
      }
      case "create_activity": {
        const subject = renderTokens(action.subject, ctx.after) as string;
        const body = action.body ? (renderTokens(action.body, ctx.after) as string) : null;
        const due = action.due_in_days
          ? new Date(Date.now() + action.due_in_days * 86_400_000).toISOString()
          : null;
        const baseRow: Record<string, unknown> = {
          owner_id: ctx.ownerId,
          type: action.activity_type ?? "task",
          subject,
          body,
          due_date: due,
        };
        if (ctx.entity === "leads") baseRow.related_lead_id = ctx.entityId;
        else if (ctx.entity === "contacts") baseRow.related_contact_id = ctx.entityId;
        else if (ctx.entity === "companies") baseRow.related_company_id = ctx.entityId;
        else if (ctx.entity === "deals") baseRow.related_deal_id = ctx.entityId;
        const { error } = await supabase.from("activities").insert(baseRow as never);
        if (error) throw new Error(error.message);
        return { at, ok: true, action: "create_activity", detail: { subject } };
      }
      case "create_survey_activity": {
        // Cria uma atividade de pesquisa PENDENTE (respondida depois em Pesquisas).
        const isQuest = action.source === "prospecting_questionnaire";
        const { data: src } = isQuest
          ? await supabase
              .from("prospecting_questionnaires")
              .select("name")
              .eq("id", action.source_id)
              .maybeSingle()
          : await supabase
              .from("survey_templates")
              .select("name")
              .eq("id", action.source_id)
              .maybeSingle();
        const sourceName = (src as { name?: string } | null)?.name ?? "Pesquisa";
        const subject = action.subject
          ? (renderTokens(action.subject, ctx.after, ctx.vars) as string)
          : `Pesquisa — ${sourceName}`;
        const body = action.body
          ? (renderTokens(action.body, ctx.after, ctx.vars) as string)
          : null;
        const due = action.due_in_days
          ? new Date(Date.now() + action.due_in_days * 86_400_000).toISOString()
          : null;
        const row: Record<string, unknown> = {
          owner_id: ctx.ownerId,
          type: "survey",
          subject,
          body,
          due_date: due,
          completed: false,
          custom_fields: {
            survey_source: action.source,
            survey_source_id: action.source_id,
            survey_source_name: sourceName,
            survey_status: "pending",
          },
        };
        if (ctx.entity === "leads") row.related_lead_id = ctx.entityId;
        else if (ctx.entity === "contacts") row.related_contact_id = ctx.entityId;
        else if (ctx.entity === "companies") row.related_company_id = ctx.entityId;
        else if (ctx.entity === "deals") row.related_deal_id = ctx.entityId;
        else if (ctx.entity === "tickets") row.related_ticket_id = ctx.entityId;
        else throw new Error("create_survey_activity não suporta esta entidade");
        const { data: created, error } = await supabase
          .from("activities")
          .insert(row as never)
          .select("id")
          .single();
        if (error) throw new Error(error.message);
        return {
          at,
          ok: true,
          action: "create_survey_activity",
          detail: { activity_id: (created as { id: string }).id, subject },
        };
      }
      case "open_deal_dialog": {
        // Registra uma intenção pendente. A criação do negócio é confirmada
        // pelo usuário no modal aberto na tela do registro.
        if (ctx.entity !== "leads") throw new Error("open_deal_dialog suporta apenas leads");
        const subject = action.subject
          ? (renderTokens(action.subject, ctx.after, ctx.vars) as string)
          : "Criar oportunidade";
        const { data: created, error } = await supabase
          .from("activities")
          .insert({
            owner_id: ctx.ownerId,
            type: "task",
            subject,
            completed: false,
            related_lead_id: ctx.entityId,
            custom_fields: {
              ui_action: "create_deal",
              pipeline_id: action.pipeline_id ?? null,
              stage_value: action.stage_value ?? null,
              due_rule: action.due_rule ?? "last_business_day_of_month",
            },
          } as never)
          .select("id")
          .single();
        if (error) throw new Error(error.message);
        return {
          at,
          ok: true,
          action: "open_deal_dialog",
          detail: {
            activity_id: (created as { id: string }).id,
            pipeline_id: action.pipeline_id ?? null,
          },
        };
      }
      case "add_to_sequence": {
        const { error } = await supabase.from("sequence_enrollments").insert({
          owner_id: ctx.ownerId,
          sequence_id: action.sequence_id,
          entity_id: ctx.entityId,
          status: "active",
          next_run_at: new Date().toISOString(),
        });
        if (error) throw new Error(error.message);
        return {
          at,
          ok: true,
          action: "add_to_sequence",
          detail: { sequence_id: action.sequence_id },
        };
      }
      case "send_notification": {
        const title = renderTokens(action.title, ctx.after) as string;
        const body = action.body ? (renderTokens(action.body, ctx.after) as string) : null;
        const targetUserId = action.user_id?.trim() ? action.user_id : ctx.ownerId;
        const link = notificationLinkFor(ctx.entity, ctx.entityId);
        const { error } = await supabase.from("notifications").insert({
          owner_id: ctx.ownerId,
          user_id: targetUserId,
          type: "workflow",
          title,
          body,
          link,
          entity: ctx.entity,
          entity_id: ctx.entityId,
        } as never);
        if (error) throw new Error(error.message);
        return {
          at,
          ok: true,
          action: "send_notification",
          detail: { title, user_id: targetUserId },
        };
      }
      case "webhook": {
        const payload = action.payload
          ? JSON.parse(toStr(renderTokens(JSON.stringify(action.payload), ctx.after)))
          : { entity: ctx.entity, entity_id: ctx.entityId, after: ctx.after };
        const res = await fetch(action.url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error(`Webhook respondeu ${res.status}`);
        return { at, ok: true, action: "webhook", detail: { url: action.url, status: res.status } };
      }
      case "create_ats_job": {
        const after = ctx.after ?? {};
        const title =
          (renderTokens(action.title, ctx.after) as string) ||
          `Vaga para ${String((after as AnyRow).name ?? "")}`.trim();
        let pipelineId: string | null = null;
        const { data: pipe } = await supabase
          .from("ats_pipelines")
          .select("id")
          .eq("owner_id", ctx.ownerId)
          .order("is_default", { ascending: false })
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle();
        if (pipe) pipelineId = pipe.id as string;
        else {
          const { data: created, error: pErr } = await supabase
            .from("ats_pipelines")
            .insert({
              owner_id: ctx.ownerId,
              name: "Pipeline padrão",
              is_default: true,
              stages: [],
            } as never)
            .select("id")
            .single();
          if (pErr) throw new Error(pErr.message);
          pipelineId = created.id as string;
        }
        const headcount = action.headcount && action.headcount > 0 ? action.headcount : 1;
        const slugBase = title
          .toLowerCase()
          .normalize("NFD")
          .replace(/\p{Diacritic}/gu, "")
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, "");
        const createdIds: string[] = [];
        for (let i = 0; i < headcount; i++) {
          const slug = `${slugBase}-${Date.now().toString(36)}-${i}`;
          const { data: inserted, error } = await supabase
            .from("ats_jobs")
            .insert({
              owner_id: ctx.ownerId,
              pipeline_id: pipelineId,
              title,
              slug,
              status: "draft",
              deal_id: ctx.entity === "deals" ? ctx.entityId : null,
              company_id: (((after as AnyRow).company_id as string) ??
                (ctx.entity === "companies" ? ctx.entityId : null)) as string | null,
              hiring_manager_id: action.hiring_manager_id ?? null,
              recruiter_id: action.recruiter_id ?? null,
              metadata: action.department ? { department: action.department } : {},
            } as never)
            .select("id")
            .single();
          if (error) throw new Error(error.message);
          createdIds.push(inserted.id as string);
        }
        if (action.notify_user_id) {
          await supabase.from("notifications").insert({
            owner_id: ctx.ownerId,
            user_id: action.notify_user_id,
            type: "workflow",
            title: `Nova vaga em rascunho: ${title}`,
            body: `Origem: ${ctx.entity}. Revise e publique para abrir a vaga.`,
            link: `/ats/jobs`,
            entity: "ats_jobs",
            entity_id: createdIds[0] ?? null,
          } as never);
        }
        return { at, ok: true, action: "create_ats_job", detail: { ids: createdIds, headcount } };
      }
      case "advance_ats_application_stage": {
        if (ctx.entity !== "ats_applications") {
          throw new Error("advance_ats_application_stage exige workflow sobre Aplicações (ATS)");
        }
        const stageValue = renderTokens(action.stage_value, ctx.after) as string;
        if (!stageValue) throw new Error("stage_value obrigatório");
        const { error } = await supabase
          .from("ats_applications")
          .update({ stage_value: stageValue, moved_at: new Date().toISOString() })
          .eq("id", ctx.entityId);
        if (error) throw new Error(error.message);
        return {
          at,
          ok: true,
          action: "advance_ats_application_stage",
          detail: { stage_value: stageValue },
        };
      }
      case "create_ats_candidate": {
        const fullName = (renderTokens(action.full_name, ctx.after) as string).trim();
        if (!fullName) throw new Error("full_name obrigatório");
        const email = action.email
          ? (renderTokens(action.email, ctx.after) as string) || null
          : null;
        const phone = action.phone
          ? (renderTokens(action.phone, ctx.after) as string) || null
          : null;
        const { data: inserted, error } = await supabase
          .from("ats_candidates")
          .insert({
            owner_id: ctx.ownerId,
            full_name: fullName,
            email,
            phone,
            source: action.source ?? "workflow",
          } as never)
          .select("id")
          .single();
        if (error) throw new Error(error.message);
        return {
          at,
          ok: true,
          action: "create_ats_candidate",
          detail: { id: inserted.id, full_name: fullName },
        };
      }
      case "assign_recruiter": {
        const target =
          action.target && action.target !== "auto"
            ? action.target
            : ctx.entity === "ats_jobs"
              ? "job"
              : ctx.entity === "ats_candidates"
                ? "candidate"
                : ctx.entity === "ats_applications"
                  ? "application"
                  : ctx.entity === "ats_interviews"
                    ? "interview"
                    : "job";
        const table =
          target === "job"
            ? "ats_jobs"
            : target === "candidate"
              ? "ats_candidates"
              : target === "application"
                ? "ats_applications"
                : "ats_interviews";
        const column =
          target === "job"
            ? "recruiter_id"
            : target === "interview"
              ? "interviewer_id"
              : "owner_id";
        const { error } = await supabase
          .from(table)
          .update({ [column]: action.user_id })
          .eq("id", ctx.entityId);
        if (error) throw new Error(error.message);
        return {
          at,
          ok: true,
          action: "assign_recruiter",
          detail: { target, user_id: action.user_id, column },
        };
      }
      case "create_lead": {
        const first = (renderTokens(action.first_name, ctx.after) as string).trim();
        if (!first) throw new Error("first_name obrigatório");
        const owner = action.owner_id?.trim() || ctx.ownerId;
        const base: Record<string, unknown> = {
          owner_id: owner,
          status: "new",
          first_name: first,
          last_name: action.last_name
            ? (renderTokens(action.last_name, ctx.after) as string) || null
            : null,
          email: action.email ? (renderTokens(action.email, ctx.after) as string) || null : null,
          phone: action.phone ? (renderTokens(action.phone, ctx.after) as string) || null : null,
          company_name: action.company_name
            ? (renderTokens(action.company_name, ctx.after) as string) || null
            : null,
          source: action.source
            ? (renderTokens(action.source, ctx.after) as string) || null
            : "workflow",
        };
        const dup = await checkLeadDuplicate(supabase, {
          workspaceId: ctx.workspaceId,
          email: (base.email as string | null) ?? null,
          phone: (base.phone as string | null) ?? null,
        });
        if (dup.duplicate) {
          return {
            at,
            ok: false,
            action: "create_lead",
            error: dup.message ?? "Lead duplicado",
            detail: { existing_id: dup.existingId },
          };
        }
        const row = mergeExtra(base, resolveExtraFields(action.extra_fields, ctx.after, ctx.vars));
        const { data, error } = await supabase
          .from("leads")
          .insert(row as never)
          .select("id")
          .single();
        if (error) throw new Error(error.message);
        // Garante empresa e contato vinculados ao lead
        const { ensureLeadRelationsSafe } = await import("@/lib/leads/lead-relations");
        await ensureLeadRelationsSafe(
          supabase as unknown as Parameters<typeof ensureLeadRelationsSafe>[0],
          data.id as string,
        );
        return { at, ok: true, action: "create_lead", detail: { id: data.id, first_name: first } };
      }
      case "create_contact": {
        const first = (renderTokens(action.first_name, ctx.after) as string).trim();
        if (!first) throw new Error("first_name obrigatório");
        const owner = action.owner_id?.trim() || ctx.ownerId;
        const base: Record<string, unknown> = {
          owner_id: owner,
          first_name: first,
          last_name: action.last_name
            ? (renderTokens(action.last_name, ctx.after) as string) || null
            : null,
          email: action.email ? (renderTokens(action.email, ctx.after) as string) || null : null,
          phone: action.phone ? (renderTokens(action.phone, ctx.after) as string) || null : null,
          job_title: action.job_title
            ? (renderTokens(action.job_title, ctx.after) as string) || null
            : null,
          company_name: action.company_name
            ? (renderTokens(action.company_name, ctx.after) as string) || null
            : null,
        };
        const row = mergeExtra(base, resolveExtraFields(action.extra_fields, ctx.after, ctx.vars));
        const { data, error } = await supabase
          .from("contacts")
          .insert(row as never)
          .select("id")
          .single();
        if (error) throw new Error(error.message);
        return {
          at,
          ok: true,
          action: "create_contact",
          detail: { id: data.id, first_name: first },
        };
      }
      case "create_company": {
        const name = (renderTokens(action.name, ctx.after) as string).trim();
        if (!name) throw new Error("name obrigatório");
        const owner = action.owner_id?.trim() || ctx.ownerId;
        const base: Record<string, unknown> = {
          owner_id: owner,
          name,
          domain: action.domain ? (renderTokens(action.domain, ctx.after) as string) || null : null,
          industry: action.industry
            ? (renderTokens(action.industry, ctx.after) as string) || null
            : null,
        };
        const row = mergeExtra(base, resolveExtraFields(action.extra_fields, ctx.after, ctx.vars));
        const { data, error } = await supabase
          .from("companies")
          .insert(row as never)
          .select("id")
          .single();
        if (error) throw new Error(error.message);
        return { at, ok: true, action: "create_company", detail: { id: data.id, name } };
      }
      case "create_deal": {
        const name = (renderTokens(action.name, ctx.after) as string).trim();
        if (!name) throw new Error("name obrigatório");
        const owner = action.owner_id?.trim() || ctx.ownerId;
        let pipelineId = action.pipeline_id ?? null;
        const stageId = action.stage_id ?? null;
        if (!pipelineId) {
          const { data: pipe } = await supabase
            .from("pipelines")
            .select("id")
            .eq("owner_id", owner)
            .eq("entity", "deals")
            .order("is_default", { ascending: false })
            .order("created_at", { ascending: true })
            .limit(1)
            .maybeSingle();
          if (pipe) pipelineId = pipe.id as string;
        }
        const base: Record<string, unknown> = {
          owner_id: owner,
          name,
          value: typeof action.value === "number" ? action.value : null,
          currency: action.currency ?? "BRL",
          pipeline_id: pipelineId,
          stage_id: stageId,
        };
        // Associação automática quando disparado por lead/contact/company
        if (ctx.entity === "contacts") base.contact_id = ctx.entityId;
        else if (ctx.entity === "companies") base.company_id = ctx.entityId;
        const row = mergeExtra(base, resolveExtraFields(action.extra_fields, ctx.after, ctx.vars));
        const { data, error } = await supabase
          .from("deals")
          .insert(row as never)
          .select("id")
          .single();
        if (error) throw new Error(error.message);
        return { at, ok: true, action: "create_deal", detail: { id: data.id, name } };
      }
      case "create_ticket": {
        const subject = (renderTokens(action.subject, ctx.after) as string).trim();
        if (!subject) throw new Error("subject obrigatório");
        let pipelineId = action.pipeline_id ?? null;
        if (!pipelineId) {
          const { data: pipe } = await supabase
            .from("pipelines")
            .select("id")
            .eq("owner_id", ctx.ownerId)
            .eq("entity", "tickets")
            .order("is_default", { ascending: false })
            .order("created_at", { ascending: true })
            .limit(1)
            .maybeSingle();
          if (pipe) pipelineId = pipe.id as string;
        }
        const base: Record<string, unknown> = {
          owner_id: ctx.ownerId,
          subject,
          description: action.description
            ? (renderTokens(action.description, ctx.after) as string) || null
            : null,
          priority: action.priority ?? "medium",
          pipeline_id: pipelineId,
          assignee_id: action.assignee_id ?? null,
        };
        if (ctx.entity === "contacts") base.contact_id = ctx.entityId;
        else if (ctx.entity === "companies") base.company_id = ctx.entityId;
        else if (ctx.entity === "deals") base.deal_id = ctx.entityId;
        const row = mergeExtra(base, resolveExtraFields(action.extra_fields, ctx.after, ctx.vars));
        const { data, error } = await supabase
          .from("tickets")
          .insert(row as never)
          .select("id")
          .single();
        if (error) throw new Error(error.message);
        return { at, ok: true, action: "create_ticket", detail: { id: data.id, subject } };
      }
      case "create_task": {
        const subject = (renderTokens(action.subject, ctx.after) as string).trim();
        if (!subject) throw new Error("subject obrigatório");
        const body = action.body ? (renderTokens(action.body, ctx.after) as string) : null;
        const due = action.due_in_days
          ? new Date(Date.now() + action.due_in_days * 86_400_000).toISOString()
          : null;
        const base: Record<string, unknown> = {
          owner_id: action.assignee_id?.trim() || ctx.ownerId,
          type: "task",
          subject,
          body,
          due_date: due,
        };
        if (ctx.entity === "leads") base.related_lead_id = ctx.entityId;
        else if (ctx.entity === "contacts") base.related_contact_id = ctx.entityId;
        else if (ctx.entity === "companies") base.related_company_id = ctx.entityId;
        else if (ctx.entity === "deals") base.related_deal_id = ctx.entityId;
        const row = mergeExtra(base, resolveExtraFields(action.extra_fields, ctx.after, ctx.vars));
        const { error } = await supabase.from("activities").insert(row as never);
        if (error) throw new Error(error.message);
        return { at, ok: true, action: "create_task", detail: { subject } };
      }

      case "copy_field_from_association": {
        const { findAssociation } = await import("./associations");
        const assoc = findAssociation(ctx.entity, action.association);
        if (!assoc) throw new Error(`associação desconhecida: ${action.association}`);
        const targetId = ctx.after ? (ctx.after[assoc.fk_column] as string | null) : null;
        if (!targetId) throw new Error(`sem valor em ${assoc.fk_column}`);
        const { data: assocRow, error: readErr } = await supabase
          .from(assoc.target_table)
          .select(action.source_field)
          .eq("id", targetId)
          .maybeSingle();
        if (readErr) throw new Error(readErr.message);
        const value = (assocRow as AnyRow | null)?.[action.source_field] ?? null;
        const { error } = await supabase
          .from(ctx.entity)
          .update({ [action.target_field]: value })
          .eq("id", ctx.entityId);
        if (error) throw new Error(error.message);
        return {
          at,
          ok: true,
          action: "copy_field_from_association",
          detail: {
            from: `${assoc.target_table}.${action.source_field}`,
            target: action.target_field,
            value,
          },
        };
      }
      case "associate_records": {
        const { findAssociation } = await import("./associations");
        const assoc = findAssociation(ctx.entity, action.association);
        if (!assoc) throw new Error(`associação desconhecida: ${action.association}`);
        const targetId = (renderTokens(action.target_id, ctx.after) as string).trim();
        if (!targetId) throw new Error("target_id vazio");
        const { error } = await supabase
          .from(ctx.entity)
          .update({ [assoc.fk_column]: targetId })
          .eq("id", ctx.entityId);
        if (error) throw new Error(error.message);
        return {
          at,
          ok: true,
          action: "associate_records",
          detail: { [assoc.fk_column]: targetId },
        };
      }
      case "disassociate_records": {
        const { findAssociation } = await import("./associations");
        const assoc = findAssociation(ctx.entity, action.association);
        if (!assoc) throw new Error(`associação desconhecida: ${action.association}`);
        const { error } = await supabase
          .from(ctx.entity)
          .update({ [assoc.fk_column]: null })
          .eq("id", ctx.entityId);
        if (error) throw new Error(error.message);
        return {
          at,
          ok: true,
          action: "disassociate_records",
          detail: { [assoc.fk_column]: null },
        };
      }
      case "clear_field": {
        const { error } = await supabase
          .from(ctx.entity)
          .update({ [action.field]: null })
          .eq("id", ctx.entityId);
        if (error) throw new Error(error.message);
        return { at, ok: true, action: "clear_field", detail: { field: action.field } };
      }
      case "increment_field": {
        const current = Number(ctx.after?.[action.field] ?? 0) || 0;
        const next = current + (Number(action.amount) || 0);
        const { error } = await supabase
          .from(ctx.entity)
          .update({ [action.field]: next })
          .eq("id", ctx.entityId);
        if (error) throw new Error(error.message);
        return {
          at,
          ok: true,
          action: "increment_field",
          detail: { field: action.field, from: current, to: next },
        };
      }
      case "send_email": {
        const toField = action.to_field || "email";
        const to = (ctx.after?.[toField] as string | null) ?? null;
        if (!to) throw new Error(`sem destinatário em ${toField}`);
        let subject = action.subject;
        let body = action.body;
        if (action.template_id) {
          const { data: tpl } = await supabase
            .from("email_templates")
            .select("subject, body_html, body_text")
            .eq("id", action.template_id)
            .maybeSingle();
          if (tpl) {
            subject = (tpl.subject as string) || subject;
            body = (tpl.body_html as string) || (tpl.body_text as string) || body;
          }
        }
        subject = renderTokens(subject, ctx.after) as string;
        body = renderTokens(body, ctx.after) as string;
        const { error } = await supabase.from("email_messages").insert({
          owner_id: ctx.ownerId,
          direction: "outbound",
          to_emails: [to],
          subject,
          body_html: body,
          body_text: body.replace(/<[^>]+>/g, ""),
        } as never);
        if (error) throw new Error(error.message);
        return { at, ok: true, action: "send_email", detail: { to, subject, queued: true } };
      }
      case "send_whatsapp": {
        const toField = action.to_field || "phone";
        const to = (ctx.after?.[toField] as string | null) ?? null;
        if (!to) throw new Error(`sem destinatário em ${toField}`);
        const body = action.body ? (renderTokens(action.body, ctx.after) as string) : null;
        const { error } = await supabase.from("whatsapp_messages").insert({
          owner_id: ctx.ownerId,
          direction: "outbound",
          to_number: to,
          body,
          template_name: action.template_name ?? null,
          is_template: !!action.template_name,
          status: "queued",
        } as never);
        if (error) throw new Error(error.message);
        return {
          at,
          ok: true,
          action: "send_whatsapp",
          detail: { to, template: action.template_name ?? null, queued: true },
        };
      }
      case "format_data": {
        ctx.vars = ctx.vars ?? {};
        const src = action.source_field ? getField(ctx.after, action.source_field) : undefined;
        let out: unknown = src;
        try {
          switch (action.op) {
            case "upper":
              out = toStr(src).toUpperCase();
              break;
            case "lower":
              out = toStr(src).toLowerCase();
              break;
            case "trim":
              out = toStr(src).trim();
              break;
            case "template_string":
              out = renderTokens(action.template ?? "", ctx.after, ctx.vars);
              break;
            case "date_add": {
              const base = src ? new Date(String(src)) : new Date();
              if (Number.isNaN(base.getTime())) throw new Error("data inválida");
              const mult =
                action.unit === "minutes"
                  ? 60_000
                  : action.unit === "hours"
                    ? 3_600_000
                    : 86_400_000;
              out = new Date(base.getTime() + (action.amount ?? 0) * mult).toISOString();
              break;
            }
            case "date_format": {
              const d = src ? new Date(String(src)) : new Date();
              if (Number.isNaN(d.getTime())) throw new Error("data inválida");
              const fmt = action.format ?? "yyyy-MM-dd";
              const pad = (n: number, w = 2) => String(n).padStart(w, "0");
              out = fmt
                .replace(/yyyy/g, String(d.getFullYear()))
                .replace(/MM/g, pad(d.getMonth() + 1))
                .replace(/dd/g, pad(d.getDate()))
                .replace(/HH/g, pad(d.getHours()))
                .replace(/mm/g, pad(d.getMinutes()))
                .replace(/ss/g, pad(d.getSeconds()));
              break;
            }
            case "number_round": {
              const n = typeof src === "number" ? src : parseFloat(String(src));
              if (Number.isNaN(n)) throw new Error("valor não numérico");
              const p = Math.max(0, Math.floor(action.amount ?? 0));
              const factor = Math.pow(10, p);
              out = Math.round(n * factor) / factor;
              break;
            }
          }
        } catch (e) {
          throw new Error(`format_data: ${e instanceof Error ? e.message : String(e)}`);
        }
        (ctx.vars as AnyRow)[action.target_var] = out;
        return {
          at,
          ok: true,
          action: "format_data",
          detail: { op: action.op, target_var: action.target_var, value: out },
        };
      }
      case "send_slack": {
        const { data: integ } = await supabase
          .from("slack_integrations")
          .select("access_token, default_channel_id")
          .eq("owner_id", ctx.ownerId)
          .maybeSingle();
        if (!integ) throw new Error("Slack não conectado neste workspace");
        const channel = action.channel?.trim() || (integ.default_channel_id as string | null);
        if (!channel) throw new Error("Canal do Slack não informado e sem canal padrão");
        const text = renderTokens(action.text, ctx.after, ctx.vars) as string;
        const res = await fetch("https://slack.com/api/chat.postMessage", {
          method: "POST",
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            Authorization: `Bearer ${integ.access_token}`,
          },
          body: JSON.stringify({ channel, text }),
        });
        const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
        if (!res.ok || !json.ok) throw new Error(`Slack: ${json.error ?? res.status}`);
        return { at, ok: true, action: "send_slack", detail: { channel } };
      }
      case "send_teams": {
        const text = renderTokens(action.text, ctx.after, ctx.vars) as string;
        const title = action.title
          ? (renderTokens(action.title, ctx.after, ctx.vars) as string)
          : undefined;
        // Microsoft Teams Incoming Webhook aceita MessageCard simples.
        const body = title ? { title, text } : { text };
        const res = await fetch(action.webhook_url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error(`Teams respondeu ${res.status}`);
        return { at, ok: true, action: "send_teams", detail: { title } };
      }
      case "create_record": {
        const rendered: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(action.values ?? {})) {
          rendered[k] = typeof v === "string" ? renderTokens(v, ctx.after, ctx.vars) : v;
        }
        // Fallbacks contextuais: quando o workflow dispara de uma entidade e
        // cria um registro filho, preenche automaticamente a FK de origem caso
        // o usuário não a tenha informado explicitamente.
        if (action.table === "contracts") {
          if (ctx.entity === "deals" && !rendered.deal_id) {
            rendered.deal_id = ctx.entityId;
          }
          if (ctx.entity === "contracts" && !rendered.parent_contract_id) {
            rendered.parent_contract_id = ctx.entityId;
          }
        }
        const ownerId = action.owner_id?.trim() || ctx.ownerId;
        const withOwner = { ...rendered, owner_id: ownerId };
        // Tenta com owner_id; se a tabela não tiver essa coluna, refaz sem.
        let insertRes = await supabase
          .from(action.table)
          .insert(withOwner as never)
          .select("id")
          .maybeSingle();
        if (insertRes.error && /owner_id/.test(insertRes.error.message)) {
          insertRes = await supabase
            .from(action.table)
            .insert(rendered as never)
            .select("id")
            .maybeSingle();
        }
        if (insertRes.error) throw new Error(insertRes.error.message);
        return {
          at,
          ok: true,
          action: "create_record",
          detail: {
            table: action.table,
            id: (insertRes.data as { id?: string } | null)?.id ?? null,
          },
        };
      }
      case "update_record": {
        const targetId = renderTokens(action.target_id, ctx.after, ctx.vars) as string;
        if (!targetId) throw new Error("target_id vazio");
        const rendered: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(action.values ?? {})) {
          rendered[k] = typeof v === "string" ? renderTokens(v, ctx.after, ctx.vars) : v;
        }
        const { error } = await supabase
          .from(action.table)
          .update(rendered as never)
          .eq("id", targetId);
        if (error) throw new Error(error.message);
        return {
          at,
          ok: true,
          action: "update_record",
          detail: { table: action.table, id: targetId },
        };
      }
      case "delete_record": {
        const targetId = renderTokens(action.target_id, ctx.after, ctx.vars) as string;
        if (!targetId) throw new Error("target_id vazio");
        const { error } = await supabase.from(action.table).delete().eq("id", targetId);
        if (error) throw new Error(error.message);
        return {
          at,
          ok: true,
          action: "delete_record",
          detail: { table: action.table, id: targetId },
        };
      }
      default: {
        const _exhaustive: never = action;
        void _exhaustive;
        return { at, ok: false, action: "unknown", error: "Ação não suportada" };
      }
    }
  } catch (e) {
    return {
      at,
      ok: false,
      action: action.type,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

interface EventRow {
  id: string;
  owner_id: string;
  entity: WorkflowEntity;
  entity_id: string;
  event_type: string;
  before: AnyRow | null;
  after: AnyRow | null;
  resume_workflow_id?: string | null;
  resume_cursor?: number | null;
}

interface WorkflowRow {
  id: string;
  owner_id: string;
  workspace_id: string;
  entity: WorkflowEntity;
  trigger: WorkflowTrigger;
  actions: WorkflowAction[];
  goal_filters?: WorkflowCondition[] | null;
}

async function alreadyEnrolled(
  supabase: SupabaseClient,
  workflowId: string,
  entity: WorkflowEntity,
  entityId: string,
): Promise<boolean> {
  // Verifica se este workflow já rodou com sucesso para este record
  // (join workflow_runs -> workflow_events por event_id).
  const { data } = await supabase
    .from("workflow_runs")
    .select("id, workflow_events!inner(entity, entity_id)")
    .eq("workflow_id", workflowId)
    .eq("status", "success")
    .eq("workflow_events.entity", entity)
    .eq("workflow_events.entity_id", entityId)
    .limit(1);
  return (data ?? []).length > 0;
}

export async function processEvent(supabase: SupabaseClient, event: EventRow) {
  // Caso 1: retomada (delay) → executa apenas o workflow indicado a partir do cursor.
  if (event.resume_workflow_id && typeof event.resume_cursor === "number") {
    const { data: wf } = await supabase
      .from("workflows")
      .select("id, owner_id, entity, trigger, actions, goal_filters")
      .eq("id", event.resume_workflow_id)
      .maybeSingle();
    if (wf) {
      const wfr = wf as WorkflowRow;
      const hydratedAfter = await hydrateTriggerAssociations(
        supabase,
        event.entity,
        event.after,
        JSON.stringify({ t: wfr.trigger, a: wfr.actions }),
      );

      const { data: run } = await supabase
        .from("workflow_runs")
        .insert({
          owner_id: wfr.owner_id,
          workflow_id: wfr.id,
          event_id: event.id,
          entity: event.entity,
          entity_id: event.entity_id,
          status: "running",
          started_at: new Date().toISOString(),
        } as never)
        .select("id")
        .single();
      if (run) {
        const res = await runActions(
          supabase,
          wfr.actions ?? [],
          {
            entity: event.entity,
            entityId: event.entity_id,
            ownerId: event.owner_id,
            workspaceId: wfr.workspace_id,
            after: hydratedAfter,
            before: event.before,
            workflowId: wfr.id,
            runId: run.id as string,
          },
          event.resume_cursor,
        );
        await finishRun(supabase, run.id, res, event, wfr.id);
      }
    }
    await supabase
      .from("workflow_events")
      .update({ processed_at: new Date().toISOString() })
      .eq("id", event.id);
    return;
  }

  // Caso 2: evento normal (created/updated/stage_changed).
  const { data: workflows } = await supabase
    .from("workflows")
    .select("id, owner_id, entity, trigger, actions, goal_filters")
    .eq("owner_id", event.owner_id)
    .eq("entity", event.entity)
    .eq("enabled", true)
    .eq("status", "published");

  for (const wf of (workflows ?? []) as WorkflowRow[]) {
    const trig = wf.trigger ?? ({} as WorkflowTrigger);
    if (trig.event && trig.event !== event.event_type) continue;

    // Hidrata associações do gatilho (empresa, contato, negócio…) antes de
    // avaliar condições e executar ações, para resolver `{{company.name}}`.
    const hydratedAfter = await hydrateTriggerAssociations(
      supabase,
      event.entity,
      event.after,
      JSON.stringify({ t: trig, a: wf.actions }),
    );

    const filters = trig.filters ?? [];
    const passes = evalConditions(filters, hydratedAfter, event.before);
    if (!passes) continue;

    // Fase 3 — critérios de meta: se todos passam, o registro já atingiu o objetivo
    // e é removido do workflow (sem novas execuções).
    const goalFilters = trig.goal_filters ?? wf.goal_filters ?? [];
    if (goalFilters.length > 0 && evalConditions(goalFilters, hydratedAfter, event.before)) {
      continue;
    }

    // Re-enrollment: se desabilitado e já existe run bem-sucedido, pula.
    // Se habilitado, só reprocessa quando o evento atual está na lista permitida.
    const reenroll = trig.reenroll;
    if (!reenroll?.enabled) {
      const enrolled = await alreadyEnrolled(supabase, wf.id, event.entity, event.entity_id);
      if (enrolled) continue;
    } else if (
      reenroll.events &&
      reenroll.events.length > 0 &&
      !reenroll.events.includes(event.event_type as WorkflowTrigger["event"])
    ) {
      const enrolled = await alreadyEnrolled(supabase, wf.id, event.entity, event.entity_id);
      if (enrolled) continue;
    }

    // dedupe via unique (workflow_id, event_id)
    const { data: run, error: insErr } = await supabase
      .from("workflow_runs")
      .insert({
        owner_id: wf.owner_id,
        workflow_id: wf.id,
        event_id: event.id,
        entity: event.entity,
        entity_id: event.entity_id,
        status: "running",
        started_at: new Date().toISOString(),
      } as never)
      .select("id")
      .single();
    if (insErr || !run) continue;

    const res = await runActions(supabase, wf.actions ?? [], {
      entity: event.entity,
      entityId: event.entity_id,
      ownerId: event.owner_id,
      workspaceId: wf.workspace_id,
      after: hydratedAfter,
      before: event.before,
      workflowId: wf.id,
      runId: run.id as string,
    });
    await finishRun(supabase, run.id, res, event, wf.id);
  }

  await supabase
    .from("workflow_events")
    .update({ processed_at: new Date().toISOString() })
    .eq("id", event.id);
}

async function finishRun(
  supabase: SupabaseClient,
  runId: string,
  res: RunResult,
  event: EventRow,
  workflowId?: string,
) {
  // Se aguardando aprovação, deixa run em estado waiting (será retomado por decideApproval).
  if (res.waitingApproval) {
    await supabase
      .from("workflow_runs")
      .update({
        status: "waiting_approval" as never,
        log: res.log,
        finished_at: null,
      })
      .eq("id", runId);
    return;
  }
  // Se suspenso por delay, agenda novo evento de retomada.
  if (res.suspendedAt && workflowId) {
    await supabase.from("workflow_events").insert({
      owner_id: event.owner_id,
      entity: event.entity,
      entity_id: event.entity_id,
      event_type: event.event_type,
      before: event.before,
      after: event.after,
      run_at: res.suspendedAt.runAtIso,
      resume_workflow_id: workflowId,
      resume_cursor: res.suspendedAt.resumeCursor,
    } as never);
    await supabase
      .from("workflow_runs")
      .update({
        status: "success",
        log: res.log,
        finished_at: new Date().toISOString(),
      })
      .eq("id", runId);
    return;
  }
  await supabase
    .from("workflow_runs")
    .update({
      status: res.hadError ? "error" : "success",
      log: res.log,
      error: res.hadError ? (res.log[res.log.length - 1]?.error ?? null) : null,
      finished_at: new Date().toISOString(),
    })
    .eq("id", runId);
}

export async function tickWorkflows(supabase: SupabaseClient, limit = 50) {
  const nowIso = new Date().toISOString();
  const { data: events, error } = await supabase
    .from("workflow_events")
    .select(
      "id, owner_id, entity, entity_id, event_type, before, after, resume_workflow_id, resume_cursor",
    )
    .is("processed_at", null)
    .lte("run_at", nowIso)
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) throw new Error(error.message);

  const results: Array<{ id: string; ok: boolean; error?: string }> = [];
  for (const ev of (events ?? []) as EventRow[]) {
    try {
      await processEvent(supabase, ev);
      results.push({ id: ev.id, ok: true });
    } catch (e) {
      results.push({ id: ev.id, ok: false, error: e instanceof Error ? e.message : String(e) });
    }
  }
  return { processed: results.length, results };
}

// ============================================================================
// Fase 5c — Triggers baseados em tempo.
// Varre workflows com trigger.time_based e enfileira eventos sintéticos
// para registros que atendem à condição temporal. Usa workflow_time_cursors
// para não redisparar.
// ============================================================================
export async function tickTimeTriggers(supabase: SupabaseClient, limitPerWf = 100) {
  const { data: workflows, error } = await supabase
    .from("workflows")
    .select("id, owner_id, entity, trigger")
    .eq("enabled", true)
    .eq("status", "published");
  if (error) throw new Error(error.message);

  let enqueued = 0;
  const wfResults: Array<{ workflow_id: string; matched: number; enqueued: number }> = [];
  for (const wf of (workflows ?? []) as Array<{
    id: string;
    owner_id: string;
    entity: WorkflowEntity;
    trigger: WorkflowTrigger | null;
  }>) {
    const trig = wf.trigger ?? ({} as WorkflowTrigger);
    const tb = trig.time_based;
    if (!tb) continue;
    const mult = tb.unit === "minutes" ? 60_000 : tb.unit === "hours" ? 3_600_000 : 86_400_000;
    const thresholdMs = Date.now() - tb.amount * mult;
    const thresholdIso = new Date(thresholdMs).toISOString();

    // Campo de referência por kind
    const field =
      tb.kind === "no_activity_for"
        ? "updated_at"
        : tb.kind === "stuck_in_stage_for"
          ? "moved_at"
          : (tb.field ?? "updated_at");

    const q = supabase
      .from(wf.entity as never)
      .select("*")
      .eq("owner_id", wf.owner_id)
      .lte(field, thresholdIso)
      .limit(limitPerWf);
    const { data: records, error: recErr } = await q;
    if (recErr) {
      wfResults.push({ workflow_id: wf.id, matched: 0, enqueued: 0 });
      continue;
    }

    let localEnqueued = 0;
    const rows = (records ?? []) as Array<Record<string, unknown>>;
    for (const rec of rows) {
      // Aplica filtros do trigger + do time_based
      const filters = [...(trig.filters ?? []), ...(tb.filters ?? [])];
      if (!evalConditions(filters, rec, null)) continue;

      // Confere cursor
      const { data: cursor } = await supabase
        .from("workflow_time_cursors")
        .select("last_fired_at")
        .eq("workflow_id", wf.id)
        .eq("entity_id", rec.id as string)
        .maybeSingle();
      const refIso = rec[field] as string | null | undefined;
      if (
        cursor &&
        refIso &&
        new Date(cursor.last_fired_at).getTime() >= new Date(refIso).getTime()
      ) {
        continue; // já disparou depois da última mudança do campo de referência
      }

      const { error: evErr } = await supabase.from("workflow_events").insert({
        owner_id: wf.owner_id,
        entity: wf.entity,
        entity_id: rec.id as string,
        event_type: trig.event ?? "updated",
        after: rec as never,
        before: null,
      } as never);
      if (evErr) continue;

      await supabase.from("workflow_time_cursors").upsert({
        workflow_id: wf.id,
        entity_id: rec.id as string,
        owner_id: wf.owner_id,
        last_fired_at: new Date().toISOString(),
      } as never);
      localEnqueued += 1;
      enqueued += 1;
    }
    wfResults.push({ workflow_id: wf.id, matched: rows.length, enqueued: localEnqueued });
  }
  // Processa imediatamente os eventos gerados
  const tickRes =
    enqueued > 0 ? await tickWorkflows(supabase, Math.min(enqueued, 200)) : { processed: 0 };
  return { enqueued, processed: tickRes.processed, workflows: wfResults };
}
