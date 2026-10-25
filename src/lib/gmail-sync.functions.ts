import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSalesPermission } from "@/lib/access-control/sales-permission.middleware";
import { assertSalesRecord } from "@/lib/access-control/sales-core.server";
import { workRpc } from "@/lib/access-control/work-core.server";
import { syncAccount, type SyncResult } from "@/lib/gmail-sync.server";
import type { EmailAccountRow } from "@/lib/gmail.server";

const ACCOUNT_COLUMNS =
  "id, owner_id, workspace_id, email, access_token, refresh_token, expires_at, status, history_id, last_error";

// Manual "sync now" trigger from /settings/email.
export const syncMyEmailAccounts = createServerFn({ method: "POST" })
  .middleware([requireSalesPermission("techsales.email_accounts", "update")])
  .inputValidator((input) =>
    z.object({ account_id: z.string().uuid().optional() }).parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const scope = await workRpc<{ workspace: string }>(
      context.supabase,
      "sales_access_context",
      {},
    );
    const { data: visible, error: visibleError } = await context.supabase
      .from("email_accounts")
      .select("id")
      .eq("workspace_id", scope.workspace)
      .eq("owner_id", context.userId);
    if (visibleError) throw new Error(visibleError.message);
    if (!visible?.length) return { results: [] as SyncResult[] };
    if (data.account_id)
      await assertSalesRecord(context.supabase, "email_accounts", data.account_id, "update");
    // Inclui contas em "error" para permitir auto-recuperação manual
    // (ex.: historyId expirado → FAILED_PRECONDITION). syncAccount restaura
    // status="connected" ao concluir com sucesso.
    let q = supabaseAdmin
      .from("email_accounts")
      .select(ACCOUNT_COLUMNS)
      .eq("workspace_id", scope.workspace)
      .in(
        "id",
        visible.map((row) => row.id),
      )
      .eq("owner_id", context.userId)
      .eq("provider", "gmail")
      .in("status", ["connected", "error"]);
    if (data.account_id) q = q.eq("id", data.account_id);
    const { data: rowsRaw, error } = await q;
    if (error) throw new Error(error.message);

    // Se a conta está em erro por history expirado, zera o history_id
    // para forçar um seed fresco via /profile + /messages.
    const rows = (rowsRaw ?? []).map((r) => {
      const acc = r as EmailAccountRow & { last_error?: string | null };
      const expired =
        acc.history_id &&
        (acc as unknown as { last_error?: string | null }).last_error &&
        /failedPrecondition|FAILED_PRECONDITION|historyId|history.*not.*found/i.test(
          String((acc as unknown as { last_error?: string | null }).last_error ?? ""),
        );
      return expired ? { ...acc, history_id: null } : acc;
    });

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
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
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
