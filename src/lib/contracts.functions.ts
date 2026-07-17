// Server functions for Contracts (Sprint 2 MVP).
// CRUD, número gerado, criação a partir de deal, transições de status.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { randomBytes } from "crypto";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveActiveWorkspace } from "@/lib/active-workspace.server";

function token() {
  return randomBytes(24).toString("hex");
}

function generateNumber() {
  const yearMonth = new Date().toISOString().slice(0, 7).replace("-", "");
  return `C-${yearMonth}-${Math.floor(Math.random() * 9000 + 1000)}`;
}

const roleEnum = z.enum(["provider", "client"]);
const statusEnum = z.enum([
  "draft",
  "in_review",
  "in_negotiation",
  "awaiting_signature",
  "active",
  "renewing",
  "ended",
  "terminated",
]);

// ============= LIST =============

export const listContracts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        role: roleEnum.optional(),
        status: statusEnum.optional(),
        companyId: z.string().uuid().optional(),
        dealId: z.string().uuid().optional(),
        search: z.string().optional(),
        limit: z.number().int().min(1).max(500).optional(),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    let q = supabase
      .from("contracts")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(data.limit ?? 200);
    if (data.role) q = q.eq("role", data.role);
    if (data.status) q = q.eq("status", data.status);
    if (data.companyId) q = q.eq("counterparty_company_id", data.companyId);
    if (data.dealId) q = q.eq("deal_id", data.dealId);
    if (data.search && data.search.trim()) {
      const t = `%${data.search.trim()}%`;
      q = q.or(`title.ilike.${t},number.ilike.${t}`);
    }
    const { data: rows, error } = await q;
    if (error) throw error;
    return rows ?? [];
  });

export const getContract = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: row, error } = await supabase
      .from("contracts")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw error;
    return row;
  });

// ============= CREATE =============

const createInput = z.object({
  role: roleEnum.default("provider"),
  title: z.string().min(1),
  counterpartyCompanyId: z.string().uuid().nullable().optional(),
  dealId: z.string().uuid().nullable().optional(),
  totalValue: z.number().nonnegative().optional(),
  currency: z.string().default("BRL"),
  startsAt: z.string().nullable().optional(),
  endsAt: z.string().nullable().optional(),
  autoRenew: z.boolean().optional(),
  noticeDays: z.number().int().nonnegative().optional(),
  bodyHtml: z.string().nullable().optional(),
});

export const createContract = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => createInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    const { data: row, error } = await supabase
      .from("contracts")
      .insert({
        workspace_id: workspaceId,
        owner_id: userId,
        role: data.role,
        title: data.title,
        counterparty_company_id: data.counterpartyCompanyId ?? null,
        deal_id: data.dealId ?? null,
        total_value: data.totalValue ?? 0,
        currency: data.currency,
        starts_at: data.startsAt ?? null,
        ends_at: data.endsAt ?? null,
        auto_renew: data.autoRenew ?? false,
        notice_days: data.noticeDays ?? 30,
        body_html: data.bodyHtml ?? null,
        number: generateNumber(),
        public_token: token(),
        status: "draft",
      })
      .select("*")
      .single();
    if (error) throw error;
    return row;
  });

// ============= CREATE FROM DEAL =============
// Deal ganho → contrato provider herdando empresa e primeiros dados.

export const createContractFromDeal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ dealId: z.string().uuid(), title: z.string().optional() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);

    const { data: deal, error: dErr } = await supabase
      .from("deals")
      .select("id, name, currency, company_id, value")
      .eq("id", data.dealId)
      .maybeSingle();
    if (dErr) throw dErr;
    if (!deal) throw new Error("Negócio não encontrado");

    const { data: row, error } = await supabase
      .from("contracts")
      .insert({
        workspace_id: workspaceId,
        owner_id: userId,
        role: "provider",
        title: data.title ?? `Contrato — ${deal.name}`,
        counterparty_company_id: deal.company_id ?? null,
        deal_id: deal.id,
        total_value: Number(deal.value ?? 0),
        currency: deal.currency ?? "BRL",
        number: generateNumber(),
        public_token: token(),
        status: "draft",
      })
      .select("*")
      .single();
    if (error) throw error;
    return row;
  });

// ============= UPDATE =============

const patchInput = z.object({
  id: z.string().uuid(),
  patch: z
    .object({
      title: z.string().min(1).optional(),
      role: roleEnum.optional(),
      status: statusEnum.optional(),
      counterparty_company_id: z.string().uuid().nullable().optional(),
      deal_id: z.string().uuid().nullable().optional(),
      total_value: z.number().nonnegative().optional(),
      currency: z.string().optional(),
      starts_at: z.string().nullable().optional(),
      ends_at: z.string().nullable().optional(),
      auto_renew: z.boolean().optional(),
      notice_days: z.number().int().nonnegative().optional(),
      body_html: z.string().nullable().optional(),
      readjustment_index: z.string().nullable().optional(),
      readjustment_period: z.string().nullable().optional(),
      signed_at: z.string().nullable().optional(),
    })
    .strict(),
});

export const updateContract = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => patchInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: row, error } = await supabase
      .from("contracts")
      .update(data.patch)
      .eq("id", data.id)
      .select("*")
      .single();
    if (error) throw error;
    return row;
  });

// ============= DELETE =============

export const deleteContract = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.from("contracts").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });
