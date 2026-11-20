import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { tickNotificationDeliveries } from "./delivery-worker.server";
import {
  notificationDeliveryConfigSchema,
  notificationDeliveryPolicySchema,
} from "./delivery-types";
import { inspectNotificationActions } from "./delivery-rule-preview";
import { deliveryPhoneSchema, deliveryHistoryInput, deliveryHistoryResult } from "./delivery-api";
const U = "11111111-1111-4111-8111-111111111111",
  I = "22222222-2222-4222-8222-222222222222";
const job = {
  id: I,
  token: U,
  channel: "email" as const,
  idempotencyKey: "unique-attempt",
  workspaceId: U,
  workflowId: U,
  runId: I,
  recipientId: U,
  email: "test@example.com",
  phone: null,
  senderPhoneNumberId: null,
  templateName: null,
  templateLanguage: null,
};
function fixture(
  options: {
    claim?: Record<string, unknown>;
    preflight?: (n: number) => Record<string, unknown>;
    finish?: boolean;
    ids?: string[];
  } = {},
) {
  let n = 0;
  const rpc = vi.fn(async (name: string) => {
    if (name === "notification_worker_list")
      return { data: (options.ids ?? [I]).map((id) => ({ id })), error: null };
    if (name === "notification_delivery_claim")
      return { data: { result: "claimed", ...job, ...options.claim }, error: null };
    if (name === "notification_delivery_preflight")
      return { data: options.preflight?.(++n) ?? { allowed: true, ...job }, error: null };
    if (name === "notification_delivery_finish")
      return { data: { updated: options.finish ?? true }, error: null };
    throw Error("unexpected rpc");
  });
  return { rpc, client: { rpc } as unknown as SupabaseClient };
}
describe("notification delivery worker", () => {
  it("claims, checks and persists provider acceptance using the same fenced token", async () => {
    const f = fixture(),
      send = vi.fn(async (_job, guard) => {
        await guard();
        return { status: "accepted" as const, provider: "managed_email" as const };
      });
    const result = await tickNotificationDeliveries(f.client, 20, { send });
    expect(result.accepted).toBe(1);
    expect(f.rpc.mock.calls.filter((c) => c[0] === "notification_delivery_preflight")).toHaveLength(
      2,
    );
    expect(f.rpc).toHaveBeenLastCalledWith(
      "notification_delivery_finish",
      expect.objectContaining({ p_id: I, p_token: U, p_status: "accepted", p_provider_id: null }),
    );
  });
  it("does not call a transport or finish a suppression already persisted by preflight", async () => {
    const f = fixture({ preflight: () => ({ allowed: false, result: "suppressed" }) }),
      send = vi.fn();
    expect((await tickNotificationDeliveries(f.client, 20, { send })).suppressed).toBe(1);
    expect(send).not.toHaveBeenCalled();
    expect(f.rpc.mock.calls.map((c) => c[0])).not.toContain("notification_delivery_finish");
  });
  it("handles access revoked during provider catalogue lookup without finish or fallback", async () => {
    const f = fixture({
      preflight: (n) =>
        n === 1 ? { allowed: true, ...job } : { allowed: false, result: "suppressed" },
    });
    const post = vi.fn();
    const send = vi.fn(async (_job, guard) => {
      try {
        await guard();
        post();
      } catch {
        // The adapter reports an opaque result after the SQL guard cancels.
      }
      return { status: "uncertain" as const, provider: "managed_email" as const };
    });
    expect((await tickNotificationDeliveries(f.client, 20, { send })).suppressed).toBe(1);
    expect(post).not.toHaveBeenCalled();
    expect(f.rpc.mock.calls.map((c) => c[0])).not.toContain("notification_delivery_finish");
  });
  it.each(["workspaceId", "workflowId", "runId", "recipientId", "token", "email"] as const)(
    "rejects a changed pinned %s before transport",
    async (key) => {
      const f = fixture({
          preflight: () => ({
            allowed: true,
            ...job,
            [key]: key === "email" ? "other@example.com" : "33333333-3333-4333-8333-333333333333",
          }),
        }),
        send = vi.fn();
      await expect(tickNotificationDeliveries(f.client, 20, { send })).rejects.toThrow(
        "validar ou persistir",
      );
      expect(send).not.toHaveBeenCalled();
    },
  );
  it.each(["deferred", "uncertain", "already_done", "suppressed"])(
    "never transports claim result %s",
    async (result) => {
      const f = fixture({ claim: { result } }),
        send = vi.fn();
      await tickNotificationDeliveries(f.client, 20, { send });
      expect(send).not.toHaveBeenCalled();
    },
  );
  it("records unknown exceptions as uncertain instead of retrying", async () => {
    const f = fixture();
    await tickNotificationDeliveries(f.client, 20, {
      send: async () => {
        throw Error("PRIVATE provider timeout");
      },
    });
    expect(f.rpc).toHaveBeenLastCalledWith(
      "notification_delivery_finish",
      expect.objectContaining({ p_status: "uncertain", p_reason: "transport_unknown" }),
    );
    expect(JSON.stringify(f.rpc.mock.calls)).not.toContain("PRIVATE");
  });
  it("requires a WhatsApp provider receipt for acceptance", async () => {
    const current = { ...job, channel: "whatsapp" };
    const f = fixture({ claim: current, preflight: () => ({ allowed: true, ...current }) });
    expect(
      (
        await tickNotificationDeliveries(f.client, 20, {
          send: async () => ({ status: "accepted", provider: "meta_cloud" }),
        })
      ).uncertain,
    ).toBe(1);
  });
  it("reports lost fencing before claiming completion", async () => {
    const f = fixture({ finish: false });
    await expect(
      tickNotificationDeliveries(f.client, 20, {
        send: async () => ({ status: "accepted", provider: "managed_email" }),
      }),
    ).rejects.toThrow("persistir");
  });
  it.each([0, 51, 1.5])("bounds the scan before IO: %s", async (limit) => {
    const f = fixture();
    await expect(tickNotificationDeliveries(f.client, limit)).rejects.toThrow();
    expect(f.rpc).not.toHaveBeenCalled();
  });
});
describe("delivery schema and structural preview", () => {
  it.each([
    { channels: [] },
    { channels: ["email", "email"] },
    { channels: ["email"], fallback: "email" },
    { channels: ["whatsapp", "email"], fallback: "email" },
    { channels: ["slack"] },
  ])("rejects invalid delivery selection %j", (config) => {
    expect(notificationDeliveryConfigSchema.safeParse(config).success).toBe(false);
  });
  it("keeps opt-in channels disabled until the policy is configured", () => {
    const p = notificationDeliveryPolicySchema.parse({});
    expect(p.email_enabled).toBe(false);
    expect(p.whatsapp_enabled).toBe(false);
    expect(
      notificationDeliveryPolicySchema.safeParse({ ...p, whatsapp_enabled: true }).success,
    ).toBe(false);
  });
  it("inspects nested notification branches without executing or inventing recipients", () => {
    const result = inspectNotificationActions(
      [
        {
          type: "branch_if",
          filters: [],
          then: [
            {
              type: "send_notification",
              title: "PRIVATE",
              delivery: { channels: ["whatsapp"], fallback: "email" },
            },
          ],
          else: [],
        },
      ] as never,
      notificationDeliveryPolicySchema.parse({}),
    );
    expect(result.notificationSteps).toBe(1);
    expect(result.channels).toEqual(["whatsapp", "email"]);
    expect(result.realMessages).toBe(0);
    expect(JSON.stringify(result)).not.toContain("PRIVATE");
  });
  it("does not infer a country and rejects extensions for personal phone registration", () => {
    expect(deliveryPhoneSchema.safeParse("48999999999").success).toBe(false);
    expect(deliveryPhoneSchema.safeParse("+55 48 99999-9999 ramal 2").success).toBe(false);
    expect(deliveryPhoneSchema.parse("+55 48 99999-9999")).toBe("+5548999999999");
  });
  it("limits and strips personal destinations from delivery history", () => {
    expect(
      deliveryHistoryInput.safeParse({ workspaceId: U, cursor: { id: "bad", createdAt: "now" } })
        .success,
    ).toBe(false);
    const result = deliveryHistoryResult.parse({
      items: [
        {
          id: I,
          channel: "email",
          status: "accepted",
          reason_code: null,
          attempts: 1,
          created_at: "now",
          updated_at: "now",
          email: "PRIVATE",
          phone: "PRIVATE",
        },
      ],
      nextCursor: null,
    });
    expect(JSON.stringify(result)).not.toContain("PRIVATE");
  });
});

it("accepts a complete SQL delivery page and refuses an unbounded response", () => {
  const item = {
    id: I,
    channel: "email",
    status: "accepted",
    reason_code: null,
    attempts: 1,
    created_at: "now",
    updated_at: "now",
  };
  expect(
    deliveryHistoryResult.parse({ items: Array(50).fill(item), nextCursor: null }).items,
  ).toHaveLength(50);
  expect(
    deliveryHistoryResult.safeParse({ items: Array(51).fill(item), nextCursor: null }).success,
  ).toBe(false);
});
