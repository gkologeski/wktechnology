import { recordUpdatePayload } from "@/lib/access-control/record-update-payload";
import { assertSalesRecord } from "@/lib/access-control/sales-core.server";
import { requireSalesPermission } from "@/lib/access-control/sales-permission.middleware";
// Server functions para o módulo de Distribuição (rotação).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { applyRotation } from "@/lib/rotation/engine.server";

const EntityEnum = z.enum([
  "leads",
  "deals",
  "tickets",
  "whatsapp_conversations",
  "email_threads",
  "live_chat_sessions",
]);
const StrategyEnum = z.enum(["round_robin", "weighted"]);

const FilterSchema = z.object({
  field: z.string().min(1).max(100),
  op: z.enum(["eq", "neq", "in", "contains", "gt", "lt", "changed_to", "is_empty", "is_not_empty"]),
  value: z.unknown().optional(),
});

const AssigneeSchema = z.object({
  user_id: z.string().uuid(),
  weight: z.number().int().min(1).max(100).default(1),
});

const SaveSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(120),
  entity: EntityEnum,
  enabled: z.boolean(),
  strategy: StrategyEnum,
  filters: z.array(FilterSchema).max(20).default([]),
  assignees: z.array(AssigneeSchema).min(1).max(50),
});

export const listRotationRules = createServerFn({ method: "GET" })
  .middleware([requireSalesPermission("system.automation.rotation", "view")])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("rotation_rules")
      .select(
        "id, name, entity, enabled, strategy, filters, assignees, last_index, last_assigned_user_id, last_assigned_at, updated_at",
      )
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const saveRotationRule = createServerFn({ method: "POST" })
  .middleware([requireSalesPermission("system.automation.rotation", ["create", "update"])])
  .inputValidator((i) => SaveSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const payload = {
      owner_id: userId,
      name: data.name,
      entity: data.entity,
      enabled: data.enabled,
      strategy: data.strategy,
      filters: data.filters,
      assignees: data.assignees,
    } as never;
    if (data.id) {
      const { error } = await supabase
        .from("rotation_rules")
        .update(recordUpdatePayload(payload))
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: row, error } = await supabase
      .from("rotation_rules")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const deleteRotationRule = createServerFn({ method: "POST" })
  .middleware([requireSalesPermission("system.automation.rotation", "delete")])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    if (data.id) await assertSalesRecord(context.supabase, "rotation_rules", data.id, "delete");

    const { error } = await context.supabase.from("rotation_rules").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Technical selector: names/IDs/status from the selected active workspace only.
 * This does not authorize assignment or expose member credentials/contact details. */
export const listWorkspaceMembers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { workRpc } = await import("@/lib/access-control/work-core.server");
    const scope = await workRpc<{ workspace?: string; actor?: string }>(
      context.supabase,
      "sales_access_context",
      {},
    );
    if (!scope.workspace || scope.actor !== context.userId)
      throw new Error("Workspace ativo indisponível.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: members, error } = await supabaseAdmin
      .from("workspace_members")
      .select("user_id,status,is_test_user,role")
      .eq("workspace_id", scope.workspace);
    if (error) throw new Error(error.message);
    const rows = (members ?? []).filter((m) => !m.is_test_user || m.user_id === context.userId);
    const ids = rows.map((m) => m.user_id);
    if (!ids.length) return [];
    const { data: profiles, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("id,full_name")
      .in("id", ids);
    if (profileError) throw new Error(profileError.message);
    const names = new Map((profiles ?? []).map((p) => [p.id, p.full_name?.trim()]));
    return rows
      .map((m) => ({
        user_id: m.user_id,
        full_name: names.get(m.user_id) || `${m.user_id.slice(0, 8)}…`,
        is_owner: m.role === "owner",
        is_me: m.user_id === context.userId,
        status: (m.status === "active" ? "active" : "inactive") as "active" | "inactive",
      }))
      .sort(
        (a, b) =>
          Number(b.is_me) - Number(a.is_me) ||
          Number(b.is_owner) - Number(a.is_owner) ||
          a.full_name.localeCompare(b.full_name),
      );
  });

/** Aplica rotação manualmente em um registro (debug/uso pontual). */
export const rotateRecordNow = createServerFn({ method: "POST" })
  .middleware([requireSalesPermission("system.automation.rotation", "manage")])
  .inputValidator((i) =>
    z
      .object({
        rule_id: z.string().uuid(),
        entity: EntityEnum,
        entity_id: z.string().uuid(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    return await applyRotation(context.supabase, data.rule_id, data.entity, data.entity_id);
  });
