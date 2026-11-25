import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  resolveActiveWorkspace: vi.fn(),
  assertSalesAnyArea: vi.fn(),
  assertSalesReferences: vi.fn(),
  aiChatFetch: vi.fn(),
}));

vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    const chain = {
      middleware: () => chain,
      inputValidator: () => chain,
      handler: (fn: unknown) => fn,
    };
    return chain;
  },
}));
vi.mock("@/lib/access-control/sales-permission.middleware", () => ({
  requireSalesPermission: () => ({}),
}));
vi.mock("@/lib/access-control/sales-core.server", () => ({
  assertSalesAnyArea: mocks.assertSalesAnyArea,
  assertSalesReferences: mocks.assertSalesReferences,
}));
vi.mock("@/lib/active-workspace.server", () => ({
  resolveActiveWorkspace: mocks.resolveActiveWorkspace,
}));
vi.mock("@/lib/ai/provider-resolver.server", () => ({
  aiChatFetch: mocks.aiChatFetch,
}));

import { generateProposalScope } from "./proposal-scope-ai.functions";
import { buildScopePromptPayload, parseAiScopeResponse } from "./proposal-scope-ai.server";
import type { ProposalScopeBrief } from "./proposal-scope-forms";

const WS_ID = "11111111-1111-4111-8111-111111111111";
const DEAL_ID = "22222222-2222-4222-8222-222222222222";
const PROPOSAL_ID = "33333333-3333-4333-8333-333333333333";

type GenerateHandler = (args: {
  data: {
    proposalId?: string;
    quoteId?: string;
    dealId?: string;
    brief: ProposalScopeBrief;
    context: {
      title: string;
      companyName?: string | null;
      providerName?: string | null;
      totalFormatted?: string | null;
      paymentTermsSummary?: string | null;
      items?: Array<{ name: string; billing: string }>;
    };
  };
  context: { supabase: unknown; userId: string };
}) => Promise<{ html: string; sections: Array<{ title: string; content: string }> }>;

const SAMPLE_BRIEF: ProposalScopeBrief = {
  general: {
    objective: "Prestar consultoria técnica e suporte operacional de 18 horas para a Brooks.",
    client_responsibilities: "Fornecer acessos ao ambiente e ponto focal técnico.",
  },
  services: [
    {
      id: "s1",
      name: "Consultoria e Suporte 18 horas",
      billing: "18 h · R$ 3.600,00",
      serviceType: "suporte",
      modality: "hourly",
      answers: {
        covered_systems: "ERP e rotinas fiscais",
        coverage_hours: "Seg a Sex, 08h30 às 18h",
        hours_allowance_overage: "18h sem acúmulo; excedentes sob aprovação.",
      },
      freeNotes: "Inclui consultoria técnica sob demanda e apoio ao time interno da Brooks.",
    },
  ],
};

describe("generateProposalScope", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.assertSalesAnyArea.mockResolvedValue(undefined);
    mocks.assertSalesReferences.mockResolvedValue(undefined);
    mocks.resolveActiveWorkspace.mockResolvedValue(WS_ID);
    mocks.aiChatFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                html: "<h3>Visão Geral</h3><p>Atendimento à Brooks.</p><h3>Suporte 18h</h3><ul><li>Seg a Sex, 08h30 às 18h</li></ul>",
                sections: [
                  { title: "Visão Geral", content: "Atendimento à Brooks." },
                  { title: "Suporte 18h", content: "• Seg a Sex, 08h30 às 18h" },
                ],
              }),
            },
          },
        ],
      }),
    });
  });

  it("allows an authorized active workspace member to generate technical scope via aiChatFetch", async () => {
    const sb = { tag: "caller-rls-client" };
    const res = await (generateProposalScope as unknown as GenerateHandler)({
      data: {
        proposalId: PROPOSAL_ID,
        dealId: DEAL_ID,
        brief: SAMPLE_BRIEF,
        context: {
          title: "CT/Brooks/Sergio/Suporte 18 horas",
          companyName: "Brooks",
          providerName: "GM Kologeski & Cia Ltda ME",
          totalFormatted: "R$ 3.600,00",
        },
      },
      context: { supabase: sb, userId: "user-allowed" },
    });

    expect(mocks.assertSalesAnyArea).toHaveBeenCalledWith(sb, "techsales.proposals", [
      "create",
      "update",
    ]);
    expect(mocks.assertSalesReferences).toHaveBeenCalledWith(sb, {
      proposals: PROPOSAL_ID,
      quotes: undefined,
      deals: DEAL_ID,
    });
    expect(mocks.aiChatFetch).toHaveBeenCalledTimes(1);
    expect(mocks.aiChatFetch.mock.calls[0]?.[1]).toEqual({
      workspaceId: WS_ID,
      userId: "user-allowed",
      feature: "redacao",
    });
    expect(res.html).toContain("Visão Geral");
    expect(res.sections).toHaveLength(2);
  });

  it("rejects scope generation when proposal create/update permission key is missing without calling AI", async () => {
    mocks.assertSalesAnyArea.mockRejectedValueOnce(new Error("Sem permissão."));
    await expect(
      (generateProposalScope as unknown as GenerateHandler)({
        data: { brief: SAMPLE_BRIEF, context: { title: "Proposta" } },
        context: { supabase: {}, userId: "user-no-key" },
      }),
    ).rejects.toThrow("Sem permissão.");
    expect(mocks.aiChatFetch).not.toHaveBeenCalled();
  });

  it("rejects scope generation on explicit deny of proposal update/create", async () => {
    mocks.assertSalesAnyArea.mockRejectedValueOnce(
      new Error("Acesso negado explicitamente para techsales.proposals."),
    );
    await expect(
      (generateProposalScope as unknown as GenerateHandler)({
        data: { proposalId: PROPOSAL_ID, brief: SAMPLE_BRIEF, context: { title: "Proposta" } },
        context: { supabase: {}, userId: "user-denied" },
      }),
    ).rejects.toThrow("Acesso negado explicitamente");
    expect(mocks.aiChatFetch).not.toHaveBeenCalled();
  });

  it("rejects scope generation when referenced deal or proposal belongs to another workspace", async () => {
    mocks.assertSalesReferences.mockRejectedValueOnce(
      new Error("Registro indisponível ou pertence a outro workspace."),
    );
    await expect(
      (generateProposalScope as unknown as GenerateHandler)({
        data: { dealId: DEAL_ID, brief: SAMPLE_BRIEF, context: { title: "Proposta" } },
        context: { supabase: {}, userId: "user-other-ws" },
      }),
    ).rejects.toThrow("outro workspace");
    expect(mocks.aiChatFetch).not.toHaveBeenCalled();
  });

  it("rejects scope generation for an inactive workspace member", async () => {
    mocks.resolveActiveWorkspace.mockRejectedValueOnce(
      new Error("Membro inativo ou sem workspace ativo."),
    );
    await expect(
      (generateProposalScope as unknown as GenerateHandler)({
        data: { brief: SAMPLE_BRIEF, context: { title: "Proposta" } },
        context: { supabase: {}, userId: "user-inactive" },
      }),
    ).rejects.toThrow("Membro inativo");
    expect(mocks.aiChatFetch).not.toHaveBeenCalled();
  });

  it("rejects empty brief without invoking AI provider", async () => {
    await expect(
      (generateProposalScope as unknown as GenerateHandler)({
        data: {
          brief: { general: {}, services: [] },
          context: { title: "Proposta vazia" },
        },
        context: { supabase: {}, userId: "user-allowed" },
      }),
    ).rejects.toThrow("Preencha ao menos um campo");
    expect(mocks.aiChatFetch).not.toHaveBeenCalled();
  });

  it("builds structured prompt with multi-service details and parses HTML fallback cleanly", () => {
    const payload = buildScopePromptPayload(SAMPLE_BRIEF, {
      title: "CT/Brooks/Sergio/Suporte 18 horas",
      companyName: "Brooks",
    });
    expect(payload.system).toContain("NUNCA invente");
    expect(payload.user).toContain("Suporte e sustentação");
    expect(payload.user).toContain("Por hora");
    expect(payload.user).toContain("18h sem acúmulo");

    const fallback = parseAiScopeResponse(
      "<h3>Objetivo</h3><p>Apoio técnico</p><script>bad()</script>",
    );
    expect(fallback.html).not.toContain("<script");
    expect(fallback.sections[0]?.title).toBe("Objetivo");
  });
});
