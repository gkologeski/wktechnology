import type { EmailSenderPolicy } from "./email-sender-policy";

/** Resolve a conta de e-mail do próprio usuário e se ele é admin do workspace. */
export async function resolveEmailSender(
  userId: string,
  workspaceId: string,
): Promise<EmailSenderPolicy & { ownLabel: string | null }> {
  const { isWorkspaceAdmin } = await import("@/lib/workspace/admin-guard.server");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const db = supabaseAdmin as any;
  const isAdmin = await isWorkspaceAdmin(userId, workspaceId);
  const { data: mine } = await db
    .from("email_accounts")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("owner_id", userId);
  const ids = ((mine as { id: string }[] | null) || []).map((r) => r.id);
  let own: { id: string; label: string } | null = null;
  if (ids.length) {
    const { data } = await db
      .from("service_channel_accounts")
      .select("id,label")
      .eq("workspace_id", workspaceId)
      .eq("channel", "email")
      .in("source_key", ids)
      .order("label")
      .limit(1);
    own = (data as { id: string; label: string }[] | null)?.[0] ?? null;
  }
  return { isAdmin, ownAccountId: own?.id ?? null, ownLabel: own?.label ?? null };
}
