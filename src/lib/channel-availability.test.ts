import { describe, expect, it } from "vitest";
import {
  CHANNEL_SETUP,
  isChannelBlocked,
  isSendChannel,
  twilioEnvReady,
} from "./channel-availability";

const all = (ready: boolean) => ({
  whatsapp: { ready },
  email: { ready },
  call: { ready },
  meeting: { ready },
});

describe("channel-availability", () => {
  it("libera enquanto não há status", () => {
    expect(isChannelBlocked(undefined, "whatsapp")).toBe(false);
  });
  it("bloqueia canal não configurado", () => {
    expect(isChannelBlocked(all(false), "email")).toBe(true);
    expect(isChannelBlocked(all(true), "email")).toBe(false);
  });
  it("mapeia rotas de configuração", () => {
    expect(CHANNEL_SETUP.whatsapp.to).toBe("/settings/whatsapp");
    expect(CHANNEL_SETUP.meeting.to).toBe("/settings/calendars");
  });
  it("identifica canais de envio", () => {
    expect(isSendChannel("call")).toBe(true);
    expect(isSendChannel("survey")).toBe(false);
  });
  it("valida formato Twilio", () => {
    expect(
      twilioEnvReady({
        accountSid: "AC1",
        apiKeySid: "SK1",
        apiKeySecret: "x",
        twimlAppSid: "AP1",
      }),
    ).toBe(true);
    expect(twilioEnvReady({ accountSid: "AC1" })).toBe(false);
  });
});
