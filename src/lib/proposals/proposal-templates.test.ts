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

import { duplicateProposalTemplate, saveProposalTemplate } from "./proposal-templates.functions";

const WS_ID = "11111111-1111-4111-8111-111111111111";
const TPL_ID = "22222222-2222-4222-8222-222222222222";
const COPY_ID = "44444444-4444-4444-8444-444444444444";
const SVC_ID = "33333333-3333-4333-8333-333333333333";
const CT_ID = "55555555-5555-4555-8555-555555555555";

type QueryCall = {
  table: string;
  op: string;
  selected: string | null;
  payload?: unknown;
  filters: Record<string, unknown>;
};

function makeCheckedSupabase(opts?: {
  deletedRows?: Array<Record<string, unknown>>;
  deleteError?: { code: string; message: string } | null;
  sourceTemplate?: Record<string, unknown> | null;
  existingNames?: string[];
  sourceServices?: string[];
  contractTemplateFound?: boolean;
  insertTemplateError?: { code: string; message: string } | null;
}) {
  const calls: QueryCall[] = [];
  const raw = {
    from: (table: string) => {
      let op = "select";
      let selected: string | null = null;
      let payload: unknown;
      const filters: Record<string, unknown> = {};
      const q: Record<string, unknown> = {
        update: (body: unknown) => ((op = "update"), (payload = body), q),
        insert: (body: unknown) => ((op = "insert"), (payload = body), q),
        delete: () => ((op = "delete"), q),
        eq: (col: string, val: unknown) => ((filters[col] = val), q),
        select: (cols = "*") => ((selected = cols), q),
        single: () => q,
        maybeSingle: () => q,
        then: (resolve: (v: unknown) => unknown) => {
          calls.push({ table, op, selected, payload, filters });
          if (table === "proposal_template_services" && selected === "id") {
            return resolve({
              data: null,
              error: {
                code: "42703",
                message: "column proposal_template_services.id does not exist",
              },
            });
          }
          if (table === "proposal_templates" && op === "select" && selected === "name") {
            return resolve({
              data: (opts?.existingNames ?? []).map((name) => ({ name })),
              error: null,
            });
          }
          if (table === "proposal_templates" && op === "select") {
            return resolve({
              data: opts?.sourceTemplate === undefined ? null : opts.sourceTemplate,
              error: null,
            });
          }
          if (table === "contract_templates" && op === "select") {
            return resolve({
              data: opts?.contractTemplateFound === false ? null : { id: CT_ID },
              error: null,
            });
          }
          if (table === "proposal_template_services" && op === "select") {
            return resolve({
              data: (opts?.sourceServices ?? []).map((id) => ({ service_catalog_id: id })),
              error: null,
            });
          }
          if (table === "proposal_templates" && op === "insert") {
            if (opts?.insertTemplateError) {
              return resolve({ data: null, error: opts.insertTemplateError });
            }
            const body = payload as Record<string, unknown>;
            return resolve({
              data: {
                id: COPY_ID,
                name: body["name"],
                description: body["description"],
                html: body["html"],
                is_default: body["is_default"],
                contract_template_id: body["contract_template_id"],
              },
              error: null,
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
    expect(delCall).toMatchObject({
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

type DuplicateHandler = (args: {
  data: { id: string };
  context: { supabase: unknown; userId: string };
}) => Promise<{
  id: string;
  name: string;
  description: string | null;
  html: string;
  is_default: boolean;
  contract_template_id: string | null;
  services: string[];
}>;

describe("duplicateProposalTemplate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolveActiveWorkspace.mockResolvedValue(WS_ID);
    mocks.assertSalesArea.mockResolvedValue(undefined);
    mocks.assertSalesRecord.mockResolvedValue(undefined);
  });

  it("duplicates content, description, services and contract template with numbered copy name", async () => {
    const { sb, calls } = makeCheckedSupabase({
      sourceTemplate: {
        id: TPL_ID,
        name: "Proposta Padrão",
        description: "Descrição comercial",
        html: "<p>Escopo</p>",
        contract_template_id: CT_ID,
      },
      existingNames: ["Proposta Padrão", "Proposta Padrão (cópia)"],
      sourceServices: [SVC_ID],
      contractTemplateFound: true,
    });

    const created = await (duplicateProposalTemplate as unknown as DuplicateHandler)({
      data: { id: TPL_ID },
      context: { supabase: sb, userId: "user-1" },
    });

    expect(mocks.assertSalesArea).toHaveBeenCalledWith(
      sb,
      "techsales.proposal_templates",
      "create",
    );
    expect(mocks.assertSalesRecord).toHaveBeenCalledWith(sb, "proposal_templates", TPL_ID, "view");
    expect(created).toEqual({
      id: COPY_ID,
      name: "Proposta Padrão (cópia 2)",
      description: "Descrição comercial",
      html: "<p>Escopo</p>",
      is_default: false,
      contract_template_id: CT_ID,
      services: [SVC_ID],
    });

    const svcInsert = calls.find(
      (c) => c.table === "proposal_template_services" && c.op === "insert",
    );
    expect(svcInsert?.payload).toEqual([
      { template_id: COPY_ID, service_catalog_id: SVC_ID, workspace_id: WS_ID },
    ]);
  });

  it("rejects duplication when create permission is missing without reading or inserting", async () => {
    mocks.assertSalesArea.mockRejectedValueOnce(new Error("Sem permissão."));
    const { sb, calls } = makeCheckedSupabase();

    await expect(
      (duplicateProposalTemplate as unknown as DuplicateHandler)({
        data: { id: TPL_ID },
        context: { supabase: sb, userId: "user-no-create" },
      }),
    ).rejects.toThrow("Sem permissão.");
    expect(calls).toHaveLength(0);
  });

  it("rejects duplication on explicit deny of create or view", async () => {
    mocks.assertSalesRecord.mockRejectedValueOnce(
      new Error("Registro indisponível ou sem permissão para esta ação."),
    );
    const { sb, calls } = makeCheckedSupabase();

    await expect(
      (duplicateProposalTemplate as unknown as DuplicateHandler)({
        data: { id: TPL_ID },
        context: { supabase: sb, userId: "user-denied" },
      }),
    ).rejects.toThrow("Registro indisponível ou sem permissão para esta ação.");
    expect(calls).toHaveLength(0);
  });

  it("rejects duplication of a template from another workspace", async () => {
    const { sb, calls } = makeCheckedSupabase({ sourceTemplate: null });

    await expect(
      (duplicateProposalTemplate as unknown as DuplicateHandler)({
        data: { id: TPL_ID },
        context: { supabase: sb, userId: "user-other-ws" },
      }),
    ).rejects.toThrow("Modelo de proposta não encontrado neste workspace.");
    expect(calls.some((c) => c.op === "insert")).toBe(false);
  });

  it("rejects duplication for an inactive workspace member", async () => {
    mocks.resolveActiveWorkspace.mockRejectedValueOnce(
      new Error("Membro inativo ou sem workspace ativo."),
    );
    const { sb, calls } = makeCheckedSupabase();

    await expect(
      (duplicateProposalTemplate as unknown as DuplicateHandler)({
        data: { id: TPL_ID },
        context: { supabase: sb, userId: "user-inactive" },
      }),
    ).rejects.toThrow("Membro inativo ou sem workspace ativo.");
    expect(calls).toHaveLength(0);
  });
});
