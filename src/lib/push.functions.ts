// Push subscriptions (Web Push).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { sendPushToUser, getVapidPublicKey } from "@/lib/push.server";

export const getVapidKey = createServerFn({ method: "GET" }).handler(async () => {
  return { publicKey: getVapidPublicKey() };
});

export const registerPushSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { endpoint: string; p256dh: string; auth: string; user_agent?: string }) =>
    z
      .object({
        endpoint: z.string().url().max(2000),
        p256dh: z.string().min(1).max(500),
        auth: z.string().min(1).max(500),
        user_agent: z.string().max(500).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("push_subscriptions").upsert(
      {
        owner_id: userId,
        user_id: userId,
        endpoint: data.endpoint,
        p256dh: data.p256dh,
        auth: data.auth,
        user_agent: data.user_agent ?? null,
        enabled: true,
      },
      { onConflict: "endpoint" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const unregisterPushSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { endpoint: string }) => z.object({ endpoint: z.string().url() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await supabase
      .from("push_subscriptions")
      .delete()
      .eq("endpoint", data.endpoint)
      .eq("user_id", userId);
    return { ok: true };
  });

export const listMyPushSubscriptions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data } = await supabase
      .from("push_subscriptions")
      .select("id, endpoint, user_agent, created_at, preferences, enabled, last_used_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    return { subs: data ?? [] };
  });

const PrefsSchema = z.object({
  mention: z.boolean().optional(),
  assignment: z.boolean().optional(),
  sla: z.boolean().optional(),
  message: z.boolean().optional(),
  task: z.boolean().optional(),
  deal: z.boolean().optional(),
});

export const updatePushPreferences = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; preferences?: Record<string, boolean>; enabled?: boolean }) =>
    z
      .object({
        id: z.string().uuid(),
        preferences: PrefsSchema.optional(),
        enabled: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const patch: Record<string, unknown> = {};
    if (data.preferences) patch.preferences = data.preferences;
    if (typeof data.enabled === "boolean") patch.enabled = data.enabled;
    const { error } = await (supabase.from("push_subscriptions") as any)
      .update(patch)
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const sendTestPush = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const r = await sendPushToUser(context.userId, "mention", {
      title: "🔔 CRM",
      body: "Notificação de teste — tudo certo!",
      url: "/dashboard",
      tag: "test",
    });
    return r;
  });
