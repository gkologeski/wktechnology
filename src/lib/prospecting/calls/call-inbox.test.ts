import { describe, expect, it } from "vitest";
import { buildCallInboxBody, formatDuration, splitCallInboxBody } from "./call-inbox";

describe("ligação na Inbox", () => {
  it("monta resumo, reunião e transcrição separável", () => {
    const body = buildCallInboxBody({
      status: "completed",
      duration_seconds: 144,
      script_name: "Bruna",
      summary: "Cliente interessado",
      transcript: "AI: Oi",
      meeting_when: "seg, 17/11 10:00",
    });
    const { head, transcript } = splitCallInboxBody(body);
    expect(head).toContain("Concluída · 2 min 24 s");
    expect(head).toContain("Reunião marcada: seg, 17/11 10:00");
    expect(transcript).toBe("AI: Oi");
  });
  it("sem transcrição não cria seção", () => {
    expect(
      splitCallInboxBody(
        buildCallInboxBody({
          status: "no_answer",
          duration_seconds: 0,
          script_name: null,
          summary: null,
          transcript: null,
          meeting_when: null,
        }),
      ).transcript,
    ).toBeNull();
    expect(formatDuration(5)).toBe("5 s");
  });
});
