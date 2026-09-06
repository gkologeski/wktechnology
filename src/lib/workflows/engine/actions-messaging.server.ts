// Ações de mensagem e integrações: notificação, e-mail, WhatsApp, Slack, Teams,
// webhook e inclusão em cadência. Extraído sem mudança de comportamento.
import type { SupabaseClient } from "@supabase/supabase-js";
import { toStr } from "../render-tokens";
import { type LogStep, notificationLinkFor, renderTokens } from "../engine-shared.server";
import type { RunCtx, RunnableAction } from "./run-context";

export async function handleMessagingAction(
  supabase: SupabaseClient,
  action: RunnableAction,
  ctx: RunCtx,
  at: string,
): Promise<LogStep | null> {
  switch (action.type) {
    case "add_to_sequence": {
      const { error } = await supabase.from("sequence_enrollments").insert({
        owner_id: ctx.ownerId,
        sequence_id: action.sequence_id,
        entity_id: ctx.entityId,
        status: "active",
        next_run_at: new Date().toISOString(),
      });
      if (error) throw new Error(error.message);
      return {
        at,
        ok: true,
        action: "add_to_sequence",
        detail: { sequence_id: action.sequence_id },
      };
    }
    case "send_notification": {
      const title = renderTokens(action.title, ctx.after) as string;
      const body = action.body ? (renderTokens(action.body, ctx.after) as string) : null;
      const targetUserId = action.user_id?.trim() ? action.user_id : ctx.ownerId;
      const link = notificationLinkFor(ctx.entity, ctx.entityId);
      const { error } = await supabase.from("notifications").insert({
        owner_id: ctx.ownerId,
        user_id: targetUserId,
        type: "workflow",
        title,
        body,
        link,
        entity: ctx.entity,
        entity_id: ctx.entityId,
      } as never);
      if (error) throw new Error(error.message);
      return {
        at,
        ok: true,
        action: "send_notification",
        detail: { title, user_id: targetUserId },
      };
    }
    case "webhook": {
      const payload = action.payload
        ? JSON.parse(toStr(renderTokens(JSON.stringify(action.payload), ctx.after)))
        : { entity: ctx.entity, entity_id: ctx.entityId, after: ctx.after };
      const res = await fetch(action.url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`Webhook respondeu ${res.status}`);
      return { at, ok: true, action: "webhook", detail: { url: action.url, status: res.status } };
    }
    case "send_email": {
      const toField = action.to_field || "email";
      const to = (ctx.after?.[toField] as string | null) ?? null;
      if (!to) throw new Error(`sem destinatário em ${toField}`);
      let subject = action.subject;
      let body = action.body;
      if (action.template_id) {
        const { data: tpl } = await supabase
          .from("email_templates")
          .select("subject, body_html, body_text")
          .eq("id", action.template_id)
          .maybeSingle();
        if (tpl) {
          subject = (tpl.subject as string) || subject;
          body = (tpl.body_html as string) || (tpl.body_text as string) || body;
        }
      }
      subject = renderTokens(subject, ctx.after) as string;
      body = renderTokens(body, ctx.after) as string;
      const { error } = await supabase.from("email_messages").insert({
        owner_id: ctx.ownerId,
        direction: "outbound",
        to_emails: [to],
        subject,
        body_html: body,
        body_text: body.replace(/<[^>]+>/g, ""),
      } as never);
      if (error) throw new Error(error.message);
      return { at, ok: true, action: "send_email", detail: { to, subject, queued: true } };
    }
    case "send_whatsapp": {
      const toField = action.to_field || "phone";
      const to = (ctx.after?.[toField] as string | null) ?? null;
      if (!to) throw new Error(`sem destinatário em ${toField}`);
      const body = action.body ? (renderTokens(action.body, ctx.after) as string) : null;
      const { error } = await supabase.from("whatsapp_messages").insert({
        owner_id: ctx.ownerId,
        direction: "outbound",
        to_number: to,
        body,
        template_name: action.template_name ?? null,
        is_template: !!action.template_name,
        status: "queued",
      } as never);
      if (error) throw new Error(error.message);
      return {
        at,
        ok: true,
        action: "send_whatsapp",
        detail: { to, template: action.template_name ?? null, queued: true },
      };
    }
    case "send_slack": {
      const { data: integ } = await supabase
        .from("slack_integrations")
        .select("access_token, default_channel_id")
        .eq("owner_id", ctx.ownerId)
        .maybeSingle();
      if (!integ) throw new Error("Slack não conectado neste workspace");
      const channel = action.channel?.trim() || (integ.default_channel_id as string | null);
      if (!channel) throw new Error("Canal do Slack não informado e sem canal padrão");
      const text = renderTokens(action.text, ctx.after, ctx.vars) as string;
      const res = await fetch("https://slack.com/api/chat.postMessage", {
        method: "POST",
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          Authorization: `Bearer ${integ.access_token}`,
        },
        body: JSON.stringify({ channel, text }),
      });
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) throw new Error(`Slack: ${json.error ?? res.status}`);
      return { at, ok: true, action: "send_slack", detail: { channel } };
    }
    case "send_teams": {
      const text = renderTokens(action.text, ctx.after, ctx.vars) as string;
      const title = action.title
        ? (renderTokens(action.title, ctx.after, ctx.vars) as string)
        : undefined;
      // Microsoft Teams Incoming Webhook aceita MessageCard simples.
      const body = title ? { title, text } : { text };
      const res = await fetch(action.webhook_url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`Teams respondeu ${res.status}`);
      return { at, ok: true, action: "send_teams", detail: { title } };
    }
    default:
      return null;
  }
}
