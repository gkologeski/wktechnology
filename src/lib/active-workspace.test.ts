import { beforeEach, describe, expect, it, vi } from "vitest";
import { resolveActiveWorkspace } from "./active-workspace.server";
const db = vi.hoisted(() => ({
  from: vi.fn(),
  select: vi.fn(),
  eq: vi.fn(),
  order: vi.fn(),
  limit: vi.fn(),
  maybeSingle: vi.fn(),
}));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: db }));
beforeEach(() => {
  vi.resetAllMocks();
  for (const key of ["from", "select", "eq", "order", "limit"] as const)
    db[key].mockReturnValue(db);
});
const ok = (data: unknown) => ({ data, error: null });
describe("workspace ativo no servidor", () => {
  it("recusa membro inativo sem redirecionar silenciosamente para outro workspace", async () => {
    db.maybeSingle
      .mockResolvedValueOnce(ok(null))
      .mockResolvedValueOnce(ok({ active_workspace_id: "A" }))
      .mockResolvedValueOnce(ok(null));
    await expect(resolveActiveWorkspace("user")).rejects.toThrow("Acesso ao workspace");
    expect(db.eq).toHaveBeenCalledWith("status", "active");
    expect(db.maybeSingle).toHaveBeenCalledTimes(3);
  });
  it("aceita membro ativo", async () => {
    db.maybeSingle
      .mockResolvedValueOnce(ok(null))
      .mockResolvedValueOnce(ok({ active_workspace_id: "A" }))
      .mockResolvedValueOnce(ok({ workspace_id: "A" }));
    await expect(resolveActiveWorkspace("user")).resolves.toBe("A");
    expect(db.eq).toHaveBeenCalledWith("status", "active");
  });
  it("sem preferência, exige seleção explícita e não assume o primeiro vínculo", async () => {
    db.maybeSingle.mockResolvedValueOnce(ok(null)).mockResolvedValueOnce(ok(null));
    await expect(resolveActiveWorkspace("user")).rejects.toThrow("Selecione um workspace");
    expect(db.from).not.toHaveBeenCalledWith("workspace_members");
    expect(db.maybeSingle).toHaveBeenCalledTimes(2);
  });
  it("preserva a exceção explícita de administrador da plataforma", async () => {
    db.maybeSingle
      .mockResolvedValueOnce(ok({ user_id: "user" }))
      .mockResolvedValueOnce(ok({ active_workspace_id: "A" }));
    await expect(resolveActiveWorkspace("user")).resolves.toBe("A");
    expect(db.from).not.toHaveBeenCalledWith("workspace_members");
  });
  it("falha fechada quando a consulta de autorização falha", async () => {
    db.maybeSingle.mockResolvedValueOnce({
      data: null,
      error: { message: "database unavailable" },
    });
    await expect(resolveActiveWorkspace("user")).rejects.toThrow("database unavailable");
    expect(db.maybeSingle).toHaveBeenCalledTimes(1);
  });
});
