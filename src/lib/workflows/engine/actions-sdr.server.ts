// Blocos de prospecção do motor de workflows: ligar/desligar o agente SDR,
// transferir para pessoa e consulta de resposta real (usada por "Aguardar resposta").
// Sempre filtrados pelo workspace do fluxo; nada envia mensagem.
import { buildDeliveryMeta } from "../delivery-meta";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { LogStep } from "../engine-shared.server";
import { renderTokens } from "../engine-shared.server";
import type { RunCtx, RunnableAction } from "./run-context";
import { brPhoneVariants } from "@/lib/whatsapp/phone-variants";

function recordPhone(ctx: RunCtx): string | null {
  const a = ctx.after ?? {};
  const raw = (a["mobile_phone"] ?? a["phone"] ?? a["whatsapp"] ?? null) as string | null;
  if (!raw) return null;
  const d = String(raw).replace(/\D/g, "");
  return d.length >= 10 ? `+${d.startsWith("55") || d.length > 11 ? d : `55${d}`}` : null;
}

function recordEmail(ctx: RunCtx): string | null {
  const e = (ctx.after?.["email"] as string | null) ?? null;
  return e && e.includes("@") ? e.trim().toLowerCase() : null;
}

/** Houve mensagem recebida do registro (WhatsApp/e-mail) depois de `sinceIso`? */
export async function hasReplySince(
  supabase: SupabaseClient,
  ctx: RunCtx,
  channels: ("whatsapp" | "email")[],
  sinceIso: string,
): Promise<{ replied: boolean; channel?: "whatsapp" | "email" }> {
  if (channels.includes("whatsapp")) {
    const phone = recordPhone(ctx);
    if (phone) {
      const { data } = await supabase
        .from("whatsapp_messages")
        .select("id")
        .eq("workspace_id", ctx.workspaceId)
        .eq("direction", "inbound")
        .in("from_number", brPhoneVariants(phone))
        .gt("created_at", sinceIso)
        .limit(1);
      if ((data ?? []).length > 0) return { replied: true, channel: "whatsapp" };
    }
  }
  if (channels.includes("email")) {
    const email = recordEmail(ctx);
    if (email) {
      const { data } = await supabase
        .from("email_messages")
        .select("id")
        .eq("workspace_id", ctx.workspaceId)
        .eq("direction", "inbound")
        .ilike("from_email", email)
        .gt("created_at", sinceIso)
        .limit(1);
      if ((data ?? []).length > 0) return { replied: true, channel: "email" };
    }
  }
  return { replied: false };
}

async function latestConversation(supabase: SupabaseClient, ctx: RunCtx) {
  const phone = recordPhone(ctx);
  if (!phone) return null;
  const { data } = await supabase
    .from("whatsapp_conversations")
    .select("id, contact_phone, last_inbound_at")
    .eq("workspace_id", ctx.workspaceId)
    .in("contact_phone", brPhoneVariants(phone))
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();
  return (data as { id: string; contact_phone: string } | null) ?? null;
}

export async function handleSdrAction(
  supabase: SupabaseClient,
  action: RunnableAction,
  ctx: RunCtx,
  at: string,
): Promise<LogStep | null> {
  switch (action.type) {
    case "sdr_agent": {
      const conv = await latestConversation(supabase, ctx);
      if (!conv) throw new Error("Registro sem conversa de WhatsApp: o agente não foi alterado.");
      if (action.mode === "off") {
        const { data, error } = await supabase
          .from("sdr_enrollments")
          .update({
            status: "inactive",
            cancel_reason: "workflow",
            follow_up_at: null,
            updated_at: at,
          } as never)
          .eq("workspace_id", ctx.workspaceId)
          .eq("conversation_id", conv.id)
          .eq("status", "active")
          .select("id");
        if (error) throw new Error(error.message);
        return {
          at,
          ok: true,
          action: "sdr_agent",
          detail: { mode: "off", paused: (data ?? []).length },
          delivery: buildDeliveryMeta(ctx, { channel: "sdr_agent", provider_status: "paused" }),
        };
      }
      if (!action.playbook_id) throw new Error("Escolha o agente.");
      const { data: pb } = await supabase
        .from("sdr_playbooks")
        .select("id, workspace_id, enabled")
        .eq("id", action.playbook_id)
        .maybeSingle();
      if (!pb || pb.workspace_id !== ctx.workspaceId) throw new Error("Agente fora da empresa.");
      if (!pb.enabled) throw new Error("Agente desativado: ligue-o em Agentes antes.");
      const { data: pub } = await supabase
        .from("sdr_agent_versions")
        .select("id")
        .eq("playbook_id", pb.id)
        .eq("status", "published")
        .order("created_at", { ascending: false })
        .limit(1);
      if ((pub ?? []).length === 0) throw new Error("Agente sem versão publicada.");
      const agentMeta = {
        channel: "sdr_agent" as const,
        agent_id: pb.id as string,
        agent_version_id: (pub![0] as { id: string }).id,
      };
      const { data: wsCfg } = await supabase
        .from("sdr_workspace_settings")
        .select("enabled, pilot_allowlist")
        .eq("workspace_id", ctx.workspaceId)
        .maybeSingle();
      if (!wsCfg?.enabled) throw new Error("Agente SDR desligado nesta empresa.");
      const { isPhoneAllowlisted } = await import("@/lib/prospecting/sdr/allowlist");
      if (!isPhoneAllowlisted(conv.contact_phone, wsCfg.pilot_allowlist))
        throw new Error("Telefone fora da lista do piloto: o agente não foi ligado.");
      // Idempotente: uma inscrição ativa por conversa.
      const { data: existing } = await supabase
        .from("sdr_enrollments")
        .select("id, playbook_id, opted_out_at")
        .eq("workspace_id", ctx.workspaceId)
        .eq("conversation_id", conv.id)
        .eq("status", "active")
        .limit(1);
      const cur = (existing ?? [])[0] as
        | { id: string; playbook_id: string; opted_out_at: string | null }
        | undefined;
      if (cur?.opted_out_at) throw new Error("Contato pediu para não receber mensagens.");
      if (cur && cur.playbook_id === pb.id)
        return {
          at,
          ok: true,
          action: "sdr_agent",
          detail: { mode: "on", skipped: "already_on" },
          delivery: buildDeliveryMeta(ctx, { ...agentMeta, provider_status: "already_on" }),
        };
      if (cur) throw new Error("Outro agente já atende esta conversa; desligue-o antes de trocar.");
      const { data: created, error } = await supabase
        .from("sdr_enrollments")
        .insert({
          owner_id: ctx.ownerId,
          workspace_id: ctx.workspaceId,
          playbook_id: pb.id,
          conversation_id: conv.id,
          contact_phone: conv.contact_phone,
          contact_id: ctx.entity === "contacts" ? ctx.entityId : null,
          lead_id: ctx.entity === "leads" ? ctx.entityId : null,
          deal_id: ctx.entity === "deals" ? ctx.entityId : null,
          status: "active",
          commercial_stage: "awaiting_reply",
        } as never)
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      return {
        at,
        ok: true,
        action: "sdr_agent",
        detail: { mode: "on", enrollment_id: (created as { id: string }).id },
        delivery: buildDeliveryMeta(ctx, { ...agentMeta, provider_status: "enrolled" }),
      };
    }
    case "handoff": {
      const reason = renderTokens(action.reason, ctx.after, ctx.vars) as string;
      const target = action.user_id?.trim() || null;
      const conv = await latestConversation(supabase, ctx);
      let paused = 0;
      if (conv) {
        const { data } = await supabase
          .from("sdr_enrollments")
          .update({
            status: "handoff",
            handoff_at: at,
            handoff_reason: reason,
            follow_up_at: null,
            updated_at: at,
          } as never)
          .eq("workspace_id", ctx.workspaceId)
          .eq("conversation_id", conv.id)
          .eq("status", "active")
          .select("id");
        paused = (data ?? []).length;
      }
      const assignable = ["leads", "contacts", "companies", "deals"];
      if (target && assignable.includes(ctx.entity)) {
        const { error } = await supabase
          .from(ctx.entity)
          .update({ assigned_to: target } as never)
          .eq("id", ctx.entityId)
          .eq("workspace_id", ctx.workspaceId);
        if (error) throw new Error(error.message);
      }
      const notify = target ?? (ctx.after?.["assigned_to"] as string | null) ?? ctx.ownerId;
      await supabase.from("notifications").insert({
        owner_id: ctx.ownerId,
        user_id: notify,
        type: "workflow",
        title: "Conversa transferida para você",
        body: reason,
        entity: ctx.entity,
        entity_id: ctx.entityId,
      } as never);
      return {
        at,
        ok: true,
        action: "handoff",
        detail: { user_id: notify, agent_paused: paused, reason },
        delivery: buildDeliveryMeta(ctx, { channel: "handoff", provider_status: "transferred" }),
      };
    }
    case "share_booking_link": {
      const { data: page } = await supabase
        .from("booking_pages")
        .select("id, slug, title, active, workspace_id")
        .eq("id", action.booking_page_id)
        .maybeSingle();
      if (!page || page.workspace_id !== ctx.workspaceId)
        throw new Error("Página de agendamento fora da empresa ou removida.");
      if (!page.active) throw new Error("Página de agendamento desativada.");
      const { getPublicAppUrl } = await import("@/lib/app-url");
      const url = `${getPublicAppUrl().replace(/\/$/, "")}/book/${page.slug as string}`;
      const vars = (ctx.vars = ctx.vars ?? {});
      vars["booking_url"] = url;
      vars["booking_title"] = page.title;
      return {
        at,
        ok: true,
        action: "share_booking_link",
        detail: { booking_page_id: page.id, booking_url: url, title: page.title },
      };
    }
    case "share_material": {
      const { data: m } = await supabase
        .from("sdr_materials")
        .select("id, title, url, approved, active, workspace_id")
        .eq("id", action.material_id)
        .maybeSingle();
      if (!m || m.workspace_id !== ctx.workspaceId)
        throw new Error("Material fora da empresa ou removido.");
      if (!m.approved || !m.active || !m.url)
        throw new Error("Material precisa estar aprovado, ativo e com link.");
      const vars = (ctx.vars = ctx.vars ?? {});
      vars["material_url"] = m.url;
      vars["material_title"] = m.title;
      return {
        at,
        ok: true,
        action: "share_material",
        detail: { material_id: m.id, material_url: m.url, title: m.title },
      };
    }
    default:
      return null;
  }
}
