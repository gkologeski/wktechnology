import { beforeEach, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
const authorize = vi.hoisted(() => vi.fn());
vi.mock("@/lib/access-control/work-core.server", () => ({ workRpc: authorize }));
import { loadWorkflowAcceptedCommercialSource } from "./accepted-commercial-source.server";
beforeEach(() => {
  authorize.mockReset();
  authorize.mockResolvedValue(true);
});
function fixture(options: { drafts?: unknown[]; snapshot?: unknown } = {}) {
  const rows: Record<string, unknown> = {
    contract_drafts: options.drafts ?? [
      {
        id: "d",
        proposal_id: "p",
        body_html: "Cláusulas aceitas",
        client_decided_at: "2026-11-14",
        decided_at: "2026-11-14",
      },
    ],
    proposals: { id: "p", version: 3, legal_entity_id: "l" },
    proposal_document_versions: {
      document: options.snapshot ?? {
        proposal: { company_id: "company", quote_id: "q", total_amount: 123, currency: "BRL" },
        items: [{ id: "i", name: "Item da versão aceita", service: { name: "Serviço" } }],
      },
    },
  };
  const filters: unknown[][] = [];
  const from = vi.fn((table: string) => {
    const response = { data: rows[table], error: null };
    const chain: any = {
      select: () => chain,
      eq: (...args: unknown[]) => {
        filters.push(args);
        return chain;
      },
      order: () => chain,
      limit: () => Promise.resolve(response),
      maybeSingle: () => Promise.resolve(response),
    };
    return chain;
  });
  return { client: { from } as unknown as SupabaseClient, from, filters };
}
it("commercial workflow source preserves accepted items and body", async () => {
  const f = fixture();
  const s = await loadWorkflowAcceptedCommercialSource(f.client, "ws", "deal", "actor");
  expect(s.items[0].name).toBe("Item da versão aceita");
  expect(s.bodyHtml).toBe("Cláusulas aceitas");
  expect(s.fields.total_value).toBe(123);
  expect(s.fields.proposal_id).toBe("p");
  expect(f.filters.filter((x) => x[0] === "workspace_id")).toHaveLength(3);
});
for (const reason of ["missing permission", "explicit deny", "foreign workspace", "inactive actor"])
  it("commercial workflow source rejects " + reason + " before reading", async () => {
    authorize.mockResolvedValue(false);
    const f = fixture();
    await expect(
      loadWorkflowAcceptedCommercialSource(f.client, "ws", "deal", "actor"),
    ).rejects.toThrow("sem permissão");
    expect(f.from).not.toHaveBeenCalled();
  });
it("commercial workflow source rejects absent accepted draft", async () => {
  const f = fixture({ drafts: [] });
  await expect(
    loadWorkflowAcceptedCommercialSource(f.client, "ws", "deal", "actor"),
  ).rejects.toThrow("única minuta");
});
it("commercial workflow source rejects ambiguous drafts", async () => {
  const f = fixture({ drafts: [{}, {}] });
  await expect(
    loadWorkflowAcceptedCommercialSource(f.client, "ws", "deal", "actor"),
  ).rejects.toThrow("única minuta");
});
it("commercial workflow source never reconstructs an absent snapshot", async () => {
  const f = fixture({ snapshot: {} });
  await expect(
    loadWorkflowAcceptedCommercialSource(f.client, "ws", "deal", "actor"),
  ).rejects.toThrow("versão preservada");
});
