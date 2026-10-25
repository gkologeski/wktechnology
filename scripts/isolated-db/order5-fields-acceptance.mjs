import { createHash, randomUUID } from "node:crypto";
import { protectSalesClient } from "../../src/lib/access-control/sales-client-projection.ts";
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
writeFileSync(root + "/order5-fields-overrides-before.json", JSON.stringify(before));
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
  await grant([
    "techsales.contacts.view.own",
    "techsales.contacts.update.own",
    "techsales.contacts.create.own",
    "techsales.companies.view.own",
    "techsales.deals.view.own",
  ]);
  const p = protectSalesClient(h);
  const company = await seed("companies", {
    workspace_id: W,
    owner_id: u,
    name: "[ISO fields company]",
  });
  const contact = await seed("contacts", {
    workspace_id: W,
    owner_id: u,
    company_id: company,
    first_name: "[ISO fields contact]",
    email: "iso-secret@example.invalid",
    phone: "+5548999999999",
    hs_raw: { email: "iso-secret@example.invalid" },
  });
  const foreign = await seed("contacts", {
    workspace_id: B,
    owner_id: accounts[3].id,
    first_name: "[ISO fields foreign]",
    email: "iso-away@example.invalid",
  });
  await check("raw REST cannot select a protected physical email", async () =>
    blocked(await h.from("contacts").select("email").eq("id", contact)),
  );
  await check("unrestricted read view retains authorized value", async () =>
    assert(
      must(await h.from("shared_fields_contacts").select("id,email").eq("id", contact).single())
        .email === "iso-secret@example.invalid",
      "value missing",
    ),
  );
  await check("user SDK automatically selects the protected read view", async () =>
    assert(
      must(await p.from("contacts").select("id,email").eq("id", contact).single()).email ===
        "iso-secret@example.invalid",
      "SDK projection wrong",
    ),
  );
  await check("read view owner never bypasses tenant RLS", async () =>
    assert(
      must(await h.from("shared_fields_contacts").select("id").eq("id", foreign)).length === 0,
      "view bypass",
    ),
  );
  await check("read view does not expose private portal token", async () =>
    blocked(await h.from("shared_fields_contacts").select("portal_token").eq("id", contact)),
  );
  const rule = await seed("field_permission_rules", {
    workspace_id: W,
    owner_id: O,
    resource: "techsales.contacts",
    field: "email",
    mode: "masked",
    role_id: R,
    is_system: false,
  });
  await check("canonical modes resolve selected active workspace and role", async () =>
    assert(
      must(await h.rpc("shared_field_context")).rules["techsales.contacts"].email === "masked",
      "mode missing",
    ),
  );
  await check("masked structured value never leaves PostgreSQL in plaintext", async () =>
    assert(
      must(await h.from("shared_fields_contacts").select("id,email").eq("id", contact).single())
        .email === null,
      "plaintext leaked",
    ),
  );
  await check("raw mirror JSON cannot bypass field ACL", async () =>
    blocked(await h.from("contacts").select("hs_raw").eq("id", contact)),
  );
  await check("read view suppresses raw import mirror for restricted actor", async () =>
    assert(
      must(await p.from("contacts").select("id,hs_raw").eq("id", contact).single()).hs_raw === null,
      "mirror leaked",
    ),
  );
  await check("filtered private value cannot become a search oracle", async () =>
    assert(
      must(await p.from("contacts").select("id").eq("email", "iso-secret@example.invalid"))
        .length === 0,
      "hidden predicate matched",
    ),
  );
  await check("direct mutation of a masked column is blocked", async () =>
    blocked(
      await h
        .from("contacts")
        .update({ email: "iso-changed@example.invalid" })
        .eq("id", contact)
        .select("id"),
    ),
  );
  await check("other editable fields remain writable through SDK", async () => {
    const row = must(
      await p
        .from("contacts")
        .update({ last_name: "[ISO changed]", email: null })
        .eq("id", contact)
        .select("id,email,last_name")
        .single(),
    );
    assert(row.last_name === "[ISO changed]" && row.email === null, "SDK save returned raw value");
    assert(
      must(await admin.from("contacts").select("email").eq("id", contact).single()).email ===
        "iso-secret@example.invalid",
      "SDK overwrote protected email",
    );
  });
  await check("mutable filter chains retain SDK semantics", async () => {
    const query = p.from("contacts").select("id,email");
    query.eq("id", foreign);
    assert(must(await query).length === 0, "ignored filter");
  });
  await check("nested protected child relation is masked", async () => {
    const row = must(
      await p.from("companies").select("id,contacts(id,email)").eq("id", company).single(),
    );
    assert(row.contacts.length === 1 && row.contacts[0].email === null, "nested child leaked");
  });
  await check("protected root retains normal parent relation", async () => {
    const row = must(
      await p.from("contacts").select("id,email,companies(id,name)").eq("id", contact).single(),
    );
    assert(row.companies.id === company && row.email === null, "parent relation failed");
  });
  await check("nonexistent field cannot be registered as protected", async () =>
    blocked(
      await admin.from("field_permission_rules").insert({
        workspace_id: W,
        owner_id: O,
        resource: "techsales.contacts",
        field: "not_a_column",
        mode: "hidden",
        role_id: R,
        is_system: false,
      }),
    ),
  );
  await check("ordinary user cannot create a valid access rule through raw REST", async () =>
    blocked(
      await h.from("field_permission_rules").insert({
        workspace_id: W,
        owner_id: u,
        resource: "techsales.contacts",
        field: "phone",
        mode: "hidden",
        role_id: R,
        is_system: false,
      }),
    ),
  );
  await check("field catalog cannot be edited by ordinary user", async () =>
    blocked(
      await h.from("shared_field_catalog").insert({
        resource: "techsales.contacts",
        table_name: "contacts",
        field: "portal_token",
        configurable: true,
      }),
    ),
  );
  const key = await seed("api_keys", {
    workspace_id: W,
    owner_id: u,
    name: "[ISO fields API]",
    prefix: "lvb_iso5",
    key_hash: createHash("sha256").update(randomUUID()).digest("hex"),
    scopes: ["read", "write"],
  });
  const port = (table, query) =>
    admin.rpc("sales_api_query", {
      p_key: key,
      p_user: u,
      p_ws: W,
      p_table: table,
      p_query: query,
    });
  await check("source-bound public API masks protected values", async () => {
    const x = must(
      await port("contacts", {
        operation: "select",
        select: "id,email,hs_raw",
        filters: [{ op: "eq", field: "id", value: contact }],
      }),
    );
    assert(
      x.data.length === 1 && x.data[0].email === null && x.data[0].hs_raw === null,
      "API plaintext",
    );
  });
  await check("public API predicate cannot query a masked email", async () => {
    const x = must(
      await port("contacts", {
        operation: "select",
        select: "id",
        filters: [{ op: "eq", field: "email", value: "iso-secret@example.invalid" }],
      }),
    );
    assert(x.data.length === 0, "API search oracle");
  });
  await check("public API write response cannot leak masked RETURNING", async () => {
    const x = must(
      await port("contacts", {
        operation: "update",
        select: "id,email,last_name",
        payload: { last_name: "[ISO API changed]" },
        filters: [{ op: "eq", field: "id", value: contact }],
      }),
    );
    assert(x.data.length === 1 && x.data[0].email === null, "RETURNING leaked");
  });
  await seed("field_permission_rules", {
    workspace_id: W,
    owner_id: O,
    resource: "techsales.contacts",
    field: "phone",
    mode: "masked",
    role_id: R,
    is_system: false,
  });
  await check("phone derivatives cannot reveal masked phone", async () => {
    const x = must(
      await p
        .from("contacts")
        .select("phone,phone_digits,whatsapp_e164,whatsapp_digits")
        .eq("id", contact)
        .single(),
    );
    assert(
      Object.values(x).every((v) => v === null),
      "Phone derivative leaked",
    );
  });
  await check("physical phone search index remains inaccessible", async () =>
    blocked(await h.from("contacts").select("id").eq("phone_digits", "5548999999999")),
  );
  await check("phone restriction does not block unrelated edits or generated indices", async () =>
    must(
      await p
        .from("contacts")
        .update({ last_name: "[ISO safe phone update]" })
        .eq("id", contact)
        .select("id")
        .single(),
    ),
  );
  const deal = await seed("deals", {
    workspace_id: W,
    owner_id: u,
    name: "[ISO fields deal]",
    value: 12345,
  });
  const line = await seed("deal_line_items", {
    workspace_id: W,
    owner_id: u,
    deal_id: deal,
    name: "[ISO fields line]",
    quantity: 1,
    unit_price: 12345,
  });
  await check("unrestricted line values remain available through caller RLS", async () =>
    assert(
      must(await p.from("deal_line_items").select("id,unit_price").eq("id", line).single())
        .unit_price === 12345,
      "Line missing",
    ),
  );
  await seed("field_permission_rules", {
    workspace_id: W,
    owner_id: O,
    resource: "techsales.deals",
    field: "value",
    mode: "masked",
    role_id: R,
    is_system: false,
  });
  await check("masked deal amount also masks line financial mirrors", async () => {
    const x = must(
      await p
        .from("deal_line_items")
        .select("id,unit_price,discount_pct,tax_rate,discount_amount,percent,percent_base_amount")
        .eq("id", line)
        .single(),
    );
    assert(
      Object.entries(x).every(([k, v]) => k === "id" || v === null),
      "Line amount leaked",
    );
  });
  await check("raw line financial columns cannot bypass projection", async () =>
    blocked(await h.from("deal_line_items").select("unit_price").eq("id", line)),
  );
  await check("public API cannot leak masked line prices", async () => {
    const x = must(
      await port("deal_line_items", {
        operation: "select",
        select: "id,unit_price",
        filters: [{ field: "id", op: "eq", value: line }],
      }),
    );
    assert(x.data.length === 1 && x.data[0].unit_price === null, "API line leaked");
  });
  await grant(["techsales.contacts.view.own"], "deny");
  await check("view role still honors record permission denial", async () =>
    assert(
      must(await h.from("shared_fields_contacts").select("id,email").eq("id", contact)).length ===
        0,
      "view role bypassed deny",
    ),
  );
  const anon = createClient(cfg.API_URL, cfg.ANON_KEY, opt);
  await check("anonymous access to field views is blocked", async () =>
    blocked(await anon.from("shared_fields_contacts").select("id,email").limit(1)),
  );
  await check("inactive JWT cannot use field views", async () =>
    assert(
      must(await clients[2].from("shared_fields_contacts").select("id,email").eq("id", contact))
        .length === 0,
      "inactive view leak",
    ),
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
    root + "/order5-fields-acceptance.json",
    JSON.stringify({ results, passed: results.every((x) => x.passed), external_sends: 0 }, null, 2),
  );
}
if (results.some((x) => !x.passed)) process.exitCode = 1;
