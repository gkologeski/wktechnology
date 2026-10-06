// Entrada do SDR: vínculo envio de campanha → conversa e enfileiramento
// idempotente das respostas. Chamado pelo tick de campanha e pelo webhook.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin = any;

import { detectOptOut, nextFollowUpAt, turnIdemKey } from "./policy";

export async function recordSdrAction(
  admin: Admin,
  row: {
    workspace_id: string;
    enrollment_id?: string | null;
    job_id?: string | null;
    kind: string;
    status: string;
    provider_ref?: string | null;
    payload?: Record<string, unknown>;
    error?: string | null;
    created_by?: string | null;
  },
): Promise<void> {
  const { error } = await admin.from("sdr_actions").insert({ payload: {}, ...row });
  if (error) console.error("[sdr] falha ao registrar ação", error.message);
}

/** Encerra cadências anteriores do mesmo Lead/Contato com o motivo informado. */
export async function cancelProspectingCadences(
  admin: Admin,
  workspaceId: string,
  target: { leadId?: string | null; contactId?: string | null },
  reason: "replied" | "stopped",
): Promise<number> {
  let total = 0;
  for (const [entity, id] of [
    ["lead", target.leadId],
    ["contact", target.contactId],
  ] as const) {
    if (!id) continue;
    const { data, error } = await admin
      .from("prospecting_enrollments")
      .update({ status: reason, finished_at: new Date().toISOString() })
      .eq("workspace_id", workspaceId)
      .eq("entity", entity)
      .eq("entity_id", id)
      .in("status", ["active", "paused"])
      .select("id");
    if (error) throw new Error(`Falha ao encerrar cadência: ${error.message}`);
    total += data?.length ?? 0;
  }
  return total;
}

/**
 * Após o envio do template de uma campanha com SDR ligado: cria/reaproveita o
 * enrollment (um por campanha+telefone) e liga conversa ↔ campanha ↔ template.
 */
export async function linkCampaignSend(
  admin: Admin,
  p: {
    workspaceId: string;
    ownerId: string;
    campaign: {
      id: string;
      sdr_enabled: boolean;
      sdr_playbook_id: string | null;
      template_name: string | null;
    };
    conversationId: string;
    phone: string;
    wamid: string | null;
    contactId: string | null;
  },
): Promise<string | null> {
  if (!p.campaign.sdr_enabled || !p.campaign.sdr_playbook_id) return null;
  const { data: playbook } = await admin
    .from("sdr_playbooks")
    .select("id, follow_up_hours, max_follow_ups, workspace_id")
    .eq("id", p.campaign.sdr_playbook_id)
    .maybeSingle();
  if (!playbook || playbook.workspace_id !== p.workspaceId) return null;

  const find = () =>
    admin
      .from("sdr_enrollments")
      .select("id")
      .eq("workspace_id", p.workspaceId)
      .eq("campaign_id", p.campaign.id)
      .eq("contact_phone", p.phone)
      .maybeSingle();
  let { data: enr } = await find();
  if (!enr) {
    const followUp = nextFollowUpAt({
      now: new Date(),
      hours: playbook.follow_up_hours,
      count: 0,
      max: playbook.max_follow_ups,
      stage: "awaiting_reply",
    });
    const { data: created, error } = await admin
      .from("sdr_enrollments")
      .insert({
        owner_id: p.ownerId,
        workspace_id: p.workspaceId,
        playbook_id: playbook.id,
        campaign_id: p.campaign.id,
        contact_phone: p.phone,
        contact_id: p.contactId,
        conversation_id: p.conversationId,
        status: "active",
        commercial_stage: "awaiting_reply",
        follow_up_at: followUp?.toISOString() ?? null,
      })
      .select("id")
      .single();
    if (error?.code === "23505") ({ data: enr } = await find());
    else if (error) throw new Error(error.message);
    else enr = created;
  }
  if (!enr) return null;

  const { data: conv } = await admin
    .from("whatsapp_conversations")
    .select("ai_owner")
    .eq("id", p.conversationId)
    .maybeSingle();
  await admin
    .from("whatsapp_conversations")
    .update({
      sdr_enrollment_id: enr.id,
      origin_campaign_id: p.campaign.id,
      origin_template_name: p.campaign.template_name,
      origin_wa_message_id: p.wamid,
      // Humano que já assumiu não é sobrescrito.
      ...(conv?.ai_owner ? {} : { ai_owner: "ai" }),
    })
    .eq("id", p.conversationId)
    .eq("workspace_id", p.workspaceId);
  await recordSdrAction(admin, {
    workspace_id: p.workspaceId,
    enrollment_id: enr.id,
    kind: "template_sent",
    status: "success",
    provider_ref: p.wamid,
    payload: { campaign_id: p.campaign.id, template: p.campaign.template_name },
  });
  return enr.id as string;
}

export type IngestResult =
  | "not_sdr"
  | "disabled"
  | "inactive"
  | "opted_out"
  | "human_owner"
  | "queued"
  | "duplicate";

/**
 * Resposta recebida numa conversa do SDR. Idempotente: a chave inclui
 * workspace, número do provedor e id da mensagem. Contexto ambíguo é ignorado.
 */
export async function ingestInboundForSdr(
  admin: Admin,
  p: {
    workspaceId: string;
    conversationId: string;
    messageId: string;
    waMessageId: string;
    providerPhoneId: string | null;
    body: string;
  },
): Promise<IngestResult> {
  const { data: conv, error: cErr } = await admin
    .from("whatsapp_conversations")
    .select("id, workspace_id, sdr_enrollment_id, ai_owner, ai_version, contact_id, lead_id")
    .eq("id", p.conversationId)
    .maybeSingle();
  if (cErr) throw new Error(cErr.message);
  if (!conv?.sdr_enrollment_id || conv.workspace_id !== p.workspaceId) return "not_sdr";

  const { data: enr, error: eErr } = await admin
    .from("sdr_enrollments")
    .select(
      "id, workspace_id, status, conversation_id, playbook_id, lead_id, contact_id, follow_up_at",
    )
    .eq("id", conv.sdr_enrollment_id)
    .maybeSingle();
  if (eErr) throw new Error(eErr.message);
  // Conservador: vínculo inconsistente não aciona o agente.
  if (!enr || enr.workspace_id !== p.workspaceId || enr.conversation_id !== conv.id)
    return "not_sdr";
  if (enr.status !== "active") return "inactive";

  const { data: settings } = await admin
    .from("sdr_workspace_settings")
    .select("enabled")
    .eq("workspace_id", p.workspaceId)
    .maybeSingle();

  // Resposta do cliente: cancela follow-up e cadências anteriores.
  await admin
    .from("sdr_enrollments")
    .update({
      last_inbound_at: new Date().toISOString(),
      follow_up_at: null,
      contact_id: enr.contact_id ?? conv.contact_id,
      lead_id: enr.lead_id ?? conv.lead_id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", enr.id);
  const cancelled = await cancelProspectingCadences(
    admin,
    p.workspaceId,
    { leadId: enr.lead_id ?? conv.lead_id, contactId: enr.contact_id ?? conv.contact_id },
    "replied",
  );
  if (cancelled) {
    await recordSdrAction(admin, {
      workspace_id: p.workspaceId,
      enrollment_id: enr.id,
      kind: "cadence_cancelled",
      status: "success",
      payload: { reason: "replied", count: cancelled },
    });
  }

  const { data: playbook } = await admin
    .from("sdr_playbooks")
    .select("opt_out_phrases")
    .eq("id", enr.playbook_id)
    .maybeSingle();
  if (detectOptOut(p.body, (playbook?.opt_out_phrases as string[] | null) ?? [])) {
    await admin
      .from("sdr_enrollments")
      .update({
        status: "opted_out",
        commercial_stage: "opted_out",
        opted_out_at: new Date().toISOString(),
        cancel_reason: "opt_out",
        follow_up_at: null,
      })
      .eq("id", enr.id);
    await admin.rpc("sdr_set_conversation_owner", {
      p_conversation: conv.id,
      p_owner: "paused",
    });
    await recordSdrAction(admin, {
      workspace_id: p.workspaceId,
      enrollment_id: enr.id,
      kind: "opt_out",
      status: "success",
      provider_ref: p.waMessageId,
    });
    return "opted_out";
  }

  if (!settings?.enabled) return "disabled";
  if (conv.ai_owner !== "ai") return "human_owner";

  const idem = turnIdemKey({
    workspaceId: p.workspaceId,
    providerPhoneId: p.providerPhoneId,
    waMessageId: p.waMessageId,
  });
  const { data: inserted, error: jErr } = await admin
    .from("sdr_turn_jobs")
    .upsert(
      {
        workspace_id: p.workspaceId,
        enrollment_id: enr.id,
        conversation_id: conv.id,
        kind: "reply",
        idem_key: idem,
        inbound_message_id: p.messageId,
        conversation_version: conv.ai_version,
      },
      { onConflict: "workspace_id,idem_key", ignoreDuplicates: true },
    )
    .select("id");
  if (jErr) throw new Error(jErr.message);
  return inserted?.length ? "queued" : "duplicate";
}
