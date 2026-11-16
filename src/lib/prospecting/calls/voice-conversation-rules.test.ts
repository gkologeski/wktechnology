import { describe, it, expect } from "vitest";
import {
  firstNameOf,
  VOICE_CONVERSATION_RULES,
  voiceIdleMessagePlan,
} from "./voice-conversation-rules";

describe("regras de conversa da voz", () => {
  it("usa só o primeiro nome", () => {
    expect(firstNameOf("Joice Maria", "x")).toBe("Joice");
    expect(firstNameOf(null, "Joice Fidelis")).toBe("Joice");
    expect(firstNameOf("", "")).toBe("");
  });
  it("pergunta se o cliente está aí após 10 s", () => {
    expect(voiceIdleMessagePlan.idleTimeoutSeconds).toBe(10);
    expect(VOICE_CONVERSATION_RULES).toContain("primeiro nome");
    expect(VOICE_CONVERSATION_RULES).toContain("10 segundos");
  });
});
