import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const billingInterval = z.enum(["week", "month", "quarter", "year"]);
const subStatus = z.enum(["trialing", "active", "paused", "canceled", "past_due", "completed"]);
const invStatus = z.enum(["pending", "paid", "failed", "void"]);

// ---------------- Plans ----------------
export const listPlans = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.from("recurring_plans").select("*").order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const upsertPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    id: z.string().uuid().optional(),
    name: z.string().min(1).max(255),
    description: z.string().max(2000).nullable().optional(),
    price: z.number().min(0),
    currency: z.string().length(3).default("BRL"),
    interval: billingInterval.default("month"),
    interval_count: z.number().int().min(1).max(36).default(1),
    trial_days: z.number().int().min(0).max(365).default(0),
    active: z.boolean().default(true),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (data.id) {
      const { id, ...patch } = data;
      const { error } = await supabase.from("recurring_plans").update(patch).eq("id", id);
      if (error) throw new Error(error.message);
      return { id };
    }
    const { data: row, error } = await supabase.from("recurring_plans").insert({ ...data, owner_id: userId }).select("id").single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const deletePlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("recurring_plans").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------------- Subscriptions ----------------
export const listSubscriptions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("subscriptions")
      .select("*, contacts(id, first_name, last_name, email), recurring_plans(id, name)")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getSubscription = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const [{ data: sub, error: e1 }, { data: invs, error: e2 }] = await Promise.all([
      context.supabase.from("subscriptions").select("*, contacts(id, first_name, last_name, email), recurring_plans(id, name)").eq("id", data.id).single(),
      context.supabase.from("subscription_invoices").select("*").eq("subscription_id", data.id).order("period_start", { ascending: false }),
    ]);
    if (e1) throw new Error(e1.message);
    if (e2) throw new Error(e2.message);
    return { subscription: sub, invoices: invs ?? [] };
  });

export const createSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    contact_id: z.string().uuid(),
    deal_id: z.string().uuid().nullable().optional(),
    plan_id: z.string().uuid().nullable().optional(),
    name: z.string().min(1).max(255),
    amount: z.number().min(0),
    currency: z.string().length(3).default("BRL"),
    interval: billingInterval.default("month"),
    interval_count: z.number().int().min(1).max(36).default(1),
    start_date: z.string().optional(),
    trial_days: z.number().int().min(0).max(365).default(0),
    total_cycles: z.number().int().min(1).max(999).nullable().optional(),
    notes: z.string().max(2000).nullable().optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const start = data.start_date ?? new Date().toISOString().slice(0, 10);
    const trialEnds = data.trial_days > 0
      ? new Date(new Date(start).getTime() + data.trial_days * 86400000).toISOString().slice(0, 10)
      : null;
    const { data: row, error } = await supabase.from("subscriptions").insert({
      owner_id: userId,
      contact_id: data.contact_id,
      deal_id: data.deal_id ?? null,
      plan_id: data.plan_id ?? null,
      name: data.name,
      amount: data.amount,
      currency: data.currency,
      interval: data.interval,
      interval_count: data.interval_count,
      start_date: start,
      trial_ends_at: trialEnds,
      total_cycles: data.total_cycles ?? null,
      status: trialEnds ? "trialing" : "active",
      notes: data.notes ?? null,
    }).select("id").single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const updateSubscriptionStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    id: z.string().uuid(),
    action: z.enum(["pause", "resume", "cancel"]),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const patch = data.action === "pause"
      ? { status: "paused" as const }
      : data.action === "resume"
      ? { status: "active" as const }
      : { status: "canceled" as const, ended_at: new Date().toISOString(), next_billing_at: null };
    const { error } = await context.supabase.from("subscriptions").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("subscriptions").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------------- Invoices ----------------
export const setInvoiceStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    id: z.string().uuid(),
    status: invStatus,
  }).parse(d))
  .handler(async ({ data, context }) => {
    const patch: Record<string, unknown> = { status: data.status };
    if (data.status === "paid") patch.paid_at = new Date().toISOString();
    const { error } = await context.supabase.from("subscription_invoices").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listAllInvoices = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("subscription_invoices")
      .select("*, subscriptions(name, contact_id, contacts(first_name, last_name))")
      .order("due_date", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return data ?? [];
  });
