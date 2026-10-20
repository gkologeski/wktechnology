import { describe, expect, it } from "vitest";
import { JibbleClient } from "./jibble-client";
import { JibbleEngine } from "./jibble-engine.server";
import { MemoryStore } from "./jibble-memory-store.test-utils";
import type { RunRow } from "./jibble-store";

const ORG = "0a000000-0000-4000-8000-000000000001";
const ANA = "1a000000-0000-4000-8000-000000000001";
const BIA = "1a000000-0000-4000-8000-000000000002";
const CAIO = "1a000000-0000-4000-8000-000000000003";
const PR1 = "2a000000-0000-4000-8000-000000000001";
const PR2 = "2a000000-0000-4000-8000-000000000002";
const ACT = "3a000000-0000-4000-8000-000000000001";

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });

const te = (
  id: string,
  personId: string,
  type: string,
  time: string,
  extra: Record<string, unknown> = {},
) => ({
  id,
  personId,
  type,
  time,
  localTime: time.replace("Z", "+00:00"),
  belongsToDate: time.slice(0, 10),
  projectId: type === "In" ? PR1 : null,
  activityId: type === "In" ? ACT : null,
  note: type === "In" ? "trabalho" : null,
  ...extra,
});

function fakeJibble() {
  let throttled = false;
  const calls: string[] = [];
  const f = async (url: string) => {
    calls.push(url);
    if (url.includes("connect/token"))
      return json({ access_token: "t", expires_in: 3600, organizationId: ORG });
    const u = new URL(url);
    const p = u.pathname;
    if (p === "/v1/Organizations")
      return json({
        value: [
          {
            id: ORG,
            name: "WK",
            createdAt: "2024-05-20T10:00:00Z",
            "ICultureSettings/TimeZone": "UTC",
          },
        ],
      });
    if (p === "/v1/People") {
      if (u.searchParams.get("$skip") === "1")
        return json({
          value: [
            { id: BIA, email: "bia@wk.com", fullName: "Bia" },
            { id: CAIO, email: "caio@wk.com", fullName: "Caio", status: "Archived" },
          ],
        });
      return json({
        value: [{ id: ANA, email: "ana@wk.com", fullName: "Ana", timeZone: "UTC" }],
        "@odata.nextLink": "https://workspace.prod.jibble.io/v1/People?$skip=1",
      });
    }
    if (p === "/v1/Projects")
      return json({
        value: [
          { id: PR1, name: "Projeto A", status: "Active" },
          { id: PR2, name: "Velho", status: "Archived" },
        ],
      });
    if (p === "/v1/Activities") return json({ value: [{ id: ACT, name: "Desenvolvimento" }] });
    if (p === "/v1/CalendarDays") return json({ error: "filter required" }, 400);
    if (p === "/v1/TimeOffOverview") return json({}, 404);
    if (p === "/v1/Screenshots") return json({}, 403);
    if (p === "/v1/TimeEntries") {
      if (!(u.searchParams.get("$filter") ?? "").includes("ge 2024-06-01"))
        return json({ value: [] });
      if (!throttled) {
        throttled = true;
        return json({}, 429, { "retry-after": "600" });
      }
      return json({
        value: [
          te("4a000000-0000-4000-8000-000000000001", ANA, "In", "2024-06-13T08:00:00Z"),
          te("4a000000-0000-4000-8000-000000000002", ANA, "Out", "2024-06-13T12:00:00Z"),
          te("4a000000-0000-4000-8000-000000000003", ANA, "In", "2024-06-20T08:00:00Z"),
          te("4a000000-0000-4000-8000-000000000004", BIA, "In", "2024-06-14T08:00:00Z"),
          te("4a000000-0000-4000-8000-000000000005", BIA, "Out", "2024-06-14T09:00:00Z"),
          te("4a000000-0000-4000-8000-000000000006", CAIO, "In", "2024-06-13T09:00:00Z"),
          te("4a000000-0000-4000-8000-000000000007", CAIO, "Out", "2024-06-13T10:00:00Z"),
          te("4a000000-0000-4000-8000-000000000008", CAIO, "Out", "2024-06-13T11:00:00Z"),
        ],
      });
    }
    if (p === "/v1/TimesheetsSummary") {
      if (u.searchParams.get("date") !== "2024-06-01") return json({ value: [] });
      return json({ value: [{ personId: ANA, daily: [{ date: "2024-06-13", tracked: "PT4H" }] }] });
    }
    return json({ value: [] });
  };
  return { f, calls };
}

function setup() {
  const store = new MemoryStore(
    [
      { user_id: "u1", email: "ana@wk.com", status: "active", name: "Ana" },
      { user_id: "u2", email: "caio@wk.com", status: "inactive", name: "Caio" },
    ],
    { client: [], project: [{ id: "p-existente", name: "projeto a" }] },
  );
  // Apontamento já importado do Clockify: mesma pessoa e mesmo intervalo do Caio.
  store.erp.push({
    id: "ck-1",
    table: "project_time_entries",
    user_id: "u2",
    source: "import",
    external_id: "clockify:abc:0",
    project_id: "p-existente",
    started_at: "2024-06-13T09:00:00Z",
    stopped_at: "2024-06-13T10:00:00Z",
  });
  const api = fakeJibble();
  let clock = Date.parse("2024-07-01T00:00:00Z");
  const now = () => (clock += 1);
  const client = new JibbleClient({
    credentials: { clientId: "client-id-1", clientSecret: "secret-1234" },
    fetch: api.f,
    sleep: async () => {},
    minIntervalMs: 0,
    now,
  });
  const engine = () =>
    new JibbleEngine({ store, client, now, budgetMs: 1_000_000, today: "2024-06-30" });
  const newRun = (kind: RunRow["kind"], extra: Partial<RunRow> = {}): RunRow => {
    const r: RunRow = {
      id: `run-${store.runs.size + 1}`,
      workspace_id: "ws",
      source_org_id: ORG,
      kind,
      status: "queued",
      phase: "start",
      checkpoint: {},
      options: {},
      counts: {},
      report: null,
      requested_by: "admin",
      target_run_id: null,
      ...extra,
    };
    store.runs.set(r.id, r);
    return r;
  };
  const drive = async (run: RunRow) => {
    for (let i = 0; i < 20; i++) {
      const cur = store.runs.get(run.id)!;
      if (["completed", "failed", "cancelled"].includes(cur.status)) break;
      await engine().advance(cur);
      clock += 11 * 60_000; // passa o horário de retomada após 429
    }
    return store.runs.get(run.id)!;
  };
  return { store, api, newRun, drive };
}

describe("motor do importador Jibble", () => {
  it("prévia completa, importação, idempotência, duplicidade entre fontes e desfazer", async () => {
    const { store, api, newRun, drive } = setup();

    // 1) Prévia com leitura integral, paginação por nextLink e retomada após 429.
    const dry = await drive(newRun("dry_run"));
    expect(dry.status).toBe("completed");
    const inv = (dry.report as { inventory: Record<string, { count: number; capability: string }> })
      .inventory;
    expect(inv.person.count).toBe(3);
    expect(inv.project.count).toBe(2);
    expect(inv.time_entry.count).toBe(8);
    expect(inv.calendar_day.capability).toBe("rejected");
    expect(inv.screenshot.capability).toBe("unavailable");
    expect(api.calls.filter((c) => c.includes("/v1/People")).some((c) => c.includes("role"))).toBe(
      false,
    );
    expect(api.calls.filter((c) => c.includes("TimeEntries")).length).toBeGreaterThanOrEqual(3);

    // Pessoas: e-mail único casa (inclusive inativo); sem membro fica pendente.
    const pm = (await store.loadMappings("person")).reduce<Record<string, string>>(
      (a, m) => ({ ...a, [m.external_id]: `${m.decision}:${m.target_id}` }),
      {},
    );
    expect(pm[ANA.toLowerCase()]).toBe("auto:u1");
    expect(pm[CAIO.toLowerCase()]).toBe("auto:u2");
    expect(pm[BIA.toLowerCase()]).toBe("pending:null");
    // Projeto com nome igual é só sugestão.
    const proj = (await store.loadMappings("project")).find(
      (m) => m.external_id === PR1.toLowerCase(),
    )!;
    expect(proj.decision).toBe("pending");
    expect(proj.candidates).toEqual([{ id: "p-existente", name: "projeto a" }]);
    // Saída órfã do Caio vira anomalia visível.
    expect(store.staging.get(`time_entry|4a000000-0000-4000-8000-000000000008`)!.reason_code).toBe(
      "orphan_out",
    );

    // 2) Admin decide criar o projeto e recalcula sem nova leitura da API.
    proj.decision = "create";
    const before = api.calls.length;
    const recalc = await drive(newRun("dry_run", { checkpoint: { skipFetch: true } }));
    expect(recalc.status).toBe("completed");
    expect(api.calls.length - before).toBeLessThanOrEqual(1); // no máximo o token
    const iv = (id: string) => store.staging.get(`interval|${id}`)!;
    expect(iv("4a000000-0000-4000-8000-000000000001")).toMatchObject({ status: "ready" });
    expect(iv("4a000000-0000-4000-8000-000000000003")).toMatchObject({
      status: "staged",
      reason_code: "open_interval",
    });
    expect(iv("4a000000-0000-4000-8000-000000000004")).toMatchObject({
      reason_code: "unmapped_person",
    });
    expect(iv("4a000000-0000-4000-8000-000000000006")).toMatchObject({
      reason_code: "cross_source_duplicate",
    });
    expect(store.duplicates).toHaveLength(1);
    expect(store.duplicates[0]).toMatchObject({
      existing_entry_id: "ck-1",
      existing_source: "clockify",
      kind: "exact",
    });
    const rc = (recalc.report as { reconcile: { matchedDays: number; divergentDays: number } })
      .reconcile;
    expect(rc).toMatchObject({ matchedDays: 1, divergentDays: 0 });

    // 3) Importação: cria projeto e tarefa, grava só o que está liberado.
    const imp = await drive(newRun("import"));
    expect(imp.status).toBe("completed");
    const entries = () => store.erp.filter((e) => e.table === "project_time_entries");
    expect(
      entries()
        .map((e) => e.external_id)
        .sort(),
    ).toEqual(["clockify:abc:0", "jibble:4a000000-0000-4000-8000-000000000001:0"]);
    const ana = entries().find((e) => e.user_id === "u1")!;
    expect(ana).toMatchObject({
      duration_minutes: 240,
      entry_date: "2024-06-13",
      start_time: "08:00:00",
      billable: false,
      status: "locked",
    });
    expect(store.erp.find((e) => e.table === "project_tasks")).toMatchObject({
      title: "Desenvolvimento",
    });
    expect(ana.task_id).toBe(store.erp.find((e) => e.table === "project_tasks")!.id);

    // 4) Mesmo evento confirmado: só vínculo de proveniência, sem novo apontamento; rerun idempotente.
    store.duplicates[0].decision = "same_event";
    const imp2 = await drive(newRun("import"));
    expect(imp2.status).toBe("completed");
    expect(entries()).toHaveLength(2);
    const prov = store.links.find(
      (l) => l.link_kind === "matched_existing" && l.target_id === "ck-1",
    );
    expect(prov).toBeTruthy();
    expect(
      (imp2.report as { importTotals: { inserted: number; matchedExisting: number } }).importTotals,
    ).toMatchObject({
      inserted: 0,
      matchedExisting: 1,
    });

    // 5) Desfazer a 1ª importação: apaga só o que ela criou; Clockify intacto.
    const rb = await drive(newRun("rollback", { target_run_id: imp.id }));
    expect(rb.status).toBe("completed");
    expect(entries().map((e) => e.external_id)).toEqual(["clockify:abc:0"]);
    expect(store.erp.some((e) => e.table === "projects")).toBe(false);
    expect(store.links.some((l) => l.target_id === "ck-1")).toBe(true);
    expect(iv("4a000000-0000-4000-8000-000000000001").status).toBe("ready");
  });

  it("cancelamento é respeitado entre passos", async () => {
    const { store, newRun, drive } = setup();
    const r = newRun("dry_run");
    r.status = "cancel_requested";
    const out = await drive(r);
    expect(out.status).toBe("cancelled");
    expect(store.staging.size).toBe(0);
  });
});
