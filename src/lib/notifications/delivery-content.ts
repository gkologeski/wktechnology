import { CANONICAL_APP_ORIGIN } from "@/lib/platform-domains";

export const NOTIFICATION_UPDATE_TEXT = "Há uma atualização solicitada no TechERP.";
export const NOTIFICATION_UPDATE_SUBJECT = "Atualização disponível no TechERP";

/** The argument comes from server configuration, never the event or a client URL. */
export function notificationCentralUrl(trustedOrigin = CANONICAL_APP_ORIGIN): string {
  const base = new URL(trustedOrigin);
  if (
    !["https:", "http:"].includes(base.protocol) ||
    base.username ||
    base.password ||
    base.search ||
    base.hash ||
    (base.pathname !== "/" && base.pathname !== "")
  )
    throw new Error("Origem da central indisponível.");
  return new URL("/notifications", base.origin).href;
}

export const NEUTRAL_NOTIFICATION_TEMPLATE_BODIES = [
  "Há uma atualização solicitada no TechERP. Acesse a central de notificações no sistema.",
  "Há uma atualização solicitada no TechERP. Acesse sua central: {{1}}.",
  "{{1}} Acesse sua central: {{2}}.",
];
type Component = { type?: unknown; format?: unknown; text?: unknown; buttons?: unknown };

type ExpectedTemplate = { name: string; language: string; centralUrl: string };

/** Safe explanations are useful in the catalogue without exposing connection credentials. */
export function notificationTemplateIncompatibility(
  template: Record<string, unknown>,
  expected: ExpectedTemplate,
): string | null {
  if (template.name !== expected.name || template.language !== expected.language)
    return "template_identity_mismatch";
  if (template.status !== "APPROVED") return "template_not_approved";
  if (template.category !== "UTILITY") return "template_not_utility";
  if (!Array.isArray(template.components)) return "template_components_invalid";
  const components = template.components as Component[];
  const kinds = ["BODY", "HEADER", "FOOTER", "BUTTONS"];
  if (
    components.some((c) => !c || !kinds.includes(String(c.type))) ||
    kinds.some((kind) => components.filter((c) => c?.type === kind).length > 1)
  )
    return "template_components_invalid";
  const body = components.find((c) => c.type === "BODY");
  if (
    typeof body?.text !== "string" ||
    !NEUTRAL_NOTIFICATION_TEMPLATE_BODIES.includes(body.text.replace(/\s+/g, " ").trim())
  )
    return "template_body_not_neutral";
  for (const c of components) {
    if (c.type === "HEADER" && (c.format !== "TEXT" || c.text !== "TechERP"))
      return "template_header_unsupported";
    if (c.type === "FOOTER" && c.text !== "Gerencie seus avisos na central do TechERP.")
      return "template_footer_unsupported";
    if (c.type === "BUTTONS") {
      if (!Array.isArray(c.buttons) || c.buttons.length !== 1)
        return "template_buttons_unsupported";
      const button = c.buttons[0] as Record<string, unknown>;
      if (
        !button ||
        button.type !== "URL" ||
        button.url !== expected.centralUrl ||
        button.text !== "Abrir central"
      )
        return "template_buttons_unsupported";
    }
  }
  return null;
}

/** Templates contain fixed text and central links only, never an event snapshot or source link. */
export function notificationTemplatePayload(
  template: Record<string, unknown>,
  expected: ExpectedTemplate,
) {
  if (notificationTemplateIncompatibility(template, expected)) return null;
  const body = (template.components as Component[]).find((c) => c.type === "BODY")!.text as string;
  const index = NEUTRAL_NOTIFICATION_TEMPLATE_BODIES.indexOf(body.replace(/\s+/g, " ").trim());
  const values =
    index === 0
      ? []
      : index === 1
        ? [expected.centralUrl]
        : [NOTIFICATION_UPDATE_TEXT, expected.centralUrl];
  return {
    name: expected.name,
    language: { code: expected.language },
    components: values.length
      ? [{ type: "body", parameters: values.map((text) => ({ type: "text", text })) }]
      : [],
  };
}
