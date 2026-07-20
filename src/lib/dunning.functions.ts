// Server functions para régua de cobrança (Release 15).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveActiveWorkspace } from "@/lib/active-workspace.server";

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
    const workspaceId = await resolveActiveWorkspace(context.userId);
    if (data.is_default) {
      await context.supabase
        .from("dunning_policies")
        .update({ is_default: false })
        .eq("workspace_id", workspaceId);
    }
    const payload = {
      workspace_id: workspaceId,
      owner_id: context.userId,
      name: data.name,
      active: data.active,
      is_default: data.is_default,
      segment_id: data.segment_id ?? null,
      steps: data.steps,
    };
    const q = data.id
      ? context.supabase
          .from("dunning_policies")
          .update(payload)
          .eq("id", data.id)
          .select("*")
          .single()
      : context.supabase.from("dunning_policies").insert(payload).select("*").single();
    const { data: row, error } = await q;
    if (error) throw new Error(error.message);
    return { policy: row };
  });

export const deleteDunningPolicy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("dunning_policies").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
