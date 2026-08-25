// Server fns para branding (white-label) — por workspace ativo.
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

export const getBranding = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(supabase, userId);
    const { data } = await supabase
      .from("workspace_branding")
      .select("*")
      .eq("workspace_id", workspaceId)
      .maybeSingle();

    // Renova URLs assinadas de assets próximas do vencimento.
    const { refreshBrandingAssets } = await import("@/lib/branding/assets.server");
    const { row, patch } = await refreshBrandingAssets(data);
    if (patch) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin
        .from("workspace_branding")
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .update(patch as any)
        .eq("workspace_id", workspaceId);
    }
    return { branding: row, workspace_id: workspaceId };
  });

const themeSchema = z
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

export const saveBranding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      brand_name?: string | null;
      logo_url?: string | null;
      favicon_url?: string | null;
      primary_color?: string | null;
      accent_color?: string | null;
      custom_domain?: string | null;
      support_email?: string | null;
      footer_text?: string | null;
      radius?: string | null;
      density?: string | null;
      heading_font?: string | null;
      body_font?: string | null;
      theme?: unknown;
    }) =>
      z
        .object({
          brand_name: z.string().max(120).nullable().optional(),
          logo_url: z.string().url().nullable().optional(),
          favicon_url: z.string().url().nullable().optional(),
          primary_color: z.string().max(40).nullable().optional(),
          accent_color: z.string().max(40).nullable().optional(),
          custom_domain: z.string().max(200).nullable().optional(),
          support_email: z.string().email().nullable().optional(),
          footer_text: z.string().max(500).nullable().optional(),
          radius: z.string().max(20).nullable().optional(),
          density: z.enum(["compact", "cozy", "comfortable"]).nullable().optional(),
          heading_font: z.string().max(80).nullable().optional(),
          body_font: z.string().max(80).nullable().optional(),
          theme: themeSchema,
        })
        .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(supabase, userId);
    const { error } = await supabase.from("workspace_branding").upsert(
      {
        owner_id: userId,
        workspace_id: workspaceId,
        ...data,
      },
      { onConflict: "workspace_id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });
