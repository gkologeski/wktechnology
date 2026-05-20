// Server fns para branding (white-label).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getBranding = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data } = await supabase.from("workspace_branding").select("*").eq("owner_id", userId).maybeSingle();
    return { branding: data };
  });

export const saveBranding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    brand_name?: string | null; logo_url?: string | null; favicon_url?: string | null;
    primary_color?: string | null; accent_color?: string | null;
    custom_domain?: string | null; support_email?: string | null; footer_text?: string | null;
  }) =>
    z.object({
      brand_name: z.string().max(120).nullable().optional(),
      logo_url: z.string().url().nullable().optional(),
      favicon_url: z.string().url().nullable().optional(),
      primary_color: z.string().max(40).nullable().optional(),
      accent_color: z.string().max(40).nullable().optional(),
      custom_domain: z.string().max(200).nullable().optional(),
      support_email: z.string().email().nullable().optional(),
      footer_text: z.string().max(500).nullable().optional(),
    }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("workspace_branding").upsert({
      owner_id: userId, ...data,
    }, { onConflict: "owner_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
