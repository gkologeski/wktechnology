import { afterEach, beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  tables: {} as Record<string, Record<string, unknown>[]>,
  email: vi.fn(),
  mime: vi.fn(),
  gmail: vi.fn(),
  sync: vi.fn(),
  authorize: vi.fn(),
}));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: (table: string) => {
      const filters: Array<[string, unknown]> = [];
      const rows = () =>
        (state.tables[table] ?? []).filter((row) =>
          filters.every(([key, value]) => row[key] === value),
        );
      const response = () => ({ data: rows(), count: rows().length, error: null });
      const chain = {
        select: () => chain,
        eq: (key: string, value: unknown) => {
          filters.push([key, value]);
          return chain;
        },
        in: () => chain,
        lte: () => chain,
        order: () => chain,
        limit: () => chain,
        update: () => chain,
        insert: () => chain,
        single: async () => ({ data: rows()[0] ?? null, error: null }),
        maybeSingle: async () => ({ data: rows()[0] ?? null, error: null }),
        then: (resolve: (value: unknown) => unknown) => Promise.resolve(response()).then(resolve),
      };
      return chain;
    },
  },
}));
vi.mock("@lovable.dev/email-js", () => ({ sendLovableEmail: state.email }));
vi.mock("@/lib/email-unsubscribe.server", () => ({
  getOrCreateEmailUnsubscribeToken: async () => "fixture-token",
}));
vi.mock("@/lib/gmail.server", () => ({
  ensureAccessToken: async () => "synthetic-provider-token",
  gmailSendRaw: state.gmail,
  buildRawMime: (input: unknown) => {
    state.mime(input);
    return "MIME-Version: 1.0\r\n";
  },
}));
vi.mock("@/lib/runtime-config.server", () => ({
  publicAppOrigin: () => "https://app.example.invalid",
}));
vi.mock("@/lib/access-control/sales-worker.server", () => ({ assertSalesWorker: state.authorize }));
vi.mock("@/lib/gmail-sync.server", () => ({ syncAccount: state.sync }));
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    const builder = {
      middleware: () => builder,
      inputValidator: () => builder,
      handler: (handler: unknown) => handler,
    };
    return builder;
  },
}));
vi.mock("@/lib/access-control/sales-permission.middleware", () => ({
  requireSalesPermission: () => ({}),
}));
import { tickAtsStageEmails } from "@/lib/ats/email-engine.server";
import { tickEmailBroadcasts } from "@/lib/email-broadcast/engine.server";
import { runAllAccountsSync } from "@/lib/gmail-sync.functions";
beforeEach(() => {
  vi.clearAllMocks();
  state.tables = {};
  vi.stubEnv("LOVABLE_API_KEY", "synthetic-email-provider-key");
  state.authorize.mockResolvedValue(undefined);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});
it("ATS sends escaped applicant content while preserving plain subject", async () => {
  state.tables = {
    ats_stage_email_log: [
      {
        id: "queue",
        owner_id: "owner",
        candidate_id: "candidate",
        status: "pending",
        body: "<p>{{candidate.full_name}}</p>",
        subject: "Hello {{candidate.full_name}}",
        stage_value: "review",
        to_email: "candidate@example.invalid",
      },
    ],
    ats_candidates: [
      { id: "candidate", full_name: "<img src=x>", email: "candidate@example.invalid" },
    ],
  };
  expect((await tickAtsStageEmails()).sent).toBe(1);
  expect(state.email).toHaveBeenCalledWith(
    expect.objectContaining({ html: "<p>&lt;img src=x&gt;</p>", subject: "Hello <img src=x>" }),
    expect.anything(),
  );
});
function broadcastFixture() {
  state.tables = {
    email_broadcasts: [
      {
        id: "campaign",
        workspace_id: "wk",
        owner_id: "owner",
        status: "running",
        subject: "Hello {{name}}",
        body_html: "<p>{{name}} {{company}}</p>",
        body_text: "Hello {{name}}",
        rate_per_minute: 1,
      },
    ],
    email_accounts: [
      {
        id: "account",
        workspace_id: "wk",
        owner_id: "owner",
        provider: "gmail",
        status: "connected",
        email: "sender@example.invalid",
      },
    ],
    email_broadcast_recipients: [
      {
        id: "recipient",
        broadcast_id: "campaign",
        status: "pending",
        email: "recipient@example.invalid",
        name: "<img src=x>",
        variables: { company_name: "R&D" },
        contact_id: "contact",
      },
    ],
    email_unsubscribes: [
      {
        workspace_id: "wk",
        owner_id: "owner",
        email: "recipient@example.invalid",
        token: "fixture-token",
      },
    ],
  };
}
it("broadcast sends escaped tokens and preserves text and subject", async () => {
  broadcastFixture();
  expect((await tickEmailBroadcasts()).sent).toBe(1);
  expect(state.mime).toHaveBeenCalledWith(
    expect.objectContaining({
      subject: "Hello <img src=x>",
      bodyHtml: expect.stringContaining("<p>&lt;img src=x&gt; R&amp;D</p>"),
      bodyText: expect.stringContaining("Hello <img src=x>"),
    }),
  );
  expect(state.authorize).toHaveBeenCalledWith(expect.anything(), "email_broadcasts", "campaign", [
    { table: "email_accounts", id: "account" },
    { table: "contacts", id: "contact" },
  ]);
  expect(state.gmail).toHaveBeenCalledOnce();
});
it("broadcast never sends after current authorization is denied", async () => {
  broadcastFixture();
  state.authorize.mockRejectedValue(new Error("explicit deny"));
  expect((await tickEmailBroadcasts()).failed).toBe(1);
  expect(state.gmail).not.toHaveBeenCalled();
});
it("Gmail failure diagnostics contain neither email nor provider error text", async () => {
  state.tables = {
    email_accounts: [
      {
        id: "account-id",
        email: "private@example.invalid",
        provider: "gmail",
        status: "connected",
      },
    ],
  };
  state.sync.mockRejectedValue(new Error("private@example.invalid provider failure"));
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  expect((await runAllAccountsSync()).errors).toBe(1);
  expect(log).toHaveBeenCalledExactlyOnceWith("[gmail-sync] account account-id failed");
});
