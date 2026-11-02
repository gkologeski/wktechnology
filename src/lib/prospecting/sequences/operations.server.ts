import type { DynamicSubscriptionStatus } from "./dynamic.server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { assertSalesArea } from "@/lib/access-control/sales-core.server";
import { workRpc } from "@/lib/access-control/work-core.server";
import { definitionSchema, SEQUENCE_RESOURCE } from "./draft";
import { operationsInput, operationInput } from "./draft";
type Capability = { manage: boolean; assign: boolean; activity: boolean };
type Capabilities = { readOnly: boolean; owners: Record<string, Capability> };
export type OperationalRun = {
  id: string;
  owner_id: string;
  cohort_person_id: string;
  state: string;
  cursor: number;
  next_run_at: string;
  reason: string | null;
  updated_at: string;
  canManage: boolean;
  canResume: boolean;
  canCompleteCall: boolean;
  activityId: string | null;
  activityKind: string | null;
  person: { id: string; entity: "lead" | "contact"; label: string } | null;
};
async function scope(client: SupabaseClient, workspaceId: string, action: "view" | "manage") {
  await assertSalesArea(client, SEQUENCE_RESOURCE, action);
  const ctx = await workRpc<{ workspace: string; actor: string; read_only: boolean }>(
    client,
    "sales_access_context",
    {},
  );
  if (ctx.workspace !== workspaceId || !ctx.actor || (action === "manage" && ctx.read_only))
    throw new Error("Workspace indisponível.");
  return ctx;
}
export async function sequenceOperations(
  client: SupabaseClient,
  input: z.infer<typeof operationsInput>,
) {
  const data = operationsInput.parse(input);
  const ctx = await scope(client, data.workspaceId, "view");
  const version = await client
    .from("prospecting_sequence_versions" as never)
    .select("id,owner_id,entry:definition->audience->>entry")
    .eq("id", data.versionId)
    .eq("workspace_id", data.workspaceId)
    .maybeSingle();
  if (version.error || !version.data) throw new Error("Versão indisponível.");
  const owner = (version.data as { owner_id: string }).owner_id;
  const hasDynamic = (version.data as { entry?: string }).entry === "dynamic";
  const subscription = hasDynamic
    ? await workRpc<DynamicSubscriptionStatus | null>(
        client,
        "prospecting_sequence_subscription_status",
        { p_workspace: data.workspaceId, p_version: data.versionId },
      )
    : null;
  const result = await client
    .from("prospecting_sequence_runs" as never)
    .select("id,owner_id,cohort_person_id,state,cursor,next_run_at,reason,updated_at", {
      count: "exact",
    })
    .eq("workspace_id", data.workspaceId)
    .eq("version_id", data.versionId)
    .order("created_at", { ascending: false })
    .order("id")
    .range(data.page * 50, data.page * 50 + 49);
  if (result.error || typeof result.count !== "number")
    throw new Error("Não foi possível carregar as execuções.");
  const runs = (result.data || []) as Omit<
    OperationalRun,
    "canManage" | "canResume" | "canCompleteCall" | "activityId" | "activityKind" | "person"
  >[];
  const cohortPeople = runs.length
    ? await client
        .from("prospecting_sequence_cohort_people" as never)
        .select("id,entity,source_id")
        .eq("workspace_id", data.workspaceId)
        .in(
          "id",
          runs.map((r) => r.cohort_person_id),
        )
    : { data: [], error: null };
  if (cohortPeople.error) throw new Error("Não foi possível consultar os destinatários visíveis.");
  const people = (cohortPeople.data || []) as {
    id: string;
    entity: "lead" | "contact";
    source_id: string;
  }[];
  const sourceRows = await Promise.all(
    (["contact", "lead"] as const).map(async (entity) => {
      const ids = people.filter((p) => p.entity === entity).map((p) => p.source_id);
      if (!ids.length) return [];
      const q = await client
        .from((entity === "contact" ? "shared_fields_contacts" : "shared_fields_leads") as never)
        .select("id,first_name,last_name")
        .eq("workspace_id", data.workspaceId)
        .in("id", ids);
      if (q.error) throw new Error("Não foi possível consultar os destinatários visíveis.");
      return (
        (q.data || []) as { id: string; first_name: string | null; last_name: string | null }[]
      ).map((p) => ({ ...p, entity }));
    }),
  );
  const effects = runs.length
    ? await client
        .from("prospecting_sequence_effects" as never)
        .select("id,run_id,kind,finished_at")
        .in(
          "run_id",
          runs.map((r) => r.id),
        )
        .eq("workspace_id", data.workspaceId)
        .in("kind", ["call", "task"])
        .eq("status", "succeeded")
        .order("finished_at", { ascending: false })
        .limit(2500)
    : { data: [], error: null };
  if (effects.error) throw new Error("Não foi possível consultar as atividades.");
  const allTasks = (effects.data || []) as { id: string; run_id: string; kind: string }[];
  const tasks = allTasks.filter((t, i) => allTasks.findIndex((x) => x.run_id === t.run_id) === i);
  const activities = tasks.length
    ? await client
        .from("activities")
        .select("id,owner_id,assigned_to,completed,external_ids")
        .eq("workspace_id", data.workspaceId)
        .in(
          "id",
          tasks.map((t) => t.id),
        )
    : { data: [], error: null };
  if (activities.error) throw new Error("Não foi possível consultar as permissões de atividades.");
  const caps = await workRpc<Capabilities>(client, "prospecting_sequence_capabilities", {
    p_workspace: data.workspaceId,
    p_owners: [
      ...new Set([
        owner,
        ctx.actor,
        ...(subscription ? [subscription.ownerId] : []),
        ...runs.map((r) => r.owner_id),
        ...(activities.data || [])
          .map((a) => a.assigned_to || a.owner_id)
          .filter((x): x is string => !!x),
      ]),
    ],
  });
  const control = data.cohortId
    ? await client
        .from("prospecting_sequence_cohort_controls" as never)
        .select("cohort_id,prospecting_sequence_cohorts!inner(version_id)")
        .eq("cohort_id", data.cohortId)
        .eq("workspace_id", data.workspaceId)
        .eq("prospecting_sequence_cohorts.version_id", data.versionId)
        .maybeSingle()
    : { data: null, error: null };
  if (control.error) throw new Error("Não foi possível conferir a situação da inscrição.");
  const rows: OperationalRun[] = runs.map((r) => {
    const person = people.find((p) => p.id === r.cohort_person_id);
    const source = sourceRows
      .flat()
      .find((p) => p.id === person?.source_id && p.entity === person?.entity);
    const task = tasks.find((t) => t.run_id === r.id);
    const a = activities.data?.find((a) => a.id === task?.id);
    return {
      ...r,
      person: source
        ? {
            id: source.id,
            entity: source.entity,
            label:
              [source.first_name, source.last_name].filter(Boolean).join(" ") || "Destinatário",
          }
        : null,
      canManage: !!caps.owners[r.owner_id]?.manage,
      canResume:
        !!caps.owners[r.owner_id]?.manage &&
        !!caps.owners[owner]?.manage &&
        !!caps.owners[owner]?.assign,
      canCompleteCall:
        !!caps.owners[r.owner_id]?.manage &&
        !!a &&
        !a.completed &&
        !(
          a.external_ids &&
          typeof a.external_ids === "object" &&
          "vapi_call_id" in a.external_ids
        ) &&
        !!caps.owners[a.assigned_to || a.owner_id || ""]?.activity,
      activityId: a?.id || null,
      activityKind: task?.kind || null,
    };
  });
  return {
    rows,
    total: result.count,
    page: data.page,
    canStart:
      !!caps.owners[owner]?.manage &&
      !!caps.owners[owner]?.assign &&
      !!caps.owners[ctx.actor]?.manage &&
      !!caps.owners[ctx.actor]?.assign,
    dynamic: {
      available: hasDynamic,
      status: subscription,
      canActivate:
        !!caps.owners[owner]?.manage &&
        !!caps.owners[owner]?.assign &&
        !!caps.owners[ctx.actor]?.manage &&
        !!caps.owners[ctx.actor]?.assign &&
        (!subscription || !!caps.owners[subscription.ownerId]?.manage),
      canPause:
        !!subscription &&
        !!caps.owners[owner]?.manage &&
        !!caps.owners[subscription.ownerId]?.manage,
    },
    readOnly: caps.readOnly,
    canDiscard: !!caps.owners[owner]?.manage,
    selectedCohortCancelled: !!control.data,
  };
}
export async function operateSequence(
  client: SupabaseClient,
  input: z.infer<typeof operationInput>,
) {
  const data = operationInput.parse(input);
  const ctx = await scope(client, data.workspaceId, "manage");
  if (data.action === "start" || data.action === "discard") {
    const cohort = await client
      .from("prospecting_sequence_cohorts" as never)
      .select("id")
      .eq("id", data.id)
      .eq("version_id", data.versionId)
      .eq("workspace_id", data.workspaceId)
      .maybeSingle();
    const version = await client
      .from("prospecting_sequence_versions" as never)
      .select("definition")
      .eq("id", data.versionId)
      .eq("workspace_id", data.workspaceId)
      .maybeSingle();
    if (cohort.error || !cohort.data || version.error || !version.data)
      throw new Error("Inscrição indisponível.");
    if (data.action === "discard") {
      await workRpc(client, "prospecting_sequence_discard_cohort", {
        p_workspace: data.workspaceId,
        p_cohort: data.id,
      });
      return { started: 0 };
    }
    const { preflightSequenceDefinition } = await import("./releases.server");
    const report = await preflightSequenceDefinition(
      client,
      data.workspaceId,
      ctx.actor,
      definitionSchema.parse((version.data as { definition: unknown }).definition),
    );
    if (!report.configurationValid)
      throw new Error(report.issues[0]?.message || "Revise as conexões.");
    const started = await workRpc<number>(client, "prospecting_sequence_start", {
      p_workspace: data.workspaceId,
      p_cohort: data.id,
    });
    return { started };
  }
  const run = await client
    .from("prospecting_sequence_runs" as never)
    .select("id")
    .eq("id", data.id)
    .eq("version_id", data.versionId)
    .eq("workspace_id", data.workspaceId)
    .maybeSingle();
  if (run.error || !run.data) throw new Error("Execução indisponível.");
  if (data.action === "answered" || data.action === "no_answer") {
    await workRpc(client, "prospecting_sequence_complete_call", {
      p_workspace: data.workspaceId,
      p_run: data.id,
      p_outcome: data.action,
    });
    return { started: 0 };
  }
  await workRpc(client, "prospecting_sequence_control", {
    p_workspace: data.workspaceId,
    p_run: data.id,
    p_action: data.action,
  });
  return { started: 0 };
}
