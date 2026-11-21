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
  reset,
  withRole,
  request,
  fixtureJwt,
} from "../../tests/fixtures/notification-center-live";

type Item = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  entity: string | null;
  entity_id: string | null;
  moduleKey: string | null;
  created_at: string;
  read_at: string | null;
  snoozed_until: string | null;
};
type Badge = { unread: number; unreadCapped: boolean; checkedAt: string };
type Lookup = { items: Item[]; checkedAt: string };
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
    source?: string;
    entity?: string;
    created?: string;
    legacy?: boolean;
    title?: string;
    type?: string;
  } = {},
) {
  const id = randomUUID();
  const insert = async (tx: typeof db) => {
    await tx`insert into notifications(id,workspace_id,owner_id,user_id,type,title,body,link,entity,entity_id,created_at) values(${id},${options.ws ?? W},${A},${options.user ?? U},${options.type ?? "workflow"},${options.title ?? "Authorized fixture notice"},'Fixture details','/deals/test',${options.entity ?? "deals"},${options.source ?? X},${options.created ?? "2026-01-01T12:00:00Z"})`;
  };
  if (options.legacy)
    await db.begin(async (tx) => {
      await tx.unsafe("SET LOCAL session_replication_role=replica");
      await insert(tx as unknown as typeof db);
    });
  else await insert(db);
  return id;
}
const badge = (actor = U, ws = W) =>
  withRole(
    "authenticated",
    actor,
    async (tx) => (await tx`select notification_center_badge(${ws}) r`)[0].r as Badge,
  );
const lookup = (ids: string[], actor = U, ws = W) =>
  withRole(
    "authenticated",
    actor,
    async (tx) => (await tx`select notification_center_lookup(${ws},${ids}) r`)[0].r as Lookup,
  );
const list = (
  input: {
    scope?: string;
    status?: string;
    category?: string;
    q?: string;
    cursor?: Page["nextCursor"];
    cutoff?: string;
    module?: string;
  } = {},
) =>
  withRole(
    "authenticated",
    U,
    async (tx) =>
      (
        await tx`select notification_center_list(${W},${input.scope ?? "workspace"},${input.status ?? "all"},${input.category ?? null},${input.q ?? ""},${input.cursor ? tx.json(input.cursor) : null},${input.cutoff ?? null},${input.module ?? null}) r`
      )[0].r as Page,
  );
async function grant(key: string, effect = "grant") {
  await db`insert into job_role_permission_overrides(workspace_id,role_id,permission_key,effect) values(${W},${ROLE},${key},${effect}) on conflict(workspace_id,role_id,permission_key) do update set effect=excluded.effect`;
}

it("notification center live allows authorized reader", async () => {
  const id = await notice();
  const b = await badge();
  const result = await lookup([id]);
  expect(b).toMatchObject({ unread: 1, unreadCapped: false });
  expect(Number.isFinite(Date.parse(b.checkedAt))).toBe(true);
  expect(result.items.map((item) => item.id)).toEqual([id]);
  expect(Number.isFinite(Date.parse(result.checkedAt))).toBe(true);
  expect(result.items[0]).toMatchObject({
    moduleKey: "crm",
    title: "Authorized fixture notice",
    read_at: null,
    snoozed_until: null,
  });
});
it("notification center live rejects missing permission", async () => {
  const id = await notice({ user: N });
  expect(await badge(N)).toMatchObject({ unread: 0 });
  expect((await lookup([id], N)).items).toEqual([]);
});
it("notification center live rejects explicit deny", async () => {
  const id = await notice();
  await grant("techsales.deals.view.workspace", "deny");
  expect((await badge()).unread).toBe(0);
  expect((await lookup([id])).items).toEqual([]);
});
it("notification center live rejects foreign workspace", async () => {
  const id = await notice();
  await expect(badge(F, W)).rejects.toMatchObject({ code: "42501" });
  await expect(lookup([id], F, W)).rejects.toMatchObject({ code: "42501" });
  await expect(badge(U, B)).rejects.toMatchObject({ code: "42501" });
});
it("notification center live rejects inactive member", async () => {
  const id = await notice();
  await db`update workspace_members set status='inactive' where workspace_id=${W} and user_id=${U}`;
  await expect(badge()).rejects.toMatchObject({ code: "42501" });
  await expect(lookup([id])).rejects.toMatchObject({ code: "42501" });
});
it("returns only the badge projection without fetching notice payload or identity", async () => {
  await notice({ title: "PRIVATE" });
  const result = await badge();
  expect(Object.keys(result).sort()).toEqual(["checkedAt", "unread", "unreadCapped"]);
  expect(JSON.stringify(result)).not.toContain("PRIVATE");
});
it("does not disclose another recipient, nonexistent ID or unproven historical notice", async () => {
  const own = await notice(),
    other = await notice({ user: C }),
    old = await notice({ legacy: true, title: "Historical private snapshot" }),
    missing = randomUUID();
  const result = await lookup([own, other, old, missing]);
  expect(result.items.map((item) => item.id)).toEqual([own]);
  expect(JSON.stringify(result)).not.toContain("Historical");
  expect((await badge()).unread).toBe(1);
});
it("excludes a fabricated source and a mismatched notification workspace from both live surfaces", async () => {
  const fabricated = await notice({ source: randomUUID() }),
    mismatched = await notice({ ws: B });
  expect((await badge()).unread).toBe(0);
  expect((await lookup([fabricated, mismatched])).items).toEqual([]);
});
it("revalidates source access after a notice has already been returned", async () => {
  const id = await notice();
  expect((await lookup([id])).items).toHaveLength(1);
  await grant("techsales.deals.view.workspace", "deny");
  expect((await lookup([id])).items).toEqual([]);
  expect((await badge()).unread).toBe(0);
});
it("preserves additional source restrictions for badge, lookup, list and read mutation", async () => {
  const id = await notice();
  await db.unsafe(
    `CREATE POLICY p5_extra_source_deny ON deals AS RESTRICTIVE FOR SELECT TO authenticated USING(false)`,
  );
  try {
    expect((await badge()).unread).toBe(0);
    expect((await lookup([id])).items).toEqual([]);
    expect((await list()).items).toEqual([]);
    await expect(
      withRole(
        "authenticated",
        U,
        (tx) => tx`select notification_center_mark(${W},${[id]},statement_timestamp(),true)`,
      ),
    ).rejects.toMatchObject({ code: "42501" });
  } finally {
    await db.unsafe("DROP POLICY p5_extra_source_deny ON deals");
  }
});
it("includes current read and snooze states in exact lookup while the badge counts only available unread", async () => {
  const fresh = await notice(),
    read = await notice(),
    snoozed = await notice(),
    expired = await notice();
  await db`update notifications set read_at=now() where id=${read}`;
  await db`update notifications set snoozed_until=now()+interval '1 hour' where id=${snoozed}`;
  await db`update notifications set snoozed_until=now()-interval '1 minute' where id=${expired}`;
  expect((await badge()).unread).toBe(2);
  const result = await lookup([fresh, read, snoozed, expired]);
  expect(result.items).toHaveLength(4);
  expect(result.items.find((item) => item.id === read)?.read_at).not.toBeNull();
  expect(result.items.find((item) => item.id === snoozed)?.snoozed_until).not.toBeNull();
});
it("returns an older exact notice even when it is beyond the first page", async () => {
  const older = await notice({ created: "2025-01-01T12:00:00Z" });
  for (let n = 0; n < 31; n++) await notice({ created: "2026-01-01T12:00:00Z" });
  expect((await list()).items.map((item) => item.id)).not.toContain(older);
  expect((await lookup([older])).items.map((item) => item.id)).toEqual([older]);
});
it("provides a checked instant that allows marking a new notice beyond an older page cutoff", async () => {
  const first = await notice();
  const page = await list();
  await db`select pg_sleep(0.005)`;
  const fresh = await notice();
  await db`update notifications set created_at=clock_timestamp() where id=${fresh}`;
  await expect(
    withRole(
      "authenticated",
      U,
      (tx) => tx`select notification_center_mark(${W},${[fresh]},${page.cutoff},true)`,
    ),
  ).rejects.toMatchObject({ code: "42501" });
  const checked = await lookup([fresh]);
  expect(checked.items.map((item) => item.id)).toEqual([fresh]);
  const marked = await withRole(
    "authenticated",
    U,
    async (tx) =>
      (await tx`select notification_center_mark(${W},${[fresh]},${checked.checkedAt},true) r`)[0].r,
  );
  expect(marked).toEqual({ updated: 1 });
  expect((await lookup([first])).items[0].read_at).toBeNull();
});
it("does not preview future-dated notices before they become visible in the feed", async () => {
  const id = await notice({ created: "2999-01-01T12:00:00Z" });
  expect((await badge()).unread).toBe(0);
  expect((await lookup([id])).items).toEqual([]);
  expect((await list()).items).toEqual([]);
});
it("caps the badge at an honest 99+ independently from paginated items", async () => {
  await db`insert into notifications(workspace_id,owner_id,user_id,type,title,entity,entity_id,created_at) select ${W},${A},${U},'workflow','Fixture','deals',${X},'2026-01-01T12:00:00Z'::timestamptz from generate_series(1,105)`;
  expect(await badge()).toMatchObject({ unread: 100, unreadCapped: true });
  const p = await list({ status: "read" });
  expect(p.items).toEqual([]);
  expect(p.unread).toBe(100);
});
it("deduplicates exact IDs and uses the same stable descending order as the feed", async () => {
  const ids = [];
  for (let n = 0; n < 4; n++) ids.push(await notice());
  const looked = (await lookup([...ids, ids[0]])).items.map((item) => item.id);
  expect(looked).toEqual((await list()).items.map((item) => item.id));
  expect(looked).toHaveLength(4);
});
it("rejects null, empty, oversized, null-element and multidimensional arrays without source lookup", async () => {
  const values = [
    null,
    [],
    Array.from({ length: 31 }, () => randomUUID()),
    [null],
    [[randomUUID()]],
  ];
  for (const value of values)
    await expect(
      withRole(
        "authenticated",
        U,
        (tx) => tx`select notification_center_lookup(${W},${value as string[]})`,
      ),
    ).rejects.toMatchObject({ code: "22023" });
});
it("allows thirty exact IDs and never modifies their read or snooze state", async () => {
  const ids = [];
  for (let n = 0; n < 30; n++) ids.push(await notice());
  const result = await lookup(ids);
  expect(result.items).toHaveLength(30);
  expect(result.items.every((item) => item.read_at === null && item.snoozed_until === null)).toBe(
    true,
  );
  expect((await badge()).unread).toBe(30);
});
it("supports actual read-only transactions for badge and lookup without subject-session writes", async () => {
  const id = await notice();
  await db.begin("read only", async (tx) => {
    await tx.unsafe("SET LOCAL ROLE authenticated");
    await tx`select set_config('request.jwt.claims',${JSON.stringify({ role: "authenticated", sub: U })},true)`;
    expect((await tx`select notification_center_badge(${W}) r`)[0].r.unread).toBe(1);
    expect((await tx`select notification_center_lookup(${W},${[id]}) r`)[0].r.items).toHaveLength(
      1,
    );
  });
  expect((await db`select count(*)::integer n from techerp_api.subject_sessions`)[0].n).toBe(0);
});
it("permits read-only role view to inspect notices while existing read and snooze writes remain denied", async () => {
  const id = await notice(),
    session = randomUUID();
  await db`insert into view_as_sessions(session_id,mode) values(${session},'role')`;
  await withRole(
    "authenticated",
    U,
    async (tx) => {
      expect((await tx`select notification_center_badge(${W}) r`)[0].r.unread).toBe(1);
      expect((await tx`select notification_center_lookup(${W},${[id]}) r`)[0].r.items).toHaveLength(
        1,
      );
    },
    { session_id: session },
  );
  await expect(
    withRole(
      "authenticated",
      U,
      (tx) => tx`select notification_center_mark(${W},${[id]},statement_timestamp(),true)`,
      { session_id: session },
    ),
  ).rejects.toMatchObject({ code: "42501" });
  await expect(
    withRole("authenticated", U, (tx) => tx`select notification_center_snooze(${W},${id},60)`, {
      session_id: session,
    }),
  ).rejects.toMatchObject({ code: "42501" });
});
it.each([
  ["deals", "crm"],
  ["ats_jobs", "ats"],
  ["people", "people"],
  ["projects", "projects"],
  ["contracts", "contracts"],
  ["financial_entries", "finance"],
])("preserves canonical %s source access and module projection", async (entity, module) => {
  const id = await notice({ entity });
  expect((await lookup([id])).items[0]).toMatchObject({ id, moduleKey: module });
  expect((await list({ module })).items[0].id).toBe(id);
  expect((await badge()).unread).toBe(1);
});
it("classifies professional and supplier requests by their real kind after source authorization", async () => {
  const professional = randomUUID(),
    supplier = randomUUID();
  await db`insert into hiring_preparation_requests(id,workspace_id,kind,owner_id) values(${professional},${W},'professional',${A}),(${supplier},${W},'supplier',${A})`;
  const p = await notice({
      entity: "hiring_preparation_request",
      source: professional,
      title: "Contract supplier misleading text",
    }),
    s = await notice({
      entity: "hiring_preparation_request",
      source: supplier,
      title: "People employee misleading text",
    });
  expect((await lookup([p, s])).items).toEqual([]);
  await grant("techpeople.hiring_requests.view.workspace");
  expect((await list({ module: "people" })).items.map((item) => item.id)).toEqual([p]);
  expect((await list({ module: "contracts" })).items).toEqual([]);
  await grant("techcontracts.supplier_requests.view.workspace");
  expect((await list({ module: "contracts" })).items.map((item) => item.id)).toEqual([s]);
  expect((await lookup([p, s])).items.map((item) => item.moduleKey).sort()).toEqual([
    "contracts",
    "people",
  ]);
  await grant("techpeople.hiring_requests.view.workspace", "deny");
  expect((await list({ module: "people" })).items).toEqual([]);
  expect((await lookup([p, s])).items.map((item) => item.id)).toEqual([s]);
});
it("does not reveal a hiring request kind after deny, workspace move or source deletion", async () => {
  const source = randomUUID();
  await db`insert into hiring_preparation_requests(id,workspace_id,kind,owner_id) values(${source},${W},'supplier',${A})`;
  const id = await notice({ entity: "hiring_preparation_request", source });
  await grant("techcontracts.supplier_requests.view.workspace");
  expect((await lookup([id])).items[0].moduleKey).toBe("contracts");
  await db`update hiring_preparation_requests set workspace_id=${B} where id=${source}`;
  expect((await lookup([id])).items).toEqual([]);
  expect((await list({ module: "contracts" })).items).toEqual([]);
  expect((await badge()).unread).toBe(0);
  await db`delete from hiring_preparation_requests where id=${source}`;
  expect((await lookup([id])).items).toEqual([]);
});
it("preserves historical neutral payload, category filter, literal search, page cutoff and snooze semantics", async () => {
  const old = await notice({ legacy: true, title: "Historical salary" });
  expect((await list({ scope: "legacy" })).items[0]).toMatchObject({
    id: old,
    moduleKey: null,
    title: "Notificação do histórico pessoal",
    link: null,
    entity: null,
    entity_id: null,
  });
  expect((await list({ scope: "legacy", q: "salary" })).items).toEqual([]);
  const literal = await notice({ title: "100%_ literal", created: "2026-01-01T12:00:00Z" });
  await notice({ title: "Other", created: "2026-01-02T12:00:00Z", type: "mention" });
  expect((await list({ q: "%_" })).items.map((item) => item.id)).toEqual([literal]);
  expect((await list({ category: "mention" })).items).toHaveLength(1);
  await withRole(
    "authenticated",
    U,
    (tx) => tx`select notification_center_snooze(${W},${literal},60)`,
  );
  expect((await list({ status: "snoozed" })).items.map((item) => item.id)).toEqual([literal]);
  expect((await lookup([literal])).items).toHaveLength(1);
  expect((await badge()).unread).toBe(1);
});
it("keeps equal-timestamp pagination stable across the module-aware list replacement", async () => {
  for (let n = 0; n < 33; n++) await notice();
  const first = await list();
  expect(first.items).toHaveLength(30);
  expect(first.nextCursor).not.toBeNull();
  const second = await list({ cursor: first.nextCursor, cutoff: first.cutoff });
  expect(second.items).toHaveLength(3);
  expect(new Set([...first.items, ...second.items].map((item) => item.id)).size).toBe(33);
  await expect(list({ cursor: first.nextCursor })).rejects.toMatchObject({ code: "22023" });
});
it("supports authenticated GET and POST over real PostgREST JWT without weakening source access", async () => {
  const id = await notice();
  const b = await request(`/rpc/notification_center_badge?p_workspace=${W}`);
  expect(b.status).toBe(200);
  expect(b.payload.unread).toBe(1);
  const result = await request("/rpc/notification_center_lookup", { p_workspace: W, p_ids: [id] });
  expect(result.status).toBe(200);
  expect(result.payload.items[0].id).toBe(id);
  await grant("techsales.deals.view.workspace", "deny");
  expect((await request("/rpc/notification_center_badge", { p_workspace: W })).payload.unread).toBe(
    0,
  );
  expect(
    (await request("/rpc/notification_center_lookup", { p_workspace: W, p_ids: [id] })).payload
      .items,
  ).toEqual([]);
});
it("keeps foreign, missing-source and private helper HTTP calls from becoming existence oracles", async () => {
  const id = await notice(),
    ownForN = await notice({ user: N });
  expect(
    (
      await request("/rpc/notification_center_lookup", {
        p_workspace: W,
        p_ids: [ownForN, randomUUID()],
      })
    ).payload.items,
  ).toEqual([]);
  expect((await request("/rpc/notification_center_badge", { p_workspace: B })).status).toBe(403);
  expect(
    (await request("/rpc/notification_center_lookup", { p_workspace: W, p_ids: [id] }, F)).status,
  ).toBe(403);
  expect(
    (
      await request("/rpc/notification_center_source_module", {
        p_workspace: W,
        p_user: U,
        p_table: "deals",
        p_id: X,
      })
    ).status,
  ).not.toBe(200);
});
it.each(["anon", "service_role"] as const)(
  "does not grant live personal RPCs to %s",
  async (role) => {
    for (const [path, body] of [
      ["notification_center_badge", { p_workspace: W }],
      ["notification_center_lookup", { p_workspace: W, p_ids: [randomUUID()] }],
    ] as const) {
      const response = await request("/rpc/" + path, body, U, fixtureJwt(role));
      expect(response.status).not.toBe(200);
    }
  },
);
it("rejects invalid JWT and malformed array boundaries over HTTP", async () => {
  expect(
    (
      await request(
        "/rpc/notification_center_badge",
        { p_workspace: W },
        U,
        fixtureJwt("authenticated", U, "incorrect-signing-secret"),
      )
    ).status,
  ).toBe(401);
  for (const ids of [[], Array(31).fill(X), [null]]) {
    const response = await request("/rpc/notification_center_lookup", {
      p_workspace: W,
      p_ids: ids,
    });
    expect(response.status).toBe(400);
    expect(response.payload.code).toBe("22023");
  }
});
it("revokes both HTTP live views when the selected workspace or active membership changes", async () => {
  const id = await notice();
  await db`update profiles set active_workspace_id=${B} where id=${U}`;
  expect((await request("/rpc/notification_center_badge", { p_workspace: W })).status).toBe(403);
  expect(
    (await request("/rpc/notification_center_lookup", { p_workspace: W, p_ids: [id] })).status,
  ).toBe(403);
  await db`update profiles set active_workspace_id=${W} where id=${U}`;
  await db`update workspace_members set status='inactive' where workspace_id=${W} and user_id=${U}`;
  expect((await request("/rpc/notification_center_badge", { p_workspace: W })).status).toBe(403);
});

it("does not expose private source-module helpers through SQL grants", async () => {
  await expect(
    withRole(
      "authenticated",
      U,
      (tx) => tx`select techerp_api.notification_center_source_module(${W},${U},'deals',${X})`,
    ),
  ).rejects.toMatchObject({ code: "42501" });
});
it("rejects a test API subject even when its user and workspace would otherwise be eligible", async () => {
  const id = await notice();
  for (const name of ["notification_center_badge", "notification_center_lookup"]) {
    await expect(
      withRole("authenticated", U, async (tx) => {
        await tx`select set_config('app.api_subject','on',true)`;
        return name === "notification_center_badge"
          ? tx`select notification_center_badge(${W})`
          : tx`select notification_center_lookup(${W},${[id]})`;
      }),
    ).rejects.toMatchObject({ code: "42501" });
  }
});
