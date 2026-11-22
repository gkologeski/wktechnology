import type { SupabaseClient } from "@supabase/supabase-js";
import { assertSalesAccountJob } from "./access-control/sales-account-job.server";
import { workRpc } from "./access-control/work-core.server";

/** Service-only, payload-free recovery. The database rechecks the account and
 * membership inside each atomic projection; there is deliberately no send API. */
export async function recoverGmailAcceptances(
  admin: SupabaseClient,
  workspace: string,
  account: string,
) {
  await assertSalesAccountJob(admin, "email_accounts", account);
  const token = crypto.randomUUID();
  const scope = { p_workspace: workspace, p_account: account, p_token: token };
  const items = await workRpc<Array<{ receipt_id: string }>>(admin, "inbox_gmail_recovery_claim", {
    ...scope,
    p_limit: 25,
  });
  let completed = 0;
  let failed = 0;
  for (const item of items) {
    try {
      if (
        await workRpc<boolean>(admin, "inbox_gmail_recovery_project", {
          ...scope,
          p_receipt: item.receipt_id,
        })
      )
        completed++;
      else failed++;
    } catch {
      // Lost RPC response does not undo a committed projection. The durable
      // lease either completed atomically or expires for a later sync cycle.
      failed++;
    }
  }
  return { claimed: items.length, completed, failed };
}
