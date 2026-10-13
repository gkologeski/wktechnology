import { describe, expect, it } from "vitest";
import { canDeleteCampaign, canEditCampaign, duplicateCampaignRow } from "./campaign-actions";

describe("ações de campanha WhatsApp", () => {
  it("bloqueia excluir campanha em envio", () => {
    expect(canDeleteCampaign("running")).toBe(false);
    expect(canDeleteCampaign("paused")).toBe(true);
    expect(canDeleteCampaign("completed")).toBe(true);
  });
  it("edita só rascunho ou pausada", () => {
    expect(canEditCampaign("draft")).toBe(true);
    expect(canEditCampaign("running")).toBe(false);
    expect(canEditCampaign("completed")).toBe(false);
  });
  it("cópia nasce em rascunho com contadores zerados", () => {
    const row = duplicateCampaignRow(
      { name: "Abordagem TI", status: "completed", sent: 40, failed: 2, template_name: "mensagem001" },
      42,
    );
    expect(row).toMatchObject({
      name: "Cópia de Abordagem TI",
      status: "draft",
      sent: 0,
      failed: 0,
      total: 42,
      template_name: "mensagem001",
      started_at: null,
    });
  });
});
