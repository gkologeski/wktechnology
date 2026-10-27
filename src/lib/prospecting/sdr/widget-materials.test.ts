import { beforeEach, describe, expect, it, vi } from "vitest";
import { FakeDb } from "./test-fake-db";
const holder = vi.hoisted(() => ({ db: null as any }));
vi.mock("@tanstack/react-router", () => ({ createFileRoute: () => (options: unknown) => options }));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: new Proxy(
    {},
    {
      get: (_, key) =>
        typeof holder.db[key] === "function" ? holder.db[key].bind(holder.db) : holder.db[key],
    },
  ),
}));
import { Route } from "@/routes/api/public/widget/messages";
const fileId = "79000000-0000-4000-8000-000000000013";
const get = async (visitor = "visitor-secret") =>
  (Route as any).server.handlers.GET({
    request: new Request(
      `https://app.example/api/public/widget/messages?session_id=s1&visitor_id=${visitor}`,
    ),
  });
beforeEach(() => {
  holder.db = new FakeDb();
  holder.db
    .t("live_chat_sessions")
    .push({ id: "s1", owner_id: "w1", visitor_id: "visitor-secret", status: "open" });
  holder.db.t("live_chat_messages").push({
    id: "m1",
    session_id: "s1",
    direction: "outbound",
    body: "Material",
    created_at: "2026-01-01",
    agent_attachments: [{ material_id: fileId }],
  });
  holder.db.t("sdr_materials").push({
    id: fileId,
    workspace_id: "w1",
    kind: "file",
    title: "Apresentação",
    storage_path: "w1/presentation.pdf",
    active: true,
    approved: true,
  });
  holder.db.storage = {
    from: () => ({
      createSignedUrls: vi.fn(async (paths: string[]) => ({
        data: paths.map((path) => ({
          path,
          signedUrl: `https://storage.example/${path}?signed=yes`,
        })),
      })),
    }),
  };
});
describe("public widget material capability", () => {
  it("allows the actual visitor to read delivered approved workspace material", async () => {
    const response = await get();
    const result = await response.json();
    expect(response.status).toBe(200);
    expect(result.messages[0].attachments).toEqual([
      { title: "Apresentação", url: "https://storage.example/w1/presentation.pdf?signed=yes" },
    ]);
    expect(result.messages[0]).not.toHaveProperty("agent_attachments");
  });
  it("rejects a missing public session capability", async () => {
    expect((await get("")).status).toBe(400);
  });
  it("rejects a foreign visitor capability", async () => {
    expect((await get("other-visitor")).status).toBe(403);
  });
  it("revokes access to an explicitly unapproved material", async () => {
    holder.db.t("sdr_materials")[0].approved = false;
    expect((await (await get()).json()).messages[0].attachments).toEqual([]);
  });
  it("does not sign a foreign workspace material", async () => {
    holder.db.t("sdr_materials")[0].workspace_id = "w2";
    expect((await (await get()).json()).messages[0].attachments).toEqual([]);
  });
  it("does not sign an inactive material", async () => {
    holder.db.t("sdr_materials")[0].active = false;
    expect((await (await get()).json()).messages[0].attachments).toEqual([]);
  });
});
