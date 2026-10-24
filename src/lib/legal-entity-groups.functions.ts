import { financeRpc } from "@/lib/access-control/finance-records.server";
import { authorizeFinanceBusiness } from "@/lib/access-control/finance-business.server";
// Server functions for Legal Entity Groups (agrupamentos de CNPJs por workspace).
// Um CNPJ pode pertencer a múltiplos grupos (N:N). Existe sempre um grupo
// `is_system = true` chamado "Todas as empresas" mantido automaticamente
// pelo trigger `sync_system_legal_entity_group`.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveActiveWorkspace } from "@/lib/active-workspace.server";

const upsertSchema = z.object({
  id: z.string().uuid().optional(),
  code: z.string().trim().max(24).nullable().optional(),
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).nullable().optional(),
  color: z.string().trim().max(20).nullable().optional(),
  active: z.boolean().optional(),
});

export const listLegalEntityGroups = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await authorizeFinanceBusiness(context.supabase, "legal_entity_groups", "view", undefined);
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);

    const { data: groups, error } = await supabase
      .from("legal_entity_groups")
      .select("id, code, name, description, color, is_system, active, created_at")
      .eq("workspace_id", workspaceId)
      .order("is_system", { ascending: false })
      .order("name", { ascending: true });
    if (error) throw error;

    const ids = (groups ?? []).map((g) => (g as { id: string }).id);
    let membersByGroup: Record<string, string[]> = {};
    if (ids.length) {
      const { data: mem, error: mErr } = await supabase
        .from("legal_entity_group_members")
        .select("group_id, legal_entity_id")
        .in("group_id", ids);
      if (mErr) throw mErr;
      membersByGroup = (mem ?? []).reduce<Record<string, string[]>>((acc, r) => {
        const row = r as { group_id: string; legal_entity_id: string };
        (acc[row.group_id] ??= []).push(row.legal_entity_id);
        return acc;
      }, {});
    }
    return (groups ?? []).map((g) => {
      const row = g as { id: string } & Record<string, unknown>;
      return { ...row, member_ids: membersByGroup[row.id] ?? [] };
    });
  });

export const upsertLegalEntityGroup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => upsertSchema.parse(input))
  .handler(async ({ data, context }) => {
    await authorizeFinanceBusiness(
      context.supabase,
      "legal_entity_groups",
      data.id ? "update" : "create",
      data.id,
    );
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);

    if (data.id) {
      const { error } = await supabase
        .from("legal_entity_groups")
        .update({
          code: data.code ?? null,
          name: data.name,
          description: data.description ?? null,
          color: data.color ?? null,
          active: data.active ?? true,
        })
        .eq("id", data.id)
        .eq("workspace_id", workspaceId);
      if (error) throw error;
      return { id: data.id };
    }
    const { data: row, error } = await supabase
      .from("legal_entity_groups")
      .insert({
        workspace_id: workspaceId,
        code: data.code ?? null,
        name: data.name,
        description: data.description ?? null,
        color: data.color ?? null,
        active: data.active ?? true,
        is_system: false,
        created_by: userId,
      })
      .select("id")
      .single();
    if (error) throw error;
    return row;
  });

export const deleteLegalEntityGroup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await authorizeFinanceBusiness(context.supabase, "legal_entity_groups", "delete", data.id);
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    // Bloqueia exclusão do grupo do sistema.
    const { data: g } = await supabase
      .from("legal_entity_groups")
      .select("is_system")
      .eq("id", data.id)
      .eq("workspace_id", workspaceId)
      .maybeSingle();
    if (!g) throw new Error("Grupo não encontrado.");
    if ((g as { is_system: boolean }).is_system) {
      throw new Error("O grupo padrão 'Todas as empresas' não pode ser excluído.");
    }
    const { error } = await supabase
      .from("legal_entity_groups")
      .delete()
      .eq("id", data.id)
      .eq("workspace_id", workspaceId);
    if (error) throw error;
    return { ok: true };
  });

export const setLegalEntityGroupMembers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        group_id: z.string().uuid(),
        legal_entity_ids: z.array(z.string().uuid()).max(500),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await authorizeFinanceBusiness(
      context.supabase,
      "legal_entity_groups",
      "update",
      data.group_id,
    );
    await financeRpc(context.supabase, "finance_set_group_members", {
      _id: data.group_id,
      _members: data.legal_entity_ids,
    });
    return { ok: true };
  });
