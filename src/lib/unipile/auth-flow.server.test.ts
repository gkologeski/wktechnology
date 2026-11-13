import type { SupabaseClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { beforeEach, expect, it, vi } from "vitest";
const provider = vi.hoisted(() => ({ request: vi.fn(), scope: vi.fn() }));
vi.mock("./auth-provider.server", () => ({
  unipileAuthRequest: provider.request,
  ensurePersonalScope: provider.scope,
}));
import { beginPersonalLinkedin, finishPersonalLinkedin } from "./auth-flow.server";
const actor = "actor",
  workspace = "workspace",
  state = "a".repeat(64);
const access = {
  actor,
  workspace,
  read_only: false,
  keys: { "system.linkedin.view.own": true, "system.linkedin.manage.own": true },
};
function database(ctx: unknown = access) {
  const stored = vi.fn();
  const rpc = vi.fn(async (name: string, args?: Record<string, unknown>) => {
    if (name === "unipile_connect_start") stored(args);
    return { data: name === "work_subject_context" ? ctx : "account", error: null };
  });
  const query: any = {
    insert: vi.fn((row) => {
      stored(row);
      return query;
    }),
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    order: vi.fn(() => query),
    limit: vi.fn(() => query),
    single: vi.fn(async () => ({ data: { id: "flow" }, error: null })),
    maybeSingle: vi.fn(async () => ({
      data: {
        id: "flow",
        state_hash: createHash("sha256").update(state).digest("hex"),
        scope_id: "personal",
        expires_at: new Date(Date.now() + 60000).toISOString(),
        consumed_at: null,
      },
      error: null,
    })),
  };
  return {
    admin: { rpc, from: vi.fn(() => query) } as unknown as SupabaseClient,
    rpc,
    query,
    stored,
  };
}
beforeEach(() => {
  vi.resetAllMocks();
  provider.scope.mockResolvedValue("personal");
});
it("stores only a state hash and binds hosted authentication to the personal scope", async () => {
  const db = database();
  provider.request.mockResolvedValue({ link: "https://auth.unipile.com/link" });
  await beginPersonalLinkedin(db.admin, actor, workspace);
  const body = provider.request.mock.calls[0][1];
  const raw = new URL(body.redirect_uri).searchParams.get("state")!;
  expect(raw).toMatch(/^[a-f0-9]{64}$/);
  expect(db.stored.mock.calls[0][0].p_state_hash).toBe(
    createHash("sha256").update(raw).digest("hex"),
  );
  expect(db.stored.mock.calls[0][0]).not.toHaveProperty("state");
  expect(body.account_scope_id).toBe("personal");
  expect(provider.scope).toHaveBeenCalledWith("techerp:workspace:actor");
});
it("rejects revoked membership before touching the provider", async () => {
  const db = database({});
  await expect(beginPersonalLinkedin(db.admin, actor, workspace)).rejects.toThrow("permissão");
  expect(provider.scope).not.toHaveBeenCalled();
  expect(provider.request).not.toHaveBeenCalled();
});
it("rejects an unexpected hosted-auth destination", async () => {
  const db = database();
  provider.request.mockResolvedValue({ link: "https://evil.test" });
  await expect(beginPersonalLinkedin(db.admin, actor, workspace)).rejects.toThrow("inesperado");
});
it("fetches the exact callback account and finalizes in the database", async () => {
  const db = database();
  provider.request.mockResolvedValue({
    id: "exact",
    provider: "linkedin",
    status: "running",
    account_scope_id: "personal",
  });
  await expect(finishPersonalLinkedin(db.admin, actor, workspace, state, "exact")).resolves.toEqual(
    { ok: true, account_id: "exact" },
  );
  expect(provider.request).toHaveBeenCalledWith("/accounts/exact");
  expect(db.rpc.mock.calls.map((c) => c[0])).toEqual([
    "work_subject_context",
    "unipile_connect_complete",
  ]);
  expect(db.query.eq).toHaveBeenCalledWith("owner_id", actor);
  expect(db.query.eq).toHaveBeenCalledWith("workspace_id", workspace);
});
it("never finalizes a different personal scope", async () => {
  const db = database();
  provider.request.mockResolvedValue({
    id: "exact",
    provider: "linkedin",
    status: "running",
    account_scope_id: "another",
  });
  await expect(finishPersonalLinkedin(db.admin, actor, workspace, state, "exact")).rejects.toThrow(
    "escopo",
  );
  expect(db.rpc).toHaveBeenCalledTimes(1);
});
it("rejects replay without calling the provider", async () => {
  const db = database();
  db.query.maybeSingle.mockResolvedValue({ data: { consumed_at: "used" }, error: null });
  await expect(finishPersonalLinkedin(db.admin, actor, workspace, state, "exact")).rejects.toThrow(
    "utilizada",
  );
  expect(provider.request).not.toHaveBeenCalled();
});

it("reconnects a known legacy account without assigning a permanent scope", async () => {
  const db = database();
  db.query.maybeSingle.mockResolvedValueOnce({
    data: { unipile_account_id: "existing", account_scope_id: null },
    error: null,
  });
  provider.request.mockResolvedValue({ link: "https://auth.unipile.com/link" });
  await beginPersonalLinkedin(db.admin, actor, workspace);
  const body = provider.request.mock.calls[0][1];
  expect(body.account_id).toBe("existing");
  expect(body).not.toHaveProperty("providers");
  expect(body).not.toHaveProperty("account_scope_id");
  expect(provider.scope).not.toHaveBeenCalled();
});
