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
const resources = [
  "techsales.notes",
  "techsales.tasks",
  "techsales.activities",
  "techsales.inbox.email",
  "techhire.candidates",
  "techpeople.people",
  "techpeople.documents",
  "techhire.interviews",
  "techhire.jobs",
  "techhire.applications",
];
const catalog = [];
for (let offset = 0; ; offset += 1000) {
  const page = must(
    await admin
      .from("permissions")
      .select("key")
      .order("key")
      .range(offset, offset + 999),
  );
  catalog.push(...page);
  if (page.length < 1000) break;
}
const keys = catalog.map((x) => x.key).filter((k) => resources.some((r) => k.startsWith(r + ".")));
const before = must(
  await admin
    .from("job_role_permission_overrides")
    .select("*")
    .eq("workspace_id", W)
    .eq("role_id", R),
).filter((x) => keys.includes(x.permission_key));
writeFileSync(root + "/order5-legacy-storage-overrides-before.json", JSON.stringify(before));
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
  const permit = (r) => grant(keys.filter((k) => k === r + ".view.own" || k === r + ".create.own"));
  const access = async (b, p, a = "view", client = h) =>
    must(await client.rpc("shared_storage_object_access", { b, p, a }));
  const upload = async (b) => {
    const p = must(await h.rpc("shared_storage_upload_path", { b, file_name: "[ISO] proof.pdf" }));
    must(await h.storage.from(b).upload(p, new Uint8Array([1, 2, 3])));
    storageObjects.push([b, p]);
    return p;
  };
  for (const b of [
    "ats-cvs",
    "notes-attachments",
    "email-attachments",
    "bug-reports",
    "exports",
    "ats-async-videos",
    "people-documents",
  ]) {
    if (!must(await admin.storage.listBuckets()).some((x) => x.id === b)) {
      must(await admin.storage.createBucket(b, { public: false }));
      createdBuckets.push(b);
    }
  }
  for (const [b, r] of [
    ["ats-cvs", "techhire.candidates"],
    ["notes-attachments", "techsales.notes"],
    ["email-attachments", "techsales.inbox.email"],
  ]) {
    await check(b + " upload denied without current permission", async () =>
      blocked(await h.rpc("shared_storage_upload_path", { b, file_name: "proof.pdf" })),
    );
    await permit(r);
    const p = await upload(b);
    await check(b + " pending upload binds actor and workspace", async () =>
      assert(p.startsWith(u + "/" + W + "/"), "Wrong path"),
    );
    await check(b + " own fresh pending upload readable", async () =>
      assert(must(await h.storage.from(b).download(p)).size === 3, "Unreadable"),
    );
    await check(b + " cannot upload to another workspace", async () =>
      blocked(
        await h.storage
          .from(b)
          .upload(u + "/" + B + "/" + crypto.randomUUID() + ".pdf", new Uint8Array([1])),
      ),
    );
    await check(b + " cannot overwrite pending bytes", async () =>
      blocked(await h.storage.from(b).update(p, new Uint8Array([9]))),
    );
    await check(b + " inactive session denied", async () =>
      assert(!(await access(b, p, "view", clients[2])), "Inactive allowed"),
    );
    const orphan = u + "/" + crypto.randomUUID() + ".pdf";
    must(await admin.storage.from(b).upload(orphan, new Uint8Array([1])));
    storageObjects.push([b, orphan]);
    await check(b + " unbound historical path cannot mint a URL", async () =>
      blocked(await h.storage.from(b).createSignedUrl(orphan, 60)),
    );
    let t, id;
    if (b === "ats-cvs") {
      t = "ats_candidates";
      id = await seed(t, {
        workspace_id: W,
        owner_id: u,
        full_name: "[ISO legacy CV]",
        cv_url: "https://example.invalid/storage/v1/object/sign/ats-cvs/" + p + "?token=synthetic",
      });
    }
    if (b === "notes-attachments") {
      t = "activities";
      id = await seed(t, {
        workspace_id: W,
        owner_id: u,
        type: "note",
        subject: "[ISO legacy note]",
        attachments: [{ path: p, name: "proof.pdf" }],
      });
    }
    if (b === "email-attachments") {
      const account = await seed("email_accounts", {
        workspace_id: W,
        owner_id: u,
        email: "iso@example.invalid",
      });
      const thread = await seed("email_threads", {
        workspace_id: W,
        owner_id: u,
        account_id: account,
        provider_thread_id: crypto.randomUUID(),
      });
      t = "email_messages";
      id = await seed(t, {
        workspace_id: W,
        owner_id: u,
        account_id: account,
        thread_id: thread,
        provider_message_id: crypto.randomUUID(),
        direction: "outbound",
        attachments: [{ path: p, filename: "proof.pdf" }],
      });
    }
    await check(b + " registered attachment uses current parent permission", async () =>
      assert(must(await h.storage.from(b).download(p)).size === 3, "Registered denied"),
    );
    await check(b + " registered bytes cannot be deleted directly", async () =>
      assert(!(await access(b, p, "delete")), "Delete allowed"),
    );
    await grant([r + ".view.own"], "deny");
    await check(b + " current deny blocks uploader without pending fallback", async () =>
      blocked(await h.storage.from(b).createSignedUrl(p, 60)),
    );
    await permit(r);
    if (b !== "email-attachments") {
      must(await admin.from(t).update({ assigned_to: peer }).eq("id", id));
      await check(b + " reassignment revokes original uploader", async () =>
        blocked(await h.storage.from(b).download(p)),
      );
    } else {
      must(
        await admin
          .from("email_threads")
          .update({ assigned_to: peer })
          .eq("id", must(await admin.from(t).select("thread_id").eq("id", id).single()).thread_id),
      );
      await check(b + " thread reassignment revokes original uploader", async () =>
        blocked(await h.storage.from(b).download(p)),
      );
    }
    await grant(
      keys.filter((k) => k.startsWith(r + ".")),
      "deny",
    );
  }
  await permit("techpeople.people");
  await permit("techpeople.documents");
  const person = await seed("people", {
    workspace_id: W,
    owner_id: u,
    profile_id: u,
    full_name: "[ISO Storage person]",
    status: "active",
  });
  const personPath = u + "/" + person + "/proof.pdf";
  const document = await seed("people_documents", {
    workspace_id: W,
    owner_id: u,
    created_by: u,
    person_id: person,
    doc_type: "[ISO storage]",
    file_url: personPath,
  });
  await check("registered People document requires parent and document view", async () =>
    assert(await access("people-documents", personPath), "Authorized document denied"),
  );
  await grant(["techpeople.documents.view.own"], "deny");
  await check("document deny revokes file authorization", async () =>
    assert(!(await access("people-documents", personPath)), "Document deny bypass"),
  );
  await permit("techpeople.documents");
  await grant(["techpeople.people.view.own"], "deny");
  await check("person deny revokes child document file", async () =>
    assert(!(await access("people-documents", personPath)), "Parent deny bypass"),
  );
  await permit("techpeople.people");
  await check("registered document bytes cannot be overwritten", async () =>
    assert(!(await access("people-documents", personPath, "update")), "HR overwrite allowed"),
  );
  await permit("techhire.candidates");
  await permit("techhire.jobs");
  await grant(["techhire.interviews.view.workspace"]);
  const candidate = await seed("ats_candidates", {
    workspace_id: W,
    owner_id: u,
    full_name: "[ISO Storage video candidate]",
  });
  const job = await seed("ats_jobs", { workspace_id: W, owner_id: u, title: "[ISO Storage job]" });
  const application = await seed("ats_applications", {
    workspace_id: W,
    owner_id: u,
    candidate_id: candidate,
    job_id: job,
  });
  const interview = await seed("ats_interviews", {
    workspace_id: W,
    owner_id: u,
    application_id: application,
    candidate_id: candidate,
    job_id: job,
  });
  const videoPath = peer + "/" + interview + "/proof.webm";
  await seed("ats_async_video_responses", {
    workspace_id: W,
    owner_id: u,
    interview_id: interview,
    question_id: crypto.randomUUID(),
    storage_path: videoPath,
  });
  must(await admin.storage.from("ats-async-videos").upload(videoPath, new Uint8Array([1, 2, 3])));
  storageObjects.push(["ats-async-videos", videoPath]);
  await check("authorized recruiter reads video uploaded under a colleague prefix", async () =>
    assert(
      must(await h.storage.from("ats-async-videos").download(videoPath)).size === 3,
      "Interview file denied",
    ),
  );
  await grant(["techhire.interviews.view.workspace"], "deny");
  await check("interview deny revokes video even for uploader", async () =>
    blocked(await h.storage.from("ats-async-videos").download(videoPath)),
  );
  await check("video cannot be uploaded through raw browser policy", async () =>
    blocked(
      await h.storage
        .from("ats-async-videos")
        .upload(u + "/" + interview + "/extra.webm", new Uint8Array([1])),
    ),
  );
  const bug = u + "/" + crypto.randomUUID() + ".webm";
  must(await h.storage.from("bug-reports").upload(bug, new Uint8Array([1])));
  storageObjects.push(["bug-reports", bug]);
  await check("personal issue recording remains readable by its author", async () =>
    assert(
      must(await h.storage.from("bug-reports").download(bug)).size === 1,
      "Personal exception denied",
    ),
  );
  await check("personal issue recording cannot be read by another member", async () =>
    blocked(await clients[1].storage.from("bug-reports").download(bug)),
  );
  for (const b of [
    "contact-photos",
    "role-profile-files",
    "sdr-materials",
    "exports",
    "unknown-new-bucket",
  ])
    await check(b + " raw authenticated access fails closed", async () =>
      assert(!(await access(b, u + "/" + W + "/file", "view")), "Service bucket bypass"),
    );
  await check("unregistered People document fails closed", async () =>
    assert(
      !(await access("people-documents", u + "/" + W + "/file")),
      "Unregistered HR file allowed",
    ),
  );
  await check("unregistered ATS video fails closed", async () =>
    assert(
      !(await access("ats-async-videos", u + "/" + W + "/file")),
      "Unregistered video allowed",
    ),
  );
  await check("normalizer does not accept unrelated external URL", async () =>
    assert(
      must(
        await h.rpc("shared_storage_reference_path", {
          u: "https://example.invalid/file.pdf",
          b: "ats-cvs",
        }),
      ) === null,
      "External URL accepted",
    ),
  );
  await check("path traversal rejected", async () =>
    assert(!(await access("notes-attachments", u + "/" + W + "/../file")), "Traversal allowed"),
  );
  await check("unknown action rejected", async () =>
    assert(!(await access("bug-reports", bug, "grant")), "Unknown action allowed"),
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
    root + "/order5-legacy-storage-acceptance.json",
    JSON.stringify({ results, passed: results.every((x) => x.passed), external_sends: 0 }, null, 2),
  );
}
if (results.some((x) => !x.passed)) process.exitCode = 1;
