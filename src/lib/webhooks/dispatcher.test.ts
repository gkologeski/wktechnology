import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { from } = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { from } }));
import { enqueueWebhookEvent, runWebhookDispatch } from "./dispatcher.server";

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

afterEach(() => vi.unstubAllGlobals());

describe("webhooks isolados por empresa", () => {
  it("recusa evento sem origem antes de consultar destinos", async () => {
    await expect(enqueueWebhookEvent("", "owner", "ats.job.posted", {})).rejects.toThrow(
      "workspace",
    );
    expect(from).not.toHaveBeenCalled();
  });
  it("limita destinos à empresa do evento mesmo quando o responsável participa de outras", async () => {
    const filters: unknown[][] = [];
    const insert = vi.fn(async () => ({ error: null }));
    const query = {
      select: () => query,
      eq: (...args: unknown[]) => {
        filters.push(args);
        return query;
      },
      contains: async () => ({ data: [{ id: "hook-B", workspace_id: "B" }] }),
    };
    from.mockImplementation((table: string) =>
      table === "outbound_webhooks" ? query : { insert },
    );
    await enqueueWebhookEvent("B", "shared-owner", "ats.job.posted", { entity_id: "job-B" });
    expect(filters).toContainEqual(["workspace_id", "B"]);
    expect(insert).toHaveBeenCalledWith([
      expect.objectContaining({ webhook_id: "hook-B", workspace_id: "B" }),
    ]);
  });
  it("não envia uma entrega cujo webhook pertence a outra empresa", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const filters: unknown[][] = [];
    const update = vi.fn(() => ({ eq: async () => ({ error: null }) }));
    const pendingQuery = {
      select: () => pendingQuery,
      in: () => pendingQuery,
      lte: () => pendingQuery,
      order: () => pendingQuery,
      limit: async () => ({
        data: [{ id: "delivery-B", workspace_id: "B", webhook_id: "hook-A" }],
      }),
      update,
    };
    const hookQuery = {
      select: () => hookQuery,
      eq: (...args: unknown[]) => {
        filters.push(args);
        return hookQuery;
      },
      maybeSingle: async () => ({ data: null }),
    };
    from.mockImplementation((table: string) =>
      table === "webhook_deliveries" ? pendingQuery : hookQuery,
    );
    await runWebhookDispatch();
    expect(filters).toContainEqual(["workspace_id", "B"]);
    expect(fetch).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith({ status: "dead" });
  });
});
