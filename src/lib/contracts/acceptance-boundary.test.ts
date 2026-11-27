import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), workspace: vi.fn(), admin: { admin: true } }));
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    let validator: { parse: (input: unknown) => unknown };
    const b = {
      middleware: () => b,
      inputValidator: (value: typeof validator) => {
        validator = value;
        return b;
      },
      handler:
        (fn: (args: { data: unknown; context: unknown }) => unknown) =>
        (args: { data: unknown; context: unknown }) =>
          fn({ ...args, data: validator.parse(args.data) }),
    };
    return b;
  },
}));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("@/lib/access-control/enforce.server", () => ({ getActiveWorkspaceId: mocks.workspace }));
vi.mock("@/lib/access-control/work-core.server", () => ({ workRpc: mocks.rpc }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: mocks.admin }));
import {
  getContractAcceptance,
  recordContractAcceptance,
  createContractAcceptanceLink,
  releaseContractAcceptanceBilling,
  revokeContractAcceptance,
  revokeContractAcceptanceLink,
  getPublicContractAcceptance,
  decidePublicContractAcceptance,
} from "./acceptance.functions";
const contractId = "40000000-1111-4111-8111-111111111111";
const context = { supabase: { userClient: true }, userId: "actor" };
const call = (fn: unknown, data: unknown) =>
  Promise.resolve().then(() =>
    (fn as (args: { context: unknown; data: unknown }) => unknown)({ context, data }),
  );
beforeEach(() => {
  vi.clearAllMocks();
  mocks.workspace.mockResolvedValue("workspace");
  mocks.rpc.mockResolvedValue({ accepted: true });
});
it("records commercial evidence only through the user client without signature or finance writes", async () => {
  await call(recordContractAcceptance, {
    contractId,
    acceptedAt: "2026-11-26",
    expectedHash: "b".repeat(64),
    clientName: "Cliente Exemplo",
    evidence: "Aceite explícito por e-mail da versão atual.",
  });
  expect(mocks.workspace).toHaveBeenCalledWith(context.supabase, context.userId);
  expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith(
    context.supabase,
    "contract_commercial_record",
    {
      p_contract: contractId,
      p_accepted_at: "2026-11-26",
      p_client_name: "Cliente Exemplo",
      p_evidence: "Aceite explícito por e-mail da versão atual.",
      p_reason: null,
      p_expected_hash: "b".repeat(64),
    },
  );
});
it.each([getContractAcceptance, createContractAcceptanceLink, revokeContractAcceptanceLink])(
  "uses user-scoped RPC for state and revocable links %s",
  async (fn) => {
    await call(fn, { contractId });
    expect(mocks.rpc.mock.calls[0][0]).toBe(context.supabase);
  },
);
it.each(["missing permission", "explicit deny", "foreign workspace", "inactive member"])(
  "does not escalate or silently accept SQL authorization failure: %s",
  async (error) => {
    mocks.rpc.mockRejectedValue(Error(error));
    await expect(
      call(recordContractAcceptance, {
        contractId,
        acceptedAt: "2026-11-26",
        expectedHash: "b".repeat(64),
        clientName: "Cliente",
        evidence: "Mensagem explícita de aceite comercial.",
      }),
    ).rejects.toThrow(error);
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(mocks.rpc.mock.calls[0][0]).toBe(context.supabase);
  },
);
it("rejects invalid active workspace before any commercial RPC", async () => {
  mocks.workspace.mockRejectedValue(Error("workspace inactive"));
  await expect(call(getContractAcceptance, { contractId })).rejects.toThrow("workspace inactive");
  expect(mocks.rpc).not.toHaveBeenCalled();
});
it("release carries a separately audited due date and reason and does not rewrite the contract", async () => {
  await call(releaseContractAcceptanceBilling, {
    contractId,
    dueDate: "2026-11-30",
    expectedHash: "b".repeat(64),
    reason: "Parcela única, vencimento acordado com o cliente.",
  });
  expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith(
    context.supabase,
    "contract_commercial_release_billing",
    {
      p_contract: contractId,
      p_due_date: "2026-11-30",
      p_expected_hash: "b".repeat(64),
      p_reason: "Parcela única, vencimento acordado com o cliente.",
    },
  );
});
it("revoking acceptance preserves a required audit reason", async () => {
  await expect(call(revokeContractAcceptance, { contractId, reason: "curto" })).rejects.toThrow();
  expect(mocks.rpc).not.toHaveBeenCalled();
});
it("public load rejects malformed bearer capabilities before privileged IO", async () => {
  await expect(call(getPublicContractAcceptance, { token: "copied-invalid" })).rejects.toThrow();
  expect(mocks.rpc).not.toHaveBeenCalled();
});
it("public acceptance requires explicit assent, canonical email and a client name", async () => {
  await expect(
    call(decidePublicContractAcceptance, {
      token: "a".repeat(64),
      clientName: "Cliente",
      accepted: false,
    }),
  ).rejects.toThrow();
  expect(mocks.rpc).not.toHaveBeenCalled();
  await call(decidePublicContractAcceptance, {
    token: "a".repeat(64),
    clientName: "Cliente",
    clientEmail: " Cliente@BÜCHER.de ",
    accepted: true,
  });
  expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith(
    mocks.admin,
    "contract_commercial_public_accept",
    {
      p_token: "a".repeat(64),
      p_client_name: "Cliente",
      p_client_email: "Cliente@xn--bcher-kva.de",
    },
  );
});
it("public token response never invokes release, activation or signature RPCs", async () => {
  await call(getPublicContractAcceptance, { token: "a".repeat(64) });
  expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith(mocks.admin, "contract_commercial_public_get", {
    p_token: "a".repeat(64),
  });
  expect(mocks.workspace).not.toHaveBeenCalled();
});
