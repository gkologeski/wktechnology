// Testes do importador Clockify com fixtures locais. Nenhuma chamada real ao Clockify.
import { describe, expect, it } from "vitest";
import {
  ClockifyApiError,
  ClockifyClient,
  minIntervalForPlan,
  type FetchLike,
} from "./clockify-client";
import { assertRegion, buildClockifyUrl, clockifyBases, normalizeSubdomain } from "./clockify-urls";
import {
  accumulate,
  decideRerun,
  emptyTotals,
  markSourceOverlaps,
  planTimeEntry,
  planUserMappings,
  projectMetadata,
  projectStatusFor,
  reconcileByUser,
  snapshotOf,
  type CkTimeEntry,
  type EntryContext,
} from "./clockify-map";
import { parseIsoDuration, segmentByLocalDay, toEpochSeconds } from "./clockify-time";

const KEY = "FAKE_test_key_0123456789abcdef";
const WS = "5f1a2b3c4d5e6f7a8b9c0d1e";
const U1 = "6a1a2b3c4d5e6f7a8b9c0d11";
const U2 = "6a1a2b3c4d5e6f7a8b9c0d22";
const P1 = "7b1a2b3c4d5e6f7a8b9c0d11";

const bases = clockifyBases("global", null);

function fakeFetch(handler: (url: URL, init: RequestInit) => Response) {
  const calls: Array<{ url: string; method: string; headers: Record<string, string> }> = [];
  const f: FetchLike = async (u, init) => {
    calls.push({
      url: u,
      method: init.method ?? "GET",
      headers: init.headers as Record<string, string>,
    });
    return handler(new URL(u), init);
  };
  return { f, calls };
}

const json = (body: unknown, headers: Record<string, string> = {}, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });

const noSleep = async () => {};

function client(
  f: FetchLike,
  extra: Partial<ConstructorParameters<typeof ClockifyClient>[0]> = {},
) {
  return new ClockifyClient({
    apiKey: KEY,
    bases,
    fetch: f,
    sleep: noSleep,
    minIntervalMs: 0,
    ...extra,
  });
}

function ctx(over: Partial<EntryContext> = {}): EntryContext {
  return {
    userTimeZone: () => "America/Sao_Paulo",
    defaultTimeZone: "America/Sao_Paulo",
    userDecision: (id) => (id === U1 ? { target: "erp-user-1", decision: "auto" } : undefined),
    projectDecision: (id) => (id === P1 ? { decision: "create" } : undefined),
    noProjectPolicy: "stage",
    ...over,
  };
}

function entry(start: string, end: string | null, over: Partial<CkTimeEntry> = {}): CkTimeEntry {
  return {
    id: "8c1a2b3c4d5e6f7a8b9c0d11",
    userId: U1,
    projectId: P1,
    billable: true,
    type: "REGULAR",
    timeInterval: { start, end },
    ...over,
  };
}

describe("cliente somente leitura", () => {
  it("pagina pelo cabeçalho Last-Page e para na última página", async () => {
    const { f, calls } = fakeFetch((u) =>
      json([{ id: `${u.searchParams.get("page")}`.padStart(24, "a") }], {
        "last-page": u.searchParams.get("page") === "2" ? "true" : "false",
      }),
    );
    const c = client(f);
    const p1 = await c.page(`/workspaces/${WS}/projects`, 1, 1);
    const p2 = await c.page(`/workspaces/${WS}/projects`, 2, 1);
    expect(p1.lastPage).toBe(false);
    expect(p2.lastPage).toBe(true);
    expect(calls[0].url).toContain("page-size=1");
  });

  it("sem cabeçalho Last-Page, página incompleta encerra", async () => {
    const { f } = fakeFetch(() => json([{ id: "a".repeat(24) }]));
    expect((await client(f).page(`/workspaces/${WS}/clients`, 1, 50)).lastPage).toBe(true);
  });

  it("429 com Retry-After curto: espera e repete", async () => {
    let n = 0;
    const waits: number[] = [];
    const { f } = fakeFetch(() => (n++ === 0 ? json({}, { "retry-after": "2" }, 429) : json([])));
    const c = client(f, { sleep: async (ms) => void waits.push(ms) });
    await c.page(`/workspaces/${WS}/tags`, 1, 50);
    expect(waits).toContain(2000);
    expect(n).toBe(2);
  });

  it("429 com espera longa devolve rate_limited com horário para retomar", async () => {
    const { f } = fakeFetch(() => json({}, { "retry-after": "120" }, 429));
    const c = client(f, { now: () => 1_000_000 });
    const err = await c.page(`/workspaces/${WS}/tags`, 1, 50).catch((e) => e);
    expect(err).toBeInstanceOf(ClockifyApiError);
    expect(err.code).toBe("rate_limited");
    expect(err.retryAt).toBe(1_000_000 + 120_000);
  });

  it("ritmo do plano Free vale entre chamadas (retomada respeita o checkpoint)", async () => {
    const { f, calls } = fakeFetch(() => json([]));
    const c = client(f, {
      minIntervalMs: minIntervalForPlan("FREE"),
      lastRequestAt: 1_000_000,
      now: () => 1_010_000,
    });
    const err = await c.page(`/workspaces/${WS}/tags`, 1, 50).catch((e) => e);
    expect(err.code).toBe("rate_limited");
    expect(calls).toHaveLength(0);
  });

  it("só faz GET, e POST apenas no relatório resumido", async () => {
    const { f, calls } = fakeFetch(() => json({ groupOne: [] }));
    const c = client(f);
    await c.get("/user");
    await c.report(`/workspaces/${WS}/reports/summary`, {});
    expect(calls.map((x) => x.method)).toEqual(["GET", "POST"]);
    expect(calls[1].url.startsWith("https://reports.api.clockify.me/v1/")).toBe(true);
    expect(() => buildClockifyUrl(bases, "api", `/workspaces/${WS}/time-entries`)).toThrow();
    expect(() =>
      buildClockifyUrl(bases, "reports", `/workspaces/${WS}/reports/detailed/export`),
    ).toThrow();
  });

  it("redirecionamento é bloqueado (a chave não segue para outro host)", async () => {
    const { f } = fakeFetch(
      () => new Response(null, { status: 302, headers: { location: "https://evil.example" } }),
    );
    const err = await client(f)
      .get("/user")
      .catch((e) => e);
    expect(err.code).toBe("redirect_blocked");
  });

  it("a chave só vai no cabeçalho e nunca aparece em URL ou erro", async () => {
    const { f, calls } = fakeFetch(() => json({ message: "nope" }, {}, 401));
    const err = await client(f)
      .get("/user")
      .catch((e) => e);
    expect(calls[0].headers["X-Api-Key"]).toBe(KEY);
    expect(calls[0].url).not.toContain(KEY);
    expect(String(err.message)).not.toContain(KEY);
    expect(err.code).toBe("unauthorized");
  });
});

describe("URLs e isolamento", () => {
  it("regiões e subdomínio usam só hosts oficiais", () => {
    expect(clockifyBases("euc1", null).api).toBe("https://euc1.clockify.me/api/v1");
    expect(clockifyBases("global", "acme").reports).toBe("https://acme.clockify.me/report/v1");
    expect(normalizeSubdomain("https://Acme.clockify.me/")).toBe("acme");
  });

  it("recusa subdomínio que tenta outro host e região inventada", () => {
    expect(() => normalizeSubdomain("evil.com/x")).toThrow();
    expect(() => normalizeSubdomain("api")).toThrow();
    expect(() => assertRegion("evil")).toThrow();
  });

  it("recusa IDs externos fora do formato do Clockify (sem injeção no caminho)", () => {
    expect(() => buildClockifyUrl(bases, "api", `/workspaces/${WS}/../admin`)).toThrow();
    expect(() => buildClockifyUrl(bases, "api", "/workspaces/abc/projects")).toThrow();
  });
});

describe("pessoas", () => {
  const members = [
    { user_id: "erp-1", email: "Ana@WK.com", status: "active", name: "Ana" },
    { user_id: "erp-2", email: "bruno@wk.com", status: "inactive", name: "Bruno" },
  ];

  it("vincula por e-mail normalizado, inclusive membro inativo, sem ativar", () => {
    const plans = planUserMappings(
      [
        { id: U1, email: " ana@wk.com ", name: "Ana" },
        { id: U2, email: "bruno@wk.com", name: "Bruno" },
      ],
      members,
      [],
    );
    expect(plans.map((p) => [p.target_id, p.decision])).toEqual([
      ["erp-1", "auto"],
      ["erp-2", "auto"],
    ]);
    expect(plans.every((p) => p.method !== "created")).toBe(true);
  });

  it("pessoa desconhecida fica pendente; nunca cai em quem importa", () => {
    const [p] = planUserMappings([{ id: U1, email: "novo@x.com", name: "Novo" }], members, []);
    expect(p).toMatchObject({ target_id: null, decision: "pending", note: "sem_membro" });
    const plan = planTimeEntry(
      entry("2026-01-05T12:00:00Z", "2026-01-05T13:00:00Z", { userId: U2 }),
      ctx(),
    );
    expect(plan.status).toBe("pending_review");
    expect(plan.reasons).toContain("unmapped_user");
  });

  it("e-mail repetido exige revisão", () => {
    const plans = planUserMappings(
      [
        { id: U1, email: "ana@wk.com" },
        { id: U2, email: "ana@wk.com" },
      ],
      members,
      [],
    );
    expect(plans.every((p) => p.decision === "pending")).toBe(true);
  });

  it("decisão manual é preservada na reexecução", () => {
    const [p] = planUserMappings([{ id: U1, email: "ana@wk.com" }], members, [
      { external_id: U1, target_id: null, decision: "ignore", method: "manual" },
    ]);
    expect(p.decision).toBe("ignore");
  });
});

describe("projetos", () => {
  it("projeto arquivado vira concluído e guarda o arquivamento e o cliente", () => {
    const p = {
      id: P1,
      name: "Antigo",
      archived: true,
      clientId: "9d1a2b3c4d5e6f7a8b9c0d11",
      clientName: "ACME",
    };
    expect(projectStatusFor(p)).toBe("done");
    expect(projectMetadata(p, null).clockify).toMatchObject({
      archived: true,
      client_name: "ACME",
      company_id: null,
    });
  });
});

describe("apontamentos", () => {
  it("preserva segundos exatos", () => {
    const p = planTimeEntry(entry("2026-01-05T12:00:00Z", "2026-01-05T13:02:05Z"), ctx());
    expect(p.status).toBe("ready");
    expect(p.sourceSeconds).toBe(3725);
    expect(p.segments.reduce((a, s) => a + s.seconds, 0)).toBe(3725);
    expect(parseIsoDuration("PT1H2M5S")).toBe(3725);
  });

  it("divide na meia-noite do fuso da pessoa sem mudar o total", () => {
    // 22:30 → 01:15 em São Paulo (UTC-3)
    const p = planTimeEntry(entry("2026-03-10T01:30:00Z", "2026-03-10T04:15:00Z"), ctx());
    expect(p.segments.map((s) => [s.localDate, s.startTime, s.endTime, s.seconds])).toEqual([
      ["2026-03-09", "22:30:00", "24:00:00", 5400],
      ["2026-03-10", "00:00:00", "01:15:00", 4500],
    ]);
    expect(p.importableSeconds).toBe(9900);
  });

  it("DST: segundos reais prevalecem e o trecho é marcado", () => {
    // Nova York, 2024-11-03: 00:30 EDT → 03:00 EST = 3h30 reais, 2h30 no relógio.
    const segs = segmentByLocalDay(
      toEpochSeconds("2024-11-03T04:30:00Z")!,
      toEpochSeconds("2024-11-03T08:00:00Z")!,
      "America/New_York",
    );
    expect(segs).toHaveLength(1);
    expect(segs[0].seconds).toBe(12600);
    expect(segs[0].wallSeconds).toBe(9000);
    expect(segs[0].dstMismatch).toBe(true);
  });

  it("cronômetro aberto fica pendente, sem fim inventado", () => {
    const p = planTimeEntry(entry("2026-01-05T12:00:00Z", null), ctx());
    expect(p).toMatchObject({ status: "pending_review", segments: [], endUtc: null });
    expect(p.reasons).toContain("running_timer");
  });

  it("sem projeto vai para o staging, ou para o projeto de apoio se a política pedir", () => {
    const e = entry("2026-01-05T12:00:00Z", "2026-01-05T13:00:00Z", { projectId: null });
    expect(planTimeEntry(e, ctx()).reasons).toContain("no_project");
    expect(planTimeEntry(e, ctx({ noProjectPolicy: "fallback" })).status).toBe("ready");
  });

  it("pausa e folga não viram horas de projeto", () => {
    const p = planTimeEntry(
      entry("2026-01-05T12:00:00Z", "2026-01-05T13:00:00Z", { type: "BREAK" }),
      ctx(),
    );
    expect(p.status).toBe("unsupported");
  });

  it("trecho menor que 30 s fica no staging e a soma continua batendo", () => {
    // 23:59:45 → 00:10:00 em São Paulo
    const p = planTimeEntry(entry("2026-01-06T02:59:45Z", "2026-01-06T03:10:00Z"), ctx());
    expect(p.segments[0]).toMatchObject({ seconds: 15, tooShort: true });
    expect(p.importableSeconds + p.stagedSeconds).toBe(p.sourceSeconds);
    expect(p.stagedSeconds).toBe(15);
  });

  it("sobreposição dentro do Clockify vai para revisão, sem ajustar horários", () => {
    const a = planTimeEntry(entry("2026-01-05T12:00:00Z", "2026-01-05T14:00:00Z"), ctx());
    const b = planTimeEntry(
      entry("2026-01-05T13:00:00Z", "2026-01-05T15:00:00Z", { id: "8c1a2b3c4d5e6f7a8b9c0d99" }),
      ctx(),
    );
    markSourceOverlaps([a, b]);
    expect(a.status).toBe("ready");
    expect(b.status).toBe("pending_review");
    expect(b.reasons).toContain("overlap_source");
    expect(b.startUtc).toBe(toEpochSeconds("2026-01-05T13:00:00Z"));
  });

  it("moedas diferentes nunca são somadas", () => {
    const t = emptyTotals();
    accumulate(
      t,
      planTimeEntry(
        entry("2026-01-05T12:00:00Z", "2026-01-05T13:00:00Z", {
          hourlyRate: { amount: 10000, currency: "BRL" },
        }),
        ctx(),
      ),
    );
    accumulate(
      t,
      planTimeEntry(
        entry("2026-01-05T14:00:00Z", "2026-01-05T16:00:00Z", {
          hourlyRate: { amount: 5000, currency: "USD" },
        }),
        ctx(),
      ),
    );
    expect(t.earnedByCurrency).toEqual({ BRL: 100, USD: 100 });
  });

  it("totais conciliam: importável + staging = origem; diferenças por pessoa aparecem", () => {
    const t = emptyTotals();
    for (const e of [
      entry("2026-01-05T12:00:00Z", "2026-01-05T13:00:01Z"),
      entry("2026-01-05T14:00:00Z", null),
      entry("2026-01-06T02:59:45Z", "2026-01-06T03:10:00Z"),
    ])
      accumulate(t, planTimeEntry(e, ctx()));
    expect(t.importableSeconds + t.stagedSeconds).toBe(t.sourceSeconds);
    expect(t.sourceSeconds).toBe(3601 + 615);
    expect(reconcileByUser({ [U1]: 4216 }, { [U1]: 4216 })).toEqual([]);
    expect(reconcileByUser({ [U1]: 4216 }, { [U1]: 4200, [U2]: 10 })).toHaveLength(2);
  });
});

describe("reexecução idempotente", () => {
  const row = {
    id: "t1",
    project_id: "p",
    task_id: null,
    user_id: "u",
    entry_date: "2026-01-05",
    start_time: "09:00:00",
    end_time: "10:00:00",
    duration_minutes: 60,
    description: "x",
    billable: true,
    hourly_rate: 100,
    status: "locked",
  };
  const link = {
    segment: 0,
    target_id: "t1",
    source_hash: "h1",
    imported_snapshot: snapshotOf(row),
  };

  it("primeira vez insere; repetir sem mudança não duplica", () => {
    expect(decideRerun([0], "h1", [], new Map())).toEqual({ kind: "insert", segments: [0] });
    expect(decideRerun([0], "h1", [link], new Map([["t1", row]]))).toEqual({ kind: "skip" });
  });

  it("campo mudou no Clockify e o ERP não foi editado: atualiza", () => {
    expect(decideRerun([0], "h2", [link], new Map([["t1", row]]))).toEqual({
      kind: "update",
      segments: [0],
    });
  });

  it("editado no ERP: não sobrescreve", () => {
    const edited = { ...row, description: "ajuste manual" };
    expect(decideRerun([0], "h2", [link], new Map([["t1", edited]]))).toEqual({
      kind: "conflict",
      reason: "manual_edit_conflict",
    });
  });

  it("excluído no ERP: não recria; mudou de dia: revisão", () => {
    expect(decideRerun([0], "h2", [link], new Map())).toEqual({
      kind: "conflict",
      reason: "erp_deleted",
    });
    expect(decideRerun([0, 1], "h2", [link], new Map([["t1", row]]))).toEqual({
      kind: "conflict",
      reason: "segments_changed",
    });
  });

  it("trecho que falhou antes é tentado de novo sem duplicar os outros", () => {
    expect(decideRerun([0, 1], "h1", [link], new Map([["t1", row]]))).toEqual({
      kind: "insert",
      segments: [1],
    });
  });
});
