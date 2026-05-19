// Workflow engine: executa eventos pendentes da fila workflow_events.
// Roda no servidor (chamado pelo endpoint /api/public/hooks/workflows-tick).
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  WorkflowAction,
  WorkflowEntity,
  WorkflowFilter,
  WorkflowTrigger,
} from "./types";

type AnyRow = Record<string, unknown>;
type LogStep = { at: string; ok: boolean; action: string; detail?: unknown; error?: string };

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

function renderTokens(input: unknown, after: AnyRow | null): unknown {
  if (typeof input !== "string") return input;
  return input.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_m, key) => toStr(getField(after, String(key))));
}

function evalFilter(f: WorkflowFilter, after: AnyRow | null, before: AnyRow | null): boolean {
  const v = getField(after, f.field);
  switch (f.op) {
    case "eq": return v === f.value;
    case "neq": return v !== f.value;
    case "in": {
      const list = Array.isArray(f.value)
        ? f.value
        : String(f.value ?? "").split(",").map((s) => s.trim());
      return list.includes(v as never);
    }
    case "contains":
      return typeof v === "string" && v.toLowerCase().includes(String(f.value ?? "").toLowerCase());
    case "gt": return typeof v === "number" && typeof f.value === "number" && v > f.value;
    case "lt": return typeof v === "number" && typeof f.value === "number" && v < f.value;
    case "changed_to": {
      const prev = getField(before, f.field);
      return v === f.value && prev !== f.value;
    }
    case "is_empty": return v == null || v === "";
    case "is_not_empty": return v != null && v !== "";
    default: return false;
  }
}

async function runAction(
  supabase: SupabaseClient,
  action: WorkflowAction,
  ctx: { entity: WorkflowEntity; entityId: string; ownerId: string; after: AnyRow | null },
): Promise<LogStep> {
  const at = new Date().toISOString();
  try {
    switch (action.type) {
      case "set_field": {
        const value = renderTokens(action.value, ctx.after);
        const { error } = await supabase.from(ctx.entity).update({ [action.field]: value }).eq("id", ctx.entityId);
        if (error) throw new Error(error.message);
        return { at, ok: true, action: "set_field", detail: { field: action.field, value } };
      }
      case "assign_to": {
        const { error } = await supabase.from(ctx.entity).update({ owner_id: action.user_id }).eq("id", ctx.entityId);
        if (error) throw new Error(error.message);
        return { at, ok: true, action: "assign_to", detail: { user_id: action.user_id } };
      }
      case "create_activity": {
        const subject = renderTokens(action.subject, ctx.after) as string;
        const body = action.body ? (renderTokens(action.body, ctx.after) as string) : null;
        const due = action.due_in_days
          ? new Date(Date.now() + action.due_in_days * 86_400_000).toISOString()
          : null;
        const relCol =
          ctx.entity === "leads" ? "related_lead_id"
          : ctx.entity === "contacts" ? "related_contact_id"
          : ctx.entity === "companies" ? "related_company_id"
          : "related_deal_id";
        const { error } = await supabase.from("activities").insert({
          owner_id: ctx.ownerId,
          type: action.activity_type ?? "task",
          subject,
          body,
          due_date: due,
          [relCol]: ctx.entityId,
        });
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
        return { at, ok: true, action: "add_to_sequence", detail: { sequence_id: action.sequence_id } };
      }
      case "send_notification": {
        // notifications table not present yet — log only.
        return {
          at, ok: true, action: "send_notification",
          detail: {
            note: "Tabela 'notifications' não existe ainda; ação apenas registrada.",
            title: renderTokens(action.title, ctx.after),
            body: action.body ? renderTokens(action.body, ctx.after) : null,
          },
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
    }
  } catch (e) {
    return { at, ok: false, action: action.type, error: e instanceof Error ? e.message : String(e) };
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
}

interface WorkflowRow {
  id: string;
  owner_id: string;
  entity: WorkflowEntity;
  trigger: WorkflowTrigger;
  actions: WorkflowAction[];
}

export async function processEvent(supabase: SupabaseClient, event: EventRow) {
  const { data: workflows } = await supabase
    .from("workflows")
    .select("id, owner_id, entity, trigger, actions")
    .eq("owner_id", event.owner_id)
    .eq("entity", event.entity)
    .eq("enabled", true);

  for (const wf of (workflows ?? []) as WorkflowRow[]) {
    const trig = wf.trigger ?? ({} as WorkflowTrigger);
    if (trig.event && trig.event !== event.event_type) continue;
    const filters = trig.filters ?? [];
    const passes = filters.every((f) => evalFilter(f, event.after, event.before));
    if (!passes) continue;

    // dedupe via unique (workflow_id, event_id)
    const { data: run, error: insErr } = await supabase
      .from("workflow_runs")
      .insert({
        owner_id: wf.owner_id,
        workflow_id: wf.id,
        event_id: event.id,
        status: "running",
        started_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (insErr || !run) continue; // já processado

    const log: LogStep[] = [];
    let hadError = false;
    for (const action of wf.actions ?? []) {
      const step = await runAction(supabase, action, {
        entity: event.entity,
        entityId: event.entity_id,
        ownerId: event.owner_id,
        after: event.after,
      });
      log.push(step);
      if (!step.ok) { hadError = true; break; }
    }

    await supabase
      .from("workflow_runs")
      .update({
        status: hadError ? "error" : "success",
        log,
        error: hadError ? log[log.length - 1]?.error ?? null : null,
        finished_at: new Date().toISOString(),
      })
      .eq("id", run.id);
  }

  await supabase
    .from("workflow_events")
    .update({ processed_at: new Date().toISOString() })
    .eq("id", event.id);
}

export async function tickWorkflows(supabase: SupabaseClient, limit = 50) {
  const { data: events, error } = await supabase
    .from("workflow_events")
    .select("id, owner_id, entity, entity_id, event_type, before, after")
    .is("processed_at", null)
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
