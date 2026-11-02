import { describe, expect, it } from "vitest";
import {
  fromMinutes,
  offsetLabel,
  toMinutes,
  validateOffsets,
  buildTemplateVariables,
  countTemplateVariables,
  dueOffsets,
  resolveReminderValues,
} from "./meeting-reminders";

const MIN = 60_000;
const meeting = Date.UTC(2026, 10, 3, 17, 0); // 03/11/2026 14:00 BRT
const all = [1440, 180, 60, 5];

describe("dueOffsets", () => {
  it("24 horas antes sai exatamente 24 h antes", () => {
    expect(dueOffsets(meeting, meeting - 1440 * MIN, all)).toEqual([1440]);
  });
  it("3 horas antes, 1 hora antes e 5 minutos antes", () => {
    expect(dueOffsets(meeting, meeting - 180 * MIN, all)).toEqual([180]);
    expect(dueOffsets(meeting, meeting - 60 * MIN + 2 * MIN, all)).toEqual([60]);
    expect(dueOffsets(meeting, meeting - 4 * MIN, all)).toEqual([5]);
  });
  it("reunião marcada daqui 2 h não dispara 24 h nem 3 h vencidos", () => {
    expect(dueOffsets(meeting, meeting - 120 * MIN, all)).toEqual([]);
  });
  it("só envia as opções escolhidas", () => {
    expect(dueOffsets(meeting, meeting - 1440 * MIN, [60, 5])).toEqual([]);
  });
  it("nada sai depois que a reunião começou", () => {
    expect(dueOffsets(meeting, meeting + MIN, all)).toEqual([]);
  });
  it("tolerância de atraso de 10 minutos", () => {
    expect(dueOffsets(meeting, meeting - 180 * MIN + 10 * MIN, all)).toEqual([180]);
    expect(dueOffsets(meeting, meeting - 180 * MIN + 11 * MIN, all)).toEqual([]);
  });
});

describe("variáveis", () => {
  const values = resolveReminderValues({
    firstName: "Guilherme Kologeski",
    meetingAt: new Date(meeting),
    location: "https://meet.google.com/abc",
    ownerName: "Lia",
    subject: "Apresentação",
  });
  it("data e hora no fuso de São Paulo", () => {
    expect(values.meeting_date).toBe("03/11/2026");
    expect(values.meeting_time).toBe("14:00");
    expect(values.first_name).toBe("Guilherme");
  });
  it("monta posicionais na ordem do mapa", () => {
    expect(buildTemplateVariables(["first_name", "meeting_time"], values)).toEqual([
      "Guilherme",
      "14:00",
    ]);
  });
  it("recusa quando alguma variável fica vazia", () => {
    expect(buildTemplateVariables(["first_name"], { ...values, first_name: "" })).toBeNull();
  });
  it("conta variáveis do corpo", () => {
    expect(countTemplateVariables([{ type: "BODY", text: "Oi {{1}}, às {{2}}" }])).toBe(2);
  });
});

describe("lembretes com tempo livre", () => {
  it("converte quantidade e unidade em minutos", () => {
    expect(toMinutes(2, "days")).toBe(2880);
    expect(toMinutes(3, "hours")).toBe(180);
    expect(toMinutes(15, "minutes")).toBe(15);
  });
  it("reexibe na unidade salva ou na maior que divide", () => {
    expect(fromMinutes(1440)).toEqual({ amount: 1, unit: "days" });
    expect(fromMinutes(1440, "hours")).toEqual({ amount: 24, unit: "hours" });
    expect(fromMinutes(90)).toEqual({ amount: 90, unit: "minutes" });
  });
  it("aceita de 1 minuto a 30 dias", () => {
    expect(validateOffsets([1, 43200])).toBeNull();
    expect(validateOffsets([0])).not.toBeNull();
    expect(validateOffsets([43201])).not.toBeNull();
  });
  it("recusa tempos repetidos e mais de 10 lembretes", () => {
    expect(validateOffsets([60, 60])).not.toBeNull();
    expect(validateOffsets(Array.from({ length: 11 }, (_, i) => i + 1))).not.toBeNull();
  });
  it("rótulo em português no singular e plural", () => {
    expect(offsetLabel(60)).toBe("1 hora antes");
    expect(offsetLabel(2880)).toBe("2 dias antes");
  });
});
