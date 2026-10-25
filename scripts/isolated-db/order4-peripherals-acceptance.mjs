// Real JWT/PostgREST acceptance. Synthetic fixtures; no external deliveries.
import { readFileSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
const root = process.env.BANKING_ISOLATED_ROOT;
if (!root) throw Error("Explicit isolated root required");
const cfg = JSON.parse(readFileSync(root + "/status.private.json")),
  accounts = JSON.parse(readFileSync(root + "/hr-accounts.private.json"));
if (
  cfg.API_URL !== "http://127.0.0.1:54521" ||
  readFileSync(root + "/.isolation-marker", "utf8").trim() !== "techerp-permissions-20261023"
)
  throw Error("Isolated only");
const opt = { auth: { persistSession: false, autoRefreshToken: false } },
  admin = createClient(cfg.API_URL, cfg.SERVICE_ROLE_KEY, opt),
  must = (r) => {
    if (r.error) throw Error(r.error.message);
    return r.data;
  },
  assert = (x, m) => {
    if (!x) throw Error(m);
  },
  blocked = (r) => assert(!!r.error, "Forbidden write succeeded");
assert(
  must(await admin.from("__isolated_marker").select("label")).some(
    (x) => x.label === "techerp-isolated-harness",
  ),
  "Marker",
);
const clients = [];
for (const a of accounts) {
  const c = createClient(cfg.API_URL, cfg.ANON_KEY, opt);
  must(await c.auth.signInWithPassword({ email: a.email, password: a.password }));
  clients.push(c);
}
const h = clients[0],
  W = "aaaaaaaa-0000-4000-8000-00000000000a",
  B = "aaaaaaaa-0000-4000-8000-00000000000b",
  R = "30000000-0000-4000-8000-0000000000a8",
  O = "10000000-0000-4000-8000-000000000001",
  u = accounts[0].id,
  peer = accounts[1].id;
const catalog = [];
for (let off = 0; ; off += 500) {
  const p = must(
    await admin
      .from("permissions")
      .select("key")
      .order("key")
      .range(off, off + 499),
  );
  catalog.push(...p);
  if (p.length < 500) break;
}
const keys = catalog
  .map((x) => x.key)
  .filter((k) => k.startsWith("techsales.") || k.startsWith("system."));
const before = must(
  await admin
    .from("job_role_permission_overrides")
    .select("*")
    .eq("workspace_id", W)
    .eq("role_id", R),
).filter((x) => keys.includes(x.permission_key));
writeFileSync(root + "/order4-peripherals-overrides-before.json", JSON.stringify(before));
const grant = async (list, effect = "grant") => {
  for (let i = 0; i < list.length; i += 100)
    must(
      await admin.from("job_role_permission_overrides").upsert(
        list.slice(i, i + 100).map((permission_key) => ({
          workspace_id: W,
          role_id: R,
          permission_key,
          effect,
          created_by: O,
        })),
        { onConflict: "workspace_id,role_id,permission_key" },
      ),
    );
};
const fixtures = [],
  results = [];
let group;
const seed = async (table, data) => {
  const x = must(await admin.from(table).insert(data).select("id").single());
  fixtures.push([table, x.id]);
  return x.id;
};
const check = async (name, f) => {
  try {
    await f();
    results.push({ name, passed: true });
    console.log("PASS", name);
  } catch (e) {
    results.push({ name, passed: false, error: e.message });
    console.log("FAIL", name, e.message);
  }
};
const ids = async (table, list) =>
  must(await h.from(table).select("id").in("id", list))
    .map((x) => x.id)
    .sort();
try {
  await grant(keys, "deny");
  const slug = `iso-order4-${Date.now()}`;
  await seed("marketplace_apps", {
    slug,
    name: "[ISO] permission catalog",
    category: "test",
    active: true,
  });
  const install = await seed("marketplace_installations", {
    workspace_id: W,
    owner_id: u,
    installed_by: u,
    app_slug: slug,
    status: "active",
  });
  const foreign = await seed("marketplace_installations", {
    workspace_id: B,
    owner_id: "10000000-0000-4000-8000-000000000006",
    installed_by: "10000000-0000-4000-8000-000000000006",
    app_slug: slug,
    status: "active",
  });
  await check("marketplace catalog requires explicit integration read", async () =>
    assert(
      must(await h.from("marketplace_apps").select("id").eq("slug", slug)).length === 0,
      "catalog leaked",
    ),
  );
  await check("installation requires explicit integration read", async () =>
    assert(
      must(await h.from("marketplace_installations").select("id").eq("id", install)).length === 0,
      "installation leaked",
    ),
  );
  await grant(["system.integrations.view.own"]);
  await check("integration read exposes active catalog", async () =>
    assert(
      must(await h.from("marketplace_apps").select("id").eq("slug", slug)).length === 1,
      "catalog denied",
    ),
  );
  await check("integration own read resolves its actual installer", async () =>
    assert(
      must(await h.from("marketplace_installations").select("id").eq("id", install)).length === 1,
      "own denied",
    ),
  );
  await check("integration read does not resolve foreign installations", async () =>
    assert(
      must(await h.from("marketplace_installations").select("id").eq("id", foreign)).length === 0,
      "foreign leaked",
    ),
  );
  await check("ordinary installer cannot change global catalog", async () =>
    assert(
      must(
        await h
          .from("marketplace_apps")
          .update({ name: "forbidden" })
          .eq("slug", slug)
          .select("id"),
      ).length === 0,
      "catalog changed",
    ),
  );
  await check("view does not grant installation update", async () =>
    assert(
      must(
        await h
          .from("marketplace_installations")
          .update({ status: "error" })
          .eq("id", install)
          .select("id"),
      ).length === 0,
      "read mutated",
    ),
  );
  await grant(["system.integrations.update.own"]);
  await check("installation update follows actual own scope", async () =>
    assert(
      must(
        await h
          .from("marketplace_installations")
          .update({ status: "error" })
          .eq("id", install)
          .select("id"),
      ).length === 1,
      "update denied",
    ),
  );
  await check("installation cannot move to another workspace", async () =>
    blocked(
      await h
        .from("marketplace_installations")
        .update({ workspace_id: B })
        .eq("id", install)
        .select("id"),
    ),
  );
  await check("marketplace cannot become a free-form credential store", async () =>
    blocked(
      await h
        .from("marketplace_installations")
        .update({ config: { access_token: "isolated-only" } })
        .eq("id", install)
        .select("id"),
    ),
  );
  await check("view and update do not imply connection manage", async () =>
    assert(
      must(
        await h.rpc("sales_record_access", {
          t: "marketplace_installations",
          i: install,
          a: "manage",
        }),
      ) === false,
      "manage implied",
    ),
  );
  await grant(["system.integrations.manage.workspace"]);
  await check("explicit manage authorizes connection check in correct workspace", async () =>
    assert(
      must(
        await h.rpc("sales_record_access", {
          t: "marketplace_installations",
          i: install,
          a: "manage",
        }),
      ) === true,
      "manage denied",
    ),
  );
  await check("manage cannot operate another workspace installation", async () =>
    assert(
      must(
        await h.rpc("sales_record_access", {
          t: "marketplace_installations",
          i: foreign,
          a: "manage",
        }),
      ) === false,
      "foreign manage",
    ),
  );
  await check("manage does not imply delete", async () =>
    assert(
      must(await h.from("marketplace_installations").delete().eq("id", install).select("id"))
        .length === 0,
      "manage deleted",
    ),
  );
  await grant(["system.integrations.delete.own"]);
  await check("explicit delete removes own installation", async () =>
    assert(
      must(await h.from("marketplace_installations").delete().eq("id", install).select("id"))
        .length === 1,
      "delete denied",
    ),
  );
  const rule = await seed("rotation_rules", {
    workspace_id: W,
    owner_id: u,
    name: "[ISO] Inbox permissions",
    entity: "whatsapp_conversations",
    enabled: true,
    strategy: "round_robin",
    assignees: [{ user_id: peer, weight: 1 }],
  });
  const conversation = await seed("whatsapp_conversations", {
    workspace_id: W,
    owner_id: u,
    assigned_to: null,
    contact_phone: "+5511900022222",
    twilio_number: "+5511300022222",
  });
  must(
    await admin.from("whatsapp_conversations").update({ assigned_to: null }).eq("id", conversation),
  );
  const rotate = () =>
    admin.rpc("sales_inbox_rotate", {
      p_rule: rule,
      p_table: "whatsapp_conversations",
      p_record: conversation,
    });
  await check("Inbox auto-assignment requires the rule owner's current permissions", async () =>
    blocked(await rotate()),
  );
  await grant([
    "system.automation.rotation.view.own",
    "system.automation.rotation.manage.own",
    "system.automation.rotation.update.own",
    "techsales.inbox.whatsapp.view.workspace",
    "techsales.inbox.whatsapp.update.workspace",
  ]);
  await check("Inbox editing is not assignment authority", async () => blocked(await rotate()));
  await grant(["techsales.inbox.whatsapp.assign.workspace"]);
  await check("browser cannot invoke the privileged Inbox worker", async () =>
    blocked(
      await h.rpc("sales_inbox_rotate", {
        p_rule: rule,
        p_table: "whatsapp_conversations",
        p_record: conversation,
      }),
    ),
  );
  await check("concurrent provider retries do not reassign a conversation", async () => {
    const results = await Promise.all([rotate(), rotate()]);
    for (const r of results) assert(must(r).user_id === peer, "wrong assignee");
    assert(
      results.filter((x) => x.data?.skipped === "already_assigned").length === 1,
      "retry advanced twice",
    );
    const q = must(
      await admin
        .from("whatsapp_conversations")
        .select("assigned_to,owner_id")
        .eq("id", conversation)
        .single(),
    );
    assert(q.assigned_to === peer && q.owner_id === u, "author changed");
  });
  must(
    await admin.from("whatsapp_conversations").update({ assigned_to: null }).eq("id", conversation),
  );
  await check("Inbox distribution repairs a legacy workspace UUID as assignee", async () => {
    must(
      await admin.from("whatsapp_conversations").update({ assigned_to: W }).eq("id", conversation),
    );
    assert(must(await rotate()).user_id === peer, "legacy workspace assignee was preserved");
    must(
      await admin
        .from("whatsapp_conversations")
        .update({ assigned_to: null })
        .eq("id", conversation),
    );
  });
  must(
    await admin
      .from("rotation_rules")
      .update({ assignees: [{ user_id: "10000000-0000-4000-8000-000000000006", weight: 1 }] })
      .eq("id", rule),
  );
  await check("Inbox distribution rejects a foreign-workspace recipient", async () =>
    blocked(await rotate()),
  );
  must(
    await admin
      .from("rotation_rules")
      .update({ assignees: [{ user_id: "10000000-0000-4000-8000-000000000005", weight: 1 }] })
      .eq("id", rule),
  );
  await check("Inbox distribution rejects an inactive recipient", async () =>
    blocked(await rotate()),
  );
  must(
    await admin
      .from("rotation_rules")
      .update({ assignees: [{ user_id: peer, weight: 1 }] })
      .eq("id", rule),
  );
  await grant(["system.automation.rotation.manage.own"], "deny");
  await check("Inbox worker stops immediately after the owner loses manage", async () =>
    blocked(await rotate()),
  );
  const integration = await seed("integrations", {
    workspace_id: W,
    owner_id: u,
    provider: "hubspot",
    status: "connected",
    config: { auto_push_enabled: true },
  });
  const contact = await seed("contacts", {
    workspace_id: W,
    owner_id: u,
    first_name: "[ISO] Source-scoped contact",
  });
  const reassigned = await seed("contacts", {
    workspace_id: W,
    owner_id: u,
    assigned_to: peer,
    first_name: "[ISO] Assigned away",
  });
  const sourceQuery = (table, query) =>
    admin.rpc("sales_source_query", {
      p_source: "integrations",
      p_id: integration,
      p_table: table,
      p_query: query,
    });
  await check("HubSpot source does not imply current permission to run", async () =>
    blocked(await sourceQuery("contacts", { operation: "select", select: "id" })),
  );
  await grant(["system.hubspot_sync.view.own", "system.hubspot_sync.manage.workspace"]);
  await check("HubSpot management does not grant CRM read", async () =>
    blocked(await sourceQuery("contacts", { operation: "select", select: "id" })),
  );
  await grant(["techsales.contacts.view.own"]);
  await check("HubSpot source queries retain current assigned-to scope", async () => {
    const rows = must(
      await sourceQuery("contacts", {
        operation: "select",
        select: "id",
        filters: [{ field: "id", op: "in", value: [contact, reassigned] }],
      }),
    ).data;
    assert(rows.length === 1 && rows[0].id === contact, "current assignment scope bypassed");
  });
  await check("HubSpot source cannot read credentials or private tokens", async () =>
    blocked(await sourceQuery("contacts", { operation: "select", select: "portal_token" })),
  );
  await check("HubSpot source cannot access a table outside its finite catalog", async () =>
    blocked(await sourceQuery("profiles", { operation: "select", select: "id" })),
  );
  await check("browser cannot invoke background HubSpot queries", async () =>
    blocked(
      await h.rpc("sales_source_query", {
        p_source: "integrations",
        p_id: integration,
        p_table: "contacts",
        p_query: { operation: "select" },
      }),
    ),
  );
  await grant(["techsales.contacts.update.own"]);
  await check("HubSpot writes are evaluated with current actor RLS", async () =>
    assert(
      must(
        await sourceQuery("contacts", {
          operation: "update",
          payload: { notes: "[ISO] permitted" },
          select: "id",
          filters: [{ field: "id", op: "eq", value: contact }],
        }),
      ).count === 1,
      "authorized write failed",
    ),
  );
  await check("HubSpot cannot update records assigned away", async () =>
    blocked(
      await sourceQuery("contacts", {
        operation: "update",
        payload: { notes: "forbidden" },
        select: "id",
        filters: [{ field: "id", op: "eq", value: reassigned }],
      }),
    ),
  );
  await check("HubSpot cannot rewrite the source workspace", async () =>
    blocked(
      await sourceQuery("contacts", {
        operation: "update",
        payload: { workspace_id: B },
        select: "id",
        filters: [{ field: "id", op: "eq", value: contact }],
      }),
    ),
  );
  await check("HubSpot cannot rewrite record authorship", async () =>
    blocked(
      await sourceQuery("contacts", {
        operation: "update",
        payload: { owner_id: peer },
        select: "id",
        filters: [{ field: "id", op: "eq", value: contact }],
      }),
    ),
  );
  await check("HubSpot authorization adapter does not assume export from read", async () =>
    assert(
      must(
        await sourceQuery("contacts", {
          operation: "authorize",
          record_id: contact,
          action: "export",
        }),
      ).data[0].allowed === false,
      "export implied",
    ),
  );
  await grant(["techsales.contacts.export.own"]);
  await check("HubSpot authorization adapter permits explicit own export", async () =>
    assert(
      must(
        await sourceQuery("contacts", {
          operation: "authorize",
          record_id: contact,
          action: "export",
        }),
      ).data[0].allowed === true,
      "export denied",
    ),
  );
  must(
    await admin
      .from("integrations")
      .update({ config: { auto_push_enabled: false } })
      .eq("id", integration),
  );
  await check("HubSpot background queries stop after the source is disabled", async () =>
    blocked(await sourceQuery("contacts", { operation: "select", select: "id" })),
  );

  const playbook = await seed("sdr_playbooks", {
    workspace_id: W,
    owner_id: u,
    assigned_to: u,
    name: "[ISO] Source-scoped SDR",
    enabled: true,
    channel: "whatsapp",
  });
  await seed("sdr_agent_versions", {
    workspace_id: W,
    playbook_id: playbook,
    version: 1,
    status: "published",
    persona: {},
    created_by: u,
    published_by: u,
  });
  const enrollment = await seed("sdr_enrollments", {
    workspace_id: W,
    owner_id: u,
    playbook_id: playbook,
    conversation_id: conversation,
    contact_phone: "+5511900022222",
  });
  must(
    await admin.from("whatsapp_conversations").update({ ai_owner: "ai" }).eq("id", conversation),
  );
  const sdrQuery = (table, query) =>
    admin.rpc("sales_source_query", {
      p_source: "sdr_enrollments",
      p_id: enrollment,
      p_table: table,
      p_query: query,
    });
  await check("SDR tools require the source owner's current agent permission", async () =>
    blocked(await sdrQuery("contacts", { operation: "select", select: "id" })),
  );
  await grant([
    "techsales.marketing.sdr_agent.view.own",
    "techsales.marketing.sdr_agent.update.own",
  ]);
  await check("SDR customer lookup retains CRM assigned-to scope", async () => {
    const rows = must(
      await sdrQuery("contacts", {
        operation: "select",
        select: "id",
        filters: [{ field: "id", op: "in", value: [contact, reassigned] }],
      }),
    ).data;
    assert(rows.length === 1 && rows[0].id === contact, "SDR lookup bypassed assignment");
  });
  await check("SDR tools cannot query private contact tokens", async () =>
    blocked(await sdrQuery("contacts", { operation: "select", select: "portal_token" })),
  );
  await check("SDR tools cannot query privileged metadata", async () =>
    blocked(await sdrQuery("hubspot_sync_state", { operation: "select", select: "id" })),
  );
  await grant(["techsales.contacts.view.own"], "deny");
  await check("SDR customer tools stop after CRM read revocation", async () =>
    blocked(await sdrQuery("contacts", { operation: "select", select: "id" })),
  );
  await grant(["techsales.contacts.view.own"]);
  must(
    await admin.from("whatsapp_conversations").update({ ai_owner: "human" }).eq("id", conversation),
  );
  await check("SDR tools stop when a person takes over the conversation", async () =>
    blocked(await sdrQuery("contacts", { operation: "select", select: "id" })),
  );
  must(
    await admin.from("whatsapp_conversations").update({ ai_owner: "ai" }).eq("id", conversation),
  );
  const calendar = await seed("calendar_accounts", {
    workspace_id: W,
    owner_id: u,
    provider: "google",
    email: "isolated-calendar@example.invalid",
  });
  const calendarCheck = () =>
    admin.rpc("sales_worker_authorize", {
      p_source: "sdr_enrollments",
      p_id: enrollment,
      p_refs: [{ table: "calendar_accounts", id: calendar, action: "manage" }],
    });
  await check("SDR configuration does not imply permission to operate a calendar", async () =>
    assert(must(await calendarCheck()) === false, "agenda implicit"),
  );
  await grant(["system.calendars.view.own", "system.calendars.manage.own"]);
  await check("SDR may operate an explicitly authorized calendar", async () =>
    assert(must(await calendarCheck()) === true, "agenda denied"),
  );
  await grant(["system.calendars.manage.own"], "deny");
  await check("SDR calendar permission revocation is immediate", async () =>
    assert(must(await calendarCheck()) === false, "agenda revocation ignored"),
  );

  const segment = await seed("segments", {
    workspace_id: W,
    owner_id: u,
    name: "[ISO] RLS dynamic list",
    entity: "contacts",
    kind: "dynamic",
    enabled: true,
    filters: {
      type: "group",
      op: "or",
      conditions: [{ type: "condition", field: "id", op: "in", value: [contact, reassigned] }],
    },
  });
  const refresh = () => admin.rpc("sales_segment_refresh", { p_id: segment });
  await check("dynamic lists do not inherit the scheduler's administrative access", async () =>
    blocked(await refresh()),
  );
  await grant([
    "techsales.segments.view.own",
    "techsales.segments.update.own",
    "techsales.segments.manage.own",
  ]);
  await check("dynamic list filters run under current CRM RLS", async () => {
    assert(must(await refresh()).count === 1, "list leaked assigned-away record");
    const rows = must(
      await admin.from("segment_members").select("entity_id").eq("segment_id", segment),
    );
    assert(rows.length === 1 && rows[0].entity_id === contact, "wrong members");
  });
  await grant(["techsales.contacts.view.own"], "deny");
  await check("failed list refresh preserves previous membership atomically", async () => {
    blocked(await refresh());
    assert(
      must(await admin.from("segment_members").select("entity_id").eq("segment_id", segment))
        .length === 1,
      "membership lost",
    );
  });
  await grant(["techsales.contacts.view.own"]);
  must(
    await admin
      .from("segments")
      .update({ filters: { type: "condition", field: "portal_token", op: "is_not_null" } })
      .eq("id", segment),
  );
  await check("dynamic filters cannot probe private token columns", async () =>
    blocked(await refresh()),
  );
  const version = await seed("sdr_agent_versions", {
    workspace_id: W,
    playbook_id: playbook,
    version: 2,
    status: "draft",
    persona: {},
    created_by: u,
  });
  await check("agent draft edits remain permitted", async () =>
    assert(
      must(
        await h
          .from("sdr_agent_versions")
          .update({ notes: "[ISO] draft" })
          .eq("id", version)
          .select("id"),
      ).length === 1,
      "draft denied",
    ),
  );
  await check("browser cannot bypass atomic SDR publishing", async () =>
    blocked(
      await h
        .from("sdr_agent_versions")
        .update({ status: "published" })
        .eq("id", version)
        .select("id"),
    ),
  );
  await check("service publishing still requires current agent management", async () =>
    blocked(await admin.rpc("sdr_publish_agent_version", { p_version: version, p_user: u })),
  );
  await grant(["techsales.marketing.sdr_agent.manage.workspace"]);
  await check("authorized SDR publishing succeeds atomically", async () =>
    assert(
      must(await admin.rpc("sdr_publish_agent_version", { p_version: version, p_user: u })) ===
        version,
      "publish denied",
    ),
  );
  await check("published agent content cannot be edited directly", async () =>
    blocked(
      await h
        .from("sdr_agent_versions")
        .update({ notes: "forbidden" })
        .eq("id", version)
        .select("id"),
    ),
  );
  const voice = await seed("prospecting_campaigns", {
    workspace_id: W,
    owner_id: u,
    assigned_to: u,
    name: "[ISO] voice actor",
    status: "running",
    execution_user_id: u,
  });
  const voiceCheck = () =>
    admin.rpc("sales_worker_authorize", {
      p_source: "prospecting_campaigns",
      p_id: voice,
      p_refs: [
        { table: "contacts", id: contact },
        { resource: "techsales.prospecting_voice", action: "create" },
      ],
    });
  await check("voice scheduler needs current campaign and voice permissions", async () =>
    assert(must(await voiceCheck()) === false, "implicit scheduler access"),
  );
  await grant([
    "techsales.marketing.campaigns.view.own",
    "techsales.marketing.campaigns.update.own",
    "techsales.marketing.campaigns.manage.own",
    "techsales.prospecting_voice.create.own",
  ]);
  await check("authorized voice source validates without placing a call", async () =>
    assert(must(await voiceCheck()) === true, "voice guard denied"),
  );
  await check("campaign editor cannot impersonate another execution actor", async () =>
    blocked(
      await h
        .from("prospecting_campaigns")
        .update({ execution_user_id: peer })
        .eq("id", voice)
        .select("id"),
    ),
  );
  must(await admin.from("prospecting_campaigns").update({ status: "paused" }).eq("id", voice));
  await check("paused voice campaign cannot use a previously authorized actor", async () =>
    assert(must(await voiceCheck()) === false, "paused voice source authorized"),
  );

  const activity = await seed("activities", {
    workspace_id: W,
    owner_id: u,
    assigned_to: u,
    type: "call",
    subject: "[ISO] Protected summary source",
    related_contact_id: contact,
  });
  const summary = await seed("ai_summaries", {
    workspace_id: W,
    owner_id: u,
    entity: "contact",
    entity_id: contact,
    kind: "call",
    summary: "[ISO] Source-bound content",
    source_count: 1,
    source_refs: [{ table: "activities", id: activity }],
  });
  const summaryRead = () => h.from("ai_summaries").select("id").eq("id", summary);
  await check("stored AI summaries require explicit summary read", async () =>
    assert(must(await summaryRead()).length === 0, "summary read implied"),
  );
  await grant(["techsales.ai_summaries.view.own"]);
  await check("AI summary read does not bypass source permissions", async () =>
    assert(must(await summaryRead()).length === 0, "source read bypassed"),
  );
  await grant(["techsales.activities.view.own"]);
  await check("AI summary is visible while every source remains authorized", async () =>
    assert(must(await summaryRead()).length === 1, "authorized summary denied"),
  );
  await grant(["techsales.activities.view.own"], "deny");
  await check("AI summary disappears immediately when a source is revoked", async () =>
    assert(must(await summaryRead()).length === 0, "revoked source remains visible"),
  );
  await grant(["techsales.activities.view.own"]);
  await check("reading an AI summary does not allow deleting it", async () =>
    assert(
      must(await h.from("ai_summaries").delete().eq("id", summary).select("id")).length === 0,
      "read implies delete",
    ),
  );
  await grant(["techsales.ai_summaries.delete.own"]);
  await check("explicit AI summary deletion is permitted", async () =>
    assert(
      must(await h.from("ai_summaries").delete().eq("id", summary).select("id")).length === 1,
      "delete denied",
    ),
  );

  const meeting = await seed("meetings", {
    workspace_id: W,
    owner_id: W,
    host_user_id: u,
    assigned_to: u,
    title: "[ISO] Recording path",
    room_name: "iso-" + Date.now(),
    public_token: "isolated-recording-" + Date.now(),
  });
  await grant(["techsales.meetings.view.own", "techsales.meetings.update.own"]);
  await check("meeting recording cannot be forged to another record", async () =>
    blocked(
      await h
        .from("meetings")
        .update({ recording_storage_path: W + "/00000000-0000-4000-8000-000000000099/test.webm" })
        .eq("id", meeting)
        .select("id"),
    ),
  );
  await check("meeting recording remains bound to its authorized source", async () =>
    assert(
      must(
        await h
          .from("meetings")
          .update({ recording_storage_path: W + "/" + meeting + "/test.webm" })
          .eq("id", meeting)
          .select("id"),
      ).length === 1,
      "valid path rejected",
    ),
  );
} finally {
  for (const [t, id] of fixtures.reverse()) {
    if (t === "segments") must(await admin.from("segment_members").delete().eq("segment_id", id));
    must(await admin.from(t).delete().eq("id", id));
  }
  if (group) {
    must(await admin.from("user_group_members").delete().eq("group_id", group));
    must(await admin.from("user_groups").delete().eq("id", group));
  }
  for (let i = 0; i < keys.length; i += 100)
    must(
      await admin
        .from("job_role_permission_overrides")
        .delete()
        .eq("workspace_id", W)
        .eq("role_id", R)
        .in("permission_key", keys.slice(i, i + 100)),
    );
  if (before.length) must(await admin.from("job_role_permission_overrides").insert(before));
  for (const c of clients) await c.auth.signOut();
  writeFileSync(
    root + "/order4-peripherals-acceptance.json",
    JSON.stringify({ results, passed: results.every((x) => x.passed), external_sends: 0 }, null, 2),
  );
}
if (results.some((x) => !x.passed)) process.exitCode = 1;
