// Server functions para Audit log.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ENTITIES = ["leads", "contacts", "companies", "deals"] as const;

export const listAuditLogs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        entity: z.enum(ENTITIES).nullable().optional(),
        entity_id: z.string().uuid().nullable().optional(),
        actor_user_id: z.string().uuid().nullable().optional(),
        action: z.enum(["created", "updated", "deleted"]).nullable().optional(),
        module_id: z.string().nullable().optional(),
        since: z.string().datetime().nullable().optional(),
        limit: z.number().int().min(1).max(500).default(100),
      })
      .parse(i ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { supabase, userId } = context;

    let q = supabase
      .from("audit_logs")
      .select(
        "id, actor_user_id, entity, entity_id, action, before, after, metadata, module_id, created_at",
      )
      .eq("workspace_owner_id", userId)
      .order("created_at", { ascending: false })
      .limit(data.limit);

    if (data.entity) q = q.eq("entity", data.entity);
    if (data.entity_id) q = q.eq("entity_id", data.entity_id);
    if (data.actor_user_id) q = q.eq("actor_user_id", data.actor_user_id);
    if (data.action) q = q.eq("action", data.action);
    if (data.module_id) q = q.eq("module_id", data.module_id);
    if (data.since) q = q.gte("created_at", data.since);

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    // Resolver nomes/emails dos atores
    const actorIds = Array.from(
      new Set(
        (rows ?? []).map((r) => r.actor_user_id as string | null).filter((x): x is string => !!x),
      ),
    );
    const nameById = new Map<string, string>();
    const emailById = new Map<string, string>();
    if (actorIds.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", actorIds);
      for (const p of profs ?? [])
        nameById.set(p.id as string, (p.full_name as string | null) ?? "");
      await Promise.all(
        actorIds.map(async (id) => {
          try {
            const { data } = await supabaseAdmin.auth.admin.getUserById(id);
            if (data.user?.email) emailById.set(id, data.user.email);
          } catch {
            /* ignore */
          }
        }),
      );
    }

    // Diff resumido (chaves alteradas)
    return (rows ?? []).map((r) => {
      const before = (r.before ?? null) as Record<string, unknown> | null;
      const after = (r.after ?? null) as Record<string, unknown> | null;
      const changedKeys: string[] = [];
      if (r.action === "updated" && before && after) {
        const skip = new Set(["updated_at"]);
        const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
        for (const k of keys) {
          if (skip.has(k)) continue;
          if (JSON.stringify(before[k]) !== JSON.stringify(after[k])) changedKeys.push(k);
        }
      }
      return {
        ...r,
        actor_name: r.actor_user_id ? nameById.get(r.actor_user_id as string) || "" : "",
        actor_email: r.actor_user_id ? emailById.get(r.actor_user_id as string) || "" : "",
        changed_keys: changedKeys,
      };
    });
  });

export const AUDIT_ENTITY_LABELS: Record<(typeof ENTITIES)[number], string> = {
  leads: "Leads",
  contacts: "Contatos",
  companies: "Empresas",
  deals: "Negócios",
};

export const AUDIT_ACTION_LABELS: Record<"created" | "updated" | "deleted", string> = {
  created: "Criado",
  updated: "Alterado",
  deleted: "Excluído",
};
