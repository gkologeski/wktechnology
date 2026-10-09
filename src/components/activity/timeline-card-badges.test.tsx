// Teste de componente com fixtures sintéticas: confirma que os cartões da timeline
// exibem pin e selos de e-mail quando a RPC devolve esses campos (regressão 0086/0087).
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { EmailStatusBadges } from "./call-meta";
import { PinnedMark } from "./activity-card-controls";

type A = Parameters<typeof EmailStatusBadges>[0]["activity"];
const base = { id: "x", type: "email", subject: "s" } as unknown as A;

describe("selos da timeline", () => {
  it("mostra direção e status do e-mail", () => {
    const html = renderToStaticMarkup(
      <EmailStatusBadges
        activity={{ ...base, email_direction: "inbound", email_status: "opened" } as A}
      />,
    );
    expect(html).toContain("recebido");
    expect(html).toContain("opened");
  });
  it("enviado para outbound; nada quando faltam campos", () => {
    expect(
      renderToStaticMarkup(
        <EmailStatusBadges activity={{ ...base, email_direction: "outbound" } as A} />,
      ),
    ).toContain("enviado");
    expect(renderToStaticMarkup(<EmailStatusBadges activity={base} />)).toBe("");
  });
  it("marca de fixada só com pinned_at", () => {
    expect(
      renderToStaticMarkup(
        <PinnedMark activity={{ ...base, pinned_at: "2026-10-01T00:00:00Z" } as A} />,
      ),
    ).toContain('aria-label="Fixada"');
    expect(renderToStaticMarkup(<PinnedMark activity={base} />)).toBe("");
  });
});
