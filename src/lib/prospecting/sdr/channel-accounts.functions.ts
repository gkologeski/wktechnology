import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireChannelAccess } from "./channel-access.server";
import { workRpc } from "@/lib/access-control/work-core.server";

export const listServiceChannels = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const access = await requireChannelAccess(context.supabase, context.userId, "view");
    const db = context.supabase as any;
    const [accounts, bindings, agents] = await Promise.all([
      db
        .from("service_channel_accounts")
        .select("id,channel,source_key,label,display_name,enabled")
        .eq("workspace_id", access.workspace)
        .order("label"),
      db
        .from("service_channel_bindings")
        .select("account_id,agent_id,display_name,inbound,campaigns,enabled")
        .eq("workspace_id", access.workspace),
      db
        .from("sdr_playbooks")
        .select("id,name,enabled")
        .eq("workspace_id", access.workspace)
        .order("name"),
    ]);
    for (const result of [accounts, bindings, agents])
      if (result.error) throw new Error("Não foi possível carregar os canais de atendimento.");
    return {
      accounts: accounts.data as ServiceAccount[],
      bindings: bindings.data as ServiceBinding[],
      agents: agents.data as { id: string; name: string; enabled: boolean }[],
    };
  });

export type ServiceAccount = {
  id: string;
  channel: "whatsapp" | "email" | "chat";
  source_key: string;
  label: string;
  display_name: string;
  enabled: boolean;
};
export type ServiceBinding = {
  account_id: string;
  agent_id: string;
  display_name: string;
  inbound: boolean;
  campaigns: boolean;
  enabled: boolean;
};

export const saveServiceChannel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        accountId: z.string().uuid(),
        label: z.string().trim().min(1).max(120),
        displayName: z.string().trim().max(60),
        enabled: z.boolean(),
        agentId: z.string().uuid().nullable(),
        agentDisplayName: z.string().trim().max(60),
        inbound: z.boolean(),
        campaigns: z.boolean(),
        agentEnabled: z.boolean(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    await requireChannelAccess(context.supabase, context.userId, "manage");
    await workRpc(context.supabase, "service_channel_save", {
      p_account: data.accountId,
      p_label: data.label,
      p_name: data.displayName,
      p_enabled: data.enabled,
      p_agent: data.agentId,
      p_agent_name: data.agentDisplayName,
      p_inbound: data.inbound,
      p_campaigns: data.campaigns,
      p_agent_enabled: data.agentEnabled,
    });
    return { ok: true };
  });

/** Discover only provider accounts visible to this user. Metadata is registered, never credentials. */
export const discoverServiceChannels = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const access = await requireChannelAccess(context.supabase, context.userId, "manage");
    const rows: { workspace_id: string; channel: string; source_key: string; label: string }[] = [];
    const db = context.supabase as any;
    const email = await db
      .from("email_accounts")
      .select("id,email")
      .eq("workspace_id", access.workspace);
    if (email.error) throw new Error("Não foi possível consultar as contas de e-mail.");
    for (const row of email.data ?? [])
      rows.push({
        workspace_id: access.workspace,
        channel: "email",
        source_key: row.id,
        label: row.email,
      });
    if (access.keys["system.whatsapp.view.workspace"]) {
      const cloud = await db
        .from("wa_cloud_numbers")
        .select("phone_number_id,display_phone_number")
        .eq("workspace_id", access.workspace);
      if (cloud.error) throw new Error("Não foi possível consultar os números WhatsApp.");
      for (const row of cloud.data ?? [])
        rows.push({
          workspace_id: access.workspace,
          channel: "whatsapp",
          source_key: row.phone_number_id,
          label: row.display_phone_number,
        });
      // Legacy gateway accounts are discovered only from rows already authorized in this workspace.
      const legacy = await db
        .from("whatsapp_conversations")
        .select("wa_phone_number_id,twilio_number")
        .eq("workspace_id", access.workspace)
        .limit(1000);
      if (legacy.error)
        throw new Error("Não foi possível consultar os números de atendimento existentes.");
      for (const row of legacy.data ?? []) {
        if (
          row.wa_phone_number_id &&
          !rows.some((r) => r.channel === "whatsapp" && r.source_key === row.wa_phone_number_id)
        )
          rows.push({
            workspace_id: access.workspace,
            channel: "whatsapp",
            source_key: row.wa_phone_number_id,
            label: row.twilio_number || row.wa_phone_number_id,
          });
      }
    }
    if (access.keys["system.widget.view.workspace"])
      rows.push({
        workspace_id: access.workspace,
        channel: "chat",
        source_key: access.workspace,
        label: "Chat do site",
      });
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (rows.length) {
      const result = await (supabaseAdmin as any)
        .from("service_channel_accounts")
        .upsert(rows, { onConflict: "workspace_id,channel,source_key", ignoreDuplicates: true });
      if (result.error) throw new Error("Não foi possível registrar as contas de atendimento.");
    }
    return { discovered: rows.length };
  });
