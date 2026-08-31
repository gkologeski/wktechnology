// Server functions for the Finance module (Sprint 4 MVP).
// Unified financial_entries (AR/AP), payments, categories, bank accounts and dashboard.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveActiveWorkspace } from "@/lib/active-workspace.server";
import { deleteByIdGuarded } from "@/lib/db/delete-guarded";

const directionEnum = z.enum(["receivable", "payable"]);
const originEnum = z.enum(["contract", "service", "project_milestone", "manual", "expense"]);
const statusEnum = z.enum(["open", "partial", "paid", "overdue", "cancelled"]);
const categoryKindEnum = z.enum(["revenue", "expense"]);

// ============================================================
// Entries
// ============================================================

export const listFinancialEntries = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        direction: directionEnum.optional(),
        status: statusEnum.optional(),
        companyId: z.string().uuid().optional(),
        contractId: z.string().uuid().optional(),
        serviceId: z.string().uuid().optional(),
        categoryId: z.string().uuid().optional(),
        legalEntityId: z.string().uuid().optional(),
        legalEntityIds: z.array(z.string().uuid()).optional(),
        search: z.string().optional(),
        from: z.string().optional(), // due_date >=
        to: z.string().optional(), // due_date <=
        limit: z.number().int().min(1).max(1000).optional(),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    let q = supabase
      .from("financial_entries")
      .select(
        "*, financial_categories(id, name, kind), companies:counterparty_company_id(id, name), contracts(id, number, title), services(id, name)",
      )
      .order("due_date", { ascending: true })
      .limit(data.limit ?? 500);

    if (data.direction) q = q.eq("direction", data.direction);
    if (data.status) q = q.eq("status", data.status);
    if (data.companyId) q = q.eq("counterparty_company_id", data.companyId);
    if (data.contractId) q = q.eq("contract_id", data.contractId);
    if (data.serviceId) q = q.eq("service_id", data.serviceId);
    if (data.categoryId) q = q.eq("category_id", data.categoryId);
    if (data.legalEntityId) q = q.eq("legal_entity_id", data.legalEntityId);
    if (data.legalEntityIds && data.legalEntityIds.length)
      q = q.in("legal_entity_id", data.legalEntityIds);
    if (data.from) q = q.gte("due_date", data.from);
    if (data.to) q = q.lte("due_date", data.to);
    if (data.search && data.search.trim()) q = q.ilike("description", `%${data.search.trim()}%`);

    const { data: rows, error } = await q;
    if (error) throw error;
    return rows ?? [];
  });

export const getFinancialEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: entry, error } = await supabase
      .from("financial_entries")
      .select(
        "*, financial_categories(id, name, kind), companies:counterparty_company_id(id, name), contracts(id, number, title), services(id, name)",
      )
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw error;
    if (!entry) return null;

    const { data: payments } = await supabase
      .from("financial_payments")
      .select("*, financial_bank_accounts(id, name)")
      .eq("entry_id", data.id)
      .order("paid_at", { ascending: false });

    return { ...entry, payments: payments ?? [] };
  });

const createEntryInput = z.object({
  direction: directionEnum,
  origin_type: originEnum.default("manual"),
  description: z.string().min(1),
  amount: z.number().positive(),
  currency: z.string().default("BRL"),
  competence_date: z.string(),
  due_date: z.string(),
  counterparty_company_id: z.string().uuid().nullable().optional(),
  counterparty_legal_entity_id: z.string().uuid().nullable().optional(),
  category_id: z.string().uuid().nullable().optional(),
  contract_id: z.string().uuid().nullable().optional(),
  service_id: z.string().uuid().nullable().optional(),
  project_id: z.string().uuid().nullable().optional(),
  notes: z.string().nullable().optional(),
  payment_method: z.string().nullable().optional(),
  external_ref: z.string().nullable().optional(),
});

export const createFinancialEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => createEntryInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    const { data: row, error } = await supabase
      .from("financial_entries")
      .insert({
        workspace_id: workspaceId,
        owner_id: userId,
        direction: data.direction,
        origin_type: data.origin_type,
        description: data.description,
        amount: data.amount,
        currency: data.currency,
        competence_date: data.competence_date,
        due_date: data.due_date,
        counterparty_company_id: data.counterparty_company_id ?? null,
        counterparty_legal_entity_id: data.counterparty_legal_entity_id ?? null,
        category_id: data.category_id ?? null,
        contract_id: data.contract_id ?? null,
        service_id: data.service_id ?? null,
        project_id: data.project_id ?? null,
        notes: data.notes ?? null,
        payment_method: data.payment_method ?? null,
        external_ref: data.external_ref ?? null,
        status: "open",
      })
      .select("*")
      .single();
    if (error) throw error;
    return row;
  });

export const updateFinancialEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        id: z.string().uuid(),
        patch: z
          .object({
            description: z.string().min(1).optional(),
            amount: z.number().positive().optional(),
            currency: z.string().optional(),
            competence_date: z.string().optional(),
            due_date: z.string().optional(),
            counterparty_company_id: z.string().uuid().nullable().optional(),
            counterparty_legal_entity_id: z.string().uuid().nullable().optional(),
            category_id: z.string().uuid().nullable().optional(),
            notes: z.string().nullable().optional(),
            payment_method: z.string().nullable().optional(),
            status: statusEnum.optional(),
          })
          .strict(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: row, error } = await supabase
      .from("financial_entries")
      .update(data.patch)
      .eq("id", data.id)
      .select("*")
      .single();
    if (error) throw error;
    return row;
  });

export const cancelFinancialEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("financial_entries")
      .update({ status: "cancelled" })
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const deleteFinancialEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    await deleteByIdGuarded(supabase, "financial_entries", data.id);
    return { ok: true };
  });

// ============================================================
// Payments
// ============================================================

export const registerPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        entry_id: z.string().uuid(),
        amount: z.number().positive(),
        paid_at: z.string(),
        method: z.string().nullable().optional(),
        bank_account_id: z.string().uuid().nullable().optional(),
        reference: z.string().nullable().optional(),
        notes: z.string().nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    const { data: row, error } = await supabase
      .from("financial_payments")
      .insert({
        workspace_id: workspaceId,
        created_by: userId,
        entry_id: data.entry_id,
        amount: data.amount,
        paid_at: data.paid_at,
        method: data.method ?? null,
        bank_account_id: data.bank_account_id ?? null,
        reference: data.reference ?? null,
        notes: data.notes ?? null,
      })
      .select("*")
      .single();
    if (error) throw error;
    // status/paid_amount recalculado por trigger public.recalc_financial_entry
    return row;
  });

export const deletePayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    await deleteByIdGuarded(supabase, "financial_payments", data.id);
    return { ok: true };
  });

// ============================================================
// Categories
// ============================================================

export const listCategories = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        legalEntityId: z.string().uuid().optional(),
        legalEntityIds: z.array(z.string().uuid()).optional(),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    let q = supabase
      .from("financial_categories")
      .select("*")
      .order("kind", { ascending: true })
      .order("name", { ascending: true });
    if (data.legalEntityId) q = q.eq("legal_entity_id", data.legalEntityId);
    if (data.legalEntityIds && data.legalEntityIds.length)
      q = q.in("legal_entity_id", data.legalEntityIds);
    const { data: rows, error } = await q;
    if (error) throw error;
    return rows ?? [];
  });

export const createCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        name: z.string().min(1),
        kind: categoryKindEnum,
        code: z.string().nullable().optional(),
        parent_id: z.string().uuid().nullable().optional(),
        legal_entity_id: z.string().uuid().nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    const { data: row, error } = await supabase
      .from("financial_categories")
      .insert({
        workspace_id: workspaceId,
        name: data.name,
        kind: data.kind,
        code: data.code ?? null,
        parent_id: data.parent_id ?? null,
        legal_entity_id: data.legal_entity_id ?? null,
      })
      .select("*")
      .single();
    if (error) throw error;
    return row;
  });

export const deleteCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    await deleteByIdGuarded(supabase, "financial_categories", data.id);
    return { ok: true };
  });

// ============================================================
// Bank accounts
// ============================================================

export const listBankAccounts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        legalEntityId: z.string().uuid().optional(),
        legalEntityIds: z.array(z.string().uuid()).optional(),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    let q = supabase.from("financial_bank_accounts").select("*").order("name", { ascending: true });
    if (data.legalEntityId) q = q.eq("legal_entity_id", data.legalEntityId);
    if (data.legalEntityIds && data.legalEntityIds.length)
      q = q.in("legal_entity_id", data.legalEntityIds);
    const { data: rows, error } = await q;
    if (error) throw error;
    return rows ?? [];
  });

export const createBankAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        name: z.string().min(1),
        kind: z.string().default("checking"),
        currency: z.string().default("BRL"),
        initial_balance: z.number().default(0),
        legal_entity_id: z.string().uuid().nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    const { data: row, error } = await supabase
      .from("financial_bank_accounts")
      .insert({
        workspace_id: workspaceId,
        name: data.name,
        kind: data.kind,
        currency: data.currency,
        initial_balance: data.initial_balance,
        legal_entity_id: data.legal_entity_id ?? null,
      })
      .select("*")
      .single();
    if (error) throw error;
    return row;
  });

export const updateBankAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        id: z.string().uuid(),
        patch: z
          .object({
            name: z.string().min(1).optional(),
            kind: z.string().optional(),
            currency: z.string().optional(),
            initial_balance: z.number().optional(),
            active: z.boolean().optional(),
          })
          .strict(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: row, error } = await supabase
      .from("financial_bank_accounts")
      .update(data.patch)
      .eq("id", data.id)
      .select("*")
      .single();
    if (error) throw error;
    return row;
  });

// ============================================================
// Dashboard
// ============================================================

export const getFinanceDashboard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        legalEntityId: z.string().uuid().optional(),
        legalEntityIds: z.array(z.string().uuid()).optional(),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const today = new Date();
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    const addDays = (d: Date, n: number) => {
      const c = new Date(d);
      c.setDate(c.getDate() + n);
      return c;
    };

    let q = supabase
      .from("financial_entries")
      .select("direction, status, amount, paid_amount, due_date")
      .in("status", ["open", "partial", "overdue", "paid"])
      .gte("due_date", iso(addDays(today, -180)))
      .lte("due_date", iso(addDays(today, 180)));
    if (data.legalEntityId) q = q.eq("legal_entity_id", data.legalEntityId);
    if (data.legalEntityIds && data.legalEntityIds.length)
      q = q.in("legal_entity_id", data.legalEntityIds);
    const { data: entries, error } = await q;
    if (error) throw error;

    const todayIso = iso(today);
    const in30 = iso(addDays(today, 30));
    const in60 = iso(addDays(today, 60));
    const in90 = iso(addDays(today, 90));

    let ar_open = 0,
      ar_overdue = 0,
      ap_open = 0,
      ap_overdue = 0,
      ar_30 = 0,
      ar_60 = 0,
      ar_90 = 0,
      ap_30 = 0,
      ap_60 = 0,
      ap_90 = 0,
      ar_paid = 0,
      ap_paid = 0;

    for (const e of entries ?? []) {
      const outstanding = Number(e.amount) - Number(e.paid_amount ?? 0);
      const isAR = e.direction === "receivable";
      if (e.status === "paid") {
        if (isAR) ar_paid += Number(e.amount);
        else ap_paid += Number(e.amount);
        continue;
      }
      const overdue = e.due_date < todayIso && e.status !== "cancelled";
      if (isAR) {
        ar_open += outstanding;
        if (overdue) ar_overdue += outstanding;
        if (e.due_date <= in30) ar_30 += outstanding;
        else if (e.due_date <= in60) ar_60 += outstanding;
        else if (e.due_date <= in90) ar_90 += outstanding;
      } else {
        ap_open += outstanding;
        if (overdue) ap_overdue += outstanding;
        if (e.due_date <= in30) ap_30 += outstanding;
        else if (e.due_date <= in60) ap_60 += outstanding;
        else if (e.due_date <= in90) ap_90 += outstanding;
      }
    }

    return {
      ar: {
        open: ar_open,
        overdue: ar_overdue,
        paid_180d: ar_paid,
        d30: ar_30,
        d60: ar_60,
        d90: ar_90,
      },
      ap: {
        open: ap_open,
        overdue: ap_overdue,
        paid_180d: ap_paid,
        d30: ap_30,
        d60: ap_60,
        d90: ap_90,
      },
      net_30: ar_30 - ap_30,
      net_60: ar_60 - ap_60,
      net_90: ar_90 - ap_90,
    };
  });

// ============================================================
// DRE gerencial (P&L por competência)
// ============================================================

export const getDreReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        months: z.number().int().min(1).max(24).default(6),
        endMonth: z.string().optional(), // YYYY-MM
        basis: z.enum(["accrual", "cash"]).default("accrual"),
        legalEntityId: z.string().uuid().optional(),
        legalEntityIds: z.array(z.string().uuid()).optional(),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const now = new Date();
    const [ey, em] = data.endMonth
      ? data.endMonth.split("-").map(Number)
      : [now.getUTCFullYear(), now.getUTCMonth() + 1];
    const endDate = new Date(Date.UTC(ey, em, 0));
    const startDate = new Date(Date.UTC(ey, em - data.months, 1));
    const iso = (d: Date) => d.toISOString().slice(0, 10);

    const months: string[] = [];
    for (let i = data.months - 1; i >= 0; i--) {
      const d = new Date(Date.UTC(ey, em - 1 - i, 1));
      months.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
    }

    type CatAgg = {
      category_id: string | null;
      category_name: string;
      kind: "revenue" | "expense";
      byMonth: Record<string, number>;
      total: number;
    };
    const map = new Map<string, CatAgg>();

    const addRow = (
      cat: { id: string; name: string; kind: "revenue" | "expense" } | null,
      direction: string,
      amount: number,
      ym: string,
    ) => {
      const kind: "revenue" | "expense" =
        cat?.kind ?? (direction === "receivable" ? "revenue" : "expense");
      const key = cat?.id ?? `__uncat_${kind}`;
      const name =
        cat?.name ?? (kind === "revenue" ? "Sem categoria (receitas)" : "Sem categoria (despesas)");
      if (!months.includes(ym)) return;
      let agg = map.get(key);
      if (!agg) {
        agg = { category_id: cat?.id ?? null, category_name: name, kind, byMonth: {}, total: 0 };
        for (const m of months) agg.byMonth[m] = 0;
        map.set(key, agg);
      }
      agg.byMonth[ym] += Number(amount);
      agg.total += Number(amount);
    };

    // Grupo empresarial: quando >=2 CNPJs, elimina transações intercompany
    // (contra-parte também está no grupo) para evitar dupla contagem.
    const groupIds =
      data.legalEntityIds && data.legalEntityIds.length >= 2 ? data.legalEntityIds : null;
    let intercompanyEliminated = 0;

    if (data.basis === "cash") {
      let pq = supabase
        .from("financial_payments")
        .select(
          "amount, paid_at, financial_entries!inner(direction, status, category_id, legal_entity_id, counterparty_legal_entity_id, financial_categories(id, name, kind))",
        )
        .gte("paid_at", iso(startDate))
        .lte("paid_at", iso(endDate));
      if (data.legalEntityId) pq = pq.eq("financial_entries.legal_entity_id", data.legalEntityId);
      if (data.legalEntityIds && data.legalEntityIds.length)
        pq = pq.in("financial_entries.legal_entity_id", data.legalEntityIds);
      const { data: payments, error } = await pq;
      if (error) throw error;
      for (const p of payments ?? []) {
        const entry = (
          p as unknown as {
            financial_entries: {
              direction: string;
              status: string;
              counterparty_legal_entity_id: string | null;
              financial_categories: {
                id: string;
                name: string;
                kind: "revenue" | "expense";
              } | null;
            };
          }
        ).financial_entries;
        if (!entry || entry.status === "cancelled") continue;
        if (
          groupIds &&
          entry.counterparty_legal_entity_id &&
          groupIds.includes(entry.counterparty_legal_entity_id)
        ) {
          intercompanyEliminated++;
          continue;
        }
        const ym = String(p.paid_at).slice(0, 7);
        addRow(entry.financial_categories, entry.direction, Number(p.amount), ym);
      }
    } else {
      let eq = supabase
        .from("financial_entries")
        .select(
          "direction, amount, competence_date, category_id, status, counterparty_legal_entity_id, financial_categories(id, name, kind)",
        )
        .neq("status", "cancelled")
        .gte("competence_date", iso(startDate))
        .lte("competence_date", iso(endDate));
      if (data.legalEntityId) eq = eq.eq("legal_entity_id", data.legalEntityId);
      if (data.legalEntityIds && data.legalEntityIds.length)
        eq = eq.in("legal_entity_id", data.legalEntityIds);
      const { data: rows, error } = await eq;
      if (error) throw error;
      for (const r of rows ?? []) {
        const row = r as unknown as {
          counterparty_legal_entity_id: string | null;
          financial_categories: { id: string; name: string; kind: "revenue" | "expense" } | null;
        };
        if (
          groupIds &&
          row.counterparty_legal_entity_id &&
          groupIds.includes(row.counterparty_legal_entity_id)
        ) {
          intercompanyEliminated++;
          continue;
        }
        const ym = String(r.competence_date).slice(0, 7);
        addRow(row.financial_categories, r.direction, Number(r.amount), ym);
      }
    }

    const categories = Array.from(map.values()).sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === "revenue" ? -1 : 1;
      return b.total - a.total;
    });

    const totals = {
      revenue: months.map((m) =>
        categories.filter((c) => c.kind === "revenue").reduce((s, c) => s + (c.byMonth[m] ?? 0), 0),
      ),
      expense: months.map((m) =>
        categories.filter((c) => c.kind === "expense").reduce((s, c) => s + (c.byMonth[m] ?? 0), 0),
      ),
    };
    const result = months.map((_, i) => totals.revenue[i] - totals.expense[i]);
    const totalRevenue = totals.revenue.reduce((a, b) => a + b, 0);
    const totalExpense = totals.expense.reduce((a, b) => a + b, 0);

    return {
      months,
      categories,
      totals: {
        ...totals,
        result,
        totalRevenue,
        totalExpense,
        netResult: totalRevenue - totalExpense,
        margin: totalRevenue > 0 ? (totalRevenue - totalExpense) / totalRevenue : 0,
      },
      consolidation: {
        isGroup: !!groupIds,
        groupSize: groupIds?.length ?? 0,
        intercompanyEliminated,
      },
    };
  });

// ============================================================
// Fluxo de caixa 30/60/90 com cenários
// ============================================================

export const getCashFlowProjection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        pessimistic: z.number().min(0).max(2).default(0.7),
        realistic: z.number().min(0).max(2).default(1),
        optimistic: z.number().min(0).max(2).default(1.05),
        expenseFactorPessimistic: z.number().min(0).max(2).default(1),
        expenseFactorRealistic: z.number().min(0).max(2).default(1),
        expenseFactorOptimistic: z.number().min(0).max(2).default(1),
        legalEntityId: z.string().uuid().optional(),
        legalEntityIds: z.array(z.string().uuid()).optional(),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const today = new Date();
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    const addDays = (d: Date, n: number) => {
      const c = new Date(d);
      c.setDate(c.getDate() + n);
      return c;
    };

    let banksQ = supabase
      .from("financial_bank_accounts")
      .select("id, name, initial_balance, active");
    if (data.legalEntityId) banksQ = banksQ.eq("legal_entity_id", data.legalEntityId);
    if (data.legalEntityIds && data.legalEntityIds.length)
      banksQ = banksQ.in("legal_entity_id", data.legalEntityIds);
    const groupIds =
      data.legalEntityIds && data.legalEntityIds.length >= 2 ? data.legalEntityIds : null;
    let entriesQ = supabase
      .from("financial_entries")
      .select("direction, status, amount, paid_amount, due_date, counterparty_legal_entity_id")
      .in("status", ["open", "partial", "overdue"])
      .lte("due_date", iso(addDays(today, 90)));
    if (data.legalEntityId) entriesQ = entriesQ.eq("legal_entity_id", data.legalEntityId);
    if (data.legalEntityIds && data.legalEntityIds.length)
      entriesQ = entriesQ.in("legal_entity_id", data.legalEntityIds);
    const [banks, entriesRes] = await Promise.all([banksQ, entriesQ]);
    if (banks.error) throw banks.error;
    if (entriesRes.error) throw entriesRes.error;

    const openingBalance = (banks.data ?? [])
      .filter((b) => b.active !== false)
      .reduce((s, b) => s + Number(b.initial_balance ?? 0), 0);

    const in30 = iso(addDays(today, 30));
    const in60 = iso(addDays(today, 60));
    const in90 = iso(addDays(today, 90));
    const todayIso = iso(today);

    type Bucket = { inflow: number; outflow: number };
    const b: Record<"overdue" | "d30" | "d60" | "d90", Bucket> = {
      overdue: { inflow: 0, outflow: 0 },
      d30: { inflow: 0, outflow: 0 },
      d60: { inflow: 0, outflow: 0 },
      d90: { inflow: 0, outflow: 0 },
    };

    let intercompanyEliminated = 0;
    for (const e of entriesRes.data ?? []) {
      const outstanding = Number(e.amount) - Number(e.paid_amount ?? 0);
      if (outstanding <= 0) continue;
      const cp = (e as unknown as { counterparty_legal_entity_id: string | null })
        .counterparty_legal_entity_id;
      if (groupIds && cp && groupIds.includes(cp)) {
        intercompanyEliminated++;
        continue;
      }
      const isAR = e.direction === "receivable";
      let key: keyof typeof b;
      if (e.due_date < todayIso) key = "overdue";
      else if (e.due_date <= in30) key = "d30";
      else if (e.due_date <= in60) key = "d60";
      else if (e.due_date <= in90) key = "d90";
      else continue;
      if (isAR) b[key].inflow += outstanding;
      else b[key].outflow += outstanding;
    }

    const scenario = (arFactor: number, apFactor: number) => {
      const buckets = (["overdue", "d30", "d60", "d90"] as const).map((k) => {
        const inflow = b[k].inflow * arFactor;
        const outflow = b[k].outflow * apFactor;
        return { key: k, inflow, outflow, net: inflow - outflow };
      });
      let running = openingBalance;
      const cumulative = buckets.map((row) => {
        running += row.net;
        return { ...row, balance: running };
      });
      return {
        buckets: cumulative,
        finalBalance: running,
        totalInflow: buckets.reduce((s, x) => s + x.inflow, 0),
        totalOutflow: buckets.reduce((s, x) => s + x.outflow, 0),
      };
    };

    return {
      openingBalance,
      raw: b,
      scenarios: {
        pessimistic: scenario(data.pessimistic, data.expenseFactorPessimistic),
        realistic: scenario(data.realistic, data.expenseFactorRealistic),
        optimistic: scenario(data.optimistic, data.expenseFactorOptimistic),
      },
      consolidation: {
        isGroup: !!groupIds,
        groupSize: groupIds?.length ?? 0,
        intercompanyEliminated,
      },
    };
  });

// ============================================================
// Sprint H — Fase 1: Parcelamentos
// ============================================================

const cadenceEnum = z.enum(["monthly", "weekly", "custom_days"]);
const splitModeEnum = z.enum(["equal", "first_bigger", "custom_amounts"]);

function addMonths(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const target = new Date(Date.UTC(y, m - 1 + n, 1));
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  target.setUTCDate(Math.min(d, lastDay));
  return target.toISOString().slice(0, 10);
}

function addDays(iso: string, n: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function roundCents(n: number): number {
  return Math.round(n * 100) / 100;
}

export const createInstallments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        base: createEntryInput,
        count: z.number().int().min(2).max(120),
        cadence: cadenceEnum,
        custom_interval_days: z.number().int().min(1).max(365).optional(),
        split_mode: splitModeEnum.default("equal"),
        custom_amounts: z.array(z.number().positive()).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    const total = data.base.amount;

    let amounts: number[] = [];
    if (data.split_mode === "custom_amounts") {
      if (!data.custom_amounts || data.custom_amounts.length !== data.count) {
        throw new Error("Informe um valor para cada parcela.");
      }
      amounts = data.custom_amounts.map(roundCents);
      const sum = roundCents(amounts.reduce((a, b) => a + b, 0));
      if (Math.abs(sum - roundCents(total)) > 0.01) {
        throw new Error(`Soma das parcelas (${sum}) difere do total (${total}).`);
      }
    } else {
      const each = roundCents(total / data.count);
      amounts = Array(data.count).fill(each);
      const diff = roundCents(total - each * data.count);
      if (Math.abs(diff) > 0.001) {
        if (data.split_mode === "first_bigger") amounts[0] = roundCents(amounts[0] + diff);
        else amounts[amounts.length - 1] = roundCents(amounts[amounts.length - 1] + diff);
      }
    }

    const dueDates: string[] = [];
    for (let i = 0; i < data.count; i++) {
      if (data.cadence === "monthly") dueDates.push(addMonths(data.base.due_date, i));
      else if (data.cadence === "weekly") dueDates.push(addDays(data.base.due_date, i * 7));
      else dueDates.push(addDays(data.base.due_date, i * (data.custom_interval_days ?? 30)));
    }

    const parentInsert = {
      workspace_id: workspaceId,
      owner_id: userId,
      direction: data.base.direction,
      origin_type: data.base.origin_type,
      description: `${data.base.description} (1/${data.count})`,
      amount: amounts[0],
      currency: data.base.currency,
      competence_date: data.base.competence_date,
      due_date: dueDates[0],
      counterparty_company_id: data.base.counterparty_company_id ?? null,
      category_id: data.base.category_id ?? null,
      contract_id: data.base.contract_id ?? null,
      service_id: data.base.service_id ?? null,
      project_id: data.base.project_id ?? null,
      notes: data.base.notes ?? null,
      payment_method: data.base.payment_method ?? null,
      external_ref: data.base.external_ref ?? null,
      status: "open" as const,
      installment_number: 1,
      installment_total: data.count,
    };

    const { data: parent, error: parentErr } = await supabase
      .from("financial_entries")
      .insert(parentInsert)
      .select("*")
      .single();
    if (parentErr) throw parentErr;

    if (data.count > 1) {
      const rest = [];
      for (let i = 1; i < data.count; i++) {
        rest.push({
          ...parentInsert,
          description: `${data.base.description} (${i + 1}/${data.count})`,
          amount: amounts[i],
          due_date: dueDates[i],
          installment_number: i + 1,
          parent_entry_id: parent.id,
        });
      }
      const { error: restErr } = await supabase.from("financial_entries").insert(rest);
      if (restErr) throw restErr;
    }

    return { parent_id: parent.id, count: data.count, total_amount: roundCents(total) };
  });

export const listInstallmentSiblings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ entry_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: entry, error: eErr } = await supabase
      .from("financial_entries")
      .select("id, parent_entry_id, installment_total")
      .eq("id", data.entry_id)
      .maybeSingle();
    if (eErr) throw eErr;
    if (!entry) return [];
    const parentId = entry.parent_entry_id ?? entry.id;
    const { data: rows, error } = await supabase
      .from("financial_entries")
      .select(
        "id, description, amount, due_date, status, installment_number, installment_total, parent_entry_id",
      )
      .or(`id.eq.${parentId},parent_entry_id.eq.${parentId}`)
      .order("installment_number", { ascending: true });
    if (error) throw error;
    return rows ?? [];
  });

export const deleteInstallmentGroup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({ parent_entry_id: z.string().uuid(), only_open: z.boolean().default(true) })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const parentId = data.parent_entry_id;
    const { data: rows, error } = await supabase
      .from("financial_entries")
      .select("id, status, installment_number")
      .or(`id.eq.${parentId},parent_entry_id.eq.${parentId}`);
    if (error) throw error;
    const list = rows ?? [];
    const deletable = list.filter((r) =>
      data.only_open ? r.status === "open" || r.status === "overdue" : true,
    );
    const kept = list.filter((r) => !deletable.find((d) => d.id === r.id));
    if (deletable.length === 0) return { deleted: 0, kept: kept.length };
    const ids = deletable.map((r) => r.id);
    const { error: delErr } = await supabase.from("financial_entries").delete().in("id", ids);
    if (delErr) throw delErr;
    return { deleted: deletable.length, kept: kept.length };
  });
