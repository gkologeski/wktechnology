// Fluxo completo do motor com fixture do Clockify e banco em memória:
// prévia → confirmação → importação → reexecução (sem duplicar) → mudança na origem → edição no ERP.
import { describe, expect, it } from "vitest";
import { ClockifyEngine } from "./clockify-engine.server";
import { FakeDb, uuid } from "./clockify-fake-db.test-utils";
import type { FetchLike } from "./clockify-client";

const TARGET_WS = "11111111-1111-4111-8111-111111111111";
const OTHER_WS = "22222222-2222-4222-8222-222222222222";
const SRC = "5f1a2b3c4d5e6f7a8b9c0d1e";
const U1 = "6a1a2b3c4d5e6f7a8b9c0d11"; // Ana (membro ativo)
const U2 = "6a1a2b3c4d5e6f7a8b9c0d22"; // desconhecida no ERP
const U3 = "6a1a2b3c4d5e6f7a8b9c0d33"; // usuária limitada
const P1 = "7b1a2b3c4d5e6f7a8b9c0d11";
const P2 = "7b1a2b3c4d5e6f7a8b9c0d22"; // arquivado
const T1 = "7c1a2b3c4d5e6f7a8b9c0d11";
const C1 = "9d1a2b3c4d5e6f7a8b9c0d11";
const E1 = "8c1a2b3c4d5e6f7a8b9c0d01";
const E2 = "8c1a2b3c4d5e6f7a8b9c0d02";
const E3 = "8c1a2b3c4d5e6f7a8b9c0d03";
const E4 = "8c1a2b3c4d5e6f7a8b9c0d04";
const IMPORTER = "33333333-3333-4333-8333-333333333333";
const ANA = "44444444-4444-4444-8444-444444444444";

const entries: Record<string, unknown[][]> = {
  [U1]: [
    [
      {
        id: E1,
        userId: U1,
        projectId: P1,
        taskId: T1,
        description: "Reunião",
        billable: true,
        type: "REGULAR",
        hourlyRate: { amount: 15000, currency: "BRL" },
        timeInterval: { start: "2026-01-05T12:00:00Z", end: "2026-01-05T13:02:05Z" },
      },
      {
        id: E2,
        userId: U1,
        projectId: P2,
        description: "Virada",
        billable: false,
        type: "REGULAR",
        hourlyRate: { amount: 2000, currency: "USD" },
        timeInterval: { start: "2026-01-06T01:30:00Z", end: "2026-01-06T04:15:00Z" },
      },
    ],
    [
      {
        id: E3,
        userId: U1,
        projectId: P1,
        description: "Rodando",
        type: "REGULAR",
        timeInterval: { start: "2026-01-07T12:00:00Z", end: null },
      },
    ],
  ],
  [U2]: [
    [
      {
        id: E4,
        userId: U2,
        projectId: P1,
        description: "Sem vínculo",
        type: "REGULAR",
        timeInterval: { start: "2026-01-05T12:00:00Z", end: "2026-01-05T12:30:00Z" },
      },
    ],
  ],
  [U3]: [[]],
};

function fixtureFetch(opts: { first429?: boolean } = {}) {
  let sent429 = !opts.first429;
  const methods: string[] = [];
  const f: FetchLike = async (raw, init) => {
    methods.push(init.method ?? "GET");
    const u = new URL(raw);
    const p = u.pathname.replace(/^\/(api|report)?\/?v1/, "").replace(/^\/v1/, "");
    const ok = (body: unknown, last = true) =>
      new Response(JSON.stringify(body), { status: 200, headers: { "last-page": String(last) } });
    if (!sent429) {
      sent429 = true;
      return new Response("{}", { status: 429, headers: { "retry-after": "60" } });
    }
    if (p === `/workspaces/${SRC}`)
      return ok({ id: SRC, name: "Origem", featureSubscriptionType: "ENTERPRISE" });
    if (p === `/workspaces/${SRC}/users`) {
      return u.searchParams.get("account-statuses") === "LIMITED"
        ? ok([{ id: U3, email: "limitada@wk.com", name: "Limitada", status: "ACTIVE" }])
        : ok([
            {
              id: U1,
              email: "ANA@wk.com",
              name: "Ana",
              status: "ACTIVE",
              settings: { timeZone: "America/Sao_Paulo" },
            },
            { id: U2, email: "fantasma@fora.com", name: "Fantasma", status: "INACTIVE" },
          ]);
    }
    if (p === `/workspaces/${SRC}/user-groups`) return new Response("{}", { status: 403 });
    if (p === `/workspaces/${SRC}/clients`) return ok([{ id: C1, name: "ACME" }]);
    if (p === `/workspaces/${SRC}/projects`) {
      return u.searchParams.get("archived") === "true"
        ? ok([{ id: P2, name: "Antigo", archived: true }])
        : ok([
            {
              id: P1,
              name: "Portal",
              clientId: C1,
              clientName: "ACME",
              memberships: [{ userId: U1, hourlyRate: { amount: 15000, currency: "BRL" } }],
            },
            { id: P2, name: "Antigo", archived: true },
          ]);
    }
    if (p === `/workspaces/${SRC}/projects/${P1}/tasks`)
      return ok([{ id: T1, name: "Design", projectId: P1, status: "DONE" }]);
    if (p === `/workspaces/${SRC}/projects/${P2}/tasks`) return ok([]);
    if (p === `/workspaces/${SRC}/custom-fields`) return new Response("{}", { status: 404 });
    if (p === `/workspaces/${SRC}/expenses`) return ok({ expenses: { count: 0, expenses: [] } });
    if (p === `/workspaces/${SRC}/invoices`) return ok({ invoices: [], total: 0 });
    const te = p.match(/^\/workspaces\/[0-9a-f]+\/user\/([0-9a-f]+)\/time-entries$/);
    if (te) {
      const pages = entries[te[1]] ?? [[]];
      const n = Number(u.searchParams.get("page") ?? 1);
      return ok(pages[n - 1] ?? [], n >= pages.length);
    }
    if (p.endsWith("/time-entries/status/in-progress")) return ok([entries[U1][1][0]]);
    if (p.endsWith("/reports/summary"))
      return ok({
        groupOne: [
          { _id: U1, duration: 3725 + 9900 },
          { _id: U2, duration: 1800 },
        ],
      });
    return ok([]);
  };
  return { f, methods };
}

function setup() {
  const db = new FakeDb();
  db.tables.workspace_members = [
    { workspace_id: TARGET_WS, user_id: ANA, status: "active" },
    { workspace_id: OTHER_WS, user_id: "55555555-5555-4555-8555-555555555555", status: "active" },
  ];
  db.tables.profiles = [{ id: ANA, full_name: "Ana" }];
  db.tables.projects = [{ id: uuid(), workspace_id: TARGET_WS, name: "Portal" }];
  db.tables.companies = [{ id: uuid(), workspace_id: TARGET_WS, name: "ACME" }];
  return db;
}

function newRun(db: FakeDb, kind: "dry_run" | "import", options: Record<string, unknown> = {}) {
  const run = {
    id: uuid(),
    workspace_id: TARGET_WS,
    source_workspace_id: SRC,
    kind,
    status: "queued",
    phase: "start",
    checkpoint: {},
    options,
    counts: {},
    requested_by: IMPORTER,
    preview_run_id: null,
  };
  (db.tables.clockify_import_runs ??= []).push(run);
  return run;
}

async function drive(db: FakeDb, runId: string, fetch: FetchLike, clock: { t: number }, max = 20) {
  for (let i = 0; i < max; i++) {
    const run = db.tables.clockify_import_runs.find((r) => r.id === runId)!;
    if (["completed", "failed", "cancelled"].includes(run.status)) return run;
    const engine = new ClockifyEngine({
      db: db as never,
      apiKey: "FAKE_test_key_0123456789abcdef",
      region: "global",
      subdomain: null,
      plan: "ENTERPRISE",
      fetch,
      now: () => clock.t,
      sleep: async () => {},
      memberEmails: async () => new Map([[ANA, "ana@wk.com"]]),
    });
    await engine.advance(structuredClone(run) as never);
  }
  return db.tables.clockify_import_runs.find((r) => r.id === runId)!;
}

describe("motor Clockify ponta a ponta (fixture)", () => {
  it("prévia, importação, reexecução, mudança na origem e edição no ERP", async () => {
    const db = setup();
    const clock = { t: 1_800_000_000_000 };
    const { f, methods } = fixtureFetch({ first429: true });

    // 429 longo: a execução guarda o horário e não avança antes dele (retomada).
    const dry = newRun(db, "dry_run");
    await drive(db, dry.id, f, clock, 1);
    const paused = db.tables.clockify_import_runs.find((r) => r.id === dry.id)!;
    expect(paused.status).toBe("running");
    expect(paused.checkpoint.waitUntil).toBe(clock.t + 60_000);
    await drive(db, dry.id, f, clock, 1);
    expect(db.tables.clockify_import_runs.find((r) => r.id === dry.id)!.phase).toBe("workspace");
    clock.t += 61_000;
    const done = await drive(db, dry.id, f, clock);
    expect(done.status).toBe("completed");

    // Somente leitura: GET em tudo, POST apenas no relatório resumido.
    expect(new Set(methods)).toEqual(new Set(["GET", "POST"]));
    expect(methods.filter((m) => m === "POST")).toHaveLength(1);

    const report = done.report;
    expect(report.capabilities.group.status).toBe("forbidden");
    expect(report.capabilities.custom_field.status).toBe("not_available");
    expect(report.capabilities.user.count).toBe(3);
    expect(report.capabilities.project.count).toBe(2);
    // Segundos: E1 3725 + E2 9900 + E4 1800 = 15425; timer aberto fica fora do total.
    expect(report.totals.sourceSeconds).toBe(15425);
    expect(report.totals.importableSeconds).toBe(13625);
    expect(report.totals.importableSeconds + report.totals.stagedSeconds).toBe(
      report.totals.sourceSeconds,
    );
    expect(report.totals.byReason.running_timer.entries).toBe(1);
    expect(report.totals.byReason.unmapped_user.seconds).toBe(1800);
    expect(report.totals.earnedByCurrency).toEqual({ BRL: 155.21, USD: 55 });
    expect(report.reconciliation).toEqual({ status: "ok", diffs: [] });
    expect(report.preview.segmentsToInsert).toBe(3); // E1 + E2 dividido na meia-noite

    // Mapeamentos: e-mail normalizado; desconhecida pendente; cliente e projeto homônimos só sugeridos.
    const maps = db.tables.clockify_mappings;
    expect(maps.find((m) => m.external_id === U1)).toMatchObject({
      target_id: ANA,
      decision: "auto",
    });
    expect(maps.find((m) => m.external_id === U2)).toMatchObject({
      target_id: null,
      decision: "pending",
    });
    expect(maps.find((m) => m.external_id === C1)).toMatchObject({
      target_id: null,
      decision: "pending",
    });
    expect(maps.find((m) => m.external_id === C1)!.candidates).toHaveLength(1);
    expect(maps.find((m) => m.external_id === P1)).toMatchObject({
      target_id: null,
      decision: "create",
    });
    // Nada foi gravado no ERP pela prévia.
    expect(db.tables.project_time_entries ?? []).toHaveLength(0);
    expect(db.tables.projects).toHaveLength(1);

    // Importação a partir da prévia.
    const imp = newRun(db, "import", { refetch: false });
    const impDone = await drive(db, imp.id, f, clock);
    expect(impDone.status).toBe("completed");
    const it = impDone.report.import;
    expect(it).toMatchObject({
      inserted: 3,
      failed: 0,
      projectsCreated: 2,
      tasksCreated: 1,
      membersAdded: 1,
      secondsImported: 13625,
    });
    expect(it.byUser[U1]).toBe(13625);
    const rows = db.tables.project_time_entries;
    expect(rows).toHaveLength(3);
    expect(
      rows.every(
        (r) => r.user_id === ANA && r.created_by === IMPORTER && r.workspace_id === TARGET_WS,
      ),
    ).toBe(true);
    const virada = rows
      .filter((r) => r.external_id.startsWith(`clockify:${E2}`))
      .map((r) => [r.entry_date, r.start_time, r.end_time]);
    expect(virada).toEqual([
      ["2026-01-05", "22:30:00", "24:00:00"],
      ["2026-01-06", "00:00:00", "01:15:00"],
    ]);
    expect(rows.find((r) => r.external_id === `clockify:${E2}:0`)!.hourly_rate).toBeNull(); // USD ≠ BRL
    const archived = db.tables.projects.find((p) => p.name === "Antigo")!;
    expect(archived.status).toBe("done");
    expect(archived.metadata.clockify.archived).toBe(true);
    expect(db.tables.clockify_staging_records.find((s) => s.external_id === E3)!.status).toBe(
      "pending_review",
    );

    // Reexecução: não duplica.
    const again = await drive(db, newRun(db, "import", { refetch: false }).id, f, clock);
    expect(again.report.import).toMatchObject({
      inserted: 0,
      updated: 0,
      unchanged: 2,
      projectsCreated: 0,
      tasksCreated: 0,
    });
    expect(db.tables.project_time_entries).toHaveLength(3);
    expect(db.tables.projects).toHaveLength(3);

    // Campo mudou no Clockify (descrição): atualiza o trecho sem duplicar.
    const st = db.tables.clockify_staging_records.find((s) => s.external_id === E1)!;
    st.payload.description = "Reunião (editada no Clockify)";
    st.payload_hash = "novo-hash";
    const upd = await drive(db, newRun(db, "import", { refetch: false }).id, f, clock);
    expect(upd.report.import).toMatchObject({ updated: 1, inserted: 0 });
    expect(rows.find((r) => r.external_id === `clockify:${E1}:0`)!.description).toBe(
      "Reunião (editada no Clockify)",
    );

    // Edição manual no ERP: nova mudança na origem não sobrescreve.
    rows.find((r) => r.external_id === `clockify:${E1}:0`)!.description = "Ajuste do gestor";
    st.payload_hash = "outro-hash";
    const conflict = await drive(db, newRun(db, "import", { refetch: false }).id, f, clock);
    expect(conflict.report.import.conflicts).toEqual({ manual_edit_conflict: 1 });
    expect(rows.find((r) => r.external_id === `clockify:${E1}:0`)!.description).toBe(
      "Ajuste do gestor",
    );

    // Outro workspace intacto.
    expect((db.tables.project_time_entries ?? []).some((r) => r.workspace_id === OTHER_WS)).toBe(
      false,
    );
  });

  it("sobreposição com hora já lançada no ERP fica para revisão, sem desligar a validação", async () => {
    const db = setup();
    db.tables.project_time_entries = [
      {
        id: uuid(),
        workspace_id: TARGET_WS,
        user_id: ANA,
        entry_date: "2026-01-05",
        start_time: "09:30:00",
        end_time: "09:45:00",
        source: "manual",
      },
    ];
    const clock = { t: 1_800_000_000_000 };
    const { f } = fixtureFetch();
    const dry = await drive(db, newRun(db, "dry_run").id, f, clock);
    expect(dry.report.preview.overlapExisting).toBe(1);
    expect(db.tables.clockify_staging_records.find((s) => s.external_id === E1)).toMatchObject({
      status: "pending_review",
      reason_code: "overlap_existing",
    });
    const imp = await drive(db, newRun(db, "import", { refetch: false }).id, f, clock);
    expect(imp.report.import.failed).toBe(1);
    expect(db.tables.project_time_entries.filter((r) => r.source === "manual")).toHaveLength(1);
  });

  it("cancelamento pedido para no lote atual e marca como cancelada", async () => {
    const db = setup();
    const clock = { t: 1_800_000_000_000 };
    const { f } = fixtureFetch();
    const run = newRun(db, "dry_run");
    run.status = "cancel_requested";
    const out = await drive(db, run.id, f, clock, 2);
    expect(out.status).toBe("cancelled");
    expect(db.tables.clockify_staging_records ?? []).toHaveLength(0);
  });
});
