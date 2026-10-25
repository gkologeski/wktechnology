import { hubspotSourceClient } from "@/lib/access-control/hubspot-source-client.server";
import { assertSalesWorker } from "@/lib/access-control/sales-worker.server";
import { workspaceOfSource } from "@/lib/workspace-source.server";
// Event Bus v2 — emissão de eventos de domínio cross-módulo.
// Use em qualquer ponto server-side para publicar acontecimentos relevantes
// (ex.: `crm.deal.won`, `ats.candidate.hired`, `people.onboarding_started`).
//
// Após inserir em `domain_events`, o bus resolve `workflow_subscriptions`
// (best-effort) e executa as ações configuradas — hoje: create_ticket.
import type { SupabaseClient } from "@supabase/supabase-js";

export type EmitEventInput = {
  ownerId: string;
  eventName: string;
  source?: string;
  entityType?: string;
  entityId?: string | null;
  payload?: Record<string, unknown>;
  /** Chave de deduplicação por owner (ex.: `deal.won:<dealId>`). */
  dedupeKey?: string;
  /** Quando o evento aconteceu (default: now()). */
  occurredAt?: string;
};

type SubscriptionRow = {
  id: string;
  owner_id: string;
  event_pattern: string;
  action: Record<string, unknown>;
  enabled: boolean;
};

type RenderCtx = Record<string, unknown>;

function toStr(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  return JSON.stringify(v);
}

function getPath(obj: RenderCtx, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, k) => {
    if (acc && typeof acc === "object") return (acc as RenderCtx)[k];
    return undefined;
  }, obj);
}

function renderTokens(input: unknown, ctx: RenderCtx): unknown {
  if (typeof input !== "string") return input;
  return input.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_m, key) => toStr(getPath(ctx, String(key))));
}

/** Converte glob (`*`) em RegExp segura. */
function globToRegExp(pattern: string): RegExp {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
  return new RegExp("^" + escaped + "$");
}

async function executeSubscriptionAction(
  supabase: SupabaseClient,
  sub: SubscriptionRow,
  event: EmitEventInput,
  workspaceId: string,
): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const entities: Record<string, string> = {
    lead: "leads",
    leads: "leads",
    contact: "contacts",
    contacts: "contacts",
    company: "companies",
    companies: "companies",
    deal: "deals",
    deals: "deals",
    ticket: "tickets",
    tickets: "tickets",
    candidate: "ats_candidates",
    application: "ats_applications",
    job: "ats_jobs",
    interview: "ats_interviews",
    person: "people",
    people: "people",
    contract: "contracts",
    project: "projects",
    ats_applications: "ats_applications",
    ats_candidates: "ats_candidates",
    ats_jobs: "ats_jobs",
    ats_interviews: "ats_interviews",
    contracts: "contracts",
    projects: "projects",
  };
  const table = event.entityType ? entities[event.entityType] : undefined;
  if (!table || !event.entityId) throw new Error("Evento sem registro de origem verificável.");
  const ref = ["leads", "contacts", "companies", "deals", "tickets"].includes(table)
    ? { table, id: event.entityId }
    : { record_table: table, id: event.entityId };
  await assertSalesWorker(supabaseAdmin, "workflow_subscriptions", sub.id, [ref]);
  supabase = hubspotSourceClient(supabaseAdmin, { table: "workflow_subscriptions", id: sub.id });
  const action = sub.action ?? {};
  const type = String((action as { type?: string }).type ?? "");
  const ctx: RenderCtx = {
    event_name: event.eventName,
    entity_type: event.entityType ?? null,
    entity_id: event.entityId ?? null,
    payload: event.payload ?? {},
  };

  if (type === "create_ticket") {
    const subject = String(
      renderTokens((action as { subject?: unknown }).subject, ctx) ?? "",
    ).trim();
    if (!subject) return;
    const description = renderTokens((action as { description?: unknown }).description, ctx) as
      | string
      | null
      | undefined;
    const priority = (action as { priority?: string }).priority ?? "medium";
    let pipelineId = (action as { pipeline_id?: string | null }).pipeline_id ?? null;
    if (!pipelineId) {
      const { data: pipe } = await supabase
        .from("pipelines")
        .select("id")
        .eq("workspace_id", workspaceId)
        .eq("entity", "tickets")
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (pipe) pipelineId = (pipe as { id: string }).id;
    }
    if (pipelineId && (await workspaceOfSource(supabase, "pipelines", pipelineId)) !== workspaceId)
      throw new Error("Funil fora da empresa do evento.");
    const row: Record<string, unknown> = {
      workspace_id: workspaceId,
      owner_id: sub.owner_id,
      subject,
      description: description ? String(description) : null,
      priority,
      pipeline_id: pipelineId,
      assignee_id: (action as { assignee_id?: string | null }).assignee_id ?? null,
    };
    const { error } = await supabase.from("tickets").insert(row as never);
    if (error) throw new Error(error.message);
    return;
  }

  // outros tipos podem ser adicionados no futuro
}

async function fanoutSubscriptions(
  supabase: SupabaseClient,
  event: EmitEventInput,
  workspaceId: string,
): Promise<void> {
  const { data, error } = await supabase
    .from("workflow_subscriptions")
    .select("id,owner_id,event_pattern,action,enabled")
    .eq("workspace_id", workspaceId)
    .eq("enabled", true);
  if (error || !data) return;
  const subs = (data as SubscriptionRow[]).filter((s) => {
    if (s.event_pattern === event.eventName) return true;
    if (!s.event_pattern.includes("*")) return false;
    return globToRegExp(s.event_pattern).test(event.eventName);
  });
  for (const sub of subs) {
    try {
      await executeSubscriptionAction(supabase, sub, event, workspaceId);
    } catch (err) {
      console.error("[emitEvent] subscription action failed", {
        subscription_id: sub.id,
        event: event.eventName,
        error: (err as Error).message,
      });
    }
  }
}

export async function emitEvent(
  supabase: SupabaseClient,
  input: EmitEventInput,
): Promise<{ id: string | null; deduped: boolean }> {
  const row = {
    owner_id: input.ownerId,
    event_name: input.eventName,
    source: input.source ?? "system",
    entity_type: input.entityType ?? null,
    entity_id: input.entityId ?? null,
    payload: input.payload ?? {},
    dedupe_key: input.dedupeKey ?? null,
    occurred_at: input.occurredAt ?? new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("domain_events")
    .insert(row as never)
    .select("id")
    .maybeSingle();

  if (error) {
    if ((error as { code?: string }).code === "23505") {
      return { id: null, deduped: true };
    }
    console.error("[emitEvent] failed", { eventName: input.eventName, error: error.message });
    throw new Error(error.message);
  }

  // Fan-out best-effort para workflow_subscriptions.
  const workspaceId = await workspaceOfSource(supabase, "domain_events", data!.id as string);
  await fanoutSubscriptions(supabase, input, workspaceId).catch((err) => {
    console.error("[emitEvent] fanout failed", {
      event: input.eventName,
      error: (err as Error).message,
    });
  });

  return { id: (data?.id as string | undefined) ?? null, deduped: false };
}
