import { describe, expect, it, vi } from "vitest";
import {
  isSlackIncomingWebhookUrl,
  sendSlackNotification,
  type SlackNotificationDependencies,
  type SlackNotificationJob,
} from "./slack-transport.server";

const webhookUrl = "https://hooks.slack.com/services/T_FAKE/B_FAKE/secret_for_unit_test";

async function fixture() {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(webhookUrl));
  const endpointHash = Array.from(new Uint8Array(bytes), (n) =>
    n.toString(16).padStart(2, "0"),
  ).join("");
  const job: SlackNotificationJob = {
    id: "11111111-1111-4111-8111-111111111111",
    token: "22222222-2222-4222-8222-222222222222",
    channel: "slack",
    idempotencyKey: "notification-slack:fake-occurrence",
    workspaceId: "33333333-3333-4333-8333-333333333333",
    workflowId: "44444444-4444-4444-8444-444444444444",
    runId: "55555555-5555-4555-8555-555555555555",
    integrationId: "66666666-6666-4666-8666-666666666666",
    endpointRevision: 3,
    endpointHash,
  };
  const deps = {
    appOrigin: vi.fn().mockReturnValue("https://erp.example.com"),
    resolveEndpoint: vi.fn().mockResolvedValue({ webhookUrl }),
    fetch: vi.fn<typeof fetch>().mockResolvedValue(new Response("ok", { status: 200 })),
  } satisfies SlackNotificationDependencies;
  const beforeSend = vi.fn().mockResolvedValue(undefined);
  return { job, deps, beforeSend };
}

describe("protected collective Slack notification transport", () => {
  it("posts fixed neutral text once, after endpoint resolution and the last authorization check", async () => {
    const { job, deps, beforeSend } = await fixture();
    const steps: string[] = [];
    deps.resolveEndpoint.mockImplementation(async () => {
      steps.push("endpoint");
      return { webhookUrl };
    });
    beforeSend.mockImplementation(async () => {
      steps.push("authorized");
    });
    deps.fetch.mockImplementation(async () => {
      steps.push("post");
      return new Response("ok");
    });
    expect(await sendSlackNotification(job, deps, beforeSend)).toEqual({
      status: "accepted",
      provider: "slack_webhook",
      providerId: null,
    });
    expect(steps).toEqual(["endpoint", "authorized", "post"]);
    expect(deps.fetch).toHaveBeenCalledTimes(1);
    const [target, request] = deps.fetch.mock.calls[0];
    expect(target).toBe(webhookUrl);
    expect(request).toMatchObject({ method: "POST", redirect: "manual" });
    expect(request?.signal).toBeInstanceOf(AbortSignal);
    expect(JSON.parse(request!.body as string)).toEqual({
      text: "Há uma atualização solicitada no TechERP. Acesse a central de notificações: https://erp.example.com/notifications",
      mrkdwn: false,
      unfurl_links: false,
      unfurl_media: false,
    });
    expect(request?.body).not.toContain(job.workspaceId);
    expect(request?.body).not.toContain(job.integrationId);
    expect(request?.body).not.toContain(job.token);
    expect(request?.body).not.toContain("secret_for_unit_test");
  });

  it("requires a worker authorization callback even for a valid pinned endpoint", async () => {
    const { job, deps } = await fixture();
    expect(await sendSlackNotification(job, deps)).toMatchObject({
      status: "failed",
      reasonCode: "invalid_configuration",
    });
    expect(deps.resolveEndpoint).not.toHaveBeenCalled();
    expect(deps.fetch).not.toHaveBeenCalled();
  });

  it.each([
    { recipientId: "11111111-1111-4111-8111-111111111111" },
    { webhookUrl },
    { text: "Confidential source title" },
    { channel: "email" },
    { endpointRevision: 0 },
    { endpointHash: "not-a-fingerprint" },
  ])(
    "refuses malformed/personal/secret-bearing jobs before any private lookup: %j",
    async (extra) => {
      const { job, deps, beforeSend } = await fixture();
      expect(
        await sendSlackNotification({ ...job, ...extra } as SlackNotificationJob, deps, beforeSend),
      ).toMatchObject({ status: "failed", reasonCode: "invalid_configuration" });
      expect(deps.resolveEndpoint).not.toHaveBeenCalled();
      expect(deps.fetch).not.toHaveBeenCalled();
    },
  );

  it("does not POST after the endpoint changed", async () => {
    const { job, deps, beforeSend } = await fixture();
    deps.resolveEndpoint.mockResolvedValue({ webhookUrl: `${webhookUrl}_rotated` });
    expect(await sendSlackNotification(job, deps, beforeSend)).toMatchObject({
      status: "failed",
      reasonCode: "sender_unavailable",
    });
    expect(deps.fetch).not.toHaveBeenCalled();
    expect(beforeSend).not.toHaveBeenCalled();
  });

  it("does not POST if permission or the reservation was revoked immediately before transport", async () => {
    const { job, deps, beforeSend } = await fixture();
    beforeSend.mockRejectedValue(new Error("private authorization failure"));
    const result = await sendSlackNotification(job, deps, beforeSend);
    expect(result).toMatchObject({
      status: "retry_scheduled",
      reasonCode: "provider_preflight_unavailable",
    });
    expect(deps.fetch).not.toHaveBeenCalled();
    expect(JSON.stringify(result)).not.toContain("private authorization failure");
  });

  it("can safely defer an unavailable read-only endpoint resolver without exposing its error", async () => {
    const { job, deps, beforeSend } = await fixture();
    deps.resolveEndpoint.mockRejectedValue(new Error(webhookUrl));
    const result = await sendSlackNotification(job, deps, beforeSend);
    expect(result).toMatchObject({ status: "retry_scheduled", retryAfterSeconds: 60 });
    expect(JSON.stringify(result)).not.toContain(webhookUrl);
    expect(deps.fetch).not.toHaveBeenCalled();
  });

  it.each([
    "https://erp.example.com/record/secret",
    "javascript:alert(1)",
    "https://user:pass@erp.example.com",
  ])("rejects an unsafe configured origin before endpoint lookup: %s", async (origin) => {
    const { job, deps, beforeSend } = await fixture();
    deps.appOrigin.mockReturnValue(origin);
    expect(await sendSlackNotification(job, deps, beforeSend)).toMatchObject({ status: "failed" });
    expect(deps.resolveEndpoint).not.toHaveBeenCalled();
    expect(deps.fetch).not.toHaveBeenCalled();
  });

  it.each([
    [200, "not_ok", "uncertain"],
    [201, "ok", "uncertain"],
    [302, "redirect", "uncertain"],
    [400, "invalid_payload", "failed"],
    [403, "action_prohibited", "failed"],
    [404, "no_service", "failed"],
    [408, "timeout", "uncertain"],
    [500, "server_error", "uncertain"],
    [503, "unavailable", "uncertain"],
  ])("classifies HTTP %s honestly and never repeats POST", async (status, body, expected) => {
    const { job, deps, beforeSend } = await fixture();
    deps.fetch.mockResolvedValue(new Response(body as string, { status: status as number }));
    const result = await sendSlackNotification(job, deps, beforeSend);
    expect(result).toEqual({
      provider: "slack_webhook",
      status: expected,
      reasonCode: expected === "failed" ? "provider_rejected" : "transport_unknown",
    });
    expect(deps.fetch).toHaveBeenCalledTimes(1);
  });

  it.each(["1", "3601", "86400"])("honors Retry-After %s without shortening it", async (value) => {
    const { job, deps, beforeSend } = await fixture();
    deps.fetch.mockResolvedValue(
      new Response("ratelimited", { status: 429, headers: { "Retry-After": value } }),
    );
    expect(await sendSlackNotification(job, deps, beforeSend)).toMatchObject({
      status: "retry_scheduled",
      reasonCode: "provider_rate_limited",
      retryAfterSeconds: Number(value),
    });
    expect(deps.fetch).toHaveBeenCalledTimes(1);
  });

  it.each(["86401", "0", "-1", "1.5", "tomorrow", "9999999999999999999999", null])(
    "requires manual reconciliation rather than inventing or shortening Retry-After %s",
    async (value) => {
      const { job, deps, beforeSend } = await fixture();
      deps.fetch.mockResolvedValue(
        new Response("ratelimited", {
          status: 429,
          headers: value ? { "Retry-After": value } : {},
        }),
      );
      expect(await sendSlackNotification(job, deps, beforeSend)).toEqual({
        provider: "slack_webhook",
        status: "failed",
        reasonCode: "provider_rate_limited",
      });
    },
  );

  it("retains uncertainty after a network failure or aborted response", async () => {
    const { job, deps, beforeSend } = await fixture();
    deps.fetch.mockRejectedValue(new Error(`Network details ${webhookUrl}`));
    expect(await sendSlackNotification(job, deps, beforeSend)).toEqual({
      provider: "slack_webhook",
      status: "uncertain",
      reasonCode: "transport_unknown",
    });
    expect(deps.fetch).toHaveBeenCalledTimes(1);
  });

  it("stops and cancels an oversized provider response without buffering or exposing it", async () => {
    const { job, deps, beforeSend } = await fixture();
    const cancel = vi.fn();
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("private-provider-body".repeat(1000)));
      },
      cancel,
    });
    deps.fetch.mockResolvedValue(new Response(body, { status: 200 }));
    expect(await sendSlackNotification(job, deps, beforeSend)).toEqual({
      provider: "slack_webhook",
      status: "uncertain",
      reasonCode: "transport_unknown",
    });
    expect(cancel).toHaveBeenCalledOnce();
    expect(deps.fetch).toHaveBeenCalledOnce();
  });
});

describe("Slack webhook URL boundary", () => {
  it.each([
    "http://hooks.slack.com/services/T/B/secret",
    "https://hooks.slack.com.evil.test/services/T/B/secret",
    "https://hooks.slack.com@evil.test/services/T/B/secret",
    "https://user:password@hooks.slack.com/services/T/B/secret",
    "https://hooks.slack.com:444/services/T/B/secret",
    "https://hooks.slack.com/services/T/B/secret?token=extra",
    "https://hooks.slack.com/services/T/B/secret#fragment",
    "https://hooks.slack.com/services/T/B/secret/extra",
    "https://hooks.slack.com/not-services/T/B/secret",
    "https://hooks.slack.com/services/T/B/secret/../other",
    "https://hooks.slack.com/services/T/B/%73ecret",
    "https://hooks.slack.com/services/T/B/secret\n",
    "https://hooks%2Eslack.com/services/T/B/secret",
  ])("rejects %s", (value) => {
    expect(isSlackIncomingWebhookUrl(value)).toBe(false);
  });

  it("accepts only the fixed service endpoint, optionally with the default HTTPS port", () => {
    expect(isSlackIncomingWebhookUrl(webhookUrl)).toBe(true);
    expect(isSlackIncomingWebhookUrl(webhookUrl.replace(".com/", ".com:443/"))).toBe(true);
  });
});
