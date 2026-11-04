import { describe, expect, it } from "vitest";
import { isWaMessageFailed, readWaDayMessages, waSenderLabel } from "./whatsapp-day";

describe("bloco diário de WhatsApp", () => {
  it("ignora registros sem chave de dia (formato antigo)", () => {
    expect(readWaDayMessages({ wa_message_id: "x" })).toBeNull();
  });

  it("ordena enviadas e recebidas pela hora no mesmo bloco", () => {
    const msgs = readWaDayMessages({
      wa_day: "conv:c:2026-10-20",
      messages: [
        { id: "2", direction: "inbound", at: "2026-10-20T15:00:00Z", body: "Sou eu" },
        {
          id: "1",
          direction: "outbound",
          at: "2026-10-20T14:00:00Z",
          body: "Olá",
          origin: "agent",
        },
      ],
    })!;
    expect(msgs.map((m) => m.id)).toEqual(["1", "2"]);
    expect(waSenderLabel(msgs[0]!)).toBe("Agente IA");
    expect(waSenderLabel(msgs[1]!)).toBe("Cliente");
  });

  it("marca falha de entrega", () => {
    expect(isWaMessageFailed({ status: "failed" })).toBe(true);
    expect(isWaMessageFailed({ status: "read" })).toBe(false);
  });
});
