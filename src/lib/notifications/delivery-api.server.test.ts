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
it("provider templates require channel access before querying sender or secrets", async () => {
  state.area.mockRejectedValue(Error("channel denied"));
  await expect(
    call(listNotificationWhatsAppTemplates, { workspaceId: W, senderPhoneNumberId: "123456" }),
  ).rejects.toThrow("channel denied");
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
