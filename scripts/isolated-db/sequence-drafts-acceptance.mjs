// Real local GoTrue JWT/PostgREST acceptance. No messages or production access.
import { readFileSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { newDefinition } from "../../src/lib/prospecting/sequences/draft.ts";
const root = process.env.BANKING_ISOLATED_ROOT;
if (!root) throw Error("Explicit isolated root required");
const cfg = JSON.parse(readFileSync(root + "/status.private.json"));
if (
  cfg.API_URL !== "http://127.0.0.1:54521" ||
  readFileSync(root + "/.isolation-marker", "utf8").trim() !== "techerp-permissions-20261023"
)
  throw Error("Isolated only");
const accounts = JSON.parse(readFileSync(root + "/hr-accounts.private.json"));
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(cfg.API_URL, cfg.SERVICE_ROLE_KEY, options);
const must = (r) => {
  if (r.error) throw Error(r.error.message);
  return r.data;
};
const assert = (x, m) => {
  if (!x) throw Error(m);
};
const blocked = (r) => assert(!!r.error, "Unauthorized mutation succeeded");
assert(
  must(await admin.from("__isolated_marker").select("label")).some(
    (x) => x.label === "techerp-isolated-harness",
  ),
  "Marker missing",
);
const clients = [];
for (const account of accounts) {
  const c = createClient(cfg.API_URL, cfg.ANON_KEY, options);
  must(await c.auth.signInWithPassword({ email: account.email, password: account.password }));
  clients.push(c);
}
const W = "aaaaaaaa-0000-4000-8000-00000000000a",
  B = "aaaaaaaa-0000-4000-8000-00000000000b",
  O = "10000000-0000-4000-8000-000000000001";
const roles = ["30000000-0000-4000-8000-0000000000a8", "30000000-0000-4000-8000-0000000000a9"];
const keys = ["view", "create", "update"].flatMap((a) =>
  ["own", "team", "workspace"].map((s) => `system.automation.sequences.${a}.${s}`),
);
const before = must(
  await admin
    .from("job_role_permission_overrides")
    .select("*")
    .eq("workspace_id", W)
    .in("role_id", roles)
    .in("permission_key", keys),
);
const grant = async (role, list, effect = "grant") =>
  must(
    await admin.from("job_role_permission_overrides").upsert(
      list.map((permission_key) => ({
        workspace_id: W,
        role_id: role,
        permission_key,
        effect,
        created_by: O,
      })),
      { onConflict: "workspace_id,role_id,permission_key" },
    ),
  );
const ids = [],
  results = [];
const check = async (name, fn) => {
  try {
    await fn();
    results.push({ name, passed: true });
    console.log("PASS", name);
  } catch (e) {
    results.push({ name, passed: false, error: e.message });
    console.log("FAIL", name, e.message);
  }
};
const save = (client, id, revision = 0, workspace = W, definition = newDefinition()) =>
  client.rpc("prospecting_sequence_draft_save", {
    p_id: id,
    p_workspace: workspace,
    p_expected_revision: revision,
    p_name: "[ISO] Sequência em rascunho",
    p_definition: definition,
  });
const id = crypto.randomUUID();
ids.push(id);
try {
  for (const role of roles) await grant(role, keys, "deny");
  await grant(
    roles[0],
    ["view", "create", "update"].map((a) => `system.automation.sequences.${a}.own`),
  );
  await check("authorized own draft create sets authenticated owner", async () => {
    const d = must(await save(clients[0], id));
    assert(
      d.owner_id === accounts[0].id && d.workspace_id === W && d.revision === 1,
      "Wrong owner/revision",
    );
  });
  await check("save and reload preserves rich configuration", async () => {
    let definition = newDefinition();
    definition.steps[0].subject = "Consulta da WK";
    must(await save(clients[0], id, 1, W, definition));
    const rows = must(await clients[0].rpc("prospecting_sequence_draft_list", { p_workspace: W }));
    assert(
      rows.find((r) => r.id === id)?.definition.steps[0].subject === "Consulta da WK",
      "Lost configuration",
    );
  });
  await check("conflicting revision cannot overwrite saved definition", async () => {
    blocked(await save(clients[0], id, 1));
    assert(
      must(await admin.from("prospecting_sequence_drafts").select("revision").eq("id", id).single())
        .revision === 2,
      "Conflict mutated row",
    );
  });
  await check("missing permission cannot create or read draft", async () => {
    const next = crypto.randomUUID();
    ids.push(next);
    blocked(await save(clients[1], next));
    assert(
      must(await clients[1].from("prospecting_sequence_drafts").select("id").eq("id", id))
        .length === 0,
      "Draft leaked",
    );
  });
  await grant(roles[0], ["system.automation.sequences.update.own"], "deny");
  await check("explicit deny prevents update with existing JWT", async () =>
    blocked(await save(clients[0], id, 2)),
  );
  await grant(roles[0], ["system.automation.sequences.update.own"]);
  await check("foreign workspace parameter and actor cannot touch draft", async () => {
    blocked(await save(clients[0], id, 2, B));
    blocked(await save(clients[3], id, 2, W));
    assert(
      must(await clients[3].from("prospecting_sequence_drafts").select("id").eq("id", id))
        .length === 0,
      "Cross workspace leak",
    );
  });
  await check("inactive member cannot create", async () => {
    const next = crypto.randomUUID();
    ids.push(next);
    blocked(await save(clients[2], next));
  });
  await check("own permissions cannot update another owner", async () => {
    const other = crypto.randomUUID();
    ids.push(other);
    must(
      await admin.from("prospecting_sequence_drafts").insert({
        id: other,
        workspace_id: W,
        owner_id: accounts[1].id,
        name: "[ISO] Outro dono",
        revision: 1,
        definition: newDefinition(),
        updated_by: accounts[1].id,
      }),
    );
    blocked(await save(clients[0], other, 1));
    assert(
      must(await clients[0].from("prospecting_sequence_drafts").select("id").eq("id", other))
        .length === 0,
      "Other owner leaked",
    );
  });
  await check("direct table writes and history changes are denied", async () => {
    blocked(
      await clients[0].from("prospecting_sequence_drafts").update({ name: "Bypass" }).eq("id", id),
    );
    blocked(
      await clients[0].from("prospecting_sequence_draft_revisions").delete().eq("draft_id", id),
    );
    const history = must(
      await clients[0]
        .from("prospecting_sequence_draft_revisions")
        .select("revision")
        .eq("draft_id", id),
    );
    assert(history.length === 2, "History missing or mutable");
  });
  await check("anonymous RPC and malformed definition are denied", async () => {
    blocked(await save(createClient(cfg.API_URL, cfg.ANON_KEY, options), crypto.randomUUID()));
    blocked(await save(clients[0], id, 2, W, { schemaVersion: 1 }));
  });
  await check("parallel same revision produces exactly one update", async () => {
    const responses = await Promise.all([save(clients[0], id, 2), save(clients[0], id, 2)]);
    assert(responses.filter((r) => !r.error).length === 1, "Concurrent overwrite");
    assert(
      must(await admin.from("prospecting_sequence_drafts").select("revision").eq("id", id).single())
        .revision === 3,
      "Wrong revision",
    );
  });
} finally {
  must(await admin.from("prospecting_sequence_draft_revisions").delete().in("draft_id", ids));
  must(await admin.from("prospecting_sequence_drafts").delete().in("id", ids));
  must(
    await admin
      .from("job_role_permission_overrides")
      .delete()
      .eq("workspace_id", W)
      .in("role_id", roles)
      .in("permission_key", keys),
  );
  if (before.length) must(await admin.from("job_role_permission_overrides").insert(before));
}
if (process.env.SEQUENCE_ACCEPTANCE_REPORT)
  writeFileSync(
    process.env.SEQUENCE_ACCEPTANCE_REPORT,
    JSON.stringify({ environment: "isolated", results }, null, 2),
  );
if (results.some((r) => !r.passed)) process.exitCode = 1;
