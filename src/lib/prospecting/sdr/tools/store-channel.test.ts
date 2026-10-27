import { describe, expect, it, vi } from "vitest";
vi.mock("@/lib/access-control/sales-worker.server", () => ({ assertSalesWorker: vi.fn() }));
vi.mock("@/lib/access-control/hubspot-source-client.server", () => ({
  hubspotSourceClient: (db: unknown) => db,
}));
import { FakeDb } from "../test-fake-db";
import { createDbToolStore } from "./store.server";

function fixture(scope?: { leadId: string | null; contactId: string | null }) {
  const db = new FakeDb();
  const from = db.from.bind(db);
  db.from = ((table: string) => {
    const query = from(table);
    return Object.assign(query, {
      ilike: (column: string, value: string) => query.eq(column, value),
    });
  }) as typeof db.from;
  db.t("contacts").push(
    { id: "c1", workspace_id: "w1", first_name: "Cliente", email: "same@example.com" },
    { id: "c2", workspace_id: "w1", first_name: "Outro", email: "same@example.com" },
    { id: "c1", workspace_id: "w2", first_name: "Estrangeiro", email: "same@example.com" },
  );
  db.t("leads").push({
    id: "l1",
    workspace_id: "w1",
    first_name: "Lead",
    email: "same@example.com",
  });
  const store = createDbToolStore(db, {
    workspaceId: "w1",
    playbookId: "pb1",
    agentVersionId: "v1",
    jobId: "j1",
    conversationId: "s1",
    enrollmentId: "e1",
    customerScope: scope,
    restrictCustomerContext: true,
    conversationReference: { table: "live_chat_sessions", id: "chat1" },
  });
  return { db, store };
}
describe("channel customer isolation", () => {
  it("anonymous visitor cannot enumerate contacts or leads", async () => {
    const { store } = fixture({ leadId: null, contactId: null });
    expect(
      await store.findCustomers({
        email: "same@example.com",
        firstName: null,
        lastName: null,
        phoneVariants: [],
      }),
    ).toEqual([]);
  });
  it("verified sender can only resolve the linked person in the current workspace", async () => {
    const { store } = fixture({ contactId: "c1", leadId: null });
    const found = await store.findCustomers({
      email: "same@example.com",
      firstName: null,
      lastName: null,
      phoneVariants: [],
    });
    expect(found.map((row) => row.id)).toEqual(["c1"]);
    expect(found[0].first_name).toBe("Cliente");
  });
  it("private context stays empty until explicit approval", async () => {
    const { store } = fixture({ contactId: "c1", leadId: null });
    expect(
      await store.crmContext({ contactId: "c1", leadId: null, companyId: null, dealId: null }),
    ).toEqual({});
  });
  it("legacy WhatsApp lookup retains its existing authorized scope", async () => {
    const { store } = fixture();
    const found = await store.findCustomers({
      email: "same@example.com",
      firstName: null,
      lastName: null,
      phoneVariants: [],
    });
    expect(found.map((row) => row.id).sort()).toEqual(["c1", "c2", "l1"]);
  });
});
