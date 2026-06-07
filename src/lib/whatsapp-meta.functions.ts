// Meta WhatsApp Cloud API — server functions (Release 13).
// Substitui o envio via Twilio. Tokens por WABA são armazenados em wa_business_accounts.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveActiveWorkspace } from "@/lib/active-workspace.server";

const GRAPH_VERSION = process.env.META_GRAPH_API_VERSION || "v21.0";
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;

async function metaFetch(token: string, path: string, init: RequestInit = {}) {
  const res = await fetch(`${GRAPH_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  let json: any = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = { raw: text }; }
  if (!res.ok) {
    const msg = json?.error?.message || `Meta API ${res.status}`;
    throw new Error(msg);
  }
  return json;
}

async function loadWabaToken(supabase: any, workspaceId: string, wabaRowId: string) {
  const { data, error } = await supabase
    .from("wa_business_accounts")
    .select("id, waba_id, access_token, workspace_id")
    .eq("id", wabaRowId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("WABA não encontrada");
  return data as { id: string; waba_id: string; access_token: string; workspace_id: string };
}

// ---------- WABA / numbers CRUD ----------

export const listWabas = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const ws = await resolveActiveWorkspace(userId);
    const { data, error } = await supabase
      .from("wa_business_accounts")
      .select("id, waba_id, business_id, business_name, status, webhook_verified_at, created_at")
      .eq("workspace_id", ws)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const connectWaba = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({
      waba_id: z.string().min(3).max(64),
      access_token: z.string().min(20).max(4096),
      business_id: z.string().max(64).optional(),
      business_name: z.string().max(255).optional(),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const ws = await resolveActiveWorkspace(userId);

    // Validate token by hitting Meta
    const info = await metaFetch(data.access_token, `/${data.waba_id}?fields=id,name,currency,timezone_id`);

    // Subscribe app to WABA webhook
    try {
      await metaFetch(data.access_token, `/${data.waba_id}/subscribed_apps`, { method: "POST" });
    } catch (e) {
      console.warn("[whatsapp-meta] subscribed_apps failed", e);
    }

    const { data: row, error } = await supabase
      .from("wa_business_accounts")
      .upsert({
        owner_id: ws,
        workspace_id: ws,
        waba_id: data.waba_id,
        business_id: data.business_id ?? null,
        business_name: data.business_name ?? info?.name ?? null,
        access_token: data.access_token,
        status: "connected",
        webhook_verified_at: new Date().toISOString(),
        raw: info,
      }, { onConflict: "workspace_id,waba_id" })
      .select()
      .single();
    if (error) throw new Error(error.message);

    // Sync phone numbers right away
    await syncPhoneNumbersInternal(supabase, ws, row.id, data.waba_id, data.access_token);

    return { id: row.id };
  });

async function syncPhoneNumbersInternal(supabase: any, ws: string, wabaRowId: string, wabaId: string, token: string) {
  const res = await metaFetch(token, `/${wabaId}/phone_numbers?fields=id,display_phone_number,verified_name,quality_rating,messaging_limit_tier,code_verification_status`);
  const items = (res?.data ?? []) as any[];
  for (const p of items) {
    await supabase.from("wa_phone_numbers").upsert({
      owner_id: ws,
      workspace_id: ws,
      waba_id: wabaRowId,
      phone_number_id: p.id,
      display_phone_number: p.display_phone_number,
      verified_name: p.verified_name ?? null,
      quality_rating: p.quality_rating ?? null,
      messaging_limit_tier: p.messaging_limit_tier ?? null,
      raw: p,
    }, { onConflict: "workspace_id,phone_number_id" });
  }
  return items.length;
}

export const syncPhoneNumbers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ waba_row_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const ws = await resolveActiveWorkspace(userId);
    const waba = await loadWabaToken(supabase, ws, data.waba_row_id);
    const n = await syncPhoneNumbersInternal(supabase, ws, waba.id, waba.waba_id, waba.access_token);
    return { synced: n };
  });

export const listPhoneNumbers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const ws = await resolveActiveWorkspace(userId);
    const { data, error } = await supabase
      .from("wa_phone_numbers")
      .select("id, waba_id, phone_number_id, display_phone_number, verified_name, quality_rating, messaging_limit_tier, is_default, routing_rules, created_at")
      .eq("workspace_id", ws)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const updatePhoneNumberRouting = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({
    id: z.string().uuid(),
    is_default: z.boolean().optional(),
    routing_rules: z.record(z.string(), z.any()).optional(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const ws = await resolveActiveWorkspace(userId);
    if (data.is_default) {
      await supabase.from("wa_phone_numbers").update({ is_default: false }).eq("workspace_id", ws);
    }
    const patch: any = {};
    if (data.is_default !== undefined) patch.is_default = data.is_default;
    if (data.routing_rules !== undefined) patch.routing_rules = data.routing_rules;
    const { error } = await supabase.from("wa_phone_numbers").update(patch).eq("id", data.id).eq("workspace_id", ws);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Send ----------

export const sendMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({
    phone_number_id: z.string().min(3).max(64),
    to: z.string().min(8).max(20).regex(/^\+?\d+$/),
    text: z.string().min(1).max(4096),
    context_message_id: z.string().max(128).optional(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const ws = await resolveActiveWorkspace(userId);
    const { data: pn } = await supabase
      .from("wa_phone_numbers")
      .select("phone_number_id, waba_id, display_phone_number, waba:wa_business_accounts(access_token, waba_id)")
      .eq("workspace_id", ws).eq("phone_number_id", data.phone_number_id).maybeSingle();
    if (!pn) throw new Error("Número WhatsApp não conectado a este workspace");
    const token = (pn as any).waba?.access_token as string;
    if (!token) throw new Error("Token Meta indisponível");

    const body: any = {
      messaging_product: "whatsapp",
      to: data.to.replace(/[^\d]/g, ""),
      type: "text",
      text: { body: data.text, preview_url: true },
    };
    if (data.context_message_id) body.context = { message_id: data.context_message_id };

    const res = await metaFetch(token, `/${data.phone_number_id}/messages`, {
      method: "POST",
      body: JSON.stringify(body),
    });
    const wamid = res?.messages?.[0]?.id as string | undefined;

    // Persist message + ensure conversation
    const phone = body.to;
    const { data: conv } = await supabase
      .from("whatsapp_conversations")
      .upsert({
        owner_id: ws, workspace_id: ws,
        contact_phone: phone,
        twilio_number: pn.display_phone_number,
        wa_phone_number_id: data.phone_number_id,
        provider: "meta",
      }, { onConflict: "contact_phone,twilio_number" })
      .select("id").single();

    if (conv?.id) {
      await supabase.from("whatsapp_messages").insert({
        owner_id: ws, workspace_id: ws,
        conversation_id: conv.id,
        direction: "outbound",
        body: data.text,
        from_number: pn.display_phone_number,
        to_number: phone,
        wa_message_id: wamid ?? null,
        status: "queued",
        sent_by: userId,
        sent_at: new Date().toISOString(),
        provider: "meta",
      });
    }
    return { wamid };
  });

export const sendTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({
    phone_number_id: z.string(),
    to: z.string().regex(/^\+?\d+$/),
    template_name: z.string(),
    language: z.string().default("pt_BR"),
    components: z.array(z.any()).default([]),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const ws = await resolveActiveWorkspace(userId);
    const { data: pn } = await supabase
      .from("wa_phone_numbers")
      .select("phone_number_id, display_phone_number, waba:wa_business_accounts(access_token)")
      .eq("workspace_id", ws).eq("phone_number_id", data.phone_number_id).maybeSingle();
    if (!pn) throw new Error("Número não conectado");
    const token = (pn as any).waba?.access_token as string;

    const res = await metaFetch(token, `/${data.phone_number_id}/messages`, {
      method: "POST",
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: data.to.replace(/[^\d]/g, ""),
        type: "template",
        template: {
          name: data.template_name,
          language: { code: data.language },
          components: data.components,
        },
      }),
    });
    return { wamid: res?.messages?.[0]?.id };
  });

export const sendProductList = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({
    phone_number_id: z.string(),
    to: z.string().regex(/^\+?\d+$/),
    catalog_id: z.string(),
    header_text: z.string().max(60),
    body_text: z.string().max(1024),
    footer_text: z.string().max(60).optional(),
    sections: z.array(z.object({
      title: z.string().max(24),
      product_items: z.array(z.object({ product_retailer_id: z.string() })).min(1).max(30),
    })).min(1).max(10),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const ws = await resolveActiveWorkspace(userId);
    const { data: pn } = await supabase
      .from("wa_phone_numbers")
      .select("phone_number_id, waba:wa_business_accounts(access_token)")
      .eq("workspace_id", ws).eq("phone_number_id", data.phone_number_id).maybeSingle();
    if (!pn) throw new Error("Número não conectado");
    const token = (pn as any).waba?.access_token as string;

    const res = await metaFetch(token, `/${data.phone_number_id}/messages`, {
      method: "POST",
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: data.to.replace(/[^\d]/g, ""),
        type: "interactive",
        interactive: {
          type: "product_list",
          header: { type: "text", text: data.header_text },
          body: { text: data.body_text },
          footer: data.footer_text ? { text: data.footer_text } : undefined,
          action: { catalog_id: data.catalog_id, sections: data.sections },
        },
      }),
    });
    return { wamid: res?.messages?.[0]?.id };
  });

// ---------- Templates ----------

export const listTemplates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const ws = await resolveActiveWorkspace(userId);
    const { data, error } = await supabase
      .from("wa_templates")
      .select("id, waba_id, meta_template_id, name, language, category, status, components, rejection_reason, updated_at")
      .eq("workspace_id", ws)
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const syncTemplates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ waba_row_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const ws = await resolveActiveWorkspace(userId);
    const waba = await loadWabaToken(supabase, ws, data.waba_row_id);
    const res = await metaFetch(waba.access_token, `/${waba.waba_id}/message_templates?fields=id,name,language,category,status,components,rejected_reason&limit=200`);
    const items = (res?.data ?? []) as any[];
    for (const t of items) {
      await supabase.from("wa_templates").upsert({
        owner_id: ws, workspace_id: ws, waba_id: waba.id,
        meta_template_id: t.id,
        name: t.name, language: t.language, category: t.category,
        status: t.status, components: t.components ?? [],
        rejection_reason: t.rejected_reason ?? null,
        raw: t,
      }, { onConflict: "waba_id,name,language" });
    }
    return { synced: items.length };
  });

export const submitTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({
    waba_row_id: z.string().uuid(),
    name: z.string().min(1).max(512).regex(/^[a-z0-9_]+$/),
    language: z.string().min(2).max(10),
    category: z.enum(["MARKETING", "UTILITY", "AUTHENTICATION"]),
    components: z.array(z.any()).min(1),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const ws = await resolveActiveWorkspace(userId);
    const waba = await loadWabaToken(supabase, ws, data.waba_row_id);
    const res = await metaFetch(waba.access_token, `/${waba.waba_id}/message_templates`, {
      method: "POST",
      body: JSON.stringify({
        name: data.name, language: data.language, category: data.category, components: data.components,
      }),
    });
    await supabase.from("wa_templates").upsert({
      owner_id: ws, workspace_id: ws, waba_id: waba.id,
      meta_template_id: res?.id, name: data.name, language: data.language, category: data.category,
      status: res?.status ?? "PENDING", components: data.components,
    }, { onConflict: "waba_id,name,language" });
    return { id: res?.id, status: res?.status };
  });

// ---------- Catalogs ----------

export const listCatalogs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const ws = await resolveActiveWorkspace(userId);
    const { data } = await supabase
      .from("wa_catalogs").select("id, catalog_id, name, vertical")
      .eq("workspace_id", ws).order("name");
    return data ?? [];
  });

export const syncCatalogProducts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({
    catalog_row_id: z.string().uuid(),
    waba_row_id: z.string().uuid(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const ws = await resolveActiveWorkspace(userId);
    const waba = await loadWabaToken(supabase, ws, data.waba_row_id);
    const { data: cat } = await supabase.from("wa_catalogs").select("id, catalog_id").eq("id", data.catalog_row_id).eq("workspace_id", ws).maybeSingle();
    if (!cat) throw new Error("Catálogo não encontrado");
    const res = await metaFetch(waba.access_token, `/${cat.catalog_id}/products?fields=retailer_id,name,price,currency,availability,image_url&limit=100`);
    const items = (res?.data ?? []) as any[];
    for (const p of items) {
      await supabase.from("wa_catalog_products").upsert({
        owner_id: ws, workspace_id: ws, catalog_id: cat.id,
        retailer_id: p.retailer_id, name: p.name,
        price: p.price, currency: p.currency, availability: p.availability, image_url: p.image_url,
        raw: p,
      }, { onConflict: "catalog_id,retailer_id" });
    }
    return { synced: items.length };
  });
