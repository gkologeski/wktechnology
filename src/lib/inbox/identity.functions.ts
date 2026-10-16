import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const inputSchema = z.object({
  channel: z.enum(["whatsapp", "email", "chat"]),
  conversationId: z.string().uuid(),
  entityType: z.enum(["contact", "lead"]),
  entityId: z.string().uuid(),
});

const channelTable = {
  whatsapp: "whatsapp_conversations",
  email: "email_threads",
  chat: "live_chat_sessions",
} as const;

export const associateInboxIdentity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => inputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const entityTable = data.entityType === "contact" ? "contacts" : "leads";
    const { data: entity, error: entityError } = await context.supabase
      .from(entityTable)
      .select("id, workspace_id")
      .eq("id", data.entityId)
      .maybeSingle();
    if (entityError) throw entityError;
    if (!entity) throw new Error("Registro não encontrado ou sem permissão de acesso.");

    const { data: conversation, error: conversationError } = await context.supabase
      .from(channelTable[data.channel])
      .select("id, workspace_id")
      .eq("id", data.conversationId)
      .maybeSingle();
    if (conversationError) throw conversationError;
    if (!conversation) throw new Error("Conversa não encontrada ou sem permissão para alterar.");
    if (conversation.workspace_id !== entity.workspace_id) {
      throw new Error("O registro selecionado não pertence ao mesmo workspace da conversa.");
    }

    const { data: updated, error } = await context.supabase
      .from(channelTable[data.channel])
      .update({
        contact_id: data.entityType === "contact" ? data.entityId : null,
        lead_id: data.entityType === "lead" ? data.entityId : null,
        identity_status: "manual",
      })
      .eq("id", data.conversationId)
      .select("id")
      .maybeSingle();
    if (error) throw error;
    if (!updated) throw new Error("Conversa não encontrada ou sem permissão para alterar.");
    return { ok: true as const };
  });

export const getWhatsAppConversationOrigin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ conversationId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { data: conv } = await sb
      .from("whatsapp_conversations")
      .select("id, workspace_id, contact_phone")
      .eq("id", data.conversationId)
      .maybeSingle();
    if (!conv) return null;
    const { brPhoneVariants } = await import("@/lib/whatsapp/phone-variants");
    const variants = brPhoneVariants(conv.contact_phone);
    const { data: recips } = await sb
      .from("whatsapp_campaign_recipients")
      .select("variables, created_at")
      .eq("workspace_id", conv.workspace_id)
      .in("phone", [...variants, ...variants.map((v: string) => v.replace(/^\+/, ""))])
      .order("created_at", { ascending: false })
      .limit(10);
    for (const r of recips ?? []) {
      const src = (r.variables as Record<string, unknown> | null)?._source;
      const m = typeof src === "string" ? /^company:([0-9a-f-]{36})$/i.exec(src) : null;
      if (!m) continue;
      const { data: company } = await sb
        .from("companies")
        .select("id, name, logo_url, logo_source, domain, website")
        .eq("id", m[1])
        .eq("workspace_id", conv.workspace_id)
        .maybeSingle();
      if (company) return company as {
        id: string;
        name: string;
        logo_url: string | null;
        logo_source: string | null;
        domain: string | null;
        website: string | null;
      };
    }
    return null;
  });
