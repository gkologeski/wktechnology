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
const keys = ["view", "create", "update", "manage"].flatMap((a) =>
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
let otherOwnerId;
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
    otherOwnerId = other;
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

  const version = (client, revision = 3, workspace = W, draft = id) =>
    client.rpc("prospecting_sequence_version_create", {
      p_id: draft,
      p_workspace: workspace,
      p_expected_revision: revision,
    });
  await check("version requires manage independently from draft edit", async () =>
    blocked(await version(clients[0])),
  );
  await grant(roles[0], ["system.automation.sequences.manage.own"]);
  let versionId;
  await check("version freezes the server saved definition once", async () => {
    const results = await Promise.all([version(clients[0]), version(clients[0])]);
    const a = must(results[0]),
      b = must(results[1]);
    assert(a.id === b.id && a.draft_revision === 3, "Duplicate version");
    versionId = a.id;
    const v = must(
      await clients[0]
        .from("prospecting_sequence_versions")
        .select("owner_id,created_by,definition")
        .eq("id", versionId)
        .single(),
    );
    assert(v.owner_id === accounts[0].id && v.created_by === accounts[0].id, "Wrong authorship");
    const next = newDefinition();
    next.steps[0].subject = "Alteração posterior";
    must(await save(clients[0], id, 3, W, next));
    assert(
      must(
        await clients[0]
          .from("prospecting_sequence_versions")
          .select("definition")
          .eq("id", versionId)
          .single(),
      ).definition.steps[0].subject !== "Alteração posterior",
      "Version changed with draft",
    );
  });
  await check("stale version request cannot snapshot a newer revision", async () =>
    blocked(await version(clients[0], 3)),
  );
  await grant(roles[0], ["system.automation.sequences.manage.own"], "deny");
  await check("version explicit deny takes effect with existing JWT", async () =>
    blocked(await version(clients[0], 4)),
  );
  await grant(roles[0], ["system.automation.sequences.manage.own"]);
  await check("version foreign workspace and inactive actor cannot publish", async () => {
    blocked(await version(clients[0], 4, B));
    blocked(await version(clients[3], 4, W));
    blocked(await version(clients[2], 4));
  });
  await check("version missing permission cannot read or publish", async () => {
    blocked(await version(clients[1], 4));
    assert(
      must(await clients[1].from("prospecting_sequence_versions").select("id").eq("draft_id", id))
        .length === 0,
      "Version leaked",
    );
  });
  await check("version own scope cannot publish another visible owner", async () => {
    const other = must(
      await admin
        .from("prospecting_sequence_drafts")
        .select("name,definition,owner_id")
        .eq("id", otherOwnerId)
        .single(),
    );
    must(
      await admin.from("prospecting_sequence_draft_revisions").insert({
        draft_id: otherOwnerId,
        workspace_id: W,
        revision: 1,
        name: other.name,
        definition: other.definition,
        author_id: other.owner_id,
      }),
    );
    await grant(roles[0], ["system.automation.sequences.view.workspace"]);
    try {
      assert(
        must(
          await clients[0].from("prospecting_sequence_drafts").select("id").eq("id", otherOwnerId),
        ).length === 1,
        "Other draft must be visible for this test",
      );
      const denied = await version(clients[0], 1, W, otherOwnerId);
      assert(
        denied.error?.code === "42501",
        "Expected manage own denial, not incidental validation failure",
      );
    } finally {
      await grant(roles[0], ["system.automation.sequences.view.workspace"], "deny");
    }
  });
  await check("version direct writes, mutation and anonymous RPC are forbidden", async () => {
    blocked(
      await clients[0]
        .from("prospecting_sequence_versions")
        .update({ name: "Bypass" })
        .eq("id", versionId),
    );
    blocked(await clients[0].from("prospecting_sequence_versions").delete().eq("id", versionId));
    blocked(
      await admin
        .from("prospecting_sequence_versions")
        .update({ name: "Bypass" })
        .eq("id", versionId),
    );
    blocked(await version(createClient(cfg.API_URL, cfg.ANON_KEY, options), 4));
  });
} finally {
  must(await admin.from("prospecting_sequence_versions").delete().in("draft_id", ids));
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
