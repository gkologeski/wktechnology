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
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);

    // Refuse to change composition of the system group (auto-managed).
    const { data: g } = await supabase
      .from("legal_entity_groups")
      .select("is_system")
      .eq("id", data.group_id)
      .eq("workspace_id", workspaceId)
      .maybeSingle();
    if (!g) throw new Error("Grupo não encontrado.");
    if ((g as { is_system: boolean }).is_system) {
      throw new Error(
        "O grupo padrão 'Todas as empresas' é gerenciado automaticamente e não pode ser alterado.",
      );
    }

    const { error: dErr } = await supabase
      .from("legal_entity_group_members")
      .delete()
      .eq("group_id", data.group_id);
    if (dErr) throw dErr;

    if (data.legal_entity_ids.length) {
      const rows = data.legal_entity_ids.map((id) => ({
        group_id: data.group_id,
        legal_entity_id: id,
        workspace_id: workspaceId,
      }));
      const { error: iErr } = await supabase.from("legal_entity_group_members").insert(rows);
      if (iErr) throw iErr;
    }
    return { ok: true };
  });
