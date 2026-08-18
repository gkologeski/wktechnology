// Server functions para gerenciar ativação e plano dos módulos por workspace.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveActiveWorkspace } from "@/lib/active-workspace.server";

type ModuleRow = {
  module_id: string;
  module_name: string;
  product_name: string;
  default_color: string;
  enabled: boolean;
  plan_code: string | null;
  plan_name: string | null;
  plan_price_monthly: number | null;
  activated_at: string | null;
};

/** Lista módulos do catálogo + status no workspace ativo (enabled, plan). */
export const listWorkspaceModules = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const workspaceId = await resolveActiveWorkspace(context.userId);

    const { data: modules, error: e1 } = await supabaseAdmin
      .from("modules")
      .select("id, name, default_product_name, default_color, sort_order")
      .order("sort_order", { ascending: true });
    if (e1) throw new Error(e1.message);

    const { data: wm } = await supabaseAdmin
      .from("workspace_modules")
      .select("module_id, enabled, plan_code, activated_at")
      .eq("workspace_id", workspaceId);

    const { data: plans } = await supabaseAdmin
      .from("plans")
      .select("code, name, price_monthly");

    const wmByMod = new Map((wm ?? []).map((r) => [r.module_id as string, r]));
    const planByCode = new Map((plans ?? []).map((p) => [p.code as string, p]));

    const out: ModuleRow[] = (modules ?? []).map((m) => {
      const ws = wmByMod.get(m.id as string);
      const plan = ws?.plan_code ? planByCode.get(ws.plan_code as string) : null;
      return {
        module_id: m.id as string,
        module_name: m.name as string,
        product_name: m.default_product_name as string,
        default_color: m.default_color as string,
        enabled: ws?.enabled ?? false,
        plan_code: (ws?.plan_code as string | null) ?? null,
        plan_name: (plan?.name as string | null) ?? null,
        plan_price_monthly: plan ? Number(plan.price_monthly) : null,
        activated_at: (ws?.activated_at as string | null) ?? null,
      };
    });

    return { modules: out };
  });

/** Ativa/desativa um módulo no workspace ativo. */
export const setWorkspaceModuleEnabled = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({ module_id: z.string().min(1), enabled: z.boolean() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const workspaceId = await resolveActiveWorkspace(context.userId);
    const { assertWorkspaceAdmin } = await import("@/lib/workspace/admin-guard.server");
    await assertWorkspaceAdmin(context.userId, workspaceId);

    const { error } = await supabaseAdmin
      .from("workspace_modules")
      .upsert(
        {
          workspace_id: workspaceId,
          module_id: data.module_id,
          enabled: data.enabled,
        } as never,
        { onConflict: "workspace_id,module_id" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Define o plano (free/bronze/prata/ouro) para um módulo no workspace ativo. */
export const setWorkspaceModulePlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        module_id: z.string().min(1),
        plan_code: z.enum(["free", "bronze", "prata", "ouro"]),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const workspaceId = await resolveActiveWorkspace(context.userId);
    const { assertWorkspaceAdmin } = await import("@/lib/workspace/admin-guard.server");
    await assertWorkspaceAdmin(context.userId, workspaceId);

    const { error } = await supabaseAdmin
      .from("workspace_modules")
      .upsert(
        {
          workspace_id: workspaceId,
          module_id: data.module_id,
          plan_code: data.plan_code,
          enabled: true,
        } as never,
        { onConflict: "workspace_id,module_id" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });
