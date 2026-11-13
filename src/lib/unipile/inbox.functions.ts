import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireLinkedinInbox } from "./inbox-access.middleware";
export type LinkedinConversation = {
  id: string;
  account_id: string;
  provider_chat_id: string;
  sender_id: string;
  title: string;
  snippet: string;
  status: "open" | "closed";
  last_message_at: string;
  contact_id: string | null;
  lead_id: string | null;
  company_id: string | null;
  deal_id: string | null;
};
export const listLinkedinConversations = createServerFn({ method: "POST" })
  .middleware([requireLinkedinInbox("view")])
  .inputValidator((v) =>
    z
      .object({
        search: z.string().max(120).default(""),
        before: z
          .object({ at: z.string().datetime({ offset: true }), id: z.string().uuid() })
          .optional(),
        limit: z.number().int().min(1).max(100).default(50),
      })
      .parse(v),
  )
  .handler(async ({ context, data }) => {
    let q = (context.supabase as any)
      .from("linkedin_conversations")
      .select(
        "id,account_id,provider_chat_id,sender_id,title,snippet,status,last_message_at,contact_id,lead_id,company_id,deal_id",
      )
      .eq("workspace_id", context.linkedinWorkspace)
      .eq("owner_id", context.userId);
    if (data.search) q = q.ilike("title", `%${data.search.replace(/[\\%_]/g, "\\$&")}%`);
    if (data.before)
      q = q.or(
        `last_message_at.lt.${data.before.at},and(last_message_at.eq.${data.before.at},id.lt.${data.before.id})`,
      );
    const r = await q
      .order("last_message_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(data.limit + 1);
    if (r.error) throw new Error("Não foi possível carregar as conversas LinkedIn.");
    return {
      items: r.data.slice(0, data.limit) as LinkedinConversation[],
      hasMore: r.data.length > data.limit,
    };
  });
export const editLinkedinConversation = createServerFn({ method: "POST" })
  .middleware([requireLinkedinInbox("manage")])
  .inputValidator((v) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["open", "closed"]).optional(),
        entityType: z.enum(["contact", "lead", "company", "deal"]).optional(),
        entityId: z.string().uuid().nullable().optional(),
      })
      .refine((v) => !!v.status || !!v.entityType)
      .parse(v),
  )
  .handler(async ({ context, data }) => {
    const r = await context.supabase.rpc(
      "linkedin_conversation_edit" as never,
      {
        p_id: data.id,
        p_status: data.status ?? null,
        p_entity_type: data.entityType ?? null,
        p_entity: data.entityId ?? null,
      } as never,
    );
    if (r.error) throw new Error("Não foi possível alterar a conversa ou o vínculo.");
    return { ok: true };
  });
export const sendLinkedinInboxMessage = createServerFn({ method: "POST" })
  .middleware([requireLinkedinInbox("create")])
  .inputValidator((v) =>
    z
      .object({
        conversationId: z.string().uuid(),
        text: z.string().trim().min(1).max(8000),
        requestId: z.string().uuid(),
      })
      .parse(v),
  )
  .handler(async ({ context, data }) => {
    const db = context.supabase as any;
    const r = await db
      .from("linkedin_conversations")
      .select("id,account_id,provider_chat_id,status")
      .eq("workspace_id", context.linkedinWorkspace)
      .eq("owner_id", context.userId)
      .eq("id", data.conversationId)
      .single();
    if (r.error || !r.data || r.data.status !== "open")
      throw new Error("Conversa indisponível ou encerrada.");
    const { loadAccountCtx, sendLinkedinChatReply, normalizeSendMessageResult } =
      await import("./client.server");
    const ctx = await loadAccountCtx(context.userId, context.linkedinWorkspace);
    if (ctx.accountId !== r.data.account_id)
      throw new Error("A conta desta conversa não está mais ativa.");
    const response = await sendLinkedinChatReply(ctx, {
      chatId: r.data.provider_chat_id,
      text: data.text,
      requestKey: `inbox:${r.data.id}:${data.requestId}`,
    });
    const receipt = normalizeSendMessageResult(response);
    if (!receipt.messageId)
      throw new Error(
        "Envio com retorno incompleto: não repita a mensagem; solicite reconciliação.",
      );
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const saved = await supabaseAdmin.rpc(
      "linkedin_outbound_commit" as never,
      {
        p_conversation: r.data.id,
        p_workspace: context.linkedinWorkspace,
        p_owner: context.userId,
        p_message: receipt.messageId,
        p_body: data.text,
      } as never,
    );
    if (saved.error)
      throw new Error(
        "Envio confirmado, mas histórico pendente. Repetir a mesma tentativa apenas reconcilia o recibo.",
      );
    return { ok: true, id: saved.data };
  });

export const getLinkedinConversation = createServerFn({ method: "POST" })
  .middleware([requireLinkedinInbox("view")])
  .inputValidator((v) => z.object({ id: z.string().uuid() }).parse(v))
  .handler(async ({ context, data }) => {
    const r = await (context.supabase as any)
      .from("linkedin_conversations")
      .select("*")
      .eq("id", data.id)
      .eq("workspace_id", context.linkedinWorkspace)
      .eq("owner_id", context.userId)
      .single();
    if (r.error || !r.data) throw new Error("Conversa indisponível.");
    return r.data as LinkedinConversation;
  });
