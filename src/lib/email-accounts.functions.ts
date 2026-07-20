import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { buildGmailAuthUrl, callbackRedirectUri, signState } from "@/lib/email-oauth.server";

// Start Gmail OAuth — returns an authorize URL the client should redirect to.
export const startGmailOAuth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ return_to: z.string().optional(), origin: z.string().url() }).parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const redirectUri = callbackRedirectUri(data.origin);
    const state = signState({
      user_id: context.userId,
      return_to: data.return_to,
      return_origin: data.origin,
    });
    const url = buildGmailAuthUrl({ redirectUri, state });
    return { url };
  });

// List the current user's connected email accounts.
export const listEmailAccounts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("email_accounts")
      .select("id, provider, email, status, scopes, last_sync_at, last_error, created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { items: data ?? [] };
  });

// Disconnect (delete) an email account.
export const disconnectEmailAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("email_accounts").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
