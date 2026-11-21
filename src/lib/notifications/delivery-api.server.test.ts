import { beforeEach, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
const state = vi.hoisted(() => ({
  rpc: vi.fn(),
  area: vi.fn(),
  manage: vi.fn(),
  record: vi.fn(),
  validators: new Map<unknown, (input: unknown) => unknown>(),
}));
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    let validator = (input: unknown) => input;
    const b = {
      middleware: () => b,
      inputValidator: (parse: typeof validator) => {
        validator = parse;
        return b;
      },
      handler: (f: unknown) => {
        state.validators.set(f, validator);
        return f;
      },
    };
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
import { assertNotificationTemplateAccess } from "./delivery-access.server";
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
  getNotificationDigestSettings,
  saveNotificationDigestSettings,
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
const whatsappViewKeys = [
  "system.notification_settings.view.workspace",
  "system.channels.view.workspace",
  "system.whatsapp.view.workspace",
] as const;
const whatsappContext = () => ({
  actor: U,
  workspace: W,
  keys: Object.fromEntries(whatsappViewKeys.map((key) => [key, true])),
});
const senderItem = {
  id: "654321",
  phone: "+14155552672",
  label: "Synthetic sender",
  available: true,
  quality: "GREEN",
  status: "CONNECTED",
  syncedAt: "2026-11-20T12:00:00Z",
  eligible: true,
  reason: null,
};
function senderRpc(result: unknown = { items: [senderItem] }, access: unknown = whatsappContext()) {
  state.rpc.mockImplementation(async (_client, name) => {
    if (name === "notification_delivery_capabilities") return caps;
    if (name === "work_access_context") return access;
    if (name === "notification_whatsapp_senders") return result;
    throw Error("Unexpected RPC: " + name);
  });
}
beforeEach(() => {
  vi.clearAllMocks();
  from.mockReset();
  state.rpc.mockReset();
  state.area.mockResolvedValue(undefined);
  state.record.mockResolvedValue(undefined);
  state.manage.mockResolvedValue(undefined);
  state.rpc.mockImplementation(async (_client, name) => {
    if (name === "notification_delivery_capabilities") return caps;
    if (name === "work_access_context") return whatsappContext();
    return { items: [], nextCursor: null };
  });
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
  getNotificationDigestSettings,
  saveNotificationDigestSettings,
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
it("preserves absent scheduling switches through the real legacy save validator and RPC payload", async () => {
  const parse = state.validators.get(saveNotificationDeliverySettings)!;
  const data = parse({
    workspaceId: W,
    revision: 7,
    policy: { email_enabled: true, email_daily_limit: 10 },
  });
  state.rpc.mockImplementation(async (_client, name) =>
    name === "notification_delivery_capabilities"
      ? caps
      : {
          revision: 8,
          policy: {
            email_enabled: true,
            email_daily_limit: 10,
            digest_enabled: true,
            followups_enabled: true,
            followup_daily_limit: 5,
          },
        },
  );
  expect(await call(saveNotificationDeliverySettings, data)).toMatchObject({
    revision: 8,
    policy: { digest_enabled: true, followups_enabled: true, followup_daily_limit: 5 },
  });
  const payload = state.rpc.mock.calls.at(-1)?.[2];
  expect(payload).toMatchObject({
    p_workspace: W,
    p_revision: 7,
    p_policy: { email_enabled: true, email_daily_limit: 10 },
  });
  for (const key of ["digest_enabled", "followups_enabled", "followup_daily_limit"])
    expect(payload.p_policy).not.toHaveProperty(key);
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
it("accepts canonical cumulative view keys even when the obsolete sales-area whitelist rejects channels", async () => {
  senderRpc();
  state.area.mockRejectedValue(Error("Legacy channel whitelist unavailable"));
  await expect(
    assertNotificationTemplateAccess(ctx.supabase as unknown as SupabaseClient, W),
  ).resolves.toBeUndefined();
  expect(state.rpc.mock.calls.map(([, name]) => name)).toEqual([
    "notification_delivery_capabilities",
    "work_access_context",
  ]);
  expect(state.area).not.toHaveBeenCalled();
  expect(from).not.toHaveBeenCalled();
});

it("delegates the selected-workspace sender catalogue to its authenticated RPC and returns only its validated DTO", async () => {
  senderRpc();
  state.area.mockRejectedValue(Error("Legacy channel whitelist unavailable"));
  await expect(call(listNotificationWhatsAppSenders, { workspaceId: W })).resolves.toEqual({
    items: [senderItem],
  });
  expect(state.rpc.mock.calls).toEqual([
    [ctx.supabase, "notification_delivery_capabilities", { p_workspace: W }],
    [ctx.supabase, "work_access_context", {}],
    [ctx.supabase, "notification_whatsapp_senders", { p_workspace: W }],
  ]);
  expect(state.area).not.toHaveBeenCalled();
  expect(from).not.toHaveBeenCalled();
});

it.each(whatsappViewKeys)(
  "refuses sender and provider-template reads when effective canonical key %s is missing or denied",
  async (key) => {
    for (const effective of [undefined, false]) {
      const access = whatsappContext();
      if (effective === undefined) delete access.keys[key];
      else access.keys[key] = effective;
      for (const fn of [listNotificationWhatsAppSenders, listNotificationWhatsAppTemplates]) {
        senderRpc({ items: [senderItem] }, access);
        state.rpc.mockClear();
        await expect(call(fn, { workspaceId: W, senderPhoneNumberId: "654321" })).rejects.toThrow(
          "Sem permissão",
        );
        expect(state.rpc.mock.calls.map(([, name]) => name)).toEqual([
          "notification_delivery_capabilities",
          "work_access_context",
        ]);
        expect(from).not.toHaveBeenCalled();
      }
    }
  },
);

it.each([
  { label: "foreign workspace", access: { ...whatsappContext(), workspace: U } },
  { label: "missing actor", access: { workspace: W, keys: whatsappContext().keys } },
  { label: "invalid actor", access: { ...whatsappContext(), actor: "" } },
  {
    label: "invalid key value",
    access: {
      ...whatsappContext(),
      keys: { ...whatsappContext().keys, [whatsappViewKeys[0]]: "true" },
    },
  },
  { label: "missing context", access: null },
])("rejects an untrusted canonical $label before sender or provider reads", async ({ access }) => {
  senderRpc({ items: [senderItem] }, access);
  await expect(call(listNotificationWhatsAppSenders, { workspaceId: W })).rejects.toThrow(
    "Sem permissão",
  );
  expect(state.rpc.mock.calls.map(([, name]) => name)).toEqual([
    "notification_delivery_capabilities",
    "work_access_context",
  ]);
  expect(from).not.toHaveBeenCalled();
});

it("does not replace a canonical-context read failure with legacy authorization or a raw query", async () => {
  state.rpc
    .mockResolvedValueOnce(caps)
    .mockRejectedValueOnce(Error("Canonical context unavailable"));
  await expect(
    call(listNotificationWhatsAppTemplates, { workspaceId: W, senderPhoneNumberId: "654321" }),
  ).rejects.toThrow("Canonical context unavailable");
  expect(state.rpc).toHaveBeenCalledTimes(2);
  expect(state.area).not.toHaveBeenCalled();
  expect(from).not.toHaveBeenCalled();
});

it("requires notification-settings view before reading the canonical channel context", async () => {
  state.rpc.mockResolvedValue({ ...caps, settingsView: false });
  await expect(call(listNotificationWhatsAppSenders, { workspaceId: W })).rejects.toThrow(
    "Sem permissão",
  );
  expect(state.rpc).toHaveBeenCalledExactlyOnceWith(
    ctx.supabase,
    "notification_delivery_capabilities",
    { p_workspace: W },
  );
  expect(from).not.toHaveBeenCalled();
});

it.each([listNotificationWhatsAppSenders, listNotificationWhatsAppTemplates])(
  "rejects a missing authenticated actor before any WhatsApp IO: %s",
  async (fn) => {
    await expect(
      call(fn, { workspaceId: W, senderPhoneNumberId: "654321" }, { ...ctx, userId: "" }),
    ).rejects.toThrow();
    expect(state.rpc).not.toHaveBeenCalled();
    expect(from).not.toHaveBeenCalled();
  },
);

it("propagates catalogue RPC denial instead of reading private connections or returning an empty success", async () => {
  senderRpc();
  state.rpc
    .mockResolvedValueOnce(caps)
    .mockResolvedValueOnce(whatsappContext())
    .mockRejectedValueOnce(Error("Sender catalogue denied"));
  await expect(call(listNotificationWhatsAppSenders, { workspaceId: W })).rejects.toThrow(
    "Sender catalogue denied",
  );
  expect(state.rpc).toHaveBeenLastCalledWith(ctx.supabase, "notification_whatsapp_senders", {
    p_workspace: W,
  });
  expect(from).not.toHaveBeenCalled();
});

it("accepts the bounded one-hundred-item public sender DTO without widening its scope", async () => {
  const items = Array.from({ length: 100 }, (_, index) => ({
    ...senderItem,
    id: String(654321 + index),
  }));
  senderRpc({ items });
  await expect(call(listNotificationWhatsAppSenders, { workspaceId: W })).resolves.toEqual({
    items,
  });
  expect(from).not.toHaveBeenCalled();
});

it.each([
  {
    label: "top-level secret",
    result: { items: [senderItem], token: "synthetic-secret-sentinel" },
  },
  {
    label: "sender secret",
    result: { items: [{ ...senderItem, credentials_ciphertext: "synthetic-secret-sentinel" }] },
  },
  { label: "raw connection binding", result: { items: [{ ...senderItem, connection_id: U }] } },
  { label: "invalid sender id", result: { items: [{ ...senderItem, id: "not-a-phone-id" }] } },
  { label: "invalid eligibility", result: { items: [{ ...senderItem, eligible: "true" }] } },
  { label: "unexpected reason", result: { items: [{ ...senderItem, reason: "provider-secret" }] } },
  { label: "missing items", result: {} },
  { label: "null items", result: { items: null } },
  { label: "too many items", result: { items: Array.from({ length: 101 }, () => senderItem) } },
])("fails closed on a malformed sender RPC response: $label", async ({ result }) => {
  senderRpc(result);
  await expect(call(listNotificationWhatsAppSenders, { workspaceId: W })).rejects.toThrow();
  expect(state.rpc).toHaveBeenLastCalledWith(ctx.supabase, "notification_whatsapp_senders", {
    p_workspace: W,
  });
  expect(from).not.toHaveBeenCalled();
});

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

it("loads only the authenticated actor's selected-workspace digest settings without a user selector", async () => {
  const settings = {
    enabled: false,
    frequency: "daily",
    at: "08:30",
    timezone: "America/Sao_Paulo",
    weekday: 1,
    channels: [],
  };
  state.rpc.mockResolvedValue({ settings, revision: 0 });
  expect(await call(getNotificationDigestSettings, { workspaceId: W })).toEqual({
    settings,
    revision: 0,
  });
  expect(state.rpc).toHaveBeenCalledExactlyOnceWith(
    ctx.supabase,
    "get_notification_digest_settings",
    { p_workspace: W },
  );
  expect(from).not.toHaveBeenCalled();
});
it("saves the personal digest revision unchanged and never promotes it to another user's consent", async () => {
  const settings = {
    enabled: true,
    frequency: "weekly",
    at: "08:30",
    timezone: "America/Sao_Paulo",
    weekday: 1,
    channels: ["email"],
  };
  state.rpc.mockResolvedValue({ settings, revision: 4 });
  expect(
    await call(saveNotificationDigestSettings, {
      workspaceId: W,
      settings,
      revision: 3,
      userId: W,
    }),
  ).toEqual({ settings, revision: 4 });
  expect(state.rpc).toHaveBeenCalledExactlyOnceWith(
    ctx.supabase,
    "save_notification_digest_settings",
    { p_workspace: W, p_settings: settings, p_revision: 3 },
  );
  expect(from).not.toHaveBeenCalled();
});
it("preserves a digest CAS failure without fabricating saved settings", async () => {
  state.rpc.mockRejectedValue(Error("Revision conflict"));
  await expect(
    call(saveNotificationDigestSettings, {
      workspaceId: W,
      settings: { enabled: false },
      revision: 3,
    }),
  ).rejects.toThrow("Revision conflict");
  expect(from).not.toHaveBeenCalled();
});
