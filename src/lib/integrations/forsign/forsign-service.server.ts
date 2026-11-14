import { resolveSignerContacts } from "@/lib/contracts/signer-contacts.server";
// Serviço server-only do ForSign. Toda ação de usuário confere permissão no workspace ativo
// com o cliente do próprio usuário antes de qualquer leitura com a conta de serviço.
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  assertPermission,
  getActiveWorkspaceId,
  hasPermission,
} from "@/lib/access-control/enforce.server";
import { workRpc } from "@/lib/access-control/work-core.server";
import { assertNotReadOnlyView } from "@/lib/view-as-guard.server";
import { decryptApiKey, encryptApiKey } from "@/lib/ai/provider-resolver.server";
import { getPublicAppUrl } from "@/lib/app-url";
import type { SignatureContext } from "@/lib/hiring/signature.types";
import {
  buildMembers,
  allRequestedSignersCompleted,
  mapOperationStatus,
  type ForsignOpStatus,
  type SignerInput,
} from "./forsign-core";

export const FS_SETTINGS = "techcontracts.forsign_settings.manage.workspace";
export const FS_SEND = "techcontracts.forsign.manage.workspace";
const EVIDENCE_MANAGE = "techcontracts.signature_evidence.manage.workspace";
const EVIDENCE_VIEW = "techcontracts.signature_evidence.view.workspace";

async function admin(): Promise<any> {
  return (await import("@/integrations/supabase/client.server")).supabaseAdmin;
}

type Conn = {
  workspace_id: string;
  key_ciphertext: string | null;
  key_last4: string | null;
  webhook_secret_ciphertext: string | null;
  enabled: boolean;
  status: string;
  last_error: string | null;
  last_tested_at: string | null;
};

async function loadConn(ws: string): Promise<Conn | null> {
  const { data, error } = await (await admin())
    .from("forsign_connections")
    .select("*")
    .eq("workspace_id", ws)
    .maybeSingle();
  if (error) throw new Error("Não foi possível ler a configuração do ForSign.");
  return data as Conn | null;
}

export async function clientFor(ws: string): Promise<ForsignClient> {
  const c = await loadConn(ws);
  if (!c?.key_ciphertext || !c.enabled)
    throw new Error("A integração ForSign não está ativa neste workspace.");
  return new ForsignClient(await decryptApiKey(c.key_ciphertext));
}

export async function webhookSecretFor(ws: string): Promise<string | null> {
  const c = await loadConn(ws);
  return c?.webhook_secret_ciphertext && c.enabled
    ? decryptApiKey(c.webhook_secret_ciphertext)
    : null;
}

function webhookUrl(ws: string) {
  return `${getPublicAppUrl()}/api/public/forsign/webhook?w=${ws}`;
}

function view(c: Conn | null, ws: string) {
  return {
    configured: Boolean(c?.key_ciphertext),
    enabled: c?.enabled ?? false,
    status: (c?.status ?? "not_configured") as "not_configured" | "connected" | "failed",
    keyLast4: c?.key_last4 ?? null,
    hasWebhookSecret: Boolean(c?.webhook_secret_ciphertext),
    lastError: c?.last_error ?? null,
    lastTestedAt: c?.last_tested_at ?? null,
    webhookUrl: webhookUrl(ws),
  };
}

export async function getSettings(sb: SupabaseClient, userId: string) {
  const ws = await getActiveWorkspaceId(sb, userId);
  await assertPermission(sb, userId, ws, FS_SETTINGS);
  return view(await loadConn(ws), ws);
}

export async function saveSettings(
  sb: SupabaseClient,
  userId: string,
  input: { apiKey?: string; webhookSecret?: string; enabled: boolean },
) {
  const ws = await getActiveWorkspaceId(sb, userId);
  await assertPermission(sb, userId, ws, FS_SETTINGS);
  await assertNotReadOnlyView(sb);
  const prev = await loadConn(ws);
  const patch: Record<string, unknown> = {
    workspace_id: ws,
    enabled: input.enabled,
    updated_by: userId,
    updated_at: new Date().toISOString(),
  };
  let key = prev?.key_ciphertext ? await decryptApiKey(prev.key_ciphertext) : null;
  if (input.apiKey) {
    key = input.apiKey;
    patch.key_ciphertext = await encryptApiKey(input.apiKey);
    patch.key_last4 = input.apiKey.slice(-4);
  }
  if (input.webhookSecret)
    patch.webhook_secret_ciphertext = await encryptApiKey(input.webhookSecret);
  if (key) Object.assign(patch, await probe(key));
  const { error } = await (await admin()).from("forsign_connections").upsert(patch);
  if (error) throw new Error("Não foi possível salvar a configuração do ForSign.");
  return view(await loadConn(ws), ws);
}

async function probe(key: string) {
  const at = new Date().toISOString();
  try {
    await new ForsignClient(key).testKey();
    return { status: "connected", last_error: null, last_tested_at: at };
  } catch (e) {
    return {
      status: "failed",
      last_error: e instanceof Error ? e.message : "Falha",
      last_tested_at: at,
    };
  }
}

export async function testSettings(sb: SupabaseClient, userId: string) {
  const ws = await getActiveWorkspaceId(sb, userId);
  await assertPermission(sb, userId, ws, FS_SETTINGS);
  const c = await loadConn(ws);
  if (!c?.key_ciphertext) throw new Error("Informe a chave da API do ForSign.");
  const r = await probe(await decryptApiKey(c.key_ciphertext));
  await (await admin()).from("forsign_connections").update(r).eq("workspace_id", ws);
  return view(await loadConn(ws), ws);
}

/** Envios do contrato (leitura por RLS do usuário) + se a integração está pronta. */
export async function getContractOps(sb: SupabaseClient, userId: string, contractId: string) {
  const ws = await getActiveWorkspaceId(sb, userId);
  await assertPermission(sb, userId, ws, EVIDENCE_VIEW);
  const { data, error } = await (sb as any)
    .from("contract_forsign_operations")
    .select(
      "id,operation_id,status,members,contract_hash,last_error,last_synced_at,completed_at,created_at,evidence_id",
    )
    .eq("workspace_id", ws)
    .eq("contract_id", contractId)
    .order("created_at", { ascending: false })
    .limit(10);
  if (error) throw new Error("Não foi possível ler os envios ao ForSign.");
  const c = await loadConn(ws);
  return {
    ready: Boolean(c?.key_ciphertext && c.enabled && c.status === "connected"),
    canSend: await hasPermission(sb, userId, ws, FS_SEND),
    operations: (data ?? []) as {
      id: string;
      operation_id: number | null;
      status: ForsignOpStatus;
      members: {
        name: string;
        email: string;
        role: string | null;
        status: string;
        completedAt: string | null;
      }[];
      contract_hash: string;
      last_error: string | null;
      last_synced_at: string | null;
      completed_at: string | null;
      created_at: string;
      evidence_id: string | null;
    }[],
  };
}

async function authorizeSend(sb: SupabaseClient, userId: string, contractId: string, hash: string) {
  const ws = await getActiveWorkspaceId(sb, userId);
  await assertPermission(sb, userId, ws, FS_SEND);
  await assertPermission(sb, userId, ws, EVIDENCE_MANAGE);
  await assertNotReadOnlyView(sb);
  const proof = await workRpc<SignatureContext>(sb, "hiring_contract_signature_context", {
    p_ws: ws,
    p_contract: contractId,
  });
  if (!proof.can_manage || proof.hash !== hash)
    throw new Error("Sem permissão ou contrato alterado. Recarregue a página.");
  return ws;
}

export async function sendContractFromContacts(
  sb: SupabaseClient,
  userId: string,
  input: { contractId: string; hash: string; signers: { contactId: string; role: string }[] },
) {
  const ws = await authorizeSend(sb, userId, input.contractId, input.hash);
  const signers = await resolveSignerContacts(sb, userId, ws, input.signers);
  if (signers.length > 10) throw new Error("Máximo de 10 signatários no ForSign.");
  return sendContract(sb, userId, { ...input, signers });
}

export async function sendContract(
  sb: SupabaseClient,
  userId: string,
  input: { contractId: string; hash: string; signers: (SignerInput & { contactId?: string })[] },
) {
  const ws = await authorizeSend(sb, userId, input.contractId, input.hash);
  if (input.signers.some((s) => !s.contactId))
    throw new Error("Selecione contatos para todos os signatários.");
  const members = buildMembers(input.signers);
  const db = await admin();
  const { data: contract, error: ce } = await db
    .from("contracts")
    .select("id,title,number")
    .eq("id", input.contractId)
    .eq("workspace_id", ws)
    .single();
  if (ce || !contract) throw new Error("Contrato não encontrado.");
  const { data: html, error: he } = await db.rpc("hiring_contract_esign_body", {
    p_ws: ws,
    p_contract: input.contractId,
  });
  if (he || !html) throw new Error("O contrato não tem conteúdo para assinatura.");
  const client = await clientFor(ws);
  const { data: row, error: ie } = await db
    .from("contract_forsign_operations")
    .insert({
      workspace_id: ws,
      contract_id: input.contractId,
      contract_hash: input.hash,
      created_by: userId,
      requested_members: input.signers.map((s) => ({
        contact_id: s.contactId,
        name: s.name,
        email: s.email,
        role: s.role,
      })),
      members: members.map((m) => ({
        name: m.name,
        email: m.email,
        role: m.role,
        status: "Create",
        completedAt: null,
      })),
    })
    .select("id")
    .single();
  if (ie || !row)
    throw new Error(
      ie?.code === "23505"
        ? "Esta versão do contrato já foi enviada ao ForSign. Cancele o envio atual para enviar de novo."
        : "Não foi possível registrar o envio.",
    );
  try {
    const title = `${contract.title}${contract.number ? ` (${contract.number})` : ""}`;
    const { contractHtmlToPdf } = await import("./forsign-pdf");
    const pdf = await contractHtmlToPdf(String(html), title);
    const fileName = `${(contract.number ?? contract.id).replace(/[^\w.-]+/g, "_")}.pdf`;
    const docId = await client.uploadPdf(pdf, fileName);
    const op = await client.createOperation({
      name: title.slice(0, 200),
      files: [{ id: docId, description: fileName }],
      members,
      order: false,
      language: "pt-br",
      externalId: input.contractId,
      metadata: [
        { key: "workspace_id", value: ws },
        { key: "contract_id", value: input.contractId },
        { key: "contract_hash", value: input.hash },
      ],
    });
    await db
      .from("contract_forsign_operations")
      .update({
        operation_id: op.id,
        document_ids: op.files.map((f: { id: number }) => f.id),
        status: "sent",
        last_synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id);
    return { id: row.id, operationId: op.id };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Falha ao enviar ao ForSign.";
    await db
      .from("contract_forsign_operations")
      .update({
        status: "failed",
        last_error: msg.slice(0, 500),
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id);
    throw new Error(msg);
  }
}

async function loadOpForUser(sb: SupabaseClient, userId: string, opId: string, manage: boolean) {
  const ws = await getActiveWorkspaceId(sb, userId);
  await assertPermission(sb, userId, ws, manage ? FS_SEND : EVIDENCE_VIEW);
  if (manage) await assertNotReadOnlyView(sb);
  // Leitura pelo cliente do usuário: a RLS confirma acesso à assinatura do contrato.
  const { data, error } = await (sb as any)
    .from("contract_forsign_operations")
    .select("id")
    .eq("id", opId)
    .eq("workspace_id", ws)
    .maybeSingle();
  if (error || !data) throw new Error("Envio não encontrado no seu acesso.");
  return ws;
}

export async function refreshForUser(sb: SupabaseClient, userId: string, opId: string) {
  await loadOpForUser(sb, userId, opId, false);
  return syncOperation(opId);
}

export async function cancelForUser(
  sb: SupabaseClient,
  userId: string,
  opId: string,
  message: string,
) {
  const ws = await loadOpForUser(sb, userId, opId, true);
  const db = await admin();
  const { data: op } = await db
    .from("contract_forsign_operations")
    .select("*")
    .eq("id", opId)
    .single();
  if (!op?.operation_id || !["sent", "partially_signed"].includes(op.status))
    throw new Error("Só é possível cancelar envios em andamento.");
  await (await clientFor(ws)).cancel(Number(op.operation_id), message);
  await db
    .from("contract_forsign_operations")
    .update({ status: "canceled", updated_at: new Date().toISOString() })
    .eq("id", opId);
  return { ok: true };
}

/** Consulta o ForSign e, se concluído, grava o PDF assinado como evidência. Idempotente. */
export async function syncOperation(opId: string) {
  const db = await admin();
  const { data: op, error } = await db
    .from("contract_forsign_operations")
    .select("*")
    .eq("id", opId)
    .single();
  if (error || !op) throw new Error("Envio não encontrado.");
  if (!op.operation_id || !["sent", "partially_signed", "completed"].includes(op.status))
    return { status: op.status as ForsignOpStatus };
  const client = await clientFor(op.workspace_id);
  const st = await client.status(Number(op.operation_id));
  let status = mapOperationStatus(st.status, {
    current: st.progressCurrent,
    total: st.progressTotal,
  });
  const incompleteRoster =
    status === "completed" &&
    !allRequestedSignersCompleted(op.requested_members ?? op.members, st.members);
  if (incompleteRoster) status = "partially_signed";
  const now = new Date().toISOString();
  await db
    .from("contract_forsign_operations")
    .update({
      status,
      members: st.members,
      completed_at: st.completedAt,
      last_synced_at: now,
      last_error: incompleteRoster
        ? "O ForSign ainda não comprovou a assinatura de todos os participantes enviados."
        : null,
      updated_at: now,
    })
    .eq("id", opId)
    .in("status", ["sent", "partially_signed", "completed"]);
  if (status !== "completed") return { status };
  return recordEvidence(op, client, st.completedAt);
}

async function recordEvidence(op: any, client: ForsignClient, completedAt: string | null) {
  const db = await admin();
  const docId = Array.isArray(op.document_ids) ? Number(op.document_ids[0]) : NaN;
  if (!Number.isFinite(docId)) throw new Error("Documento do ForSign não identificado.");
  let bytes: Uint8Array;
  try {
    bytes = await client.downloadDocument(Number(op.operation_id), docId);
  } catch (e) {
    // PDF final ainda sendo selado (aviso DocumentReady chega depois): tenta na próxima sincronização.
    if (e instanceof ForsignApiError && e.status === 400) return { status: "completed" as const };
    throw e;
  }
  const { createHash } = await import("node:crypto");
  const sha = createHash("sha256").update(bytes).digest("hex");
  const path = `${op.workspace_id}/${op.contract_id}/forsign-${op.operation_id}-${sha.slice(0, 12)}.pdf`;
  const bucket = db.storage.from("contract-signature-evidence");
  const { error: ue } = await bucket.upload(path, bytes, {
    contentType: "application/pdf",
    upsert: false,
    metadata: {
      sha256: sha,
      contract_hash: op.contract_hash,
      actor_id: op.created_by,
      provider: "forsign",
    },
  });
  if (ue && !/exists|duplicate/i.test(ue.message))
    throw new Error("Não foi possível guardar o PDF assinado.");
  const signedOn = (completedAt ?? new Date().toISOString()).slice(0, 10);
  const { data: evidence, error: re } = await db.rpc("forsign_record_evidence", {
    p_op: op.id,
    p_path: path,
    p_file_hash: sha,
    p_signed_on: signedOn,
  });
  if (re) throw new Error(re.message);
  if (evidence) {
    await emitWorkflowEvent(op, String(evidence)).catch(() => {});
  }
  return { status: (evidence ? "evidence_recorded" : "stale") as ForsignOpStatus };
}

/** Webhook: localiza o envio da operação dentro do workspace do aviso e sincroniza. */
export async function handleWebhookEvent(
  ws: string,
  evt: {
    OperationId?: unknown;
    Action?: unknown;
    OperationMemberId?: unknown;
    CreatedAt?: unknown;
  },
) {
  const opNum = Number(evt.OperationId);
  const action = Number(evt.Action);
  if (!Number.isSafeInteger(opNum) || !Number.isInteger(action)) return { ignored: true };
  const db = await admin();
  const { error: de } = await db.from("forsign_webhook_events").insert({
    workspace_id: ws,
    operation_id: opNum,
    action,
    member_id: Number.isSafeInteger(Number(evt.OperationMemberId))
      ? Number(evt.OperationMemberId)
      : null,
    event_created_at: String(evt.CreatedAt ?? "").slice(0, 64),
  });
  if (de?.code === "23505") return { duplicate: true };
  const { data: op } = await db
    .from("contract_forsign_operations")
    .select("id")
    .eq("workspace_id", ws)
    .eq("operation_id", opNum)
    .maybeSingle();
  if (!op) return { ignored: true };
  return syncOperation(op.id);
}

/** Cron: sincroniza envios pendentes (caso algum aviso do ForSign se perca). */
export async function syncPending(limit = 20) {
  const db = await admin();
  const { data } = await db
    .from("contract_forsign_operations")
    .select("id")
    .in("status", ["sent", "partially_signed", "completed"])
    .order("last_synced_at", { ascending: true, nullsFirst: true })
    .limit(limit);
  let ok = 0,
    failed = 0;
  for (const r of data ?? []) {
    try {
      await syncOperation(r.id);
      ok++;
    } catch (e) {
      failed++;
      await db
        .from("contract_forsign_operations")
        .update({
          last_error: (e instanceof Error ? e.message : "Falha").slice(0, 500),
          last_synced_at: new Date().toISOString(),
        })
        .eq("id", r.id);
    }
  }
  return { ok, failed };
}

// ---- Cliente HTTP da API pública do ForSign ----
// Cliente HTTP mínimo da API pública do ForSign (X-Api-Key). Sem dependência de Node.
export const FORSIGN_BASE = "https://api.forsign.digital";

export class ForsignApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

type Fetch = typeof fetch;

function friendly(status: number) {
  if (status === 401) return "Chave da API do ForSign inválida.";
  if (status === 403) return "A chave do ForSign não tem permissão para esta ação.";
  if (status === 404) return "Operação não encontrada no ForSign.";
  if (status === 402) return "Sem créditos no plano do ForSign.";
  return `O ForSign recusou a solicitação (HTTP ${status}).`;
}

export class ForsignClient {
  constructor(
    private readonly apiKey: string,
    private readonly f: Fetch = (input, init) => globalThis.fetch(input, init),
  ) {}

  private async call<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers = new Headers(init.headers);
    headers.set("X-Api-Key", this.apiKey);
    const res = await this.f(`${FORSIGN_BASE}${path}`, { ...init, headers });
    const text = await res.text();
    let body: any = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = null;
    }
    if (!res.ok) {
      const msg = body?.messages?.[0]?.value;
      throw new ForsignApiError(
        msg ? `${friendly(res.status)} ${String(msg).slice(0, 200)}` : friendly(res.status),
        res.status,
      );
    }
    return body as T;
  }

  /** Teste barato: operação inexistente responde 404 com chave válida e 401 com inválida. */
  async testKey(): Promise<void> {
    try {
      await this.call("/api/v2/operation/1/status");
    } catch (e) {
      if (e instanceof ForsignApiError && (e.status === 404 || e.status === 400)) return;
      throw e;
    }
  }

  async uploadPdf(bytes: Uint8Array, fileName: string): Promise<string> {
    const form = new FormData();
    form.append("file", new Blob([bytes as BlobPart], { type: "application/pdf" }), fileName);
    const r = await this.call<{ data?: { id?: string } }>("/api/v2/document/upload", {
      method: "POST",
      body: form,
    });
    if (!r?.data?.id) throw new ForsignApiError("O ForSign não devolveu o documento enviado.", 502);
    return r.data.id;
  }

  async createOperation(payload: Record<string, unknown>) {
    const r = await this.call<any>("/api/v1/operation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const op = r?.data?.data ?? r?.data;
    if (!op?.id) throw new ForsignApiError("O ForSign não devolveu o número da operação.", 502);
    return {
      id: Number(op.id),
      files: (op.files ?? []).map((f: any) => ({ id: Number(f.id), name: String(f.name ?? "") })),
    };
  }

  async status(operationId: number) {
    const r = await this.call<any>(`/api/v2/operation/${operationId}/status`);
    const op = r?.data?.operation ?? {};
    return {
      status: String(op.status ?? ""),
      completedAt: (op.completedAt as string | null) ?? null,
      progressCurrent: Number(op.progressCurrent ?? 0),
      progressTotal: Number(op.progressTotal ?? 0),
      members: ((r?.data?.members ?? []) as any[]).map((m) => ({
        name: String(m.name ?? ""),
        email: String(m.email ?? "").toLowerCase(),
        role: (m.role as string | null) ?? null,
        status: String(m.status ?? ""),
        stage: (m.stage as string | null) ?? null,
        completedAt: (m.completedAt as string | null) ?? null,
      })),
    };
  }

  async downloadDocument(operationId: number, documentId: number): Promise<Uint8Array> {
    const r = await this.call<any>(
      `/api/v2/operations/${operationId}/documents/${documentId}/download-base64`,
    );
    const b64 = r?.data?.base64Content;
    if (typeof b64 !== "string" || !b64)
      throw new ForsignApiError("PDF assinado indisponível.", 502);
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  async cancel(operationId: number, message: string) {
    await this.call(`/api/v2/operation/${operationId}/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });
  }
}

// ---- Automação ----
// Evento de automação "Contrato assinado no ForSign": atualização do contrato com
// `forsign_status` mudando para "signed" (os fluxos de cada workspace decidem o que fazer).
async function emitWorkflowEvent(
  op: { workspace_id: string; contract_id: string; created_by: string; operation_id: number },
  evidenceId: string,
) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const db = supabaseAdmin as any;
  const { data: c } = await db
    .from("contracts")
    .select("*")
    .eq("id", op.contract_id)
    .eq("workspace_id", op.workspace_id)
    .single();
  if (!c) return;
  await db.from("workflow_events").insert({
    workspace_id: op.workspace_id,
    owner_id: op.created_by,
    entity: "contracts",
    entity_id: op.contract_id,
    event_type: "updated",
    before: { ...c, forsign_status: null },
    after: {
      ...c,
      forsign_status: "signed",
      forsign_operation_id: op.operation_id,
      forsign_evidence_id: evidenceId,
    },
  });
}
