import type { SupabaseClient } from "@supabase/supabase-js";

/** The user client's real RLS result is authoritative. Permission errors must
 * stop here; only an exact unique conflict can enter read-under-RLS recovery. */
function assertChatInsertResult(error: { code: string; message: string } | null) {
  if (error && error.code !== "23505") throw new Error(error.message);
}

/** The actual authenticated INSERT is the chat transport. Never use an admin
 * client here: all permissive and restrictive row policies must run together. */
export async function sendAuthenticatedChat(
  user: SupabaseClient,
  input: { workspace: string; actor: string; session: string; request: string; body: string },
) {
  const { error } = await user.from("live_chat_messages").insert({
    id: input.request,
    inbox_chat_request: input.request,
    workspace_id: input.workspace,
    owner_id: input.workspace,
    session_id: input.session,
    direction: "outbound",
    author_user_id: input.actor,
    body: input.body,
  });
  assertChatInsertResult(error);
  if (!error) return;
  // A duplicate accepted request is read back under the same real user's RLS.
  // No UPDATE/upsert and no mutable projection can acquire a fresh receipt.
  const { data: existing, error: readError } = await user
    .from("live_chat_messages")
    .select("id,inbox_chat_request,session_id,author_user_id,body,direction")
    .eq("workspace_id", input.workspace)
    .eq("id", input.request)
    .maybeSingle();
  if (
    readError ||
    !existing ||
    existing.inbox_chat_request !== input.request ||
    existing.session_id !== input.session ||
    existing.author_user_id !== input.actor ||
    existing.body !== input.body ||
    existing.direction !== "outbound"
  )
    throw new Error("Tentativa divergente ou indisponível; envio bloqueado.");
}
