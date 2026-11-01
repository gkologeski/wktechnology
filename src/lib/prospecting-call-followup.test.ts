import { describe, expect, it } from "vitest";
import { chooseFollowup, followupUsesTemplate } from "./prospecting-call-followup";

describe("chooseFollowup", () => {
  it("não atendeu vira 'missed'", () => {
    expect(chooseFollowup("no_answer", null)).toBe("missed");
    expect(chooseFollowup("busy", null)).toBe("missed");
    expect(chooseFollowup("completed", "voicemail")).toBe("missed");
  });
  it("conversa concluída vira 'answered'", () => {
    expect(chooseFollowup("completed", "customer-ended-call")).toBe("answered");
  });
  it("falha técnica não envia nada", () => {
    expect(chooseFollowup("failed", "pipeline-error")).toBeNull();
    expect(chooseFollowup("ringing", null)).toBeNull();
  });
});

describe("followupUsesTemplate", () => {
  it("não atendeu sempre usa modelo aprovado", () => {
    expect(followupUsesTemplate("missed", true, true)).toBe(true);
  });
  it("atendeu usa texto livre só com janela de 24 h aberta", () => {
    expect(followupUsesTemplate("answered", true, true)).toBe(false);
    expect(followupUsesTemplate("answered", false, true)).toBe(true);
    expect(followupUsesTemplate("answered", true, false)).toBe(true);
  });
});
