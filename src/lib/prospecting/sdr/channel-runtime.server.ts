import {
  ChannelIdentitySchema,
  type ChannelIdentity,
  type ServiceChannel,
} from "./channel-identity";

export type ChannelRuntime =
  | { status: "legacy" }
  | { status: "blocked"; reason: string }
  | { status: "active"; identity: ChannelIdentity };

/** Called only inside an already authorized worker, and again before every effect. No credentials. */
export async function loadChannelRuntime(
  admin: any,
  input: {
    workspaceId: string;
    channel: ServiceChannel;
    sourceKey: string | null | undefined;
    agentId: string;
    origin: "inbound" | "campaign";
    snapshot?: unknown;
    assistantName?: string;
  },
): Promise<ChannelRuntime> {
  if (!input.sourceKey)
    return input.snapshot != null
      ? { status: "blocked", reason: "channel_account_unavailable" }
      : { status: "legacy" };
  const account = await admin
    .from("service_channel_accounts")
    .select("id,workspace_id,channel,label,display_name,enabled,routing_configured")
    .eq("workspace_id", input.workspaceId)
    .eq("channel", input.channel)
    .eq("source_key", input.sourceKey)
    .maybeSingle();
  if (account.error) throw new Error("Não foi possível verificar a conta de atendimento.");
  if (!account.data?.routing_configured)
    return input.snapshot != null
      ? { status: "blocked", reason: "channel_account_unavailable" }
      : { status: "legacy" };
  if (!account.data.enabled) return { status: "blocked", reason: "channel_disabled" };
  const binding = await admin
    .from("service_channel_bindings")
    .select("agent_id,display_name,enabled,inbound,campaigns")
    .eq("workspace_id", input.workspaceId)
    .eq("account_id", account.data.id)
    .maybeSingle();
  if (binding.error) throw new Error("Não foi possível verificar o agente da conta.");
  const b = binding.data;
  if (
    !b?.enabled ||
    b.agent_id !== input.agentId ||
    !(input.origin === "campaign" ? b.campaigns : b.inbound)
  )
    return { status: "blocked", reason: "channel_agent_unavailable" };
  const agent = await admin
    .from("sdr_playbooks")
    .select("id,name,enabled")
    .eq("workspace_id", input.workspaceId)
    .eq("id", input.agentId)
    .maybeSingle();
  if (agent.error) throw new Error("Não foi possível verificar o agente de atendimento.");
  if (!agent.data?.enabled) return { status: "blocked", reason: "channel_agent_disabled" };
  if (input.snapshot != null) {
    const saved = ChannelIdentitySchema.safeParse(input.snapshot);
    if (
      !saved.success ||
      saved.data.workspaceId !== input.workspaceId ||
      saved.data.accountId !== account.data.id ||
      saved.data.channel !== input.channel
    )
      return { status: "blocked", reason: "channel_identity_mismatch" };
    return { status: "active", identity: saved.data };
  }
  const workspace = await admin
    .from("workspaces")
    .select("name")
    .eq("id", input.workspaceId)
    .maybeSingle();
  if (workspace.error) throw new Error("Não foi possível verificar a empresa do canal.");
  const identity = ChannelIdentitySchema.safeParse({
    workspaceId: input.workspaceId,
    accountId: account.data.id,
    channel: input.channel,
    accountName: account.data.label,
    displayName:
      b.display_name || account.data.display_name || input.assistantName || agent.data.name,
    agentName: agent.data.name,
    companyName: workspace.data?.name,
  });
  if (!identity.success) return { status: "blocked", reason: "channel_identity_incomplete" };
  return { status: "active", identity: identity.data };
}

export async function assertChannelRuntime(
  admin: any,
  input: Parameters<typeof loadChannelRuntime>[1],
) {
  const state = await loadChannelRuntime(admin, input);
  if (state.status === "blocked") throw new Error(state.reason);
  return state;
}

/** Read-only sandbox preview; caller must require channel view and agent access first. */
export async function loadPreviewChannelIdentity(
  client: any,
  input: {
    workspaceId: string;
    accountId: string;
    agentId: string;
    agentName: string;
    assistantName: string;
    companyName: string;
  },
): Promise<ChannelIdentity> {
  const [account, binding] = await Promise.all([
    client
      .from("service_channel_accounts")
      .select("id,channel,label,display_name")
      .eq("workspace_id", input.workspaceId)
      .eq("id", input.accountId)
      .maybeSingle(),
    client
      .from("service_channel_bindings")
      .select("display_name")
      .eq("workspace_id", input.workspaceId)
      .eq("account_id", input.accountId)
      .eq("agent_id", input.agentId)
      .maybeSingle(),
  ]);
  if (account.error || binding.error || !account.data || !binding.data)
    throw new Error("Vincule esta conta ao agente antes de testar sua identidade.");
  return ChannelIdentitySchema.parse({
    workspaceId: input.workspaceId,
    accountId: account.data.id,
    channel: account.data.channel,
    accountName: account.data.label,
    displayName:
      binding.data.display_name ||
      account.data.display_name ||
      input.assistantName ||
      input.agentName,
    agentName: input.agentName,
    companyName: input.companyName,
  });
}
