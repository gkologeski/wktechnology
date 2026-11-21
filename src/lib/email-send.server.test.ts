import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

const { sendTemplateEmail } = vi.hoisted(() => ({ sendTemplateEmail: vi.fn() }));
vi.mock("@/lib/email-templates/send-email", () => ({ sendTemplateEmail }));
import { sendTransactionalEmailFromServer } from "./email-send.server";

function fixture() {
  const insert = vi.fn().mockResolvedValue({ error: null });
  const supabase = { from: vi.fn().mockReturnValue({ insert }) } as unknown as SupabaseClient;
  return {
    insert,
    params: {
      supabase,
      templateName: "notification-update",
      recipientEmail: "test@example.com",
      idempotencyKey: "fake-notification-key",
    },
  };
}

beforeEach(() => {
  sendTemplateEmail.mockReset().mockResolvedValue({ sent: true });
});

describe("server transactional email compatibility and worker error preservation", () => {
  it("passes the final worker callback through to the template transport and preserves idempotency", async () => {
    const { params, insert } = fixture();
    const beforeSend = vi.fn().mockResolvedValue(undefined);
    expect(
      await sendTransactionalEmailFromServer({ ...params, beforeSend, throwOnError: true }),
    ).toMatchObject({ status: "sent" });
    expect(sendTemplateEmail).toHaveBeenCalledWith(
      "notification-update",
      "test@example.com",
      expect.objectContaining({
        beforeSend,
        idempotencyKey: params.idempotencyKey,
        requireProviderAcceptance: true,
      }),
    );
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ status: "sent" }));
  });

  it("rethrows the exact structured provider error for the notification ledger", async () => {
    const { params, insert } = fixture();
    const failure = Object.assign(new Error("private provider details"), {
      status: 429,
      retryAfterSeconds: 4000,
      code: "rate_limited",
    });
    sendTemplateEmail.mockRejectedValue(failure);
    await expect(sendTransactionalEmailFromServer({ ...params, throwOnError: true })).rejects.toBe(
      failure,
    );
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "failed",
        error_message: "Não foi possível concluir o envio transacional.",
      }),
    );
    expect(JSON.stringify(insert.mock.calls)).not.toContain("private provider details");
  });

  it("keeps legacy errors as return values and retains the existing history behavior", async () => {
    const { params, insert } = fixture();
    sendTemplateEmail.mockRejectedValue(new Error("Legacy failure"));
    expect(await sendTransactionalEmailFromServer(params)).toEqual({
      status: "error",
      error: "Legacy failure",
    });
    expect(sendTemplateEmail).toHaveBeenCalledWith(
      params.templateName,
      params.recipientEmail,
      expect.objectContaining({ requireProviderAcceptance: false }),
    );
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ status: "failed", error_message: "Legacy failure" }),
    );
  });

  it("still recognizes provider suppression without claiming delivery", async () => {
    const { params, insert } = fixture();
    sendTemplateEmail.mockResolvedValue({ sent: false, reason: "recipient_suppressed" });
    expect(await sendTransactionalEmailFromServer({ ...params, throwOnError: true })).toMatchObject(
      { status: "suppressed" },
    );
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ status: "suppressed" }));
  });
});
