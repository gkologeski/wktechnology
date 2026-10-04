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
