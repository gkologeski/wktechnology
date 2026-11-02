import { beforeEach, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSequenceVersion, preflightSequence, sequenceTemplates } from "./releases.server";
import { newDefinition, newStep } from "./draft";
const mocks = vi.hoisted(() => ({ catalog: vi.fn(), resolve: vi.fn() }));
vi.mock("@/lib/whatsapp/templates.server", () => ({ loadTemplateCatalog: mocks.catalog }));
vi.mock("@/lib/whatsapp/meta-channel.server", () => ({ resolveWaNumber: mocks.resolve }));
const W = "aaaaaaaa-0000-4000-8000-00000000000a",
  U = "10000000-0000-4000-8000-000000000002",
  ID = "50000000-0000-4000-8000-000000000001",
  A = "50000000-0000-4000-8000-000000000002";
const input = { workspaceId: W, id: ID, expectedRevision: 1 };
function fixture(failure?: string, failOn = "sales_area_authorize") {
  const definition = newDefinition();
  definition.steps = [
    {
      ...newStep("email"),
      accountId: A,
      subject: "Olá",
      body: "Vamos conversar?",
      thread: "new",
    } as never,
    newStep("end"),
  ];
  const tables: Record<string, unknown> = {
    prospecting_sequence_drafts: { id: ID, workspace_id: W, owner_id: U, revision: 1, definition },
    service_channel_accounts: {
      id: A,
      workspace_id: W,
      enabled: true,
      channel: "email",
      source_key: A,
    },
    email_accounts: { id: A },
  };
  const rpc = vi.fn(async (name: string) =>
    failure && name === failOn
      ? { data: null, error: { message: failure } }
      : {
          data:
            name === "sales_access_context" || name === "service_channel_authorize"
              ? { workspace: W, actor: U }
              : name === "prospecting_sequence_version_create"
                ? { id: ID, draft_revision: 1 }
                : true,
          error: null,
        },
  );
  const from = vi.fn((table: string) => {
    const q: any = {};
    for (const m of ["select", "eq", "order", "limit"]) q[m] = vi.fn(() => q);
    q.maybeSingle = vi.fn(async () => ({ data: tables[table] ?? null, error: null }));
    q.then = (resolve: any) =>
      Promise.resolve({ data: tables[table] ?? [], error: null }).then(resolve);
    return q;
  });
  return { rpc, from, tables, definition, client: { rpc, from } as unknown as SupabaseClient };
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.resolve.mockResolvedValue({ phoneNumberId: "123456" });
  mocks.catalog.mockResolvedValue({ source: "provider", items: [] });
});
it("sequence version allows an authorized active caller and only freezes saved revision", async () => {
  const f = fixture();
  await expect(createSequenceVersion(f.client, input)).resolves.toMatchObject({
    draft_revision: 1,
  });
  expect(f.rpc).toHaveBeenLastCalledWith("prospecting_sequence_version_create", {
    p_id: ID,
    p_workspace: W,
    p_expected_revision: 1,
  });
  expect(f.rpc.mock.calls[0]).toEqual([
    "sales_area_authorize",
    { r: "system.automation.sequences", a: "manage", t: null, i: null },
  ]);
});
it("sequence version rejects missing permission before reading or freezing", async () => {
  const f = fixture("missing permission");
  await expect(createSequenceVersion(f.client, input)).rejects.toThrow("missing permission");
  expect(f.from).not.toHaveBeenCalled();
});
it("sequence version rejects explicit deny before freezing", async () => {
  const f = fixture("explicit deny");
  await expect(createSequenceVersion(f.client, input)).rejects.toThrow("explicit deny");
  expect(f.from).not.toHaveBeenCalled();
});
it("sequence version rejects foreign workspace before reading draft", async () => {
  const f = fixture();
  await expect(
    createSequenceVersion(f.client, { ...input, workspaceId: crypto.randomUUID() }),
  ).rejects.toThrow("Workspace indisponível");
  expect(f.from).not.toHaveBeenCalled();
});
it("sequence version rejects inactive actor before reading or freezing", async () => {
  const f = fixture("inactive actor");
  await expect(createSequenceVersion(f.client, input)).rejects.toThrow("inactive actor");
  expect(f.from).not.toHaveBeenCalled();
});
it("preflight does not create a version and reports unavailable email", async () => {
  const f = fixture();
  f.tables.email_accounts = null;
  const report = await preflightSequence(f.client, input);
  expect(report.configurationValid).toBe(false);
  expect(report.executionEnabled).toBe(false);
  expect(report.issues[0].code).toBe("email_account_unavailable");
  expect(f.rpc.mock.calls.some((c) => c[0] === "prospecting_sequence_version_create")).toBe(false);
});
it("version blocks invalid configuration and stale revision", async () => {
  const f = fixture();
  f.definition.steps = newDefinition().steps;
  await expect(createSequenceVersion(f.client, input)).rejects.toThrow();
  expect(f.rpc.mock.calls.some((c) => c[0] === "prospecting_sequence_version_create")).toBe(false);
  await expect(createSequenceVersion(f.client, { ...input, expectedRevision: 2 })).rejects.toThrow(
    "Rascunho alterado",
  );
});
it("template catalog refuses wrong channel access before any provider query", async () => {
  const f = fixture("channels denied", "service_channel_authorize");
  await expect(sequenceTemplates(f.client, U, W, A)).rejects.toThrow("channels denied");
  expect(mocks.resolve).not.toHaveBeenCalled();
  expect(mocks.catalog).not.toHaveBeenCalled();
});
it("template catalog uses exact authorized phone and refuses local fallback", async () => {
  const f = fixture();
  f.tables.service_channel_accounts = {
    id: A,
    workspace_id: W,
    enabled: true,
    channel: "whatsapp",
    source_key: "123456",
  };
  mocks.catalog.mockResolvedValue({ source: "local", items: [] });
  await expect(sequenceTemplates(f.client, U, W, A)).rejects.toThrow("provedor");
  expect(mocks.resolve).toHaveBeenCalledWith(W, "123456");
  expect(mocks.catalog).toHaveBeenCalledWith(f.client, W, { phoneNumberId: "123456" });
});
it("preflight caches the approved catalog per exact sender and never dispatches", async () => {
  const f = fixture();
  f.tables.service_channel_accounts = {
    id: A,
    workspace_id: W,
    enabled: true,
    channel: "whatsapp",
    source_key: "123456",
  };
  const step = {
    ...newStep("whatsapp"),
    accountId: A,
    templateName: "abertura",
    language: "pt_BR",
    variables: {},
  };
  f.definition.steps = [
    step as never,
    { ...step, id: crypto.randomUUID() } as never,
    newStep("end"),
  ];
  mocks.catalog.mockResolvedValue({
    source: "provider",
    items: [
      {
        name: "abertura",
        language: "pt_BR",
        status: "APPROVED",
        components: [{ type: "BODY", text: "Olá" }],
      },
    ],
  });
  const report = await preflightSequence(f.client, input);
  expect(report.issues).toEqual([]);
  expect(report.configurationValid).toBe(true);
  expect(report.executionEnabled).toBe(false);
  expect(mocks.catalog).toHaveBeenCalledTimes(1);
});
it("preflight distinguishes catalog outage from an empty approved catalog", async () => {
  const f = fixture();
  f.tables.service_channel_accounts = {
    id: A,
    workspace_id: W,
    enabled: true,
    channel: "whatsapp",
    source_key: "123456",
  };
  f.definition.steps = [
    { ...newStep("whatsapp"), accountId: A, templateName: "abertura", language: "pt_BR" } as never,
  ];
  mocks.catalog.mockRejectedValue(new Error("provider secret must not leak"));
  const outage = await preflightSequence(f.client, input);
  expect(outage.issues.map((i) => i.code)).toContain("template_catalog_unavailable");
  expect(JSON.stringify(outage)).not.toContain("secret");
  mocks.catalog.mockResolvedValue({ source: "provider", items: [] });
  const empty = await preflightSequence(f.client, input);
  expect(empty.issues.map((i) => i.code)).toContain("template_unavailable");
});
it("preflight requires enabled agent binding for the email sender as well", async () => {
  const f = fixture();
  f.definition.settings.agentId = ID;
  f.tables.sdr_playbooks = { id: ID };
  f.tables.sdr_agent_versions = { id: ID };
  const report = await preflightSequence(f.client, input);
  expect(report.issues.map((i) => i.code)).toContain("channel_agent_unavailable");
  f.tables.service_channel_bindings = { account_id: A };
  expect((await preflightSequence(f.client, input)).issues).toEqual([]);
});
