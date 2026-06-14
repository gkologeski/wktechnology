// Server fns do mensageiro interno do workspace.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const UuidArr = z.array(z.string().uuid()).max(50);

async function resolveActiveWorkspace(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("active_workspace_id")
    .eq("id", userId)
    .maybeSingle();
  let ws = (profile as { active_workspace_id: string | null } | null)?.active_workspace_id ?? null;
  if (!ws) {
    const { data: m } = await supabaseAdmin
      .from("workspace_members")
      .select("workspace_id")
      .eq("user_id", userId)
      .order("joined_at", { ascending: true, nullsFirst: false })
      .limit(1)
      .maybeSingle();
    ws = (m as { workspace_id: string | null } | null)?.workspace_id ?? null;
  }
  if (!ws) throw new Error("Nenhum workspace ativo para o usuário.");
  return ws;
}

async function assertMembership(workspaceId: string, userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("workspace_members")
    .select("workspace_id")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) throw new Error("Usuário não é membro deste workspace.");
}

export const listConversations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const ws = await resolveActiveWorkspace(userId);

    // Conversas em que o usuário é membro
    const { data: myMemberships, error: mErr } = await supabaseAdmin
      .from("chat_conversation_members")
      .select("conversation_id, last_read_at, muted")
      .eq("user_id", userId);
    if (mErr) throw new Error(mErr.message);

    const convIds = (myMemberships ?? []).map((m) => m.conversation_id as string);
    if (convIds.length === 0) return [];

    const { data: convs, error: cErr } = await supabaseAdmin
      .from("chat_conversations")
      .select("id, kind, title, last_message_at, workspace_owner_id, created_by")
      .in("id", convIds)
      .eq("workspace_owner_id", ws)
      .order("last_message_at", { ascending: false, nullsFirst: false });
    if (cErr) throw new Error(cErr.message);

    const convIdsScoped = (convs ?? []).map((c) => c.id as string);
    if (convIdsScoped.length === 0) return [];

    const { data: members } = await supabaseAdmin
      .from("chat_conversation_members")
      .select("conversation_id, user_id")
      .in("conversation_id", convIdsScoped);

    const { data: lastMsgs } = await supabaseAdmin
      .from("chat_messages")
      .select("id, conversation_id, body, sender_user_id, created_at")
      .in("conversation_id", convIdsScoped)
      .order("created_at", { ascending: false });

    const lastByConv = new Map<
      string,
      { body: string | null; sender_user_id: string; created_at: string }
    >();
    (lastMsgs ?? []).forEach((m) => {
      const cid = m.conversation_id as string;
      if (!lastByConv.has(cid)) {
        lastByConv.set(cid, {
          body: (m.body as string | null) ?? null,
          sender_user_id: m.sender_user_id as string,
          created_at: m.created_at as string,
        });
      }
    });

    const myReadByConv = new Map(
      (myMemberships ?? []).map(
        (m) => [m.conversation_id as string, (m.last_read_at as string | null) ?? null] as const,
      ),
    );

    const unreadByConv = new Map<string, number>();
    (lastMsgs ?? []).forEach((m) => {
      const cid = m.conversation_id as string;
      const lr = myReadByConv.get(cid);
      if (m.sender_user_id === userId) return;
      if (!lr || (m.created_at as string) > lr) {
        unreadByConv.set(cid, (unreadByConv.get(cid) ?? 0) + 1);
      }
    });

    const membersByConv = new Map<string, string[]>();
    (members ?? []).forEach((m) => {
      const cid = m.conversation_id as string;
      const arr = membersByConv.get(cid) ?? [];
      arr.push(m.user_id as string);
      membersByConv.set(cid, arr);
    });

    return (convs ?? []).map((c) => ({
      id: c.id as string,
      kind: c.kind as "dm" | "group",
      title: (c.title as string | null) ?? null,
      last_message_at: (c.last_message_at as string | null) ?? null,
      last_message_preview: lastByConv.get(c.id as string)?.body ?? null,
      last_message_sender: lastByConv.get(c.id as string)?.sender_user_id ?? null,
      unread_count: unreadByConv.get(c.id as string) ?? 0,
      member_user_ids: membersByConv.get(c.id as string) ?? [],
    }));
  });

export const getOrCreateDM = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ other_user_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    if (data.other_user_id === userId) throw new Error("Selecione outro usuário.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const ws = await resolveActiveWorkspace(userId);
    await assertMembership(ws, data.other_user_id);

    // Procura DM existente entre os dois neste workspace
    const { data: mine } = await supabaseAdmin
      .from("chat_conversation_members")
      .select("conversation_id")
      .eq("user_id", userId);
    const mineIds = (mine ?? []).map((m) => m.conversation_id as string);

    if (mineIds.length > 0) {
      const { data: existing } = await supabaseAdmin
        .from("chat_conversations")
        .select("id, kind, workspace_owner_id, chat_conversation_members!inner(user_id)")
        .in("id", mineIds)
        .eq("kind", "dm")
        .eq("workspace_owner_id", ws);
      const found = (existing ?? []).find((c) => {
        const members = (c as unknown as { chat_conversation_members: { user_id: string }[] })
          .chat_conversation_members;
        const ids = members.map((m) => m.user_id);
        return ids.length === 2 && ids.includes(userId) && ids.includes(data.other_user_id);
      });
      if (found) return { conversation_id: found.id as string };
    }

    const { data: conv, error: cErr } = await supabaseAdmin
      .from("chat_conversations")
      .insert({ workspace_owner_id: ws, kind: "dm", created_by: userId } as never)
      .select("id")
      .single();
    if (cErr) throw new Error(cErr.message);
    const convId = (conv as { id: string }).id;

    const { error: mErr } = await supabaseAdmin.from("chat_conversation_members").insert([
      { conversation_id: convId, user_id: userId },
      { conversation_id: convId, user_id: data.other_user_id },
    ] as never);
    if (mErr) throw new Error(mErr.message);

    return { conversation_id: convId };
  });

export const createGroup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        title: z.string().min(1).max(120),
        member_user_ids: UuidArr.min(1),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const ws = await resolveActiveWorkspace(userId);

    // Todos os convidados devem ser membros do workspace
    const ids = Array.from(new Set(data.member_user_ids.filter((id) => id !== userId)));
    const { data: validMembers } = await supabaseAdmin
      .from("workspace_members")
      .select("user_id")
      .eq("workspace_id", ws)
      .in("user_id", ids);
    const validIds = new Set((validMembers ?? []).map((m) => m.user_id as string));
    const finalIds = [userId, ...ids.filter((id) => validIds.has(id))];

    const { data: conv, error: cErr } = await supabaseAdmin
      .from("chat_conversations")
      .insert({
        workspace_owner_id: ws,
        kind: "group",
        title: data.title,
        created_by: userId,
      } as never)
      .select("id")
      .single();
    if (cErr) throw new Error(cErr.message);
    const convId = (conv as { id: string }).id;

    const { error: mErr } = await supabaseAdmin
      .from("chat_conversation_members")
      .insert(finalIds.map((uid) => ({ conversation_id: convId, user_id: uid })) as never);
    if (mErr) throw new Error(mErr.message);

    return { conversation_id: convId };
  });

export const addGroupMembers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        conversation_id: z.string().uuid(),
        user_ids: UuidArr.min(1),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Caller precisa ser membro
    const { data: meMember } = await supabaseAdmin
      .from("chat_conversation_members")
      .select("conversation_id")
      .eq("conversation_id", data.conversation_id)
      .eq("user_id", userId)
      .maybeSingle();
    if (!meMember) throw new Error("Você não participa desta conversa.");

    const { data: conv } = await supabaseAdmin
      .from("chat_conversations")
      .select("workspace_owner_id, kind")
      .eq("id", data.conversation_id)
      .maybeSingle();
    if (!conv) throw new Error("Conversa não encontrada.");
    if ((conv as { kind: string }).kind !== "group")
      throw new Error("Apenas grupos aceitam novos membros.");

    const ws = (conv as { workspace_owner_id: string }).workspace_owner_id;
    const { data: valid } = await supabaseAdmin
      .from("workspace_members")
      .select("user_id")
      .eq("workspace_id", ws)
      .in("user_id", data.user_ids);
    const validIds = (valid ?? []).map((m) => m.user_id as string);

    if (validIds.length === 0) return { ok: true, added: 0 };

    await supabaseAdmin
      .from("chat_conversation_members")
      .upsert(
        validIds.map((uid) => ({ conversation_id: data.conversation_id, user_id: uid })) as never,
        { onConflict: "conversation_id,user_id" },
      );
    return { ok: true, added: validIds.length };
  });

export const listMessages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        conversation_id: z.string().uuid(),
        before: z.string().datetime().optional(),
        limit: z.number().int().min(1).max(100).default(50),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: meMember } = await supabaseAdmin
      .from("chat_conversation_members")
      .select("conversation_id")
      .eq("conversation_id", data.conversation_id)
      .eq("user_id", userId)
      .maybeSingle();
    if (!meMember) throw new Error("Você não participa desta conversa.");

    let q = supabaseAdmin
      .from("chat_messages")
      .select(
        "id, sender_user_id, body, created_at, edited_at, deleted_at, attachments:chat_message_attachments(id, storage_path, file_name, mime_type, size_bytes)",
      )
      .eq("conversation_id", data.conversation_id)
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (data.before) q = q.lt("created_at", data.before);

    const { data: msgs, error } = await q;
    if (error) throw new Error(error.message);
    return (msgs ?? []).reverse();
  });

export const sendMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        message_id: z.string().uuid(),
        conversation_id: z.string().uuid(),
        body: z.string().max(8000).optional().default(""),
        attachments: z
          .array(
            z.object({
              storage_path: z.string().min(1).max(500),
              file_name: z.string().min(1).max(255),
              mime_type: z.string().max(100).optional(),
              size_bytes: z
                .number()
                .int()
                .min(0)
                .max(20 * 1024 * 1024)
                .optional(),
            }),
          )
          .max(10)
          .optional()
          .default([]),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: conv } = await supabaseAdmin
      .from("chat_conversations")
      .select("id, workspace_owner_id")
      .eq("id", data.conversation_id)
      .maybeSingle();
    if (!conv) throw new Error("Conversa não encontrada.");

    const { data: meMember } = await supabaseAdmin
      .from("chat_conversation_members")
      .select("conversation_id")
      .eq("conversation_id", data.conversation_id)
      .eq("user_id", userId)
      .maybeSingle();
    if (!meMember) throw new Error("Você não participa desta conversa.");

    const body = (data.body ?? "").trim();
    if (!body && data.attachments.length === 0) throw new Error("Mensagem vazia.");

    const { error: msgErr } = await supabaseAdmin.from("chat_messages").insert({
      id: data.message_id,
      conversation_id: data.conversation_id,
      workspace_owner_id: (conv as { workspace_owner_id: string }).workspace_owner_id,
      sender_user_id: userId,
      body: body || null,
    } as never);
    if (msgErr) throw new Error(msgErr.message);

    if (data.attachments.length > 0) {
      const { error: attErr } = await supabaseAdmin.from("chat_message_attachments").insert(
        data.attachments.map((a) => ({
          message_id: data.message_id,
          storage_path: a.storage_path,
          file_name: a.file_name,
          mime_type: a.mime_type ?? null,
          size_bytes: a.size_bytes ?? null,
        })) as never,
      );
      if (attErr) throw new Error(attErr.message);
    }

    // Marca o próprio remetente como tendo lido sua mensagem
    await supabaseAdmin
      .from("chat_conversation_members")
      .update({ last_read_at: new Date().toISOString() } as never)
      .eq("conversation_id", data.conversation_id)
      .eq("user_id", userId);

    return { message_id: data.message_id };
  });

export const markRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ conversation_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("chat_conversation_members")
      .update({ last_read_at: new Date().toISOString() } as never)
      .eq("conversation_id", data.conversation_id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
