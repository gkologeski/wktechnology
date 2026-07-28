// Server fns para configurar textos do e-mail de convite por workspace.
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

export const getInviteSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(supabase, userId);
    const { data } = await supabase
      .from("workspace_invite_settings")
      .select("*")
      .eq("workspace_id", workspaceId)
      .maybeSingle();
    return { settings: data, workspace_id: workspaceId };
  });

const settingsSchema = z.object({
  subject: z.string().max(200).nullable().optional(),
  greeting: z.string().max(200).nullable().optional(),
  body_intro: z.string().max(1000).nullable().optional(),
  cta_label: z.string().max(80).nullable().optional(),
  footer_note: z.string().max(500).nullable().optional(),
  expires_note: z.string().max(200).nullable().optional(),
  product_name: z.string().max(120).nullable().optional(),
});

export const saveInviteSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => settingsSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(supabase, userId);
    const { error } = await supabase.from("workspace_invite_settings").upsert(
      {
        workspace_id: workspaceId,
        updated_by: userId,
        ...data,
      },
      { onConflict: "workspace_id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });
