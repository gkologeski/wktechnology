import { beforeEach, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import {
  db,
  W,
  B,
  A,
  U,
  C,
  N,
  F,
  ROLE,
  X,
  WF,
  RUN,
  reset,
  withRole,
  request,
  fixtureJwt,
} from "../../tests/fixtures/notification-center";

type Item = {
  id: string;
  title: string;
  body: string | null;
  link: string | null;
  entity: string | null;
  entity_id: string | null;
  read_at: string | null;
  snoozed_until: string | null;
  created_at: string;
  moduleKey: string | null;
};
type Page = {
  items: Item[];
  unread: number;
  unreadCapped: boolean;
  nextCursor: { createdAt: string; id: string } | null;
  cutoff: string;
};
beforeEach(reset);
async function notice(
  options: {
    user?: string;
    ws?: string;
    entity?: string;
    source?: string;
    title?: string;
    created?: string;
    legacy?: boolean;
  } = {},
) {
  const id = randomUUID();
  const insert = async (tx: typeof db) => {
    await tx`insert into notifications(id,workspace_id,owner_id,user_id,type,title,body,link,entity,entity_id,created_at)
   values(${id},${options.ws ?? W},${A},${options.user ?? U},'workflow',${options.title ?? "Fixture notice"},'Private fixture content','/deals/test',${options.entity ?? "deals"},${options.source ?? X},${options.created ?? "2026-01-01T12:00:00Z"})`;
  };
  if (options.legacy)
    await db.begin(async (tx) => {
      await tx.unsafe("SET LOCAL session_replication_role=replica");
      await insert(tx as unknown as typeof db);
    });
  else await insert(db);
  return id;
}
async function list(
  args: {
    actor?: string;
    ws?: string;
    scope?: string;
    status?: string;
    category?: string;
    q?: string;
    cursor?: Page["nextCursor"];
    cutoff?: string;
    module?: string;
  } = {},
) {
  return withRole("authenticated", args.actor ?? U, async (tx) => {
    const rows =
      await tx`select notification_center_list(${args.ws ?? W},${args.scope ?? "workspace"},${args.status ?? "all"},${args.category ?? null},${args.q ?? ""},${args.cursor ? tx.json(args.cursor) : null},${args.cutoff ?? null},${args.module ?? null}) result`;
    return rows[0].result as Page;
  });
}
async function mark(ids: string[], cutoff: string, read = true, actor = U, ws = W) {
  return withRole(
    "authenticated",
    actor,
    async (tx) =>
      (await tx`select notification_center_mark(${ws},${ids},${cutoff},${read}) result`)[0]
        .result as { updated: number },
  );
}
async function save(patch: Record<string, unknown>, revision = 0, actor = U, ws = W) {
  return withRole(
    "authenticated",
    actor,
    async (tx) =>
      (
        await tx`select notification_center_preferences_save(${ws},${tx.json(JSON.parse(JSON.stringify(patch)))},${revision}) result`
      )[0].result as { revision: number; settings: Record<string, unknown> },
  );
}
it("notification center allows authorized source reader", async () => {
  const id = await notice();
  const p = await list();
  expect(p.items.map((n) => n.id)).toEqual([id]);
  expect(p.unread).toBe(1);
});
it("notification center rejects missing source permission", async () => {
  await notice({ user: N });
  expect((await list({ actor: N })).items).toEqual([]);
});
it("notification center rejects explicit source deny", async () => {
  await notice();
  await db`update job_role_permission_overrides set effect='deny' where role_id=${ROLE} and permission_key='techsales.deals.view.workspace'`;
  expect((await list()).items).toEqual([]);
});
it("notification center rejects foreign workspace", async () => {
  await notice();
  await expect(list({ actor: F, ws: W })).rejects.toMatchObject({ code: "42501" });
});
it("notification center rejects inactive member", async () => {
  await notice();
  await db`update workspace_members set status='inactive' where user_id=${U} and workspace_id=${W}`;
  await expect(list()).rejects.toMatchObject({ code: "42501" });
});

it.each([
  ["deals", "crm"],
  ["ats_jobs", "ats"],
  ["people", "people"],
  ["projects", "projects"],
  ["contracts", "contracts"],
  ["financial_entries", "finance"],
])(
  "reads %s only through canonical source RLS and reports its proven module",
  async (entity, module) => {
    const id = await notice({ entity });
    const p = await list({ module });
    expect(p.items.map((n) => n.id)).toEqual([id]);
    expect(p.items[0].moduleKey).toBe(module);
    expect((await list({ module: module === "crm" ? "ats" : "crm" })).items).toEqual([]);
  },
);
it("uses source RLS after delivery instead of preserving a revoked payload", async () => {
  const id = await notice();
  expect((await list()).items[0].id).toBe(id);
  await db`update job_role_permission_overrides set effect='deny' where role_id=${ROLE} and permission_key='techsales.deals.view.workspace'`;
  expect((await list()).unread).toBe(0);
  expect(await withRole("authenticated", U, (tx) => tx`select id from notifications`)).toEqual([]);
});
it("does not expose an activity notification merely because its parent deal remains visible", async () => {
  const id = await notice({ entity: "activities" });
  expect((await list()).items[0].id).toBe(id);
  await db`update job_role_permission_overrides set effect='deny' where role_id=${ROLE} and permission_key='techsales.activities.view.workspace'`;
  expect((await list()).items).toEqual([]);
  expect(
    (
      await withRole(
        "authenticated",
        U,
        (tx) => tx`select public.sales_record_access('deals',${X},'view') allowed`,
      )
    )[0].allowed,
  ).toBe(true);
  const raw = await request("/notifications?select=id,title,body");
  expect(raw.status).toBe(200);
  expect(raw.payload).toEqual([]);
});
it.each([
  ["note", "notes"],
  ["task", "tasks"],
])(
  "keeps the separate %s source permission instead of substituting activities access",
  async (type, resource) => {
    await db`update activities set type=${type} where id=${X}`;
    const id = await notice({ entity: "activities" });
    expect((await list()).items).toEqual([]);
    await grantKey(`techsales.${resource}.view.workspace`);
    expect((await list()).items[0].id).toBe(id);
    await grantKey(`techsales.${resource}.view.workspace`, "deny");
    expect((await list()).items).toEqual([]);
    expect(
      (
        await db`select effect from job_role_permission_overrides where role_id=${ROLE} and permission_key='techsales.activities.view.workspace'`
      )[0].effect,
    ).toBe("grant");
  },
);
it("keeps an additional restrictive policy active for feed, count and mutation", async () => {
  const id = await notice();
  await withRole("authenticated", U, async (tx) => {
    await tx`select set_config('test.notification_hidden',${X},true)`;
    const p = (await tx`select notification_center_list(${W}) result`)[0].result;
    expect(p.items).toEqual([]);
    expect(p.unread).toBe(0);
  });
  await expect(
    withRole("authenticated", U, async (tx) => {
      await tx`select set_config('test.notification_hidden',${X},true)`;
      return tx`select notification_center_mark(${W},${[id]},now(),true)`;
    }),
  ).rejects.toMatchObject({ code: "42501" });
});
it("keeps historical workspace values out of the selected workspace and masks their payload", async () => {
  const id = await notice({ legacy: true, title: "Old salary secret" });
  expect((await list()).items).toEqual([]);
  const p = await list({ scope: "legacy" });
  expect(p.items).toHaveLength(1);
  expect(p.items[0]).toMatchObject({
    id,
    title: "Notificação do histórico pessoal",
    link: null,
    entity: null,
    entity_id: null,
    moduleKey: null,
  });
  expect(JSON.stringify(p)).not.toContain("salary");
  expect(JSON.stringify(p)).not.toContain("Private fixture");
  expect((await list({ scope: "legacy", q: "salary" })).items).toEqual([]);
  expect((await list({ scope: "legacy", module: "crm" })).items).toEqual([]);
  expect(
    await withRole("authenticated", U, (tx) => tx`select id,title from notifications`),
  ).toEqual([]);
  expect(await mark([id], p.cutoff)).toEqual({ updated: 1 });
  expect((await db`select title from notifications where id=${id}`)[0].title).toBe(
    "Old salary secret",
  );
});
it("does not prove workspace from a fabricated source, href or owner field", async () => {
  await notice({ source: randomUUID() });
  await notice({ entity: "deals;DROP TABLE profiles" });
  expect((await list()).items).toEqual([]);
  expect((await list({ scope: "legacy" })).items).toHaveLength(2);
  expect((await db`select count(*)::integer n from notification_workspace_context`)[0].n).toBe(0);
});
it("rejects an origin in a different workspace instead of using the notification default", async () => {
  await db`update deals set workspace_id=${B} where id=${X}`;
  await notice();
  expect((await list()).items).toEqual([]);
  expect((await list({ scope: "legacy" })).items).toHaveLength(1);
});
it("isolates the same user's deliveries when their selected workspace changes", async () => {
  const first = await notice();
  await db`insert into workspace_members(workspace_id,user_id) values(${B},${U})`;
  const record = randomUUID();
  await db`insert into deals(id,workspace_id,owner_id,assigned_to) values(${record},${B},${A},${U})`;
  await db`insert into job_role_permission_overrides(workspace_id,role_id,permission_key,effect) values(${B},${ROLE},'techsales.deals.view.workspace','grant')`;
  const p = await list();
  await db`update profiles set active_workspace_id=${B} where id=${U}`;
  await expect(list({ ws: W })).rejects.toMatchObject({ code: "42501" });
  await expect(mark([first], p.cutoff, true, U, W)).rejects.toMatchObject({ code: "42501" });
  expect((await list({ ws: B })).items).toEqual([]);
});
it("paginates equal timestamps with a cutoff and no duplicate or newly arrived row", async () => {
  const ids = [];
  for (let i = 0; i < 35; i++) ids.push(await notice());
  const p = await list();
  expect(p.items).toHaveLength(30);
  expect(p.nextCursor).not.toBeNull();
  const added = await notice({ created: new Date(Date.now() + 2000).toISOString() });
  const q = await list({ cursor: p.nextCursor, cutoff: p.cutoff });
  expect(q.items).toHaveLength(5);
  expect(q.nextCursor).toBeNull();
  const all = [...p.items, ...q.items].map((n) => n.id);
  expect(new Set(all).size).toBe(35);
  expect(all).not.toContain(added);
  await expect(list({ cursor: p.nextCursor })).rejects.toMatchObject({ code: "22023" });
});
it("counts unread independently of the selected read-status filter and caps an honest 99+ badge", async () => {
  for (let i = 0; i < 105; i++) await notice();
  const p = await list({ status: "read" });
  expect(p.items).toEqual([]);
  expect(p.unread).toBe(100);
  expect(p.unreadCapped).toBe(true);
});
it("treats wildcard characters as literal search text", async () => {
  const id = await notice({ title: "Exact 100%_done" });
  await notice({ title: "Other 100anything_done" });
  expect((await list({ q: "100%_done" })).items.map((n) => n.id)).toEqual([id]);
  expect((await list({ q: "' OR true --" })).items).toEqual([]);
});
it("marks only the submitted visible ids without rewriting a prior read timestamp", async () => {
  const a = await notice(),
    b = await notice();
  const p = await list();
  expect(await mark([a], p.cutoff)).toEqual({ updated: 1 });
  const timestamp = (await db`select read_at from notifications where id=${a}`)[0].read_at;
  expect(await mark([a], p.cutoff)).toEqual({ updated: 0 });
  expect((await db`select read_at from notifications where id=${a}`)[0].read_at).toEqual(timestamp);
  expect((await db`select read_at from notifications where id=${b}`)[0].read_at).toBeNull();
  expect(await mark([a], p.cutoff, false)).toEqual({ updated: 1 });
});
it("rolls back the entire bulk mutation if any id is foreign or no longer visible", async () => {
  const own = await notice(),
    foreign = await notice({ user: C });
  const p = await list();
  await expect(mark([own, foreign], p.cutoff)).rejects.toMatchObject({ code: "42501" });
  expect((await db`select read_at from notifications where id=${own}`)[0].read_at).toBeNull();
});
it("rejects future arrivals and unbounded bulk writes", async () => {
  const p = await list();
  const fresh = await notice({ created: new Date(Date.now() + 2000).toISOString() });
  await expect(mark([fresh], p.cutoff)).rejects.toMatchObject({ code: "42501" });
  await expect(mark([], p.cutoff)).rejects.toMatchObject({ code: "22023" });
  await expect(
    mark(
      Array.from({ length: 101 }, () => randomUUID()),
      p.cutoff,
    ),
  ).rejects.toMatchObject({ code: "22023" });
});
it("snoozes a notification independently from reading or deciding the source and restores it without a scheduler", async () => {
  const id = await notice();
  const run = (minutes: number) =>
    withRole(
      "authenticated",
      U,
      (tx) => tx`select notification_center_snooze(${W},${id},${minutes}) result`,
    );
  await run(60);
  expect((await list()).items).toEqual([]);
  expect((await list()).unread).toBe(0);
  expect((await list({ status: "snoozed" })).items[0].id).toBe(id);
  expect((await db`select read_at from notifications where id=${id}`)[0].read_at).toBeNull();
  await db`update notifications set snoozed_until=now()-interval '1 minute' where id=${id}`;
  expect((await list()).items[0].id).toBe(id);
  await run(1440);
  await run(0);
  expect((await list()).items).toHaveLength(1);
  expect((await db`select status from workflow_runs where id=${RUN}`)[0].status).toBe("running");
});
it("refuses writes during a read-only view while retaining authorized reading", async () => {
  const id = await notice();
  const p = await list();
  const session = randomUUID();
  await db`insert into view_as_sessions(session_id,mode) values(${session},'role')`;
  await expect(
    withRole(
      "authenticated",
      U,
      (tx) => tx`select notification_center_mark(${W},${[id]},${p.cutoff},true)`,
      { session_id: session },
    ),
  ).rejects.toMatchObject({ code: "42501" });
  await expect(
    withRole(
      "authenticated",
      U,
      (tx) => tx`select notification_center_preferences_save(${W},'{}',0)`,
      { session_id: session },
    ),
  ).rejects.toMatchObject({ code: "42501" });
});

it("keeps preferences personal per workspace without requiring business permissions", async () => {
  expect(await save({ summary: "daily" }, 0, N)).toMatchObject({
    revision: 1,
    settings: { summary: "daily" },
  });
  const own = await withRole(
    "authenticated",
    U,
    (tx) => tx`select notification_center_preferences(${W}) result`,
  );
  expect(own[0].result).toMatchObject({ settings: {}, revision: 0 });
  await expect(save({ summary: "weekly" }, 0, F, W)).rejects.toMatchObject({ code: "42501" });
  await db`update workspace_members set status='inactive' where user_id=${N} and workspace_id=${W}`;
  await expect(save({ summary: "none" }, 1, N)).rejects.toMatchObject({ code: "42501" });
});
it("uses compare and swap for the first save and rejects stale concurrent revisions", async () => {
  const results = await Promise.allSettled([
    save({ summary: "daily" }),
    save({ summary: "weekly" }),
  ]);
  expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  expect(results.filter((r) => r.status === "rejected")).toHaveLength(1);
  expect(
    (
      await db`select revision from notification_user_preferences where workspace_id=${W} and user_id=${U}`
    )[0].revision,
  ).toBe(1);
  await expect(save({ summary: "none" }, 0)).rejects.toMatchObject({ code: "PT409" });
});
it("patches preferences without overwriting other groups or trusted future fields and supports inheritance resets", async () => {
  await db`insert into notification_user_preferences(workspace_id,user_id,revision,settings) values(${W},${U},1,${db.json({ future: { keep: 1 }, categories: { workflow: { inapp: false, futureChannel: 7 }, mention: { sound: false } }, quiet: { futureQuiet: "keep", enabled: false, timezone: "UTC", start: "22:00", end: "08:00" } })})`;
  const p = await save(
    {
      categories: { workflow: { inapp: null, email: true }, mention: null },
      eventOverrides: { "legacy.workflow": { inapp: false } },
      quiet: { enabled: false, timezone: "America/Sao_Paulo", start: "21:00", end: "07:00" },
    },
    1,
  );
  expect(p.settings).toMatchObject({
    future: { keep: 1 },
    categories: { workflow: { email: true, futureChannel: 7 } },
    quiet: { futureQuiet: "keep", start: "21:00" },
  });
  expect((p.settings.categories as Record<string, unknown>).mention).toBeUndefined();
  const reset = await save(
    { categories: { workflow: null }, eventOverrides: { "legacy.workflow": null } },
    2,
  );
  expect(reset.settings.categories).toEqual({});
  expect(reset.settings.eventOverrides).toEqual({});
});
it.each([
  { recipients: [U] },
  { categories: { unknown: { inapp: true } } },
  { eventOverrides: { "finance.payable.due": { inapp: true } } },
  { eventOverrides: { "legacy.workflow": { whatsapp: true } } },
  { categories: { workflow: { inapp: "true" } } },
  { summary: "hourly" },
  { quiet: { enabled: true, timezone: "UTC", start: "08:00", end: "08:00" } },
  { quiet: { enabled: false, timezone: "EST", start: "22:00", end: "08:00" } },
  { quiet: { enabled: false, timezone: "America/Sao_Paulo", start: "24:00", end: "08:00" } },
  { quiet: { enabled: false, timezone: "Invalid/Zone", start: "22:00", end: "08:00" } },
])("rejects invalid or future incoming preference patch %j", async (patch) => {
  await expect(save(patch)).rejects.toMatchObject({ code: "22023" });
  expect((await db`select count(*)::integer n from notification_user_preferences`)[0].n).toBe(0);
});
it("accepts inheritance restoration and a disabled equal-time quiet period", async () => {
  await save({
    categories: { workflow: { inapp: false } },
    eventOverrides: { "legacy.workflow": { sound: false } },
  });
  const p = await save(
    {
      categories: { workflow: { inapp: null } },
      eventOverrides: { "legacy.workflow": { sound: null } },
      quiet: { enabled: false, timezone: "UTC", start: "08:00", end: "08:00" },
    },
    1,
  );
  expect(p.settings.categories).toEqual({});
  expect(p.settings.eventOverrides).toEqual({});
});
async function inapp(event = "legacy.workflow") {
  return withRole(
    "service_role",
    null,
    async (tx) =>
      (await tx`select notification_event_inapp(${W},${U},${event}) allowed`)[0].allowed as boolean,
  );
}
it("applies category then event preferences without enabling another workspace's channel", async () => {
  expect(await inapp()).toBe(true);
  await save({ categories: { workflow: { inapp: false } } });
  expect(await inapp()).toBe(false);
  await save({ eventOverrides: { "legacy.workflow": { inapp: true } } }, 1);
  expect(await inapp()).toBe(true);
  await save({ eventOverrides: { "legacy.workflow": null } }, 2);
  expect(await inapp()).toBe(false);
  await save({ categories: { workflow: null } }, 3);
  expect(await inapp()).toBe(true);
  expect(await inapp("finance.payable.due")).toBe(false);
});
it.each([
  { categories: [] },
  { categories: { workflow: "invalid" } },
  { eventOverrides: { "legacy.workflow": null } },
  { quiet: { enabled: false, timezone: "Invalid/Zone", start: "22:00", end: "08:00" } },
])(
  "fails closed for malformed stored overlay %j even if an event claims true",
  async (settings) => {
    await db`insert into notification_user_preferences(workspace_id,user_id,revision,settings) values(${W},${U},1,${db.json(settings)})`;
    expect(await inapp()).toBe(false);
  },
);
it("applies the overlay before workflow insert and preserves the original delivery counters", async () => {
  await save({ eventOverrides: { "legacy.workflow": { inapp: false } } });
  const result = await withRole(
    "service_role",
    null,
    async (tx) =>
      (
        await tx`select notification_workflow_dispatch(${WF},${RUN},1,'deals',${X},${tx.json([{ kind: "user", id: U }])},'Fixture notice','Open the origin','0') result`
      )[0].result,
  );
  expect(result).toMatchObject({ sent: 0, excluded: 1, issues: ["preferences_disabled"] });
  expect((await db`select count(*)::integer n from notifications`)[0].n).toBe(0);
});
it("restores original claims after visibility and after a policy error", async () => {
  await notice();
  await withRole("authenticated", U, async (tx) => {
    const claims = (await tx`select current_setting('request.jwt.claims') value`)[0].value;
    await tx`select notification_center_list(${W})`;
    expect((await tx`select current_setting('request.jwt.claims') value`)[0].value).toBe(claims);
    await tx`select set_config('test.notification_throw','on',true)`;
    await expect(tx.savepoint((sub) => sub`select notification_center_list(${W})`)).rejects.toThrow(
      "notification fixture policy failure",
    );
    expect((await tx`select current_setting('request.jwt.claims') value`)[0].value).toBe(claims);
  });
  expect((await db`select count(*)::integer n from techerp_api.subject_sessions`)[0].n).toBe(0);
});
it("allows the real HTTP JWT endpoint while rejecting tampered signatures", async () => {
  const id = await notice();
  const allowed = await request("/rpc/notification_center_list", { p_workspace: W });
  expect(allowed.status).toBe(200);
  expect(allowed.payload.items[0].id).toBe(id);
  const denied = await request(
    "/rpc/notification_center_list",
    { p_workspace: W },
    U,
    fixtureJwt("authenticated", U, "a".repeat(96)),
  );
  expect(denied.status).toBe(401);
});
it.each([
  ["missing", N],
  ["foreign", F],
  ["inactive", U],
  ["deny", U],
])("honors the %s boundary over real signed HTTP", async (kind, actor) => {
  await notice({ user: actor });
  if (kind === "inactive")
    await db`update workspace_members set status='inactive' where user_id=${U} and workspace_id=${W}`;
  if (kind === "deny")
    await db`update job_role_permission_overrides set effect='deny' where role_id=${ROLE} and permission_key='techsales.deals.view.workspace'`;
  const result = await request("/rpc/notification_center_list", { p_workspace: W }, actor);
  if (kind === "foreign" || kind === "inactive") expect(result.status).toBe(403);
  else {
    expect(result.status).toBe(200);
    expect(result.payload.items).toEqual([]);
  }
});
it("hides history through the raw Data API and exposes only the new authorized payload", async () => {
  await notice({ legacy: true, title: "Historical secret" });
  const id = await notice();
  const result = await request("/notifications?select=id,title");
  expect(result.status).toBe(200);
  expect(result.payload).toEqual([{ id, title: "Fixture notice" }]);
});
it("rejects direct payload edits, deletions, provenance changes and impersonation of another preference owner", async () => {
  const id = await notice();
  for (const query of [
    `update notifications set workspace_id='${B}' where id='${id}'`,
    `update notifications set read_at=now() where id='${id}'`,
    `delete from notifications where id='${id}'`,
    `insert into notification_workspace_context(notification_id,workspace_id,source_table,source_id) values('${id}','${B}','deals','${X}')`,
    `select * from notification_user_preferences`,
  ])
    await expect(withRole("authenticated", U, (tx) => tx.unsafe(query))).rejects.toMatchObject({
      code: "42501",
    });
  const result = await request("/rpc/notification_center_preferences", {
    p_workspace: W,
    p_user: C,
  });
  expect(result.status).not.toBe(200);
});
it("keeps service-only overlay and private subject bridges inaccessible to authenticated HTTP callers", async () => {
  const result = await request("/rpc/notification_event_inapp", {
    p_workspace: W,
    p_user: U,
    p_event: "legacy.workflow",
  });
  expect(result.status).toBe(403);
  const privateResult = await request("/rpc/notification_center_source_visible", {
    p_ws: W,
    p_user: U,
    p_table: "deals",
    p_id: X,
  });
  expect(privateResult.status).not.toBe(200);
  const own = (
    await withRole(
      "authenticated",
      U,
      (tx) => tx`select notification_center_visible(${randomUUID()}) allowed`,
    )
  )[0].allowed;
  expect(own).toBe(false);
});

it("captures a new Inbox source by its actual unique record rather than the href", async () => {
  const source = randomUUID();
  await db`insert into whatsapp_conversations(id,workspace_id,owner_id,assigned_to) values(${source},${W},${A},${U})`;
  await db`insert into job_role_permission_overrides(workspace_id,role_id,permission_key,effect) values(${W},${ROLE},'techsales.inbox.whatsapp.view.workspace','grant')`;
  const id = await notice({ entity: "inbox_conversation", source });
  expect((await list()).items[0]).toMatchObject({ id, moduleKey: "crm" });
  await db`insert into email_threads(id,workspace_id,owner_id,assigned_to) values(${source},${W},${A},${U})`;
  const ambiguous = await notice({ entity: "inbox_conversation", source });
  expect((await list()).items.map((n) => n.id)).not.toContain(ambiguous);
  expect((await list({ scope: "legacy" })).items.map((n) => n.id)).toContain(ambiguous);
});
it("uses the canonical hiring request read predicate for a supplier request without inventing its module", async () => {
  const source = randomUUID();
  await db`insert into hiring_preparation_requests(id,workspace_id,kind,owner_id) values(${source},${W},'supplier',${A})`;
  const id = await notice({ entity: "hiring_preparation_request", source });
  expect((await list()).items).toEqual([]);
  await db`insert into job_role_permission_overrides(workspace_id,role_id,permission_key,effect) values(${W},${ROLE},'techcontracts.supplier_requests.view.workspace','grant')`;
  expect((await list()).items[0]).toMatchObject({ id, moduleKey: null });
  await db`update job_role_permission_overrides set effect='deny' where role_id=${ROLE} and permission_key='techcontracts.supplier_requests.view.workspace'`;
  expect((await list()).items).toEqual([]);
});
it("performs the source read without writes inside a real read-only transaction", async () => {
  await notice();
  await db.begin("read only", async (tx) => {
    await tx.unsafe("SET LOCAL ROLE authenticated");
    await tx`select set_config('request.jwt.claims',${JSON.stringify({ role: "authenticated", sub: U })},true)`;
    const p = (await tx`select notification_center_list(${W}) result`)[0].result;
    expect(p.items).toHaveLength(1);
  });
});
it("serializes overlapping reader mutations and keeps the first read timestamp", async () => {
  const id = await notice();
  const p = await list();
  const result = await Promise.all([mark([id], p.cutoff), mark([id], p.cutoff)]);
  expect(result.map((r) => r.updated).sort()).toEqual([0, 1]);
});
it("executes bounded read and snooze mutations over signed HTTP without deciding the business record", async () => {
  const id = await notice();
  const feed = await request("/rpc/notification_center_list", { p_workspace: W });
  const read = await request("/rpc/notification_center_mark", {
    p_workspace: W,
    p_ids: [id],
    p_cutoff: feed.payload.cutoff,
    p_read: true,
  });
  expect(read.status).toBe(200);
  expect(read.payload.updated).toBe(1);
  const snooze = await request("/rpc/notification_center_snooze", {
    p_workspace: W,
    p_id: id,
    p_minutes: 60,
  });
  expect(snooze.status).toBe(200);
  expect(
    (await request("/rpc/notification_center_list", { p_workspace: W })).payload.items,
  ).toEqual([]);
  expect((await db`select status from workflow_runs where id=${RUN}`)[0].status).toBe("running");
});
it("returns a concurrent preference save failure over HTTP instead of falsely confirming success", async () => {
  const body = { p_workspace: W, p_patch: { summary: "daily" }, p_revision: 0 };
  expect((await request("/rpc/notification_center_preferences_save", body)).status).toBe(200);
  const conflict = await request("/rpc/notification_center_preferences_save", body);
  expect(conflict.status).toBe(409);
  expect(conflict.payload.code).toBe("PT409");
  const current = await request("/rpc/notification_center_preferences", { p_workspace: W });
  expect(current.status).toBe(200);
  expect(current.payload.revision).toBe(1);
});
it.each(["anon", "service_role"] as const)(
  "rejects a %s HTTP caller for personal feed RPCs",
  async (role) => {
    expect(
      (await request("/rpc/notification_center_list", { p_workspace: W }, U, fixtureJwt(role)))
        .status,
    ).not.toBe(200);
  },
);

async function grantKey(key: string, effect = "grant") {
  await db`insert into job_role_permission_overrides(workspace_id,role_id,permission_key,effect) values(${W},${ROLE},${key},${effect}) on conflict(workspace_id,role_id,permission_key) do update set effect=excluded.effect`;
}
it("keeps the existing singular ats_job notification in its proven ATS source", async () => {
  const id = await notice({ entity: "ats_job" });
  expect((await list({ module: "ats" })).items[0]).toMatchObject({ id, moduleKey: "ats" });
  await grantKey("techhire.jobs.view.workspace", "deny");
  expect((await list()).items).toEqual([]);
  expect((await list({ scope: "legacy" })).items).toEqual([]);
});
it("preserves a legal draft approver's canonical named-approver read without substituting contract access", async () => {
  const source = randomUUID();
  await db`insert into contract_drafts(id,workspace_id) values(${source},${W})`;
  const id = await notice({ entity: "contract_drafts", source });
  expect((await list()).items).toEqual([]);
  await grantKey("techcontracts.contract_drafts.approve.workspace");
  expect((await list()).items).toEqual([]);
  await db`insert into contract_draft_approvers(workspace_id,user_id) values(${W},${U})`;
  expect((await list({ module: "contracts" })).items[0]).toMatchObject({
    id,
    moduleKey: "contracts",
  });
  await grantKey("techcontracts.contract_drafts.approve.workspace", "deny");
  expect((await list()).items).toEqual([]);
  expect(
    (
      await withRole(
        "authenticated",
        U,
        (tx) => tx`select work_record_access('techcontracts.contracts',${X},'view') allowed`,
      )
    )[0].allowed,
  ).toBe(true);
});
it("retains the sensitive hiring-origin restriction on legal draft reads", async () => {
  const source = randomUUID(),
    origin = randomUUID();
  await db`insert into hiring_preparation_requests(id,workspace_id,kind,owner_id) values(${origin},${W},'supplier',${A})`;
  await db`insert into contract_drafts(id,workspace_id,hiring_request_origin) values(${source},${W},${origin})`;
  await notice({ entity: "contract_drafts", source });
  await grantKey("techcontracts.contract_drafts.view.workspace");
  expect((await list()).items).toEqual([]);
  await grantKey("techcontracts.supplier_requests.view.workspace");
  expect((await list()).items).toEqual([]);
  await grantKey("techcontracts.supplier_requests.reference.view.workspace");
  expect((await list()).items).toHaveLength(1);
  await grantKey("techcontracts.supplier_requests.reference.view.workspace", "deny");
  expect((await list()).items).toEqual([]);
});
it("preserves both enrollment and conversation reads for service-agent review notifications", async () => {
  const source = randomUUID(),
    playbook = randomUUID(),
    enrollment = randomUUID(),
    session = randomUUID();
  await db`insert into email_threads(id,workspace_id,owner_id,assigned_to) values(${source},${W},${U},${U})`;
  await db`insert into sdr_playbooks(id,workspace_id,owner_id,enabled) values(${playbook},${W},${U},true)`;
  await db`insert into sdr_enrollments(id,workspace_id,owner_id,playbook_id) values(${enrollment},${W},${U},${playbook})`;
  await db`insert into service_agent_sessions(id,workspace_id,channel,source_id,enrollment_id) values(${session},${W},'email',${source},${enrollment})`;
  const id = await notice({ entity: "service_agent_session", source: session });
  expect((await list()).items).toEqual([]);
  await grantKey("techsales.marketing.sdr_agent.view.workspace");
  await grantKey("techsales.inbox.email.view.workspace");
  expect((await list({ module: "crm" })).items[0]).toMatchObject({ id, moduleKey: "crm" });
  await grantKey("techsales.inbox.email.view.workspace", "deny");
  expect((await list()).items).toEqual([]);
  await grantKey("techsales.inbox.email.view.workspace");
  await grantKey("techsales.marketing.sdr_agent.view.workspace", "deny");
  expect((await list()).items).toEqual([]);
});
