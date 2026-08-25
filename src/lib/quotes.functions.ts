import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { randomBytes } from "crypto";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function token() {
  return randomBytes(24).toString("hex");
}

type LineForTotals = {
  quantity: number | string | null;
  unit_price: number | string | null;
  discount_pct?: number | string | null;
  discount_amount?: number | string | null;
  discount_type?: string | null;
  tax_rate?: number | string | null;
};

function nn(v: unknown): number {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

// Mirror of frontend `lineDiscount` in components/deals/deal-line-items.tsx.
// When discount_type === 'amount', discount is discount_amount * quantity,
// capped at the gross line total.
function lineDiscountServer(li: LineForTotals) {
  const qty = nn(li.quantity);
  const price = nn(li.unit_price);
  const gross = qty * price;
  if ((li.discount_type ?? "pct") === "amount") {
    const raw = nn(li.discount_amount) * qty;
    return Math.min(Math.max(raw, 0), gross);
  }
  return gross * (nn(li.discount_pct) / 100);
}

function recompute(items: LineForTotals[]) {
  let subtotal = 0,
    discount = 0,
    tax = 0,
    total = 0;
  for (const li of items) {
    const sub = nn(li.quantity) * nn(li.unit_price);
    const disc = lineDiscountServer(li);
    const base = sub - disc;
    const tx = base * (nn(li.tax_rate) / 100);
    subtotal += sub;
    discount += disc;
    tax += tx;
    total += base + tx;
  }
  const r = (n: number) => Math.round(n * 100) / 100;
  return { subtotal: r(subtotal), discount_total: r(discount), tax_total: r(tax), total: r(total) };
}

// ============= AUTH =============

export const listQuotes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("quotes")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw error;
    return data ?? [];
  });

export const listDealQuotes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ dealId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("quotes")
      .select("*")
      .eq("deal_id", data.dealId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return rows ?? [];
  });

export const createQuoteFromDeal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        dealId: z.string().uuid(),
        title: z.string().max(255).optional(),
        validUntil: z.string().optional(),
        notes: z.string().max(5000).optional(),
        terms: z.string().max(10000).optional(),
        templateId: z.string().uuid().nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: deal, error: dErr } = await supabase
      .from("deals")
      .select("id, name, currency, company_id, primary_contact_id, owner_id")
      .eq("id", data.dealId)
      .maybeSingle();
    if (dErr || !deal) throw new Error("Negócio não encontrado");

    const { data: lines, error: lErr } = await supabase
      .from("deal_line_items")
      .select("*")
      .eq("deal_id", data.dealId)
      .order("position");
    if (lErr) throw lErr;
    if (!lines || lines.length === 0) throw new Error("Adicione itens ao negócio primeiro.");

    const totals = recompute(lines);
    const yearMonth = new Date().toISOString().slice(0, 7).replace("-", "");
    const num = `Q-${yearMonth}-${Math.floor(Math.random() * 9000 + 1000)}`;

    // Quando templateId não vier, usa o modelo padrão do workspace (se houver).
    let templateId: string | null = data.templateId ?? null;
    if (templateId === null && data.templateId === undefined) {
      const { data: def } = await supabase
        .from("quote_templates")
        .select("id")
        .eq("is_default", true)
        .maybeSingle();
      templateId = (def as { id?: string } | null)?.id ?? null;
    }

    const { data: quote, error: qErr } = await supabase
      .from("quotes")
      .insert({
        owner_id: userId,
        deal_id: data.dealId,
        contact_id: deal.primary_contact_id,
        company_id: deal.company_id,
        number: num,
        title: data.title ?? deal.name,
        currency: deal.currency ?? "BRL",
        public_token: token(),
        valid_until: data.validUntil || null,
        notes: data.notes || null,
        terms: data.terms || null,
        template_id: templateId,
        ...totals,
      })
      .select("*")
      .single();
    if (qErr) throw qErr;

    const payload = lines.map((li, idx) => ({
      owner_id: userId,
      quote_id: quote.id,
      name: li.name,
      description: li.description,
      quantity: li.quantity,
      unit_price: li.unit_price,
      discount_pct: li.discount_pct,
      discount_amount: li.discount_amount ?? 0,
      discount_type: li.discount_type ?? "pct",
      tax_rate: li.tax_rate,
      position: idx,
      // Preset de contratação e derivados (cargo/senioridade/unidade) viajam
      // junto com o item para o snapshot da cotação.
      service_catalog_id: li.service_catalog_id ?? null,
      contracting_preset_id: li.contracting_preset_id ?? null,
      job_profile_id: li.job_profile_id ?? null,
      seniority: li.seniority ?? null,
      unit: li.unit ?? null,
    }));
    const { error: insErr } = await supabase.from("quote_line_items").insert(payload);
    if (insErr) throw insErr;

    return quote;
  });

export const updateQuote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        id: z.string().uuid(),
        patch: z.object({
          title: z.string().nullable().optional(),
          status: z
            .enum(["draft", "published", "sent", "accepted", "declined", "expired"])
            .optional(),
          valid_until: z.string().nullable().optional(),
          notes: z.string().nullable().optional(),
          terms: z.string().nullable().optional(),
          sent_at: z.string().nullable().optional(),
          template_id: z.string().uuid().nullable().optional(),
        }),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.from("quotes").update(data.patch).eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const resyncQuoteLineItems = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: quote, error: qErr } = await supabase
      .from("quotes")
      .select("id, deal_id")
      .eq("id", data.id)
      .maybeSingle();
    if (qErr || !quote?.deal_id) throw new Error("Cotação não encontrada");
    const { data: lines, error: lErr } = await supabase
      .from("deal_line_items")
      .select("*")
      .eq("deal_id", quote.deal_id)
      .order("position");
    if (lErr) throw lErr;
    const items = lines ?? [];
    const totals = recompute(items);
    // Replace snapshot
    const { error: dErr } = await supabase
      .from("quote_line_items")
      .delete()
      .eq("quote_id", data.id);
    if (dErr) throw dErr;
    if (items.length) {
      const payload = items.map((li, idx) => ({
        owner_id: userId,
        quote_id: data.id,
        name: li.name,
        description: li.description,
        quantity: li.quantity,
        unit_price: li.unit_price,
        discount_pct: li.discount_pct,
        discount_amount: li.discount_amount ?? 0,
        discount_type: li.discount_type ?? "pct",
        tax_rate: li.tax_rate,
        position: idx,
        service_catalog_id: li.service_catalog_id ?? null,
        contracting_preset_id: li.contracting_preset_id ?? null,
        job_profile_id: li.job_profile_id ?? null,
        seniority: li.seniority ?? null,
        unit: li.unit ?? null,
      }));
      const { error: insErr } = await supabase.from("quote_line_items").insert(payload);
      if (insErr) throw insErr;
    }
    const { error: uErr } = await supabase.from("quotes").update(totals).eq("id", data.id);
    if (uErr) throw uErr;
    return { ok: true, totals };
  });

export const deleteQuote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.from("quotes").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const regenerateQuoteToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const t = token();
    const { error } = await supabase.from("quotes").update({ public_token: t }).eq("id", data.id);
    if (error) throw error;
    return { token: t };
  });

// ============= STRIPE PAYMENT LINK =============

function siteOrigin() {
  return (
    process.env.SITE_URL || process.env.LOVABLE_PROJECT_URL || "https://app.wktechnology.com.br"
  );
}

export const createQuotePaymentLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: quote, error } = await supabase
      .from("quotes")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error || !quote) throw new Error("Cotação não encontrada");
    if (quote.paid_at) throw new Error("Esta cotação já foi paga.");
    const total = Number(quote.total);
    if (!total || total <= 0) throw new Error("Cotação sem valor para pagamento.");

    const apiKey = process.env.STRIPE_LIVE_API_KEY || process.env.STRIPE_SANDBOX_API_KEY;
    if (!apiKey) throw new Error("Stripe ainda não está configurado.");

    const origin = siteOrigin();
    const cents = Math.round(total * 100);
    const currency = (quote.currency || "BRL").toLowerCase();

    const params = new URLSearchParams();
    params.set("mode", "payment");
    params.set("success_url", `${origin}/quote/${quote.public_token}?paid=1`);
    params.set("cancel_url", `${origin}/quote/${quote.public_token}`);
    params.set("client_reference_id", quote.id);
    params.set("metadata[quote_id]", quote.id);
    params.set("metadata[quote_token]", quote.public_token);
    params.set("line_items[0][quantity]", "1");
    params.set("line_items[0][price_data][currency]", currency);
    params.set("line_items[0][price_data][unit_amount]", String(cents));
    params.set(
      "line_items[0][price_data][product_data][name]",
      quote.title ? `${quote.title} (${quote.number})` : `Cotação ${quote.number}`,
    );

    const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });
    const session = await res.json();
    if (!res.ok) {
      throw new Error(session?.error?.message || "Falha ao criar checkout");
    }

    const patch: {
      payment_link_url: string;
      payment_session_id: string;
      status?: "published";
    } = {
      payment_link_url: session.url,
      payment_session_id: session.id,
    };
    if (quote.status === "draft") {
      patch.status = "published";
    }
    await supabase.from("quotes").update(patch).eq("id", quote.id);

    return { url: session.url as string, session_id: session.id as string };
  });

// ============= PUBLIC (via token) =============

export const getQuoteByToken = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ token: z.string().min(1).max(128) }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: quote, error } = await supabaseAdmin
      .from("quotes")
      .select("*")
      .eq("public_token", data.token)
      .maybeSingle();
    if (error || !quote) throw new Error("Cotação não encontrada");

    await supabaseAdmin
      .from("quotes")
      .update({ view_count: (quote.view_count ?? 0) + 1 })
      .eq("id", quote.id);

    const { data: items } = await supabaseAdmin
      .from("quote_line_items")
      .select("*")
      .eq("quote_id", quote.id)
      .order("position");

    let company = null;
    if (quote.company_id) {
      const r = await supabaseAdmin
        .from("companies")
        .select("id, name, website")
        .eq("id", quote.company_id)
        .maybeSingle();
      company = r.data;
    }
    let contact = null;
    if (quote.contact_id) {
      const r = await supabaseAdmin
        .from("contacts")
        .select("id, first_name, last_name, email")
        .eq("id", quote.contact_id)
        .maybeSingle();
      contact = r.data;
    }
    let agent: { id: string; full_name: string | null; email: string | null } | null = null;
    {
      const r = await supabaseAdmin
        .from("profiles")
        .select("id, full_name")
        .eq("id", quote.owner_id)
        .maybeSingle();
      if (r.data) agent = { id: r.data.id, full_name: r.data.full_name, email: null };
    }
    let template: { id: string; name: string; html: string } | null = null;
    if (quote.template_id) {
      const r = await supabaseAdmin
        .from("quote_templates")
        .select("id, name, html")
        .eq("id", quote.template_id)
        .maybeSingle();
      template = (r.data ?? null) as typeof template;
    }
    return { quote, items: items ?? [], company, contact, agent, template };
  });

export const respondToQuote = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        token: z.string().min(1).max(128),
        action: z.enum(["accept", "decline"]),
        signature: z.string().max(255).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: quote, error } = await supabaseAdmin
      .from("quotes")
      .select("id, status")
      .eq("public_token", data.token)
      .maybeSingle();
    if (error || !quote) throw new Error("Cotação não encontrada");
    if (quote.status === "accepted" || quote.status === "declined") {
      throw new Error("Esta cotação já foi respondida.");
    }
    const now = new Date().toISOString();
    const patch =
      data.action === "accept"
        ? { status: "accepted" as const, accepted_at: now, signature_name: data.signature || null }
        : { status: "declined" as const, declined_at: now };
    const { error: uErr } = await supabaseAdmin.from("quotes").update(patch).eq("id", quote.id);
    if (uErr) throw uErr;
    return { ok: true };
  });
