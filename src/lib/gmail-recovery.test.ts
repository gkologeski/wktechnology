import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { recoverGmailAcceptances } from "./gmail-recovery.server";

describe("Gmail accepted-only recovery orchestration", () => {
  const client = (rpc: ReturnType<typeof vi.fn>) => ({ rpc }) as unknown as SupabaseClient;
  it("rechecks the account job and claims at most 25 without exposing payload or sending", async () => {
    const rpc = vi.fn(async (name: string) => ({
      data: name === "inbox_gmail_recovery_claim" ? [{ receipt_id: "accepted" }] : true,
      error: null,
    }));
    expect(await recoverGmailAcceptances(client(rpc), "workspace", "account")).toEqual({
      claimed: 1,
      completed: 1,
      failed: 0,
    });
    expect(rpc.mock.calls.map(([name]) => name)).toEqual([
      "sales_account_job_authorize",
      "inbox_gmail_recovery_claim",
      "inbox_gmail_recovery_project",
    ]);
    expect(rpc).toHaveBeenNthCalledWith(2, "inbox_gmail_recovery_claim", {
      p_workspace: "workspace",
      p_account: "account",
      p_token: expect.any(String),
      p_limit: 25,
    });
    const claim = rpc.mock.calls[1];
    expect(claim).toBeDefined();
    expect(rpc).toHaveBeenNthCalledWith(3, "inbox_gmail_recovery_project", {
      p_workspace: "workspace",
      p_account: "account",
      p_token: expect.any(String),
      p_receipt: "accepted",
    });
  });
  it("a revoked job never claims or projects", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: false, error: null });
    await expect(recoverGmailAcceptances(client(rpc), "workspace", "revoked")).rejects.toThrow(
      "Sincronização suspensa",
    );
    expect(rpc).toHaveBeenCalledTimes(1);
  });
  it("projection failure and lost RPC response do not starve the next claim or invoke send", async () => {
    const rpc = vi.fn(async (name: string, args: Record<string, unknown>) => {
      if (name === "sales_account_job_authorize") return { data: true, error: null };
      if (name === "inbox_gmail_recovery_claim")
        return {
          data: [{ receipt_id: "failed" }, { receipt_id: "lost" }, { receipt_id: "good" }],
          error: null,
        };
      if (args["p_receipt"] === "lost") throw new Error("connection lost");
      return { data: args["p_receipt"] === "good", error: null };
    });
    expect(await recoverGmailAcceptances(client(rpc), "workspace", "account")).toEqual({
      claimed: 3,
      completed: 1,
      failed: 2,
    });
    expect(rpc.mock.calls.filter(([name]) => name === "inbox_gmail_recovery_project")).toHaveLength(
      3,
    );
  });
});
