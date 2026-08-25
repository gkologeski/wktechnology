// TechPeople · Sprint 14 — Margem por Contrato
// Consolida por contrato: horas apontadas, receita (billable), custo (cost_rate)
// e margem, a partir de project_time_entries + people_allocations.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ContractMarginRow = {
  contract_id: string | null;
  contract_number: string | null;
  contract_title: string | null;
  company_id: string | null;
  company_name: string | null;
  currency: string;
  hours: number;
  billable_hours: number;
  revenue: number;
  cost: number;
  margin: number;
  margin_pct: number;
  invoiced_amount: number;
  people_count: number;
};

type EntryRow = {
  id: string;
  entry_date: string | null;
  hours: number | null;
  hourly_rate: number | null;
  billable: boolean | null;
  invoice_id: string | null;
  allocation_id: string | null;
  person_id: string | null;
};

type AllocRow = {
  id: string;
  currency: string | null;
  cost_rate: number | null;
  billable_rate: number | null;
  person_id: string;
  contract_id: string | null;
  contracts: {
    id: string;
    contract_number: string | null;
    title: string | null;
    company_id: string | null;
    companies: { id: string; name: string | null } | null;
  } | null;
};

const schema = z.object({
  start: z.string().optional(),
  end: z.string().optional(),
});

export const getContractMarginReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => schema.parse(i ?? {}))
  .handler(async ({ data, context }): Promise<{ rows: ContractMarginRow[] }> => {
    const { supabase } = context;

    let q = supabase
      .from("project_time_entries")
      .select("id, entry_date, hours, hourly_rate, billable, invoice_id, allocation_id, person_id")
      .not("allocation_id", "is", null) as unknown as {
      gte: (k: string, v: string) => typeof q;
      lte: (k: string, v: string) => typeof q;
      then: Promise<{ data: EntryRow[] | null; error: { message: string } | null }>["then"];
    };
    if (data.start) q = q.gte("entry_date", data.start);
    if (data.end) q = q.lte("entry_date", data.end);
    const { data: entries, error } = await (q as unknown as Promise<{
      data: EntryRow[] | null;
      error: { message: string } | null;
    }>);
    if (error) throw new Error(error.message);
    if (!entries || entries.length === 0) return { rows: [] };

    const allocIds = Array.from(new Set(entries.map((e) => e.allocation_id!).filter(Boolean)));
    const { data: allocs, error: aErr } = await supabase
      .from("people_allocations")
      .select(
        "id, currency, cost_rate, billable_rate, person_id, contract_id, contracts:contract_id(id, contract_number, title, company_id, companies:company_id(id, name))",
      )
      .in("id", allocIds);
    if (aErr) throw new Error(aErr.message);
    const allocMap = new Map<string, AllocRow>();
    for (const a of (allocs as unknown as AllocRow[] | null) ?? []) allocMap.set(a.id, a);

    const invoiceIds = Array.from(
      new Set(entries.map((e) => e.invoice_id).filter((v): v is string => !!v)),
    );
    const invoiceAmountByContract = new Map<string, number>();
    if (invoiceIds.length > 0) {
      const { data: invs } = await supabase
        .from("customer_invoices")
        .select("id, amount")
        .in("id", invoiceIds);
      const invAmt = new Map<string, number>();
      for (const inv of (invs as { id: string; amount: number | null }[] | null) ?? []) {
        invAmt.set(inv.id, Number(inv.amount ?? 0));
      }
      // Rateia o valor faturado por contrato conforme total de horas do invoice_id
      const hoursByInvoiceContract = new Map<string, Map<string, number>>();
      for (const e of entries) {
        if (!e.invoice_id) continue;
        const a = allocMap.get(e.allocation_id!);
        const key = a?.contract_id ?? "__none__";
        const inner = hoursByInvoiceContract.get(e.invoice_id) ?? new Map<string, number>();
        inner.set(key, (inner.get(key) ?? 0) + Number(e.hours ?? 0));
        hoursByInvoiceContract.set(e.invoice_id, inner);
      }
      for (const [invId, inner] of hoursByInvoiceContract.entries()) {
        const total = Array.from(inner.values()).reduce((s, v) => s + v, 0);
        const amount = invAmt.get(invId) ?? 0;
        if (total <= 0) continue;
        for (const [ck, h] of inner.entries()) {
          const share = (h / total) * amount;
          invoiceAmountByContract.set(ck, (invoiceAmountByContract.get(ck) ?? 0) + share);
        }
      }
    }

    const rows = new Map<string, ContractMarginRow>();
    const peopleByContract = new Map<string, Set<string>>();
    for (const e of entries) {
      const a = allocMap.get(e.allocation_id!);
      const key = a?.contract_id ?? "__none__";
      const h = Number(e.hours ?? 0);
      const rev = e.billable ? h * Number(e.hourly_rate ?? a?.billable_rate ?? 0) : 0;
      const cost = h * Number(a?.cost_rate ?? 0);
      const r = rows.get(key) ?? {
        contract_id: a?.contract_id ?? null,
        contract_number: a?.contracts?.contract_number ?? null,
        contract_title: a?.contracts?.title ?? null,
        company_id: a?.contracts?.company_id ?? null,
        company_name: a?.contracts?.companies?.name ?? null,
        currency: a?.currency ?? "BRL",
        hours: 0,
        billable_hours: 0,
        revenue: 0,
        cost: 0,
        margin: 0,
        margin_pct: 0,
        invoiced_amount: 0,
        people_count: 0,
      };
      r.hours += h;
      if (e.billable) r.billable_hours += h;
      r.revenue += rev;
      r.cost += cost;
      rows.set(key, r);
      const pset = peopleByContract.get(key) ?? new Set<string>();
      if (e.person_id) pset.add(e.person_id);
      peopleByContract.set(key, pset);
    }

    const list = Array.from(rows.entries()).map(([k, r]) => {
      const invoiced = invoiceAmountByContract.get(k) ?? 0;
      const margin = r.revenue - r.cost;
      const pct = r.revenue > 0 ? (margin / r.revenue) * 100 : 0;
      return {
        ...r,
        hours: Number(r.hours.toFixed(2)),
        billable_hours: Number(r.billable_hours.toFixed(2)),
        revenue: Number(r.revenue.toFixed(2)),
        cost: Number(r.cost.toFixed(2)),
        margin: Number(margin.toFixed(2)),
        margin_pct: Number(pct.toFixed(1)),
        invoiced_amount: Number(invoiced.toFixed(2)),
        people_count: peopleByContract.get(k)?.size ?? 0,
      };
    });
    list.sort((a, b) => b.revenue - a.revenue);
    return { rows: list };
  });
