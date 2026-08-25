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
): Promise<{
  generated: number;
  scanned: number;
  skippedDuplicates: number;
  updateErrors: number;
}> {
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
  let skippedDuplicates = 0;
  let updateErrors = 0;

  for (const svc of due ?? []) {
    const amount = Number(svc.quantity) * Number(svc.unit_price);
    const upcoming = next(svc.next_billing_at as string, svc.cadence as Cadence | null);
    const stops = svc.ends_at ? Boolean(upcoming && upcoming > (svc.ends_at as string)) : false;
    const competence = svc.next_billing_at as string;

    // Upsert idempotente: (service_id, competence_date) tem índice único parcial
    // para origin_type='service'. Se ticks concorrentes/retry acontecerem,
    // a segunda inserção é ignorada em vez de gerar cobrança duplicada.
    const { data: inserted, error: fErr } = await admin
      .from("financial_entries")
      .upsert(
        {
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
          competence_date: competence,
          due_date: competence,
          status: "open",
        },
        { onConflict: "service_id,competence_date", ignoreDuplicates: true },
      )
      .select("id");

    if (fErr) {
      console.error("[services-billing] upsert entry failed", {
        service_id: svc.id,
        workspace_id: svc.workspace_id,
        competence,
        error: fErr.message,
      });
      continue;
    }

    const wasInserted = Array.isArray(inserted) && inserted.length > 0;
    if (wasInserted) {
      generated += 1;
    } else {
      skippedDuplicates += 1;
      console.warn("[services-billing] duplicate skipped by unique index", {
        service_id: svc.id,
        competence,
      });
    }

    // Avança o cursor. Se falhar, no próximo tick o upsert será ignorado
    // pelo índice único — não gera duplicidade.
    const { error: uErr } = await admin
      .from("services")
      .update({
        next_billing_at: stops ? null : upcoming,
        status: stops ? "completed" : "active",
      })
      .eq("id", svc.id);

    if (uErr) {
      updateErrors += 1;
      console.error("[services-billing] update next_billing_at failed", {
        service_id: svc.id,
        error: uErr.message,
      });
    }
  }

  console.log("[services-billing] tick complete", {
    scanned: (due ?? []).length,
    generated,
    skippedDuplicates,
    updateErrors,
  });

  return { generated, scanned: (due ?? []).length, skippedDuplicates, updateErrors };
}
