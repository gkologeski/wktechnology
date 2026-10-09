// Teste de componente com fixtures sintéticas: confirma que os cartões da timeline
// exibem pin e selos de e-mail quando a RPC devolve esses campos (regressão 0086/0087).
import { describe, expect, it } from "vitest";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { EmailStatusBadges } from "./call-meta";
import { PinnedMark } from "./activity-card-controls";

type A = Parameters<typeof EmailStatusBadges>[0]["activity"];
const base = { id: "x", type: "email", subject: "s" } as unknown as A;
const act = (extra: Record<string, unknown>) => ({ ...base, ...extra }) as A;

describe("selos da timeline", () => {
  it("mostra direção e status do e-mail", () => {
    const html = renderToStaticMarkup(
      h(EmailStatusBadges, {
        activity: act({ email_direction: "inbound", email_status: "opened" }),
      }),
    );
    expect(html).toContain("recebido");
    expect(html).toContain("opened");
  });
  it("enviado para outbound; nada quando faltam campos", () => {
    expect(
      renderToStaticMarkup(
        h(EmailStatusBadges, { activity: act({ email_direction: "outbound" }) }),
      ),
    ).toContain("enviado");
    expect(renderToStaticMarkup(h(EmailStatusBadges, { activity: base }))).toBe("");
  });
  it("marca de fixada só com pinned_at", () => {
    expect(
      renderToStaticMarkup(h(PinnedMark, { activity: act({ pinned_at: "2026-10-01T00:00:00Z" }) })),
    ).toContain('aria-label="Fixada"');
    expect(renderToStaticMarkup(h(PinnedMark, { activity: base }))).toBe("");
  });
});
