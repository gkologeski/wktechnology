// Server fn: ao mudar o status de um chamado interno (bug_report),
// envia uma DM ao usuário que abriu o chamado.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const STATUS_LABEL: Record<string, string> = {
  open: "Aberto",
  triaged: "Triado",
  in_progress: "Em andamento",
  resolved: "Resolvido",
  wont_fix: "Não será corrigido",
};

export const notifyBugReportStatusChange = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        bug_report_id: z.string().uuid(),
        new_status: z.string().min(1).max(40),
        resolution_text: z.string().trim().min(1).max(4000).optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1) Carrega chamado
    const { data: br } = await supabaseAdmin
      .from("bug_reports")
      .select("id, owner_id, description")
      .eq("id", data.bug_report_id)
      .maybeSingle();
    if (!br) return { ok: false, reason: "bug_report_not_found" };

    const opener = (br as { owner_id: string }).owner_id;
    if (!opener || opener === userId) return { ok: false, reason: "no_recipient" };

    // 2) Acha um workspace em comum entre o admin atual e o opener
    const [{ data: myWs }, { data: openerWs }] = await Promise.all([
      supabaseAdmin.from("workspace_members").select("workspace_id").eq("user_id", userId),
      supabaseAdmin.from("workspace_members").select("workspace_id").eq("user_id", opener),
    ]);
    const mySet = new Set((myWs ?? []).map((r) => r.workspace_id as string));
    const shared = (openerWs ?? []).map((r) => r.workspace_id as string).find((w) => mySet.has(w));
    if (!shared) return { ok: false, reason: "no_shared_workspace" };
    const ws = shared;

    // 3) Obtém ou cria DM entre o admin e o opener neste workspace
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
        return ids.length === 2 && ids.includes(userId) && ids.includes(opener);
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
      const { error: mErr } = await supabaseAdmin.from("chat_conversation_members").insert([
        { conversation_id: convId, user_id: userId },
        { conversation_id: convId, user_id: opener },
      ] as never);
      if (mErr) throw new Error(mErr.message);
    }

    // 4) Monta e envia a mensagem
    const label = STATUS_LABEL[data.new_status] ?? data.new_status;
    const snippet = ((br as { description: string }).description ?? "").slice(0, 80);
    let body = `O status do seu chamado "${snippet}${snippet.length === 80 ? "…" : ""}" foi atualizado para *${label}*.`;
    if (data.resolution_text && data.new_status === "resolved") {
      body += `\n\n*Resolução:* ${data.resolution_text}`;
    }

    const { error: msgErr } = await supabaseAdmin.from("chat_messages").insert({
      conversation_id: convId,
      workspace_owner_id: ws,
      sender_user_id: userId,
      body,
    } as never);
    if (msgErr) throw new Error(msgErr.message);

    return { ok: true, conversation_id: convId };
  });
