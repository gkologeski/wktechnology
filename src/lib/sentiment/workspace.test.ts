import { afterEach, describe, expect, it, vi } from "vitest";
const { from, aiChatFetch } = vi.hoisted(() => ({ from: vi.fn(), aiChatFetch: vi.fn() }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { from } }));
vi.mock("@/lib/ai/provider-resolver.server", () => ({ aiChatFetch }));
import { tickSentiment } from "./engine.server";

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

describe("análise de sentimento usa a empresa da mensagem", () => {
  for (const workspace of ["B", null]) {
    it(
      workspace
        ? "não associa contato de outra empresa com o mesmo telefone"
        : "recusa mensagem sem empresa antes de chamar a IA",
      async () => {
        vi.stubEnv("LOVABLE_API_KEY", "isolated-unit-test-key");
        let inserted: unknown;
        const source = {
          select: () => source,
          eq: () => source,
          not: () => source,
          gt: () => source,
          order: () => source,
          limit: async () => ({
            data: [
              {
                id: "message-B",
                workspace_id: workspace,
                owner_id: "owner-A",
                body: "olá",
                from_number: "same-phone",
              },
            ],
          }),
        };
        const done = {
          select: () => done,
          eq: () => done,
          in: async () => ({ data: [] }),
          upsert: async (row: unknown) => {
            inserted = row;
            return { error: null };
          },
        };
        const contacts = {
          select: () => contacts,
          in: async () => ({
            data: [
              { id: "contact-B", workspace_id: "B", phone: "same-phone" },
              { id: "contact-A", workspace_id: "A", phone: "same-phone" },
            ],
          }),
        };
        from.mockImplementation((table: string) =>
          table === "whatsapp_messages" ? source : table === "contacts" ? contacts : done,
        );
        aiChatFetch.mockResolvedValue({
          ok: true,
          json: async () => ({
            choices: [{ message: { content: '{"label":"neutral","score":0}' } }],
          }),
        });
        const result = await tickSentiment();
        if (workspace) {
          expect(result).toEqual({ processed: 1, errors: 0 });
          expect(inserted).toMatchObject({
            workspace_id: "B",
            contact_id: "contact-B",
            owner_id: "owner-A",
          });
          expect(aiChatFetch.mock.calls[0][1]).toMatchObject({ workspaceId: "B" });
        } else {
          expect(result).toEqual({ processed: 0, errors: 1 });
          expect(aiChatFetch).not.toHaveBeenCalled();
          expect(inserted).toBeUndefined();
        }
      },
    );
  }
});
