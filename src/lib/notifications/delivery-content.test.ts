import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  NotificationUpdateEmail,
  template as emailTemplate,
} from "@/lib/email-templates/notification-update";
import { CANONICAL_APP_ORIGIN } from "@/lib/platform-domains";
import {
  NEUTRAL_NOTIFICATION_TEMPLATE_BODIES,
  notificationCentralUrl,
  notificationTemplateIncompatibility,
  notificationTemplatePayload,
} from "./delivery-content";

const expected = {
  name: "notification_update",
  language: "pt_BR",
  centralUrl: "https://erp.example.com/notifications",
};
function template(body = NEUTRAL_NOTIFICATION_TEMPLATE_BODIES[0]) {
  return {
    name: expected.name,
    language: expected.language,
    category: "UTILITY",
    status: "APPROVED",
    components: [{ type: "BODY", text: body }],
  };
}
describe("neutral notification content", () => {
  it.each(NEUTRAL_NOTIFICATION_TEMPLATE_BODIES)(
    "accepts only the canonical neutral body: %s",
    (body) => {
      expect(notificationTemplateIncompatibility(template(body), expected)).toBeNull();
      const payload = notificationTemplatePayload(template(body), expected);
      expect(payload).not.toBeNull();
      expect(JSON.stringify(payload)).not.toContain("{{");
    },
  );
  it.each([
    { status: "PENDING" },
    { status: "PAUSED" },
    { category: "MARKETING" },
    { language: "en_US" },
    { components: [{ type: "BODY", text: "Contrato de {{1}} no valor {{2}}" }] },
    { components: [{ type: "BODY", text: "Há uma atualização solicitada no TechERP. {{3}}" }] },
    {
      components: [
        { type: "BODY", text: NEUTRAL_NOTIFICATION_TEMPLATE_BODIES[0] },
        { type: "HEADER", format: "IMAGE" },
      ],
    },
    {
      components: [
        { type: "BODY", text: NEUTRAL_NOTIFICATION_TEMPLATE_BODIES[0] },
        { type: "FOOTER", text: "Nome privado" },
      ],
    },
    {
      components: [
        { type: "BODY", text: NEUTRAL_NOTIFICATION_TEMPLATE_BODIES[0] },
        {
          type: "BUTTONS",
          buttons: [{ type: "URL", text: "Abrir central", url: "https://evil.example/{{1}}" }],
        },
      ],
    },
    {
      components: [
        { type: "BODY", text: NEUTRAL_NOTIFICATION_TEMPLATE_BODIES[0] },
        { type: "BODY", text: NEUTRAL_NOTIFICATION_TEMPLATE_BODIES[0] },
      ],
    },
    { components: [null] },
    { components: null },
  ])("rejects unsupported live template shapes: %j", (patch) => {
    expect(notificationTemplatePayload({ ...template(), ...patch }, expected)).toBeNull();
  });
  it("allows only fixed, neutral optional header/footer and the central button", () => {
    const t = {
      ...template(),
      components: [
        ...template().components,
        { type: "HEADER", format: "TEXT", text: "TechERP" },
        { type: "FOOTER", text: "Gerencie seus avisos na central do TechERP." },
        {
          type: "BUTTONS",
          buttons: [{ type: "URL", text: "Abrir central", url: expected.centralUrl }],
        },
      ],
    };
    expect(notificationTemplateIncompatibility(t, expected)).toBeNull();
  });
  it.each([
    "javascript:alert(1)",
    "https://user:password@example.com",
    "https://erp.example.com/record",
    "https://erp.example.com?q=secret",
    "https://erp.example.com/#secret",
  ])("rejects unsafe server origin %s", (origin) => {
    expect(() => notificationCentralUrl(origin)).toThrow();
  });
  it("preserves server-configured origin while linking only to the authenticated central", () => {
    expect(notificationCentralUrl("https://erp.example.com/")).toBe(expected.centralUrl);
    expect(notificationCentralUrl("http://127.0.0.1:5190")).toBe(
      "http://127.0.0.1:5190/notifications",
    );
  });
});

describe("neutral notification email component", () => {
  it("renders a central link with no record details and no fixed recipient override", () => {
    const html = renderToStaticMarkup(
      createElement(NotificationUpdateEmail, { centralUrl: expected.centralUrl }),
    );
    expect(html).toContain(expected.centralUrl);
    expect(html).toContain("Há uma atualização solicitada no TechERP.");
    expect(html).toContain("Este aviso não aprova nem conclui uma tarefa.");
    expect(emailTemplate).not.toHaveProperty("to");
  });
  it.each([
    "https://example.com/contracts/private",
    "https://user:password@example.com/notifications",
    "javascript:alert(1)",
    "https://erp.example.com/notifications?record=private",
  ])("rejects unsafe preview URL %s", (centralUrl) => {
    const html = renderToStaticMarkup(createElement(NotificationUpdateEmail, { centralUrl }));
    expect(html).toContain(`${CANONICAL_APP_ORIGIN}/notifications`);
    expect(html).not.toContain("record=private");
    expect(html).not.toContain("user:password");
  });
});
