import { expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { readSearchCollection } from "./search-collection.server";
function client(
  options: {
    context?: unknown;
    contextError?: string;
    listError?: string;
    records?: unknown[];
    rows?: unknown[];
  } = {},
) {
  const calls: Array<{ table: string; op: string; args: unknown[] }> = [];
  const query = (table: string, result: unknown) => {
    const q: Record<string, unknown> = {};
    for (const op of ["select", "eq", "order", "limit", "in", "abortSignal"])
      q[op] = (...args: unknown[]) => {
        calls.push({ table, op, args });
        return q;
      };
    q.then = (resolve: (x: unknown) => unknown, reject: (e: unknown) => unknown) =>
      Promise.resolve(result).then(resolve, reject);
    return q;
  };
  const rpc = vi.fn(() =>
    query("context", {
      data: options.context === undefined ? { workspace: "w", actor: "u" } : options.context,
      error: options.contextError ? { message: options.contextError } : null,
    }),
  );
  const from = vi.fn((table: string) =>
    query(
      table,
      table.startsWith("search_")
        ? {
            data: options.rows ?? [
              {
                entity_type: "contact",
                entity_id: "a",
                title: "segredo@example.com",
                url: "https://malicioso.example",
                opened_at: "2026-11-15",
              },
            ],
            error: options.listError ? { message: options.listError } : null,
          }
        : {
            data: options.records ?? [{ id: "a", first_name: "Ana", last_name: "Silva" }],
            error: null,
          },
    ),
  );
  return { c: { rpc, from } as unknown as SupabaseClient, calls, from };
}
it("rereads authorized labels and canonical links without trusting stored private text", async () => {
  const { c, calls } = client();
  const signal = new AbortController().signal;
  const r = await readSearchCollection(c, "u", "search_recent", signal);
  expect(r.items).toEqual([
    {
      entity_type: "contact",
      entity_id: "a",
      title: "Ana Silva",
      url: "/contacts/a",
      opened_at: "2026-11-15",
    },
  ]);
  expect(
    calls.some(
      (x) =>
        x.table === "contacts" &&
        x.op === "eq" &&
        x.args[0] === "workspace_id" &&
        x.args[1] === "w",
    ),
  ).toBe(true);
  expect(calls.filter((x) => x.op === "abortSignal").every((x) => x.args[0] === signal)).toBe(true);
});
it("drops revoked or foreign workspace records instead of returning their stored labels", async () => {
  const { c } = client({ records: [] });
  expect(
    (await readSearchCollection(c, "u", "search_pinned", new AbortController().signal)).items,
  ).toEqual([]);
});
it("does not resurrect a hidden email as a fallback title", async () => {
  const { c } = client({ records: [{ id: "a", first_name: null, last_name: null }] });
  expect(
    (await readSearchCollection(c, "u", "search_recent", new AbortController().signal)).items[0]
      .title,
  ).toBe("Contato");
});
it.each([
  ["missing workspace", { actor: "u" }],
  ["inactive membership", {}],
  ["foreign actor", { actor: "other", workspace: "w" }],
])("rejects %s before reading history", async (_name, context) => {
  const { c, from } = client({ context });
  await expect(
    readSearchCollection(c, "u", "search_recent", new AbortController().signal),
  ).rejects.toThrow("Sem acesso");
  expect(from).not.toHaveBeenCalled();
});
it("reports context denial and collection failure instead of a false empty collection", async () => {
  await expect(
    readSearchCollection(
      client({ contextError: "permission denied" }).c,
      "u",
      "search_recent",
      new AbortController().signal,
    ),
  ).rejects.toThrow("permission denied");
  await expect(
    readSearchCollection(
      client({ listError: "statement timeout" }).c,
      "u",
      "search_recent",
      new AbortController().signal,
    ),
  ).rejects.toThrow("statement timeout");
});
