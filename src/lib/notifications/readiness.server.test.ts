import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { workflowNotificationEventTrigger } from "@/lib/workflows/notification-events";
import { DEFAULT_NOTIFICATION_DELIVERY_POLICY } from "./delivery-types";
import { loadNotificationReadiness, loadNotificationReadinessWorkflows } from "./readiness.server";

vi.mock("@/integrations/supabase/client.server", () => {
  throw Error("Readiness must not import a privileged client");
});
const W = "11111111-1111-4111-8111-111111111111";
const WF = "22222222-2222-4222-8222-222222222222";
const I = "33333333-3333-4333-8333-333333333333";
const baseRow = {
  id: WF,
  workspace_id: W,
  name: "PRIVATE name",
  entity: "project_tasks",
  enabled: true,
  status: "published",
  published_version: 3,
  trigger: workflowNotificationEventTrigger("projects.task.overdue"),
  actions: [
    {
      type: "send_notification",
      title: "PRIVATE title",
      body: "PRIVATE body",
      recipients: [{ kind: "source_responsible" }],
      delivery: { channels: ["inapp", "email"], fallback: "none" },
    },
  ],
  goal_filters: [],
  draft_actions: [{ type: "send_email", to: "PRIVATE@example.test" }],
  draft_trigger: { event: "invalid" },
};
const whatsappViewKeys = [
  "system.notification_settings.view.workspace",
  "system.channels.view.workspace",
  "system.whatsapp.view.workspace",
] as const;
const whatsappContext = () => ({
  actor: WF,
  workspace: W,
  keys: Object.fromEntries(whatsappViewKeys.map((key) => [key, true])),
});
const whatsappRow = {
  ...baseRow,
  actions: [
    { type: "send_notification", title: "PRIVATE", delivery: { channels: ["inapp", "whatsapp"] } },
  ],
};
const caps = {
  settingsView: true,
  settingsManage: false,
  deliveriesView: true,
  deliveriesWorkspaceView: false,
  whatsappConfigure: false,
  slackView: false,
  slackConfigure: false,
};
function fixture(
  options: {
    caps?: Partial<typeof caps>;
    denyArea?: string;
    accessContext?: unknown;
    contextFailure?: boolean;
    record?: boolean;
    policyFailure?: boolean;
    slackFailure?: boolean;
    queryFailure?: boolean;
    queryThrow?: boolean;
    row?: Record<string, unknown> | null;
    rows?: Record<string, unknown>[] | null;
  } = {},
) {
  const rpc = vi.fn(async (name: string, args: Record<string, unknown>) => {
    if (name === "notification_delivery_capabilities")
      return { data: { ...caps, ...options.caps }, error: null };
    if (name === "sales_area_authorize")
      return {
        data: null,
        error: args.r === options.denyArea ? { message: "PRIVATE authorization failure" } : null,
      };
    if (name === "work_access_context")
      return {
        data: options.accessContext === undefined ? whatsappContext() : options.accessContext,
        error: options.contextFailure ? { message: "PRIVATE canonical context detail" } : null,
      };
    if (name === "sales_record_access") return { data: options.record ?? true, error: null };
    if (name === "notification_delivery_settings")
      return {
        data: {
          revision: 2,
          policy: {
            ...DEFAULT_NOTIFICATION_DELIVERY_POLICY,
            email_enabled: true,
            email_daily_limit: 10,
          },
        },
        error: options.policyFailure ? { message: "PRIVATE policy detail" } : null,
      };
    if (name === "notification_slack_settings")
      return {
        data: {
          revision: 1,
          policy: {
            enabled: true,
            daily_limit: 10,
            integration_id: I,
            template_version: "neutral-v1",
          },
          integrations: [
            {
              id: I,
              team_name: "PRIVATE team",
              default_channel_name: "PRIVATE channel",
              endpoint_revision: 2,
            },
          ],
        },
        error: options.slackFailure ? { message: "PRIVATE endpoint detail" } : null,
      };
    throw Error("Unexpected RPC: " + name);
  });
  const select = vi.fn(),
    filters: Record<string, unknown> = {};
  const order = vi.fn();
  const limit = vi.fn(async (_count: number) => {
    if (options.queryThrow) throw Error("PRIVATE selector transport error");
    return {
      data: options.rows === undefined ? [baseRow] : options.rows,
      error: options.queryFailure ? { message: "PRIVATE selector SQL detail" } : null,
    };
  });
  const mutations = vi.fn(() => {
    throw Error("Readiness must not write");
  });
  const q = {
    select: (columns: string) => {
      select(columns);
      return q;
    },
    eq: (key: string, value: unknown) => {
      filters[key] = value;
      return q;
    },
    order: (key: string, options: unknown) => {
      order(key, options);
      return q;
    },
    limit,
    maybeSingle: async () => {
      if (options.queryThrow) throw Error("PRIVATE transport failure");
      return {
        data: options.row === undefined ? baseRow : options.row,
        error: options.queryFailure ? { message: "PRIVATE SQL detail" } : null,
      };
    },
    insert: mutations,
    update: mutations,
    delete: mutations,
  };
  const from = vi.fn((table: string) => {
    if (table !== "workflows") throw Error("Unexpected table: " + table);
    return q;
  });
  return {
    rpc,
    from,
    select,
    filters,
    order,
    limit,
    mutations,
    client: { rpc, from } as unknown as SupabaseClient,
  };
}
const network = vi.fn(() => {
  throw Error("Readiness must not call a provider or cron");
});
beforeEach(() => {
  network.mockClear();
  vi.stubGlobal("fetch", network);
});
afterEach(() => vi.unstubAllGlobals());

it("selects only five selector fields under workspace RLS, without fetching executable or draft JSON", async () => {
  const f = fixture();
  const result = await loadNotificationReadinessWorkflows(f.client, W);
  expect(result).toEqual({
    items: [
      { id: WF, name: baseRow.name, status: "published", enabled: true, publishedVersion: 3 },
    ],
    truncated: false,
  });
  expect(f.select).toHaveBeenCalledExactlyOnceWith("id,name,status,enabled,published_version");
  expect(f.filters).toEqual({ workspace_id: W });
  expect(f.order.mock.calls).toEqual([
    ["name", { ascending: true }],
    ["id", { ascending: true }],
  ]);
  expect(f.limit).toHaveBeenCalledExactlyOnceWith(101);
  expect(JSON.stringify(result)).not.toMatch(
    /PRIVATE body|PRIVATE title|PRIVATE@example|draft_|actions|trigger|goal_filters/,
  );
  expect(f.rpc.mock.calls.map(([name]) => name)).toEqual([
    "notification_delivery_capabilities",
    "sales_area_authorize",
  ]);
  expect(f.mutations).not.toHaveBeenCalled();
  expect(network).not.toHaveBeenCalled();
});
it("caps the minimal selector at one hundred rows and reports a real truncation without reading more content", async () => {
  const f = fixture({
    rows: Array.from({ length: 101 }, (_, i) => ({
      ...baseRow,
      id: `00000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`,
    })),
  });
  const result = await loadNotificationReadinessWorkflows(f.client, W);
  expect(result.items).toHaveLength(100);
  expect(result.truncated).toBe(true);
  expect(f.limit).toHaveBeenCalledExactlyOnceWith(101);
});
it.each([{ caps: { settingsView: false } }, { denyArea: "system.workflows" }])(
  "refuses the minimal selector before data reads when either cumulative area gate fails: %j",
  async (options) => {
    const f = fixture(options);
    await expect(loadNotificationReadinessWorkflows(f.client, W)).rejects.toThrow("Sem permissão");
    expect(f.from).not.toHaveBeenCalled();
  },
);
it.each([{ rows: null }, { queryFailure: true }, { queryThrow: true }])(
  "does not turn a failed selector query into an empty success: %j",
  async (options) => {
    const f = fixture(options);
    await expect(loadNotificationReadinessWorkflows(f.client, W)).rejects.toThrow(
      "Não foi possível consultar as regras para conferência neste workspace.",
    );
  },
);

it("uses cumulative canonical gates and a qualified published-column user read without executing or returning private configuration", async () => {
  const f = fixture();
  const report = await loadNotificationReadiness(f.client, W, WF);
  expect(f.rpc.mock.calls.slice(0, 3)).toEqual([
    ["notification_delivery_capabilities", { p_workspace: W }],
    ["sales_area_authorize", { r: "system.workflows", a: "view", t: null, i: null }],
    ["sales_record_access", { t: "workflows", i: WF, a: "view" }],
  ]);
  expect(f.from).toHaveBeenCalledExactlyOnceWith("workflows");
  expect(f.filters).toEqual({ workspace_id: W, id: WF });
  expect(f.select).toHaveBeenCalledExactlyOnceWith(
    "id,workspace_id,name,entity,enabled,status,published_version,trigger,actions,goal_filters",
  );
  expect(f.select.mock.calls[0][0]).not.toMatch(/draft|\*/);
  expect(report.workflow).toEqual({
    id: WF,
    enabled: true,
    status: "published",
    publishedVersion: 3,
    eventKey: "projects.task.overdue",
  });
  expect(JSON.stringify(report)).not.toMatch(
    /PRIVATE|source_responsible|default_channel_name|draft_actions/,
  );
  expect(f.mutations).not.toHaveBeenCalled();
  expect(network).not.toHaveBeenCalled();
});

it.each([{ caps: { settingsView: false } }, { denyArea: "system.workflows" }, { record: false }])(
  "refuses a failed cumulative read gate before selecting a workflow or dependency: %j",
  async (options) => {
    const f = fixture(options);
    await expect(loadNotificationReadiness(f.client, W, WF)).rejects.toThrow("Sem permissão");
    expect(f.from).not.toHaveBeenCalled();
    expect(f.rpc.mock.calls.some(([name]) => name === "notification_delivery_settings")).toBe(
      false,
    );
    expect(network).not.toHaveBeenCalled();
  },
);

it.each([
  { row: null },
  { row: { ...baseRow, workspace_id: I } },
  { row: { ...baseRow, id: I } },
  { queryFailure: true },
  { queryThrow: true },
])(
  "does not turn a missing, foreign or failed qualified source into a readiness result: %j",
  async (options) => {
    const f = fixture(options);
    await expect(loadNotificationReadiness(f.client, W, WF)).rejects.toThrow(
      "Regra indisponível para conferência neste workspace.",
    );
    expect(f.rpc.mock.calls.some(([name]) => name === "notification_delivery_settings")).toBe(
      false,
    );
  },
);

it("reports a real dependency RPC failure as unavailable without exposing its error or treating defaults as success", async () => {
  const f = fixture({ policyFailure: true });
  const report = await loadNotificationReadiness(f.client, W, WF);
  expect(report.checks).toContainEqual({
    code: "delivery_policy",
    scope: "operation",
    status: "unavailable",
    reason: "policy_unavailable",
  });
  expect(report.checks.find((check) => check.code === "email_policy")?.status).toBe("unavailable");
  expect(JSON.stringify(report)).not.toMatch(/PRIVATE|SQL|endpoint/);
});

it("uses canonical WhatsApp keys even when legacy sales-area authorization does not recognize shared channels", async () => {
  const f = fixture({ denyArea: "system.channels", row: whatsappRow });
  const report = await loadNotificationReadiness(f.client, W, WF);
  expect(report.checks).toContainEqual({
    code: "whatsapp_policy",
    scope: "whatsapp",
    status: "dependency_blocked",
    reason: "whatsapp_disabled",
  });
  expect(f.rpc).toHaveBeenCalledWith("work_access_context", {});
  expect(f.rpc.mock.calls.filter(([name]) => name === "sales_area_authorize")).toEqual([
    ["sales_area_authorize", { r: "system.workflows", a: "view", t: null, i: null }],
  ]);
  expect(f.from.mock.calls).toEqual([["workflows"]]);
  expect(JSON.stringify(report)).not.toMatch(/PRIVATE|actor|keys|token|ciphertext/);
  expect(network).not.toHaveBeenCalled();
});

it.each(whatsappViewKeys)(
  "keeps WhatsApp observations unavailable when effective canonical view key %s is missing or false",
  async (key) => {
    for (const effective of [undefined, false]) {
      const access = whatsappContext();
      if (effective === undefined) delete access.keys[key];
      else access.keys[key] = effective;
      const f = fixture({ accessContext: access, row: whatsappRow });
      const report = await loadNotificationReadiness(f.client, W, WF);
      expect(report.checks).toContainEqual({
        code: "whatsapp_policy",
        scope: "whatsapp",
        status: "unavailable",
        reason: "channel_access_unavailable",
      });
      expect(f.rpc).toHaveBeenCalledWith("work_access_context", {});
      expect(f.from.mock.calls).toEqual([["workflows"]]);
      expect(f.mutations).not.toHaveBeenCalled();
      expect(network).not.toHaveBeenCalled();
    }
  },
);

it.each([
  { label: "foreign context", accessContext: { ...whatsappContext(), workspace: I } },
  { label: "missing actor", accessContext: { workspace: W, keys: whatsappContext().keys } },
  { label: "unavailable context", contextFailure: true },
])(
  "keeps a $label unavailable rather than treating it as an authorized WhatsApp observation",
  async (options) => {
    const f = fixture({ ...options, row: whatsappRow });
    const report = await loadNotificationReadiness(f.client, W, WF);
    expect(report.checks).toContainEqual({
      code: "whatsapp_policy",
      scope: "whatsapp",
      status: "unavailable",
      reason: "channel_access_unavailable",
    });
    expect(f.from.mock.calls).toEqual([["workflows"]]);
    expect(JSON.stringify(report)).not.toMatch(/PRIVATE|actor|keys|token|ciphertext/);
    expect(f.mutations).not.toHaveBeenCalled();
    expect(network).not.toHaveBeenCalled();
  },
);

it.each([false, true])(
  "gates the existing Slack RPC and keeps bindings private (slackView=%s)",
  async (slackView) => {
    const f = fixture({
      caps: { slackView },
      row: { ...baseRow, actions: [{ type: "send_slack", text: "PRIVATE legacy text" }] },
    });
    const report = await loadNotificationReadiness(f.client, W, WF);
    expect(
      f.rpc.mock.calls.filter(([name]) => name === "notification_slack_settings"),
    ).toHaveLength(slackView ? 1 : 0);
    expect(report.checks.find((check) => check.code === "slack_policy")?.status).toBe(
      slackView ? "observed" : "unavailable",
    );
    expect(JSON.stringify(report)).not.toMatch(
      /PRIVATE|integration_id|endpoint_revision|channel_name/,
    );
    expect(JSON.stringify(report)).not.toContain(I);
    expect(network).not.toHaveBeenCalled();
  },
);
