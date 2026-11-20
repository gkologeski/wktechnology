import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { dispatchWorkflowNotification } from "./notification-dispatch.server";
import {
  effectiveNotificationRecipients,
  notificationRecipientRulesSchema,
} from "./notification-recipients";
import { handleMessagingAction } from "./workflows/engine/actions-messaging.server";
import type { RunCtx } from "./workflows/engine/run-context";

const W = "11111111-1111-4111-8111-111111111111";
const R = "22222222-2222-4222-8222-222222222222";
const U = "33333333-3333-4333-8333-333333333333";
const ctx: RunCtx = {
  workspaceId: W,
  workflowId: W,
  workflowVersion: 2,
  runId: R,
  entity: "people",
  entityId: R,
  ownerId: U,
  notificationStepKey: "0.then.1",
  after: { salary: "PRIVATE", document: "PRIVATE", workspace_id: W },
  before: null,
  vars: { secret: "PRIVATE" },
};
const success = { sent: 1, candidates: 1, excluded: 0, duplicate: 0, issues: [] };
function client(result: unknown = success, error: { message: string } | null = null) {
  const rpc = vi.fn().mockResolvedValue({ data: result, error });
  const from = vi.fn(() => {
    throw new Error("No direct fallback writes allowed");
  });
  return { client: { rpc, from } as unknown as SupabaseClient, rpc, from };
}

describe("regras de destinatários", () => {
  it("preserva executor padrão e usuário explícito de fluxos legados", () => {
    expect(effectiveNotificationRecipients({})).toEqual([{ kind: "workflow_owner" }]);
    expect(effectiveNotificationRecipients({ user_id: " " })).toEqual([{ kind: "workflow_owner" }]);
    expect(effectiveNotificationRecipients({ user_id: U })).toEqual([{ kind: "user", id: U }]);
  });
  it("não substitui seleção dinâmica ausente por CEO, dono ou usuário legado", () => {
    expect(
      effectiveNotificationRecipients({ user_id: U, recipients: [{ kind: "area_manager" }] }),
    ).toEqual([{ kind: "area_manager" }]);
    expect(() => effectiveNotificationRecipients({ user_id: U, recipients: [] })).toThrow();
  });
  it.each(
    [
      [{ kind: "user", id: "not-uuid" }],
      [{ kind: "ceo" }],
      [{ kind: "team" }],
      [{ kind: "source_responsible", id: U }],
      [{ kind: "job_role", id: U, grant: true }],
      Array.from({ length: 11 }, () => ({ kind: "workflow_owner" })),
    ].map((rules) => ({ rules })),
  )("recusa seleção inválida sem executar consulta %j", ({ rules }) => {
    expect(notificationRecipientRulesSchema.safeParse(rules).success).toBe(false);
  });
});

describe("dispatch atômico de notificação", () => {
  it("envia intenção e contexto verificável ao gateway, sem materializar snapshot privado", async () => {
    const c = client();
    const action = {
      type: "send_notification" as const,
      title: "{{salary}}",
      body: "{{vars.secret}}",
      recipients: [{ kind: "area_manager" as const }],
    };
    expect(await dispatchWorkflowNotification(c.client, action, ctx)).toEqual(success);
    expect(c.rpc).toHaveBeenCalledExactlyOnceWith("notification_workflow_dispatch", {
      p_workflow: W,
      p_run: R,
      p_version: 2,
      p_entity: "people",
      p_record: R,
      p_rules: [{ kind: "area_manager" }],
      p_title: "{{salary}}",
      p_body: "{{vars.secret}}",
      p_step: "0.then.1",
    });
    expect(JSON.stringify(c.rpc.mock.calls)).not.toContain("PRIVATE");
    expect(c.from).not.toHaveBeenCalled();
  });
  it("não registra título, corpo, dados da origem ou usuários recusados no log do motor", async () => {
    const c = client();
    const log = await handleMessagingAction(
      c.client,
      { type: "send_notification", title: "{{salary}}", body: "{{document}}" },
      ctx,
      "2026-11-20T10:00:00Z",
    );
    expect(log).toEqual({
      at: "2026-11-20T10:00:00Z",
      action: "send_notification",
      ok: true,
      detail: success,
    });
    expect(JSON.stringify(log)).not.toContain("PRIVATE");
    expect(c.from).not.toHaveBeenCalled();
  });
  it.each(["workflowId", "workflowVersion", "runId", "notificationStepKey"] as const)(
    "não envia sem %s da execução",
    async (key) => {
      const c = client();
      await expect(
        dispatchWorkflowNotification(
          c.client,
          { type: "send_notification", title: "Aviso" },
          { ...ctx, [key]: undefined },
        ),
      ).rejects.toThrow("origem verificável");
      expect(c.rpc).not.toHaveBeenCalled();
    },
  );
  it("não usa insert direto quando o serviço, a migração ou a autorização falham", async () => {
    const c = client(null, { message: "permission denied" });
    await expect(
      dispatchWorkflowNotification(c.client, { type: "send_notification", title: "Aviso" }, ctx),
    ).rejects.toThrow("permission denied");
    expect(c.from).not.toHaveBeenCalled();
  });
  it.each([
    "inactive_member",
    "recipient_unreadable",
    "manager_unavailable",
    "unsupported_followers",
  ])("torna visível o bloqueio %s, sem escolher outro destinatário", async (issue) => {
    const c = client({ sent: 0, duplicate: 0, candidates: 1, excluded: 1, issues: [issue] });
    await expect(
      dispatchWorkflowNotification(c.client, { type: "send_notification", title: "Aviso" }, ctx),
    ).rejects.toThrow("Notificação bloqueada");
    expect(c.rpc).toHaveBeenCalledTimes(1);
    expect(c.from).not.toHaveBeenCalled();
  });
  it("não transforma resultado vazio ou malformado em confirmação de envio", async () => {
    const c = client({ sent: 0, duplicate: 0, candidates: 0, excluded: 0, issues: [] });
    await expect(
      dispatchWorkflowNotification(c.client, { type: "send_notification", title: "Aviso" }, ctx),
    ).rejects.toThrow("bloqueada");
    const bad = client({ sent: "true" });
    await expect(
      dispatchWorkflowNotification(bad.client, { type: "send_notification", title: "Aviso" }, ctx),
    ).rejects.toThrow();
  });
  it("explica o limite de público sem aceitar envio parcial de mais de duzentos destinatários", async () => {
    const c = client({
      sent: 0,
      candidates: 201,
      excluded: 201,
      duplicate: 0,
      issues: ["recipient_limit_exceeded"],
    });
    await expect(
      dispatchWorkflowNotification(c.client, { type: "send_notification", title: "Aviso" }, ctx),
    ).rejects.toThrow("limite de 200");
    expect(c.from).not.toHaveBeenCalled();
  });
  it.each([
    { sent: 0, candidates: 1, excluded: 0, duplicate: 1, issues: [] },
    { sent: 0, candidates: 1, excluded: 1, duplicate: 0, issues: ["preferences_disabled"] },
    { sent: 0, candidates: 0, excluded: 0, duplicate: 0, issues: ["test_mode"] },
  ])("preserva supressão ou repetição sem repetir o envio %j", async (result) => {
    const c = client(result);
    expect(
      await dispatchWorkflowNotification(
        c.client,
        { type: "send_notification", title: "Aviso" },
        ctx,
      ),
    ).toEqual(result);
    expect(c.rpc).toHaveBeenCalledTimes(1);
  });
});
