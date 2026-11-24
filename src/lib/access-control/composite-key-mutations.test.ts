import { beforeEach, describe, expect, it, vi } from "vitest";
import { checkedMutationClient } from "./checked-mutation-client";

const mocks = vi.hoisted(() => ({
  salesMiddlewareError: null as Error | null,
  sharedMiddlewareError: null as Error | null,
  workRpc: vi.fn(),
}));

vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    let middlewares: Array<unknown> = [];
    const chain = {
      middleware: (m: Array<unknown>) => ((middlewares = m), chain),
      inputValidator: () => chain,
      handler: (fn: (args: { data: unknown; context: unknown }) => Promise<unknown>) => {
        return async (args: { data: unknown; context: unknown }) => {
          for (const mw of middlewares) {
            if (typeof mw === "function") await mw();
          }
          return fn(args);
        };
      },
    };
    return chain;
  },
}));

vi.mock("@/lib/access-control/sales-permission.middleware", () => ({
  requireSalesPermission: () => async () => {
    if (mocks.salesMiddlewareError) throw mocks.salesMiddlewareError;
  },
}));
vi.mock("@/lib/access-control/shared-permission.middleware", () => ({
  requireSharedPermission: () => async () => {
    if (mocks.sharedMiddlewareError) throw mocks.sharedMiddlewareError;
  },
}));
vi.mock("@/lib/access-control/sales-core.server", () => ({
  assertSalesArea: vi.fn(),
  assertSalesRecord: vi.fn(),
  salesRpc: vi.fn(),
}));
vi.mock("@/lib/access-control/work-core.server", () => ({
  workRpc: mocks.workRpc,
}));
vi.mock("@/lib/active-workspace.server", () => ({
  resolveActiveWorkspace: vi.fn().mockResolvedValue("ws-1"),
}));

import { removeStaticMember } from "@/lib/segments.functions";
import { markRead } from "@/lib/chat.functions";

const SEG_ID = "44444444-4444-4444-8444-444444444444";
const ENT_ID = "55555555-5555-4555-8555-555555555555";
const CONV_ID = "66666666-6666-4666-8666-666666666666";
const USER_ID = "77777777-7777-4777-8777-777777777777";

type Call = { table: string; op: string; selected: string | null };

function makeCompositeDb(opts?: {
  rlsError?: { code: string; message: string } | null;
  conversationVisible?: boolean;
  updatedRows?: number;
}) {
  const calls: Call[] = [];
  const raw = {
    from: (table: string) => {
      let op = "select";
      let selected: string | null = null;
      const q: Record<string, unknown> = {
        delete: () => ((op = "delete"), q),
        update: () => ((op = "update"), q),
        select: (cols = "*") => ((selected = cols), q),
        eq: () => q,
        maybeSingle: () => q,
        then: (resolve: (v: unknown) => unknown) => {
          calls.push({ table, op, selected });
          if (
            (table === "segment_members" || table === "chat_conversation_members") &&
            selected === "id"
          ) {
            return resolve({
              data: null,
              error: { code: "42703", message: `column ${table}.id does not exist` },
            });
          }
          if (table === "chat_conversations" && op === "select") {
            return resolve({
              data: opts?.conversationVisible === false ? null : { id: CONV_ID },
              error: null,
            });
          }
          if (op === "delete" || op === "update") {
            if (opts?.rlsError) return resolve({ data: null, error: opts.rlsError });
            const n = opts?.updatedRows ?? 1;
            const row =
              table === "segment_members"
                ? { segment_id: SEG_ID }
                : table === "chat_conversation_members"
                  ? { conversation_id: CONV_ID }
                  : { id: SEG_ID };
            return resolve({ data: Array.from({ length: n }, () => row), error: null });
          }
          return resolve({ data: [], count: 0, error: null });
        },
      };
      return q;
    },
  };
  return { db: checkedMutationClient(raw, { server: true }), calls };
}

type Fn = (args: { data: unknown; context: unknown }) => Promise<unknown>;

describe("composite-key mutations through checkedMutationClient", () => {
  beforeEach(() => {
    mocks.salesMiddlewareError = null;
    mocks.sharedMiddlewareError = null;
    mocks.workRpc.mockReset();
    mocks.workRpc.mockResolvedValue(true);
  });

  it("composite-key mutation allows active authorized member on segment_members and chat_conversation_members", async () => {
    const seg = makeCompositeDb();
    const segRes = await (removeStaticMember as unknown as Fn)({
      data: { segmentId: SEG_ID, entityId: ENT_ID },
      context: { supabase: seg.db, userId: USER_ID },
    });
    expect(segRes).toEqual({ ok: true, count: 0 });
    expect(
      seg.calls.find((c) => c.table === "segment_members" && c.op === "delete")?.selected,
    ).toBe("segment_id");

    const chat = makeCompositeDb({ conversationVisible: true });
    const chatRes = await (markRead as unknown as Fn)({
      data: { conversation_id: CONV_ID },
      context: { supabase: chat.db, userId: USER_ID },
    });
    expect(chatRes).toEqual({ ok: true });
    expect(
      chat.calls.find((c) => c.table === "chat_conversation_members" && c.op === "update")
        ?.selected,
    ).toBe("conversation_id");
  });

  it("composite-key mutation rejects missing permission", async () => {
    mocks.salesMiddlewareError = new Error("Sem permissão: techsales.segments.delete");
    const seg = makeCompositeDb();
    await expect(
      (removeStaticMember as unknown as Fn)({
        data: { segmentId: SEG_ID, entityId: ENT_ID },
        context: { supabase: seg.db, userId: USER_ID },
      }),
    ).rejects.toThrow("Sem permissão");

    mocks.sharedMiddlewareError = new Error("Sem permissão: system.messenger.view");
    const chat = makeCompositeDb();
    await expect(
      (markRead as unknown as Fn)({
        data: { conversation_id: CONV_ID },
        context: { supabase: chat.db, userId: USER_ID },
      }),
    ).rejects.toThrow("Sem permissão");
  });

  it("composite-key mutation rejects explicit deny", async () => {
    mocks.salesMiddlewareError = new Error("Acesso negado explicitamente (deny).");
    const seg = makeCompositeDb();
    await expect(
      (removeStaticMember as unknown as Fn)({
        data: { segmentId: SEG_ID, entityId: ENT_ID },
        context: { supabase: seg.db, userId: USER_ID },
      }),
    ).rejects.toThrow("deny");

    mocks.sharedMiddlewareError = new Error("Acesso negado explicitamente (deny).");
    const chat = makeCompositeDb();
    await expect(
      (markRead as unknown as Fn)({
        data: { conversation_id: CONV_ID },
        context: { supabase: chat.db, userId: USER_ID },
      }),
    ).rejects.toThrow("deny");
  });

  it("composite-key mutation rejects foreign workspace record", async () => {
    const seg = makeCompositeDb({
      rlsError: { code: "42501", message: "Registro pertence a outro workspace." },
    });
    await expect(
      (removeStaticMember as unknown as Fn)({
        data: { segmentId: SEG_ID, entityId: ENT_ID },
        context: { supabase: seg.db, userId: USER_ID },
      }),
    ).rejects.toThrow("outro workspace");

    const chat = makeCompositeDb({ conversationVisible: false });
    mocks.workRpc.mockResolvedValue(false);
    await expect(
      (markRead as unknown as Fn)({
        data: { conversation_id: CONV_ID },
        context: { supabase: chat.db, userId: USER_ID },
      }),
    ).rejects.toThrow("Conversa indisponível.");
  });

  it("composite-key mutation rejects inactive member", async () => {
    mocks.salesMiddlewareError = new Error("Membro inativo no workspace.");
    const seg = makeCompositeDb();
    await expect(
      (removeStaticMember as unknown as Fn)({
        data: { segmentId: SEG_ID, entityId: ENT_ID },
        context: { supabase: seg.db, userId: USER_ID },
      }),
    ).rejects.toThrow("inativo");

    mocks.sharedMiddlewareError = new Error("Membro inativo no workspace.");
    const chat = makeCompositeDb();
    await expect(
      (markRead as unknown as Fn)({
        data: { conversation_id: CONV_ID },
        context: { supabase: chat.db, userId: USER_ID },
      }),
    ).rejects.toThrow("inativo");
  });
});
