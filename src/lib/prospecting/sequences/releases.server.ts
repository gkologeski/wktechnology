import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { assertSalesArea } from "@/lib/access-control/sales-core.server";
import { workRpc } from "@/lib/access-control/work-core.server";
import { requireChannelAccess } from "@/lib/prospecting/sdr/channel-access.server";
import { definitionSchema, SEQUENCE_RESOURCE, type SequenceDraft } from "./draft";
import { inspectSequence, inspectSequenceTemplate, type SequenceIssue } from "./preflight";
export const releaseInput = z
  .object({
    workspaceId: z.string().uuid(),
    id: z.string().uuid(),
    expectedRevision: z.number().int().min(1),
  })
  .strict();
export type ReleaseInput = z.infer<typeof releaseInput>;
type Account = {
  id: string;
  workspace_id: string;
  channel: string;
  source_key: string;
  enabled: boolean;
};
export type SequenceRelease = {
  id: string;
  draft_id: string;
  draft_revision: number;
  name: string;
  created_at: string;
};
async function authorize(client: SupabaseClient, input: ReleaseInput, action: "view" | "manage") {
  releaseInput.parse(input);
  await assertSalesArea(client, SEQUENCE_RESOURCE, action);
  const ctx = await workRpc<{ workspace: string; actor: string }>(
    client,
    "sales_access_context",
    {},
  );
  if (!ctx.actor || ctx.workspace !== input.workspaceId) throw new Error("Workspace indisponível.");
  const { data, error } = await client
    .from("prospecting_sequence_drafts" as never)
    .select("id,workspace_id,owner_id,name,revision,definition")
    .eq("id", input.id)
    .eq("workspace_id", ctx.workspace)
    .maybeSingle();
  if (error || !data) throw new Error("Rascunho indisponível.");
  const draft = data as unknown as SequenceDraft;
  if (draft.revision !== input.expectedRevision)
    throw new Error("Rascunho alterado. Recarregue antes de validar ou criar uma versão.");
  return {
    draft: { ...draft, definition: definitionSchema.parse(draft.definition) },
    actor: ctx.actor,
  };
}
async function channel(
  client: SupabaseClient,
  actor: string,
  workspace: string,
  accountId: string,
  kind: "email" | "whatsapp",
): Promise<Account> {
  const access = await requireChannelAccess(client, actor, "view");
  if (access.workspace !== workspace) throw new Error("Conta indisponível.");
  const { data, error } = await client
    .from("service_channel_accounts" as never)
    .select("id,workspace_id,channel,source_key,enabled")
    .eq("id", accountId)
    .eq("workspace_id", workspace)
    .eq("channel", kind)
    .maybeSingle();
  if (error || !data || !(data as Account).enabled)
    throw new Error("Conta indisponível ou desativada.");
  return data as Account;
}
export async function sequenceTemplates(
  client: SupabaseClient,
  actor: string,
  workspace: string,
  accountId: string,
) {
  await assertSalesArea(client, SEQUENCE_RESOURCE, "view");
  const ctx = await workRpc<{ workspace: string; actor: string }>(
    client,
    "sales_access_context",
    {},
  );
  if (ctx.workspace !== workspace || ctx.actor !== actor)
    throw new Error("Workspace indisponível.");
  await assertSalesArea(client, "techsales.inbox.whatsapp", "view");
  const account = await channel(client, actor, workspace, accountId, "whatsapp");
  if (!/^\d{5,30}$/.test(account.source_key)) throw new Error("Número da conta inválido.");
  const { resolveWaNumber } = await import("@/lib/whatsapp/meta-channel.server");
  const { loadTemplateCatalog } = await import("@/lib/whatsapp/templates.server");
  await resolveWaNumber(workspace, account.source_key);
  const catalog = await loadTemplateCatalog(client, workspace, {
    phoneNumberId: account.source_key,
  });
  if (catalog.source !== "provider")
    throw new Error("Consulte os modelos no provedor antes de continuar.");
  return catalog.items.filter((t) => t.status === "APPROVED");
}
export async function preflightSequence(client: SupabaseClient, input: ReleaseInput) {
  const { draft, actor } = await authorize(client, input, "view");
  const issues: SequenceIssue[] = inspectSequence(draft.definition);
  const add = (stepId: string | null, code: string, message: string) =>
    issues.push({ stepId, code, message });
  const templateCache = new Map<string, ReturnType<typeof sequenceTemplates>>();
  const checkedEmail = new Set<string>(),
    checkedMembers = new Set<string>(),
    checkedAgents = new Set<string>();
  const agents = new Set<string>();
  if (draft.definition.settings.agentId) agents.add(draft.definition.settings.agentId);
  const senders = new Set(
    draft.definition.steps
      .flatMap((s) => (s.type === "email" || s.type === "whatsapp" ? [s.accountId] : []))
      .filter(Boolean),
  );
  if (senders.size > 10) add(null, "account_limit", "Use até dez contas distintas por sequência.");
  else
    for (const step of draft.definition.steps) {
      if (step.type === "email" && step.accountId && !checkedEmail.has(step.accountId)) {
        checkedEmail.add(step.accountId);
        try {
          await assertSalesArea(client, "techsales.email_accounts", "view");
          const account = await channel(client, actor, input.workspaceId, step.accountId, "email");
          const result = await client
            .from("email_accounts")
            .select("id")
            .eq("id", account.source_key)
            .eq("workspace_id", input.workspaceId)
            .eq("owner_id", actor)
            .eq("provider", "gmail")
            .eq("status", "connected")
            .maybeSingle();
          if (result.error || !result.data) throw new Error("Unavailable");
        } catch {
          add(
            step.id,
            "email_account_unavailable",
            "Conta Gmail indisponível, sem acesso ou pertencente a outro remetente.",
          );
        }
      }
      if (step.type === "whatsapp" && step.accountId) {
        try {
          if (!templateCache.has(step.accountId))
            templateCache.set(
              step.accountId,
              sequenceTemplates(client, actor, input.workspaceId, step.accountId),
            );
          const templates = await templateCache.get(step.accountId)!;
          const template = templates.find(
            (t) => t.name === step.templateName && t.language === step.language,
          );
          if (!template)
            add(
              step.id,
              "template_unavailable",
              "Modelo não encontrado entre os aprovados desta conta e idioma.",
            );
          else issues.push(...inspectSequenceTemplate(step.id, template, step.variables));
        } catch {
          add(
            step.id,
            "template_catalog_unavailable",
            "Não foi possível verificar os modelos aprovados desta conta. Confira a conexão e suas permissões.",
          );
        }
        if (step.agentId) agents.add(step.agentId);
      }
      if ((step.type === "email" || step.type === "whatsapp") && step.accountId) {
        const agentId =
          (step.type === "whatsapp" ? step.agentId : null) || draft.definition.settings.agentId;
        if (agentId) {
          const result = await client
            .from("service_channel_bindings" as never)
            .select("account_id")
            .eq("workspace_id", input.workspaceId)
            .eq("account_id", step.accountId)
            .eq("agent_id", agentId)
            .eq("enabled", true)
            .eq("campaigns", true)
            .eq("inbound", true)
            .maybeSingle();
          if (result.error || !result.data)
            add(
              step.id,
              "channel_agent_unavailable",
              "O agente deve estar habilitado para campanhas e atendimento nesta conta.",
            );
        }
      }
      if (
        (step.type === "task" || step.type === "call") &&
        step.assigneeId &&
        !checkedMembers.has(step.assigneeId)
      ) {
        checkedMembers.add(step.assigneeId);
        const result = await client
          .from("workspace_members")
          .select("user_id")
          .eq("workspace_id", input.workspaceId)
          .eq("user_id", step.assigneeId)
          .eq("status", "active")
          .maybeSingle();
        if (result.error || !result.data)
          add(
            step.id,
            "assignee_unavailable",
            "Responsável indisponível ou inativo neste workspace.",
          );
      }
      if (step.type === "agent" && step.agentId) agents.add(step.agentId);
    }
  for (const agentId of agents) {
    if (checkedAgents.has(agentId)) continue;
    checkedAgents.add(agentId);
    try {
      const { assertSdr } = await import("@/lib/prospecting/sdr/access.server");
      await assertSdr(client, actor, input.workspaceId, "view");
    } catch {
      add(null, "agent_permission", "Sem acesso à configuração do agente SDR.");
      continue;
    }
    const result = await client
      .from("sdr_playbooks")
      .select("id")
      .eq("workspace_id", input.workspaceId)
      .eq("id", agentId)
      .eq("enabled", true)
      .maybeSingle();
    const version = await client
      .from("sdr_agent_versions" as never)
      .select("id")
      .eq("workspace_id", input.workspaceId)
      .eq("playbook_id", agentId)
      .eq("status", "published")
      .maybeSingle();
    if (result.error || !result.data || version.error || !version.data)
      add(
        null,
        "agent_unavailable",
        "Agente indisponível, sem acesso ou sem uma versão publicada.",
      );
  }
  return {
    revision: draft.revision,
    checkedAt: new Date().toISOString(),
    configurationValid: issues.length === 0,
    executionEnabled: false as const,
    issues,
  };
}
export async function createSequenceVersion(
  client: SupabaseClient,
  input: ReleaseInput,
): Promise<SequenceRelease> {
  await authorize(client, input, "manage");
  const report = await preflightSequence(client, input);
  if (!report.configurationValid)
    throw new Error(report.issues[0]?.message || "Revise a configuração.");
  return workRpc(client, "prospecting_sequence_version_create", {
    p_id: input.id,
    p_workspace: input.workspaceId,
    p_expected_revision: input.expectedRevision,
  });
}
export async function listSequenceVersions(
  client: SupabaseClient,
  input: ReleaseInput,
): Promise<SequenceRelease[]> {
  await authorize(client, input, "view");
  const { data, error } = await client
    .from("prospecting_sequence_versions" as never)
    .select("id,draft_id,draft_revision,name,created_at")
    .eq("workspace_id", input.workspaceId)
    .eq("draft_id", input.id)
    .order("created_at", { ascending: false })
    .limit(25);
  if (error) throw new Error("Não foi possível carregar as versões.");
  return data as SequenceRelease[];
}
