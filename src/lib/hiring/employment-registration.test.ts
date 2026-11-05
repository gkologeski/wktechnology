import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  list: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  profile: vi.fn(),
  inviteUpdate: vi.fn(),
  invite: null as null | Record<string, unknown>,
}));
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    const c = { middleware: () => c, inputValidator: () => c, handler: (f: unknown) => f };
    return c;
  },
}));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: mocks.from,
    auth: {
      admin: { listUsers: mocks.list, createUser: mocks.create, updateUserById: mocks.update },
    },
  },
}));
vi.mock("@lovable.dev/email-js", () => ({ sendLovableEmail: vi.fn() }));
vi.mock("@/lib/email-templates/registry", () => ({ TEMPLATES: {} }));
import { consumeInvite } from "@/lib/workspace-invites.functions";
const call = () =>
  (consumeInvite as unknown as (a: unknown) => Promise<unknown>)({
    data: {
      token: "a".repeat(64),
      password: "test-fixture-only",
      full_name: "Fixture",
      phone: "+5548999999999",
    },
  });
beforeEach(() => {
  vi.clearAllMocks();
  mocks.invite = {
    id: "invite",
    workspace_id: "workspace",
    email: "recipient@example.test",
    role: "member",
    expires_at: new Date(Date.now() + 3600000).toISOString(),
    accepted_at: null,
    permission_set_id: null,
    hiring_engagement_id: "engagement",
  };
  mocks.list.mockResolvedValue({ data: { users: [] }, error: null });
  mocks.create.mockResolvedValue({ data: { user: { id: "new-account" } }, error: null });
  mocks.profile.mockResolvedValue({ error: null });
  mocks.from.mockImplementation((table: string) => {
    if (table === "workspace_invites") {
      const q = {
        select: () => q,
        eq: () => q,
        maybeSingle: async () => ({ data: mocks.invite }),
        update: mocks.inviteUpdate,
      };
      return q;
    }
    if (table === "profiles") return { upsert: mocks.profile };
    throw new Error("Unexpected legacy access: " + table);
  });
});
it("an existing hiring recipient must authenticate and cannot have their password or ban changed", async () => {
  mocks.list.mockResolvedValue({
    data: { users: [{ id: "existing", email: "recipient@example.test" }] },
    error: null,
  });
  await expect(call()).rejects.toThrow("Entre nela");
  expect(mocks.update).not.toHaveBeenCalled();
  expect(mocks.create).not.toHaveBeenCalled();
  expect(mocks.profile).not.toHaveBeenCalled();
});
it("new hiring account registration creates no workspace role, grant or consumed invite before login", async () => {
  expect(await call()).toEqual({ ok: true, email: "recipient@example.test", hiring: true });
  expect(mocks.create).toHaveBeenCalledOnce();
  expect(mocks.update).not.toHaveBeenCalled();
  expect(mocks.from.mock.calls.map((x) => x[0])).toEqual(["workspace_invites", "profiles"]);
  expect(mocks.inviteUpdate).not.toHaveBeenCalled();
});
it("an expired hiring invite cannot create or modify an account", async () => {
  mocks.invite!.expires_at = "2020-01-01T00:00:00Z";
  await expect(call()).rejects.toThrow("expirado");
  expect(mocks.create).not.toHaveBeenCalled();
  expect(mocks.update).not.toHaveBeenCalled();
  expect(mocks.list).not.toHaveBeenCalled();
});
