import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveActiveWorkspace } from "@/lib/active-workspace.server";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/twilio";
const SANDBOX_FROM = "whatsapp:+14155238886";

function twilioHeaders() {
  const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY não configurada");
  const TWILIO_API_KEY = process.env.TWILIO_API_KEY;
  if (!TWILIO_API_KEY) throw new Error("Conecte o Twilio para enviar WhatsApp");
  return {
    Authorization: `Bearer ${LOVABLE_API_KEY}`,
    "X-Connection-Api-Key": TWILIO_API_KEY,
    "Content-Type": "application/x-www-form-urlencoded",
  };
}

function normalizePhone(raw: string): string {
  const digits = raw.replace(/[^\d+]/g, "");
  return digits.startsWith("+") ? digits : `+${digits}`;
}
function toWa(phone: string): string {
  const p = normalizePhone(phone);
  return p.startsWith("whatsapp:") ? p : `whatsapp:${p}`;
}

export function applyTemplate(body: string, vars: string[]): string {
  return body.replace(/\{\{(\d+)\}\}/g, (_, n) => vars[Number(n) - 1] ?? "");
}

async function getIntegrationConfig(supabase: any, workspaceId: string) {
  const { data } = await supabase
    .from("integrations")
    .select("config")
    .eq("owner_id", workspaceId)
    .eq("provider", "twilio_whatsapp")
    .maybeSingle();
  return (data?.config ?? {}) as {
    from_number?: string;
    public_base_url?: string;
    templates?: {
      name: string;
      body: string;
      contentSid?: string;
      variableCount?: number;
    }[];
  };
}

const DEFAULT_PUBLIC_BASE = "https://app.wktechnology.com.br";
async function resolvePublicBase(supabase: any, workspaceId: string): Promise<string> {
  const cfg = await getIntegrationConfig(supabase, workspaceId);
  return (cfg.public_base_url || DEFAULT_PUBLIC_BASE).replace(/\/$/, "");
}

async function resolveFromNumber(supabase: any, workspaceId: string): Promise<string> {
  const cfg = await getIntegrationConfig(supabase, workspaceId);
  return cfg.from_number ? toWa(cfg.from_number) : SANDBOX_FROM;
}

async function findContactByPhone(supabase: any, phoneE164: string): Promise<string | null> {
  const noPlus = phoneE164.replace(/^\+/, "");
  const { data } = await supabase
    .from("contacts")
    .select("id")
    .or(
      `phone.eq.${phoneE164},phone.eq.${noPlus},mobile_phone.eq.${phoneE164},mobile_phone.eq.${noPlus}`,
    )
    .maybeSingle();
  return data?.id ?? null;
}

// ---------- send ----------
export const sendWhatsAppMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        to: z.string().min(5),
        body: z.string().max(1600).optional().default(""),
        contactId: z.string().uuid().optional(),
        mediaUrl: z.string().url().optional(),
        mediaContentType: z.string().max(120).optional(),
        templateName: z.string().optional(),
        contentSid: z
          .string()
          .regex(/^HX[0-9a-fA-F]{32}$/)
          .optional(),
        contentVariables: z.record(z.string(), z.string()).optional(),
      })
      .refine((v) => v.body.trim().length > 0 || !!v.mediaUrl || !!v.contentSid, {
        message: "Informe um texto, anexo ou template oficial",
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    const from = await resolveFromNumber(supabase, workspaceId);
    const toWaNum = toWa(data.to);
    const toBare = normalizePhone(data.to);
    const fromBare = from.replace(/^whatsapp:/, "");

    const publicBase = await resolvePublicBase(supabase, workspaceId);
    const params = new URLSearchParams({
      From: from,
      To: toWaNum,
      StatusCallback: `${publicBase}/api/public/hooks/twilio-whatsapp-status`,
    });
    if (data.contentSid) {
      params.set("ContentSid", data.contentSid);
      if (data.contentVariables && Object.keys(data.contentVariables).length > 0) {
        params.set("ContentVariables", JSON.stringify(data.contentVariables));
      }
    } else {
      if (data.body) params.set("Body", data.body);
      if (data.mediaUrl) params.set("MediaUrl", data.mediaUrl);
    }

    const res = await fetch(`${GATEWAY_URL}/Messages.json`, {
      method: "POST",
      headers: twilioHeaders(),
      body: params,
    });
    const tw = await res.json();
    if (!res.ok) {
      throw new Error(`Twilio erro [${res.status}]: ${tw?.message ?? JSON.stringify(tw)}`);
    }

    // Resolve contato pelo telefone se não informado
    let contactId = data.contactId ?? null;
    if (!contactId) {
      contactId = await findContactByPhone(supabase, toBare);
    }

    // upsert conversation
    const { data: conv, error: cErr } = await supabase
      .from("whatsapp_conversations")
      .upsert(
        {
          owner_id: workspaceId,
          contact_id: contactId,
          contact_phone: toBare,
          twilio_number: fromBare,
          last_message_at: new Date().toISOString(),
          last_message_preview:
            (data.body && data.body.slice(0, 120)) || (data.mediaUrl ? "[mídia]" : ""),
        },
        { onConflict: "contact_phone,twilio_number" },
      )
      .select("id")
      .single();
    if (cErr) throw cErr;

    const { error: mErr } = await supabase.from("whatsapp_messages").insert({
      conversation_id: conv.id,
      owner_id: workspaceId,
      direction: "outbound",
      body: data.body,
      media_url: data.mediaUrl ?? null,
      media_content_type: data.mediaContentType ?? null,
      from_number: fromBare,
      to_number: toBare,
      twilio_sid: tw.sid,
      status: tw.status ?? "queued",
      template_name: data.templateName ?? null,
      is_template: !!data.templateName,
      sent_by: userId,
      sent_at: new Date().toISOString(),
      raw: tw,
    });
    if (mErr) throw mErr;

    // Cria atividade na timeline do contato (se vinculado)
    if (contactId) {
      await supabase.from("activities").insert({
        owner_id: workspaceId,
        type: "whatsapp",
        related_contact_id: contactId,
        subject: data.templateName ? `WhatsApp · ${data.templateName}` : "WhatsApp enviado",
        body: data.body || (data.mediaUrl ? "[mídia]" : ""),
        email_direction: "outbound",
        completed: true,
        outcome: "sent",
        outcome_set_at: new Date().toISOString(),
        external_ids: { twilio_sid: tw.sid, conversation_id: conv.id },
      });
    }

    return { ok: true, sid: tw.sid as string, conversationId: conv.id as string };
  });

// ---------- list conversations ----------
export const listWhatsAppConversations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("whatsapp_conversations")
      .select(
        "id, contact_id, contact_phone, twilio_number, last_message_at, last_message_preview, unread_count, status, assigned_to",
      )
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .limit(200);
    if (error) throw error;
    return data ?? [];
  });

// ---------- list messages ----------
export const listWhatsAppMessages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ conversationId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("whatsapp_messages")
      .select(
        "id, direction, body, media_url, media_content_type, status, created_at, sent_at, delivered_at, read_at, twilio_sid, template_name, is_template",
      )
      .eq("conversation_id", data.conversationId)
      .order("created_at", { ascending: true })
      .limit(500);
    if (error) throw error;
    return rows ?? [];
  });

// ---------- mark conversation read ----------
export const markWhatsAppRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ conversationId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("whatsapp_conversations")
      .update({ unread_count: 0 })
      .eq("id", data.conversationId);
    if (error) throw error;
    return { ok: true };
  });

// ---------- get/save sender config ----------
export const getWhatsAppConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    const cfg = await getIntegrationConfig(supabase, workspaceId);
    return {
      from_number: cfg.from_number ?? "",
      public_base_url: cfg.public_base_url ?? "",
      effective_from: cfg.from_number
        ? normalizePhone(cfg.from_number)
        : SANDBOX_FROM.replace("whatsapp:", ""),
      effective_public_base: cfg.public_base_url || DEFAULT_PUBLIC_BASE,
      using_sandbox: !cfg.from_number,
      templates: cfg.templates ?? [],
    };
  });

export const saveWhatsAppConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        from_number: z.string().min(0).max(32),
        public_base_url: z.string().min(0).max(255).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    const from = data.from_number.trim();
    const base = (data.public_base_url ?? "").trim().replace(/\/$/, "");
    const cfg = await getIntegrationConfig(supabase, workspaceId);
    const newCfg = {
      ...cfg,
      from_number: from ? normalizePhone(from) : undefined,
      public_base_url: base || undefined,
    };
    const { error } = await supabase.from("integrations").upsert(
      {
        owner_id: workspaceId,
        provider: "twilio_whatsapp",
        status: from ? "connected" : "pending",
        config: newCfg,
      },
      { onConflict: "owner_id,provider" },
    );
    if (error) throw error;
    return { ok: true };
  });

// ---------- assignment ----------
export const listAssignableMembers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    const { data: members } = await supabase
      .from("team_members")
      .select("member_user_id")
      .eq("workspace_owner_id", workspaceId);
    const ids = new Set<string>([userId, ...(members ?? []).map((m: any) => m.member_user_id)]);
    const { data: profs } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", Array.from(ids));
    return (profs ?? []) as { id: string; full_name: string | null }[];
  });

export const assignWhatsAppConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        conversationId: z.string().uuid(),
        assignedTo: z.string().uuid().nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("whatsapp_conversations")
      .update({ assigned_to: data.assignedTo })
      .eq("id", data.conversationId);
    if (error) throw error;
    return { ok: true };
  });

export const setWhatsAppConversationStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        conversationId: z.string().uuid(),
        status: z.enum(["open", "closed", "snoozed"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("whatsapp_conversations")
      .update({ status: data.status })
      .eq("id", data.conversationId);
    if (error) throw error;
    return { ok: true };
  });

// ---------- templates ----------
const TemplateSchema = z.object({
  name: z.string().min(1).max(60),
  body: z.string().min(1).max(1600),
  contentSid: z
    .string()
    .regex(/^HX[0-9a-fA-F]{32}$/, "ContentSid deve começar com HX e ter 34 chars")
    .optional()
    .or(z.literal("")),
  variableCount: z.number().int().min(0).max(20).optional(),
});

export const listWhatsAppTemplates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const cfg = await getIntegrationConfig(
      context.supabase,
      await resolveActiveWorkspace(context.userId),
    );
    return cfg.templates ?? [];
  });

export const saveWhatsAppTemplates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ templates: z.array(TemplateSchema).max(50) }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    const cfg = await getIntegrationConfig(supabase, workspaceId);
    const newCfg = { ...cfg, templates: data.templates };
    const { error } = await supabase.from("integrations").upsert(
      {
        owner_id: workspaceId,
        provider: "twilio_whatsapp",
        status: cfg.from_number ? "connected" : "pending",
        config: newCfg,
      },
      { onConflict: "owner_id,provider" },
    );
    if (error) throw error;
    return { ok: true };
  });
