// Leituras/escritas administrativas das ferramentas (somente servidor e sempre
// depois de autorização RBAC no workspace ATIVO do usuário).
import type { SupabaseClient } from "@supabase/supabase-js";
import { getActiveWorkspaceId } from "@/lib/access-control/enforce.server";
import { assertSdr, type SdrAction } from "../access.server";
import { configFromRow, scopeKnowledge } from "../agent-config";
import {
  SKILLS,
  TOOL_DEFS,
  ToolConfigSchema,
  parseToolConfig,
  toolReadiness,
  type ReadinessFacts,
  type ToolConfig,
} from "./catalog";
import { checkHostCalendar } from "./store.server";

/** Workspace ativo canônico + permissão; Ver Como é somente leitura. */
export async function gate(supabase: SupabaseClient, userId: string, action: SdrAction) {
  const ws = await getActiveWorkspaceId(supabase, userId);
  await assertSdr(supabase, userId, ws, action);
  if (action !== "view") {
    const { data: ro } = await supabase.rpc("is_read_only_view" as never);
    if (ro) throw new Error("Sessão Ver Como é somente leitura.");
  }
  return ws;
}

export async function loadPlaybook(supabase: SupabaseClient, ws: string, playbookId: string) {
  const { data, error } = await supabase
    .from("sdr_playbooks")
    .select("*")
    .eq("id", playbookId)
    .eq("workspace_id", ws)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Agente não encontrado neste workspace.");
  return data as Record<string, unknown> & { id: string; questionnaire_id: string | null };
}

export async function readinessFacts(
  ws: string,
  pb: Record<string, unknown>,
  cfg: ToolConfig | null,
): Promise<ReadinessFacts> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { loadKnowledge } = await import("../worker.server");
  const agentCfg = configFromRow(pb);
  const { materials } = scopeKnowledge(agentCfg, await loadKnowledge(supabaseAdmin, ws));
  return {
    calendar: await checkHostCalendar(supabaseAdmin, ws, cfg?.scheduling ?? null),
    crmLinked: true,
    questionnaire: !!pb.questionnaire_id,
    materials: materials.length > 0,
    assignee: !!agentCfg.assigned_to,
  };
}

export async function getCatalog(supabase: SupabaseClient, userId: string, playbookId: string) {
  const ws = await gate(supabase, userId, "view");
  const pb = await loadPlaybook(supabase, ws, playbookId);
  const { data: versions, error } = await supabase
    .from("sdr_agent_versions")
    .select("id, version, status, tool_config")
    .eq("workspace_id", ws)
    .eq("playbook_id", playbookId)
    .in("status", ["draft", "published"]);
  if (error) throw new Error(error.message);
  const draft = versions?.find((v) => v.status === "draft") ?? null;
  const published = versions?.find((v) => v.status === "published") ?? null;
  const draftCfg = parseToolConfig(draft?.tool_config) ?? parseToolConfig(published?.tool_config);
  const pubCfg = parseToolConfig(published?.tool_config);
  const facts = await readinessFacts(ws, pb, draftCfg);
  const pubFacts = await readinessFacts(ws, pb, pubCfg);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // Agendas desta empresa (sem tokens) para escolher o anfitrião.
  const { data: accounts } = await supabaseAdmin
    .from("calendar_accounts")
    .select("id, provider, email, owner_id, last_status")
    .eq("workspace_id", ws);
  const ownerIds = [...new Set((accounts ?? []).map((a) => a.owner_id))];
  const { data: owners } = ownerIds.length
    ? await supabaseAdmin.from("profiles").select("id, full_name").in("id", ownerIds)
    : { data: [] as { id: string; full_name: string | null }[] };
  const { data: logs } = await supabase
    .from("sdr_tool_calls")
    .select("id, tool, status, error, duration_ms, created_at, job_id")
    .eq("workspace_id", ws)
    .eq("playbook_id", playbookId)
    .order("created_at", { ascending: false })
    .limit(30);
  const { data: booking } = pb.booking_page_id
    ? await supabase
        .from("booking_pages")
        .select("id, title, owner_id, calendar_account_id, duration_minutes, buffer_before_minutes, buffer_after_minutes, timezone, min_notice_hours, max_advance_days, availability")
        .eq("id", String(pb.booking_page_id))
        .eq("workspace_id", ws)
        .maybeSingle()
    : { data: null };
  return {
    workspaceId: ws,
    skills: SKILLS,
    tools: TOOL_DEFS.map((d) => ({
      id: d.id,
      skill: d.skill,
      name: d.name,
      description: d.description,
      effect: d.effect,
      confirmation: d.confirmation,
      available: d.available,
      parameters: d.parameters,
      readiness: toolReadiness(d, facts),
      published: !!pubCfg?.enabled_tools.includes(d.id) && toolReadiness(d, pubFacts).ready,
    })),
    draft: draftCfg,
    draftVersionId: draft?.id ?? null,
    publishedVersion: published?.version ?? null,
    publishedHasTools: !!pubCfg?.enabled_tools.length,
    calendarReadiness: facts.calendar,
    calendars: (accounts ?? []).map((a) => ({
      id: a.id,
      provider: a.provider,
      email: a.email,
      owner_id: a.owner_id,
      owner_name: owners?.find((o) => o.id === a.owner_id)?.full_name ?? "Sem nome",
      status: a.last_status,
    })),
    legacyBookingPage: booking ?? null,
    logs: logs ?? [],
  };
}

/** Salva a configuração de ferramentas no RASCUNHO (cria a partir da publicada). */
export async function saveToolDraft(
  supabase: SupabaseClient,
  userId: string,
  playbookId: string,
  raw: unknown,
) {
  const ws = await gate(supabase, userId, "manage");
  await loadPlaybook(supabase, ws, playbookId);
  const parsed = ToolConfigSchema.parse(raw);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  if (parsed.scheduling) {
    // Anfitrião vem do dono da agenda escolhida; nunca do navegador.
    const { data: acc } = await supabaseAdmin
      .from("calendar_accounts")
      .select("id, owner_id, workspace_id")
      .eq("id", parsed.scheduling.calendar_account_id)
      .maybeSingle();
    if (!acc || acc.workspace_id !== ws) throw new Error("Agenda não pertence a esta empresa.");
    parsed.scheduling.host_user_id = acc.owner_id;
  }
  const cfg = parseToolConfig(parsed);
  const { data: versions } = await supabaseAdmin
    .from("sdr_agent_versions")
    .select("id, status, version, persona, flow")
    .eq("playbook_id", playbookId)
    .eq("workspace_id", ws)
    .order("version", { ascending: false });
  const draft = versions?.find((v) => v.status === "draft");
  if (draft) {
    const { error } = await supabaseAdmin
      .from("sdr_agent_versions")
      .update({ tool_config: cfg, updated_at: new Date().toISOString() })
      .eq("id", draft.id);
    if (error) throw new Error(error.message);
    return { id: draft.id, created: false };
  }
  const published = versions?.find((v) => v.status === "published");
  const { data: ins, error } = await supabaseAdmin
    .from("sdr_agent_versions")
    .insert({
      workspace_id: ws,
      playbook_id: playbookId,
      version: (versions?.[0]?.version ?? 0) + 1,
      status: "draft",
      persona: published?.persona ?? {},
      flow: published?.flow ?? null,
      tool_config: cfg,
      notes: "Ferramentas e agendamento direto",
      created_by: userId,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return { id: ins.id, created: true };
}
