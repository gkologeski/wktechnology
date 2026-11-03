import { describe, expect, it } from "vitest";
import { activeSuppressions, suppressionKey } from "./whatsapp-suppression";

const now = new Date("2026-11-03T12:00:00Z");

describe("bloqueio de números recusados pela Meta", () => {
  it("celular com e sem 9º dígito é o mesmo número", () => {
    expect(suppressionKey("+5548991914665")).toBe(suppressionKey("554891914665"));
  });
  it("bloqueio vencido não bloqueia", () => {
    const m = activeSuppressions(
      [
        {
          phone_key: "+1",
          reason: "engagement_limit",
          expires_at: "2026-11-01T00:00:00Z",
          released_at: null,
        },
      ],
      now,
    );
    expect(m.has("+1")).toBe(false);
  });
  it("liberação manual remove o bloqueio", () => {
    const m = activeSuppressions(
      [
        {
          phone_key: "+1",
          reason: "no_whatsapp",
          expires_at: "2027-01-01T00:00:00Z",
          released_at: "2026-11-02T00:00:00Z",
        },
      ],
      now,
    );
    expect(m.has("+1")).toBe(false);
  });
  it("sem WhatsApp prevalece sobre engajamento", () => {
    const m = activeSuppressions(
      [
        {
          phone_key: "+1",
          reason: "no_whatsapp",
          expires_at: "2027-01-01T00:00:00Z",
          released_at: null,
        },
        {
          phone_key: "+1",
          reason: "engagement_limit",
          expires_at: "2027-01-01T00:00:00Z",
          released_at: null,
        },
      ],
      now,
    );
    expect(m.get("+1")).toBe("no_whatsapp");
  });
});
