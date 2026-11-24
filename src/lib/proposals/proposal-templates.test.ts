import { beforeEach, describe, expect, it, vi } from "vitest";
import { checkedMutationClient } from "@/lib/access-control/checked-mutation-client";

const mocks = vi.hoisted(() => ({
  resolveActiveWorkspace: vi.fn(),
  assertSalesArea: vi.fn(),
  assertSalesRecord: vi.fn(),
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
  assertSalesArea: mocks.assertSalesArea,
  assertSalesRecord: mocks.assertSalesRecord,
}));
vi.mock("@/lib/active-workspace.server", () => ({
  resolveActiveWorkspace: mocks.resolveActiveWorkspace,
}));

import { saveProposalTemplate } from "./proposal-templates.functions";

const WS_ID = "11111111-1111-4111-8111-111111111111";
const TPL_ID = "22222222-2222-4222-8222-222222222222";
const SVC_ID = "33333333-3333-4333-8333-333333333333";

type QueryCall = { table: string; op: string; selected: string | null };

function makeCheckedSupabase(opts?: {
  deletedRows?: Array<Record<string, unknown>>;
  deleteError?: { code: string; message: string } | null;
}) {
  const calls: QueryCall[] = [];
  const raw = {
    from: (table: string) => {
      let op = "select";
      let selected: string | null = null;
      const q: Record<string, unknown> = {
        update: () => ((op = "update"), q),
        insert: () => ((op = "insert"), q),
        delete: () => ((op = "delete"), q),
        eq: () => q,
        select: (cols = "*") => ((selected = cols), q),
        single: () => q,
        maybeSingle: () => q,
        then: (resolve: (v: unknown) => unknown) => {
          calls.push({ table, op, selected });
          if (table === "proposal_template_services" && selected === "id") {
            return resolve({
              data: null,
              error: {
                code: "42703",
                message: "column proposal_template_services.id does not exist",
              },
            });
          }
          if (table === "proposal_templates" && op === "update") {
            return resolve({ data: [{ id: TPL_ID }], error: null });
          }
          if (table === "proposal_template_services" && op === "delete") {
            if (opts?.deleteError) {
              return resolve({ data: null, error: opts.deleteError });
            }
            return resolve({ data: opts?.deletedRows ?? [], error: null });
          }
          if (table === "proposal_template_services" && op === "insert") {
            return resolve({ data: [{ template_id: TPL_ID }], error: null });
          }
          return resolve({ data: [], error: null });
        },
      };
      return q;
    },
  };
  return { sb: checkedMutationClient(raw, { server: true }), calls };
}

type Handler = (args: {
  data: {
    id: string | null;
    name: string;
    description: string | null;
    html: string;
    services: string[];
    contract_template_id: string | null;
  };
  context: { supabase: unknown; userId: string };
}) => Promise<{ id: string }>;

describe("saveProposalTemplate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolveActiveWorkspace.mockResolvedValue(WS_ID);
    mocks.assertSalesArea.mockResolvedValue(undefined);
  });

  it("renames an existing template without selecting non-existent proposal_template_services.id", async () => {
    const { sb, calls } = makeCheckedSupabase({
      deletedRows: [{ template_id: TPL_ID }],
    });
    const res = await (saveProposalTemplate as unknown as Handler)({
      data: {
        id: TPL_ID,
        name: "Proposta Comercial — Novo Nome",
        description: "Descrição",
        html: "<p>Conteúdo</p>",
        services: [SVC_ID],
        contract_template_id: null,
      },
      context: { supabase: sb, userId: "user-1" },
    });

    expect(res).toEqual({ id: TPL_ID });
    const delCall = calls.find(
      (c) => c.table === "proposal_template_services" && c.op === "delete",
    );
    expect(delCall).toEqual({
      table: "proposal_template_services",
      op: "delete",
      selected: "template_id",
    });
  });

  it("allows saving an existing template that had zero linked services", async () => {
    const { sb } = makeCheckedSupabase({ deletedRows: [] });
    const res = await (saveProposalTemplate as unknown as Handler)({
      data: {
        id: TPL_ID,
        name: "Proposta sem serviços",
        description: null,
        html: "<p>Texto</p>",
        services: [],
        contract_template_id: null,
      },
      context: { supabase: sb, userId: "user-1" },
    });
    expect(res).toEqual({ id: TPL_ID });
  });

  it("propagates database errors when clearing proposal_template_services fails", async () => {
    const { sb } = makeCheckedSupabase({
      deleteError: {
        code: "42501",
        message: "permission denied for table proposal_template_services",
      },
    });
    await expect(
      (saveProposalTemplate as unknown as Handler)({
        data: {
          id: TPL_ID,
          name: "Proposta bloqueada",
          description: null,
          html: "<p>Texto</p>",
          services: [],
          contract_template_id: null,
        },
        context: { supabase: sb, userId: "user-1" },
      }),
    ).rejects.toThrow("permission denied for table proposal_template_services");
  });
});
