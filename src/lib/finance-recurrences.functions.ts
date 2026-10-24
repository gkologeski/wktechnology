// Sprint H — Fase 2: recorrências de lançamentos financeiros (AR/AP).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getActiveWorkspaceId } from "@/lib/access-control/enforce.server";
import { financeRpc } from "@/lib/access-control/finance-records.server";

const directionEnum = z.enum(["receivable", "payable"]);
const cadenceEnum = z.enum(["weekly", "monthly", "yearly", "custom_days"]);

const templateSchema = z.object({
  description: z.string().min(1),
  amount: z.number().positive(),
  currency: z.string().default("BRL"),
  category_id: z.string().uuid().nullable().optional(),
  counterparty_company_id: z.string().uuid().nullable().optional(),
  contract_id: z.string().uuid().nullable().optional(),
  service_id: z.string().uuid().nullable().optional(),
  project_id: z.string().uuid().nullable().optional(),
  legal_entity_id: z.string().uuid().nullable().optional(),
  payment_method: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

const upsertSchema = z.object({
  id: z.string().uuid().optional(),
  direction: directionEnum,
  template: templateSchema,
  cadence: cadenceEnum,
  interval_days: z.number().int().min(1).max(365).nullable().optional(),
  day_of_month: z.number().int().min(1).max(31).nullable().optional(),
  start_date: z.string(),
  end_date: z.string().nullable().optional(),
  max_occurrences: z.number().int().min(1).max(1000).nullable().optional(),
});

export const listRecurrences = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        direction: directionEnum.optional(),
        active: z.boolean().optional(),
        legalEntityId: z.string().uuid().optional(),
        legalEntityIds: z.array(z.string().uuid()).optional(),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    let q = supabase
      .from("financial_recurrences")
      .select("*")
      .order("next_run_date", { ascending: true });
    if (data.direction) q = q.eq("direction", data.direction);
    if (typeof data.active === "boolean") q = q.eq("active", data.active);
    if (data.legalEntityId) q = q.eq("template->>legal_entity_id", data.legalEntityId);
    if (data.legalEntityIds && data.legalEntityIds.length)
      q = q.in("template->>legal_entity_id", data.legalEntityIds);
    const { data: rows, error } = await q;
    if (error) throw error;
    const caps: Array<{
      id: string;
      can_update: boolean;
      can_delete: boolean;
      can_generate: boolean;
    }> = [];
    const ids = (rows ?? []).map((row) => row.id);
    for (let i = 0; i < ids.length; i += 200)
      caps.push(
        ...(await financeRpc<typeof caps>(supabase, "finance_recurrence_capabilities", {
          _ids: ids.slice(i, i + 200),
        })),
      );
    const byId = new Map(caps.map((cap) => [cap.id, cap]));
    return (rows ?? []).map((row) => ({ ...row, capabilities: byId.get(row.id) }));
  });

export const getRecurrence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: row, error } = await supabase
      .from("financial_recurrences")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw error;
    return row;
  });

export const upsertRecurrence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => upsertSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const workspaceId = await getActiveWorkspaceId(supabase, userId);
    const payload = {
      workspace_id: workspaceId,
      owner_id: userId,
      direction: data.direction,
      template: data.template,
      cadence: data.cadence,
      interval_days: data.cadence === "custom_days" ? (data.interval_days ?? 30) : null,
      day_of_month: data.day_of_month ?? null,
      start_date: data.start_date,
      end_date: data.end_date ?? null,
      max_occurrences: data.max_occurrences ?? null,
      next_run_date: data.start_date,
    };
    if (data.id) {
      const { data: row, error } = await supabase
        .from("financial_recurrences")
        .update({
          direction: payload.direction,
          template: payload.template,
          cadence: payload.cadence,
          interval_days: payload.interval_days,
          day_of_month: payload.day_of_month,
          start_date: payload.start_date,
          end_date: payload.end_date,
          max_occurrences: payload.max_occurrences,
        })
        .eq("id", data.id)
        .select("*")
        .single();
      if (error) throw error;
      return row;
    }
    const { data: row, error } = await supabase
      .from("financial_recurrences")
      .insert(payload)
      .select("*")
      .single();
    if (error) throw error;
    return row;
  });

export const toggleRecurrence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid(), active: z.boolean() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("financial_recurrences")
      .update({ active: data.active })
      .eq("id", data.id)
      .select("id")
      .single();
    if (error) throw error;
    return { ok: true };
  });

export const deleteRecurrence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("financial_recurrences")
      .delete()
      .eq("id", data.id)
      .select("id")
      .single();
    if (error) throw error;
    return { ok: true };
  });

export const listRecurrenceEntries = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    if (
      (await financeRpc(context.supabase, "finance_recurrence_access", {
        _id: data.id,
        _action: "view",
      })) !== true
    )
      throw new Error("Recorrência indisponível ou sem permissão.");
    const { data: rows, error } = await context.supabase
      .from("financial_entries")
      .select("id, description, amount, due_date, status")
      .eq("external_ref", `recurrence:${data.id}`)
      .order("due_date", { ascending: false })
      .limit(50);
    if (error) throw error;
    return rows ?? [];
  });

// Runs the recurrence engine for the caller's own recurrences. Safe to call
// from the app to advance overdue schedules; the cron uses a server-only
// admin path that iterates all workspaces.
export const runMyDueRecurrences = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const workspaceId = await getActiveWorkspaceId(supabase, userId);
    const today = new Date().toISOString().slice(0, 10);
    const { data: due, error } = await supabase
      .from("financial_recurrences")
      .select("*")
      .eq("workspace_id", workspaceId)
      .eq("active", true)
      .lte("next_run_date", today);
    if (error) throw error;
    const { advanceRecurrenceOnce } = await import("@/lib/finance-recurrences.server");
    let generated = 0;
    let skipped = 0;
    const ids = (due ?? []).map((row) => row.id);
    const allowed = new Set<string>();
    for (let i = 0; i < ids.length; i += 200) {
      const caps = await financeRpc<Array<{ id: string; can_generate: boolean }>>(
        supabase,
        "finance_recurrence_capabilities",
        { _ids: ids.slice(i, i + 200) },
      );
      caps.filter((cap) => cap.can_generate).forEach((cap) => allowed.add(cap.id));
    }
    const errors: string[] = [];
    for (const r of due ?? []) {
      if (!allowed.has(r.id)) {
        skipped++;
        continue;
      }
      try {
        // Loop so a paused-and-resumed recurrence can catch up multiple periods.
        // Cap iterations per row to avoid runaway loops on bad data.
        for (let i = 0; i < 24; i++) {
          const advanced = await advanceRecurrenceOnce(supabase, r as any, today);
          if (!advanced) break;
          generated++;
          r.next_run_date = advanced.next_run_date;
          r.occurrences_generated = advanced.occurrences_generated;
          r.active = advanced.active;
          if (!advanced.active || r.next_run_date > today) break;
        }
      } catch (error) {
        errors.push(error instanceof Error ? error.message : "Falha ao gerar recorrência.");
      }
    }
    return { generated, skipped, errors };
  });
