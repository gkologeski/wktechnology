import { describe, expect, it } from "vitest";
import { decideArchive } from "./channel-archive";

const active = new Set(["conectado"]);
describe("decideArchive", () => {
  it("número conectado fica visível, mesmo se estava arquivado (reconectado)", () => {
    expect(
      decideArchive({
        sourceKey: "conectado",
        active,
        confirmed: true,
        currentArchivedAt: "2026-11-01",
        isNew: false,
      }).archived,
    ).toBe(false);
  });
  it("número só no histórico é arquivado", () => {
    expect(
      decideArchive({
        sourceKey: "bruna",
        active,
        confirmed: true,
        currentArchivedAt: null,
        isNew: false,
      }).archived,
    ).toBe(true);
  });
  it("sem confirmação do provedor, conta existente mantém o estado", () => {
    expect(
      decideArchive({
        sourceKey: "lia",
        active,
        confirmed: false,
        currentArchivedAt: null,
        isNew: false,
      }).archived,
    ).toBe(false);
  });
  it("sem confirmação, conta nova do histórico entra arquivada", () => {
    expect(
      decideArchive({
        sourceKey: "novo",
        active,
        confirmed: false,
        currentArchivedAt: null,
        isNew: true,
      }).archived,
    ).toBe(true);
  });
});
