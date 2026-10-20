import { describe, expect, it } from "vitest";
import {
  reconstructIntervals,
  segmentByFixedOffset,
  segmentInterval,
  sortEvents,
  type JbTimeEntry,
} from "./jibble-reconstruct";

const P = "11111111-1111-4111-8111-111111111111";
const PR1 = "aaaaaaaa-0000-4000-8000-000000000001";
const PR2 = "aaaaaaaa-0000-4000-8000-000000000002";
let n = 0;
const ev = (type: string, time: string, extra: Partial<JbTimeEntry> = {}): JbTimeEntry => ({
  id: `e${String(++n).padStart(4, "0")}`,
  type,
  time,
  localTime: extra.localTime ?? time.replace("Z", "+00:00"),
  belongsToDate: time.slice(0, 10),
  personId: P,
  projectId: type === "In" ? PR1 : null,
  ...extra,
});

describe("reconstrução de intervalos do Jibble", () => {
  it("entrada/saída simples preserva segundos exatos", () => {
    const r = reconstructIntervals(P, [
      ev("In", "2024-06-13T08:00:00Z"),
      ev("Out", "2024-06-13T12:00:37Z"),
    ]);
    expect(r.intervals).toHaveLength(1);
    expect(r.intervals[0].seconds).toBe(4 * 3600 + 37);
    expect(r.intervals[0].status).toBe("ready");
  });

  it("troca de projeto: novo In fecha o anterior e abre outro", () => {
    const r = reconstructIntervals(P, [
      ev("In", "2024-06-13T08:00:00Z", { projectId: PR1 }),
      ev("In", "2024-06-13T10:00:00Z", { projectId: PR2, activityId: "act" }),
      ev("Out", "2024-06-13T11:30:00Z"),
    ]);
    expect(r.intervals.map((i) => [i.projectId, i.seconds])).toEqual([
      [PR1, 7200],
      [PR2, 5400],
    ]);
    expect(r.intervals[1].activityId).toBe("act");
  });

  it("pausa paga e não paga viram intervalos de pausa separados", () => {
    const r = reconstructIntervals(
      P,
      [
        ev("In", "2024-06-13T08:00:00Z"),
        ev("Out", "2024-06-13T10:00:00Z", { isBreak: true, isPaidBreak: true }),
        ev("In", "2024-06-13T10:15:00Z"),
        ev("Break", "2024-06-13T12:00:00Z"),
        ev("In", "2024-06-13T13:00:00Z"),
        ev("Out", "2024-06-13T17:00:00Z"),
      ],
      { defaultBreakPaid: false },
    );
    const kinds = r.intervals.map((i) => `${i.kind}:${i.paid}:${i.seconds}`);
    expect(kinds).toEqual([
      "work:null:7200",
      "break:true:900",
      "work:null:6300",
      "break:false:3600",
      "work:null:14400",
    ]);
  });

  it("evento aberto fica aberto, sem saída inventada", () => {
    const r = reconstructIntervals(P, [ev("In", "2024-06-13T08:00:00Z")]);
    expect(r.intervals[0]).toMatchObject({ status: "open", endUtc: null, seconds: null });
    expect(r.intervals[0].reasons).toContain("open_interval");
  });

  it("saída sem entrada vira anomalia e não cria intervalo", () => {
    const r = reconstructIntervals(P, [ev("Out", "2024-06-13T08:00:00Z")]);
    expect(r.intervals).toHaveLength(0);
    expect(r.anomalies[0].reason).toBe("orphan_out");
  });

  it("empate no mesmo instante é determinístico: Out antes de In, depois pelo id", () => {
    const a = ev("In", "2024-06-13T08:00:00Z");
    const out = { ...ev("Out", "2024-06-13T10:00:00Z"), id: "zz" };
    const inn = { ...ev("In", "2024-06-13T10:00:00Z", { projectId: PR2 }), id: "aa" };
    const end = ev("Out", "2024-06-13T11:00:00Z");
    const one = reconstructIntervals(P, [end, inn, a, out]);
    const two = reconstructIntervals(P, [out, a, end, inn]);
    expect(one.intervals).toEqual(two.intervals);
    expect(one.intervals.map((i) => i.seconds)).toEqual([7200, 3600]);
    expect(sortEvents([inn, out]).map((e) => e.id)).toEqual(["zz", "aa"]);
  });

  it("eventos arquivados não entram na reconstrução", () => {
    const r = reconstructIntervals(P, [
      ev("In", "2024-06-13T08:00:00Z"),
      ev("Out", "2024-06-13T09:00:00Z", { status: "Archived" }),
      ev("Out", "2024-06-13T10:00:00Z"),
    ]);
    expect(r.archivedEvents).toBe(1);
    expect(r.intervals[0].seconds).toBe(7200);
  });

  it("intervalo sem projeto e muito longo vão para revisão", () => {
    const r = reconstructIntervals(P, [
      ev("In", "2024-06-13T08:00:00Z", { projectId: null }),
      ev("Out", "2024-06-14T08:00:00Z"),
    ]);
    expect(r.intervals[0].status).toBe("pending_review");
    expect(r.intervals[0].reasons).toEqual(expect.arrayContaining(["long_interval", "no_project"]));
  });

  it("virada da meia-noite no fuso da pessoa divide sem perder segundos", () => {
    const r = reconstructIntervals(P, [
      ev("In", "2024-06-14T00:30:00Z", { localTime: "2024-06-13T21:30:00-03:00" }),
      ev("Out", "2024-06-14T05:00:05Z", { localTime: "2024-06-14T02:00:05-03:00" }),
    ]);
    const segs = segmentInterval(r.intervals[0], "America/Sao_Paulo");
    expect(segs.map((s) => [s.localDate, s.startTime, s.endTime])).toEqual([
      ["2024-06-13", "21:30:00", "24:00:00"],
      ["2024-06-14", "00:00:00", "02:00:05"],
    ]);
    expect(segs.reduce((a, s) => a + s.seconds, 0)).toBe(r.intervals[0].seconds);
  });

  it("horário de verão (Nova York, 10/03/2024): soma real preservada e mudança de fuso marcada", () => {
    const r = reconstructIntervals(P, [
      ev("In", "2024-03-10T06:00:00Z", { localTime: "2024-03-10T01:00:00-05:00" }),
      ev("Out", "2024-03-10T09:00:00Z", { localTime: "2024-03-10T05:00:00-04:00" }),
    ]);
    const iv = r.intervals[0];
    expect(iv.seconds).toBe(3 * 3600);
    expect(iv.reasons).toContain("offset_changed");
    const segs = segmentInterval(iv, "America/New_York");
    expect(segs).toHaveLength(1);
    expect(segs[0].seconds).toBe(3 * 3600);
    expect(segs[0].dstMismatch).toBe(true);
  });

  it("sem fuso IANA usa o deslocamento do evento de entrada", () => {
    const segs = segmentByFixedOffset(
      Date.parse("2024-06-12T22:00:00Z") / 1000,
      Date.parse("2024-06-13T02:00:00Z") / 1000,
      240,
    );
    // +04:00 → 02:00 a 06:00 do dia 13: um só segmento.
    expect(segs.map((s) => [s.localDate, s.startTime, s.endTime])).toEqual([
      ["2024-06-13", "02:00:00", "06:00:00"],
    ]);
  });
});
