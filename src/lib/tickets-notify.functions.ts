// Server fn: ao mudar o status de um ticket, envia uma DM ao usuário que abriu.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const STATUS_LABEL: Record<string, string> = {
  new: "Novo",
  open: "Em atendimento",
  waiting: "Aguardando cliente",
  resolved: "Resolvido",
  closed: "Fechado",
};

export const notifyTicketStatusChange = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        ticket_id: z.string().uuid(),
        new_status: z.string().min(1).max(40),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1) Carrega ticket
    const { data: ticket } = await supabaseAdmin
      .from("tickets")
      .select("id, subject, workspace_id, assignee_id")
      .eq("id", data.ticket_id)
      .maybeSingle();
    if (!ticket) return { ok: false, reason: "ticket_not_found" };
    const ws = (ticket as { workspace_id: string }).workspace_id;
    const subject = (ticket as { subject: string }).subject;

    // 2) Descobre quem abriu o chamado via audit_logs ('created')
    const { data: createdEvt } = await supabaseAdmin
      .from("audit_logs")
      .select("actor_user_id, created_at")
      .eq("entity", "tickets")
      .eq("entity_id", data.ticket_id)
      .eq("action", "created")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    let opener = (createdEvt as { actor_user_id: string | null } | null)?.actor_user_id ?? null;
    // fallback: assignee (caso seja o "responsável" inicial)
    if (!opener) opener = (ticket as { assignee_id: string | null }).assignee_id ?? null;
    if (!opener || opener === userId) return { ok: false, reason: "no_recipient" };

    // 3) Opener precisa ser membro do workspace pra entrar no chat
    const { data: openerMember } = await supabaseAdmin
      .from("workspace_members")
      .select("user_id")
      .eq("workspace_id", ws)
      .eq("user_id", opener)
      .maybeSingle();
    if (!openerMember) return { ok: false, reason: "opener_not_member" };

    // 4) Obtém ou cria DM entre o usuário atual e o opener neste workspace
    const { data: mine } = await supabaseAdmin
      .from("chat_conversation_members")
      .select("conversation_id")
      .eq("user_id", userId);
    const mineIds = (mine ?? []).map((m) => m.conversation_id as string);

    let convId: string | null = null;
    if (mineIds.length > 0) {
      const { data: existing } = await supabaseAdmin
        .from("chat_conversations")
        .select("id, chat_conversation_members!inner(user_id)")
        .in("id", mineIds)
        .eq("kind", "dm")
        .eq("workspace_owner_id", ws);
      const found = (existing ?? []).find((c) => {
        const members = (c as unknown as { chat_conversation_members: { user_id: string }[] })
          .chat_conversation_members;
        const ids = members.map((m) => m.user_id);
        return ids.length === 2 && ids.includes(userId) && ids.includes(opener!);
      });
      if (found) convId = (found as { id: string }).id;
    }

    if (!convId) {
      const { data: conv, error: cErr } = await supabaseAdmin
        .from("chat_conversations")
        .insert({ workspace_owner_id: ws, kind: "dm", created_by: userId } as never)
        .select("id")
        .single();
      if (cErr) throw new Error(cErr.message);
      convId = (conv as { id: string }).id;
      const { error: mErr } = await supabaseAdmin
        .from("chat_conversation_members")
        .insert([
          { conversation_id: convId, user_id: userId },
          { conversation_id: convId, user_id: opener },
        ] as never);
      if (mErr) throw new Error(mErr.message);
    }

    // 5) Envia a mensagem
    const label = STATUS_LABEL[data.new_status] ?? data.new_status;
    const body = `O status do chamado "${subject}" foi atualizado para *${label}* e já está em tratativa.`;

    const { error: msgErr } = await supabaseAdmin
      .from("chat_messages")
      .insert({
        conversation_id: convId,
        workspace_owner_id: ws,
        sender_user_id: userId,
        body,
      } as never);
    if (msgErr) throw new Error(msgErr.message);

    return { ok: true, conversation_id: convId };
  });
