// Server functions para Audit log.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuditPermission } from "@/lib/access-control/audit-permission.middleware";

import type { Database } from "@/integrations/supabase/types";

const ENTITIES = ["leads", "contacts", "companies", "deals"] as const;

export const listAuditLogs = createServerFn({ method: "POST" })
  .middleware([requireAuditPermission()])
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
    const { supabase } = context;

    type AuditRow = Pick<
      Database["public"]["Tables"]["audit_logs"]["Row"],
      | "id"
      | "actor_user_id"
      | "entity"
      | "entity_id"
      | "action"
      | "before"
      | "after"
      | "metadata"
      | "module_id"
      | "created_at"
    >;
    const { data: rows, error } = await (
      supabase.rpc as unknown as (
        name: string,
        args: Record<string, unknown>,
      ) => Promise<{ data: AuditRow[] | null; error: { message: string } | null }>
    )("shared_audit_list", {
      _entity: data.entity ?? null,
      _entity_id: data.entity_id ?? null,
      _actor: data.actor_user_id ?? null,
      _action: data.action ?? null,
      _module: data.module_id ?? null,
      _since: data.since ?? null,
      _limit: data.limit,
    });
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
