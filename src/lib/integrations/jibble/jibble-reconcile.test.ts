import { describe, expect, it } from "vitest";
import { canReadWholeOrg, classifyJibbleRole, planPersonMappings } from "./jibble-map";
import {
  findCrossSourceDuplicates,
  flattenTimesheetSummary,
  reconcileDays,
} from "./jibble-reconcile";
import { reconstructIntervals } from "./jibble-reconstruct";

const P = "11111111-1111-4111-8111-111111111111";
const at = (iso: string) => Math.round(Date.parse(iso) / 1000);

describe("conciliação com timesheets", () => {
  const { intervals } = reconstructIntervals(P, [
    {
      id: "a",
      type: "In",
      time: "2024-06-13T08:00:00Z",
      belongsToDate: "2024-06-13",
      projectId: "p",
    },
    { id: "b", type: "Out", time: "2024-06-13T12:00:00Z", belongsToDate: "2024-06-13" },
  ]);

  it("compara sem somar duas vezes; frações de segundo do Jibble são aceitas", () => {
    const ts = flattenTimesheetSummary([
      {
        personId: P,
        daily: [
          { date: "2024-06-13", tracked: "PT4H0M0.4S" },
          { date: "2024-06-14", tracked: "PT0S" },
        ],
      },
    ]);
    const r = reconcileDays(intervals, [], ts);
    expect(r).toMatchObject({ matchedDays: 2, divergences: [] });
  });

  it("aponta divergência quando timesheet e eventos discordam", () => {
    const ts = flattenTimesheetSummary([
      { personId: P, daily: [{ date: "2024-06-13", tracked: "PT5H" }] },
    ]);
    const r = reconcileDays(intervals, [], ts);
    expect(r.divergences[0]).toMatchObject({
      reconstructedSeconds: 14400,
      timesheetSeconds: 18000,
      diffSeconds: -3600,
    });
  });

  it("lançamento de horas sem relógio entra na conciliação", () => {
    const ts = flattenTimesheetSummary([
      { personId: P, daily: [{ date: "2024-06-13", tracked: "PT5H" }] },
    ]);
    expect(
      reconcileDays(intervals, [{ date: "2024-06-13", seconds: 3600 }], ts).divergences,
    ).toEqual([]);
  });
});

describe("duplicidade entre fontes", () => {
  const seg = { startUtc: at("2024-06-13T08:00:00Z"), endUtc: at("2024-06-13T12:00:00Z") };
  const base = { source: "import", project_id: "proj" };

  it("mesmo intervalo do Clockify = exato; parcial = sobreposição; sem cruzar = nada", () => {
    const hits = findCrossSourceDuplicates(seg, "proj", [
      {
        ...base,
        id: "c1",
        external_id: "clockify:abc:0",
        started_at: "2024-06-13T08:01:00Z",
        stopped_at: "2024-06-13T11:59:30Z",
      },
      {
        ...base,
        id: "m1",
        source: "manual",
        external_id: null,
        started_at: "2024-06-13T11:00:00Z",
        stopped_at: "2024-06-13T13:00:00Z",
      },
      {
        ...base,
        id: "x",
        external_id: null,
        started_at: "2024-06-13T12:00:00Z",
        stopped_at: "2024-06-13T13:00:00Z",
      },
    ]);
    expect(hits.map((h) => [h.entryId, h.kind, h.source, h.overlapSeconds])).toEqual([
      ["c1", "exact", "clockify", 4 * 3600 - 90],
      ["m1", "overlap", "manual", 3600],
    ]);
    expect(hits[0].sameProject).toBe(true);
  });

  it("apontamentos do próprio Jibble não contam (o vínculo idempotente cuida)", () => {
    expect(
      findCrossSourceDuplicates(seg, null, [
        {
          ...base,
          id: "j",
          external_id: "jibble:e1:0",
          started_at: "2024-06-13T08:00:00Z",
          stopped_at: "2024-06-13T12:00:00Z",
        },
      ]),
    ).toEqual([]);
  });
});

describe("pessoas e acesso", () => {
  it("papel: só proprietário/admin lê a organização inteira; sem papel = desconhecido", () => {
    expect(classifyJibbleRole("Owner")).toBe("owner");
    expect(classifyJibbleRole("Admin")).toBe("admin");
    expect(classifyJibbleRole("Member")).toBe("not_admin");
    expect(classifyJibbleRole(null)).toBe("unknown");
    expect(canReadWholeOrg("unknown")).toBe(false);
  });

  it("e-mail repetido na origem ou no destino fica para revisão; único casa automático", () => {
    const plans = planPersonMappings(
      [
        { id: "j1", email: "Ana@WK.com", fullName: "Ana" },
        { id: "j2", email: "bia@wk.com", fullName: "Bia" },
        { id: "j3", email: "bia@wk.com", fullName: "Bia 2" },
        { id: "j4", email: "caio@wk.com", fullName: "Caio" },
        { id: "j5", email: null, fullName: "Sem e-mail" },
      ],
      [
        { user_id: "u1", email: "ana@wk.com", status: "inactive", name: "Ana" },
        { user_id: "u2", email: "caio@wk.com", status: "active", name: "Caio" },
        { user_id: "u3", email: "caio@wk.com", status: "active", name: "Caio dup" },
      ],
      [],
    );
    const by = Object.fromEntries(
      plans.map((p) => [p.external_id, [p.decision, p.target_id, p.note]]),
    );
    expect(by.j1).toEqual(["auto", "u1", null]);
    expect(by.j2[0]).toBe("pending");
    expect(by.j3[2]).toBe("email_duplicado_origem");
    expect(by.j4).toEqual(["pending", null, "email_duplicado_destino"]);
    expect(by.j5[2]).toBe("sem_email");
  });
});
