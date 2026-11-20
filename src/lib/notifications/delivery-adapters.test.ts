import { describe, expect, it, vi } from "vitest";
import { MetaCloudError } from "@/lib/whatsapp/cloud-api.server";
import {
  loadNotificationWhatsAppTemplates,
  sendNotificationDelivery,
  type NotificationAdapterDependencies,
  type NotificationCloudSender,
} from "./delivery-adapters.server";
import { NEUTRAL_NOTIFICATION_TEMPLATE_BODIES } from "./delivery-content";
import type { NotificationDeliveryJob } from "./delivery-types";

const workspaceId = "11111111-1111-4111-8111-111111111111";
const job: NotificationDeliveryJob = {
  id: "22222222-2222-4222-8222-222222222222",
  token: "33333333-3333-4333-8333-333333333333",
  channel: "whatsapp",
  workspaceId,
  workflowId: "44444444-4444-4444-8444-444444444444",
  runId: "55555555-5555-4555-8555-555555555555",
  recipientId: "66666666-6666-4666-8666-666666666666",
  idempotencyKey: "notification:fake-delivery:whatsapp",
  phone: "+14155552671",
  email: "User@example.com",
  senderPhoneNumberId: "12345678901",
  templateName: "notification_update",
  templateLanguage: "pt_BR",
};
const sender: NotificationCloudSender = {
  phoneNumberId: job.senderPhoneNumberId!,
  displayPhoneNumber: "+14155552672",
  workspaceId,
  connectionId: "77777777-7777-4777-8777-777777777777",
  provider: "cloud",
  qualityRating: "GREEN",
  status: "CONNECTED",
};
const approved = () => ({
  name: job.templateName,
  language: job.templateLanguage,
  status: "APPROVED",
  category: "UTILITY",
  components: [{ type: "BODY", text: NEUTRAL_NOTIFICATION_TEMPLATE_BODIES[2] }],
});
function fakeDependencies(overrides: Partial<NotificationAdapterDependencies> = {}) {
  const httpPost = vi
    .fn()
    .mockResolvedValue({ messages: [{ id: "wamid.fake-provider-acceptance" }] });
  const deps = {
    appOrigin: vi.fn().mockReturnValue("https://erp.example.com"),
    managedEmailConfigured: vi.fn().mockReturnValue(true),
    sendEmail: vi.fn().mockResolvedValue({ status: "sent", messageId: "local-not-provider-id" }),
    readCloudSender: vi.fn().mockResolvedValue(sender),
    readCloudTemplates: vi.fn().mockResolvedValue([null, approved()]),
    isWhatsAppSuppressed: vi.fn().mockResolvedValue(false),
    sendCloud: vi.fn(async (_workspace, _sender, _body, beforeSend) => {
      await beforeSend();
      return httpPost();
    }),
    recordWhatsAppAcceptance: vi.fn().mockResolvedValue(undefined),
    recordWhatsAppRefusal: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } satisfies NotificationAdapterDependencies;
  return { ...deps, httpPost };
}
function deliver(
  input: NotificationDeliveryJob,
  deps: NotificationAdapterDependencies,
  beforePost: () => Promise<void> = async () => {},
) {
  return sendNotificationDelivery(input, deps, beforePost);
}

describe("notification delivery provider boundaries", () => {
  it("requires the worker authorization hook even with an otherwise valid delivery", async () => {
    const deps = fakeDependencies();
    expect(await sendNotificationDelivery(job, deps)).toMatchObject({
      status: "failed",
      reasonCode: "invalid_configuration",
    });
    expect(deps.sendCloud).not.toHaveBeenCalled();
    expect(deps.sendEmail).not.toHaveBeenCalled();
  });

  it("makes no provider POST when authorization expires while loading the catalogue", async () => {
    let revoked = false;
    const deps = fakeDependencies({
      readCloudTemplates: vi.fn(async () => {
        revoked = true;
        return [approved()];
      }),
    });
    const authorize = vi.fn(async () => {
      if (revoked) throw new Error("lease expired");
    });
    expect((await deliver(job, deps, authorize)).status).toBe("uncertain");
    expect(authorize).toHaveBeenCalledOnce();
    expect(deps.httpPost).not.toHaveBeenCalled();
    expect(deps.recordWhatsAppAcceptance).not.toHaveBeenCalled();
  });

  it("pins the Cloud sender, uses only neutral values and records real provider acceptance", async () => {
    const deps = fakeDependencies();
    const r = await deliver(
      {
        ...job,
        privateTitle: "Salary: 50000",
        sourceUrl: "https://private.example/record",
      } as NotificationDeliveryJob,
      deps,
    );
    expect(r).toEqual({
      status: "accepted",
      provider: "meta_cloud",
      providerId: "wamid.fake-provider-acceptance",
    });
    expect(deps.readCloudTemplates).toHaveBeenCalledWith(workspaceId, job.senderPhoneNumberId);
    expect(deps.sendCloud).toHaveBeenCalledWith(
      workspaceId,
      job.senderPhoneNumberId,
      {
        messaging_product: "whatsapp",
        to: "+14155552671",
        type: "template",
        template: {
          name: job.templateName,
          language: { code: "pt_BR" },
          components: [
            {
              type: "body",
              parameters: [
                { type: "text", text: "Há uma atualização solicitada no TechERP." },
                { type: "text", text: "https://erp.example.com/notifications" },
              ],
            },
          ],
        },
      },
      expect.any(Function),
    );
    expect(deps.recordWhatsAppAcceptance).toHaveBeenCalledWith(job, sender, r.providerId);
    expect(JSON.stringify(vi.mocked(deps.sendCloud).mock.calls)).not.toContain("Salary");
    expect(JSON.stringify(vi.mocked(deps.sendCloud).mock.calls)).not.toContain("private.example");
  });

  it("does not reinterpret an accepted POST as failed when local history is unavailable", async () => {
    const deps = fakeDependencies({
      recordWhatsAppAcceptance: vi.fn().mockRejectedValue(new Error("db down")),
    });
    expect(await deliver(job, deps)).toMatchObject({
      status: "accepted",
      providerId: "wamid.fake-provider-acceptance",
    });
    expect(deps.sendCloud).toHaveBeenCalledOnce();
  });

  it.each([
    null,
    { ...sender, workspaceId: "another-workspace" },
    { ...sender, phoneNumberId: "9876543210" },
    { ...sender, qualityRating: "RED" },
    { ...sender, qualityRating: "YELLOW" },
    { ...sender, qualityRating: null },
    { ...sender, status: "DISCONNECTED" },
    { ...sender, provider: "lovable" },
  ])(
    "does not fall back to Lovable or another number when sender binding is unavailable: %j",
    async (value) => {
      const deps = fakeDependencies({ readCloudSender: vi.fn().mockResolvedValue(value) });
      expect(await deliver(job, deps)).toMatchObject({
        status: "failed",
        reasonCode: "sender_unavailable",
      });
      expect(deps.sendCloud).not.toHaveBeenCalled();
      expect(deps.sendEmail).not.toHaveBeenCalled();
    },
  );

  it("suppresses a recipient before making a provider POST", async () => {
    const deps = fakeDependencies({ isWhatsAppSuppressed: vi.fn().mockResolvedValue(true) });
    expect(await deliver(job, deps)).toMatchObject({
      status: "suppressed",
      reasonCode: "recipient_suppressed",
    });
    expect(deps.sendCloud).not.toHaveBeenCalled();
  });

  it.each(["4155552671", "+1 (415) 555-2671", "+14155552671 ext 4", "not a phone"])(
    "rejects noncanonical target %s",
    async (phone) => {
      const deps = fakeDependencies();
      expect(await deliver({ ...job, phone }, deps)).toMatchObject({
        status: "failed",
        reasonCode: "invalid_recipient",
      });
      expect(deps.readCloudSender).not.toHaveBeenCalled();
      expect(deps.sendCloud).not.toHaveBeenCalled();
    },
  );

  it("fails closed for malformed jobs and central URLs before provider calls", async () => {
    const deps = fakeDependencies();
    expect(await deliver({ ...job, workspaceId: "invalid" }, deps)).toMatchObject({
      status: "failed",
      reasonCode: "invalid_configuration",
    });
    vi.mocked(deps.appOrigin).mockReturnValue("https://erp.example.com/record/private");
    expect(await deliver(job, deps)).toMatchObject({
      status: "failed",
      reasonCode: "invalid_configuration",
    });
    expect(deps.sendCloud).not.toHaveBeenCalled();
  });

  it("rechecks the live approval and category for every attempted send", async () => {
    const deps = fakeDependencies();
    await deliver(job, deps);
    vi.mocked(deps.readCloudTemplates).mockResolvedValue([
      { ...approved(), category: "MARKETING" },
    ]);
    expect(await deliver(job, deps)).toMatchObject({
      status: "failed",
      reasonCode: "invalid_template",
    });
    expect(deps.readCloudTemplates).toHaveBeenCalledTimes(2);
    expect(deps.sendCloud).toHaveBeenCalledOnce();
  });

  it("can safely schedule a retry after a read-only preflight outage", async () => {
    const deps = fakeDependencies({
      readCloudTemplates: vi.fn().mockRejectedValue(new Error("offline")),
    });
    expect(await deliver(job, deps)).toMatchObject({
      status: "retry_scheduled",
      reasonCode: "provider_preflight_unavailable",
      retryAfterSeconds: 60,
    });
    expect(deps.sendCloud).not.toHaveBeenCalled();
  });

  it.each([400, 401, 403, 404])("classifies explicit POST refusal %s as failed", async (status) => {
    const deps = fakeDependencies({
      sendCloud: vi.fn().mockRejectedValue(new MetaCloudError(status)),
    });
    expect(await deliver(job, deps)).toMatchObject({
      status: "failed",
      reasonCode: "provider_rejected",
    });
  });

  it.each([131026, 131049])(
    "records only typed Meta recipient refusal %s through the canonical suppression boundary",
    async (code) => {
      const deps = fakeDependencies({
        sendCloud: vi.fn().mockRejectedValue(new MetaCloudError(400, code)),
      });
      expect((await deliver(job, deps)).status).toBe("failed");
      expect(deps.recordWhatsAppRefusal).toHaveBeenCalledWith(job, String(code));
    },
  );

  it("never guesses suppression from error text or a forged code object", async () => {
    for (const error of [
      new Error("Meta error 131026"),
      { status: 400, code: 131049 },
      new MetaCloudError(500, 131026),
      new MetaCloudError(400, 100),
    ]) {
      const deps = fakeDependencies({ sendCloud: vi.fn().mockRejectedValue(error) });
      await deliver(job, deps);
      expect(deps.recordWhatsAppRefusal).not.toHaveBeenCalled();
    }
  });

  it("preserves definite refusal if suppression persistence fails", async () => {
    const deps = fakeDependencies({
      sendCloud: vi.fn().mockRejectedValue(new MetaCloudError(400, 131026)),
      recordWhatsAppRefusal: vi.fn().mockRejectedValue(new Error("db down")),
    });
    expect(await deliver(job, deps)).toMatchObject({
      status: "failed",
      reasonCode: "provider_rejected",
    });
    expect(deps.sendCloud).toHaveBeenCalledOnce();
  });

  it.each([408, 500, 503, 200])(
    "keeps HTTP %s ambiguous with no resend/fallback",
    async (status) => {
      const deps = fakeDependencies({
        sendCloud: vi.fn().mockRejectedValue(new MetaCloudError(status)),
      });
      expect(await deliver(job, deps)).toMatchObject({
        status: "uncertain",
        reasonCode: "transport_unknown",
      });
      expect(deps.sendCloud).toHaveBeenCalledOnce();
      expect(deps.sendEmail).not.toHaveBeenCalled();
    },
  );

  it.each([new TypeError("network"), new DOMException("timeout", "AbortError")])(
    "keeps transport exceptions ambiguous",
    async (error) => {
      const deps = fakeDependencies({ sendCloud: vi.fn().mockRejectedValue(error) });
      expect((await deliver(job, deps)).status).toBe("uncertain");
      expect(deps.sendEmail).not.toHaveBeenCalled();
    },
  );

  it("never shortens provider cooldowns above the supported retry horizon", async () => {
    const deps = fakeDependencies({
      sendCloud: vi.fn().mockRejectedValue({ status: 429, retryAfterSeconds: 99999 }),
    });
    expect(await deliver(job, deps)).toEqual({
      status: "failed",
      provider: "meta_cloud",
      reasonCode: "provider_rate_limited",
    });
    expect(deps.recordWhatsAppAcceptance).not.toHaveBeenCalled();
  });

  it.each([{}, { messages: [] }, { messages: [{ id: "" }] }])(
    "requires provider ID evidence on successful HTTP response",
    async (response) => {
      const deps = fakeDependencies({ sendCloud: vi.fn().mockResolvedValue(response) });
      expect((await deliver(job, deps)).status).toBe("uncertain");
      expect(deps.recordWhatsAppAcceptance).not.toHaveBeenCalled();
    },
  );
});

describe("managed notification email", () => {
  it("revalidates authorization immediately before handing off to the managed transport", async () => {
    const deps = fakeDependencies();
    const authorize = vi.fn().mockRejectedValue(new Error("consent revoked"));
    expect((await deliver({ ...job, channel: "email" }, deps, authorize)).status).toBe("uncertain");
    expect(authorize).toHaveBeenCalledOnce();
    expect(deps.sendEmail).not.toHaveBeenCalled();
  });

  it("uses the canonical template/idempotency key and never exposes the local UUID as a provider ID", async () => {
    const deps = fakeDependencies();
    expect(await deliver({ ...job, channel: "email" }, deps)).toEqual({
      provider: "managed_email",
      status: "accepted",
      providerId: null,
    });
    expect(deps.sendEmail).toHaveBeenCalledWith({
      recipientEmail: "User@example.com",
      templateName: "notification-update",
      templateData: { centralUrl: "https://erp.example.com/notifications" },
      idempotencyKey: job.idempotencyKey,
      beforeSend: expect.any(Function),
    });
    expect(deps.sendCloud).not.toHaveBeenCalled();
  });
  it.each([null, "not-an-email", "User@example.com\r\nBcc: other@example.com"])(
    "refuses invalid email %s without transport",
    async (email) => {
      const deps = fakeDependencies();
      expect(await deliver({ ...job, channel: "email", email }, deps)).toMatchObject({
        status: "failed",
        reasonCode: "invalid_recipient",
      });
      expect(deps.sendEmail).not.toHaveBeenCalled();
    },
  );
  it("marks missing configuration before transport and honors managed suppression", async () => {
    const deps = fakeDependencies({ managedEmailConfigured: vi.fn().mockReturnValue(false) });
    expect((await deliver({ ...job, channel: "email" }, deps)).reasonCode).toBe(
      "sender_unavailable",
    );
    expect(deps.sendEmail).not.toHaveBeenCalled();
    vi.mocked(deps.managedEmailConfigured).mockReturnValue(true);
    vi.mocked(deps.sendEmail).mockResolvedValue({ status: "suppressed" });
    expect((await deliver({ ...job, channel: "email" }, deps)).status).toBe("suppressed");
  });
  it("does not infer refusal from opaque managed-wrapper errors", async () => {
    const deps = fakeDependencies({
      sendEmail: vi
        .fn()
        .mockResolvedValue({ status: "error", error: "403: some opaque transport state" }),
    });
    expect(await deliver({ ...job, channel: "email" }, deps)).toMatchObject({
      status: "uncertain",
      reasonCode: "transport_unknown",
    });
    expect(deps.sendCloud).not.toHaveBeenCalled();
  });
});

describe("live notification WhatsApp template catalogue", () => {
  it("exposes compatibility reasons without marking arbitrary approved models as safe", async () => {
    const deps = fakeDependencies({
      readCloudTemplates: vi
        .fn()
        .mockResolvedValue([
          approved(),
          { ...approved(), name: "promotion", category: "MARKETING" },
          { ...approved(), name: "paused", status: "PAUSED" },
          null,
        ]),
    });
    const list = await loadNotificationWhatsAppTemplates(
      workspaceId,
      job.senderPhoneNumberId!,
      deps,
    );
    expect(list).toHaveLength(3);
    expect(list[0]).toMatchObject({ compatible: true, name: job.templateName });
    expect(list[1]).toMatchObject({ compatible: false, reason: "template_not_utility" });
    expect(list[2]).toMatchObject({ compatible: false, reason: "template_not_approved" });
  });
  it("does not list templates for a number owned by another workspace", async () => {
    const deps = fakeDependencies({
      readCloudSender: vi.fn().mockResolvedValue({ ...sender, workspaceId: "other" }),
    });
    expect(
      await loadNotificationWhatsAppTemplates(workspaceId, job.senderPhoneNumberId!, deps),
    ).toEqual([]);
    expect(deps.readCloudTemplates).not.toHaveBeenCalled();
  });
});

it("managed email passes the final guard into the post-render transport", async () => {
  const authorize = vi.fn().mockResolvedValue(undefined);
  const deps = fakeDependencies({
    sendEmail: vi.fn(async (input) => {
      await input.beforeSend();
      return { status: "sent" as const };
    }),
  });
  expect((await deliver({ ...job, channel: "email" }, deps, authorize)).status).toBe("accepted");
  expect(authorize).toHaveBeenCalledTimes(2);
});
it.each([
  [{ status: 429, retryAfterSeconds: 7200 }, "retry_scheduled", "provider_rate_limited"],
  [{ status: 403 }, "failed", "provider_rejected"],
  [{ status: 503 }, "uncertain", "transport_unknown"],
  [new TypeError("PRIVATE network"), "uncertain", "transport_unknown"],
] as const)(
  "managed email distinguishes definite and ambiguous structured errors %j",
  async (error, status, reasonCode) => {
    const deps = fakeDependencies({ sendEmail: vi.fn().mockRejectedValue(error) });
    const result = await deliver({ ...job, channel: "email" }, deps);
    expect(result).toMatchObject({ provider: "managed_email", status, reasonCode });
    if (status === "retry_scheduled") expect(result.retryAfterSeconds).toBe(7200);
    expect(JSON.stringify(result)).not.toContain("PRIVATE");
  },
);
