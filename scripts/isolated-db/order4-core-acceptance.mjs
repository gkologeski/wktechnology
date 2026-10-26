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
writeFileSync(root + "/order4-core-overrides-before.json", JSON.stringify(before));
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
  const own = await seed("leads", { workspace_id: W, owner_id: u, first_name: "[ISO order4 own]" }),
    away = await seed("leads", {
      workspace_id: W,
      owner_id: u,
      assigned_to: peer,
      first_name: "[ISO order4 assigned away]",
    }),
    team = await seed("leads", {
      workspace_id: W,
      owner_id: peer,
      first_name: "[ISO order4 team]",
    }),
    outside = await seed("leads", {
      workspace_id: W,
      owner_id: O,
      first_name: "[ISO order4 outside]",
    }),
    foreign = await seed("leads", {
      workspace_id: B,
      owner_id: accounts[3].id,
      first_name: "[ISO order4 foreign]",
    });
  const leadIds = [own, away, team, outside, foreign];
  const company = await seed("companies", {
      workspace_id: W,
      owner_id: u,
      name: "[ISO order4 company]",
    }),
    foreignCompany = await seed("companies", {
      workspace_id: B,
      owner_id: accounts[3].id,
      name: "[ISO order4 foreign company]",
    });
  const deal = await seed("deals", { workspace_id: W, owner_id: u, name: "[ISO order4 deal]" }),
    foreignDeal = await seed("deals", {
      workspace_id: B,
      owner_id: accounts[3].id,
      name: "[ISO order4 foreign deal]",
    });
  const line = await seed("deal_line_items", {
    workspace_id: W,
    owner_id: u,
    deal_id: deal,
    name: "[ISO order4 line]",
    quantity: 1,
    unit_price: 1,
  });
  const note = await seed("activities", {
      workspace_id: W,
      owner_id: u,
      type: "note",
      subject: "[ISO order4 note]",
    }),
    task = await seed("activities", {
      workspace_id: W,
      owner_id: u,
      type: "task",
      subject: "[ISO order4 task]",
    });
  await check("membership alone grants no commercial records", async () => {
    for (const [t, list] of [
      ["leads", leadIds],
      ["companies", [company]],
      ["deals", [deal]],
      ["activities", [note, task]],
      ["deal_line_items", [line]],
    ])
      assert((await ids(t, list)).length === 0, t + " leaked");
  });
  await grant(["techsales.leads.view.own"]);
  await check("own uses current assignee, not historical creator", async () =>
    assert(JSON.stringify(await ids("leads", leadIds)) === JSON.stringify([own]), "own scope"),
  );
  await check("direct capability cannot bypass invisible record", async () => {
    const rows = must(await h.rpc("sales_capabilities", { t: "leads", ids: leadIds }));
    assert(rows.length === 1 && rows[0].id === own && !rows[0].can_update, "capabilities");
  });
  await grant(["techsales.leads.view.workspace"]);
  await check("workspace view stays inside selected workspace", async () =>
    assert((await ids("leads", leadIds)).length === 4, "workspace leak"),
  );
  await grant(["techsales.leads.view.workspace"], "deny");
  await check("deny workspace does not become administrative bypass", async () =>
    assert((await ids("leads", leadIds)).length === 1, "deny ignored"),
  );
  group = must(
    await admin
      .from("user_groups")
      .insert({ workspace_id: W, name: "[ISO order4 team]" })
      .select("id")
      .single(),
  ).id;
  must(
    await admin.from("user_group_members").insert([
      { group_id: group, user_id: u },
      { group_id: group, user_id: peer },
    ]),
  );
  await grant([
    "techsales.leads.view.team",
    "techsales.leads.update.team",
    "techsales.leads.delete.team",
  ]);
  await check("team view is limited to actual teammates", async () =>
    assert((await ids("leads", leadIds)).length === 3, "team view broader than team"),
  );
  await check("team update cannot modify another team", async () => {
    const r = await h
      .from("leads")
      .update({ notes: "[ISO forbidden]" })
      .eq("id", outside)
      .select("id");
    assert(!!r.error || r.data.length === 0, "foreign team modified");
  });
  await check("team delete cannot delete another team", async () => {
    const r = await h.from("leads").delete().eq("id", outside).select("id");
    assert(!!r.error || r.data.length === 0, "foreign team deleted");
  });
  await check("workspace remains immutable", async () =>
    blocked(await h.from("leads").update({ workspace_id: B }).eq("id", own)),
  );
  await check("historical author remains immutable", async () =>
    blocked(await h.from("leads").update({ owner_id: peer }).eq("id", own)),
  );
  await check("editing does not grant reassignment", async () =>
    blocked(await h.from("leads").update({ assigned_to: peer }).eq("id", own)),
  );
  await grant(["techsales.leads.assign.team"]);
  await check("assignment rejects inactive destination", async () =>
    blocked(await h.from("leads").update({ assigned_to: accounts[2].id }).eq("id", own)),
  );
  await check("assignment rejects foreign workspace destination", async () =>
    blocked(await h.from("leads").update({ assigned_to: accounts[3].id }).eq("id", own)),
  );
  await check("assignment accepts an active teammate", async () => {
    must(await h.from("leads").update({ assigned_to: peer }).eq("id", own));
    assert(
      must(await admin.from("leads").select("assigned_to").eq("id", own).single()).assigned_to ===
        peer,
      "assignment failed",
    );
  });
  await grant(["techsales.leads.create.own"]);
  await check("create cannot link a foreign company", async () => {
    const r = await h
      .from("leads")
      .insert({
        workspace_id: W,
        owner_id: u,
        first_name: "[ISO rejected]",
        company_id: foreignCompany,
      })
      .select("id");
    for (const row of r.data ?? []) fixtures.push(["leads", row.id]);
    blocked(r);
  });
  await grant(["techsales.deals.view.own", "techsales.deals.update.own"]);
  await check("line item visibility follows actual parent", async () =>
    assert((await ids("deal_line_items", [line])).length === 1, "line item missing"),
  );
  await check("line item cannot move to a foreign deal", async () =>
    blocked(await h.from("deal_line_items").update({ deal_id: foreignDeal }).eq("id", line)),
  );
  await grant(["techsales.activities.view.workspace"]);
  await check("activity permission cannot bypass notes and tasks resources", async () =>
    assert((await ids("activities", [note, task])).length === 0, "typed activity leak"),
  );
  await grant(["techsales.notes.view.own"]);
  await check("notes permission does not reveal tasks", async () =>
    assert(
      JSON.stringify(await ids("activities", [note, task])) === JSON.stringify([note]),
      "typed activity scope",
    ),
  );
  await check("inactive JWT has no commercial rows", async () =>
    assert(
      must(await clients[2].from("leads").select("id").in("id", leadIds)).length === 0,
      "inactive leak",
    ),
  );
  await check("foreign JWT has no selected workspace records", async () =>
    assert(
      must(await clients[3].from("leads").select("id").in("id", [own, team, outside])).length === 0,
      "tenant leak",
    ),
  );
  for (const [table, col] of [
    ["contacts", "portal_token"],
    ["quotes", "public_token"],
    ["proposals", "public_token"],
    ["email_accounts", "access_token"],
    ["calendar_accounts", "refresh_token"],
    ["integrations", "oauth_tokens"],
    ["slack_integrations", "access_token"],
    ["outbound_webhooks", "secret"],
  ])
    await check("raw credential column is blocked: " + table + "." + col, async () =>
      blocked(await h.from(table).select(col).limit(1)),
    );
  await check("credential writes are blocked even without a matching row", async () =>
    blocked(
      await h
        .from("integrations")
        .update({ oauth_tokens: { access_token: "[ISO forged]" } })
        .eq("id", "99999999-0000-4000-8000-000000000001"),
    ),
  );
  await check("legacy deal visibility cannot use historical author", async () => {
    const id = await seed("deals", {
      workspace_id: W,
      owner_id: u,
      assigned_to: peer,
      name: "[ISO historical deal]",
    });
    assert(
      must(await h.rpc("deal_visible_to_current_user", { _deal: id })) === false,
      "legacy deal leaked",
    );
  });
  await check("legacy search respects actual note/task resource scope", async () => {
    const found = must(
      await h.rpc("global_search_candidate_ids", { _entity: "activity", _q: "ISO order4" }),
    );
    assert(found.includes(note) && !found.includes(task), "legacy search leaked typed task");
  });
  await check("company owner reference cannot expose foreign workspace", async () => {
    assert(
      must(await h.rpc("company_portfolio_owner", { _company_id: foreignCompany })).length === 0,
      "owner metadata leaked",
    );
  });
  await check("legacy profile seeding cannot change another workspace", async () =>
    blocked(await h.rpc("seed_access_profiles", { _workspace: B })),
  );
  const conversation = await seed("whatsapp_conversations", {
    workspace_id: W,
    owner_id: u,
    assigned_to: u,
    contact_phone: "+5511900000000",
    twilio_number: "+5511300000000",
  });
  await grant(["techsales.inbox.whatsapp.view.own", "techsales.inbox.whatsapp.update.own"]);
  await check("editing Inbox is not assignment authority", async () =>
    assert(
      must(
        await h.rpc("inbox_assign_conversation", {
          p_channel: "whatsapp",
          p_id: conversation,
          p_assignee: peer,
        }),
      ) === false,
      "assign bypass",
    ),
  );
  await grant([
    "techsales.inbox.whatsapp.view.team",
    "techsales.inbox.whatsapp.update.team",
    "techsales.inbox.whatsapp.assign.team",
  ]);
  await check("Inbox assignment rejects inactive destination", async () =>
    assert(
      must(
        await h.rpc("inbox_assign_conversation", {
          p_channel: "whatsapp",
          p_id: conversation,
          p_assignee: accounts[2].id,
        }),
      ) === false,
      "inactive assignee",
    ),
  );
  await check("Inbox can assign an active teammate", async () =>
    assert(
      must(
        await h.rpc("inbox_assign_conversation", {
          p_channel: "whatsapp",
          p_id: conversation,
          p_assignee: peer,
        }),
      ) === true,
      "team assignment blocked",
    ),
  );
  await grant([
    "techsales.contacts.view.own",
    "techsales.contacts.update.own",
    "techsales.companies.view.own",
  ]);
  must(await admin.from("companies").update({ domain: "iso4.example" }).eq("id", company));
  const duplicate = await seed("companies", {
    workspace_id: W,
    owner_id: u,
    name: "[ISO ambiguous company]",
    domain: "iso4.example",
  });
  const contact = await seed("contacts", {
    workspace_id: W,
    owner_id: u,
    first_name: "[ISO match]",
    email: "qa@iso4.example",
  });
  await check("domain matching preserves ambiguous company links", async () => {
    must(await h.rpc("link_contacts_by_email_domain", { p_workspace: W }));
    assert(
      must(await admin.from("contacts").select("company_id").eq("id", contact).single())
        .company_id === null,
      "ambiguous link chosen",
    );
  });
  must(await admin.from("companies").delete().eq("id", duplicate));
  await check("domain matching links a unique visible same-workspace company", async () => {
    must(await h.rpc("link_contacts_by_email_domain", { p_workspace: W }));
    assert(
      must(await admin.from("contacts").select("company_id").eq("id", contact).single())
        .company_id === company,
      "unique visible company not linked",
    );
  });
  const emailRule = await seed("field_permission_rules", {
    workspace_id: W,
    owner_id: O,
    role_id: R,
    resource: "techsales.contacts",
    field: "email",
    mode: "hidden",
    is_system: false,
  });
  // Keep the existing automatic association trigger from immediately relinking
  // the fixture while its company_id is reset; remove ambiguity before the RPC.
  const resetDuplicate = await seed("companies", {
    workspace_id: W,
    owner_id: u,
    name: "[ISO reset ambiguity]",
    domain: "iso4.example",
  });
  await admin.from("contacts").update({ company_id: null }).eq("id", contact).then(must);
  await admin.from("companies").delete().eq("id", resetDuplicate).then(must);
  assert(
    must(await admin.from("contacts").select("company_id").eq("id", contact).single())
      .company_id === null,
    "Fixture was already linked before protected RPC",
  );
  await check("domain matching cannot consume a hidden email", async () => {
    must(await h.rpc("link_contacts_by_email_domain", { p_workspace: W }));
    assert(
      must(await admin.from("contacts").select("company_id").eq("id", contact).single())
        .company_id === null,
      "Hidden email was consumed",
    );
  });
  await admin.from("field_permission_rules").delete().eq("id", emailRule).then(must);
  await check("domain matching cannot choose another workspace", async () =>
    blocked(await h.rpc("link_contacts_by_email_domain", { p_workspace: B })),
  );
  await check("line item historical author cannot be changed", async () =>
    blocked(await h.from("deal_line_items").update({ owner_id: peer }).eq("id", line)),
  );

  await grant(["techsales.leads.create.workspace"]);
  await grant(["techsales.leads.assign.team"], "deny");
  await check("workspace create does not implicitly grant initial assignment", async () => {
    const row = await h
      .from("leads")
      .insert({
        workspace_id: W,
        owner_id: u,
        assigned_to: peer,
        first_name: "[ISO initial assignment]",
      })
      .select("id");
    for (const item of row.data ?? []) fixtures.push(["leads", item.id]);
    blocked(row);
  });
  await grant(["techsales.leads.assign.team"]);
  await check(
    "initial assignment to an active teammate works with explicit assignment",
    async () => {
      const row = must(
        await h
          .from("leads")
          .insert({
            workspace_id: W,
            owner_id: u,
            assigned_to: peer,
            first_name: "[ISO permitted initial assignment]",
          })
          .select("id")
          .single(),
      );
      fixtures.push(["leads", row.id]);
    },
  );
  const anon = createClient(cfg.API_URL, cfg.ANON_KEY, opt);
  for (const [table, column] of [
    ["contacts", "portal_token"],
    ["quotes", "public_token"],
    ["proposals", "public_token"],
    ["email_accounts", "access_token"],
    ["calendar_accounts", "refresh_token"],
    ["integrations", "oauth_tokens"],
    ["slack_integrations", "access_token"],
    ["outbound_webhooks", "secret"],
  ])
    await check("anonymous cannot read private column: " + table, async () =>
      blocked(await anon.from(table).select(column).limit(1)),
    );
} finally {
  for (const [t, id] of fixtures.reverse()) must(await admin.from(t).delete().eq("id", id));
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
    root + "/order4-core-acceptance.json",
    JSON.stringify({ results, passed: results.every((x) => x.passed), external_sends: 0 }, null, 2),
  );
}
if (results.some((x) => !x.passed)) process.exitCode = 1;
