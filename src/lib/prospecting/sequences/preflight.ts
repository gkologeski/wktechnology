import type { SequenceDefinition } from "./draft";
import { describeTemplate, checkTemplateVariables } from "@/lib/whatsapp/template-shape";
import type { ApprovedTemplate } from "@/lib/whatsapp/templates.server";
export type SequenceIssue = { stepId: string | null; code: string; message: string };
export function inspectSequence(definition: SequenceDefinition): SequenceIssue[] {
  const issues: SequenceIssue[] = [];
  const add = (stepId: string | null, code: string, message: string) =>
    issues.push({ stepId, code, message });
  if (
    !definition.steps.some((s) => s.type === "email" || s.type === "whatsapp" || s.type === "call")
  )
    add(null, "no_outreach", "Inclua ao menos uma etapa de contato.");
  definition.steps.forEach((s, i) => {
    if (s.type === "end" && i !== definition.steps.length - 1)
      add(
        s.id,
        "unreachable",
        "Há etapas depois do encerramento; mova o encerramento para o final.",
      );
    if (s.type === "email") {
      if (!s.accountId) add(s.id, "sender_missing", "Escolha a conta de e-mail.");
      if (!s.subject.trim() || !s.body.trim())
        add(s.id, "email_content", "Preencha assunto e mensagem do e-mail.");
      if (
        s.thread === "reply" &&
        !definition.steps.slice(0, i).some((p) => p.type === "email" && p.accountId === s.accountId)
      )
        add(s.id, "thread_missing", "Continuar conversa exige e-mail anterior com a mesma conta.");
    }
    if (s.type === "whatsapp") {
      if (!s.accountId) add(s.id, "sender_missing", "Escolha a conta WhatsApp.");
      if (!s.templateName.trim() || !s.language.trim())
        add(s.id, "template_missing", "Escolha um modelo aprovado e seu idioma.");
    }
    if (
      s.type === "agent" &&
      !definition.steps.slice(0, i).some((p) => p.type === "email" || p.type === "whatsapp")
    )
      add(
        s.id,
        "agent_missing_channel",
        "Inclua um e-mail ou WhatsApp antes de encaminhar ao agente, para definir a conversa e o canal.",
      );
    if (s.type === "wait") {
      if (
        s.source === "previous" &&
        !definition.steps.slice(0, i).some((p) => ["email", "whatsapp", "call"].includes(p.type))
      )
        add(s.id, "wait_missing_contact", "A espera precisa de uma etapa de contato anterior.");
      const previous = definition.steps
        .slice(0, i)
        .reverse()
        .find((s) => s.type === "email" || s.type === "whatsapp");
      if (
        s.onReply === "agent" &&
        !definition.settings.agentId &&
        !(previous?.type === "whatsapp" && previous.agentId)
      )
        add(
          s.id,
          "reply_agent_missing",
          "Escolha o agente padrão nas regras ou encaminhe a resposta para humano.",
        );
    }
    if ((s.type === "call" && s.mode === "human") || s.type === "task") {
      if (!s.assigneeId) add(s.id, "assignee_missing", "Escolha o responsável pela tarefa.");
    }
    if (s.type === "call" && s.mode === "automatic")
      add(
        s.id,
        "automatic_call_pending",
        "Chamadas automáticas exigem uma integração de telefonia habilitada; use uma chamada humana nesta sequência.",
      );
    if (s.type === "agent" && !s.agentId) add(s.id, "agent_missing", "Escolha o agente da etapa.");
    if (s.type === "condition" && s.yes === "agent" && !definition.settings.agentId)
      add(s.id, "branch_agent_missing", "O caminho Agente exige um agente padrão nas regras.");
  });
  return issues;
}
export function inspectSequenceTemplate(
  stepId: string,
  template: ApprovedTemplate,
  variables: Record<string, string>,
): SequenceIssue[] {
  const shape = describeTemplate(template.components);
  if (
    !Number.isSafeInteger(shape.variableCount) ||
    shape.variableCount > 20 ||
    /\{\{(?!\d+\}\})/.test(shape.body) ||
    shape.headerType === "LOCATION"
  )
    return [
      {
        stepId,
        code: "template_shape_unsupported",
        message:
          "Modelo com parâmetros não suportados nesta etapa. Escolha um modelo com até 20 variáveis numéricas no corpo.",
      },
    ];
  const check = checkTemplateVariables(shape, {
    variables: Array.from(
      { length: shape.variableCount },
      (_, i) => variables[String(i + 1)] || "",
    ),
  });
  if (!check.ok)
    return [
      {
        stepId,
        code: `template_${check.reason}`,
        message:
          check.reason === "missing_body"
            ? `Preencha a variável ${check.index} do modelo.`
            : "Este modelo exige cabeçalho ou mídia ainda não configurável nesta etapa; escolha um modelo de corpo de texto.",
      },
    ];
  // Dynamic URL, copy-code and authentication buttons need extra dispatch parameters.
  const raw = JSON.stringify(template.components);
  if (
    shape.buttons.some((b) => !["QUICK_REPLY", "URL", "PHONE_NUMBER"].includes(b.type)) ||
    (shape.buttons.some((b) => b.type === "URL") &&
      /\{\{/.test(raw.replace(JSON.stringify(shape.body), "")))
  )
    return [
      {
        stepId,
        code: "template_button_parameters",
        message:
          "Este modelo exige parâmetros adicionais de botão ainda não suportados nesta etapa.",
      },
    ];
  if (template.status !== "APPROVED")
    return [
      { stepId, code: "template_not_approved", message: "O modelo não está aprovado no provedor." },
    ];
  return [];
}
