// Server functions para webhooks de saída
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { randomBytes } from "crypto";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { runWebhookDispatch } from "@/lib/webhooks/dispatcher.server";

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
] as const;

export const listWebhooks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data } = await supabase
      .from("outbound_webhooks")
      .select("id, name, url, events, active, created_at")
      .eq("owner_id", userId)
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
        .eq("owner_id", userId);
      if (error) throw new Error(error.message);
      return { ok: true };
    }
    const secret = `whsec_${randomBytes(24).toString("hex")}`;
    const { error } = await supabase.from("outbound_webhooks").insert({
      owner_id: userId,
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
    await supabase.from("outbound_webhooks").delete().eq("id", data.id).eq("owner_id", userId);
    return { ok: true };
  });

export const listWebhookDeliveries = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { webhook_id?: string | null }) =>
    z.object({ webhook_id: z.string().uuid().nullable().optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    let q = supabase
      .from("webhook_deliveries")
      .select(
        "id, webhook_id, event_type, status, attempt, response_status, created_at, delivered_at",
      )
      .eq("owner_id", userId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (data.webhook_id) q = q.eq("webhook_id", data.webhook_id);
    const { data: rows } = await q;
    return { deliveries: rows ?? [] };
  });

export const getWebhookSecret = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    // `secret` is owner-only via RLS; use admin client scoped to owner_id.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("outbound_webhooks")
      .select("secret")
      .eq("id", data.id)
      .eq("owner_id", userId)
      .maybeSingle();
    return { secret: row?.secret as string | undefined };
  });

export const runWebhookTick = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const r = await runWebhookDispatch();
    return r;
  });
