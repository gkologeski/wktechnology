import { afterEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ spawn: vi.fn() }));
vi.mock("node:child_process", () => ({ spawnSync: mocks.spawn }));
import {
  assertDisposableInboxTarget,
  loadDisposableInboxFixtures,
} from "../../../tests/fixtures/inbox/load";

const local = {
  LOVABLE_BROWSER_AUTH_STATUS: "draft_signed_out",
  PGHOST: "127.0.0.1",
  PGPORT: "8004",
  PGDATABASE: "postgres",
  SUPABASE_URL: "http://127.0.0.1:8001",
};
const originalArgs = process.argv;
afterEach(() => {
  process.argv = originalArgs;
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  mocks.spawn.mockReset();
});
it("requires explicit disposable test opt-in", () => {
  expect(() => assertDisposableInboxTarget(local, [])).toThrow("no writes attempted");
  expect(() => assertDisposableInboxTarget(local, ["--disposable-draft"])).not.toThrow();
});
it.each([
  { status: 1, stdout: "t" },
  { status: 0, stdout: "f" },
  { status: 0, stdout: "" },
])("never loads fixture rows when database preflight fails: %j", (result) => {
  for (const [key, value] of Object.entries(local)) vi.stubEnv(key, value);
  process.argv = ["bun", "test", "--disposable-draft"];
  mocks.spawn.mockReturnValue(result);
  expect(() => loadDisposableInboxFixtures()).toThrow("target identity unavailable");
  expect(mocks.spawn).toHaveBeenCalledTimes(1);
  expect(mocks.spawn.mock.calls[0]?.[1]).not.toContain("--single-transaction");
});
it.each([
  ["LOVABLE_BROWSER_AUTH_STATUS", "injected"],
  ["PGHOST", "db.production.example"],
  ["PGPORT", "5432"],
  ["PGDATABASE", "production"],
  ["SUPABASE_URL", "https://app.wktechnology.com.br"],
  ["SUPABASE_URL", "http://127.0.0.1:8001/foreign"],
  ["PGHOST", ""],
])("fails closed before setup on changed %s", (key, value) => {
  expect(() =>
    assertDisposableInboxTarget({ ...local, [key]: value }, ["--disposable-draft"]),
  ).toThrow();
});
