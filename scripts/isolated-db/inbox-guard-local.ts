import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  assertDisposableInboxTarget,
  loadDisposableInboxFixtures,
} from "../../tests/fixtures/inbox/load";
import { checkChatResponses } from "../../tests/fixtures/inbox/chat-response-checks";
import { checkInboxWorkflowGuard } from "../../tests/fixtures/inbox/guard-checks";
assertDisposableInboxTarget(process.env, process.argv);
loadDisposableInboxFixtures();
const key = process.env["SUPABASE_SERVICE_ROLE_KEY"];
if (!key) throw new Error("Local service key missing; not executed.");
const workspace = "fa110000-0000-4000-8000-000000000001";
const user = (n: number) => `fb110000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const sessions = new Map<number, string>();
async function api(path: string, method: string, body?: unknown, token?: string) {
  const headers: Record<string, string> = {
    apikey: key ?? "",
    "Content-Type": "application/json",
    Prefer: "return=representation",
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  else if (key?.split(".").length === 3) headers["Authorization"] = `Bearer ${key}`;
  const response = await fetch("http://127.0.0.1:8001" + path, {
    method,
    headers,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return { status: response.status, body: (await response.json().catch(() => null)) as unknown };
}
for (const n of [11, 12, 13, 14, 15, 16, 17, 18, 19]) {
  const password = crypto.randomUUID() + crypto.randomUUID();
  const email = `guard-disposable-${n}@example.invalid`;
  const created = await api("/auth/v1/admin/users", "POST", {
    id: user(n),
    email,
    password,
    email_confirm: true,
  });
  if (created.status !== 200 && created.status !== 201)
    assert.equal((await api(`/auth/v1/admin/users/${user(n)}`, "PUT", { password })).status, 200);
  const login = await api("/auth/v1/token?grant_type=password", "POST", { email, password });
  assert.equal(login.status, 200);
  assert.ok(
    login.body &&
      typeof login.body === "object" &&
      "access_token" in login.body &&
      typeof login.body.access_token === "string",
  );
  sessions.set(n, login.body.access_token);
  assert.equal(
    (
      await api(`/rest/v1/profiles?id=eq.${user(n)}`, "PATCH", {
        active_workspace_id: n === 14 ? "fa110000-0000-4000-8000-000000000002" : workspace,
      })
    ).status,
    200,
  );
}
const loaded = spawnSync(
  "psql",
  ["-X", "-v", "ON_ERROR_STOP=1", "--single-transaction", "-f", "tests/fixtures/inbox/guard.sql"],
  { encoding: "utf8" },
);
if (loaded.status !== 0) throw new Error("Guard fixtures failed; private output withheld.");
const checks = await checkInboxWorkflowGuard(
  async (actor, method, path, body) => {
    const token = actor === null ? undefined : sessions.get(actor);
    if (actor !== null && !token) throw new Error("Missing real authenticated session.");
    return api("/rest/v1" + path, method, body, token);
  },
  workspace,
  user,
  false,
);
console.log(
  `${checks} real GoTrue/PostgREST guard checks passed; draft release lock remains intact.`,
);

const chatFixture = spawnSync(
  "psql",
  [
    "-X",
    "-v",
    "ON_ERROR_STOP=1",
    "--single-transaction",
    "-f",
    "tests/fixtures/inbox/chat-response.sql",
  ],
  { encoding: "utf8" },
);
if (chatFixture.status !== 0) throw new Error("Chat fixtures failed; private output withheld.");
const chatChecks = await checkChatResponses(api, workspace, user, sessions);
console.log(`${chatChecks} real chat INSERT/RLS checks passed; lock remains intact.`);
