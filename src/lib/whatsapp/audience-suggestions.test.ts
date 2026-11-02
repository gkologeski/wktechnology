import { expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { FILTER_FIELDS } from "./campaign-audience";
const fields = vi.hoisted(() => ({ load: vi.fn() }));
vi.mock("./campaign-audience.server", () => ({ loadServerFilterFields: fields.load }));
import { audienceFieldSuggestions } from "./audience-suggestions.server";
const W = "aaaaaaaa-0000-4000-8000-00000000000a",
  U = "10000000-0000-4000-8000-000000000002";
function fixture(failure?: string, foreign = false) {
  fields.load.mockReset();
  fields.load.mockResolvedValue(FILTER_FIELDS);
  const rpc = vi.fn(
    async (
      name: string,
      args?: Record<string, unknown>,
    ): Promise<{ data: unknown; error: null | { message: string } }> => ({
      data:
        name === "sales_access_context"
          ? { workspace: W, actor: foreign ? W : U }
          : name === "whatsapp_campaign_filter_values"
            ? ["CTO", "CTO", "Head de TI"]
            : true,
      error:
        name === "sales_area_authorize" && (failure || args?.r === "techsales.marketing.campaigns")
          ? { message: failure || "marketing_not_granted" }
          : null,
    }),
  );
  return { rpc, client: { rpc } as unknown as SupabaseClient };
}
const input = { entity: "contacts" as const, column: "job_title", search: "CTO" };
it("audience suggestions allow sequence-only readers without granting campaign access", async () => {
  const h = fixture();
  expect(await audienceFieldSuggestions(h.client, U, input)).toEqual(["CTO", "Head de TI"]);
  expect(h.rpc).toHaveBeenCalledWith("sales_area_authorize", {
    r: "system.automation.sequences",
    a: "view",
    t: null,
    i: null,
  });
  expect(h.rpc).toHaveBeenCalledWith(
    "whatsapp_campaign_filter_values",
    expect.objectContaining({
      p_workspace: W,
      p_entity: "contacts",
      p_column: "job_title",
      p_limit: 200,
    }),
  );
});
it("audience suggestions reject missing feature permissions before metadata or values", async () => {
  const h = fixture("missing_permission");
  await expect(audienceFieldSuggestions(h.client, U, input)).rejects.toThrow();
  expect(fields.load).not.toHaveBeenCalled();
});
it("audience suggestions preserve explicit deny before metadata or values", async () => {
  const h = fixture("explicit_deny");
  await expect(audienceFieldSuggestions(h.client, U, input)).rejects.toThrow();
  expect(fields.load).not.toHaveBeenCalled();
});
it("audience suggestions reject inactive membership before metadata or values", async () => {
  const h = fixture("inactive_member");
  await expect(audienceFieldSuggestions(h.client, U, input)).rejects.toThrow();
  expect(fields.load).not.toHaveBeenCalled();
});
it("audience suggestions reject a foreign actor context before values", async () => {
  const h = fixture(undefined, true);
  await expect(audienceFieldSuggestions(h.client, U, input)).rejects.toThrow();
  expect(fields.load).not.toHaveBeenCalled();
});
it("audience suggestions reject internal fields instead of querying arbitrary columns", async () => {
  const h = fixture();
  await expect(
    audienceFieldSuggestions(h.client, U, { ...input, column: "portal_token" }),
  ).rejects.toThrow("Campo não permitido");
  expect(h.rpc.mock.calls.some(([n]) => n === "whatsapp_campaign_filter_values")).toBe(false);
});
