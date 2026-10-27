import { validateEmailAddress } from "@/lib/email-address";
import { getPublicAppUrl } from "@/lib/app-url";
import {
  buildRawMime,
  ensureAccessToken,
  gmailSendRaw,
  type EmailAccountRow,
  type MimeAttachment,
} from "@/lib/gmail.server";
import type { ChannelIdentity } from "./channel-identity";
import type { ConversationMessage } from "./policy";

export type ServiceSession = {
  id: string;
  workspace_id: string;
  account_id: string;
  channel: "email" | "chat";
  source_id: string;
  enrollment_id: string;
  ai_owner: string;
  ai_version: number;
  origin: "inbound" | "campaign";
  identity_verified: boolean;
  context_approved: boolean;
};
export type ServiceJob = {
  id: string;
  workspace_id: string;
  session_id: string;
  inbound_message_id: string;
  conversation_version: number;
  status: string;
  lease_token: string;
  attempts: number;
  draft_text: string;
  draft_payload: Record<string, any>;
  outbound_message_id: string;
  provider_message_id?: string | null;
  send_token?: string;
  send_started_at?: string | null;
};
const must = <T>(result: { data: T; error: { message: string } | null }) => {
  if (result.error) throw new Error(result.error.message);
  return result.data;
};

export async function serviceJobGuard(admin: any, job: ServiceJob) {
  const result = must(
    await admin.rpc("service_agent_guard", { p_job: job.id, p_lease: job.lease_token }),
  );
  if (result !== "ok") throw Object.assign(new Error(String(result)), { serviceGuard: true });
}

export async function loadServiceHistory(
  admin: any,
  session: ServiceSession,
  emailAccountId?: string,
): Promise<ConversationMessage[]> {
  const email = session.channel === "email";
  if (email && !emailAccountId) throw new Error("Conta de histórico indisponível.");
  let query = admin
    .from(email ? "email_messages" : "live_chat_messages")
    .select(
      email
        ? "id,direction,body_text,snippet,from_email,created_at"
        : "id,direction,body,created_at",
    )
    .eq("workspace_id", session.workspace_id)
    .eq(email ? "thread_id" : "session_id", session.source_id)
    .order("created_at", { ascending: false })
    .limit(30);
  if (email) query = query.eq("account_id", emailAccountId);
  const rows = must(await query) as any[];
  return rows.reverse().map((row) => {
    const sender =
      email && row.direction === "inbound" ? validateEmailAddress(row.from_email) : null;
    return {
      id: row.id,
      direction: row.direction,
      created_at: row.created_at,
      body: `${sender?.ok ? `E-mail do remetente: ${sender.value}\n` : ""}${String(email ? row.body_text || row.snippet || "" : row.body || "").slice(0, 4000)}`,
    };
  });
}

/** Only approved workspace files; bounded stream avoids loading arbitrary-size objects into the worker. */
async function emailMaterialAttachments(
  admin: any,
  workspaceId: string,
  ids: string[],
): Promise<MimeAttachment[]> {
  if (!ids.length) return [];
  if (ids.length > 10) throw new Error("Limite de materiais por mensagem excedido.");
  const files = must(
    await admin
      .from("sdr_materials")
      .select("id,title,kind,storage_path,file_name,mime,approved,active")
      .eq("workspace_id", workspaceId)
      .in("id", ids)
      .eq("kind", "file"),
  ) as any[];
  if (files.length !== ids.length) throw new Error("Material indisponível.");
  let total = 0;
  const output: MimeAttachment[] = [];
  for (const file of files) {
    if (!file.active || !file.approved || !file.storage_path?.startsWith(`${workspaceId}/`))
      throw new Error("Material indisponível.");
    const signed = must(
      await admin.storage.from("sdr-materials").createSignedUrl(file.storage_path, 300),
    ) as { signedUrl: string };
    const response = await fetch(signed.signedUrl, { redirect: "manual" });
    if (!response.ok || !response.body)
      throw new Error("Não foi possível carregar o material aprovado.");
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let fileSize = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      fileSize += value.byteLength;
      total += value.byteLength;
      if (fileSize > 16 * 1024 * 1024 || total > 20 * 1024 * 1024) {
        await reader.cancel();
        throw new Error("Materiais excedem o limite de anexos do e-mail.");
      }
      chunks.push(value);
    }
    output.push({
      filename: file.file_name || file.title,
      contentType: file.mime || "application/octet-stream",
      data: Buffer.concat(chunks),
    });
  }
  return output;
}

export async function deliverServiceJob(
  admin: any,
  session: ServiceSession,
  job: ServiceJob,
  identity: ChannelIdentity,
) {
  await serviceJobGuard(admin, job);
  const materialIds = Array.isArray(job.draft_payload?.file_material_ids)
    ? (job.draft_payload.file_material_ids as string[])
    : [];
  if (session.channel === "chat") {
    const files = materialIds.length
      ? (must(
          await admin
            .from("sdr_materials")
            .select("id,title,kind,active,approved")
            .eq("workspace_id", session.workspace_id)
            .in("id", materialIds)
            .eq("kind", "file"),
        ) as any[])
      : [];
    if (files.length !== materialIds.length || files.some((file) => !file.active || !file.approved))
      throw Object.assign(new Error("Material indisponível."), { beforeProvider: true });
    const id = must(
      await admin.rpc("service_agent_send_chat", {
        p_job: job.id,
        p_lease: job.lease_token,
        p_attachments: files.map((f) => ({ material_id: f.id, title: f.title })),
      }),
    );
    return { providerId: String(id) };
  }
  // Account and recipient come from the original thread/message, never model arguments.
  const thread = must(
    await admin
      .from("email_threads")
      .select("id,account_id,provider_thread_id,subject")
      .eq("workspace_id", session.workspace_id)
      .eq("id", session.source_id)
      .single(),
  ) as any;
  const account = must(
    await admin
      .from("email_accounts")
      .select(
        "id,workspace_id,owner_id,email,provider,status,access_token,refresh_token,expires_at",
      )
      .eq("workspace_id", session.workspace_id)
      .eq("id", thread.account_id)
      .single(),
  ) as EmailAccountRow & { provider: string };
  const incoming = must(
    await admin
      .from("email_messages")
      .select("from_email,message_id_header")
      .eq("workspace_id", session.workspace_id)
      .eq("id", job.inbound_message_id)
      .eq("thread_id", thread.id)
      .eq("account_id", account.id)
      .eq("direction", "inbound")
      .single(),
  ) as any;
  const recipient = validateEmailAddress(incoming.from_email);
  if (!recipient.ok || account.status !== "connected" || account.provider !== "gmail")
    throw Object.assign(new Error("Conta ou remetente de e-mail indisponível."), {
      beforeProvider: true,
    });
  let raw: string;
  let token: string;
  const header = `<service-${job.id}@${new URL(getPublicAppUrl()).hostname}>`;
  try {
    const attachments = await emailMaterialAttachments(admin, session.workspace_id, materialIds);
    token = await ensureAccessToken(account);
    raw = buildRawMime({
      from: account.email,
      fromName: identity.displayName,
      to: [recipient.value],
      subject: String(thread.subject || "").slice(0, 998) || "Atendimento",
      bodyText: job.draft_text,
      attachments,
      messageId: header,
      autoSubmitted: true,
      inReplyTo:
        typeof incoming.message_id_header === "string" &&
        /^<[^<>\r\n]+>$/.test(incoming.message_id_header)
          ? incoming.message_id_header
          : undefined,
    });
    await serviceJobGuard(admin, job);
    must(
      await admin
        .from("service_agent_jobs")
        .update({ draft_payload: { ...job.draft_payload, delivery_header: header } })
        .eq("id", job.id)
        .eq("send_token", job.send_token),
    );
  } catch (error) {
    throw Object.assign(error as Error, { beforeProvider: true });
  }
  // An error after this call is uncertain; never retry a provider send blindly.
  const sent = await gmailSendRaw(token, raw, thread.provider_thread_id);
  must(
    await admin
      .from("service_agent_jobs")
      .update({ provider_message_id: sent.id })
      .eq("id", job.id)
      .eq("send_token", job.send_token),
  );
  must(
    await admin.rpc("service_agent_complete_email", {
      p_job: job.id,
      p_send_token: job.send_token,
      p_provider_id: sent.id,
      p_header: header,
    }),
  );
  return { providerId: sent.id };
}
