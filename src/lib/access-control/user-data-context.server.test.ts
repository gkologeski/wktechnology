import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { protectAdminBusinessData, withUserDataClient } from "./user-data-context.server";
const fake = (name: string) =>
  ({ from: (table: string) => `${name}:${table}`, rpc: () => name }) as unknown as SupabaseClient;
describe("verified request data context", () => {
  it("keeps technical service work separate and narrows business tables within a verified request", () => {
    const service = protectAdminBusinessData(fake("service"));
    expect(service.from("contacts")).toBe("service:contacts");
    withUserDataClient(fake("actor"), () => {
      expect(service.from("contacts")).toBe("actor:contacts");
      expect(service.from("ats_candidates")).toBe("actor:ats_candidates");
      expect(service.from("workspace_members")).toBe("service:workspace_members");
      expect(service.rpc("technical_port")).toBe("service");
    });
    expect(service.from("contacts")).toBe("service:contacts");
  });
  it("does not leak the actor between concurrent requests or asynchronous continuations", async () => {
    const service = protectAdminBusinessData(fake("service"));
    const result = await Promise.all(
      ["one", "two"].map((name) =>
        withUserDataClient(fake(name), async () => {
          await Promise.resolve();
          return service.from("deals");
        }),
      ),
    );
    expect(result).toEqual(["one:deals", "two:deals"]);
    expect(service.from("deals")).toBe("service:deals");
  });
});
