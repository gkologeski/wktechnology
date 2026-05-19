import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { syncAccount, type SyncResult } from "@/lib/gmail-sync.server";
import type { EmailAccountRow } from "@/lib/gmail.server";

const ACCOUNT_COLUMNS =
  "id, owner_id, email, access_token, refresh_token, expires_at, status, history_id";

// Manual "sync now" trigger from /settings/email.
export const syncMyEmailAccounts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ account_id: z.string().uuid().optional() }).parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    let q = supabaseAdmin
      .from("email_accounts")
      .select(ACCOUNT_COLUMNS)
      .eq("owner_id", context.userId)
      .eq("provider", "gmail")
      .eq("status", "connected");
    if (data.account_id) q = q.eq("id", data.account_id);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    const results: SyncResult[] = [];
    for (const acc of (rows ?? []) as EmailAccountRow[]) {
      try {
        results.push(await syncAccount(acc));
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        await supabaseAdmin
          .from("email_accounts")
          .update({ status: "error", last_error: msg })
          .eq("id", acc.id);
        results.push({
          accountId: acc.id,
          email: acc.email,
          fetched: 0,
          inserted: 0,
          skipped: 0,
          error: msg,
        });
      }
    }
    return { results };
  });

// Cron-only helper: drains all connected gmail accounts.
export async function runAllAccountsSync(): Promise<{
  total: number;
  inserted: number;
  errors: number;
}> {
  const { data: rows, error } = await supabaseAdmin
    .from("email_accounts")
    .select(ACCOUNT_COLUMNS)
    .eq("provider", "gmail")
    .eq("status", "connected");
  if (error) throw new Error(error.message);

  let inserted = 0;
  let errors = 0;
  for (const acc of (rows ?? []) as EmailAccountRow[]) {
    try {
      const r = await syncAccount(acc);
      inserted += r.inserted;
    } catch (e) {
      errors++;
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`[gmail-sync] account ${acc.email} failed:`, msg);
      await supabaseAdmin
        .from("email_accounts")
        .update({ status: "error", last_error: msg })
        .eq("id", acc.id);
    }
  }
  return { total: rows?.length ?? 0, inserted, errors };
}
