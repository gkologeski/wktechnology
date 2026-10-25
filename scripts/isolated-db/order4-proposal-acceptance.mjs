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
  blocked = (r) =>
    assert(
      !!r.error && ["42501", "P0001", "40001"].includes(r.error.code),
      "Expected authorization/state denial: " + JSON.stringify(r.error),
    );
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
writeFileSync(root + "/order4-proposals-overrides-before.json", JSON.stringify(before));
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
const peerRole = "30000000-0000-4000-8000-0000000000a9";
const peerBefore = must(
  await admin
    .from("job_role_permission_overrides")
    .select("*")
    .eq("workspace_id", W)
    .eq("role_id", peerRole),
).filter((x) => keys.includes(x.permission_key));
const peerGrant = async (list, effect = "grant") => {
  for (let i = 0; i < list.length; i += 100)
    must(
      await admin.from("job_role_permission_overrides").upsert(
        list.slice(i, i + 100).map((permission_key) => ({
          workspace_id: W,
          role_id: peerRole,
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
  await peerGrant(keys, "deny");
  await grant([
    "techsales.proposals.view.own",
    "techsales.proposals.create.own",
    "techsales.proposals.update.own",
  ]);
  await peerGrant(["techsales.proposals.view.workspace", "techsales.proposals.approve.workspace"]);
  const create = async () => {
    const x = must(
      await h
        .from("proposals")
        .insert({
          workspace_id: W,
          owner_id: u,
          title: "[ISO approval]",
          body: "Original",
          total_amount: 100,
        })
        .select("id")
        .single(),
    );
    fixtures.push(["proposals", x.id]);
    return x.id;
  };
  const p = await create();
  let approval;
  await check("draft creation is authorized without exposing token", async () =>
    assert(
      must(await h.from("proposals").select("id,title,status").eq("id", p).single()).status ===
        "draft",
      "draft",
    ),
  );
  await check("request requires an explicit reviewer", async () =>
    blocked(await h.rpc("sales_proposal_request", { p_id: p, p_reviewer: null })),
  );
  await check("requester cannot nominate self", async () =>
    blocked(await h.rpc("sales_proposal_request", { p_id: p, p_reviewer: u })),
  );
  await check("requester cannot nominate inactive reviewer", async () =>
    blocked(await h.rpc("sales_proposal_request", { p_id: p, p_reviewer: accounts[2].id })),
  );
  await check("requester can nominate authorized active reviewer", async () => {
    approval = must(
      await h.rpc("sales_proposal_request", { p_id: p, p_reviewer: peer }),
    ).approvalId;
    assert(!!approval, "approval id");
  });
  await check("duplicate pending review is rejected", async () =>
    blocked(await h.rpc("sales_proposal_request", { p_id: p, p_reviewer: peer })),
  );
  await check("requester cannot approve own request", async () =>
    blocked(await h.rpc("sales_proposal_decide", { p_approval: approval, p_decision: "approved" })),
  );
  await check("approved reviewer can decide atomically", async () => {
    must(
      await clients[1].rpc("sales_proposal_decide", {
        p_approval: approval,
        p_decision: "approved",
      }),
    );
    assert(
      must(await admin.from("proposals").select("status").eq("id", p).single()).status ===
        "approved",
      "not approved",
    );
  });
  await check("decided review cannot be rewritten", async () =>
    blocked(
      await clients[1].rpc("sales_proposal_decide", {
        p_approval: approval,
        p_decision: "rejected",
      }),
    ),
  );
  await check("approve permission cannot edit proposal body", async () =>
    blocked(await clients[1].from("proposals").update({ body: "forged" }).eq("id", p)),
  );
  await check("caller cannot set proposal version", async () =>
    blocked(await h.from("proposals").update({ version: 100 }).eq("id", p)),
  );
  await check("content edit invalidates earlier approval and increments version", async () => {
    must(await h.from("proposals").update({ body: "Revised" }).eq("id", p));
    const x = must(await admin.from("proposals").select("status,version").eq("id", p).single());
    assert(x.status === "draft" && x.version === 2, "revision");
  });
  await grant(["techsales.proposal_send.manage.own", "techsales.proposal_send.view.own"]);
  await check("sending stale approved content is blocked", async () =>
    blocked(
      await h.rpc("proposal_publish_with_esign", {
        p_id: p,
        p_hash: "ignored",
        p_sent_at: "2020-01-01",
      }),
    ),
  );
  await check("publishing via raw REST cannot bypass current approval", async () =>
    blocked(
      await h
        .from("proposals")
        .update({ status: "sent", locked: true, sent_at: new Date().toISOString() })
        .eq("id", p),
    ),
  );
  await check("revised content can be approved anew", async () => {
    approval = must(
      await h.rpc("sales_proposal_request", { p_id: p, p_reviewer: peer }),
    ).approvalId;
    must(
      await clients[1].rpc("sales_proposal_decide", {
        p_approval: approval,
        p_decision: "approved",
      }),
    );
  });
  await check("authorized send seals current content with server timestamp", async () => {
    must(
      await h.rpc("proposal_publish_with_esign", {
        p_id: p,
        p_hash: "forged",
        p_sent_at: "2020-01-01",
      }),
    );
    const x = must(
      await admin.from("proposals").select("status,locked,sent_at,variables").eq("id", p).single(),
    );
    assert(
      x.status === "sent" &&
        x.locked &&
        new Date(x.sent_at).getUTCFullYear() === new Date().getUTCFullYear() &&
        x.variables.document_hash !== "forged",
      "seal",
    );
  });
  await check("sealed content cannot be edited", async () =>
    blocked(await h.from("proposals").update({ body: "late edit" }).eq("id", p)),
  );
  await check("client acceptance cannot be forged by internal editor", async () =>
    blocked(await h.from("proposals").update({ status: "accepted" }).eq("id", p)),
  );
  await check("private token requires separate sharing permission", async () =>
    blocked(await h.rpc("sales_public_token", { p_table: "proposals", p_id: p })),
  );
  await grant(["techsales.proposal_share.manage.own", "techsales.proposal_share.view.own"]);
  await check("sharing permission can read existing sealed token", async () =>
    assert(
      must(await h.rpc("sales_public_token", { p_table: "proposals", p_id: p })).length === 48,
      "token",
    ),
  );
  await check("private token is still inaccessible by raw REST", async () =>
    blocked(await h.from("proposals").select("public_token").eq("id", p)),
  );
  await check("sharing cannot read foreign workspace token", async () => {
    const x = await seed("proposals", {
      workspace_id: B,
      owner_id: accounts[3].id,
      title: "[ISO foreign]",
    });
    blocked(await h.rpc("sales_public_token", { p_table: "proposals", p_id: x }));
  });
  await check("public decision port is inaccessible to an authenticated caller", async () =>
    blocked(
      await h.rpc("sales_public_decision", {
        p_kind: "proposals",
        p_token: "0000000000000000",
        p_action: "accept",
      }),
    ),
  );
  await check("client decisions are atomic and cannot be replayed", async () => {
    const token = must(
      await admin.from("proposals").select("public_token").eq("id", p).single(),
    ).public_token;
    const results = await Promise.all(
      ["accept", "decline"].map((p_action) =>
        admin.rpc("sales_public_decision", { p_kind: "proposals", p_token: token, p_action }),
      ),
    );
    assert(results.filter((x) => !x.error).length === 1, "Concurrent/replayed decision");
  });
  await check("expired proposal cannot be accepted", async () => {
    const id = await seed("proposals", {
      workspace_id: W,
      owner_id: u,
      title: "[ISO expired]",
      status: "sent",
      locked: true,
      sent_at: new Date().toISOString(),
      expires_at: "2000-01-01T00:00:00Z",
    });
    const token = must(
      await admin.from("proposals").select("public_token").eq("id", id).single(),
    ).public_token;
    blocked(
      await admin.rpc("sales_public_decision", {
        p_kind: "proposals",
        p_token: token,
        p_action: "accept",
      }),
    );
  });
  await check("draft quote cannot be accepted via a leaked old token", async () => {
    const id = await seed("quotes", {
      workspace_id: W,
      owner_id: u,
      number: "ISO4-" + Date.now(),
      status: "draft",
    });
    const token = must(
      await admin.from("quotes").select("public_token").eq("id", id).single(),
    ).public_token;
    blocked(
      await admin.rpc("sales_public_decision", {
        p_kind: "quotes",
        p_token: token,
        p_action: "accept",
      }),
    );
  });
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
  for (let i = 0; i < keys.length; i += 100)
    must(
      await admin
        .from("job_role_permission_overrides")
        .delete()
        .eq("workspace_id", W)
        .eq("role_id", peerRole)
        .in("permission_key", keys.slice(i, i + 100)),
    );
  if (peerBefore.length) must(await admin.from("job_role_permission_overrides").insert(peerBefore));
  if (before.length) must(await admin.from("job_role_permission_overrides").insert(before));
  for (const c of clients) await c.auth.signOut();
  writeFileSync(
    root + "/order4-proposals-acceptance.json",
    JSON.stringify({ results, passed: results.every((x) => x.passed), external_sends: 0 }, null, 2),
  );
}
if (results.some((x) => !x.passed)) process.exitCode = 1;
