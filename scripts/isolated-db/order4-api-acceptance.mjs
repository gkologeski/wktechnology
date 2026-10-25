// Real JWT/PostgREST acceptance. Synthetic fixtures; no external deliveries.
import { readFileSync, writeFileSync } from "node:fs";
import { createHash, randomUUID } from "node:crypto";
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
writeFileSync(root + "/order4-api-overrides-before.json", JSON.stringify(before));
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
const profileBefore = must(
  await admin.from("profiles").select("active_workspace_id").eq("id", u).single(),
);
const memberBefore = must(
  await admin
    .from("workspace_members")
    .select("status")
    .eq("workspace_id", W)
    .eq("user_id", u)
    .single(),
);
const port = (key, table, query, subject = u, workspace = W) =>
  admin.rpc("sales_api_query", {
    p_key: key,
    p_user: subject,
    p_ws: workspace,
    p_table: table,
    p_query: query,
  });
try {
  await grant(keys, "deny");
  const own = await seed("leads", {
      workspace_id: W,
      owner_id: u,
      first_name: "[ISO order4 API own]",
    }),
    other = await seed("leads", {
      workspace_id: W,
      owner_id: O,
      first_name: "[ISO order4 API other]",
    }),
    foreign = await seed("leads", {
      workspace_id: B,
      owner_id: accounts[3].id,
      first_name: "[ISO order4 API foreign]",
    });
  const key = await seed("api_keys", {
      owner_id: u,
      workspace_id: W,
      name: "[ISO order4 API]",
      prefix: "lvb_iso4",
      key_hash: createHash("sha256").update(randomUUID()).digest("hex"),
      scopes: ["read", "write"],
    }),
    readOnly = await seed("api_keys", {
      owner_id: u,
      workspace_id: W,
      name: "[ISO order4 API readonly]",
      prefix: "lvb_iso4r",
      key_hash: createHash("sha256").update(randomUUID()).digest("hex"),
      scopes: ["read"],
    });
  const query = {
    operation: "select",
    select: "id,first_name",
    filters: [{ field: "id", op: "in", value: [own, other, foreign] }],
  };
  await check("API key scope cannot replace a missing resource permission", async () =>
    blocked(await port(key, "leads", query)),
  );
  await grant(["techsales.leads.view.own"]);
  await check("API owner RLS limits own records", async () => {
    const r = must(await port(key, "leads", query));
    assert(r.count === 1 && r.data.length === 1 && r.data[0].id === own, "API own scope");
  });
  await grant(["techsales.leads.view.workspace"]);
  await check("API workspace scope never crosses the key tenant", async () => {
    const r = must(await port(key, "leads", query));
    assert(r.count === 2 && r.data.every((x) => x.id !== foreign), "API cross tenant");
  });
  await grant(["techsales.leads.view.workspace"], "deny");
  await check("API honors an explicit deny while retaining own scope", async () =>
    assert(must(await port(key, "leads", query)).count === 1, "API deny ignored"),
  );
  await check("API rejects a forged key-owner tuple", async () =>
    blocked(await port(key, "leads", query, peer)),
  );
  await check("API rejects a forged key-workspace tuple", async () =>
    blocked(await port(key, "leads", query, u, B)),
  );
  await check("authenticated JWT cannot execute the service-only API port", async () =>
    blocked(
      await h.rpc("sales_api_query", {
        p_key: key,
        p_user: u,
        p_ws: W,
        p_table: "leads",
        p_query: query,
      }),
    ),
  );
  await check("API rejects arbitrary tables", async () =>
    blocked(await port(key, "api_keys", { operation: "select", select: "*" })),
  );
  await check("API rejects private credential selections", async () =>
    blocked(await port(key, "contacts", { operation: "select", select: "portal_token" })),
  );
  await check("API rejects SQL injection through filter field", async () =>
    blocked(
      await port(key, "leads", {
        ...query,
        filters: [{ field: "id) OR true --", op: "eq", value: own }],
      }),
    ),
  );
  await check("API rejects arbitrary SQL operators", async () =>
    blocked(
      await port(key, "leads", {
        ...query,
        filters: [{ field: "id", op: "eq;select", value: own }],
      }),
    ),
  );
  await grant(["techsales.leads.create.own"]);
  await check("read-only API key cannot write despite owner create permission", async () =>
    blocked(
      await port(readOnly, "leads", {
        operation: "insert",
        select: "id",
        payload: { first_name: "[ISO forbidden]" },
      }),
    ),
  );
  await check("API creates a row bound to the actual key owner/workspace", async () => {
    const r = must(
      await port(key, "leads", {
        operation: "insert",
        select: "id,owner_id,workspace_id",
        payload: { first_name: "[ISO API create]", owner_id: accounts[3].id, workspace_id: B },
      }),
    );
    fixtures.push(["leads", r.data[0].id]);
    assert(r.data[0].owner_id === u && r.data[0].workspace_id === W, "API forged origin");
  });
  await check("API cannot write fields outside its declared schema", async () =>
    blocked(
      await port(key, "leads", {
        operation: "insert",
        select: "id",
        payload: { first_name: "[ISO forbidden]", unknown_column: true },
      }),
    ),
  );
  await check("API cannot update with view/create alone", async () =>
    blocked(
      await port(key, "leads", {
        operation: "update",
        select: "id",
        filters: [{ field: "id", op: "eq", value: own }],
        payload: { notes: "[ISO forbidden]" },
      }),
    ),
  );
  await grant(["techsales.leads.update.own"]);
  await check("API cannot update a record outside own scope", async () =>
    assert(
      must(
        await port(key, "leads", {
          operation: "update",
          select: "id",
          filters: [{ field: "id", op: "eq", value: other }],
          payload: { notes: "[ISO forbidden]" },
        }),
      ).count === 0,
      "API updated another owner",
    ),
  );
  await check("API update preserves the old historical author", async () =>
    blocked(
      await port(key, "leads", {
        operation: "update",
        select: "id",
        filters: [{ field: "id", op: "eq", value: own }],
        payload: { owner_id: peer },
      }),
    ),
  );
  await check(
    "API uses key source workspace instead of a different profile preference",
    async () => {
      must(await admin.from("profiles").update({ active_workspace_id: B }).eq("id", u));
      const r = must(await port(key, "leads", query));
      assert(r.count === 1, "API profile preference bypass");
      must(await admin.from("profiles").update(profileBefore).eq("id", u));
    },
  );
  await check("API fails closed after source owner deactivation", async () => {
    must(
      await admin
        .from("workspace_members")
        .update({ status: "inactive" })
        .eq("workspace_id", W)
        .eq("user_id", u),
    );
    const r = await port(key, "leads", query);
    must(
      await admin
        .from("workspace_members")
        .update(memberBefore)
        .eq("workspace_id", W)
        .eq("user_id", u),
    );
    blocked(r);
  });
  await check("API fails closed after key revocation", async () => {
    must(
      await admin.from("api_keys").update({ revoked_at: new Date().toISOString() }).eq("id", key),
    );
    blocked(await port(key, "leads", query));
    must(await admin.from("api_keys").update({ revoked_at: null }).eq("id", key));
  });
  await check("API filters preserve literal input rather than interpreting SQL", async () => {
    const r = must(
      await port(key, "leads", {
        ...query,
        filters: [{ field: "first_name", op: "eq", value: "' OR true --" }],
      }),
    );
    assert(r.count === 0, "SQL literal interpreted");
  });
} finally {
  must(await admin.from("profiles").update(profileBefore).eq("id", u));
  must(
    await admin
      .from("workspace_members")
      .update(memberBefore)
      .eq("workspace_id", W)
      .eq("user_id", u),
  );
  for (const [t, id] of fixtures.reverse()) must(await admin.from(t).delete().eq("id", id));
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
    root + "/order4-api-acceptance.json",
    JSON.stringify({ results, passed: results.every((x) => x.passed), external_sends: 0 }, null, 2),
  );
}
if (results.some((x) => !x.passed)) process.exitCode = 1;
