import { beforeEach, describe, expect, it, vi } from "vitest";

const suggestCompanyLeft = vi.fn(async () => "created" as const);
const ingestInboundForSdr = vi.fn(async () => ({}));

vi.mock("@/lib/inbox/ai-suggestions.server", () => ({ suggestCompanyLeft }));
vi.mock("@/lib/prospecting/sdr/ingest.server", () => ({ ingestInboundForSdr }));
vi.mock("@/lib/inbox/identity-resolution.server", () => ({
  identityColumns: () => ({}),
  resolveInboxIdentity: async () => null,
}));
vi.mock("@/lib/inbox-auto-assignment.server", () => ({
  autoAssignInboxConversation: async () => undefined,
}));
vi.mock("@/lib/whatsapp/meta-channel.server", () => ({
  normalizePhone: (p: string) => p.replace(/\D/g, ""),
}));
vi.mock("./inbound-media.server", () => ({ storeInboundMedia: async () => undefined }));

// Banco falso: cada tabela devolve um resultado fixo para single/maybeSingle.
function fakeAdmin(rows: Record<string, unknown>) {
  return {
    from(table: string) {
      const result = { data: rows[table] ?? null, error: null };
      const b: Record<string, unknown> = {};
      for (const k of [
        "select",
        "eq",
        "in",
        "not",
        "order",
        "limit",
        "upsert",
        "insert",
        "update",
        "or",
      ])
        b[k] = () => b;
      b.maybeSingle = async () => result;
      b.single = async () => result;
      b.then = (ok: (v: unknown) => unknown) => Promise.resolve(result).then(ok);
      return b;
    },
  };
}

const payload = (id: string) => ({
  entry: [
    {
      changes: [
        {
          value: {
            metadata: { display_phone_number: "554830000000", phone_number_id: "pn1" },
            messages: [
              {
                id,
                from: "5548999990000",
                type: "text",
                text: { body: "Não trabalho mais na Acme" },
              },
            ],
          },
        },
      ],
    },
  ],
});

describe("WhatsApp inbound → sugestão 'saiu da empresa'", () => {
  beforeEach(() => {
    suggestCompanyLeft.mockClear();
    ingestInboundForSdr.mockClear();
  });

  it("mensagem nova gera a sugestão com os ids da mensagem gravada", async () => {
    const { processEvent } = await import("./webhook-processor.server");
    const admin = fakeAdmin({
      whatsapp_messages: null,
      wa_phone_numbers: { workspace_id: "ws1" },
      whatsapp_conversations: { id: "conv1", assigned_to: "u1" },
    });
    // Após o insert, a mensagem passa a existir: o mesmo builder serve ao dedupe e ao insert.
    let call = 0;
    const from = admin.from.bind(admin);
    admin.from = (t: string) => {
      const b = from(t) as Record<string, unknown>;
      if (t === "whatsapp_messages") {
        b.maybeSingle = async () => ({ data: null, error: null });
        b.single = async () => ({ data: { id: `msg${++call}` }, error: null });
      }
      return b;
    };
    const ok = await processEvent(admin, {
      id: "ev1",
      event: "whatsapp.message",
      payload: payload("wamid.1"),
      attempts: 0,
    });
    expect(ok).toBe(true);
    expect(suggestCompanyLeft).toHaveBeenCalledTimes(1);
    expect(suggestCompanyLeft).toHaveBeenCalledWith(admin, {
      workspaceId: "ws1",
      conversationId: "conv1",
      messageId: "msg1",
      body: "Não trabalho mais na Acme",
    });
  });

  it("reentrega sem conversa/workspace não gera sugestão nem reenfileira o SDR", async () => {
    const { processEvent } = await import("./webhook-processor.server");
    const admin = fakeAdmin({
      whatsapp_messages: { id: "old", conversation_id: null, workspace_id: null, body: "x" },
    });
    const ok = await processEvent(admin, {
      id: "ev2",
      event: "whatsapp.message",
      payload: payload("wamid.2"),
      attempts: 0,
    });
    expect(ok).toBe(true);
    expect(suggestCompanyLeft).not.toHaveBeenCalled();
    expect(ingestInboundForSdr).not.toHaveBeenCalled();
  });
});
