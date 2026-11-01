import { describe, expect, it } from "vitest";
import {
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
