import { beforeEach, expect, it } from "vitest";
import { PostgrestClient } from "@supabase/postgrest-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import {
  db,
  W,
  B,
  A,
  U,
  C,
  F,
  ROLE,
  X,
  WF,
  reset,
  fixtureHttpBase,
  fixtureJwt,
  request,
  withRole,
} from "../../tests/fixtures/notification-deliveries";
import {
  loadNotificationReadiness,
  loadNotificationReadinessWorkflows,
} from "./notifications/readiness.server";
import { notificationReadinessReportSchema } from "./notifications/readiness-types";
import { workflowNotificationEventTrigger } from "./workflows/notification-events";

// The loader uses the actual authenticated PostgREST/RLS/permission boundary.
// Only the client transport is supplied here; there is no authorization mock,
// configured application URL, service client or provider request.
const requests: string[] = [];
const client = (actor = U, token = fixtureJwt("authenticated", actor)) =>
  new PostgrestClient(fixtureHttpBase(), {
    headers: { Authorization: `Bearer ${token}` },
    fetch: (input, init) => {
      const url = new URL(
        typeof input === "string" ? input : input instanceof URL ? input.href : input.url,
      );
      if (url.origin !== fixtureHttpBase()) throw Error("Only disposable PostgREST is allowed.");
      requests.push(url.pathname + url.search);
      return fetch(input, init);
    },
  }) as unknown as SupabaseClient;
const inspect = (actor = U, workspace = W, workflow = WF) =>
  loadNotificationReadiness(client(actor), workspace, workflow);
const action = {
  type: "send_notification",
  title: "PRIVATE_ACTION_CONTENT",
  body: "PRIVATE_ACTION_BODY",
  recipients: [{ kind: "user", id: C }],
  delivery: { channels: ["inapp", "email"], fallback: "none" },
};
async function published() {
  await db`update workflows set name='Readiness fixture',execution_user_id=${U},
    trigger=${db.json(JSON.parse(JSON.stringify(workflowNotificationEventTrigger("crm.deal.won"))))},
    actions=${db.json([action])},last_published_at=clock_timestamp()-interval '1 second' where id=${WF}`;
}
async function unchangedState() {
  return (
    await db`select jsonb_build_object(
      'workflows',(select jsonb_agg(to_jsonb(t) order by id) from workflows t),
      'policies',(select jsonb_agg(to_jsonb(t) order by workspace_id) from notification_delivery_policies t),
      'slackPolicies',(select jsonb_agg(to_jsonb(t) order by workspace_id) from notification_slack_policies t),
      'notices',(select jsonb_agg(to_jsonb(t) order by id) from notifications t),
      'intents',(select jsonb_agg(to_jsonb(t) order by id) from notification_delivery_intents t),
      'deliveries',(select jsonb_agg(to_jsonb(t) order by id) from workflow_deliveries t),
      'events',(select jsonb_agg(to_jsonb(t) order by id) from workflow_events t),
      'runs',(select jsonb_agg(to_jsonb(t) order by id) from workflow_runs t),
      'digestCandidates',(select jsonb_agg(to_jsonb(t)) from notification_digest_candidates t),
      'digestBatches',(select jsonb_agg(to_jsonb(t)) from notification_digest_batches t),
      'followups',(select jsonb_agg(to_jsonb(t)) from notification_followup_schedules t),
      'subjects',(select jsonb_agg(to_jsonb(t)) from techerp_api.subject_sessions t)
    ) value`
  )[0].value;
}
beforeEach(async () => {
  await reset();
  await published();
  requests.length = 0;
});

it("Notification readiness allow authorized member", async () => {
  const result = await inspect();
  expect(notificationReadinessReportSchema.parse(result)).toMatchObject({
    workspaceId: W,
    workflow: {
      id: WF,
      status: "published",
      enabled: true,
      publishedVersion: 1,
      eventKey: "crm.deal.won",
    },
    runbookVersion: "p13-v1",
    notes: [
      "published_configuration_only",
      "drafts_excluded",
      "no_runtime_execution",
      "no_global_send_readiness",
    ],
  });
  expect(result.checks).toContainEqual({
    code: "published_configuration",
    scope: "workflow",
    status: "observed",
    reason: "published_configuration_valid",
  });
  for (const code of [
    "origin_executor_access",
    "recipient_eligibility",
    "personal_consent",
    "current_limits",
    "live_provider",
    "cron_deployment",
    "other_rules_and_queues",
    "production_pilot",
  ])
    expect(result.checks).toContainEqual(
      expect.objectContaining({ code, status: "manual_pending" }),
    );
  expect(requests.some((path) => path.startsWith("/workflows?"))).toBe(true);
  expect(requests).toContain("/rpc/notification_delivery_capabilities");
  expect(requests).toContain("/rpc/sales_area_authorize");
  expect(requests).toContain("/rpc/sales_record_access");
  expect(requests).toContain("/rpc/notification_delivery_settings");
  expect(JSON.stringify(result)).not.toMatch(/PRIVATE_ACTION_|synthetic-not-a-secret/);
  expect(JSON.stringify(result)).not.toContain(C);
});
it("Notification readiness reject missing permission", async () => {
  await db`delete from job_role_permission_overrides where workspace_id=${W} and role_id=${ROLE}
    and permission_key='system.notification_settings.view.workspace'`;
  await expect(inspect()).rejects.toThrow();
  expect(requests.some((path) => path.startsWith("/workflows?"))).toBe(false);
});
it("Notification readiness reject explicit deny", async () => {
  await db`update job_role_permission_overrides set effect='deny' where workspace_id=${W} and role_id=${ROLE}
    and permission_key='system.notification_settings.view.workspace'`;
  await expect(inspect()).rejects.toThrow();
  expect(requests.some((path) => path.startsWith("/workflows?"))).toBe(false);
});
it("Notification readiness reject foreign workspace", async () => {
  await expect(inspect(U, B)).rejects.toThrow();
  await expect(inspect(F, W)).rejects.toThrow();
  const foreign = randomUUID();
  await db`insert into workflows(id,workspace_id,owner_id,execution_user_id,entity)
    values(${foreign},${B},${F},${F},'deals')`;
  await expect(inspect(U, W, foreign)).rejects.toThrow();
  expect(requests.some((path) => path.startsWith("/workflows?"))).toBe(false);
});
it("Notification readiness reject inactive member", async () => {
  await db`update workspace_members set status='inactive' where workspace_id=${W} and user_id=${U}`;
  await expect(inspect()).rejects.toThrow();
  expect(requests.some((path) => path.startsWith("/workflows?"))).toBe(false);
});

it("requires Workflow view in addition to notification settings and honors own record scope", async () => {
  await db`delete from job_role_permission_overrides where workspace_id=${W} and role_id=${ROLE}
    and permission_key='system.workflows.view.workspace'`;
  await expect(inspect()).rejects.toThrow();
  await db`insert into job_role_permission_overrides(workspace_id,role_id,permission_key,effect)
    values(${W},${ROLE},'system.workflows.view.own','grant')`;
  // The area is visible, but the selected published workflow belongs to A.
  expect(A).not.toBe(U);
  await expect(inspect()).rejects.toThrow();
  await db`update workflows set owner_id=${U} where id=${WF}`;
  await expect(inspect()).resolves.toBeDefined();
  const hidden = randomUUID();
  await db`insert into workflows(id,workspace_id,owner_id,execution_user_id,entity)
    values(${hidden},${W},${C},${C},'deals')`;
  await expect(inspect(U, W, hidden)).rejects.toThrow();
  await expect(inspect(U, W, randomUUID())).rejects.toThrow();
});

it("allows a view-only inspector without treating source access as verified", async () => {
  await db`delete from job_role_permission_overrides where workspace_id=${W} and role_id=${ROLE}
    and permission_key in ('system.notification_settings.manage.workspace','system.workflows.manage.workspace',
      'system.integrations.manage.workspace','system.whatsapp.manage.workspace','techsales.deals.view.workspace')`;
  const result = await inspect();
  expect(result.checks).toContainEqual({
    code: "delivery_policy",
    scope: "operation",
    status: "observed",
    reason: "policy_observed",
  });
  expect(result.checks).toContainEqual({
    code: "origin_executor_access",
    scope: "operation",
    status: "manual_pending",
    reason: "current_origin_executor_manual",
  });
  expect(requests.some((path) => path.startsWith("/deals?"))).toBe(false);
});

it("does not mutate published rules, queues or notices while reading the preparation snapshot", async () => {
  const before = await unchangedState();
  await inspect();
  await inspect();
  expect(await unchangedState()).toEqual(before);
  expect(requests.every((path) => path.startsWith("/rpc/") || path.startsWith("/workflows?"))).toBe(
    true,
  );
  expect(requests.join("\n")).not.toMatch(
    /consents|profiles|notification_delivery_history|wa_cloud|webhook|receipt|dispatch|claim|schedule_tick/,
  );
});

it("rejects an unverified JWT instead of using a privileged client", async () => {
  await expect(
    loadNotificationReadiness(
      client(U, fixtureJwt("authenticated", U, "incorrect-fixture-only-signature")),
      W,
      WF,
    ),
  ).rejects.toThrow();
  expect(requests.some((path) => path.startsWith("/workflows?"))).toBe(false);
});

it("reports an existing policy RPC failure as unavailable instead of inventing a successful inspection", async () => {
  await db`revoke execute on function public.notification_delivery_settings(uuid) from authenticated`;
  try {
    const result = await inspect();
    expect(result.checks).toContainEqual({
      code: "delivery_policy",
      scope: "operation",
      status: "unavailable",
      reason: "policy_unavailable",
    });
    expect(requests).toContain("/rpc/notification_delivery_settings");
  } finally {
    await db`grant execute on function public.notification_delivery_settings(uuid) to authenticated`;
  }
});

it("inspects published configuration without substituting a newer valid or invalid draft", async () => {
  const { checkedAt: _before, ...publishedResult } = await inspect();
  await db`update workflows set draft_trigger='{"event":"updated","notification_event":{"key":"invalid.draft.event"}}',
    draft_actions='[{"type":"send_slack","text":"PRIVATE_DRAFT_ACTION","channel":"#private-draft"}]' where id=${WF}`;
  const { checkedAt: _after, ...withDraft } = await inspect();
  expect(withDraft).toEqual(publishedResult);
  expect(JSON.stringify(withDraft)).not.toMatch(/PRIVATE_DRAFT|invalid\.draft|#private/);
  expect(
    requests
      .filter((path) => path.startsWith("/workflows?"))
      .every((path) => !path.includes("draft")),
  ).toBe(true);
  await db`update workflows set trigger='{"event":"updated","notification_event":{"key":"invalid.published.event"}}',
    draft_trigger=${db.json(JSON.parse(JSON.stringify(workflowNotificationEventTrigger("crm.deal.won"))))},
    draft_actions=${db.json([action])} where id=${WF}`;
  const invalid = await inspect();
  expect(invalid.checks).toContainEqual({
    code: "published_configuration",
    scope: "workflow",
    status: "dependency_blocked",
    reason: "published_configuration_invalid",
  });
});

it("keeps an unpublished or disabled workflow blocked while preserving the published version", async () => {
  await db`update workflows set enabled=false where id=${WF}`;
  expect((await inspect()).checks).toContainEqual({
    code: "workflow_publication",
    scope: "workflow",
    status: "dependency_blocked",
    reason: "workflow_disabled",
  });
  await db`update workflows set enabled=true,status='draft' where id=${WF}`;
  expect((await inspect()).checks).toContainEqual({
    code: "workflow_publication",
    scope: "workflow",
    status: "dependency_blocked",
    reason: "workflow_not_published",
  });
});

it("keeps restricted channel dependencies unavailable without exposing bindings or querying a provider", async () => {
  await db`delete from job_role_permission_overrides where workspace_id=${W} and role_id=${ROLE}
    and permission_key in ('system.integrations.view.workspace','system.whatsapp.view.workspace')`;
  await db`update workflows set actions=${db.json([
    { ...action, delivery: { channels: ["inapp", "whatsapp"], fallback: "email" } },
    { type: "send_slack", text: "PRIVATE_COLLECTIVE_CONTENT" },
  ])} where id=${WF}`;
  const result = await inspect();
  expect(result.checks).toContainEqual(
    expect.objectContaining({ code: "slack_policy", status: "unavailable" }),
  );
  expect(result.checks).toContainEqual(
    expect.objectContaining({ code: "whatsapp_policy", status: "unavailable" }),
  );
  expect(requests).not.toContain("/rpc/notification_slack_settings");
  expect(requests.join("\n")).not.toMatch(/wa_cloud|templates|consent|profiles/);
  expect(JSON.stringify(result)).not.toMatch(
    /PRIVATE_|Synthetic team|Synthetic channel|hooks\.slack|123456789|\+5548/,
  );
});

it("keeps inspection separate from a canonical producer, deduplicated delivery and recipient history", async () => {
  const { checkedAt: _before, ...snapshot } = await inspect();
  expect((await db`select count(*)::integer n from notifications`)[0].n).toBe(0);
  expect((await db`select count(*)::integer n from notification_business_event_proofs`)[0].n).toBe(
    0,
  );
  const pipeline = randomUUID();
  await db`insert into pipelines(id,workspace_id,owner_id,stages) values(${pipeline},${W},${U},
    '[{"value":"open","type":"open"},{"value":"won","type":"won"}]')`;
  await db`update deals set stage='new',stage_id='open',pipeline_id=${pipeline} where id=${X}`;
  await db`update deals set stage_id='won' where id=${X}`;
  const [event] =
    await db`select id from workflow_events where notification_event_key='crm.deal.won'`;
  expect(event?.id).toBeDefined();
  expect(
    await request(
      "/rpc/notification_business_event_check",
      {
        p_event: event.id,
        p_workflow: WF,
        p_version: 1,
      },
      U,
      fixtureJwt("service_role"),
    ),
  ).toEqual({ status: 200, payload: true });
  const run = randomUUID();
  await db`insert into workflow_runs(id,workspace_id,owner_id,workflow_id,event_id,entity,entity_id)
    values(${run},${W},${A},${WF},${event.id},'deals',${X})`;
  const dispatch = () =>
    withRole(
      "service_role",
      null,
      async (tx) =>
        (
          await tx`select notification_workflow_dispatch_v2(${WF},${run},1,'deals',${X},${tx.json(action.recipients)},
      ${action.title},${action.body},'0',${tx.json(action.delivery)}) value`
        )[0].value,
    );
  expect(await dispatch()).toMatchObject({ sent: 1, duplicate: 0 });
  expect(await dispatch()).toMatchObject({ sent: 0, duplicate: 1 });
  expect((await db`select count(*)::integer n from notifications where user_id=${C}`)[0].n).toBe(1);
  expect(
    await request("/rpc/notification_delivery_history", { p_workspace: W, p_scope: "own" }, C),
  ).toMatchObject({
    status: 200,
    payload: {
      items: expect.arrayContaining([expect.objectContaining({ eventKey: "crm.deal.won" })]),
    },
  });
  // A preparation report does not become proof of this or any provider send.
  const { checkedAt: _after, ...afterDelivery } = await inspect();
  expect(afterDelivery).toEqual(snapshot);
});

it("lists only selector metadata without transferring action or draft content", async () => {
  await db`update workflows set draft_trigger='{"event":"updated","private":"PRIVATE_DRAFT_TRIGGER"}',
    draft_actions='[{"type":"send_notification","title":"PRIVATE_DRAFT_TITLE","body":"PRIVATE_DRAFT_BODY"}]' where id=${WF}`;
  const before = await unchangedState();
  expect(await loadNotificationReadinessWorkflows(client(), W)).toEqual({
    items: [
      {
        id: WF,
        name: "Readiness fixture",
        status: "published",
        enabled: true,
        publishedVersion: 1,
      },
    ],
    truncated: false,
  });
  expect(await unchangedState()).toEqual(before);
  const selected = requests.filter((path) => path.startsWith("/workflows?"));
  expect(selected).toHaveLength(1);
  const query = new URL(selected[0], fixtureHttpBase()).searchParams;
  expect(query.get("select")).toBe("id,name,status,enabled,published_version");
  expect(query.get("workspace_id")).toBe("eq." + W);
  expect(query.get("limit")).toBe("101");
  expect(requests.join("\n")).not.toMatch(
    /actions|draft|trigger|profiles|consents|wa_cloud|notification_delivery_settings|notification_slack_settings/,
  );
});

it("lists only workflows inside the current user's record scope and workspace", async () => {
  const other = randomUUID(),
    foreign = randomUUID();
  await db`insert into workflows(id,workspace_id,owner_id,execution_user_id,entity,name)
    values(${other},${W},${C},${C},'deals','Other owner'),(${foreign},${B},${F},${F},'deals','Foreign workspace')`;
  await db`update workflows set owner_id=${U} where id=${WF}`;
  await db`delete from job_role_permission_overrides where workspace_id=${W} and role_id=${ROLE}
    and permission_key='system.workflows.view.workspace'`;
  await db`insert into job_role_permission_overrides(workspace_id,role_id,permission_key,effect)
    values(${W},${ROLE},'system.workflows.view.own','grant')`;
  const result = await loadNotificationReadinessWorkflows(client(), W);
  expect(result.items.map((item) => item.id)).toEqual([WF]);
  expect(JSON.stringify(result)).not.toMatch(/Other owner|Foreign workspace/);
});

it("rejects unauthorized selector listings before reading workflow rows", async () => {
  const denied = async (actor = U, workspace = W) => {
    requests.length = 0;
    await expect(loadNotificationReadinessWorkflows(client(actor), workspace)).rejects.toThrow();
    expect(requests.some((path) => path.startsWith("/workflows?"))).toBe(false);
  };
  for (const key of [
    "system.notification_settings.view.workspace",
    "system.workflows.view.workspace",
  ]) {
    await db`delete from job_role_permission_overrides where workspace_id=${W} and role_id=${ROLE} and permission_key=${key}`;
    await denied();
    await db`insert into job_role_permission_overrides(workspace_id,role_id,permission_key,effect)
      values(${W},${ROLE},${key},'deny')`;
    await denied();
    await db`update job_role_permission_overrides set effect='grant' where workspace_id=${W} and role_id=${ROLE} and permission_key=${key}`;
  }
  await db`update workspace_members set status='inactive' where workspace_id=${W} and user_id=${U}`;
  await denied();
  await db`update workspace_members set status='active' where workspace_id=${W} and user_id=${U}`;
  await denied(U, B);
  await denied(F, W);
});

it("bounds the selector at one hundred visible workflows and reports an additional row", async () => {
  await db`insert into workflows(id,workspace_id,owner_id,execution_user_id,entity,name)
    select gen_random_uuid(),${W},${U},${U},'deals','Selector '||lpad(n::text,3,'0') from generate_series(1,99) n`;
  const full = await loadNotificationReadinessWorkflows(client(), W);
  expect(full.items).toHaveLength(100);
  expect(full.truncated).toBe(false);
  await db`insert into workflows(id,workspace_id,owner_id,execution_user_id,entity,name)
    values(${randomUUID()},${W},${U},${U},'deals','Selector 100')`;
  const truncated = await loadNotificationReadinessWorkflows(client(), W);
  expect(truncated.items).toHaveLength(100);
  expect(truncated.truncated).toBe(true);
  expect(truncated.items).toEqual(full.items);
});

it("does not replace a selector SQL failure with an empty authorized list", async () => {
  await db`revoke select on table public.workflows from authenticated`;
  try {
    await expect(loadNotificationReadinessWorkflows(client(), W)).rejects.toThrow();
  } finally {
    await db`grant select on table public.workflows to authenticated`;
  }
});
