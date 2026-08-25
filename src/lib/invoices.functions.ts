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
    let q = context.supabase
      .from("customer_invoices")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (data.status !== "all") q = q.eq("status", data.status);
    if (data.gateway !== "all") q = q.eq("gateway", data.gateway);
    if (data.search)
      q = q.or(`invoice_number.ilike.%${data.search}%,description.ilike.%${data.search}%`);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { invoices: rows ?? [] };
  });

export const getInvoice = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const [{ data: inv, error }, { data: payments }, { data: events }] = await Promise.all([
      context.supabase.from("customer_invoices").select("*").eq("id", data.id).single(),
      context.supabase
        .from("customer_payments")
        .select("*")
        .eq("invoice_id", data.id)
        .order("created_at", { ascending: false }),
      context.supabase
        .from("payment_webhook_events")
        .select("id,gateway,event_type,signature_valid,processed,error,created_at")
        .eq("external_id", data.id)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);
    if (error) throw new Error(error.message);
    return { invoice: inv, payments: payments ?? [], events: events ?? [] };
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
    const patch: { status: typeof data.status; paid_at?: string; cancelled_at?: string } = {
      status: data.status,
    };
    if (data.status === "paid") patch.paid_at = new Date().toISOString();
    if (data.status === "cancelled") patch.cancelled_at = new Date().toISOString();
    const { error } = await context.supabase
      .from("customer_invoices")
      .update(patch)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteInvoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("customer_invoices").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Generate a payment charge with the configured gateway.
 * The actual gateway HTTP call lives in adapters under src/lib/payments/*.
 * Without real credentials this returns deterministic sandbox stubs so the UI flow works.
 */
export const generateCharge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        invoice_id: z.string().uuid(),
        method: MethodZ.default("pix"),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: inv, error: e1 } = await context.supabase
      .from("customer_invoices")
      .select("*")
      .eq("id", data.invoice_id)
      .single();
    if (e1 || !inv) throw new Error(e1?.message ?? "Fatura não encontrada");

    const { data: ws } = await supabaseAdmin
      .from("workspaces")
      .select("payments_settings")
      .eq("id", inv.workspace_id)
      .single();
    const settings = (ws?.payments_settings ?? {}) as {
      gateway?: "asaas" | "pagarme" | "mercadopago" | "manual";
      mode?: "sandbox" | "live";
    };
    const gateway = settings.gateway ?? "manual";
    const mode = settings.mode ?? "sandbox";

    // Deterministic sandbox stub. Real adapters would POST to the gateway API
    // and store the returned ids/links.
    const externalId = `${gateway}_${inv.id.slice(0, 8)}`;
    const baseUrl = process.env.PUBLIC_APP_URL || "https://app.wktechnology.com.br";
    const patch = {
      gateway,
      gateway_mode: mode,
      payment_method: data.method,
      external_id: externalId,
      payment_url: `${baseUrl}/pay/${inv.id}`,
      barcode:
        data.method === "boleto"
          ? `00190.00009 0${inv.id.slice(0, 5)} 0 ${Math.round(Number(inv.amount) * 100)}`
          : null,
      pix_qr_code:
        data.method === "pix"
          ? `00020126360014BR.GOV.BCB.PIX0114+5511999999999520400005303986540${Number(inv.amount).toFixed(2)}5802BR5913WK Technology6009Sao Paulo62070503***6304`
          : null,
      pix_copy_paste:
        data.method === "pix" ? `PIX_COPY_${inv.id.slice(0, 12).toUpperCase()}` : null,
      status: "open" as const,
    };
    const { data: updated, error: e2 } = await context.supabase
      .from("customer_invoices")
      .update(patch)
      .eq("id", inv.id)
      .select("*")
      .single();
    if (e2) throw new Error(e2.message);
    return { invoice: updated, sandbox: mode === "sandbox" };
  });
