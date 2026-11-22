import { createClient } from "@supabase/supabase-js";
import { spawnSync } from "node:child_process";
import {
  assertDisposableInboxTarget,
  loadDisposableInboxFixtures,
} from "../../tests/fixtures/inbox/load";
import { checkGmailTransport } from "../../tests/fixtures/inbox/gmail-transport-checks";
assertDisposableInboxTarget(process.env, process.argv);
loadDisposableInboxFixtures();
const fixture = spawnSync(
  "psql",
  [
    "-X",
    "-v",
    "ON_ERROR_STOP=1",
    "--single-transaction",
    "-f",
    "tests/fixtures/inbox/gmail-response.sql",
  ],
  { encoding: "utf8" },
);
if (fixture.status !== 0)
  throw new Error("Authorized disposable sender setup failed; private output withheld.");
const key = process.env["SUPABASE_SERVICE_ROLE_KEY"];
if (!key) throw new Error("Disposable service credential missing; not executed.");
const admin = createClient("http://127.0.0.1:8001", key, {
  auth: { persistSession: false },
  global: {
    fetch: (url, init) => {
      const headers = new Headers(init?.headers);
      if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`)
        headers.delete("Authorization");
      headers.set("apikey", key);
      return fetch(url, { ...init, headers });
    },
  },
});
const checks = await checkGmailTransport(
  admin,
  "fa110000-0000-4000-8000-000000000001",
  "fc110000-0000-4000-8000-000000000001",
  "fb110000-0000-4000-8000-000000000001",
);
console.log(`${checks} real Gmail transport checks passed; no external send or lock removal.`);
