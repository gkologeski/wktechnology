import { afterEach, describe, expect, it, vi } from "vitest";
import {
  assertMobileCampaignAccess,
  dispatchMobileCampaign,
  reconcileMobileCampaign,
} from "./apollo-mobile-5000.server";
import {
  confirmedMobile,
  isITManager,
  matchIdentity,
  MOBILE_ATTEMPT_LIMIT,
  MOBILE_CREDIT_LIMIT,
  MOBILE_CREDIT_PER_REQUEST,
  staffFloor,
} from "./apollo-mobile-5000";

const mock = vi.hoisted(() => ({
  area: vi.fn(),
  workspace: vi.fn(),
  record: vi.fn(),
  admin: { from: vi.fn(), rpc: vi.fn() },
}));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: mock.admin }));
vi.mock("@/lib/active-workspace.server", () => ({ resolveActiveWorkspace: mock.workspace }));
vi.mock("@/lib/access-control/sales-core.server", () => ({
  assertSalesArea: mock.area,
  assertSalesRecord: mock.record,
}));

const cfg = { APOLLO_MOBILE_5000_WORKSPACE_ID: "wk" };
function fakeDb() {
  const chain = (row: unknown) => {
    const q: Record<string, unknown> = {};
    for (const method of ["eq", "is", "select"]) q[method] = vi.fn(() => q);
    q.maybeSingle = vi.fn(async () => ({ data: row, error: null }));
    return q;
  };
  const company = chain({ id: "company", size: "100–200", domain: "example.org" });
  const contact = chain({
    id: "contact",
    company_id: "company",
    job_title: "Gerente de TI",
    email: "ti@example.org",
    updated_at: "2026-11-27T00:00:00Z",
  });
  const rpc = vi.fn(async (call: string, _args?: unknown) =>
    call === "is_read_only_view"
      ? { data: false, error: null }
      : { data: { workspace_id: "wk", rules: {} }, error: null },
  );
  const from = vi.fn((table) => (table === "contacts" ? contact : company));
  return { contact, company, rpc, from };
}
function gate(db = fakeDb()) {
  return {
    actor: {
      supabase: db as unknown as Parameters<typeof assertMobileCampaignAccess>[0]["supabase"],
      userId: "actor",
    },
    deps: { resolveActiveWorkspace: mock.workspace, assertSalesArea: mock.area, env: cfg },
  };
}
afterEach(() => {
  vi.resetAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("authorization", () => {
  it("permite membro ativo no workspace configurado", async () => {
    mock.workspace.mockResolvedValue("wk");
    const { actor, deps } = gate();
    await expect(assertMobileCampaignAccess(actor, deps)).resolves.toBe("wk");
    expect(mock.area).toHaveBeenCalledWith(
      actor.supabase,
      "techsales.prospecting_enrichment",
      "manage",
    );
  });
  it("nega sem permissão de enriquecimento", async () => {
    mock.workspace.mockResolvedValue("wk");
    mock.area.mockRejectedValue(new Error("missing key"));
    const { actor, deps } = gate();
    await expect(assertMobileCampaignAccess(actor, deps)).rejects.toThrow("missing key");
    expect(actor.supabase.rpc).not.toHaveBeenCalled();
  });
  it("nega deny explícito antes de consultar dados", async () => {
    mock.workspace.mockResolvedValue("wk");
    mock.area.mockRejectedValue(new Error("explicit deny"));
    const { actor, deps } = gate();
    await expect(assertMobileCampaignAccess(actor, deps)).rejects.toThrow("explicit deny");
    expect(mock.admin.from).not.toHaveBeenCalled();
  });
  it("nega outro workspace antes de acessar a operação", async () => {
    mock.workspace.mockResolvedValue("another");
    const { actor, deps } = gate();
    await expect(assertMobileCampaignAccess(actor, deps)).rejects.toThrow("workspace");
    expect(mock.area).not.toHaveBeenCalled();
  });
  it("nega membro inativo sem workspace resolvido", async () => {
    mock.workspace.mockResolvedValue(null);
    const { actor, deps } = gate();
    await expect(assertMobileCampaignAccess(actor, deps)).rejects.toThrow("workspace");
    expect(actor.supabase.rpc).not.toHaveBeenCalled();
  });
  it("nega sessão de visualização sem edição", async () => {
    mock.workspace.mockResolvedValue("wk");
    const db = fakeDb();
    db.rpc.mockResolvedValueOnce({ data: true, error: null });
    const { actor, deps } = gate(db);
    await expect(assertMobileCampaignAccess(actor, deps)).rejects.toThrow("sessão normal");
  });
});

describe("filtering and credits", () => {
  it("faz o pior caso caber sem arredondar para cima", () => {
    expect(MOBILE_ATTEMPT_LIMIT * MOBILE_CREDIT_PER_REQUEST).toBe(4_995);
    expect((MOBILE_ATTEMPT_LIMIT + 1) * MOBILE_CREDIT_PER_REQUEST).toBeGreaterThan(
      MOBILE_CREDIT_LIMIT,
    );
  });
  it("aceita somente faixa com piso comprovável", () => {
    expect(
      [
        "100",
        "101-200",
        "1.001 a 5.000 funcionários",
        "10,000+",
        "50–200",
        "Grande",
        "200–100",
      ].map(staffFloor),
    ).toEqual([100, 101, 1001, 10000, 50, null, null]);
  });
  it("exige liderança e função de TI, não apenas título técnico", () => {
    expect(
      [
        "CTO",
        "Gerente de Tecnologia da Informação",
        "Head of Software Engineering",
        "Assistente do CTO",
        "Analista de TI",
        "Gerente Comercial",
      ].map(isITManager),
    ).toEqual([true, true, true, false, false, false]);
  });
  it("usa identificador forte de perfil ou e-mail corporativo", () => {
    const org = { domain: "example.org", website: null };
    expect(matchIdentity({ linkedin_url: null, email: "TI@example.org" }, org)).toEqual({
      email: "ti@example.org",
    });
    expect(matchIdentity({ linkedin_url: null, email: "person@example.net" }, org)).toBeNull();
    expect(matchIdentity({ linkedin_url: "linkedin.com/in/pessoa", email: null }, org)).toEqual({
      linkedin_url: "https://www.linkedin.com/in/pessoa",
    });
  });
  it("ignora fixo e celular ambíguo", () => {
    const mobile = { type: "mobile", sanitized_number: "+5548991234567" };
    expect(
      confirmedMobile([mobile, { type: "work_direct", sanitized_number: "+554832123456" }]),
    ).toBe(mobile.sanitized_number);
    expect(
      confirmedMobile([{ type: "work_direct", sanitized_number: "+554832123456" }]),
    ).toBeNull();
    expect(
      confirmedMobile([mobile, { type: "mobile", sanitized_number: "+5548991234568" }]),
    ).toBeNull();
  });
});

function prepare(db = fakeDb()) {
  mock.workspace.mockResolvedValue("wk");
  vi.stubEnv("APOLLO_MOBILE_5000_WORKSPACE_ID", "wk");
  vi.stubEnv("APOLLO_MOBILE_5000_DIRECT_KEY", "fake-not-a-credential");
  vi.stubEnv("APOLLO_MOBILE_5000_VERIFIED_UNIT_MAX", "9");
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  return { db, fetch, actor: gate(db).actor };
}
it("não chama Apollo sem tarifa validada", async () => {
  const { actor, fetch } = prepare();
  vi.stubEnv("APOLLO_MOBILE_5000_VERIFIED_UNIT_MAX", "10");
  await expect(dispatchMobileCampaign(actor, "contact")).rejects.toThrow("Valide o plano");
  expect(mock.admin.rpc).not.toHaveBeenCalled();
  expect(fetch).not.toHaveBeenCalled();
});
it("não chama Apollo se a reserva não foi obtida", async () => {
  const { actor, fetch } = prepare();
  mock.admin.rpc.mockResolvedValue({ data: null, error: null });
  await expect(dispatchMobileCampaign(actor, "contact")).resolves.toBe("skipped");
  expect(mock.admin.rpc).toHaveBeenCalledOnce();
  expect(fetch).not.toHaveBeenCalled();
});
it("bloqueia campo protegido antes de consumir um slot", async () => {
  const { actor, db, fetch } = prepare();
  db.rpc.mockImplementation(async (call) =>
    call === "is_read_only_view"
      ? { data: false, error: null }
      : {
          data: {
            workspace_id: "wk",
            rules: { "techsales.contacts": { mobile_phone: "readonly" } },
          },
          error: null,
        },
  );
  await expect(dispatchMobileCampaign(actor, "contact")).resolves.toBe("skipped");
  expect(fetch).not.toHaveBeenCalled();
  expect(mock.admin.rpc).not.toHaveBeenCalled();
});
it("reserva antes de enviar somente a consulta padrão, sem repetição em falha", async () => {
  const { actor, fetch } = prepare();
  mock.admin.rpc.mockResolvedValue({ data: 1, error: null });
  const row = { update: vi.fn(), eq: vi.fn() };
  row.update.mockReturnValue(row);
  row.eq.mockReturnValue(row);
  mock.admin.from.mockReturnValue(row);
  fetch.mockRejectedValue(new Error("timeout"));
  await expect(dispatchMobileCampaign(actor, "contact")).rejects.toThrow("Lote pausado");
  expect(mock.admin.rpc.mock.invocationCallOrder[0]).toBeLessThan(
    fetch.mock.invocationCallOrder[0],
  );
  expect(fetch).toHaveBeenCalledOnce();
  expect(JSON.parse(fetch.mock.calls[0][1].body)).toMatchObject({
    email: "ti@example.org",
    reveal_phone_number: true,
    poll_only: true,
    reveal_personal_emails: false,
    run_waterfall_phone: false,
    run_waterfall_email: false,
  });
  expect(row.update).toHaveBeenCalledWith({ status: "uncertain" });
});
it("não faz enriquecimento pago ao recuperar tentativa que não está pendente", async () => {
  const { actor, fetch } = prepare();
  const q = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue({ data: { status: "updated" }, error: null }),
  };
  q.select.mockReturnValue(q);
  q.eq.mockReturnValue(q);
  mock.admin.from.mockReturnValue(q);
  await expect(reconcileMobileCampaign(actor, "contact")).resolves.toBe("skipped");
  expect(fetch).not.toHaveBeenCalled();
});

it("recupera pelo id exato e só grava celular no contato vazio", async () => {
  const { actor, db, fetch } = prepare();
  const { createHash } = await import("node:crypto");
  const hash = createHash("sha256")
    .update(JSON.stringify({ email: "ti@example.org" }))
    .digest("hex");
  const q = {
    select: vi.fn(),
    eq: vi.fn(),
    update: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue({
      data: { status: "pending", request_id: "5501", person_id: "person" },
      error: null,
    }),
    single: vi.fn().mockResolvedValue({ data: { identity_hash: hash }, error: null }),
  };
  q.select.mockReturnValue(q);
  q.eq.mockReturnValue(q);
  q.update.mockReturnValue(q);
  mock.admin.from.mockReturnValue(q);
  db.rpc.mockImplementation(async (call) =>
    call === "is_read_only_view"
      ? { data: false, error: null }
      : call === "apply_apollo_mobile_5000"
        ? { data: true, error: null }
        : { data: { workspace_id: "wk", rules: {} }, error: null },
  );
  fetch.mockResolvedValue(
    new Response(
      JSON.stringify({
        request_id: "5501",
        request_type: "phone",
        webhook_status: "skipped",
        webhook_result: {
          people: [
            {
              id: "person",
              phone_numbers: [{ type: "mobile", sanitized_number: "+5548991234567" }],
            },
          ],
        },
      }),
    ),
  );
  await expect(reconcileMobileCampaign(actor, "contact")).resolves.toBe("updated");
  expect(db.rpc).toHaveBeenCalledWith("apply_apollo_mobile_5000", {
    c: "contact",
    w: "wk",
    seen_at: "2026-11-27T00:00:00Z",
    mobile: "+5548991234567",
    expected_request: "5501",
  });
  expect(fetch.mock.calls[0][1].method).toBe("GET");
  expect(q.update).not.toHaveBeenCalled();
});

it("não grava quando a identidade mudou após o envio", async () => {
  const { actor, fetch } = prepare();
  const q = {
    select: vi.fn(),
    eq: vi.fn(),
    update: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue({
      data: { status: "pending", request_id: "5501", person_id: "person" },
      error: null,
    }),
    single: vi
      .fn()
      .mockResolvedValue({ data: { identity_hash: "identidade antiga" }, error: null }),
  };
  q.select.mockReturnValue(q);
  q.eq.mockReturnValue(q);
  q.update.mockReturnValue(q);
  mock.admin.from.mockReturnValue(q);
  await expect(reconcileMobileCampaign(actor, "contact")).resolves.toBe("skipped");
  expect(fetch).not.toHaveBeenCalled();
});
