// Two-way HubSpot sync — server functions (push manual, conflitos, config).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  pushEntity,
  pushAllForOwner,
  resolveConflictRow,
  type SyncEntity,
} from "@/lib/integrations/hubspot-push.server";

const EntityZ = z.enum(["contact", "company", "deal"]);

/** Dispara push manual de uma entidade. */
export const pushEntityNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        entity: EntityZ,
        limit: z.number().int().min(1).max(200).default(50),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    return await pushEntity(supabaseAdmin, context.userId, data.entity as SyncEntity, data.limit);
  });

/** Push das 3 entidades (botão "Sincronizar agora"). */
export const pushAllNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        limit: z.number().int().min(1).max(200).default(50),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    return await pushAllForOwner(supabaseAdmin, context.userId, data.limit);
  });

/** Lista conflitos pendentes para a UI. */
export const listSyncConflicts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("hubspot_sync_state")
      .select(
        "id, entity, local_id, hubspot_id, conflict_reason, local_updated_at, remote_updated_at, last_synced_at",
      )
      .eq("owner_id", context.userId)
      .eq("conflict_status", "conflict")
      .order("last_synced_at", { ascending: false })
      .limit(200);
    return data ?? [];
  });

/** Resolve um conflito específico forçando lado vencedor. */
export const resolveSyncConflict = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        id: z.string().uuid(),
        strategy: z.enum(["local_wins", "remote_wins"]),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    return await resolveConflictRow(supabaseAdmin, context.userId, data.id, data.strategy);
  });

/** Lê config do connector hubspot (auto_push_enabled etc.). */
export const getHubspotSyncConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("integrations")
      .select("config")
      .eq("owner_id", context.userId)
      .eq("provider", "hubspot")
      .maybeSingle();
    const cfg = (data?.config as Record<string, unknown> | null) ?? {};
    return {
      auto_push_enabled: cfg.auto_push_enabled === true,
      auto_enrich_on_create: cfg.auto_enrich_on_create === true,
    };
  });

/** Liga/desliga auto-push periódico. */
export const setHubspotAutoPush = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ enabled: z.boolean() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: cur } = await supabaseAdmin
      .from("integrations")
      .select("id, config")
      .eq("owner_id", context.userId)
      .eq("provider", "hubspot")
      .maybeSingle();
    const cfg = {
      ...((cur?.config as Record<string, unknown> | null) ?? {}),
      auto_push_enabled: data.enabled,
    };
    if (cur?.id) {
      const { error } = await supabaseAdmin
        .from("integrations")
        .update({ config: cfg } as never)
        .eq("id", cur.id as string);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin.from("integrations").insert({
        owner_id: context.userId,
        provider: "hubspot",
        status: "connected",
        config: cfg,
      } as never);
      if (error) throw new Error(error.message);
    }
    return { ok: true, enabled: data.enabled };
  });
