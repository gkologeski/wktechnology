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
});
