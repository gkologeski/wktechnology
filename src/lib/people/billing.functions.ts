import { financeRpc } from "@/lib/access-control/finance-records.server";
import { authorizeFinanceBusiness } from "@/lib/access-control/finance-business.server";
// TechPeople · Sprint 13 — Aprovação de Timesheet & Faturamento.
// Consolida horas billable aprovadas ainda não faturadas por alocação/contrato
// e gera uma customer_invoices vinculada, marcando os apontamentos.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type PendingBillingGroup = {
  allocation_id: string;
  contract_id: string | null;
  contract_number: string | null;
  contract_title: string | null;
  company_id: string | null;
  company_name: string | null;
  person_id: string;
  person_name: string | null;
  role_title: string | null;
  currency: string;
  hours: number;
  amount: number;
  entries_count: number;
  min_date: string | null;
  max_date: string | null;
};

type EntryRow = {
  id: string;
  entry_date: string | null;
  hours: number | null;
  hourly_rate: number | null;
  allocation_id: string | null;
  person_id: string | null;
};

type AllocationJoinRow = {
  id: string;
  currency: string | null;
  role_title: string | null;
  person_id: string;
  contract_id: string | null;
  people: { id: string; full_name: string | null } | null;
  contracts: {
    id: string;
    contract_number: string | null;
    title: string | null;
    company_id: string | null;
    companies: { id: string; name: string | null } | null;
  } | null;
};

const listSchema = z.object({
  start: z.string().optional(),
  end: z.string().optional(),
});

export const listPendingBillableGroups = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => listSchema.parse(i ?? {}))
  .handler(async ({ data, context }): Promise<{ groups: PendingBillingGroup[] }> => {
    await authorizeFinanceBusiness(context.supabase, "invoices", "create");
    const { supabase } = context;
    const base = supabase
      .from("project_time_entries")
      .select("id, entry_date, hours, hourly_rate, allocation_id, person_id")
      .eq("billable", true)
      .is("invoice_id", null)
      .not("approved_at", "is", null)
      .not("allocation_id", "is", null) as unknown as {
      gte: (k: string, v: string) => typeof base;
      lte: (k: string, v: string) => typeof base;
      then: Promise<{ data: EntryRow[] | null; error: { message: string } | null }>["then"];
    };
    let q2 = base;
    if (data.start) q2 = q2.gte("entry_date", data.start);
    if (data.end) q2 = q2.lte("entry_date", data.end);
    const { data: entries, error } = await (q2 as unknown as Promise<{
      data: EntryRow[] | null;
      error: { message: string } | null;
    }>);
    if (error) throw new Error(error.message);
    if (!entries || entries.length === 0) return { groups: [] };

    const allocIds = Array.from(new Set(entries.map((e) => e.allocation_id!).filter(Boolean)));
    const { data: allocs, error: aErr } = await supabase
      .from("people_allocations")
      .select(
        "id, currency, role_title, person_id, contract_id, people:person_id(id, full_name), contracts:contract_id(id, contract_number, title, company_id, companies:company_id(id, name))",
      )
      .in("id", allocIds);
    if (aErr) throw new Error(aErr.message);
    const allocMap = new Map<string, AllocationJoinRow>();
    for (const a of (allocs as unknown as AllocationJoinRow[] | null) ?? []) allocMap.set(a.id, a);

    const groups = new Map<string, PendingBillingGroup>();
    for (const e of entries) {
      const a = allocMap.get(e.allocation_id!);
      if (!a) continue;
      const key = a.id;
      const h = Number(e.hours ?? 0);
      const amount = h * Number(e.hourly_rate ?? 0);
      const g = groups.get(key) ?? {
        allocation_id: a.id,
        contract_id: a.contract_id,
        contract_number: a.contracts?.contract_number ?? null,
        contract_title: a.contracts?.title ?? null,
        company_id: a.contracts?.company_id ?? null,
        company_name: a.contracts?.companies?.name ?? null,
        person_id: a.person_id,
        person_name: a.people?.full_name ?? null,
        role_title: a.role_title ?? null,
        currency: a.currency ?? "BRL",
        hours: 0,
        amount: 0,
        entries_count: 0,
        min_date: null as string | null,
        max_date: null as string | null,
      };
      g.hours += h;
      g.amount += amount;
      g.entries_count += 1;
      const d = e.entry_date;
      if (d) {
        if (!g.min_date || d < g.min_date) g.min_date = d;
        if (!g.max_date || d > g.max_date) g.max_date = d;
      }
      groups.set(key, g);
    }

    const list = Array.from(groups.values()).map((g) => ({
      ...g,
      hours: Number(g.hours.toFixed(2)),
      amount: Number(g.amount.toFixed(2)),
    }));
    list.sort((a, b) => (a.company_name ?? "").localeCompare(b.company_name ?? ""));
    return { groups: list };
  });

const generateSchema = z.object({
  allocation_id: z.string().uuid(),
  start: z.string().optional(),
  end: z.string().optional(),
  due_date: z.string(),
  description: z.string().max(2000).optional(),
});

export const generateInvoiceFromTimesheet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => generateSchema.parse(i))
  .handler(async ({ data, context }) => {
    return financeRpc<{
      invoice: { id: string; invoice_number: string };
      entries_linked: number;
      total_hours: number;
      total_amount: number;
    }>(context.supabase, "finance_invoice_from_timesheet", {
      _allocation: data.allocation_id,
      _start: data.start ?? null,
      _end: data.end ?? null,
      _due: data.due_date,
      _description: data.description ?? null,
    });
  });

const approveSchema = z.object({
  allocation_id: z.string().uuid(),
  entry_ids: z.array(z.string().uuid()).optional(),
  start: z.string().optional(),
  end: z.string().optional(),
});

export const approveAllocationTimesheet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => approveSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const patch = { approved_at: new Date().toISOString(), approved_by: userId };
    if (data.entry_ids && data.entry_ids.length > 0) {
      const { error } = await supabase
        .from("project_time_entries")
        .update(patch)
        .in("id", data.entry_ids)
        .is("approved_at", null);
      if (error) throw new Error(error.message);
      return { approved: data.entry_ids.length };
    }
    let q = supabase
      .from("project_time_entries")
      .update(patch)
      .eq("allocation_id", data.allocation_id)
      .is("approved_at", null) as unknown as {
      gte: (k: string, v: string) => typeof q;
      lte: (k: string, v: string) => typeof q;
      then: Promise<{ error: { message: string } | null; count: number | null }>["then"];
    };
    if (data.start) q = q.gte("entry_date", data.start);
    if (data.end) q = q.lte("entry_date", data.end);
    const { error } = await (q as unknown as Promise<{ error: { message: string } | null }>);
    if (error) throw new Error(error.message);
    return { approved: 0 };
  });
