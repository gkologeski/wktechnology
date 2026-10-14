import { describe, expect, it } from "vitest";
import { claimsBooking, hasConfirmedBooking, resolveChoice } from "./booking-guard";
import { buildMessages } from "./agent.server";

const tz = "America/Sao_Paulo";
const opts = [
  { position: 1, start: "2026-10-14T17:00:00.000Z", timezone: tz },
  { position: 2, start: "2026-10-15T17:00:00.000Z", timezone: tz },
  { position: 3, start: "2026-10-16T17:00:00.000Z", timezone: tz },
];

describe("booking guard", () => {
  it("detecta afirmação de reunião marcada", () => {
    expect(claimsBooking("Sexta-feira às 14h está confirmada para nossa conversa")).toBe(true);
    expect(claimsBooking("Agendado para sexta-feira às 14h.")).toBe(true);
    expect(claimsBooking("Qual desses dias funciona melhor?")).toBe(false);
  });
  it("só aceita confirmação vinda de calendar.book com status confirmed", () => {
    expect(hasConfirmedBooking([])).toBe(false);
    expect(hasConfirmedBooking([{ tool: "calendar__availability", out: { status: "options" } }])).toBe(false);
    expect(hasConfirmedBooking([{ tool: "calendar__book", out: { status: "pending_confirmation" } }])).toBe(false);
    expect(hasConfirmedBooking([{ tool: "calendar__book", out: { status: "confirmed" } }])).toBe(true);
  });
  it("\"6a\" resolve para a opção de sexta", () => {
    expect(resolveChoice("6a", opts)).toBe(3);
    expect(resolveChoice("quinta", opts)).toBe(2);
    expect(resolveChoice("2", opts)).toBe(2);
    expect(resolveChoice("a última", opts)).toBe(3);
    expect(resolveChoice("segunda", opts)).toBe(null);
    expect(resolveChoice("talvez", opts)).toBe(null);
  });
});

describe("mensagens seguidas", () => {
  it("três mensagens do cliente viram uma só, com o id da mais recente", () => {
    const msgs = buildMessages("sys", [
      { id: "o1", direction: "outbound", body: "Oi", created_at: "" },
      { id: "a", direction: "inbound", body: "entendi", created_at: "" },
      { id: "b", direction: "inbound", body: "quando tem agenda?", created_at: "" },
      { id: "c", direction: "inbound", body: "à tarde", created_at: "" },
    ] as never);
    expect(msgs).toHaveLength(3);
    expect(msgs[2].content).toBe("[message_id=c] entendi\nquando tem agenda?\nà tarde");
  });
});
