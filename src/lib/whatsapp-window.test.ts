import { describe, expect, it, vi } from "vitest";
import { isWithinServiceWindow } from "@/lib/whatsapp/meta-channel.server";

describe("janela de atendimento do WhatsApp", () => {
  it("aceita uma resposta antes de completar 24 horas", () => {
    vi.setSystemTime(new Date("2026-10-05T12:00:00Z"));
    expect(isWithinServiceWindow("2026-10-04T12:00:01Z")).toBe(true);
    vi.useRealTimers();
  });

  it("encerra a janela ao completar 24 horas", () => {
    vi.setSystemTime(new Date("2026-10-05T12:00:00Z"));
    expect(isWithinServiceWindow("2026-10-04T12:00:00Z")).toBe(false);
    vi.useRealTimers();
  });

  it.each([null, undefined, "data-invalida"])("trata %s como janela encerrada", (value) => {
    expect(isWithinServiceWindow(value)).toBe(false);
  });
});
