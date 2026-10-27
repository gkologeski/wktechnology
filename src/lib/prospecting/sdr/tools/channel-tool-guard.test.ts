import { describe, expect, it, vi } from "vitest";
const execute = vi.hoisted(() => vi.fn());
vi.mock("./dispatcher", () => ({ executeTool: execute }));
import { makeExecutor } from "./runtime";
import type { ToolCtx } from "./dispatcher";
describe("channel revocation before tool effects", () => {
  it("does not invoke a tool after the account binding is revoked", async () => {
    const executor = makeExecutor({} as ToolCtx, async () => {
      throw new Error("channel_disabled");
    });
    await expect(executor("calendar_book", {}, "call-1")).rejects.toThrow("channel_disabled");
    expect(execute).not.toHaveBeenCalled();
  });
});
