import { beforeEach, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({
  context: {} as any,
  eq: vi.fn(),
  or: vi.fn(),
  order: vi.fn(),
  limit: vi.fn(),
}));
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    let validate: (v: unknown) => unknown = (v) => v;
    const builder: any = {
      middleware: () => builder,
      inputValidator: (fn: any) => {
        validate = fn;
        return builder;
      },
      handler: (fn: any) => async (args: any) =>
        fn({ context: mock.context, data: validate(args.data) }),
    };
    return builder;
  },
}));
vi.mock("./inbox-access.middleware", () => ({ requireLinkedinInbox: () => ({}) }));
import { listLinkedinConversations } from "./inbox.functions";
beforeEach(() => {
  vi.clearAllMocks();
  const query: any = {
    select: () => query,
    eq: mock.eq,
    or: mock.or,
    order: mock.order,
    limit: mock.limit,
  };
  for (const fn of [mock.eq, mock.or, mock.order]) fn.mockReturnValue(query);
  mock.limit.mockResolvedValue({ data: [], error: null });
  mock.context = { linkedinWorkspace: "wk", userId: "owner", supabase: { from: () => query } };
});
it("preserves PostgreSQL timestamp precision and offset in private pagination", async () => {
  const at = "2026-11-13T10:00:00.123456+00:00",
    id = "10000000-0000-4000-8000-000000000001";
  await listLinkedinConversations({ data: { before: { at, id }, limit: 50 } });
  expect(mock.eq).toHaveBeenCalledWith("workspace_id", "wk");
  expect(mock.eq).toHaveBeenCalledWith("owner_id", "owner");
  expect(mock.or).toHaveBeenCalledWith(
    `last_message_at.lt.${at},and(last_message_at.eq.${at},id.lt.${id})`,
  );
  expect(mock.limit).toHaveBeenCalledWith(51);
});
it("rejects malformed cursor values before constructing a database predicate", async () => {
  await expect(
    listLinkedinConversations({
      data: {
        before: {
          at: "2026-11-13T10:00:00Z),or(owner_id.neq.null)",
          id: "10000000-0000-4000-8000-000000000001",
        },
        limit: 50,
      },
    }),
  ).rejects.toThrow();
  expect(mock.or).not.toHaveBeenCalled();
});
