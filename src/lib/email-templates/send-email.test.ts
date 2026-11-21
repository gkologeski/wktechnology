import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { render, sendLovableEmail } = vi.hoisted(() => ({
  render: vi.fn(),
  sendLovableEmail: vi.fn(),
}));
vi.mock("@react-email/render", () => ({ render }));
vi.mock("@lovable.dev/email-js", () => ({
  sendLovableEmail,
  EmailAPIError: class EmailAPIError extends Error {},
}));
vi.mock("./registry", () => ({
  TEMPLATES: { "notification-update": { component: () => null, subject: "Fixed neutral subject" } },
}));
import { sendTemplateEmail } from "./send-email";

beforeEach(() => {
  vi.stubEnv("LOVABLE_API_KEY", "fake-unit-test-key");
  render.mockReset().mockResolvedValue("neutral rendered text");
  sendLovableEmail.mockReset().mockResolvedValue(undefined);
});

afterEach(() => vi.unstubAllEnvs());

describe("managed email authorization at the actual POST boundary", () => {
  it("finishes both asynchronous renders before the final callback, then invokes the SDK once", async () => {
    const steps: string[] = [];
    render.mockImplementation(async (_element, options) => {
      steps.push(options?.plainText ? "text" : "html");
      await Promise.resolve();
      return "neutral rendered text";
    });
    const beforeSend = vi.fn(async () => {
      steps.push("authorize");
    });
    sendLovableEmail.mockImplementation(async () => {
      steps.push("post");
    });
    expect(
      await sendTemplateEmail("notification-update", "test@example.com", {
        beforeSend,
        idempotencyKey: "fixed-notification-occurrence",
      }),
    ).toEqual({ sent: true });
    expect(steps).toEqual(["html", "text", "authorize", "post"]);
    expect(beforeSend).toHaveBeenCalledTimes(1);
    expect(sendLovableEmail).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        to: "test@example.com",
        idempotency_key: "fixed-notification-occurrence",
      }),
      expect.any(Object),
    );
  });

  it("prevents a POST when authorization was revoked during rendering", async () => {
    let active = true;
    render.mockImplementation(async () => {
      active = false;
      return "neutral rendered text";
    });
    const beforeSend = vi.fn(async () => {
      if (!active) throw new Error("Authorization revoked");
    });
    await expect(
      sendTemplateEmail("notification-update", "test@example.com", { beforeSend }),
    ).rejects.toThrow("Authorization revoked");
    expect(sendLovableEmail).not.toHaveBeenCalled();
  });

  it("keeps structured HTTP errors intact after the final authorization", async () => {
    const failure = Object.assign(new Error("Provider refusal"), {
      status: 429,
      retryAfterSeconds: 5000,
    });
    sendLovableEmail.mockRejectedValue(failure);
    await expect(
      sendTemplateEmail("notification-update", "test@example.com", { beforeSend: async () => {} }),
    ).rejects.toBe(failure);
    expect(sendLovableEmail).toHaveBeenCalledTimes(1);
  });

  it("preserves callers that do not provide a final callback", async () => {
    expect(await sendTemplateEmail("notification-update", "test@example.com")).toEqual({
      sent: true,
    });
    expect(sendLovableEmail).toHaveBeenCalledTimes(1);
  });

  it.each([undefined, null, {}, { success: false }, { success: "true" }])(
    "does not assert worker acceptance from an unexpected HTTP success body: %j",
    async (response) => {
      sendLovableEmail.mockResolvedValue(response);
      await expect(
        sendTemplateEmail("notification-update", "test@example.com", {
          beforeSend: async () => {},
          requireProviderAcceptance: true,
        }),
      ).rejects.toThrow("Não foi possível confirmar a aceitação pelo provedor de e-mail.");
      expect(sendLovableEmail).toHaveBeenCalledOnce();
    },
  );

  it("requires explicit provider acceptance for workers without fabricating a delivery receipt", async () => {
    sendLovableEmail.mockResolvedValue({
      success: true,
      message_id: "managed-not-provider-receipt",
    });
    expect(
      await sendTemplateEmail("notification-update", "test@example.com", {
        beforeSend: async () => {},
        requireProviderAcceptance: true,
      }),
    ).toEqual({ sent: true });
  });

  it("preserves legacy acceptance behavior when the new validation option is absent", async () => {
    sendLovableEmail.mockResolvedValue({ success: false });
    expect(await sendTemplateEmail("notification-update", "test@example.com")).toEqual({
      sent: true,
    });
  });
});
