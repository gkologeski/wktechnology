import { beforeEach, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import {
  workflowNotificationEventTrigger,
  type WorkflowNotificationEventKey,
} from "./workflows/notification-events";
import {
  db,
  W,
  B,
  A,
  U,
  F,
  ROLE,
  X,
  WF,
  EVENT,
  reset,
  withRole,
  request,
  fixtureJwt,
} from "../../tests/fixtures/notification-deliveries";

beforeEach(reset);
const title = "Atualização de projeto";
const recipients = [{ kind: "source_responsible" }];
const delivery = { channels: ["inapp"], fallback: "none" };
const trigger = (key: WorkflowNotificationEventKey, days = 30) =>
  db.json(JSON.parse(JSON.stringify(workflowNotificationEventTrigger(key, days))));
const events = () =>
  db`select * from workflow_events where notification_event_key like 'projects.%' order by created_at,id`;
const check = (event: string, workflow = WF, version = 1) =>
  request(
    "/rpc/notification_business_event_check",
    { p_event: event, p_workflow: workflow, p_version: version },
    U,
    fixtureJwt("service_role"),
  );
const tick = (limit = 100) =>
  request("/rpc/notification_business_due_tick", { p_limit: limit }, U, fixtureJwt("service_role"));
async function configure(
  key: WorkflowNotificationEventKey = "projects.project.started",
  entity = "projects",
  days = 30,
) {
  await db`update projects set name='Synthetic project',status='planning',due_at=null where id=${X}`;
  await db`update project_tasks set title='Synthetic task',status='todo',due_at=null,custom_status_id=null,list_id=null where id=${X}`;
  await db`update project_milestones set name='Synthetic milestone',status='pending',due_at=null,completed_at=null where id=${X}`;
  await db`update workflows set execution_user_id=${U},entity=${entity},trigger=${trigger(key, days)},
    actions=${db.json([{ type: "send_notification", title, recipients, delivery }])},
    last_published_at=clock_timestamp()-interval '10 days' where id=${WF}`;
}
async function ready() {
  await configure();
  await db`update projects set status='active' where id=${X}`;
  return (await events())[0].id as string;
}
async function seedRun(event: string) {
  const [row] = await db`select entity,entity_id from workflow_events where id=${event}`;
  const run = randomUUID();
  await db`insert into workflow_runs(id,workspace_id,owner_id,workflow_id,event_id,entity,entity_id)
    values(${run},${W},${A},${WF},${event},${row.entity},${row.entity_id}) on conflict(workflow_id,event_id) do nothing`;
  return (await db`select id from workflow_runs where workflow_id=${WF} and event_id=${event}`)[0]
    .id as string;
}
async function dispatch(event: string, channels = ["inapp"], step = "0") {
  const run = await seedRun(event);
  const [row] = await db`select entity,entity_id from workflow_events where id=${event}`;
  return withRole(
    "service_role",
    null,
    async (tx) =>
      (
        await tx`select notification_workflow_dispatch_v2(${WF},${run},1,${row.entity},${row.entity_id},${tx.json(recipients)},${title},null,${step},${tx.json({ channels, fallback: "none" })}) result`
      )[0].result,
  );
}

it("Projects notifications allow authorized member", async () => {
  const event = await ready();
  expect(await check(event)).toEqual({ status: 200, payload: true });
  expect(await dispatch(event)).toMatchObject({ sent: 1, duplicate: 0 });
  expect(await dispatch(event)).toMatchObject({ sent: 0, duplicate: 1 });
  expect(
    (
      await db`select n.type,c.event_key,c.source_table,c.source_id from notifications n join notification_workspace_context c on c.notification_id=n.id`
    )[0],
  ).toMatchObject({
    type: "workflow",
    event_key: "projects.project.started",
    source_table: "projects",
    source_id: X,
  });
  expect(await request(`/projects?select=id&id=eq.${X}`)).toEqual({
    status: 200,
    payload: [{ id: X }],
  });
});

it("Projects notifications reject missing permission", async () => {
  const event = await ready();
  await db`delete from job_role_permission_overrides where role_id=${ROLE} and permission_key='techprojects.projects.view.workspace'`;
  expect(await check(event)).toEqual({ status: 200, payload: false });
  expect(await request(`/projects?select=id&id=eq.${X}`)).toEqual({ status: 200, payload: [] });
  expect((await db`select count(*)::int n from notifications`)[0].n).toBe(0);
});

it("Projects notifications reject explicit deny", async () => {
  const event = await ready();
  await db`update job_role_permission_overrides set effect='deny' where role_id=${ROLE} and permission_key='techprojects.projects.view.workspace'`;
  expect(await check(event)).toEqual({ status: 200, payload: false });
  expect(await request(`/projects?select=id&id=eq.${X}`)).toEqual({ status: 200, payload: [] });
  expect((await db`select count(*)::int n from workflow_deliveries`)[0].n).toBe(0);
});

it("Projects notifications reject foreign workspace", async () => {
  const event = await ready();
  expect(await request(`/projects?select=id&id=eq.${X}`, undefined, F)).toEqual({
    status: 200,
    payload: [],
  });
  await db`update workflows set workspace_id=${B} where id=${WF}`;
  expect(await check(event)).toEqual({ status: 200, payload: false });
  expect((await db`select count(*)::int n from notifications`)[0].n).toBe(0);
});

it("Projects notifications reject inactive member", async () => {
  const event = await ready();
  await db`update workspace_members set status='inactive' where workspace_id=${W} and user_id=${U}`;
  expect(await check(event)).toEqual({ status: 200, payload: false });
  expect(
    (await request("/rpc/notification_delivery_capabilities", { p_workspace: W })).status,
  ).toBe(403);
  expect((await db`select count(*)::int n from notifications`)[0].n).toBe(0);
});

it("emits project start only on planning to active and ignores creation, imports, dates and resuming on hold", async () => {
  await configure();
  await db`insert into projects(id,workspace_id,owner_id,assigned_to,status,name) values(${randomUUID()},${W},${A},${U},'active','Imported active')`;
  await db`update projects set starts_at=(now() at time zone 'America/Sao_Paulo')::date,status='planning' where id=${X}`;
  expect(await events()).toHaveLength(0);
  await db`update projects set status='active' where id=${X}`;
  const [event] = await events();
  expect(event).toMatchObject({
    notification_event_key: "projects.project.started",
    before: { status: "planning" },
    after: { status: "active" },
  });
  await db`update projects set name='Other edit',status='active' where id=${X}`;
  await db`update projects set status='on_hold' where id=${X}`;
  expect(await check(event.id)).toEqual({ status: 200, payload: false });
  await db`update projects set status='active' where id=${X}`;
  expect(await events()).toHaveLength(1);
});

it("keeps project proofs private and rejects spoofed public keys and changed immutable source content", async () => {
  const event = await ready();
  expect((await request("/notification_business_event_proofs?select=*")).status).toBe(403);
  expect(
    (
      await request(
        "/notification_business_due_cursors?select=*",
        undefined,
        U,
        fixtureJwt("service_role"),
      )
    ).status,
  ).toBe(403);
  await expect(
    withRole(
      "service_role",
      null,
      (
        tx,
      ) => tx`insert into workflow_events(id,workspace_id,owner_id,entity,entity_id,notification_event_key)
    values(${randomUUID()},${W},${U},'projects',${X},'projects.project.started')`,
    ),
  ).rejects.toMatchObject({ code: "42501" });
  await expect(
    withRole(
      "service_role",
      null,
      (tx) => tx`update workflow_events set notification_event_key=null where id=${event}`,
    ),
  ).rejects.toMatchObject({ code: "42501" });
  await expect(
    withRole(
      "service_role",
      null,
      (tx) => tx`update workflow_events set after='{"status":"forged"}' where id=${event}`,
    ),
  ).rejects.toMatchObject({ code: "42501" });
  expect(await check(event)).toEqual({ status: 200, payload: true });
});

it("recovers overdue crossings after publication while excluding dates already overdue before publication", async () => {
  await configure("projects.project.overdue");
  await db`update projects set due_at=(now() at time zone 'America/Sao_Paulo')::date-3 where id=${X}`;
  expect(await tick()).toEqual({ status: 200, payload: { enqueued: 1 } });
  const [event] = await events();
  expect(await check(event.id)).toEqual({ status: 200, payload: true });
  expect(
    (
      await db`select days_before from notification_business_event_proofs where event_id=${event.id}`
    )[0].days_before,
  ).toBe(-1);
  await db`update projects set due_at=(now() at time zone 'America/Sao_Paulo')::date-20 where id=${X}`;
  expect(await tick()).toEqual({ status: 200, payload: { enqueued: 0 } });
  expect(await check(event.id)).toEqual({ status: 200, payload: false });
  expect((await db`select count(*)::int n from notifications`)[0].n).toBe(0);
});

it("uses the inclusive Sao Paulo midnight crossing and never treats the due day as overdue", async () => {
  await configure("projects.project.overdue");
  await db`update projects set due_at=(now() at time zone 'America/Sao_Paulo')::date where id=${X}`;
  expect(await tick()).toEqual({ status: 200, payload: { enqueued: 0 } });
  await db`update projects set due_at=due_at-1 where id=${X}`;
  await db`update workflows set last_published_at=((now() at time zone 'America/Sao_Paulo')::date::timestamp at time zone 'America/Sao_Paulo')+interval '1 microsecond' where id=${WF}`;
  expect(await tick()).toEqual({ status: 200, payload: { enqueued: 0 } });
  await db`update workflows set last_published_at=last_published_at-interval '1 microsecond' where id=${WF}`;
  expect(await tick()).toEqual({ status: 200, payload: { enqueued: 1 } });
  expect(await check((await events())[0].id)).toEqual({ status: 200, payload: true });
});

it("persists deadline dedupe through event purge, unchanged republishing and deadline A to B to A", async () => {
  await configure("projects.project.overdue");
  await db`update projects set due_at=(now() at time zone 'America/Sao_Paulo')::date-2 where id=${X}`;
  expect(await tick()).toEqual({ status: 200, payload: { enqueued: 1 } });
  await db`delete from workflow_events where notification_event_key='projects.project.overdue'`;
  expect((await db`select count(*)::int n from notification_business_due_cursors`)[0].n).toBe(1);
  expect(await tick()).toEqual({ status: 200, payload: { enqueued: 0 } });
  await db`update projects set due_at=due_at+1 where id=${X}`;
  expect(await tick()).toEqual({ status: 200, payload: { enqueued: 1 } });
  await db`update projects set due_at=due_at-1 where id=${X}`;
  expect(await tick()).toEqual({ status: 200, payload: { enqueued: 0 } });
  await db`update workflows set published_version=2,last_published_at=clock_timestamp() where id=${WF}`;
  expect(await tick()).toEqual({ status: 200, payload: { enqueued: 0 } });
  expect((await db`select count(*)::int n from notification_business_due_cursors`)[0].n).toBe(2);
});

it("respects custom task completion categories, exact tenant and list binding and parent on hold", async () => {
  await configure("projects.task.overdue", "project_tasks");
  const list = randomUUID(),
    custom = randomUUID();
  await db`insert into project_lists(id,workspace_id,project_id) values(${list},${W},${X})`;
  await db`insert into project_task_statuses(id,workspace_id,list_id,name,category) values(${custom},${W},${list},'A misleading open label','done')`;
  await db`update projects set status='on_hold' where id=${X}`;
  await db`update project_tasks set due_at=(now() at time zone 'America/Sao_Paulo')::date-1,list_id=${list},custom_status_id=${custom} where id=${X}`;
  expect(await tick()).toEqual({ status: 200, payload: { enqueued: 0 } });
  await db`update project_task_statuses set category='cancelled' where id=${custom}`;
  expect(await tick()).toEqual({ status: 200, payload: { enqueued: 0 } });
  await db`update project_task_statuses set category='doing',workspace_id=${B} where id=${custom}`;
  expect(await tick()).toEqual({ status: 200, payload: { enqueued: 0 } });
  await db`update project_task_statuses set workspace_id=${W},list_id=${randomUUID()} where id=${custom}`;
  expect(await tick()).toEqual({ status: 200, payload: { enqueued: 0 } });
  await db`update project_task_statuses set list_id=${list},name='A misleading closed label' where id=${custom}`;
  expect(await tick()).toEqual({ status: 200, payload: { enqueued: 1 } });
  const [event] = await events();
  expect(await check(event.id)).toEqual({ status: 200, payload: true });
  await db`update project_task_statuses set category='done' where id=${custom}`;
  expect(await check(event.id)).toEqual({ status: 200, payload: false });
  await db`update project_task_statuses set category='doing' where id=${custom}`;
  await db`update project_tasks set status='done' where id=${X}`;
  expect(await check(event.id)).toEqual({ status: 200, payload: false });
});

it("requires milestone window, open status, no completion evidence and a live same-tenant parent", async () => {
  await configure("projects.milestone.due", "project_milestones", 30);
  await db`update projects set status='on_hold' where id=${X}`;
  await db`update project_milestones set due_at=(now() at time zone 'America/Sao_Paulo')::date+31 where id=${X}`;
  expect(await tick()).toEqual({ status: 200, payload: { enqueued: 0 } });
  await db`update project_milestones set due_at=due_at-1,completed_at=now() where id=${X}`;
  expect(await tick()).toEqual({ status: 200, payload: { enqueued: 0 } });
  await db`update project_milestones set completed_at=null,status='cancelled' where id=${X}`;
  expect(await tick()).toEqual({ status: 200, payload: { enqueued: 0 } });
  await db`update project_milestones set status='pending' where id=${X}`;
  expect(await tick()).toEqual({ status: 200, payload: { enqueued: 1 } });
  const [event] = await events();
  expect(await check(event.id)).toEqual({ status: 200, payload: true });
  await db`update projects set status='done' where id=${X}`;
  expect(await check(event.id)).toEqual({ status: 200, payload: false });
  await db`update projects set status='planning' where id=${X}`;
  await db`update project_milestones set project_id=${randomUUID()} where id=${X}`;
  expect(await check(event.id)).toEqual({ status: 200, payload: false });
});

it("rejects mixed temporal configs, public overdue offsets, wrong entities and unauthorized service calls", async () => {
  await configure("projects.project.overdue");
  await db`update projects set due_at=(now() at time zone 'America/Sao_Paulo')::date-1 where id=${X}`;
  for (const configuration of [
    { notification_event: { key: "projects.project.overdue", days_before: -1 } },
    { notification_event: { key: "projects.project.overdue", days_after: 1 } },
    { notification_event: { key: "projects.project.overdue" }, time_based: null },
    { notification_event: { key: "projects.milestone.due", days_before: 0 } },
  ]) {
    await db`update workflows set trigger=${db.json(JSON.parse(JSON.stringify(configuration)))} where id=${WF}`;
    expect(await tick()).toEqual({ status: 200, payload: { enqueued: 0 } });
  }
  expect((await request("/rpc/notification_business_due_tick", { p_limit: 100 })).status).toBe(403);
  expect((await tick(201)).status).toBe(400);
  expect(await events()).toHaveLength(0);
});

it("bounds the existing tick and does not create notifications or tasks before an explicit rule runs", async () => {
  await configure("projects.project.overdue");
  await db`update projects set due_at=(now() at time zone 'America/Sao_Paulo')::date-1 where id=${X}`;
  await db`insert into projects(id,workspace_id,owner_id,assigned_to,name,status,due_at)
    values(${randomUUID()},${W},${A},${U},'Second project','planning',(now() at time zone 'America/Sao_Paulo')::date-1)`;
  expect(await tick(1)).toEqual({ status: 200, payload: { enqueued: 1 } });
  expect(await tick(1)).toEqual({ status: 200, payload: { enqueued: 1 } });
  expect(await tick(1)).toEqual({ status: 200, payload: { enqueued: 0 } });
  expect(await events()).toHaveLength(2);
  expect((await db`select count(*)::int n from project_tasks`)[0].n).toBe(1);
  expect((await db`select count(*)::int n from notifications`)[0].n).toBe(0);
  expect((await db`select count(*)::int n from workflow_deliveries`)[0].n).toBe(0);
});

it("rechecks scoped source visibility and independent restrictive RLS before executing a project rule", async () => {
  const event = await ready();
  await db`delete from job_role_permission_overrides where role_id=${ROLE} and permission_key='techprojects.projects.view.workspace'`;
  await db`insert into job_role_permission_overrides(workspace_id,role_id,permission_key,effect) values(${W},${ROLE},'techprojects.projects.view.own','grant')`;
  expect(await check(event)).toEqual({ status: 200, payload: true });
  await db`update projects set assigned_to=${A} where id=${X}`;
  expect(await check(event)).toEqual({ status: 200, payload: false });
  await db`update projects set assigned_to=${U} where id=${X}`;
  const allowed = await withRole("service_role", null, async (tx) => {
    await tx`select set_config('test.notification_hidden',${X},true)`;
    return (await tx`select notification_business_event_check(${event},${WF},1) allowed`)[0]
      .allowed;
  });
  expect(allowed).toBe(false);
});

it("retains the immutable project root across a real delay resume and rejects a legacy parent", async () => {
  const event = await ready();
  await seedRun(event);
  await expect(
    withRole(
      "service_role",
      null,
      (
        tx,
      ) => tx`insert into workflow_events(workspace_id,owner_id,entity,entity_id,event_type,before,after,resume_workflow_id,resume_cursor,workflow_version,notification_event_key,notification_parent_event_id)
    select workspace_id,${U},entity,entity_id,event_type,before,after,${WF},1,1,notification_event_key,${EVENT} from workflow_events where id=${event}`,
    ),
  ).rejects.toMatchObject({ code: "42501" });
  const [child] = await withRole(
    "service_role",
    null,
    (
      tx,
    ) => tx`insert into workflow_events(workspace_id,owner_id,entity,entity_id,event_type,before,after,resume_workflow_id,resume_cursor,workflow_version,notification_event_key,notification_parent_event_id)
    select workspace_id,${U},entity,entity_id,event_type,before,after||'{"__wf_wait":{"poll":1}}',${WF},1,1,notification_event_key,id from workflow_events where id=${event} returning id`,
  );
  expect(await check(child.id)).toEqual({ status: 200, payload: true });
  expect(
    (
      await db`select root_event_id from notification_business_event_proofs where event_id=${child.id}`
    )[0].root_event_id,
  ).toBe(event);
  await db`update projects set status='cancelled' where id=${X}`;
  expect(await check(child.id)).toEqual({ status: 200, payload: false });
});

it("revalidates project state at outbound claim and preflight and honors event email preferences", async () => {
  const event = await ready();
  await db`update workflows set actions=${db.json([0, 1].map(() => ({ type: "send_notification", title, recipients, delivery })))} where id=${WF}`;
  await withRole(
    "authenticated",
    U,
    (tx) =>
      tx`select notification_delivery_settings_save(${W},'{"email_enabled":true,"whatsapp_enabled":false,"email_daily_limit":10,"whatsapp_daily_limit":10,"wa_sender_id":null,"wa_template_name":null,"wa_template_language":null,"wa_estimated_unit_micros":0,"wa_daily_budget_micros":0,"currency":"BRL"}',0)`,
  );
  await db`insert into notification_user_preferences(workspace_id,user_id,revision,settings) values(${W},${U},1,'{"eventOverrides":{"projects.project.started":{"email":false}}}')`;
  expect(await dispatch(event, ["email"])).toMatchObject({ queued: 1 });
  const [first] =
    await db`select id from workflow_deliveries where notification_intent_id is not null`;
  const claim = (id: string) =>
    withRole(
      "service_role",
      null,
      async (tx) => (await tx`select notification_delivery_claim(${id}) result`)[0].result,
    );
  expect(await claim(first.id)).toMatchObject({
    result: "suppressed",
    reason: "preferences_disabled",
  });
  await db`update notification_user_preferences set settings='{"eventOverrides":{"projects.project.started":{"email":true}}}',revision=revision+1 where workspace_id=${W} and user_id=${U}`;
  await dispatch(event, ["email"], "1");
  const [second] =
    await db`select id from workflow_deliveries where notification_intent_id is not null and id<>${first.id}`;
  const claimed = await claim(second.id);
  expect(claimed).toMatchObject({ result: "claimed" });
  await db`update projects set status='done' where id=${X}`;
  const preflight = await withRole(
    "service_role",
    null,
    async (tx) =>
      (await tx`select notification_delivery_preflight(${second.id},${claimed.token}) result`)[0]
        .result,
  );
  expect(preflight).toMatchObject({ allowed: false, reason: "workflow_changed" });
});

it("builds canonical milestone destinations for native notices, email intents and protected center reads", async () => {
  await configure("projects.milestone.due", "project_milestones");
  await db`update workflows set actions=${db.json([0, 1].map(() => ({ type: "send_notification", title, recipients, delivery })))} where id=${WF}`;
  await db`update project_milestones set due_at=(now() at time zone 'America/Sao_Paulo')::date+5 where id=${X}`;
  expect(await tick()).toEqual({ status: 200, payload: { enqueued: 1 } });
  const [event] = await events();
  const run = await seedRun(event.id);
  const native = await withRole(
    "service_role",
    null,
    async (tx) =>
      (
        await tx`select notification_workflow_dispatch(${WF},${run},1,'project_milestones',${X},${tx.json(recipients)},${title},null,'0') result`
      )[0].result,
  );
  expect(native).toMatchObject({ sent: 1 });
  const href = `/projects/${X}?tab=milestones&milestoneId=${X}`;
  const [notice] = await db`select id,link from notifications where user_id=${U}`;
  expect(notice.link).toBe(href);
  await dispatch(event.id, ["email"], "1");
  expect(
    (
      await db`select payload_content_neutral->>'href' href from notification_delivery_intents where event_key='projects.milestone.due'`
    )[0].href,
  ).toBe(href);
  // Reads repair historical destination shape only after revalidating its source.
  await db`update notifications set link=${`/projects/tasks?milestoneId=${X}`} where id=${notice.id}`;
  expect(await request("/rpc/notification_center_list", { p_workspace: W })).toMatchObject({
    status: 200,
    payload: { items: [expect.objectContaining({ id: notice.id, link: href })] },
  });
  expect(
    await request("/rpc/notification_center_lookup", { p_workspace: W, p_ids: [notice.id] }),
  ).toMatchObject({
    status: 200,
    payload: { items: [expect.objectContaining({ id: notice.id, link: href })] },
  });
  const [privileges] =
    await db`select has_function_privilege('authenticated','techerp_api.notification_project_milestone_href(uuid,uuid)','EXECUTE') authenticated,
    has_function_privilege('service_role','techerp_api.notification_project_milestone_href(uuid,uuid)','EXECUTE') service`;
  expect(privileges).toEqual({ authenticated: false, service: false });
  await expect(
    withRole(
      "service_role",
      null,
      (tx) => tx`select techerp_api.notification_project_milestone_href(${W},${X})`,
    ),
  ).rejects.toMatchObject({ code: "42501" });
  await db`update projects set workspace_id=${B} where id=${X}`;
  expect(await check(event.id)).toEqual({ status: 200, payload: false });
  expect(
    (await db`select techerp_api.notification_project_milestone_href(${W},${X}) href`)[0].href,
  ).toBeNull();
  expect(
    await request("/rpc/notification_center_lookup", { p_workspace: W, p_ids: [notice.id] }),
  ).toMatchObject({ status: 200, payload: { items: [] } });
});

it("keeps confidential project cost out of generic and named workflow snapshots and notification payloads", async () => {
  await configure();
  await db`update projects set planned_cost=987654321 where id=${X}`;
  expect(await request(`/projects?select=id&id=eq.${X}`)).toEqual({
    status: 200,
    payload: [{ id: X }],
  });
  expect((await request(`/projects?select=id,planned_cost&id=eq.${X}`)).status).toBe(403);
  const projectCost = () =>
    request("/rpc/work_cost_projection", { r: "techprojects.projects", ids: [X] });
  expect(await projectCost()).toMatchObject({
    status: 200,
    payload: [{ id: X, planned_cost: null, financials_visible: false }],
  });
  await db`insert into job_role_permission_overrides(workspace_id,role_id,permission_key,effect)
    values(${W},${ROLE},'techprojects.rates.view.workspace','grant')`;
  expect(await projectCost()).toMatchObject({
    status: 200,
    payload: [{ id: X, planned_cost: 987654321, financials_visible: true }],
  });
  await db`delete from job_role_permission_overrides where role_id=${ROLE} and permission_key='techprojects.rates.view.workspace'`;
  // Exact generic producer/trigger used alongside the new named start producer.
  await db.unsafe(
    "CREATE TRIGGER trg_wf_events_projects AFTER INSERT OR UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.enqueue_workflow_event('projects')",
  );
  try {
    await db`update projects set status='active',planned_cost=987654322 where id=${X}`;
  } finally {
    await db.unsafe("DROP TRIGGER trg_wf_events_projects ON public.projects");
  }
  const [event] = await events();
  expect(await check(event.id)).toEqual({ status: 200, payload: true });
  const exposed = await request(
    `/workflow_events?select=notification_event_key,before,after&entity=eq.projects&entity_id=eq.${X}`,
  );
  expect(exposed).toMatchObject({ status: 200, payload: expect.any(Array) });
  expect(exposed.payload).toHaveLength(2);
  expect(exposed.payload).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        notification_event_key: "projects.project.started",
        before: expect.objectContaining({ status: "planning" }),
        after: expect.objectContaining({ status: "active" }),
      }),
      expect.objectContaining({
        notification_event_key: null,
        before: expect.objectContaining({ status: "planning" }),
        after: expect.objectContaining({ status: "active" }),
      }),
    ]),
  );
  expect(JSON.stringify(exposed.payload)).not.toContain("planned_cost");
  expect(JSON.stringify(exposed.payload)).not.toMatch(/98765432[12]/);
  await withRole(
    "authenticated",
    U,
    (tx) =>
      tx`select notification_delivery_settings_save(${W},'{"email_enabled":true,"whatsapp_enabled":false,"email_daily_limit":10,"whatsapp_daily_limit":10,"wa_sender_id":null,"wa_template_name":null,"wa_template_language":null,"wa_estimated_unit_micros":0,"wa_daily_budget_micros":0,"currency":"BRL"}',0)`,
  );
  expect(await dispatch(event.id, ["inapp", "email"])).toMatchObject({ sent: 1, queued: 1 });
  const payloads = await db`select to_jsonb(n) payload from notifications n
    union all select to_jsonb(i) from notification_delivery_intents i`;
  expect(payloads).toHaveLength(2);
  expect(JSON.stringify(payloads)).not.toContain("planned_cost");
  expect(JSON.stringify(payloads)).not.toMatch(/98765432[12]/);
});
