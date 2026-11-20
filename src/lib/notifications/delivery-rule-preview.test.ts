import { expect, it } from "vitest";
import { inspectNotificationActions, inspectNotificationTrigger } from "./delivery-rule-preview";
import {
  WORKFLOW_NOTIFICATION_EVENTS,
  workflowNotificationEventTrigger,
} from "@/lib/workflows/notification-events";

const hr = WORKFLOW_NOTIFICATION_EVENTS.filter(
  (event) => event.moduleKey === "ats" || event.moduleKey === "people",
);
it.each(hr)("describes $key without promising execution, hiring or approval", (event) => {
  const notes = inspectNotificationTrigger(workflowNotificationEventTrigger(event.key)).join(" ");
  expect(notes).toContain(event.label);
  expect(notes).toContain("sem execução ou mensagem real");
  expect(notes).toContain("não cria contratação");
  expect(notes).not.toMatch(/undefined|PRIVATE_|token=/);
  if (["ats_offers", "people_documents", "hiring_preparation_requests"].includes(event.entity))
    expect(notes).toContain("somente leitura");
});
it("distinguishes the canonical evidence required for HR transitions", () => {
  const notes = (key: Parameters<typeof workflowNotificationEventTrigger>[0]) =>
    inspectNotificationTrigger(workflowNotificationEventTrigger(key)).join(" ");
  expect(notes("ats.application.received")).toContain("Reabertura ou edição do mesmo registro");
  expect(notes("ats.interview.scheduled")).toContain("Convite pendente");
  expect(notes("ats.offer.accepted")).toContain("assinatura canônica válida da versão enviada");
  expect(notes("people.employment.started")).toContain("Pode conter data futura");
  expect(notes("people.employment.started")).toContain("não comprova dia trabalhado");
});
it("describes document antecedence, inclusive civil deadline and excluded records", () => {
  const notes = inspectNotificationTrigger(
    workflowNotificationEventTrigger("people.document.expiring", 14),
  ).join(" ");
  expect(notes).toContain("14 dias");
  expect(notes).toContain("America/Sao_Paulo, incluindo o próprio prazo");
  expect(notes).toContain("vencidos ou de pessoa arquivada");
  expect(notes).toContain("não renova nem disponibiliza arquivos");
});
it("preserves the independent mandatory process notice and current named approver", () => {
  const notes = inspectNotificationTrigger(
    workflowNotificationEventTrigger("people.approval.pending"),
  ).join(" ");
  expect(notes).toContain("Somente solicitações profissionais");
  expect(notes).toContain("etapa atual liberada ao aprovador nomeado");
  expect(notes).toContain("desligar a regra ou esta preferência não remove esse aviso");
  expect(notes).toContain("sem duplicar");
  expect(notes).toContain("não permitem destinatários arbitrários");
});
it("structural action inspection records zero real messages and does not resolve a recipient", () => {
  const result = inspectNotificationActions(
    [
      {
        type: "send_notification",
        recipients: [{ kind: "pending_approvers" }],
        delivery: { channels: ["inapp"], fallback: "none" },
      },
    ],
    null,
  );
  expect(result.realMessages).toBe(0);
  expect(result.channels).toEqual(["inapp"]);
  expect(result.issues.join(" ")).toContain("Nenhuma mensagem foi enviada");
});
