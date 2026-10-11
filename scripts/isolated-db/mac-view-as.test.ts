import { it, expect } from "vitest";
import { readFileSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
const root = process.env.ISO_ROOT!;
const status = JSON.parse(readFileSync(root + "/status.private.json", "utf8"));
if (
  status.API_URL !== "http://127.0.0.1:54321" ||
  readFileSync(root + "/.isolation-marker", "utf8").trim() !== "techerp-empty-local-v1"
)
  throw new Error("Local fixture required");
process.env.SUPABASE_URL = status.API_URL;
process.env.SUPABASE_SERVICE_ROLE_KEY = status.SERVICE_ROLE_KEY;
const admin = createClient(status.API_URL, status.SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
async function login(email: string) {
  const link = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (link.error) throw link.error;
  const client = createClient(status.API_URL, status.ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const r = await client.auth.verifyOtp({
    token_hash: link.data.properties.hashed_token,
    type: "magiclink",
  });
  if (r.error) throw r.error;
  return client;
}
it("Ver como uses real target GoTrue session and retains restricted visibility", async () => {
  const svc = await import("../../src/lib/view-as.server");
  const client = await login("admin-a@techerp-test.invalid");
  const own = await login("own-a@techerp-test.invalid");
  const uid = "10000000-0000-4000-8000-000000000002";
  await expect(
    svc.start(own, uid, { user_id: "10000000-0000-4000-8000-000000000007" }),
  ).rejects.toThrow();
  await expect(
    svc.start(client, "10000000-0000-4000-8000-000000000001", {
      user_id: "10000000-0000-4000-8000-000000000006",
    }),
  ).rejects.toThrow();
  const view = await svc.start(client, "10000000-0000-4000-8000-000000000001", { user_id: uid });
  const target = createClient(status.API_URL, status.ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const otp = await target.auth.verifyOtp({ token_hash: view.tokenHash, type: "magiclink" });
  if (otp.error) throw otp.error;
  const jwt = otp.data.session!.access_token;
  const claims = JSON.parse(Buffer.from(jwt.split(".")[1], "base64url").toString());
  try {
    expect(claims.sub).toBe(uid);
    await expect(
      svc.bind(uid, claims.session_id, view.viewId, "wrong-nonce-value"),
    ).rejects.toThrow();
    await svc.bind(uid, claims.session_id, view.viewId, view.nonce);
    await expect(svc.bind(uid, claims.session_id, view.viewId, view.nonce)).rejects.toThrow();
    const result = await target
      .from("leads")
      .select("id")
      .in("id", [
        "50000000-0000-4000-8000-0000000000a1",
        "50000000-0000-4000-8000-0000000000a7",
        "50000000-0000-4000-8000-0000000000b1",
      ]);
    expect(result.error).toBeNull();
    expect(result.data?.map((r) => r.id)).toEqual(["50000000-0000-4000-8000-0000000000a1"]);
  } finally {
    await svc.end(uid, view.viewId, jwt);
  }
  const ended = await admin
    .from("view_as_sessions")
    .select("ended_at")
    .eq("id", view.viewId)
    .single();
  expect(ended.data?.ended_at).toBeTruthy();
  const continued = await own
    .from("leads")
    .select("id")
    .eq("id", "50000000-0000-4000-8000-0000000000a1");
  expect(continued.error).toBeNull();
  expect(continued.data).toHaveLength(1);
  writeFileSync(
    root + "/artifacts/cycle13-view-as.json",
    JSON.stringify(
      {
        passed: true,
        realGoTrueTarget: true,
        nonAdminStartDenied: true,
        crossTenantStartDenied: true,
        wrongNonceDenied: true,
        duplicateBindDenied: true,
        restrictedRead: true,
        ended: true,
        ordinarySessionPreserved: true,
      },
      null,
      2,
    ),
  );
  await client.auth.signOut();
  await own.auth.signOut();
}, 30000);
