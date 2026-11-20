import { beforeEach, it, expect, vi } from "vitest";
const state = vi.hoisted(() => ({ rpc: vi.fn(), area: vi.fn(), manage: vi.fn(), record: vi.fn() }));
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    const b = { middleware: () => b, inputValidator: () => b, handler: (f: unknown) => f };
    return b;
  },
}));
vi.mock("@/lib/access-control/active-workspace.middleware", () => ({
  requireWorkspaceContext: () => ({}),
}));
vi.mock("@/lib/access-control/work-core.server", () => ({ workRpc: state.rpc }));
vi.mock("@/lib/access-control/sales-core.server", () => ({
  assertSalesArea: state.area,
  assertSalesRecord: state.record,
}));
vi.mock("@/lib/access-control/admin-gates.server", () => ({ assertWorkflowsManage: state.manage }));
import {
  getNotificationDeliveryCapabilities,
  getNotificationDeliverySettings,
  saveNotificationDeliverySettings,
  listNotificationDeliveryHistory,
  listNotificationWhatsAppSenders,
  listNotificationWhatsAppTemplates,
} from "./delivery-admin.functions";
import {
  getNotificationDeliveryConsent,
  saveNotificationDeliveryConsent,
  updateNotificationProfilePhone,
} from "./delivery-personal.functions";
import {
  listNotificationWorkflowRules,
  previewNotificationWorkflow,
} from "./delivery-rules.functions";
import {
  WORKFLOW_NOTIFICATION_EVENTS,
  workflowNotificationEventTrigger,
} from "@/lib/workflows/notification-events";
const W = "11111111-1111-4111-8111-111111111111",
  U = "22222222-2222-4222-8222-222222222222";
const from = vi.fn();
const ctx = { userId: U, activeWorkspaceId: W, supabase: { from } };
const call = (fn: unknown, data: unknown, context = ctx) =>
  (fn as (input: { context: typeof ctx; data: unknown }) => Promise<unknown>)({ context, data });
const caps = {
  settingsView: true,
  settingsManage: true,
  deliveriesView: true,
  deliveriesWorkspaceView: false,
  whatsappConfigure: false,
};
beforeEach(() => {
  vi.clearAllMocks();
  from.mockReset();
  state.area.mockResolvedValue(undefined);
  state.record.mockResolvedValue(undefined);
  state.manage.mockResolvedValue(undefined);
  state.rpc.mockImplementation(async (_client, name) =>
    name === "notification_delivery_capabilities" ? caps : { items: [], nextCursor: null },
  );
});
it.each([
  getNotificationDeliveryCapabilities,
  getNotificationDeliverySettings,
  saveNotificationDeliverySettings,
  listNotificationDeliveryHistory,
  listNotificationWhatsAppSenders,
  listNotificationWhatsAppTemplates,
  getNotificationDeliveryConsent,
  saveNotificationDeliveryConsent,
  updateNotificationProfilePhone,
  listNotificationWorkflowRules,
  previewNotificationWorkflow,
])("delivery API refuses workspace race before IO %s", async (fn) => {
  await expect(call(fn, { workspaceId: U })).rejects.toThrow("workspace mudou");
  expect(state.rpc).not.toHaveBeenCalled();
  expect(from).not.toHaveBeenCalled();
});
it("delivery API refuses an absent authenticated actor", async () => {
  await expect(
    call(getNotificationDeliveryCapabilities, { workspaceId: W }, { ...ctx, userId: "" }),
  ).rejects.toThrow();
  expect(state.rpc).not.toHaveBeenCalled();
});
it("admin settings fail closed without the view key", async () => {
  state.rpc.mockResolvedValue({ ...caps, settingsView: false });
  await expect(call(getNotificationDeliverySettings, { workspaceId: W })).rejects.toThrow(
    "Sem permissão",
  );
  expect(state.rpc).toHaveBeenCalledTimes(1);
});
it("admin settings require manage and retain the revision CAS", async () => {
  state.rpc.mockResolvedValue({ ...caps, settingsManage: false });
  await expect(
    call(saveNotificationDeliverySettings, { workspaceId: W, revision: 0, policy: {} }),
  ).rejects.toThrow("Sem permissão");
  expect(state.rpc).toHaveBeenCalledTimes(1);
});
it("workspace delivery history requires its own permission", async () => {
  await expect(
    call(listNotificationDeliveryHistory, { workspaceId: W, scope: "workspace" }),
  ).rejects.toThrow("Sem permissão");
  expect(state.rpc).toHaveBeenCalledTimes(1);
});
it("personal history uses own selected workspace and no other-user selector", async () => {
  await expect(
    call(listNotificationDeliveryHistory, { workspaceId: W, scope: "own" }),
  ).resolves.toEqual({ items: [], nextCursor: null });
  expect(state.rpc).toHaveBeenLastCalledWith(
    ctx.supabase,
    "notification_delivery_history",
    expect.objectContaining({ p_scope: "own", p_workspace: W }),
  );
});
it("retains the proven event identity from authorized delivery history without looking up source snapshots", async () => {
  state.rpc.mockImplementation(async (_client, name) =>
    name === "notification_delivery_capabilities"
      ? caps
      : {
          items: [
            {
              id: U,
              eventKey: "contracts.signature.completed",
              channel: "whatsapp",
              status: "read",
              attempts: 1,
              reason_code: null,
              created_at: "2026-11-20T10:00:00Z",
              updated_at: "2026-11-20T10:01:00Z",
            },
          ],
          nextCursor: null,
        },
  );
  await expect(
    call(listNotificationDeliveryHistory, { workspaceId: W, scope: "own" }),
  ).resolves.toMatchObject({
    items: [{ eventKey: "contracts.signature.completed", status: "read" }],
  });
  expect(from).not.toHaveBeenCalled();
});
it("provider templates require channel access before querying sender or secrets", async () => {
  state.area.mockRejectedValue(Error("channel denied"));
  await expect(
    call(listNotificationWhatsAppTemplates, { workspaceId: W, senderPhoneNumberId: "123456" }),
  ).rejects.toThrow("channel denied");
  expect(from).not.toHaveBeenCalled();
});

type SenderCatalogueRow = Record<string, unknown>;
function senderCatalogue(
  numbers: SenderCatalogueRow[] = [],
  connections: SenderCatalogueRow[] = [],
  failedTable?: "wa_cloud_numbers" | "wa_cloud_connections",
) {
  const reads: {
    table: string;
    columns: string;
    filters: Record<string, unknown>;
    limit: number | null;
  }[] = [];
  from.mockImplementation((table: string) => {
    const read = {
      table,
      columns: "",
      filters: {} as Record<string, unknown>,
      limit: null as number | null,
    };
    reads.push(read);
    const query = {
      select: (columns: string) => {
        read.columns = columns;
        return query;
      },
      eq: (key: string, value: unknown) => {
        read.filters[key] = value;
        return query;
      },
      order: () => query,
      limit: async (limit: number) => {
        read.limit = limit;
        const rows = table === "wa_cloud_numbers" ? numbers : connections;
        return {
          data:
            failedTable === table
              ? null
              : rows.filter((row) =>
                  Object.entries(read.filters).every(([key, value]) => row[key] === value),
                ),
          error: failedTable === table ? { message: "Synthetic unavailable catalogue" } : null,
        };
      },
    };
    return query;
  });
  return reads;
}

it("distinguishes available senders from eligible connected verified high-quality senders without selecting secrets", async () => {
  const connection = {
    id: U,
    workspace_id: W,
    enabled: true,
    webhook_verified_at: "2026-11-20T12:00:00Z",
  };
  const number = {
    workspace_id: W,
    phone_number_id: "654321",
    connection_id: U,
    display_phone_number: "+14155552672",
    verified_name: "Synthetic sender",
    quality_rating: "GREEN",
    status: "CONNECTED",
    available: true,
    synced_at: "2026-11-20T12:00:00Z",
  };
  const variants = [
    [{}, true, null],
    [{ quality_rating: "HIGH" }, true, null],
    [{ available: false }, false, "sender_unavailable"],
    [{ status: "DISCONNECTED" }, false, "sender_unavailable"],
    [{ connection_id: "disabled" }, true, "connection_unavailable"],
    [{ connection_id: "missing" }, true, "connection_unavailable"],
    [{ connection_id: "unverified" }, true, "webhook_unverified"],
    [{ quality_rating: "YELLOW" }, true, "quality_not_high"],
    [{ quality_rating: "RED" }, true, "quality_not_high"],
    [{ quality_rating: null }, true, "quality_not_high"],
  ] as const;
  const reads = senderCatalogue(
    [
      ...variants.map(([patch], index) => ({
        ...number,
        ...patch,
        phone_number_id: String(654321 + index),
      })),
      { ...number, workspace_id: U, phone_number_id: "999999" },
    ],
    [
      connection,
      { ...connection, id: "disabled", enabled: false },
      { ...connection, id: "unverified", webhook_verified_at: null },
      { ...connection, id: "foreign", workspace_id: U },
    ],
  );
  const result = (await call(listNotificationWhatsAppSenders, { workspaceId: W })) as {
    items: { id: string; available: boolean; eligible: boolean; reason: string | null }[];
  };
  expect(
    result.items.map(({ id, available, eligible, reason }) => ({
      id,
      available,
      eligible,
      reason,
    })),
  ).toEqual(
    variants.map(([, available, reason], index) => ({
      id: String(654321 + index),
      available,
      eligible: reason === null,
      reason,
    })),
  );
  expect(state.area.mock.calls).toEqual([
    [ctx.supabase, "system.channels", "view"],
    [ctx.supabase, "system.whatsapp", "view"],
  ]);
  expect(reads).toEqual([
    {
      table: "wa_cloud_numbers",
      columns:
        "phone_number_id,connection_id,display_phone_number,verified_name,quality_rating,status,available,synced_at",
      filters: { workspace_id: W },
      limit: 100,
    },
    {
      table: "wa_cloud_connections",
      columns: "id,enabled,webhook_verified_at",
      filters: { workspace_id: W },
      limit: 100,
    },
  ]);
  expect(reads.every((read) => !/credentials|ciphertext|token|secret/i.test(read.columns))).toBe(
    true,
  );
});

it.each(["wa_cloud_numbers", "wa_cloud_connections"] as const)(
  "propagates an unavailable %s catalogue instead of returning an empty sender list",
  async (failedTable) => {
    const reads = senderCatalogue([], [], failedTable);
    await expect(call(listNotificationWhatsAppSenders, { workspaceId: W })).rejects.toThrow(
      "Não foi possível consultar os remetentes do WhatsApp",
    );
    expect(reads).toHaveLength(2);
    expect(reads.every((read) => read.filters.workspace_id === W)).toBe(true);
    expect(state.rpc).toHaveBeenCalledWith(ctx.supabase, "notification_delivery_capabilities", {
      p_workspace: W,
    });
  },
);

it("personal consent revocation does not require the old phone to still match profile", async () => {
  const result = { phone: null, consent: null };
  state.rpc.mockResolvedValue(result);
  await expect(
    call(saveNotificationDeliveryConsent, {
      workspaceId: W,
      granted: false,
      phone: "",
      revision: 2,
    }),
  ).resolves.toEqual(result);
  expect(state.rpc).toHaveBeenCalledWith(ctx.supabase, "save_notification_delivery_consent", {
    p_workspace: W,
    p_granted: false,
    p_phone: "",
    p_revision: 2,
  });
});
it("profile phone RPC receives only own new phone and compare-and-set baseline", async () => {
  state.rpc.mockResolvedValue({ phone: "+5548999999999" });
  await call(updateNotificationProfilePhone, {
    workspaceId: W,
    phone: "+5548999999999",
    expectedPhone: null,
  });
  expect(state.rpc).toHaveBeenCalledWith(ctx.supabase, "notification_delivery_profile_phone", {
    p_workspace: W,
    p_phone: "+5548999999999",
    p_expected_phone: null,
  });
});
it("preview requires canonical workflow read and row authorization before reads", async () => {
  state.area.mockRejectedValue(Error("view denied"));
  await expect(
    call(previewNotificationWorkflow, { workspaceId: W, workflowId: U }),
  ).rejects.toThrow("view denied");
  expect(from).not.toHaveBeenCalled();
  expect(state.record).not.toHaveBeenCalled();
});

function previewRuleRow(entity: string, trigger: unknown, actions?: unknown[]) {
  const row = {
    id: U,
    name: "Regra de demonstração",
    entity,
    enabled: false,
    trigger,
    actions: actions ?? [
      {
        type: "send_notification",
        title: "Atualização no TechERP",
        ...(entity === "hiring_preparation_requests"
          ? { recipients: [{ kind: "pending_approvers" }] }
          : {}),
      },
    ],
    draft_trigger: null,
    draft_actions: null,
  };
  from.mockImplementation((table) => {
    if (table !== "workflows") throw Error("Preview must not read source records");
    const q = {
      select: () => q,
      eq: () => q,
      maybeSingle: async () => ({ data: row, error: null }),
    };
    return q;
  });
  state.rpc.mockResolvedValue({ ...caps, settingsView: false });
}

it.each(WORKFLOW_NOTIFICATION_EVENTS)(
  "describes the configured $key draft without producing an occurrence or reading recipients",
  async (event) => {
    previewRuleRow(event.entity, workflowNotificationEventTrigger(event.key, 17));
    const result = (await call(previewNotificationWorkflow, {
      workspaceId: W,
      workflowId: U,
    })) as { issues: string[]; notificationSteps: number; realMessages: number };
    expect(result).toMatchObject({ realMessages: 0, notificationSteps: 1 });
    expect(result.issues.some((note) => note.includes(event.label))).toBe(true);
    if (event.deadline) expect(result.issues.some((note) => note.includes("17 dias"))).toBe(true);
    expect(state.record).toHaveBeenCalledWith(ctx.supabase, "workflows", U, "view");
    expect(from.mock.calls.map(([table]) => table)).toEqual(["workflows"]);
    expect(state.rpc.mock.calls.map(([, name]) => name)).toEqual([
      "notification_delivery_capabilities",
    ]);
  },
);
it("does not describe an arbitrary recipient as an executable preparation approval draft", async () => {
  previewRuleRow(
    "hiring_preparation_requests",
    workflowNotificationEventTrigger("people.approval.pending"),
    [{ type: "send_notification", title: "Atualização", recipients: [{ kind: "user", id: U }] }],
  );
  const result = await call(previewNotificationWorkflow, { workspaceId: W, workflowId: U });
  expect(result).toMatchObject({ realMessages: 0, notificationSteps: 0 });
  expect(from.mock.calls.map(([table]) => table)).toEqual(["workflows"]);
});

it.each([
  { entity: "people", trigger: workflowNotificationEventTrigger("crm.deal.won") },
  { entity: "projects", trigger: workflowNotificationEventTrigger("projects.task.overdue") },
  {
    entity: "project_milestones",
    trigger: { event: "updated", notification_event: { key: "projects.milestone.due" } },
  },
  {
    entity: "projects",
    trigger: {
      event: "updated",
      notification_event: { key: "projects.project.overdue", days_before: 1 },
    },
  },
  {
    entity: "contracts",
    trigger: { event: "updated", notification_event: { key: "contracts.contract.expiring" } },
  },
  {
    entity: "contracts",
    trigger: {
      event: "updated",
      notification_event: { key: "contracts.contract.renewal_due", days_before: -3 },
    },
  },
])(
  "refuses an invalid event draft before consulting channel configuration $entity",
  async (row) => {
    previewRuleRow(row.entity, row.trigger);
    const result = await call(previewNotificationWorkflow, { workspaceId: W, workflowId: U });
    expect(result).toMatchObject({ notificationSteps: 0, channels: [], realMessages: 0 });
    expect(state.rpc).not.toHaveBeenCalled();
    expect(from.mock.calls.map(([table]) => table)).toEqual(["workflows"]);
  },
);
it.each([
  { key: "projects.project.started", note: "Planejamento para Ativo" },
  { key: "projects.project.overdue", note: "Atrasos anteriores à publicação" },
  { key: "projects.task.overdue", note: "situação personalizada de conclusão" },
  { key: "projects.milestone.due", note: "17 dias antes do prazo do marco" },
] as const)(
  "explains the Projects scheduling boundary for $key without reading the source",
  async ({ key, note }) => {
    const definition = WORKFLOW_NOTIFICATION_EVENTS.find((event) => event.key === key)!;
    previewRuleRow(definition.entity, workflowNotificationEventTrigger(key, 17));
    const result = (await call(previewNotificationWorkflow, { workspaceId: W, workflowId: U })) as {
      issues: string[];
      realMessages: number;
    };
    expect(result.realMessages).toBe(0);
    expect(result.issues.some((issue) => issue.includes(note))).toBe(true);
    expect(result.issues.some((issue) => issue.includes("por si só"))).toBe(true);
    expect(from.mock.calls.map(([table]) => table)).toEqual(["workflows"]);
    expect(state.record).toHaveBeenCalledWith(ctx.supabase, "workflows", U, "view");
    expect(state.rpc.mock.calls.map(([, name]) => name)).toEqual([
      "notification_delivery_capabilities",
    ]);
  },
);
it("rules list propagates database denial instead of fabricating empty success", async () => {
  state.rpc.mockRejectedValue(Error("source denied"));
  await expect(call(listNotificationWorkflowRules, { workspaceId: W })).rejects.toThrow(
    "source denied",
  );
});

it("rules preserve pending draft changes including goals using canonical workflow comparison", async () => {
  const row = {
    id: U,
    name: "Rule",
    entity: "deals",
    enabled: true,
    status: "published",
    published_version: 1,
    trigger: { event: "created" },
    actions: [],
    draft_trigger: null,
    draft_actions: null,
    goal_filters: [],
    draft_goal_filters: [{ field: "status", op: "eq", value: "won" }],
  };
  state.rpc.mockResolvedValue({ items: [row], truncated: false });
  const result = (await call(listNotificationWorkflowRules, { workspaceId: W })) as {
    items: { has_draft_changes: boolean; draft_trigger: unknown }[];
  };
  expect(result.items[0].has_draft_changes).toBe(true);
  expect(result.items[0].draft_trigger).toEqual(row.trigger);
  state.rpc.mockResolvedValue({ items: [{ ...row, draft_goal_filters: null }], truncated: false });
  const clean = (await call(listNotificationWorkflowRules, { workspaceId: W })) as typeof result;
  expect(clean.items[0].has_draft_changes).toBe(false);
});

it("Slack settings allows authorized configuration without returning credentials", async () => {
  const { getNotificationSlackSettings } = await import("./delivery-admin.functions");
  state.rpc.mockImplementation(async (_client, name) =>
    name === "notification_delivery_capabilities"
      ? { ...caps, slackView: true, slackConfigure: true }
      : {
          revision: 1,
          policy: {
            enabled: false,
            daily_limit: 0,
            integration_id: null,
            template_version: "neutral-v1",
          },
          integrations: [],
          webhookUrl: "PRIVATE",
        },
  );
  const result = await call(getNotificationSlackSettings, { workspaceId: W });
  expect(result).toMatchObject({ canManage: true, revision: 1, integrations: [] });
  expect(JSON.stringify(result)).not.toContain("PRIVATE");
});
it("Slack settings rejects missing Slack key before configuration read", async () => {
  const { getNotificationSlackSettings } = await import("./delivery-admin.functions");
  await expect(call(getNotificationSlackSettings, { workspaceId: W })).rejects.toThrow(
    "Sem permissão",
  );
  expect(state.rpc).toHaveBeenCalledTimes(1);
});
it("Slack settings rejects explicit deny before configuration save", async () => {
  const { saveNotificationSlackSettings } = await import("./delivery-admin.functions");
  state.rpc.mockResolvedValue({ ...caps, slackView: true, slackConfigure: false });
  await expect(
    call(saveNotificationSlackSettings, { workspaceId: W, revision: 0, policy: {} }),
  ).rejects.toThrow("Sem permissão");
  expect(state.rpc).toHaveBeenCalledTimes(1);
});
it("Slack settings rejects foreign workspace before IO", async () => {
  const { getNotificationSlackSettings } = await import("./delivery-admin.functions");
  await expect(call(getNotificationSlackSettings, { workspaceId: U })).rejects.toThrow(
    "workspace mudou",
  );
  expect(state.rpc).not.toHaveBeenCalled();
});
it("Slack settings propagates inactive membership denial without reading configuration", async () => {
  const { getNotificationSlackSettings } = await import("./delivery-admin.functions");
  state.rpc.mockRejectedValue(Error("inactive member"));
  await expect(call(getNotificationSlackSettings, { workspaceId: W })).rejects.toThrow(
    "inactive member",
  );
  expect(state.rpc).toHaveBeenCalledTimes(1);
});
it("Slack settings save preserves CAS revision and the protected template", async () => {
  const { saveNotificationSlackSettings } = await import("./delivery-admin.functions");
  const policy = {
    enabled: false,
    daily_limit: 1,
    integration_id: null,
    template_version: "neutral-v1",
  };
  state.rpc.mockImplementation(async (_client, name) =>
    name === "notification_delivery_capabilities"
      ? { ...caps, slackView: true, slackConfigure: true }
      : { revision: 3, policy, integrations: [] },
  );
  await expect(
    call(saveNotificationSlackSettings, { workspaceId: W, revision: 2, policy }),
  ).resolves.toMatchObject({ revision: 3 });
  expect(state.rpc).toHaveBeenLastCalledWith(ctx.supabase, "notification_slack_settings_save", {
    p_workspace: W,
    p_policy: policy,
    p_revision: 2,
  });
});
