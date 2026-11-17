import { describe, expect, it } from "vitest";
import { buildSystemPrompt } from "./agent.server";
import { VOICE_CONVERSATION_RULES } from "@/lib/prospecting/calls/voice-conversation-rules";

describe("VAGA-CURRICULO", () => {
  it("WhatsApp orienta candidato a enviar currículo para rh@wktechnology.com.br", () => {
    const text = buildSystemPrompt({
      offers: [], materials: [], questions: [], bookingAvailable: false,
    } as unknown as Parameters<typeof buildSystemPrompt>[0]);
    expect(text).toContain("Candidato a emprego (VAGA-CURRICULO)");
    expect(text).toContain("rh@wktechnology.com.br");
  });
  it("voz orienta e soletra o e-mail do RH", () => {
    expect(VOICE_CONVERSATION_RULES).toContain("rh@wktechnology.com.br");
    expect(VOICE_CONVERSATION_RULES).toContain("rh, arroba, wktechnology, ponto com, ponto br");
  });
});
