import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, expect, it, vi } from "vitest";
const guard = vi.hoisted(() => vi.fn());
vi.mock("@/lib/access-control/hr-records.server", () => ({ assertHrRecordAccess: guard }));
import { loadOutreachCandidate } from "./candidate-outreach.server";
function database(
  data: unknown = { full_name: "QA", email: null, headline: null, current_company: null },
) {
  const q: any = {
    select: vi.fn(() => q),
    eq: vi.fn(() => q),
    maybeSingle: vi.fn(async () => ({ data, error: null })),
  };
  const from = vi.fn(() => q);
  return { client: { from } as unknown as SupabaseClient, from, q };
}
beforeEach(() => vi.resetAllMocks());
it("reads authorized candidate tokens using the caller client and workspace", async () => {
  const db = database();
  expect((await loadOutreachCandidate(db.client, "workspace", "candidate"))?.full_name).toBe("QA");
  expect(guard).toHaveBeenCalledWith(db.client, "candidates", "view", "candidate");
  expect(db.q.eq).toHaveBeenCalledWith("workspace_id", "workspace");
});
for (const scenario of ["missing permission", "explicit deny", "inactive membership"]) {
  it(`rejects candidate tokens before reading when ${scenario}`, async () => {
    const db = database();
    guard.mockRejectedValue(new Error(scenario));
    await expect(loadOutreachCandidate(db.client, "workspace", "candidate")).rejects.toThrow(
      scenario,
    );
    expect(db.from).not.toHaveBeenCalled();
  });
}
it("rejects a candidate outside the active workspace", async () => {
  const db = database(null);
  await expect(loadOutreachCandidate(db.client, "workspace", "foreign")).rejects.toThrow(
    "workspace ativo",
  );
  expect(db.q.eq).toHaveBeenCalledWith("workspace_id", "workspace");
});
