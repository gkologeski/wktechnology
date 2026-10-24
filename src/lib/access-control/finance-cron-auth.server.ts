import { requireCronAuth } from "@/lib/cron-auth.server";
import { financeRpc } from "./finance-records.server";
/** Keep legacy server-only CRON_SECRET compatibility; each DB job has its own Vault credential. */
export async function requireFinanceCronAuth(
  request: Request,
  job: "dunning" | "recurrences" | "banking",
): Promise<Response | null> {
  if (process.env.CRON_SECRET && !requireCronAuth(request)) return null;
  const header = request.headers.get("authorization") ?? "";
  if (!/^Bearer [0-9a-f]{64}$/.test(header)) return new Response("Unauthorized", { status: 401 });
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const valid = await financeRpc(supabaseAdmin, "finance_verify_cron_token", {
      _job: job,
      _token: header.slice(7),
    });
    return valid === true ? null : new Response("Unauthorized", { status: 401 });
  } catch {
    return new Response("Scheduler unavailable", { status: 503 });
  }
}
