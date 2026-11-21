import { DEFAULT_NOTIFICATION_DELIVERY_POLICY } from "./delivery-types";
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

it.each(WORKFLOW_NOTIFICATION_EVENTS.filter((event) => event.moduleKey === "finance"))(
  "describes $key precisely without promising a financial effect",
  (event) => {
    const notes = inspectNotificationTrigger(workflowNotificationEventTrigger(event.key)).join(" ");
    expect(notes).toContain(event.label);
    expect(notes).toContain("sem execução ou mensagem real");
    expect(notes).toContain("não são copiados para o aviso");
    if (event.key.endsWith(".due")) {
      expect(notes).toContain("data civil atual");
      expect(notes).toContain("Não há antecedência");
    }
    if (event.key.endsWith(".overdue")) {
      expect(notes).toContain("dia civil seguinte");
      expect(notes).toContain("não tem antecedência");
      expect(notes).toContain("não faz pagamento");
    }
    if (event.key === "finance.invoice.received") {
      expect(notes).toContain("somente NF-e/NFS-e");
      expect(notes).toContain("Registro não equivale a conferência");
      expect(notes).toContain("somente leitura");
    }
  },
);

it("describes explicitly low initial digest without promising send or fallback", () => {
  const result = inspectNotificationActions(
    [
      {
        type: "send_notification",
        delivery: { channels: ["inapp", "whatsapp"], fallback: "email", priority: "low" },
      },
    ],
    { ...DEFAULT_NOTIFICATION_DELIVERY_POLICY, digest_enabled: true },
    null,
    "projects.task.overdue",
  );
  expect(result.issues.join(" ")).toContain("envio externo inicial pode entrar no resumo pessoal");
  expect(result.issues.join(" ")).toContain("A central permanece imediata");
  expect(result.issues.join(" ")).toContain("resumo não tem fallback automático");
  expect(result.realMessages).toBe(0);
});
it.each([undefined, "legacy.workflow", "people.approval.pending"])(
  "does not promise digest composition for %s",
  (eventKey) => {
    const result = inspectNotificationActions(
      [
        {
          type: "send_notification",
          delivery: { channels: ["inapp", "email"], fallback: "none", priority: "low" },
        },
      ],
      DEFAULT_NOTIFICATION_DELIVERY_POLICY,
      null,
      eventKey,
    );
    expect(result.issues.join(" ")).toContain("não participa do resumo");
    expect(result.issues.join(" ")).not.toContain("pode entrar no resumo pessoal");
  },
);
it("inspects bounded reminder and escalation without repeating the workflow or resolving recipients", () => {
  const result = inspectNotificationActions(
    [
      {
        type: "send_notification",
        delivery: {
          channels: ["inapp", "email"],
          fallback: "none",
          followup: {
            reminder: { interval_hours: 24, max_occurrences: 3 },
            escalation: {
              after_hours: 72,
              recipient: { kind: "user", id: "aaaaaaaa-1111-4111-8111-111111111111" },
            },
          },
        },
      },
    ],
    DEFAULT_NOTIFICATION_DELIVERY_POLICY,
    null,
    "projects.task.overdue",
  );
  expect(result.issues.join(" ")).toContain("intervalo de 24 horas, até 3 ocorrências");
  expect(result.issues.join(" ")).toContain("uma ocorrência após 72 horas");
  expect(result.issues.join(" ")).toContain("não repetem as outras ações");
  expect(result.issues.join(" ")).toContain("cota diária positiva");
  expect(result.realMessages).toBe(0);
});
it("makes current fiscal pending state explicit for NF followups", () => {
  const result = inspectNotificationActions(
    [
      {
        type: "send_notification",
        delivery: {
          channels: ["inapp"],
          fallback: "none",
          followup: { reminder: { interval_hours: 8, max_occurrences: 1 } },
        },
      },
    ],
    DEFAULT_NOTIFICATION_DELIVERY_POLICY,
    null,
    "finance.invoice.received",
  );
  expect(result.issues.join(" ")).toContain(
    "NF somente enquanto registrada e aguardando conferência",
  );
  expect(result.issues.join(" ")).toContain("rejeição encerra");
});
it("preserves immediate canonical preparation notice and forbids escalation in the preview", () => {
  const notes = inspectNotificationTrigger(
    workflowNotificationEventTrigger("people.approval.pending"),
  ).join(" ");
  expect(notes).toContain("não é agrupada em resumo");
  expect(notes).toContain("mesmo aprovador vigente, sem escalonamento");
  const result = inspectNotificationActions(
    [
      {
        type: "send_notification",
        delivery: {
          channels: ["inapp"],
          fallback: "none",
          followup: { escalation: { after_hours: 24, recipient: { kind: "workflow_owner" } } },
        },
      },
    ],
    DEFAULT_NOTIFICATION_DELIVERY_POLICY,
    null,
    "people.approval.pending",
  );
  expect(result.issues.join(" ")).toContain("sem escalonamento");
});

it.each(["finance.payable.due", "finance.receivable.due"])(
  "explains that %s followups stop at the civil date change instead of becoming overdue",
  (eventKey) => {
    const result = inspectNotificationActions(
      [
        {
          type: "send_notification",
          delivery: {
            channels: ["inapp"],
            fallback: "none",
            followup: { reminder: { interval_hours: 1, max_occurrences: 1 } },
          },
        },
      ],
      DEFAULT_NOTIFICATION_DELIVERY_POLICY,
      null,
      eventKey,
    );
    expect(result.issues.join(" ")).toContain("somente enquanto a conta é do dia");
    expect(result.issues.join(" ")).toContain("Na virada da data civil em São Paulo, encerra");
    expect(result.issues.join(" ")).toContain("não se converte em conta vencida");
    expect(result.realMessages).toBe(0);
  },
);
