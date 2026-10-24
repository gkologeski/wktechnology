import { financeRpc } from "@/lib/access-control/finance-records.server";
import { authorizeFinanceBusiness } from "@/lib/access-control/finance-business.server";
// Server functions para régua de cobrança (Release 15).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const StepZ = z.object({
  offset_days: z.number().int().min(-30).max(120),
  channel: z.enum(["email", "whatsapp", "task", "escalation"]),
  template: z.string().max(120).optional(),
  template_id: z.string().uuid().optional().nullable(),
  subject: z.string().max(200).optional(),
  body: z.string().max(4000).optional(),
});

export const listDunningRuns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await authorizeFinanceBusiness(context.supabase, "dunning", "view", undefined);
    const { data, error } = await context.supabase
      .from("dunning_runs")
      .select(
        "id, invoice_id, policy_id, status, current_step, next_run_at, history, updated_at, created_at, customer_invoices!inner(invoice_number, amount, due_date, status)",
      )
      .order("updated_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return { runs: data ?? [] };
  });

export const listDunningPolicies = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await authorizeFinanceBusiness(context.supabase, "dunning", "view", undefined);
    const { data, error } = await context.supabase
      .from("dunning_policies")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { policies: data ?? [] };
  });

export const upsertDunningPolicy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid().optional(),
        name: z.string().min(1).max(120),
        active: z.boolean().default(true),
        is_default: z.boolean().default(false),
        segment_id: z.string().uuid().nullable().optional(),
        steps: z.array(StepZ).min(1).max(20),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await authorizeFinanceBusiness(
      context.supabase,
      "dunning",
      data.id ? "update" : "create",
      data.id,
    );
    const policy = await financeRpc<{ id: string }>(context.supabase, "finance_upsert_dunning", {
      _data: data,
    });
    return { policy };
  });

export const deleteDunningPolicy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await authorizeFinanceBusiness(context.supabase, "dunning", "delete", data.id);
    const { error } = await context.supabase
      .from("dunning_policies")
      .delete()
      .eq("id", data.id)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { ok: true };
  });
