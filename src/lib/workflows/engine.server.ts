// Workflow engine: executa eventos pendentes da fila workflow_events.
// Roda no servidor (chamado pelo endpoint /api/public/hooks/workflows-tick).
import type { SupabaseClient } from "@supabase/supabase-js";
import { applyRotation } from "@/lib/rotation/engine.server";
import type { WorkflowAction, WorkflowEntity, WorkflowFilter, WorkflowTrigger } from "./types";

type AnyRow = Record<string, unknown>;
type LogStep = { at: string; ok: boolean; action: string; detail?: unknown; error?: string };

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
  if (!obj) return undefined;
  return path.split(".").reduce<unknown>((acc, k) => {
    if (acc && typeof acc === "object") return (acc as AnyRow)[k];
    return undefined;
  }, obj);
}

function toStr(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  return JSON.stringify(v);
}

function renderTokens(input: unknown, after: AnyRow | null, vars?: AnyRow): unknown {
  if (typeof input !== "string") return input;
  return input.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_m, key) => {
    const path = String(key);
    if (path.startsWith("vars.")) return toStr(getField(vars ?? null, path.slice(5)));
    return toStr(getField(after, path));
  });
}

function evalFilter(f: WorkflowFilter, after: AnyRow | null, before: AnyRow | null): boolean {
  const v = getField(after, f.field);
  switch (f.op) {
    case "eq":
      return v === f.value;
    case "neq":
      return v !== f.value;
    case "in": {
      const list = Array.isArray(f.value)
        ? f.value
        : String(f.value ?? "")
            .split(",")
            .map((s) => s.trim());
      return list.includes(v as never);
    }
    case "contains":
      return typeof v === "string" && v.toLowerCase().includes(String(f.value ?? "").toLowerCase());
    case "gt":
      return typeof v === "number" && typeof f.value === "number" && v > f.value;
    case "lt":
      return typeof v === "number" && typeof f.value === "number" && v < f.value;
    case "changed_to": {
      const prev = getField(before, f.field);
      return v === f.value && prev !== f.value;
    }
    case "is_empty":
      return v == null || v === "";
    case "is_not_empty":
      return v != null && v !== "";
    default:
      return false;
  }
}

interface RunCtx {
  entity: WorkflowEntity;
  entityId: string;
  ownerId: string;
  after: AnyRow | null;
  before: AnyRow | null;
  /** Fase 5 — variáveis mutáveis do run, populadas por format_data e lidas via {{vars.X}}. */
  vars?: AnyRow;
}

interface RunResult {
  log: LogStep[];
  hadError: boolean;
  // Se != null, execução foi suspensa para retomar depois desse índice na lista de ações.
  suspendedAt?: { runAtIso: string; resumeCursor: number };
}

async function runActions(
  supabase: SupabaseClient,
  actions: WorkflowAction[],
  ctx: RunCtx,
  startIndex = 0,
): Promise<RunResult> {
  const log: LogStep[] = [];
  for (let i = startIndex; i < actions.length; i++) {
    const action = actions[i];

    // Delay: agenda retomada e para aqui.
    if (action.type === "delay") {
      const mult =
        action.unit === "minutes" ? 60_000 : action.unit === "hours" ? 3_600_000 : 86_400_000;
      const ms = Math.max(1, action.amount) * mult;
      const runAtIso = new Date(Date.now() + ms).toISOString();
      log.push({
        at: new Date().toISOString(),
        ok: true,
        action: "delay",
        detail: { amount: action.amount, unit: action.unit, resume_at: runAtIso },
      });
      return { log, hadError: false, suspendedAt: { runAtIso, resumeCursor: i + 1 } };
    }

    // Branch: filtra e executa then/else recursivamente.
    if (action.type === "branch_if") {
      const filters = action.filters ?? [];
      const passes = filters.length === 0 || filters.every((f) => evalFilter(f, ctx.after, ctx.before));
      const branchName = passes ? "then" : "else";
      const branchActions = passes ? action.then ?? [] : action.else ?? [];
      log.push({
        at: new Date().toISOString(),
        ok: true,
        action: "branch_if",
        detail: { branch: branchName, filters },
      });
      const branchRes = await runActions(supabase, branchActions, ctx);
      log.push(...branchRes.log);
      if (branchRes.hadError) return { log, hadError: true };
      if (branchRes.suspendedAt) {
        // Delays dentro de branches não são retomáveis nesta versão — reportamos e paramos.
        log.push({
          at: new Date().toISOString(),
          ok: false,
          action: "delay",
          error: "Delays dentro de ramificações ainda não são retomáveis",
        });
        return { log, hadError: true };
      }
      continue;
    }

    // Switch por valor: escolhe primeiro case cujo value bate, ou default.
    if (action.type === "switch_by_value") {
      const v = getField(ctx.after, action.field);
      const matched = action.cases.find((c) => c.value === v);
      const branchActions = matched ? matched.actions : action.default ?? [];
      log.push({
        at: new Date().toISOString(),
        ok: true,
        action: "switch_by_value",
        detail: {
          field: action.field,
          value: v,
          matched: matched ? (matched.label ?? String(matched.value)) : "default",
        },
      });
      const branchRes = await runActions(supabase, branchActions, ctx);
      log.push(...branchRes.log);
      if (branchRes.hadError) return { log, hadError: true };
      if (branchRes.suspendedAt) {
        log.push({
          at: new Date().toISOString(),
          ok: false,
          action: "delay",
          error: "Delays dentro de switch_by_value ainda não são retomáveis",
        });
        return { log, hadError: true };
      }
      continue;
    }

    // Ramificação múltipla: executa 1ª branch cujos filtros passam, ou else.
    if (action.type === "branch_multi") {
      const matched = action.branches.find((b) =>
        (b.filters ?? []).every((f) => evalFilter(f, ctx.after, ctx.before)),
      );
      const branchActions = matched ? matched.actions : action.else ?? [];
      log.push({
        at: new Date().toISOString(),
        ok: true,
        action: "branch_multi",
        detail: { matched: matched ? (matched.label ?? "branch") : "else" },
      });
      const branchRes = await runActions(supabase, branchActions, ctx);
      log.push(...branchRes.log);
      if (branchRes.hadError) return { log, hadError: true };
      if (branchRes.suspendedAt) {
        log.push({
          at: new Date().toISOString(),
          ok: false,
          action: "delay",
          error: "Delays dentro de branch_multi ainda não são retomáveis",
        });
        return { log, hadError: true };
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
        return { log, hadError: true };
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
      return { log, hadError: false, suspendedAt: { runAtIso, resumeCursor: i + 1 } };
    }

    const step = await runAction(supabase, action, ctx);
    log.push(step);
    if (!step.ok) return { log, hadError: true };
  }
  return { log, hadError: false };
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
        return { at, ok: true, action: "send_notification", detail: { title, user_id: targetUserId } };
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
        const title = (renderTokens(action.title, ctx.after) as string) ||
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
            .insert({ owner_id: ctx.ownerId, name: "Pipeline padrão", is_default: true, stages: [] } as never)
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
              company_id:
                (((after as AnyRow).company_id as string) ??
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
          ? ((renderTokens(action.email, ctx.after) as string) || null)
          : null;
        const phone = action.phone
          ? ((renderTokens(action.phone, ctx.after) as string) || null)
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
        const row: Record<string, unknown> = {
          owner_id: owner,
          status: "new",
          first_name: first,
          last_name: action.last_name ? (renderTokens(action.last_name, ctx.after) as string) || null : null,
          email: action.email ? (renderTokens(action.email, ctx.after) as string) || null : null,
          phone: action.phone ? (renderTokens(action.phone, ctx.after) as string) || null : null,
          company_name: action.company_name ? (renderTokens(action.company_name, ctx.after) as string) || null : null,
          source: action.source ? (renderTokens(action.source, ctx.after) as string) || null : "workflow",
        };
        const { data, error } = await supabase.from("leads").insert(row as never).select("id").single();
        if (error) throw new Error(error.message);
        return { at, ok: true, action: "create_lead", detail: { id: data.id, first_name: first } };
      }
      case "create_contact": {
        const first = (renderTokens(action.first_name, ctx.after) as string).trim();
        if (!first) throw new Error("first_name obrigatório");
        const owner = action.owner_id?.trim() || ctx.ownerId;
        const row: Record<string, unknown> = {
          owner_id: owner,
          first_name: first,
          last_name: action.last_name ? (renderTokens(action.last_name, ctx.after) as string) || null : null,
          email: action.email ? (renderTokens(action.email, ctx.after) as string) || null : null,
          phone: action.phone ? (renderTokens(action.phone, ctx.after) as string) || null : null,
          job_title: action.job_title ? (renderTokens(action.job_title, ctx.after) as string) || null : null,
          company_name: action.company_name ? (renderTokens(action.company_name, ctx.after) as string) || null : null,
        };
        const { data, error } = await supabase.from("contacts").insert(row as never).select("id").single();
        if (error) throw new Error(error.message);
        return { at, ok: true, action: "create_contact", detail: { id: data.id, first_name: first } };
      }
      case "create_company": {
        const name = (renderTokens(action.name, ctx.after) as string).trim();
        if (!name) throw new Error("name obrigatório");
        const owner = action.owner_id?.trim() || ctx.ownerId;
        const row: Record<string, unknown> = {
          owner_id: owner,
          name,
          domain: action.domain ? (renderTokens(action.domain, ctx.after) as string) || null : null,
          industry: action.industry ? (renderTokens(action.industry, ctx.after) as string) || null : null,
        };
        const { data, error } = await supabase.from("companies").insert(row as never).select("id").single();
        if (error) throw new Error(error.message);
        return { at, ok: true, action: "create_company", detail: { id: data.id, name } };
      }
      case "create_deal": {
        const name = (renderTokens(action.name, ctx.after) as string).trim();
        if (!name) throw new Error("name obrigatório");
        const owner = action.owner_id?.trim() || ctx.ownerId;
        let pipelineId = action.pipeline_id ?? null;
        let stageId = action.stage_id ?? null;
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
        const row: Record<string, unknown> = {
          owner_id: owner,
          name,
          value: typeof action.value === "number" ? action.value : null,
          currency: action.currency ?? "BRL",
          pipeline_id: pipelineId,
          stage_id: stageId,
        };
        // Associação automática quando disparado por lead/contact/company
        if (ctx.entity === "contacts") row.contact_id = ctx.entityId;
        else if (ctx.entity === "companies") row.company_id = ctx.entityId;
        const { data, error } = await supabase.from("deals").insert(row as never).select("id").single();
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
        const row: Record<string, unknown> = {
          owner_id: ctx.ownerId,
          subject,
          description: action.description
            ? (renderTokens(action.description, ctx.after) as string) || null
            : null,
          priority: action.priority ?? "normal",
          pipeline_id: pipelineId,
          assignee_id: action.assignee_id ?? null,
        };
        if (ctx.entity === "contacts") row.contact_id = ctx.entityId;
        else if (ctx.entity === "companies") row.company_id = ctx.entityId;
        else if (ctx.entity === "deals") row.deal_id = ctx.entityId;
        const { data, error } = await supabase.from("tickets").insert(row as never).select("id").single();
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
        const baseRow: Record<string, unknown> = {
          owner_id: action.assignee_id?.trim() || ctx.ownerId,
          type: "task",
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
          detail: { from: `${assoc.target_table}.${action.source_field}`, target: action.target_field, value },
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
        return { at, ok: true, action: "associate_records", detail: { [assoc.fk_column]: targetId } };
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
        return { at, ok: true, action: "disassociate_records", detail: { [assoc.fk_column]: null } };
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
        return { at, ok: true, action: "increment_field", detail: { field: action.field, from: current, to: next } };
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
  entity: WorkflowEntity;
  trigger: WorkflowTrigger;
  actions: WorkflowAction[];
  goal_filters?: WorkflowFilter[] | null;
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
            after: event.after,
            before: event.before,
          },
          event.resume_cursor,
        );
        await finishRun(supabase, run.id, res, event);
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
    const filters = trig.filters ?? [];
    const passes = filters.every((f) => evalFilter(f, event.after, event.before));
    if (!passes) continue;

    // Fase 3 — critérios de meta: se todos passam, o registro já atingiu o objetivo
    // e é removido do workflow (sem novas execuções).
    const goalFilters = trig.goal_filters ?? wf.goal_filters ?? [];
    if (
      goalFilters.length > 0 &&
      goalFilters.every((f) => evalFilter(f, event.after, event.before))
    ) {
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
      after: event.after,
      before: event.before,
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
