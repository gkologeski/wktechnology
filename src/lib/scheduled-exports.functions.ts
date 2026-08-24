// Server functions para Agendamentos de Export por Email.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { computeNextRun, runExportNow } from "@/lib/scheduled-exports/engine.server";
import { assertReportsExport } from "@/lib/access-control/admin-gates.server";

const FrequencySchema = z.enum(["daily", "weekly", "monthly"]);

const UpsertSchema = z
  .object({
    id: z.string().uuid().optional(),
    report_id: z.string().uuid(),
    name: z.string().min(1).max(200),
    recipients: z.array(z.string().email()).min(1).max(20),
    frequency: FrequencySchema,
    hour_of_day: z.number().int().min(0).max(23),
    day_of_week: z.number().int().min(0).max(6).nullable().optional(),
    day_of_month: z.number().int().min(1).max(28).nullable().optional(),
    email_account_id: z.string().uuid().nullable().optional(),
    enabled: z.boolean().default(true),
  })
  .refine((d) => d.frequency !== "weekly" || typeof d.day_of_week === "number", {
    message: "Defina o dia da semana",
    path: ["day_of_week"],
  })
  .refine((d) => d.frequency !== "monthly" || typeof d.day_of_month === "number", {
    message: "Defina o dia do mês",
    path: ["day_of_month"],
  });

export const listSchedules = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("report_schedules")
      .select("*, custom_reports(name)")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const upsertSchedule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => UpsertSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertReportsExport(supabase, userId);
    const nextRun = computeNextRun({
      frequency: data.frequency,
      hour_of_day: data.hour_of_day,
      day_of_week: data.day_of_week ?? null,
      day_of_month: data.day_of_month ?? null,
    }).toISOString();
    const payload = {
      report_id: data.report_id,
      name: data.name,
      recipients: data.recipients,
      frequency: data.frequency,
      hour_of_day: data.hour_of_day,
      day_of_week: data.day_of_week ?? null,
      day_of_month: data.day_of_month ?? null,
      email_account_id: data.email_account_id ?? null,
      enabled: data.enabled,
      next_run_at: nextRun,
      updated_at: new Date().toISOString(),
    };
    if (data.id) {
      const { error } = await supabase.from("report_schedules").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: created, error } = await supabase
      .from("report_schedules")
      .insert({ ...payload, owner_id: userId })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: created.id };
  });

export const deleteSchedule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("report_schedules").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const toggleSchedule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), enabled: z.boolean() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("report_schedules")
      .update({ enabled: data.enabled, updated_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const runScheduleNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertReportsExport(context.supabase, context.userId);
    // Verifica posse via RLS antes de chamar engine (que usa admin)
    const { data: row, error } = await context.supabase
      .from("report_schedules")
      .select("id")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Agendamento não encontrado.");
    return runExportNow(data.id);
  });
