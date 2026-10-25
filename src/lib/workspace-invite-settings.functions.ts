import { requireSharedPermission } from "@/lib/access-control/shared-permission.middleware";
// Server fns para configurar textos do e-mail de convite por workspace.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

import { resolveActiveWorkspace as resolveWorkspace } from "@/lib/active-workspace.server";
const resolveActiveWorkspace = (_client: unknown, userId: string) => resolveWorkspace(userId);

export const getInviteSettings = createServerFn({ method: "GET" })
  .middleware([requireSharedPermission("system.members", "view")])
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
  .middleware([requireSharedPermission("system.members", "update")])
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
