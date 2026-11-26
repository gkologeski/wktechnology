import { describe, expect, it, vi } from "vitest";
import { FakeDb } from "../clockify/clockify-fake-db.test-utils";
import { createJibbleStore } from "./jibble-store.server";
import { monthWindows } from "./jibble-urls";

describe("leitura integral e escopo do armazenamento Jibble", () => {
  function authorizedDb() {
    const db = new FakeDb();
    vi.spyOn(db, "rpc").mockResolvedValue({ data: "actor", error: null } as never);
    return db;
  }
  it("permite adapter privilegiado apenas depois de validar ator e origem da execução", async () => {
    const db = authorizedDb();
    const store = await createJibbleStore(db as never, "wk", "org", "run");
    expect(db.rpc).toHaveBeenCalledWith("project_import_run_actor", {
      p_ws: "wk",
      p_provider: "jibble",
      p_source: "org",
      p_run: "run",
    });
    await expect(store.saveRun("other-run", {})).rejects.toThrow("outra execução");
  });
  it("nega adapter Jibble sem chave antes de consultar tabelas privilegiadas", async () => {
    const db = new FakeDb();
    vi.spyOn(db, "rpc").mockResolvedValue({ data: null, error: { message: "no key" } } as never);
    const from = vi.spyOn(db, "from");
    await expect(createJibbleStore(db as never, "wk", "org", "run")).rejects.toThrow(
      "sem permissão",
    );
    expect(from).not.toHaveBeenCalled();
  });
  it("nega adapter Jibble com deny explícito na autorização SQL", async () => {
    const db = new FakeDb();
    vi.spyOn(db, "rpc").mockResolvedValue({ data: null, error: { message: "deny" } } as never);
    const from = vi.spyOn(db, "from");
    await expect(createJibbleStore(db as never, "wk", "org", "run")).rejects.toThrow(
      "sem permissão",
    );
    expect(from).not.toHaveBeenCalled();
  });
  it("nega adapter Jibble para execução de outro workspace", async () => {
    const db = new FakeDb();
    vi.spyOn(db, "rpc").mockResolvedValue({
      data: null,
      error: { message: "foreign workspace" },
    } as never);
    const from = vi.spyOn(db, "from");
    await expect(createJibbleStore(db as never, "other-wk", "org", "run")).rejects.toThrow(
      "sem permissão",
    );
    expect(db.rpc).toHaveBeenCalledWith(
      "project_import_run_actor",
      expect.objectContaining({ p_ws: "other-wk" }),
    );
    expect(from).not.toHaveBeenCalled();
  });
  it("nega adapter Jibble para membro inativo apesar de identidade histórica", async () => {
    const db = new FakeDb();
    vi.spyOn(db, "rpc").mockResolvedValue({ data: null, error: { message: "inactive" } } as never);
    const from = vi.spyOn(db, "from");
    await expect(createJibbleStore(db as never, "wk", "org", "run")).rejects.toThrow(
      "sem permissão",
    );
    expect(from).not.toHaveBeenCalled();
  });
  it("lê todos os mapeamentos além de 20 mil somente da organização e workspace ativos", async () => {
    const db = authorizedDb();
    db.tables.time_import_mappings = Array.from({ length: 20_001 }, (_, i) => ({
      workspace_id: "wk",
      provider: "jibble",
      source_org_id: "org",
      entity_type: "person",
      external_id: String(i).padStart(6, "0"),
      target_id: `target-${i}`,
    }));
    db.tables.time_import_mappings.push(
      {
        workspace_id: "outro",
        provider: "jibble",
        source_org_id: "org",
        entity_type: "person",
        external_id: "foreign",
      },
      {
        workspace_id: "wk",
        provider: "jibble",
        source_org_id: "outra-org",
        entity_type: "person",
        external_id: "foreign-org",
      },
    );
    const store = await createJibbleStore(db as never, "wk", "org", "run");
    const rows = await store.loadMappings("person");
    expect(rows).toHaveLength(20_001);
    expect(rows.at(-1)?.target_id).toBe("target-20000");
    expect(rows.some((r) => r.external_id.startsWith("foreign"))).toBe(false);
  });
  it("confere sobreposições além do limite antigo de 20 mil sem perder a última hora", async () => {
    const db = authorizedDb();
    db.tables.project_time_entries = Array.from({ length: 20_001 }, (_, i) => ({
      id: String(i).padStart(6, "0"),
      workspace_id: "wk",
      user_id: "person",
      source: "import",
      started_at: "2026-11-01T10:00:00Z",
      stopped_at: "2026-11-01T11:00:00Z",
    }));
    db.tables.project_time_entries.push({
      id: "foreign",
      workspace_id: "outro",
      user_id: "person",
      started_at: "2026-11-01T10:00:00Z",
      stopped_at: "2026-11-01T11:00:00Z",
    });
    const rows = await (
      await createJibbleStore(db as never, "wk", "org", "run")
    ).erpEntries("person", "2026-11-01T09:00:00Z", "2026-11-01T12:00:00Z");
    expect(rows).toHaveLength(20_001);
    expect(rows.at(-1)?.id).toBe("020000");
    expect(rows.some((r) => r.id === "foreign")).toBe(false);
  });
  it("não trunca períodos acima de 600 meses e recusa período inválido", () => {
    const rows = monthWindows("1970-01-01", "2026-11-26");
    expect(rows.length).toBeGreaterThan(600);
    expect(rows.at(-1)?.from).toBe("2026-11-01");
    expect(() => monthWindows("inválido", "2026-11-26")).toThrow("Período");
  });
});
