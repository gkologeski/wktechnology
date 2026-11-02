import { beforeEach, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
const mocks = vi.hoisted(() => ({ workspace: vi.fn(), load: vi.fn() }));
vi.mock("@/lib/active-workspace.server", () => ({ resolveActiveWorkspace: mocks.workspace }));
vi.mock("@/lib/whatsapp/campaign-audience.server", () => ({ loadAudienceRows: mocks.load }));
import { previewDraftAudience } from "./drafts.server";
import { newDefinition } from "./draft";
const client = (error?: string) =>
  ({
    rpc: vi.fn().mockResolvedValue({ data: true, error: error ? { message: error } : null }),
  }) as unknown as SupabaseClient;
beforeEach(() => {
  vi.clearAllMocks();
  mocks.workspace.mockResolvedValue("workspace-a");
});
it("audience preview rejects mismatched workspace before reading CRM", async () => {
  await expect(
    previewDraftAudience(client(), "actor", "workspace-b", newDefinition().audience),
  ).rejects.toThrow("Workspace indisponível");
  expect(mocks.load).not.toHaveBeenCalled();
});
it("audience preview does not query CRM without sequence view", async () => {
  await expect(
    previewDraftAudience(client("denied"), "actor", "workspace-a", newDefinition().audience),
  ).rejects.toThrow("denied");
  expect(mocks.load).not.toHaveBeenCalled();
});
it("audience preview uses caller client and only returns finite display samples", async () => {
  const c = client(),
    audience = newDefinition().audience;
  mocks.load.mockResolvedValue({
    rows: Array.from({ length: 10 }, (_, i) => ({
      sourceType: "contact",
      sourceId: String(i),
      label: `Pessoa ${i}`,
      phone: "",
      values: { "contact.email": "pessoa@example.invalid" },
    })),
    truncated: true,
  });
  const result = await previewDraftAudience(c, "actor", "workspace-a", audience);
  expect(mocks.load).toHaveBeenCalledWith(
    c,
    "workspace-a",
    { type: "filter", base: "contacts", groups: [], groups_logic: "or" },
    "actor",
  );
  expect(result).toMatchObject({ found: 10, email: 10, phone: 0, whatsapp: 0, truncated: true });
  expect(result.samples).toHaveLength(8);
  expect(Object.keys(result.samples[0]).sort()).toEqual(["id", "name"]);
});
