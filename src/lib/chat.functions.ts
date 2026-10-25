// Server fns do mensageiro interno do workspace.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const UuidArr = z.array(z.string().uuid()).max(50);

import { resolveActiveWorkspace } from "@/lib/active-workspace.server";
import { requireSharedPermission } from "@/lib/access-control/shared-permission.middleware";
import { workRpc } from "@/lib/access-control/work-core.server";
async function assertConversation(client: Parameters<typeof workRpc>[0], id: string) {
  if ((await workRpc(client, "shared_chat_access", { i: id, a: "view" })) !== true)
    throw new Error("Conversa indisponível.");
}

export const listConversations = createServerFn({ method: "GET" })
  .middleware([requireSharedPermission("system.messenger", "view")])
  .handler(async ({ context }) => {
    const { userId } = context;
    const supabaseAdmin = context.supabase;
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
  .middleware([requireSharedPermission("system.messenger", "create")])
  .inputValidator((i) => z.object({ other_user_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    return workRpc<{ conversation_id: string }>(context.supabase, "shared_chat_write", {
      a: "dm",
      p: { members: [data.other_user_id] },
    });
  });

export const createGroup = createServerFn({ method: "POST" })
  .middleware([requireSharedPermission("system.messenger", "create")])
  .inputValidator((i) =>
    z
      .object({
        title: z.string().min(1).max(120),
        member_user_ids: UuidArr.min(1),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    return workRpc<{ conversation_id: string }>(context.supabase, "shared_chat_write", {
      a: "group",
      p: { members: data.member_user_ids, title: data.title },
    });
  });

export const addGroupMembers = createServerFn({ method: "POST" })
  .middleware([requireSharedPermission("system.messenger", "manage")])
  .inputValidator((i) =>
    z
      .object({
        conversation_id: z.string().uuid(),
        user_ids: UuidArr.min(1),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    return workRpc<{ ok: boolean; added: number }>(context.supabase, "shared_chat_write", {
      a: "invite",
      p: { conversation_id: data.conversation_id, members: data.user_ids },
    });
  });

export const listMessages = createServerFn({ method: "POST" })
  .middleware([requireSharedPermission("system.messenger", "view")])
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
    await assertConversation(context.supabase, data.conversation_id);
    const { userId } = context;
    const supabaseAdmin = context.supabase;

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
  .middleware([requireSharedPermission("system.messenger", "create")])
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
    return workRpc<{ message_id: string }>(context.supabase, "shared_chat_write", {
      a: "send",
      p: data,
    });
  });

export const markRead = createServerFn({ method: "POST" })
  .middleware([requireSharedPermission("system.messenger", "view")])
  .inputValidator((i) => z.object({ conversation_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertConversation(context.supabase, data.conversation_id);
    const { userId } = context;
    const supabaseAdmin = context.supabase;
    const { error } = await supabaseAdmin
      .from("chat_conversation_members")
      .update({ last_read_at: new Date().toISOString() } as never)
      .eq("conversation_id", data.conversation_id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
