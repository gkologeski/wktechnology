// Workspace modules: leitura do catálogo de módulos e do estado de ativação
// para o workspace ativo do usuário.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type WorkspaceModuleRow = {
  id: string;
  name: string;
  default_product_name: string | null;
  icon: string | null;
  sort_order: number;
  enabled: boolean;
  activated_at: string | null;
  plan_code: string | null;
  is_contracted: boolean;
};

/** Resolve o workspace "ativo" do usuário (1º membership, ou criado por ele). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function resolveActiveWorkspace(supabase: any, userId: string): Promise<string | null> {
  const m = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  if (m.data?.workspace_id) return m.data.workspace_id as string;
  const w = await supabase
    .from("workspaces")
    .select("id")
    .eq("created_by", userId)
    .limit(1)
    .maybeSingle();
  return (w.data?.id as string) ?? null;
}

export const listWorkspaceModules = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<WorkspaceModuleRow[]> => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(supabase, userId);

    const cat = await supabase
      .from("modules")
      .select("id, name, default_product_name, icon, sort_order")
      .order("sort_order", { ascending: true });
    if (cat.error) throw new Error(cat.error.message);

    let active = new Map<string, { enabled: boolean; activated_at: string; plan_code: string | null }>();
    if (workspaceId) {
      const wm = await supabase
        .from("workspace_modules")
        .select("module_id, enabled, activated_at, plan_code")
        .eq("workspace_id", workspaceId);
      if (wm.error) throw new Error(wm.error.message);
      active = new Map(
        (wm.data ?? []).map((r) => [
          r.module_id as string,
          {
            enabled: r.enabled as boolean,
            activated_at: r.activated_at as string,
            plan_code: (r.plan_code as string) ?? null,
          },
        ]),
      );
    }

    return (cat.data ?? []).map((m) => {
      const a = active.get(m.id as string);
      return {
        id: m.id as string,
        name: m.name as string,
        default_product_name: (m.default_product_name as string) ?? null,
        icon: (m.icon as string) ?? null,
        sort_order: (m.sort_order as number) ?? 0,
        enabled: a?.enabled ?? false,
        activated_at: a?.activated_at ?? null,
        plan_code: a?.plan_code ?? null,
        is_contracted: !!a,
      };
    });
  });

export const toggleWorkspaceModule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ moduleId: z.string().min(1).max(40), enabled: z.boolean() }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(supabase, userId);
    if (!workspaceId) throw new Error("Workspace não encontrado");
    const { assertWorkspaceAdmin } = await import("@/lib/workspace/admin-guard.server");
    await assertWorkspaceAdmin(userId, workspaceId);

    // Verifica se o módulo já está contratado
    const existing = await supabase
      .from("workspace_modules")
      .select("id")
      .eq("workspace_id", workspaceId)
      .eq("module_id", data.moduleId)
      .maybeSingle();
    if (existing.error) throw new Error(existing.error.message);
    if (!existing.data) {
      // Contrata e já aplica o estado pedido
      const ins = await supabase.from("workspace_modules").insert({
        workspace_id: workspaceId,
        module_id: data.moduleId,
        enabled: data.enabled,
      });
      if (ins.error) throw new Error(ins.error.message);
    } else {
      const upd = await supabase
        .from("workspace_modules")
        .update({ enabled: data.enabled })
        .eq("id", existing.data.id);
      if (upd.error) throw new Error(upd.error.message);
    }
    return { ok: true, workspaceId, moduleId: data.moduleId, enabled: data.enabled };
  });
