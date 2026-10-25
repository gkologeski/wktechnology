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
writeFileSync(root + "/order5-shared-overrides-before.json", JSON.stringify(before));
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
const storageObjects = [],
  createdBuckets = [];
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
  const own = await seed("user_files", {
      owner_id: u,
      workspace_id: W,
      name: "[ISO shared own]",
      storage_path: u + "/iso-own",
      size_bytes: 3,
    }),
    other = await seed("user_files", {
      owner_id: peer,
      workspace_id: W,
      name: "[ISO shared peer]",
      storage_path: peer + "/iso-peer",
      size_bytes: 3,
    }),
    foreign = await seed("user_files", {
      owner_id: accounts[3].id,
      workspace_id: B,
      name: "[ISO shared foreign]",
      storage_path: accounts[3].id + "/iso-away",
      size_bytes: 3,
    });
  const fileIds = [own, other, foreign];
  await check("Storage session requires selected active membership", async () =>
    assert(
      must(await h.rpc("shared_storage_session_access", { a: "view" })) === true,
      "Active session denied",
    ),
  );
  await check("inactive session cannot use any bucket policy", async () =>
    assert(
      must(await clients[2].rpc("shared_storage_session_access", { a: "view" })) === false,
      "Inactive Storage session allowed",
    ),
  );

  const buckets = must(await admin.storage.listBuckets());
  if (!buckets.some((b) => b.id === "user-files")) {
    must(await admin.storage.createBucket("user-files", { public: false }));
    createdBuckets.push("user-files");
  }
  must(
    await admin.storage.from("user-files").upload(u + "/iso-own", new Uint8Array([1, 2, 3]), {
      contentType: "application/octet-stream",
      upsert: false,
    }),
  );
  storageObjects.push(["user-files", u + "/iso-own"]);
  await check("Storage denies own path without file permission", async () =>
    blocked(await h.storage.from("user-files").download(u + "/iso-own")),
  );

  await check("creator without files key has no records", async () =>
    assert((await ids("user_files", fileIds)).length === 0, "creator bypass"),
  );
  await check("file gate denies a missing key", async () =>
    blocked(await h.rpc("shared_area_authorize", { r: "system.files", a: "view" })),
  );
  await grant(["system.files.view.own", "system.files.update.own"]);
  await check("own file permission has actual ownership scope", async () =>
    assert(
      JSON.stringify(await ids("user_files", fileIds)) === JSON.stringify([own]),
      "scope leak",
    ),
  );
  await check("raw public token column is inaccessible", async () =>
    blocked(await h.from("user_files").select("public_token").eq("id", own)),
  );
  await check("editing a file does not authorize sharing", async () =>
    blocked(await h.rpc("shared_file_share", { i: own, enabled: true })),
  );
  await check("direct sharing cannot bypass its own action", async () =>
    blocked(
      await h
        .from("user_files")
        .update({ is_public: true, public_token: "iso-forbidden" })
        .eq("id", own)
        .select("id"),
    ),
  );
  await check("download requires its own action", async () =>
    blocked(await h.rpc("shared_file_authorize", { t: "user_files", i: own, a: "export" })),
  );
  await check("Storage requires export even when file metadata is visible", async () =>
    blocked(await h.storage.from("user-files").download(u + "/iso-own")),
  );
  await grant(["system.files.export.own", "system.files_share.manage.own"]);
  await check("Storage allows authorized own download", async () =>
    assert(
      must(await h.storage.from("user-files").download(u + "/iso-own")).size === 3,
      "Download missing",
    ),
  );
  await check("Storage cannot overwrite registered file bytes", async () =>
    blocked(
      await h.storage
        .from("user-files")
        .upload(u + "/iso-own", new Uint8Array([4, 5, 6]), { upsert: true }),
    ),
  );

  let token;
  await check("authorized owner can create scoped public link", async () => {
    token = must(await h.rpc("shared_file_share", { i: own, enabled: true })).public_token;
    assert(token.length >= 48, "weak token");
    assert(
      must(await admin.rpc("shared_public_file_available", { i: own })) === true,
      "link denied",
    );
  });
  await check("private publication proof RPC is not user callable", async () =>
    blocked(await h.rpc("shared_public_file_available", { i: own })),
  );
  await check("row capabilities match precise file actions", async () => {
    let c = must(await h.rpc("shared_file_capabilities", { t: "user_files", ids: [own, other] }));
    assert(
      c.length === 1 &&
        c[0].can_update &&
        c[0].can_export &&
        c[0].can_share &&
        !c[0].can_delete &&
        c[0].public_token === token,
      "capabilities mismatch",
    );
  });
  await grant(["system.files_share.manage.own"], "deny");
  await check("revoking publisher permission disables public download", async () =>
    assert(
      must(await admin.rpc("shared_public_file_available", { i: own })) === false,
      "revoked link remains active",
    ),
  );
  await check("viewer cannot retrieve token after share denial", async () =>
    assert(
      must(await h.rpc("shared_file_capabilities", { t: "user_files", ids: [own] }))[0]
        .public_token === null,
      "token leaked",
    ),
  );
  group = must(
    await admin
      .from("user_groups")
      .insert({ workspace_id: W, name: "[ISO order5 team]" })
      .select("id")
      .single(),
  ).id;
  must(
    await admin.from("user_group_members").insert([
      { group_id: group, user_id: u },
      { group_id: group, user_id: peer },
    ]),
  );
  await grant(["system.files.view.team"]);
  await check("team scope includes actual teammate only", async () =>
    assert((await ids("user_files", fileIds)).length === 2, "team scope"),
  );
  await grant(["system.files.view.workspace"]);
  await check("workspace scope never exposes another tenant", async () =>
    assert((await ids("user_files", fileIds)).length === 2, "tenant leak"),
  );
  await check("inactive JWT cannot read shared records", async () =>
    assert(
      must(await clients[2].from("user_files").select("id").in("id", fileIds)).length === 0,
      "inactive leak",
    ),
  );
  await check("foreign JWT cannot read selected tenant", async () =>
    assert(
      must(await clients[3].from("user_files").select("id").eq("id", own)).length === 0,
      "foreign leak",
    ),
  );
  await check("quota helper is caller-bound", async () =>
    blocked(await h.rpc("user_files_used_bytes", { uid: peer })),
  );
  await check("caller can read their own quota", async () =>
    assert(
      typeof must(await h.rpc("user_files_used_bytes", { uid: u })) === "number",
      "quota failed",
    ),
  );
  await check("missing custom object permissions hide metadata", async () =>
    assert(
      must(await h.from("custom_objects").select("id").limit(1)).length === 0,
      "metadata bypass",
    ),
  );
  await grant([
    "system.custom_objects.view.workspace",
    "system.custom_objects.create.workspace",
    "system.custom_objects.update.workspace",
  ]);
  let obj;
  await check("custom object definition follows matrix create", async () => {
    obj = must(
      await h
        .from("custom_objects")
        .insert({
          owner_id: u,
          workspace_id: W,
          name: "[ISO shared schema]",
          slug: "iso-shared-" + Date.now(),
          schema: [],
        })
        .select("id")
        .single(),
    ).id;
    fixtures.push(["custom_objects", obj]);
  });
  await check("custom record cannot reference a foreign object", async () => {
    const f = await seed("custom_objects", {
      owner_id: accounts[3].id,
      workspace_id: B,
      name: "[ISO foreign schema]",
      slug: "iso-foreign-" + Date.now(),
      schema: [],
    });
    blocked(
      await h
        .from("custom_object_records")
        .insert({ owner_id: u, workspace_id: W, object_id: f, data: {} }),
    );
  });
  await check("custom object author is immutable", async () =>
    blocked(await h.from("custom_objects").update({ owner_id: peer }).eq("id", obj).select("id")),
  );
  await check("security JSON is not directly selectable", async () =>
    blocked(await h.from("workspaces").select("security_settings").eq("id", W)),
  );
  await check("security settings denied without key", async () =>
    blocked(await h.rpc("shared_security_settings", { p: null })),
  );
  await grant(["system.settings.view.workspace"]);
  await check("security viewer may read scoped settings", async () =>
    assert(
      must(await h.rpc("shared_security_settings", { p: null })).workspaceId === W,
      "workspace mismatch",
    ),
  );
  await check("security viewer cannot mutate settings", async () =>
    blocked(await h.rpc("shared_security_settings", { p: { region: "BR" } })),
  );
  await check("direct protected region mutation is denied", async () =>
    blocked(await h.from("workspaces").update({ data_region: "EU" }).eq("id", W)),
  );
  await grant(["system.settings.manage.workspace"]);
  for (const [name, security] of [
    ["boolean", { require_mfa: "yes" }],
    ["minimum timeout", { session_timeout_minutes: 0 }],
    ["maximum timeout", { session_timeout_minutes: 1441 }],
    ["fractional timeout", { session_timeout_minutes: 15.5 }],
    ["IP list type", { ip_allowlist: "*" }],
    ["IP member type", { ip_allowlist: [4] }],
    ["IP list size", { ip_allowlist: Array(51).fill("127.0.0.1") }],
  ])
    await check("security RPC rejects invalid " + name, async () =>
      blocked(await h.rpc("shared_security_settings", { p: { security } })),
    );
  await check("security RPC rejects null region", async () =>
    blocked(await h.rpc("shared_security_settings", { p: { region: null } })),
  );
  await grant(["system.settings.manage.workspace"], "deny");
  await check("AI settings require their own view key", async () =>
    blocked(await h.rpc("shared_area_authorize", { r: "system.ai_settings", a: "view" })),
  );
  await grant(["system.ai_settings.view.workspace"]);
  await check("AI view alone cannot operate credentials or spend on tests", async () =>
    blocked(await h.rpc("shared_area_authorize", { r: "system.ai_settings", a: "manage" })),
  );
  await grant([
    "system.messenger.view.own",
    "system.messenger.create.own",
    "system.messenger.manage.own",
  ]);
  let conv;
  await check("atomic DM validates both active members", async () => {
    conv = must(
      await h.rpc("shared_chat_write", { a: "dm", p: { members: [peer] } }),
    ).conversation_id;
    fixtures.push(["chat_conversations", conv]);
  });
  await check("DM is reused without duplicate conversation", async () =>
    assert(
      must(await h.rpc("shared_chat_write", { a: "dm", p: { members: [peer] } }))
        .conversation_id === conv,
      "duplicate DM",
    ),
  );
  await check("cannot start a conversation with foreign user", async () =>
    blocked(await h.rpc("shared_chat_write", { a: "dm", p: { members: [accounts[3].id] } })),
  );
  await check("cannot start a conversation with inactive member", async () =>
    blocked(await h.rpc("shared_chat_write", { a: "dm", p: { members: [accounts[2].id] } })),
  );
  await check("conversation membership cannot be inserted directly", async () =>
    blocked(
      await h.from("chat_conversation_members").insert({ conversation_id: conv, user_id: O }),
    ),
  );
  await check("sender cannot be forged via raw message insert", async () =>
    blocked(
      await h.from("chat_messages").insert({
        conversation_id: conv,
        workspace_owner_id: W,
        sender_user_id: peer,
        body: "[ISO forbidden]",
      }),
    ),
  );
  let message = crypto.randomUUID();
  await check("authorized message stores caller as sender", async () => {
    must(
      await h.rpc("shared_chat_write", {
        a: "send",
        p: {
          conversation_id: conv,
          message_id: message,
          body: "[ISO shared message]",
          attachments: [],
        },
      }),
    );
    assert(
      must(await h.from("chat_messages").select("sender_user_id").eq("id", message).single())
        .sender_user_id === u,
      "sender mismatch",
    );
  });
  await check("message attachments cannot refer to another conversation", async () =>
    blocked(
      await h.rpc("shared_chat_write", {
        a: "send",
        p: {
          conversation_id: conv,
          message_id: crypto.randomUUID(),
          body: "[ISO forbidden attachment]",
          attachments: [
            { storage_path: "ws/" + crypto.randomUUID() + "/foreign.pdf", file_name: "x.pdf" },
          ],
        },
      }),
    ),
  );
  await check("foreign member cannot read internal messages", async () =>
    assert(
      must(await clients[3].from("chat_messages").select("id").eq("id", message)).length === 0,
      "message leak",
    ),
  );
  await check("inactive member cannot read internal messages", async () =>
    assert(
      must(await clients[2].from("chat_messages").select("id").eq("id", message)).length === 0,
      "inactive message leak",
    ),
  );
  await grant(["system.messenger.view.own"], "deny");
  await check("messenger deny revokes existing participant", async () =>
    assert(
      must(await h.from("chat_messages").select("id").eq("id", message)).length === 0,
      "participant bypass",
    ),
  );
  await check("messenger deny also revokes attachment storage helper", async () =>
    assert(
      must(await h.rpc("is_chat_member", { _conv: conv, _user: u })) === false,
      "storage helper bypass",
    ),
  );
  await grant(["techsales.leads.view.own", "techsales.leads.create.own"]);
  const lead = await seed("leads", {
    owner_id: u,
    workspace_id: W,
    first_name: "[ISO search source]",
  });
  await check("search reference proof follows current record RLS", async () =>
    assert(
      must(await h.rpc("shared_search_item_access", { e: "contact", i: crypto.randomUUID() })) ===
        false,
      "unknown source",
    ),
  );
  const contact = await seed("contacts", {
    owner_id: u,
    workspace_id: W,
    first_name: "[ISO pinned source]",
  });
  await grant(["techsales.contacts.view.own"]);
  must(
    await h.from("search_pinned").insert({
      user_id: u,
      entity_type: "contact",
      entity_id: contact,
      title: "[ISO pinned]",
      url: "/contacts/" + contact,
    }),
  );
  await check("pinned source is initially visible", async () =>
    assert(
      must(await h.from("search_pinned").select("id").eq("entity_id", contact)).length === 1,
      "pin missing",
    ),
  );
  await grant(["techsales.contacts.view.own"], "deny");
  await check("source revocation hides cached pinned title", async () =>
    assert(
      must(await h.from("search_pinned").select("id").eq("entity_id", contact)).length === 0,
      "stale title leak",
    ),
  );
  await admin.from("search_pinned").delete().eq("entity_id", contact).then(must);
  const session = must(await h.auth.getSession()).session,
    claims = JSON.parse(Buffer.from(session.access_token.split(".")[1], "base64url").toString());
  const view = await seed("view_as_sessions", {
    workspace_id: W,
    admin_id: O,
    target_user_id: u,
    mode: "role",
    role_id: R,
    read_only: true,
    nonce: "iso-order5-" + Date.now(),
    session_id: claims.session_id,
    expires_at: new Date(Date.now() + 60000).toISOString(),
  });
  await grant([
    "system.settings.manage.workspace",
    "system.ai_settings.manage.workspace",
    "system.messenger.view.own",
  ]);
  for (const r of [
    "system.files",
    "system.ai_settings",
    "system.settings",
    "system.custom_objects",
    "system.messenger",
  ])
    await check("read-only preview cannot mutate " + r, async () =>
      blocked(
        await h.rpc("shared_area_authorize", {
          r,
          a:
            r === "system.files" || r === "system.custom_objects"
              ? "update"
              : r === "system.messenger"
                ? "create"
                : "manage",
        }),
      ),
    );
  for (const action of ["create", "update", "delete"])
    await check("read-only Storage session rejects " + action, async () =>
      assert(
        must(await h.rpc("shared_storage_session_access", { a: action })) === false,
        "Read-only Storage write allowed",
      ),
    );
  await check("read-only preview cannot publish files", async () =>
    blocked(await h.rpc("shared_file_share", { i: own, enabled: true })),
  );
  await admin.from("view_as_sessions").delete().eq("id", view).then(must);
} finally {
  for (const [bucket, path] of storageObjects)
    must(await admin.storage.from(bucket).remove([path]));
  for (const bucket of createdBuckets) must(await admin.storage.deleteBucket(bucket));
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
    root + "/order5-shared-acceptance.json",
    JSON.stringify({ results, passed: results.every((x) => x.passed), external_sends: 0 }, null, 2),
  );
}
if (results.some((x) => !x.passed)) process.exitCode = 1;
