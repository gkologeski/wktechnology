// Acesso do cliente por link seguro. Token → hash → linha; escopo = 1 perfil.
// Serialização SÓ por allowlist (toClientView); comercial interno nunca é lido aqui.
import type { Json } from "@/integrations/supabase/types";
import { sha256, sniff } from "@/lib/import/document-source";
import {
  applyClientProposal,
  parseData,
  sanitizeAllowedFields,
  toClientView,
  type ProfileLike,
} from "./schema";
import { BUCKET } from "./service.server";

const REASON_MSG: Record<string, string> = {
  not_found: "Link inválido.",
  revoked: "Este link foi revogado.",
  expired: "Este link expirou.",
  read_limit: "Limite de acessos deste link atingido.",
  write_limit: "Limite de envios deste link atingido.",
};

export class LinkError extends Error {
  status: number;
  constructor(msg: string, status = 403) {
    super(msg);
    this.status = status;
  }
}

async function consume(token: string, write: boolean) {
  if (!/^[A-Za-z0-9_-]{40,64}$/.test(token)) throw new LinkError(REASON_MSG.not_found, 404);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.rpc("role_profile_link_consume", {
    _hash: await sha256(token),
    _write: write,
  });
  if (error) throw new LinkError("Falha ao validar o link.", 500);
  const row = (data ?? [])[0];
  if (!row || row.reason || !row.profile_id)
    throw new LinkError(
      REASON_MSG[row?.reason ?? "not_found"] ?? REASON_MSG.not_found,
      row?.reason === "not_found" ? 404 : 410,
    );
  return { admin: supabaseAdmin, link: row };
}

export async function publicView(token: string) {
  const { admin, link } = await consume(token, false);
  const { data: p } = await admin
    .from("deal_role_profiles")
    .select("title, quantity, modality, priority, seniority, data, status, archived_at")
    .eq("id", link.profile_id!)
    .eq("workspace_id", link.workspace_id!)
    .maybeSingle();
  if (!p || p.archived_at) throw new LinkError(REASON_MSG.not_found, 404);
  const { data: ws } = await admin
    .from("workspaces")
    .select("name")
    .eq("id", link.workspace_id!)
    .maybeSingle();
  const like: ProfileLike = {
    title: p.title,
    quantity: p.quantity,
    modality: p.modality as ProfileLike["modality"],
    priority: p.priority as ProfileLike["priority"],
    seniority: (p.seniority as ProfileLike["seniority"]) ?? null,
    data: parseData(p.data),
  };
  return {
    workspaceName: ws?.name ?? null,
    expiresAt: link.expires_at,
    view: toClientView(like, sanitizeAllowedFields(link.allowed_fields)),
  };
}

export async function publicSubmit(
  token: string,
  body: { changes: unknown; confirm: boolean; attachment?: { filename: string; base64: string } },
) {
  const { admin, link } = await consume(token, true);
  const { data: p } = await admin
    .from("deal_role_profiles")
    .select("id, data, revision, archived_at, assigned_to, deal_id, title")
    .eq("id", link.profile_id!)
    .maybeSingle();
  if (!p || p.archived_at) throw new LinkError(REASON_MSG.not_found, 404);
  const allowed = sanitizeAllowedFields(link.allowed_fields);
  const r = applyClientProposal(parseData(p.data), body.changes ?? {}, allowed);
  if (!r.ok) throw new LinkError(r.error, 400);
  const payload = Object.fromEntries(
    Object.entries((body.changes ?? {}) as Record<string, unknown>).filter(([k]) =>
      allowed.includes(k as never),
    ),
  );
  // Proposta do cliente NUNCA sobrescreve o perfil: fica pendente de revisão interna.
  const { data: prop, error } = await admin
    .from("deal_role_profile_client_proposals")
    .insert({
      profile_id: p.id,
      workspace_id: link.workspace_id!,
      link_id: link.link_id!,
      base_revision: p.revision,
      payload: payload as Json,
      confirmed: !!body.confirm,
    })
    .select("id")
    .single();
  if (error) throw new LinkError("Não foi possível registrar sua resposta.", 500);
  if (body.attachment) {
    const bin = Uint8Array.from(atob(body.attachment.base64), (c) => c.charCodeAt(0));
    const kind = sniff(bin);
    if (!kind || bin.byteLength > 10 * 1024 * 1024)
      throw new LinkError("Anexo inválido (PDF, DOCX, PNG, JPG ou WebP até 10 MB).", 400);
    const path = `${link.workspace_id}/${p.id}/${crypto.randomUUID()}`;
    const { error: upErr } = await admin.storage
      .from(BUCKET)
      .upload(path, bin, { contentType: kind.mime });
    if (!upErr)
      await admin.from("deal_role_profile_attachments").insert({
        profile_id: p.id,
        workspace_id: link.workspace_id!,
        storage_path: path,
        filename: body.attachment.filename.replace(/[^\w.\- ]+/g, "_").slice(0, 120),
        mime: kind.mime,
        size_bytes: bin.byteLength,
        uploaded_by_kind: "client",
      });
  }
  await admin.from("deal_role_profile_events").insert({
    profile_id: p.id,
    workspace_id: link.workspace_id!,
    kind: body.confirm ? "client_confirmed" : "client_proposal",
    actor_kind: "client",
    details: { proposal_id: prop.id, fields: r.changed } as Json,
  });
  if (p.assigned_to)
    await admin.from("notifications").insert({
      owner_id: p.assigned_to,
      user_id: p.assigned_to,
      workspace_id: link.workspace_id!,
      type: "role_profile",
      title: body.confirm
        ? "Cliente validou o perfil de vaga"
        : "Cliente sugeriu alterações no perfil de vaga",
      body: `${p.title}: revise a proposta antes de aplicar.`,
      link: `/deals/${p.deal_id}?profile=${p.id}`,
      entity: "deal",
      entity_id: p.deal_id,
    } as never);
  return { ok: true };
}
