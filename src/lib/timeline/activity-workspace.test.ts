import { beforeEach, describe, expect, it, vi } from "vitest";
import { resolveTimelineWorkspace } from "./activity-entities";

const db = vi.hoisted(() => ({
  from: vi.fn(),
  select: vi.fn(),
  eq: vi.fn(),
  maybeSingle: vi.fn(),
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: db.from } }));

beforeEach(() => {
  vi.clearAllMocks();
  db.from.mockReturnValue(db);
  db.select.mockReturnValue(db);
  db.eq.mockReturnValue(db);
});

describe("workspace da atividade", () => {
  it.each([
    ["related_lead_id", "leads"],
    ["related_contact_id", "contacts"],
    ["related_company_id", "companies"],
    ["related_deal_id", "deals"],
    ["related_ticket_id", "tickets"],
  ] as const)("resolve %s pela ficha permitida por RLS", async (key, table) => {
    db.maybeSingle.mockResolvedValue({ data: { workspace_id: "workspace-da-ficha" }, error: null });
    await expect(resolveTimelineWorkspace(key, "registro-alvo")).resolves.toBe(
      "workspace-da-ficha",
    );
    expect(db.from).toHaveBeenCalledWith(table);
    expect(db.eq).toHaveBeenCalledWith("id", "registro-alvo");
  });
  it("não usa um workspace padrão quando a ficha está oculta ou ausente", async () => {
    db.maybeSingle.mockResolvedValue({ data: null, error: null });
    await expect(resolveTimelineWorkspace("related_lead_id", "oculto")).rejects.toThrow(
      "indisponível",
    );
  });
  it("interrompe a gravação se a consulta ao workspace falhar", async () => {
    db.maybeSingle.mockResolvedValue({ data: null, error: { message: "consulta indisponível" } });
    await expect(resolveTimelineWorkspace("related_lead_id", "alvo")).rejects.toThrow(
      "consulta indisponível",
    );
  });
});
