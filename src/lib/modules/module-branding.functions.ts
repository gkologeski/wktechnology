// Server fns para branding de cada módulo do ERP (TechSales CRM, TechHire ATS).
// Espelha o padrão de `branding.functions.ts` mas opera na tabela
// `module_branding`, que tem chave composta (workspace_id, module_id).

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function resolveActiveWorkspace(supabase: any, userId: string): Promise<string> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("active_workspace_id")
    .eq("id", userId)
    .maybeSingle();
  if (profile?.active_workspace_id) return profile.active_workspace_id as string;

  const { data: member } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  if (!member?.workspace_id) throw new Error("Usuário não pertence a nenhum workspace.");
  return member.workspace_id as string;
}

const MODULE_IDS = ["crm", "ats", "contracts", "projects", "finance", "people"] as const;

export const getModuleBranding = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { moduleId: string }) => z.object({ moduleId: z.enum(MODULE_IDS) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(supabase, userId);
    const { data: row } = await supabase
      .from("module_branding")
      .select("*")
      .eq("workspace_id", workspaceId)
      .eq("module_id", data.moduleId)
      .maybeSingle();

    // Renova URLs assinadas de assets próximas do vencimento.
    const { refreshBrandingAssets } = await import("@/lib/branding/assets.server");
    const { row: fresh, patch } = await refreshBrandingAssets(row);
    if (patch) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin
        .from("module_branding")
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .update(patch as any)
        .eq("workspace_id", workspaceId)
        .eq("module_id", data.moduleId);
    }
    return { branding: fresh, workspace_id: workspaceId, module_id: data.moduleId };
  });

const moduleThemeSchema = z
  .object({
    light: z.record(z.string(), z.string()).optional(),
    dark: z.record(z.string(), z.string()).optional(),
    icons: z
      .object({
        stroke: z.number().min(1).max(3).optional(),
        size: z.number().min(12).max(24).optional(),
      })
      .optional(),
    assets: z.record(z.string(), z.string()).optional(),
  })
  .nullable()
  .optional();

export const saveModuleBranding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      moduleId: string;
      product_name?: string | null;
      logo_url?: string | null;
      favicon_url?: string | null;
      primary_color?: string | null;
      secondary_color?: string | null;
      custom_domain?: string | null;
      theme?: unknown;
    }) =>
      z
        .object({
          moduleId: z.enum(MODULE_IDS),
          product_name: z.string().max(120).nullable().optional(),
          logo_url: z.string().url().nullable().optional().or(z.literal("")),
          favicon_url: z.string().url().nullable().optional().or(z.literal("")),
          primary_color: z.string().max(40).nullable().optional(),
          secondary_color: z.string().max(40).nullable().optional(),
          custom_domain: z.string().max(200).nullable().optional(),
          theme: moduleThemeSchema,
        })
        .parse(d),
  )

  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(supabase, userId);
    const { moduleId, ...rest } = data;
    const payload: Record<string, unknown> = {
      workspace_id: workspaceId,
      module_id: moduleId,
    };
    for (const [k, v] of Object.entries(rest)) {
      payload[k] = v === "" ? null : v;
    }
    const { error } = await supabase
      .from("module_branding")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .upsert(payload as any, { onConflict: "workspace_id,module_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
