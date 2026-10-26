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
writeFileSync(root + "/order4-http-overrides-before.json", JSON.stringify(before));
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
  const raw = `lvb_${randomUUID().replaceAll("-", "")}${randomUUID().replaceAll("-", "")}`;
  const key = await seed("api_keys", {
    workspace_id: W,
    owner_id: u,
    name: "[ISO HTTP]",
    prefix: raw.slice(0, 10),
    key_hash: createHash("sha256").update(raw).digest("hex"),
    scopes: ["read", "write"],
  });
  const own = await seed("leads", { workspace_id: W, owner_id: u, first_name: "[ISO HTTP own]" });
  const away = await seed("leads", {
    workspace_id: W,
    owner_id: u,
    assigned_to: peer,
    first_name: "[ISO HTTP reassigned]",
  });
  const foreign = await seed("leads", {
    workspace_id: B,
    owner_id: "10000000-0000-4000-8000-000000000006",
    first_name: "[ISO HTTP foreign]",
  });
  const request = async (method = "GET", body) => {
    const r = await fetch("http://127.0.0.1:5176/api/public/v1/leads", {
      method,
      headers: { authorization: `Bearer ${raw}`, "content-type": "application/json" },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { status: r.status, data: await r.json() };
  };
  await check("HTTP API rejects missing authentication", async () =>
    assert(
      (await fetch("http://127.0.0.1:5176/api/public/v1/leads")).status === 401,
      "unauthenticated API",
    ),
  );
  await check("HTTP API denies valid credentials without module read", async () =>
    assert((await request()).status === 403, "read permission ignored"),
  );
  await grant(["techsales.leads.view.own"]);
  await check("HTTP API uses current assignment and excludes foreign workspaces", async () => {
    const r = await request();
    assert(r.status === 200, "read failed");
    const ids = r.data.data.map((x) => x.id);
    assert(ids.includes(own) && !ids.includes(away) && !ids.includes(foreign), "scope leaked");
  });
  await check("HTTP API read does not permit creation", async () =>
    assert(
      (await request("POST", { first_name: "[ISO HTTP blocked]" })).status === 403,
      "create permission ignored",
    ),
  );
  await grant(["techsales.leads.create.own"]);
  await check("HTTP API creation captures immutable owner and workspace", async () => {
    const r = await request("POST", { first_name: "[ISO HTTP created]" });
    if (r.data.data?.id) fixtures.push(["leads", r.data.data.id]);
    assert(r.status === 201, "creation status " + r.status + " " + (r.data.error ?? ""));
    const created = must(
      await admin.from("leads").select("workspace_id,owner_id").eq("id", r.data.data.id).single(),
    );
    assert(created.workspace_id === W && created.owner_id === u, "source wrong");
  });
  must(
    await admin
      .from("api_keys")
      .update({ scopes: ["read"] })
      .eq("id", key),
  );
  await check("HTTP key read scope cannot write even when owner can create", async () =>
    assert(
      (await request("POST", { first_name: "[ISO HTTP key blocked]" })).status === 403,
      "key scope ignored",
    ),
  );
  must(await admin.from("api_keys").update({ revoked_at: new Date().toISOString() }).eq("id", key));
  await check("HTTP revoked key is rejected", async () =>
    assert((await request()).status === 401, "revoked key accepted"),
  );
  // Realtime uses real JWT and per-record subscriptions; only synthetic rows change.
  const events = [];
  const channels = [];
  const subscribe = async (table, id) => {
    const channel = h
      .channel("iso-order4-" + randomUUID())
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table, filter: `id=eq.${id}` },
        (payload) => events.push({ table, id: payload.new.id, keys: Object.keys(payload.new) }),
      );
    channels.push(channel);
    await new Promise((resolve, reject) => {
      let joined = false,
        postgresReady = false;
      const timer = setTimeout(
        () => reject(Error("realtime database subscription timeout")),
        20000,
      );
      const ready = () => {
        if (joined && postgresReady) {
          clearTimeout(timer);
          resolve();
        }
      };
      // A websocket join is not yet a confirmed Postgres Changes subscription.
      // Match the production hook: wait for the server's database acknowledgement.
      channel.on("system", {}, (p) => {
        if (p.extension !== "postgres_changes") return;
        if (p.status === "error") {
          clearTimeout(timer);
          reject(Error("realtime database subscription rejected"));
        }
        if (p.status === "ok") {
          postgresReady = true;
          ready();
        }
      });
      channel.subscribe((status) => {
        if (status === "SUBSCRIBED") {
          joined = true;
          ready();
        } else if (["CHANNEL_ERROR", "TIMED_OUT"].includes(status)) {
          clearTimeout(timer);
          reject(Error("realtime unavailable"));
        }
      });
    });
  };
  const waitFor = async (test, ms = 5000) => {
    const start = Date.now();
    while (Date.now() - start < ms) {
      if (test()) return;
      await new Promise((r) => setTimeout(r, 100));
    }
    throw Error("realtime event timeout");
  };
  try {
    await subscribe("leads", own);
    await subscribe("leads", away);
    await subscribe("leads", foreign);
    await check("realtime delivers an authorized own lead update", async () => {
      assert(
        must(await h.from("leads").select("id").eq("id", own)).length === 1,
        "JWT read denied",
      );
      must(await admin.from("leads").update({ notes: "[ISO realtime permitted]" }).eq("id", own));
      await waitFor(() => events.some((e) => e.id === own));
    });
    events.length = 0;
    await check("realtime does not deliver reassigned or foreign lead updates", async () => {
      must(
        await admin
          .from("leads")
          .update({ notes: "[ISO realtime hidden]" })
          .in("id", [away, foreign]),
      );
      await new Promise((r) => setTimeout(r, 1500));
      assert(!events.some((e) => e.id === away || e.id === foreign), "realtime leaked");
    });
    await grant(["techsales.contacts.view.own"]);
    const contact = await seed("contacts", {
      workspace_id: W,
      owner_id: u,
      first_name: "[ISO realtime contact]",
    });
    await subscribe("contacts", contact);
    await check("realtime contact events preserve column privacy", async () => {
      must(
        await admin.from("contacts").update({ notes: "[ISO realtime contact]" }).eq("id", contact),
      );
      await waitFor(() => events.some((e) => e.id === contact));
      const event = events.find((e) => e.id === contact);
      assert(!event.keys.includes("portal_token"), "private token in realtime");
    });
    events.length = 0;
    await grant(["techsales.leads.view.own"], "deny");
    await check("realtime stops delivery after read permission is revoked", async () => {
      must(await admin.from("leads").update({ notes: "[ISO after revoke]" }).eq("id", own));
      await new Promise((r) => setTimeout(r, 1500));
      assert(!events.some((e) => e.id === own), "revoked realtime read");
    });
  } finally {
    for (const channel of channels) await h.removeChannel(channel);
  }
} finally {
  const leftovers = must(
    await admin
      .from("leads")
      .select("id")
      .eq("workspace_id", W)
      .eq("owner_id", u)
      .eq("first_name", "[ISO HTTP created]"),
  );
  for (const row of leftovers)
    if (!fixtures.some(([t, id]) => t === "leads" && id === row.id))
      fixtures.push(["leads", row.id]);
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
    root + "/order4-http-acceptance.json",
    JSON.stringify({ results, passed: results.every((x) => x.passed), external_sends: 0 }, null, 2),
  );
}
if (results.some((x) => !x.passed)) process.exitCode = 1;
