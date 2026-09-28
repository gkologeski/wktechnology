import { describe, expect, it } from "vitest";
import { mapProbeStatus } from "./twilio-voice-probe";

describe("mapProbeStatus", () => {
  it("ok em 2xx", () => expect(mapProbeStatus(200).ok).toBe(true));
  it("401 bloqueia sem ser transitório", () =>
    expect(mapProbeStatus(401)).toMatchObject({ ok: false, transient: false }));
  it("5xx é transitório", () => expect(mapProbeStatus(503).transient).toBe(true));
});
