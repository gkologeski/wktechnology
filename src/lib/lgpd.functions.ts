// LGPD compliance: data export and account deletion.
// - exportMyData: returns a JSON snapshot of the calling user's personal data.
// - requestAccountDeletion: deletes the user's auth account when allowed.
//   Workspace owners must cancel their subscription / transfer ownership first.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Snapshot of the user's personal data across the app. */
export const exportMyData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { userId } = context;

    const tables = [
      "profiles",
      "user_roles",
      "team_members",
      "workspace_members",
      "notifications",
      "push_subscriptions",
      "calendar_accounts",
      "email_accounts",
      "user_grid_preferences",
      "saved_views",
      "platform_admins",
    ] as const;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const personal: Record<string, any[]> = {};
    for (const t of tables) {
      // Each table keys the user by either `id`, `user_id`, or `member_user_id`.
      // Try the common variants and merge anything found.
      const variants = ["user_id", "id", "member_user_id"] as const;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rows: any[] = [];
      for (const col of variants) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (supabaseAdmin as any).from(t).select("*").eq(col, userId);
        if (!error && Array.isArray(data) && data.length > 0) {
          rows.push(...data);
          break;
        }
      }
      if (rows.length > 0) personal[t] = rows;
    }

    // Auth user metadata (email, created_at, etc.)
    const { data: authData } = await supabaseAdmin.auth.admin.getUserById(userId);

    return {
      exported_at: new Date().toISOString(),
      user_id: userId,
      auth: authData?.user
        ? {
            id: authData.user.id,
            email: authData.user.email,
            phone: authData.user.phone,
            created_at: authData.user.created_at,
            last_sign_in_at: authData.user.last_sign_in_at,
            app_metadata: authData.user.app_metadata,
            user_metadata: authData.user.user_metadata,
          }
        : null,
      personal,
    };
  });

/**
 * Permanently deletes the calling user's auth account.
 * Blocks when the user is a workspace owner with an active subscription —
 * they must cancel/transfer ownership first.
 */
export const requestAccountDeletion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { confirm: string }) => {
    if (input?.confirm !== "EXCLUIR MINHA CONTA") {
      throw new Error('Confirme digitando exatamente "EXCLUIR MINHA CONTA".');
    }
    return input;
  })
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { userId } = context;

    // Owner check: blocks deletion if any workspace_subscription points at this user.
    const { data: ownsSub } = await supabaseAdmin
      .from("workspace_subscriptions")
      .select("workspace_owner_id")
      .eq("workspace_owner_id", userId)
      .maybeSingle();

    if (ownsSub) {
      throw new Error(
        "Você é o proprietário de um workspace com assinatura ativa. " +
          "Cancele a assinatura ou transfira a propriedade do workspace antes de excluir a conta.",
      );
    }

    // Remove membership traces; auth.admin.deleteUser triggers cascade on FK -> auth.users.
    await supabaseAdmin.from("workspace_members").delete().eq("user_id", userId);
    await supabaseAdmin.from("team_members").delete().eq("member_user_id", userId);
    await supabaseAdmin.from("user_roles").delete().eq("user_id", userId);

    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (error) throw new Error(`Falha ao excluir conta: ${error.message}`);

    return { ok: true };
  });
