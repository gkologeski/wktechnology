// Server functions para webhooks de saída
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { randomBytes } from "crypto";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { runWebhookDispatch } from "@/lib/webhooks/dispatcher.server";
import { assertPermission, getActiveWorkspaceId } from "@/lib/access-control/enforce.server";
import { resolveActiveWorkspace } from "@/lib/active-workspace.server";

const WEBHOOK_MANAGE = "system.webhooks.manage.workspace";

export const WEBHOOK_EVENTS = [
  "lead.created",
  "lead.updated",
  "lead.stage_changed",
  "contact.created",
  "contact.updated",
  "deal.created",
  "deal.updated",
  "deal.stage_changed",
  "ticket.created",
  "ticket.updated",
  // ATS — Onda 7.5
  "ats.job.posted",
  "ats.job.unposted",
  "ats.candidate.sourced",
  "ats.referral.submitted",
  "ats.assessment.invited",
  "ats.assessment.completed",
  "ats.background_check.started",
  "ats.background_check.completed",
  "ats.interview.scheduled",
  "ats.interview.completed",
  "ats.offer.approved",
  "ats.offer.signed",
  "ats.candidate.hired",
  "ats.hire.handed_off",
  "ats.quality_of_hire.recorded",
  "ats.dsar.requested",
  "ats.dsar.fulfilled",
  "ats.consent.granted",
  "ats.consent.revoked",
] as const;

export const listWebhooks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    const { data } = await supabase
      .from("outbound_webhooks")
      .select("id, name, url, events, active, created_at")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false });
    return { hooks: data ?? [] };
  });

export const upsertWebhook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: { id?: string; name: string; url: string; events: string[]; active?: boolean }) =>
      z
        .object({
          id: z.string().uuid().optional(),
          name: z.string().min(1).max(120),
          url: z.string().url(),
          events: z.array(z.string()).min(1),
          active: z.boolean().optional(),
        })
        .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    const ws = await getActiveWorkspaceId(supabase, userId);
    await assertPermission(supabase, userId, ws, WEBHOOK_MANAGE);
    if (data.id) {
      const { error } = await supabase
        .from("outbound_webhooks")
        .update({
          name: data.name,
          url: data.url,
          events: data.events,
          active: data.active ?? true,
        })
        .eq("id", data.id)
        .eq("workspace_id", workspaceId);
      if (error) throw new Error(error.message);
      return { ok: true };
    }
    const secret = `whsec_${randomBytes(24).toString("hex")}`;
    const { error } = await supabase.from("outbound_webhooks").insert({
      owner_id: userId,
      workspace_id: workspaceId,
      name: data.name,
      url: data.url,
      events: data.events,
      active: data.active ?? true,
      secret,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteWebhook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    const ws = await getActiveWorkspaceId(supabase, userId);
    await assertPermission(supabase, userId, ws, WEBHOOK_MANAGE);
    await supabase
      .from("outbound_webhooks")
      .delete()
      .eq("id", data.id)
      .eq("workspace_id", workspaceId);
    return { ok: true };
  });

export const listWebhookDeliveries = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: { webhook_id?: string | null; event_type?: string | null; status?: string | null }) =>
      z
        .object({
          webhook_id: z.string().uuid().nullable().optional(),
          event_type: z.string().nullable().optional(),
          status: z.enum(["pending", "success", "failed", "dead"]).nullable().optional(),
        })
        .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    let q = supabase
      .from("webhook_deliveries")
      .select(
        "id, webhook_id, event_type, status, attempt, response_status, response_body, payload, created_at, delivered_at, next_retry_at",
      )
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (data.webhook_id) q = q.eq("webhook_id", data.webhook_id);
    if (data.event_type) q = q.eq("event_type", data.event_type);
    if (data.status) q = q.eq("status", data.status);
    const { data: rows } = await q;
    return { deliveries: rows ?? [] };
  });

export const retryWebhookDelivery = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    const ws = await getActiveWorkspaceId(supabase, userId);
    await assertPermission(supabase, userId, ws, WEBHOOK_MANAGE);
    const { error } = await supabase

      .from("webhook_deliveries")
      .update({
        status: "pending",
        attempt: 0,
        next_retry_at: new Date().toISOString(),
        response_status: null,
        response_body: null,
        delivered_at: null,
      })
      .eq("id", data.id)
      .eq("workspace_id", workspaceId);
    if (error) throw new Error(error.message);
    try {
      await runWebhookDispatch();
    } catch {
      /* ignore */
    }
    return { ok: true };
  });

export const getWebhookSecret = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    // `secret` is owner-only via RLS; use admin client scoped to owner_id.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("outbound_webhooks")
      .select("secret")
      .eq("id", data.id)
      .eq("workspace_id", workspaceId)
      .maybeSingle();
    return { secret: row?.secret as string | undefined };
  });

export const runWebhookTick = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const r = await runWebhookDispatch();
    return r;
  });
