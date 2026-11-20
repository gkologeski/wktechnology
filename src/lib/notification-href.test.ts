import { describe, expect, it } from "vitest";
import { notificationHref } from "./notification-href";

const id = "11111111-2222-3333-4444-555555555555";

describe("notificationHref", () => {
  it("notificação antiga de WhatsApp abre a conversa pelo entity_id", () => {
    expect(
      notificationHref({ link: "/inbox/whatsapp", entity: "inbox_conversation", entity_id: id }),
    ).toEqual({ to: "/inbox/whatsapp", search: { conversation: id } });
  });
  it("notificação nova com conversa no link mantém a conversa", () => {
    expect(notificationHref({ link: `/inbox/whatsapp?conversation=${id}` })).toEqual({
      to: "/inbox/whatsapp",
      search: { conversation: id },
    });
  });
  it("sem link não navega", () => {
    expect(notificationHref({ link: null })).toBeNull();
  });
  it.each([
    "https://example.com",
    "//example.com",
    "javascript:alert(1)",
    "/\\example.com",
    "/%2f%2fexample.com",
    "/deals/../settings",
    "/unknown",
    "/deals\n",
    "/inbox?redirect=https://example.com",
  ])("rejeita destino não comprovado %s", (link) => {
    expect(notificationHref({ link })).toBeNull();
  });
  it("preserva a tarefa e o pedido nas rotas canônicas", () => {
    expect(notificationHref({ link: `/projects/tasks?taskId=${id}` })).toEqual({
      to: "/projects/tasks",
      search: { taskId: id },
    });
    expect(notificationHref({ link: `/contracts/supplier-requests?request=${id}` })).toEqual({
      to: "/contracts/supplier-requests",
      search: { request: id },
    });
  });
  it("preserva minutas e decisões de perfil nas rotas comprovadas", () => {
    expect(notificationHref({ link: `/contracts/drafts/${id}` })).toEqual({
      to: `/contracts/drafts/${id}`,
    });
    expect(notificationHref({ link: `/deals/${id}?profile=${id}&approval=${id}` })).toEqual({
      to: `/deals/${id}`,
      search: { profile: id, approval: id },
    });
  });
});

it.each(["/inbox/email", "/inbox/chat", "/inbox/linkedin"])(
  "opens the exact authorized conversation for %s",
  (path) => {
    expect(notificationHref({ link: path, entity: "inbox_conversation", entity_id: id })).toEqual({
      to: path,
      search: { conversation: id },
    });
  },
);
it("does not derive a conversation from malformed identifiers", () => {
  expect(
    notificationHref({
      link: "/inbox/email",
      entity: "inbox_conversation",
      entity_id: "other&redirect=external",
    }),
  ).toEqual({ to: "/inbox/email" });
});
