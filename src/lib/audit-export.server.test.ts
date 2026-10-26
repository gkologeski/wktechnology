import { beforeEach, afterEach, it, expect, vi } from "vitest";
afterEach(() => vi.unstubAllGlobals());
const state = vi.hoisted(() => ({
  rpc: vi.fn(),
  guard: vi.fn(),
  updates: [] as { table: string; payload: Record<string, unknown> }[],
  tables: [] as string[],
  cfg: {
    id: "export",
    workspace_id: "workspace",
    owner_id: "actor",
    destination: "webhook",
    format: "json",
    config: { url: "https://example.com/export" },
    hmac_secret: null,
    last_run_at: "2026-01-01T00:00:00Z",
    cursor_at: "2026-01-01T00:00:00Z",
    cursor_id: null,
  } as Record<string, unknown>,
}));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: (table: string) => {
      state.tables.push(table);
      const filters: Record<string, unknown> = {};
      const builder = {
        select: () => builder,
        single: async () => ({
          data: { id: table === "audit_exports" ? "export" : "run" },
          error: null,
        }),
        insert: () => builder,
        update: (payload: Record<string, unknown>) => {
          state.updates.push({ table, payload });
          return builder;
        },
        eq: (k: string, v: unknown) => {
          filters[k] = v;
          return builder;
        },
        maybeSingle: async () => ({
          data:
            table === "audit_exports"
              ? filters.workspace_id === state.cfg.workspace_id
                ? state.cfg
                : null
              : { id: "run" },
          error: null,
        }),
        then: (resolve: (x: unknown) => unknown, reject: (e: unknown) => unknown) =>
          Promise.resolve({ data: null, error: null }).then(resolve, reject),
      };
      return builder;
    },
  },
}));
vi.mock("@/lib/access-control/work-core.server", () => ({
  workRpc: (...args: unknown[]) => state.rpc(...args),
}));
vi.mock("@/lib/webhooks/url-guard", () => ({
  assertSafeWebhookUrl: (...args: unknown[]) => state.guard(...args),
  dohResolver: {},
}));
import { runAuditExport } from "./audit-export.server";
beforeEach(() => {
  state.updates = [];
  state.tables = [];
  state.cfg.destination = "webhook";
  state.rpc.mockReset();
  state.guard.mockReset();
  state.guard.mockResolvedValue(new URL("https://example.com/export"));
  state.rpc.mockResolvedValue({
    rows: [{ id: "authorized-audit" }],
    has_more: false,
    cursor_at: "2026-01-02T00:00:00Z",
    cursor_id: "audit-cursor",
  });
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200 }));
});
it("audit worker rechecks permission before any outbound delivery", async () => {
  state.rpc.mockRejectedValue(Error("Permission revoked"));
  expect(await runAuditExport("export", "workspace")).toMatchObject({
    ok: false,
    error: "Permission revoked",
  });
  expect(fetch).not.toHaveBeenCalled();
  expect(state.updates.find((x) => x.payload.last_status === "failed")?.payload).not.toHaveProperty(
    "last_run_at",
  );
  expect(state.updates.find((x) => x.payload.last_status === "failed")?.payload).not.toHaveProperty(
    "cursor_at",
  );
});
it("audit worker binds export to the selected workspace", async () => {
  expect(await runAuditExport("export", "foreign")).toMatchObject({ ok: false });
  expect(state.rpc).not.toHaveBeenCalled();
  expect(fetch).not.toHaveBeenCalled();
});
it("audit worker exports only projected rows and advances successful cursor", async () => {
  expect(await runAuditExport("export", "workspace")).toMatchObject({ ok: true, count: 1 });
  expect(state.tables).not.toContain("audit_logs");
  expect(state.guard).toHaveBeenCalled();
  expect(fetch).toHaveBeenCalledWith(
    "https://example.com/export",
    expect.objectContaining({ body: '[{"id":"authorized-audit"}]', redirect: "error" }),
  );
  expect(state.updates.find((x) => x.payload.last_status === "success")?.payload).toMatchObject({
    cursor_at: "2026-01-02T00:00:00Z",
    cursor_id: "audit-cursor",
  });
});
it("audit worker failed delivery never advances the export cursor", async () => {
  vi.mocked(fetch).mockResolvedValue({ ok: false, status: 503 } as Response);
  expect(await runAuditExport("export", "workspace")).toMatchObject({ ok: false });
  expect(state.updates.find((x) => x.payload.last_status === "failed")?.payload).toEqual({
    last_status: "failed",
  });
});
it("audit worker rejects unsafe destinations without sending data", async () => {
  state.guard.mockRejectedValue(Error("Destination refused"));
  expect(await runAuditExport("export", "workspace")).toMatchObject({ ok: false });
  expect(fetch).not.toHaveBeenCalled();
});
it("audit worker never reports an email delivery that did not occur", async () => {
  state.cfg.destination = "email";
  expect(await runAuditExport("export", "workspace")).toMatchObject({ ok: false });
  expect(fetch).not.toHaveBeenCalled();
  expect(state.rpc).not.toHaveBeenCalled();
});
