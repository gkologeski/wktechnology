// Regras puras do passo "Enviar WhatsApp" do construtor de fluxos.
// Usadas na validação de publicação (servidor) e na conferência do editor.
import { describeTemplate, checkTemplateVariables } from "@/lib/whatsapp/template-shape";

export type WhatsAppStep = {
  template_name?: string;
  template_language?: string;
  template_variables?: string[];
  body?: string;
  to_field?: string;
};

export type WhatsAppStepIssue =
  | { code: "NO_CONTENT"; message: string }
  | { code: "TEMPLATE_REQUIRED"; message: string }
  | { code: "TEMPLATE_NOT_APPROVED"; message: string }
  | { code: "TEMPLATE_VARIABLES_INCOMPLETE"; message: string }
  | { code: "TEMPLATE_MEDIA_UNSUPPORTED"; message: string };

export type CatalogTemplate = { name: string; language: string; components: unknown[] };

/**
 * Fluxo roda sem interação humana e normalmente fora da janela de 24 h:
 * só é publicável com modelo aprovado do canal e todas as variáveis definidas.
 */
export function validateWhatsAppStep(
  step: WhatsAppStep,
  catalog: CatalogTemplate[],
): WhatsAppStepIssue | null {
  const name = step.template_name?.trim();
  if (!name) {
    if (!step.body?.trim())
      return { code: "NO_CONTENT", message: "Informe o modelo aprovado do WhatsApp." };
    return {
      code: "TEMPLATE_REQUIRED",
      message:
        "Fora da janela de 24 horas o WhatsApp exige modelo aprovado: texto livre não é entregue pelo fluxo.",
    };
  }
  const lang = step.template_language?.trim();
  const tpl = catalog.find((t) => t.name === name && (!lang || t.language === lang));
  if (!tpl)
    return {
      code: "TEMPLATE_NOT_APPROVED",
      message: `O modelo "${name}" não está aprovado na conta WhatsApp conectada.`,
    };
  const shape = describeTemplate(tpl.components);
  if (shape.headerMediaRequired || shape.headerVariableCount > 0)
    return {
      code: "TEMPLATE_MEDIA_UNSUPPORTED",
      message: `O modelo "${name}" exige mídia ou variável no cabeçalho, ainda não suportada pelo fluxo.`,
    };
  const check = checkTemplateVariables(shape, {
    variables: step.template_variables ?? [],
  });
  if (!check.ok)
    return {
      code: "TEMPLATE_VARIABLES_INCOMPLETE",
      message: `Preencha todas as variáveis do modelo "${name}".`,
    };
  return null;
}

type AnyAction = { type: string; [k: string]: unknown };

/** Coleta recursivamente os passos de WhatsApp, inclusive dentro de ramos. */
export function collectWhatsAppSteps(actions: unknown): WhatsAppStep[] {
  const out: WhatsAppStep[] = [];
  const walk = (list: unknown) => {
    if (!Array.isArray(list)) return;
    for (const raw of list as AnyAction[]) {
      if (!raw || typeof raw !== "object") continue;
      if (raw.type === "send_whatsapp") out.push(raw as unknown as WhatsAppStep);
      walk(raw["then"]);
      walk(raw["else"]);
      walk(raw["default"]);
      for (const c of (raw["cases"] as { actions?: unknown }[] | undefined) ?? []) walk(c?.actions);
      for (const b of (raw["branches"] as { actions?: unknown }[] | undefined) ?? [])
        walk(b?.actions);
    }
  };
  walk(actions);
  return out;
}

/** Chave estável para não repetir o mesmo envio do mesmo run. */
export function whatsAppIdempotencyKey(p: {
  workspaceId: string;
  runId?: string | null;
  entityId: string;
  template: string;
  to: string;
}): string | null {
  if (!p.runId) return null;
  return `wf:${p.workspaceId}:${p.runId}:${p.entityId}:${p.template}:${p.to.replace(/\D/g, "")}`;
}
