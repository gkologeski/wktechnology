import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { pendingEventsVisibleToCaller } from "./caller-tick.server";

function fakeClient(rows: { id: string }[], log: string[], name: string) {
  const q: Record<string, unknown> = {};
  let ids: string[] | null = null;
  for (const m of ["select", "eq", "is", "lte", "order", "limit"]) q[m] = () => q;
  q.in = (_c: string, v: string[]) => {
    ids = v;
    return q;
  };
  q.then = (r: (v: unknown) => void) => {
    log.push(name);
    r({ data: ids ? rows.filter((x) => ids!.includes(x.id)) : rows, error: null });
  };
  return { from: () => q } as unknown as SupabaseClient;
}

describe("pendingEventsVisibleToCaller", () => {
  it("só processa pendentes que o usuário pode ver", async () => {
    const log: string[] = [];
    const service = fakeClient([{ id: "a" }, { id: "b" }, { id: "c" }], log, "service");
    const caller = fakeClient([{ id: "a" }, { id: "c" }], log, "caller");
    const out = await pendingEventsVisibleToCaller(caller, service, {
      workspaceId: "w",
      limit: 50,
    });
    expect(out).toEqual(["a", "c"]);
    expect(log).toEqual(["service", "caller"]);
  });
  it("sem pendentes não consulta com o usuário", async () => {
    const log: string[] = [];
    const out = await pendingEventsVisibleToCaller(
      fakeClient([{ id: "x" }], log, "caller"),
      fakeClient([], log, "service"),
      { workspaceId: "w", limit: 50 },
    );
    expect(out).toEqual([]);
    expect(log).toEqual(["service"]);
  });
});
