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
): Promise<void> {
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
        .eq("owner_id", sub.owner_id)
        .eq("entity", "tickets")
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (pipe) pipelineId = (pipe as { id: string }).id;
    }
    const row: Record<string, unknown> = {
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

async function fanoutSubscriptions(supabase: SupabaseClient, event: EmitEventInput): Promise<void> {
  const { data, error } = await supabase
    .from("workflow_subscriptions")
    .select("id,owner_id,event_pattern,action,enabled")
    .eq("owner_id", event.ownerId)
    .eq("enabled", true);
  if (error || !data) return;
  const subs = (data as SubscriptionRow[]).filter((s) => {
    if (s.event_pattern === event.eventName) return true;
    if (!s.event_pattern.includes("*")) return false;
    return globToRegExp(s.event_pattern).test(event.eventName);
  });
  for (const sub of subs) {
    try {
      await executeSubscriptionAction(supabase, sub, event);
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
  await fanoutSubscriptions(supabase, input).catch((err) => {
    console.error("[emitEvent] fanout failed", {
      event: input.eventName,
      error: (err as Error).message,
    });
  });

  return { id: (data?.id as string | undefined) ?? null, deduped: false };
}
