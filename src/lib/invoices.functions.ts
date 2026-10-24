import { authorizeFinanceBusiness } from "@/lib/access-control/finance-business.server";
import { orSafeLike } from "@/lib/postgrest-search";
// Server functions para faturas de clientes (Release 15 — Cobrança BR).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveActiveWorkspace } from "@/lib/active-workspace.server";

const GatewayZ = z.enum(["asaas", "pagarme", "mercadopago", "manual"]);
const MethodZ = z.enum(["boleto", "pix", "credit_card", "manual"]);
const StatusZ = z.enum(["draft", "open", "paid", "overdue", "cancelled", "refunded"]);

async function nextInvoiceNumber(workspaceId: string): Promise<string> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const year = new Date().getUTCFullYear();
  const { count } = await supabaseAdmin
    .from("customer_invoices")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId);
  const seq = String((count ?? 0) + 1).padStart(5, "0");
  return `INV-${year}-${seq}`;
}

export const listInvoices = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        status: StatusZ.or(z.literal("all")).default("all"),
        gateway: GatewayZ.or(z.literal("all")).default("all"),
        search: z.string().max(200).optional(),
        limit: z.number().int().min(1).max(200).default(100),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    await authorizeFinanceBusiness(context.supabase, "invoices", "view", undefined);
    let q = context.supabase
      .from("customer_invoices")
      .select("*, companies(id, name)")
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (data.status !== "all") q = q.eq("status", data.status);
    if (data.gateway !== "all") q = q.eq("gateway", data.gateway);
    if (data.search)
      q = q.or(
        `invoice_number.ilike.${orSafeLike(data.search)},description.ilike.${orSafeLike(data.search)}`,
      );
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { invoices: rows ?? [] };
  });

export const getInvoice = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await authorizeFinanceBusiness(context.supabase, "invoices", "view", data.id);
    const { data: invoice, error } = await context.supabase
      .from("customer_invoices")
      .select("*")
      .eq("id", data.id)
      .single();
    if (error) throw new Error(error.message);
    const { data: payments, error: paymentError } = await context.supabase
      .from("customer_payments")
      .select("id,invoice_id,gateway,amount,currency,status,method,received_at,created_at")
      .eq("invoice_id", data.id)
      .order("created_at", { ascending: false });
    if (paymentError) throw new Error(paymentError.message);
    return { invoice, payments: payments ?? [], events: [] };
  });

export const createInvoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        description: z.string().max(2000).optional(),
        amount: z.number().min(0),
        currency: z.string().length(3).default("BRL"),
        due_date: z.string(),
        gateway: GatewayZ.default("manual"),
        payment_method: MethodZ.default("manual"),
        contact_id: z.string().uuid().nullable().optional(),
        company_id: z.string().uuid().nullable().optional(),
        deal_id: z.string().uuid().nullable().optional(),
        quote_id: z.string().uuid().nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await authorizeFinanceBusiness(context.supabase, "invoices", "create", undefined);
    const workspaceId = await resolveActiveWorkspace(context.userId);
    const number = await nextInvoiceNumber(workspaceId);
    const { data: row, error } = await context.supabase
      .from("customer_invoices")
      .insert({
        workspace_id: workspaceId,
        owner_id: context.userId,
        invoice_number: number,
        description: data.description ?? null,
        amount: data.amount,
        currency: data.currency,
        due_date: data.due_date,
        status: "draft",
        gateway: data.gateway,
        payment_method: data.payment_method,
        contact_id: data.contact_id ?? null,
        company_id: data.company_id ?? null,
        deal_id: data.deal_id ?? null,
        quote_id: data.quote_id ?? null,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return { invoice: row };
  });

export const updateInvoiceStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid(), status: StatusZ }).parse(d))
  .handler(async ({ data, context }) => {
    await authorizeFinanceBusiness(context.supabase, "invoices", "update", data.id);
    const patch: { status: typeof data.status; paid_at?: string; cancelled_at?: string } = {
      status: data.status,
    };
    if (data.status === "paid") patch.paid_at = new Date().toISOString();
    if (data.status === "cancelled") patch.cancelled_at = new Date().toISOString();
    const { error } = await context.supabase
      .from("customer_invoices")
      .update(patch)
      .eq("id", data.id)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteInvoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await authorizeFinanceBusiness(context.supabase, "invoices", "delete", data.id);
    const { error } = await context.supabase
      .from("customer_invoices")
      .delete()
      .eq("id", data.id)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Provider issuance requires a real, verified adapter; fabricated payment data is forbidden. */
export const generateCharge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ invoice_id: z.string().uuid(), method: MethodZ.default("pix") }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await authorizeFinanceBusiness(context.supabase, "invoices", "update", data.invoice_id);
    throw new Error(
      "Emissão por gateway indisponível: nenhum adaptador de cobrança real está habilitado. Nenhuma cobrança foi emitida.",
    );
  });
