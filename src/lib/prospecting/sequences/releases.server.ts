import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { assertSalesRecord, assertSalesArea } from "@/lib/access-control/sales-core.server";
import { workRpc } from "@/lib/access-control/work-core.server";
import { requireChannelAccess } from "@/lib/prospecting/sdr/channel-access.server";
import {
  definitionSchema,
  SEQUENCE_RESOURCE,
  type SequenceDefinition,
  type SequenceDraft,
} from "./draft";
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
  return preflightSequenceDefinition(
    client,
    input.workspaceId,
    actor,
    draft.definition,
    draft.revision,
  );
}
export async function preflightSequenceDefinition(
  client: SupabaseClient,
  workspaceId: string,
  actor: string,
  definition: SequenceDefinition,
  revision = 0,
) {
  const issues: SequenceIssue[] = inspectSequence(definition);
  const add = (stepId: string | null, code: string, message: string) =>
    issues.push({ stepId, code, message });
  const templateCache = new Map<string, ReturnType<typeof sequenceTemplates>>();
  const checkedEmail = new Set<string>(),
    checkedMembers = new Set<string>(),
    checkedAgents = new Set<string>();
  const agents = new Set<string>();
  if (definition.settings.agentId) agents.add(definition.settings.agentId);
  const senders = new Set(
    definition.steps
      .flatMap((s) => (s.type === "email" || s.type === "whatsapp" ? [s.accountId] : []))
      .filter(Boolean),
  );
  if (senders.size > 10) add(null, "account_limit", "Use até dez contas distintas por sequência.");
  else
    for (const step of definition.steps) {
      if (step.type === "call" && step.mode === "automatic" && step.scriptId) {
        try {
          await assertSalesArea(client, "techsales.prospecting_voice", "create");
          await assertSalesArea(client, "techsales.prospecting_voice", "view");
          await assertSalesArea(client, "techsales.activities", "create");
          await assertSalesRecord(client, "prospecting_scripts", step.scriptId, "view");
          const script = await client
            .from("prospecting_scripts")
            .select("id,archived_at,system_prompt,first_message,voice_id,voice_provider")
            .eq("id", step.scriptId)
            .eq("workspace_id", workspaceId)
            .maybeSingle();
          const voice = await client
            .from("voice_agent_settings")
            .select("vapi_phone_number_id,default_voice_id,default_voice_provider,language")
            .eq("workspace_id", workspaceId)
            .maybeSingle();
          if (
            script.error ||
            !script.data ||
            script.data.archived_at ||
            !script.data.system_prompt?.trim() ||
            !script.data.first_message?.trim() ||
            voice.error ||
            !voice.data ||
            !z.string().uuid().safeParse(voice.data.vapi_phone_number_id).success ||
            !(script.data.voice_id || voice.data.default_voice_id) ||
            (script.data.voice_provider || voice.data.default_voice_provider) !== "elevenlabs" ||
            !process.env.VAPI_API_KEY ||
            !process.env.VAPI_WEBHOOK_SECRET
          )
            throw new Error("Unavailable");
        } catch {
          add(
            step.id,
            "voice_unavailable",
            "Confira roteiro ativo, número de saída, voz, integração e permissões da telefonia.",
          );
        }
      }
      if (step.type === "email" && step.accountId && !checkedEmail.has(step.accountId)) {
        checkedEmail.add(step.accountId);
        try {
          await assertSalesArea(client, "techsales.email_accounts", "view");
          const account = await channel(client, actor, workspaceId, step.accountId, "email");
          const result = await client
            .from("email_accounts")
            .select("id")
            .eq("id", account.source_key)
            .eq("workspace_id", workspaceId)
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
              sequenceTemplates(client, actor, workspaceId, step.accountId),
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
          (step.type === "whatsapp" ? step.agentId : null) || definition.settings.agentId;
        if (agentId) {
          const result = await client
            .from("service_channel_bindings" as never)
            .select("account_id")
            .eq("workspace_id", workspaceId)
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
        (step.type === "task" || (step.type === "call" && step.mode === "human")) &&
        step.assigneeId &&
        !checkedMembers.has(step.assigneeId)
      ) {
        checkedMembers.add(step.assigneeId);
        const result = await client
          .from("workspace_members")
          .select("user_id")
          .eq("workspace_id", workspaceId)
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
  const work = definition.steps.filter(
    (s) => s.type === "task" || (s.type === "call" && s.mode === "human"),
  );
  for (const step of work) {
    const resource = step.type === "task" ? "techsales.tasks" : "techsales.activities";
    try {
      await assertSalesArea(client, resource, "create");
      if (
        (step.type === "task" || (step.type === "call" && step.mode === "human")) &&
        step.assigneeId &&
        step.assigneeId !== actor
      )
        await assertSalesArea(client, resource, "assign");
    } catch {
      add(
        step.id,
        "activity_permission",
        "Sem permissão atual para criar ou atribuir a atividade desta etapa.",
      );
    }
  }
  if (
    (definition.settings.stopOnReply && !definition.settings.agentId) ||
    definition.steps.some(
      (s) =>
        (s.type === "wait" && s.onReply === "human") ||
        (s.type === "condition" && (s.yes === "human" || s.no === "human")),
    )
  ) {
    try {
      await assertSalesArea(client, "techsales.tasks", "create");
    } catch {
      add(
        null,
        "handoff_permission",
        "O atendimento humano exige permissão para criar a tarefa de acompanhamento.",
      );
    }
  }
  for (const agentId of agents) {
    if (checkedAgents.has(agentId)) continue;
    checkedAgents.add(agentId);
    try {
      const { assertSdr } = await import("@/lib/prospecting/sdr/access.server");
      await assertSdr(client, actor, workspaceId, "view");
    } catch {
      add(null, "agent_permission", "Sem acesso à configuração do agente SDR.");
      continue;
    }
    const result = await client
      .from("sdr_playbooks")
      .select("id")
      .eq("workspace_id", workspaceId)
      .eq("id", agentId)
      .eq("enabled", true)
      .maybeSingle();
    const version = await client
      .from("sdr_agent_versions" as never)
      .select("id")
      .eq("workspace_id", workspaceId)
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
    revision,
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
