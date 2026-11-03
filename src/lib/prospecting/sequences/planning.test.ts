import { describe, expect, it } from "vitest";
import { defaultPlanning, planningSchema, safeCap, simulatePlan, stepDays } from "./planning";

const steps = [
  { type: "email" },
  { type: "wait", duration: 2, unit: "days" },
  { type: "email" },
  { type: "wait", duration: 1, unit: "days" },
  { type: "whatsapp" },
  { type: "wait", duration: 2, unit: "days" },
  { type: "call" },
];
const hours = { start: "09:00", end: "18:00" };

describe("limites e planejamento", () => {
  it("teto seguro aplica a salva-guarda: 20/h com 20% = 16/h; 250/dia com 15% = 212/dia", () => {
    expect(safeCap(20, 20)).toBe(16);
    expect(safeCap(250, 15)).toBe(212);
  });
  it("e-mail é limitado por hora: 16/h em 9h de expediente = 144/dia", () => {
    const s = simulatePlan(steps, hours, defaultPlanning());
    expect(s.emailHourCap).toBe(16);
    expect(s.emailDayCap).toBe(144);
    expect(s.whatsappDayCap).toBe(212);
  });
  it("entrada sugerida nunca faz o pico acumulado passar dos tetos", () => {
    const s = simulatePlan(steps, hours, defaultPlanning());
    expect(s.peak.emailPerHour).toBeLessThanOrEqual(s.emailHourCap);
    expect(s.peak.whatsapp).toBeLessThanOrEqual(s.whatsappDayCap);
    expect(s.exceeds).toEqual({ email: false, whatsapp: false });
  });
  it("entrada manual acima do sugerido é sinalizada como excedente", () => {
    const p = defaultPlanning();
    p.intake = { mode: "manual", dailyIntake: 500 };
    expect(simulatePlan(steps, hours, p).exceeds.email).toBe(true);
  });
  it("esperas definem o dia de cada toque", () => {
    expect(stepDays(steps).map((t) => t.day)).toEqual([0, 2, 3, 5]);
  });
  it("intervalo máximo do WhatsApp menor que o mínimo é recusado", () => {
    const p = defaultPlanning();
    p.whatsapp.maxIntervalSeconds = 10;
    expect(planningSchema.safeParse(p).success).toBe(false);
  });
});
