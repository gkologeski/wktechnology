// Motor de billing dos Serviços (Sprint 3).
// Percorre TODOS os workspaces via service role e gera financial_entries.
// Invocado pelo cron em /api/public/hooks/services-billing-tick.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type Cadence = Database["public"]["Enums"]["service_cadence"];

function addMonths(iso: string, months: number): string {
  const d = new Date(iso);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

function next(current: string, cadence: Cadence | null): string | null {
  if (cadence === "monthly") return addMonths(current, 1);
  if (cadence === "quarterly") return addMonths(current, 3);
  if (cadence === "yearly") return addMonths(current, 12);
  return null;
}

export async function tickServicesBilling(
  admin: SupabaseClient<Database>,
  batch = 200,
): Promise<{ generated: number; scanned: number }> {
  const today = new Date().toISOString().slice(0, 10);

  const { data: due, error } = await admin
    .from("services")
    .select("*")
    .eq("status", "active")
    .eq("type", "recurring")
    .not("next_billing_at", "is", null)
    .lte("next_billing_at", today)
    .order("next_billing_at", { ascending: true })
    .limit(batch);
  if (error) throw error;

  let generated = 0;
  for (const svc of due ?? []) {
    const amount = Number(svc.quantity) * Number(svc.unit_price);
    const upcoming = next(svc.next_billing_at as string, svc.cadence as Cadence | null);
    const stops = svc.ends_at ? Boolean(upcoming && upcoming > (svc.ends_at as string)) : false;

    const { error: fErr } = await admin.from("financial_entries").insert({
      workspace_id: svc.workspace_id,
      owner_id: svc.owner_id,
      direction: svc.role === "provider" ? "receivable" : "payable",
      origin_type: "service",
      origin_id: svc.id,
      service_id: svc.id,
      contract_id: svc.contract_id,
      description: svc.name,
      amount,
      currency: svc.currency,
      competence_date: svc.next_billing_at as string,
      due_date: svc.next_billing_at as string,
      status: "open",
    });
    if (fErr) {
      console.error("[services-billing] insert entry failed", svc.id, fErr.message);
      continue;
    }
    generated += 1;

    await admin
      .from("services")
      .update({
        next_billing_at: stops ? null : upcoming,
        status: stops ? "completed" : "active",
      })
      .eq("id", svc.id);
  }

  return { generated, scanned: (due ?? []).length };
}
