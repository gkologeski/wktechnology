import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { assertSalesAccountJob } from "./access-control/sales-account-job.server";
import {
  collectGmailHistory,
  discoverGmailBatch,
  drainGmailQueue,
  type GmailQueueItem,
} from "./gmail-sync-queue";

function accountClient(allowed: boolean) {
  const rpc = vi.fn().mockResolvedValue({ data: allowed, error: null });
  return { client: { rpc } as unknown as SupabaseClient, rpc };
}
it("Gmail queue permits the authorized active account job", async () => {
  const c = accountClient(true);
  await expect(
    assertSalesAccountJob(c.client, "email_accounts", "account-a"),
  ).resolves.toBeUndefined();
  expect(c.rpc).toHaveBeenCalledWith("sales_account_job_authorize", {
    p_table: "email_accounts",
    p_id: "account-a",
  });
});
it("Gmail queue refuses the account job without permission", async () => {
  await expect(
    assertSalesAccountJob(accountClient(false).client, "email_accounts", "missing"),
  ).rejects.toThrow("Sincronização suspensa");
});
it("Gmail queue refuses the account job after effective deny", async () => {
  await expect(
    assertSalesAccountJob(accountClient(false).client, "email_accounts", "denied"),
  ).rejects.toThrow("Sincronização suspensa");
});
it("Gmail queue refuses the account job in a foreign workspace", async () => {
  await expect(
    assertSalesAccountJob(accountClient(false).client, "email_accounts", "foreign"),
  ).rejects.toThrow("Sincronização suspensa");
});
it("Gmail queue refuses the inactive account owner", async () => {
  await expect(
    assertSalesAccountJob(accountClient(false).client, "email_accounts", "inactive"),
  ).rejects.toThrow("Sincronização suspensa");
});

describe("durable Gmail checkpoint orchestration", () => {
  it("collects all 61 IDs over 12 pages without the former 25-message or 10-page truncation", async () => {
    const calls: Array<string | undefined> = [];
    const collected = await collectGmailHistory(async (token) => {
      calls.push(token);
      const index = Number(token ?? "0");
      return {
        historyId: "200",
        history: [
          {
            messagesAdded: Array.from({ length: index === 11 ? 6 : 5 }, (_, j) => ({
              message: { id: `m${index * 5 + j}` },
            })),
          },
        ],
        ...(index < 11 ? { nextPageToken: String(index + 1) } : {}),
      };
    });
    expect(collected.ids).toHaveLength(61);
    expect(collected.ids).toContain("m60");
    expect(collected.nextHistory).toBe("200");
    expect(calls).toHaveLength(12);
  });
  it("fails an incomplete pagination rather than returning a cursor that loses unseen IDs", async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce({ historyId: "200", nextPageToken: "second" })
      .mockRejectedValueOnce(new Error("page unavailable"));
    await expect(collectGmailHistory(request)).rejects.toThrow("page unavailable");
  });
  it("rejects a repeated page token without advancing a checkpoint", async () => {
    await expect(
      collectGmailHistory(async () => ({ nextPageToken: "loop", historyId: "200" })),
    ).rejects.toThrow("Paginação Gmail repetida");
  });
  it("captures the seed cutoff before retrieval and never labels seed as incremental", async () => {
    const calls: string[] = [];
    const result = await discoverGmailBatch(null, {
      profile: async () => {
        calls.push("cutoff");
        return "100";
      },
      recent: async () => {
        calls.push("seed");
        return ["old"];
      },
      history: async () => {
        throw new Error("not expected");
      },
    });
    expect(calls).toEqual(["cutoff", "seed"]);
    expect(result).toEqual({ ids: ["old"], nextHistory: "100", provenance: "seed" });
  });
  it("retains expired-history provenance for recovery and uses the earlier cutoff", async () => {
    const result = await discoverGmailBatch("99", {
      history: async () => {
        throw Object.assign(new Error("expired"), { status: 404 });
      },
      profile: async () => "100",
      recent: async () => ["old"],
    });
    expect(result).toEqual({ ids: ["old"], nextHistory: "100", provenance: "expired_history" });
  });
  it("does not replace a temporary history failure with a fresh seed", async () => {
    const recent = vi.fn();
    await expect(
      discoverGmailBatch("99", {
        history: async () => {
          throw Object.assign(new Error("busy"), { status: 503 });
        },
        profile: async () => "100",
        recent,
      }),
    ).rejects.toThrow("busy");
    expect(recent).not.toHaveBeenCalled();
  });
  it("leaves a failure in the middle pending while acknowledging the others, and retries without changing seed provenance", async () => {
    const rows: GmailQueueItem[] = ["a", "b", "c"].map((id) => ({
      id,
      provider_message_id: id,
      provenance: "seed",
      preexisting: false,
    }));
    const finish = vi.fn().mockResolvedValue(true);
    const retry = vi.fn().mockResolvedValue(true);
    const result = await drainGmailQueue(rows, {
      persist: async (row) => {
        if (row.id === "b") throw new Error("write failed");
        return "inserted";
      },
      finish,
      retry,
    });
    expect(result).toEqual({ fetched: 3, inserted: 2, skipped: 0, failed: 1 });
    expect(finish.mock.calls.map(([row]) => row.id)).toEqual(["a", "c"]);
    expect(retry).toHaveBeenCalledWith(rows[1]);
    const failedRow = rows[1];
    if (!failedRow) throw new Error("fixture missing");
    await drainGmailQueue([failedRow], { persist: async () => "existing", finish, retry });
    expect(finish).toHaveBeenLastCalledWith(
      expect.objectContaining({ provenance: "seed" }),
      "existing",
    );
  });
  it("retries a message whose persistence succeeded but whose acknowledgement failed", async () => {
    const row: GmailQueueItem = {
      id: "a",
      provider_message_id: "a",
      provenance: "incremental",
      preexisting: false,
    };
    const retry = vi.fn().mockResolvedValue(true);
    const result = await drainGmailQueue([row], {
      persist: async () => "inserted",
      finish: async () => false,
      retry,
    });
    expect(result.failed).toBe(1);
    expect(retry).toHaveBeenCalledWith(row);
    const finished = vi.fn().mockResolvedValue(true);
    const resumed = await drainGmailQueue([row], {
      persist: async () => "existing",
      finish: finished,
      retry,
    });
    expect(resumed).toEqual({ fetched: 1, inserted: 0, skipped: 1, failed: 0 });
    expect(finished).toHaveBeenCalledWith(
      expect.objectContaining({ provenance: "incremental", preexisting: false }),
      "existing",
    );
  });
});
