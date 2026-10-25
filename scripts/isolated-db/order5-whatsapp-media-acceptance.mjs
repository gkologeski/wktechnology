import { execFileSync } from "node:child_process";
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
const keys = ["view", "create"].flatMap((a) =>
  ["own", "team", "workspace"].map((s) => "techsales.inbox.whatsapp." + a + "." + s),
);
const before = must(
  await admin
    .from("job_role_permission_overrides")
    .select("*")
    .eq("workspace_id", W)
    .eq("role_id", R),
).filter((x) => keys.includes(x.permission_key));
writeFileSync(root + "/order5-whatsapp-media-overrides-before.json", JSON.stringify(before));
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
  const bucket = "whatsapp-media",
    path = u + "/out/iso-order5-" + crypto.randomUUID() + ".pdf";
  const buckets = must(await admin.storage.listBuckets());
  if (!buckets.some((b) => b.id === bucket)) {
    must(await admin.storage.createBucket(bucket, { public: false }));
    createdBuckets.push(bucket);
  }
  await check("WhatsApp upload requires current channel permission", async () =>
    blocked(await h.storage.from(bucket).upload(path, new Uint8Array([1, 2, 3]))),
  );
  await grant(["techsales.inbox.whatsapp.view.own", "techsales.inbox.whatsapp.create.own"]);
  must(
    await h.storage
      .from(bucket)
      .upload(path, new Uint8Array([1, 2, 3]), { contentType: "application/pdf" }),
  );
  storageObjects.push([bucket, path]);
  await check("recent own unsent WhatsApp upload can be signed", async () =>
    assert(
      !!must(await h.storage.from(bucket).createSignedUrl(path, 60)).signedUrl,
      "Missing signed upload",
    ),
  );
  const signed = must(await h.storage.from(bucket).createSignedUrl(path, 60)).signedUrl;
  await check("signed media URL is normalized to its literal object path", async () =>
    assert(
      must(await h.rpc("shared_whatsapp_storage_path", { u: signed })) === path,
      "URL path mismatch",
    ),
  );
  await check("external media URLs cannot masquerade as storage paths", async () =>
    assert(
      must(
        await h.rpc("shared_whatsapp_storage_path", {
          u: "https://example.invalid/whatsapp-media/" + path,
        }),
      ) === null,
      "External path accepted",
    ),
  );
  const conversation = await seed("whatsapp_conversations", {
    workspace_id: W,
    owner_id: u,
    assigned_to: u,
    contact_phone: "+5511900000000",
    twilio_number: "+5511300000000",
  });
  await seed("whatsapp_messages", {
    workspace_id: W,
    owner_id: u,
    conversation_id: conversation,
    direction: "outbound",
    from_number: "+5511300000000",
    to_number: "+5511900000000",
    body: "[ISO media reference]",
    media_url: signed,
  });
  await check("registered signed-URL media remains readable in authorized conversation", async () =>
    assert(must(await h.storage.from(bucket).download(path)).size === 3, "Registered media denied"),
  );
  await check("registered message media cannot be deleted as an unsent upload", async () =>
    assert(
      must(await h.rpc("shared_storage_access", { b: bucket, p: path, a: "delete" })) === false,
      "Registered delete allowed",
    ),
  );
  must(
    await admin.from("whatsapp_conversations").update({ assigned_to: peer }).eq("id", conversation),
  );
  await check("reassignment revokes media even from historical upload owner", async () =>
    blocked(await h.storage.from(bucket).download(path)),
  );
  await check("conversation revocation cannot fall back to pending-upload access", async () =>
    assert(
      must(await h.rpc("shared_storage_access", { b: bucket, p: path, a: "view" })) === false,
      "Pending fallback bypass",
    ),
  );
  must(
    await admin.from("whatsapp_conversations").update({ assigned_to: u }).eq("id", conversation),
  );
  await grant(["techsales.inbox.whatsapp.view.own"], "deny");
  await check("channel denial revokes registered media immediately", async () =>
    blocked(await h.storage.from(bucket).download(path)),
  );
  await grant(["techsales.inbox.whatsapp.view.own"]);
  const stale = u + "/out/iso-order5-" + crypto.randomUUID() + ".pdf";
  must(await h.storage.from(bucket).upload(stale, new Uint8Array([1, 2, 3])));
  storageObjects.push([bucket, stale]);
  const docker = process.env.ISO_DOCKER_BIN;
  if (!docker) throw Error("Explicit isolated Docker executable required for time fixture");
  execFileSync(
    docker,
    [
      "exec",
      "-i",
      "supabase_db_techerp-permissions-20261023",
      "psql",
      "-U",
      "supabase_admin",
      "-d",
      "postgres",
      "-v",
      "ON_ERROR_STOP=1",
      "-v",
      "media_path=" + stale,
    ],
    {
      input:
        "DO $$BEGIN IF NOT EXISTS(SELECT 1 FROM public.__isolated_marker WHERE label='techerp-isolated-harness') THEN RAISE EXCEPTION 'isolated only';END IF;END$$;\nUPDATE storage.objects SET created_at=now()-interval '2 hours' WHERE bucket_id='whatsapp-media' AND name=:'media_path';\n",
      stdio: ["pipe", "pipe", "pipe"],
    },
  );
  await check("expired unsent upload cannot issue a new signed URL", async () =>
    blocked(await h.storage.from(bucket).createSignedUrl(stale, 60)),
  );
  const servicePath = u + "/out/iso-order5-" + crypto.randomUUID() + ".pdf";
  must(await admin.storage.from(bucket).upload(servicePath, new Uint8Array([1, 2, 3])));
  storageObjects.push([bucket, servicePath]);
  await check("user prefix does not authorize an unowned service upload", async () =>
    blocked(await h.storage.from(bucket).download(servicePath)),
  );
  await check("inactive JWT cannot access registered WhatsApp media", async () =>
    blocked(await clients[2].storage.from(bucket).download(path)),
  );
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
    root + "/order5-whatsapp-media-acceptance.json",
    JSON.stringify({ results, passed: results.every((x) => x.passed), external_sends: 0 }, null, 2),
  );
}
if (results.some((x) => !x.passed)) process.exitCode = 1;
