import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  from: vi.fn(),
  fetch: vi.fn(),
  activeWorkspace: "184b9435-0a9b-4334-9e89-8854dc883f5d",
}));

vi.mock("@tanstack/react-start", () => ({
  createMiddleware: () => {
    let serverFn:
      | ((args: { context: unknown; next: (p: { context: unknown }) => unknown }) => unknown)
      | null = null;
    const mw = {
      middleware: () => mw,
      server: (fn: typeof serverFn) => {
        serverFn = fn;
        return { __run: fn };
      },
    };
    return mw;
  },
  createServerFn: () => {
    const middlewares: Array<{
      __run?: (args: { context: unknown; next: (p: { context: unknown }) => unknown }) => unknown;
    }> = [];
    let validator: ((input: unknown) => unknown) | null = null;
    const builder = {
      middleware: (list: typeof middlewares) => {
        middlewares.push(...list);
        return builder;
      },
      inputValidator: (v: (input: unknown) => unknown) => {
        validator = v;
        return builder;
      },
      handler:
        (fn: (args: { context: unknown; data: unknown }) => Promise<unknown>) =>
        async (input: { context: unknown; data: unknown }) => {
          let ctx = input.context;
          for (const mw of middlewares) {
            if (mw?.__run) {
              let nextCtx = ctx;
              await mw.__run({
                context: ctx,
                next: (p) => {
                  nextCtx = p.context;
                  return p;
                },
              });
              ctx = nextCtx;
            }
          }
          const data = validator ? validator(input.data) : input.data;
          return fn({ context: ctx, data });
        },
    };
    return builder;
  },
}));

vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));

import { lookupPublicCnpj } from "./cnpj-lookup.server";
import { enrichCompanyByCNPJ } from "./brasilapi-cnpj.functions";

const companyId = "bbbbbbbb-2222-4222-8222-222222222222";
const userId = "1c237fbe-079e-4eb9-a3e6-c08d85e79688";

function makeContext() {
  return {
    userId,
    supabase: { rpc: mocks.rpc, from: mocks.from },
  };
}

function invokeEnrich(data: unknown) {
  return (
    enrichCompanyByCNPJ as unknown as (args: {
      context: ReturnType<typeof makeContext>;
      data: unknown;
    }) => Promise<unknown>
  )({ context: makeContext(), data });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.rpc.mockResolvedValue({ data: true, error: null });
  vi.stubGlobal("fetch", mocks.fetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("lookupPublicCnpj", () => {
  it("preenche zero à esquerda para CNPJ válido com 13 dígitos e consulta BrasilAPI com 14 dígitos", async () => {
    mocks.fetch.mockResolvedValueOnce(
      Response.json({
        cnpj: "03938048000133",
        razao_social: "BROOKS AMBIENTAL LTDA",
        municipio: "PALHOCA",
        uf: "SC",
        cep: "88130000",
      }),
    );
    const res = await lookupPublicCnpj("3938048000133");
    expect(res).toMatchObject({
      ok: true,
      data: {
        cnpj: "03938048000133",
        source: "brasilapi",
        razao_social: "BROOKS AMBIENTAL LTDA",
        city: "PALHOCA",
        state: "SC",
        cep: "88130-000",
      },
    });
    expect(mocks.fetch).toHaveBeenCalledWith(
      "https://brasilapi.com.br/api/cnpj/v1/03938048000133",
      expect.objectContaining({ redirect: "manual" }),
    );
  });

  it("recusa CNPJ inválido sem chamar provedores públicos", async () => {
    const res = await lookupPublicCnpj("4500976600017");
    expect(res).toMatchObject({ ok: false, reason: "invalid_cnpj" });
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it("retorna not_found apenas quando BrasilAPI e ReceitaWS confirmam inexistência", async () => {
    mocks.fetch
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
      .mockResolvedValueOnce(Response.json({ status: "ERROR", message: "CNPJ não encontrado" }));
    const res = await lookupPublicCnpj("03938048000133");
    expect(res).toEqual({
      ok: false,
      reason: "not_found",
      message: "CNPJ não encontrado nas bases públicas.",
    });
  });

  it("retorna rate_limited quando há HTTP 429 em qualquer provedor", async () => {
    mocks.fetch
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(new Response(null, { status: 429 }));
    const res = await lookupPublicCnpj("03938048000133");
    expect(res).toMatchObject({ ok: false, reason: "rate_limited" });
    if (!res.ok) {
      expect(res.message).toContain("limite temporário de requisições");
      expect(res.message).not.toContain("não encontrado");
    }
  });

  it("retorna service_unavailable quando BrasilAPI e ReceitaWS estão instáveis ou fora do ar", async () => {
    mocks.fetch
      .mockRejectedValueOnce(new Error("timeout"))
      .mockResolvedValueOnce(new Response(null, { status: 502 }));
    const res = await lookupPublicCnpj("03938048000133");
    expect(res).toMatchObject({ ok: false, reason: "service_unavailable" });
    if (!res.ok) {
      expect(res.message).toContain("temporariamente instável");
      expect(res.message).not.toContain("não encontrado");
    }
  });

  it("usa ReceitaWS como fallback quando BrasilAPI falha temporariamente", async () => {
    mocks.fetch.mockResolvedValueOnce(new Response(null, { status: 503 })).mockResolvedValueOnce(
      Response.json({
        status: "OK",
        nome: "BROOKS AMBIENTAL LTDA",
        municipio: "PALHOCA",
        uf: "SC",
        cep: "88130-000",
      }),
    );
    const res = await lookupPublicCnpj("03.938.048/0001-33");
    expect(res).toMatchObject({
      ok: true,
      data: {
        cnpj: "03938048000133",
        source: "receitaws",
        razao_social: "BROOKS AMBIENTAL LTDA",
      },
    });
  });
});

describe("enrichCompanyByCNPJ authorization and workspace boundaries", () => {
  function makeProfileSelectChain(workspaceId: string | null = mocks.activeWorkspace) {
    return {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: workspaceId ? { active_workspace_id: workspaceId } : null,
        error: null,
      }),
    };
  }

  it("allows authorized active member to enrich and normalizes 13-digit CNPJ", async () => {
    const updatePayloads: unknown[] = [];
    const selectChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          id: companyId,
          cnpj: "3938048000133",
          name: "Brooks",
          legal_name: null,
          trade_name: null,
          industry: null,
          size: null,
          phone: null,
          address: null,
          city: null,
          state: null,
          cep: null,
          domain: null,
        },
        error: null,
      }),
    };
    const updateChain = {
      update: vi.fn((payload: unknown) => {
        updatePayloads.push(payload);
        return updateChain;
      }),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockResolvedValue({ data: [{ id: companyId }], error: null }),
    };
    mocks.from
      .mockReturnValueOnce(makeProfileSelectChain())
      .mockReturnValueOnce(selectChain)
      .mockReturnValueOnce(updateChain);
    mocks.fetch.mockResolvedValueOnce(
      Response.json({
        cnpj: "03938048000133",
        razao_social: "BROOKS AMBIENTAL LTDA",
        municipio: "PALHOCA",
        uf: "SC",
      }),
    );

    const res = await invokeEnrich({ company_id: companyId });
    expect(mocks.rpc).toHaveBeenCalledWith("sales_area_authorize", {
      r: "techsales.prospecting_enrichment",
      a: "manage",
      t: null,
      i: null,
    });
    expect(mocks.rpc).toHaveBeenCalledWith("sales_record_access", {
      t: "companies",
      i: companyId,
      a: "update",
    });
    expect(selectChain.eq).toHaveBeenCalledWith("workspace_id", mocks.activeWorkspace);
    expect(updateChain.eq).toHaveBeenCalledWith("workspace_id", mocks.activeWorkspace);
    expect(updatePayloads[0]).toMatchObject({
      cnpj: "03938048000133",
      legal_name: "BROOKS AMBIENTAL LTDA",
      city: "PALHOCA",
      state: "SC",
    });
    expect("name" in ((updatePayloads[0] as Record<string, unknown>) ?? {})).toBe(false);
    expect(res).toMatchObject({
      ok: true,
      needsConfirmation: false,
      source: "brasilapi",
      cnpj: "03938048000133",
    });
  });

  it("denies missing permission before company query and public CNPJ request", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "missing permission" } });
    await expect(invokeEnrich({ company_id: companyId })).rejects.toThrow("missing permission");
    expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it("denies explicit deny before company query and public CNPJ request", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "explicit deny" } });
    await expect(invokeEnrich({ company_id: companyId })).rejects.toThrow("explicit deny");
    expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it("denies foreign workspace company without calling public CNPJ providers", async () => {
    const selectChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
    mocks.from.mockReturnValueOnce(makeProfileSelectChain()).mockReturnValueOnce(selectChain);
    await expect(invokeEnrich({ company_id: companyId })).rejects.toThrow("Empresa não encontrada");
    expect(selectChain.eq).toHaveBeenCalledWith("workspace_id", mocks.activeWorkspace);
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it("denies inactive member before company query and public CNPJ request", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "inactive member" } });
    await expect(invokeEnrich({ company_id: companyId })).rejects.toThrow("inactive member");
    expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
});
