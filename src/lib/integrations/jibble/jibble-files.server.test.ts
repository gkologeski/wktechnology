import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ read: vi.fn(), authorizeRead: vi.fn() }));
vi.mock("./jibble-screenshot", () => ({ readJibbleScreenshot: mocks.read }));
vi.mock("./jibble-service.server", () => ({ requireJibbleAdmin: mocks.authorizeRead }));
import { listJibbleSourceFiles, preserveJibbleScreenshot } from "./jibble-files.server";

const input = {
  workspaceId: "aaaaaaaa-0000-4000-8000-00000000000a",
  sourceId: "jibble-org",
  runId: "20000000-0000-4000-8000-000000000002",
  payload: {
    id: "capture-1",
    time: "2026-11-01T12:00:00Z",
    url: "https://storage.jibble.io/capture?sig=DO_NOT_STORE",
  },
};
function client(allowed = true) {
  const rpc = vi.fn(async (_name: string, _args: Record<string, unknown>) => ({
    error: allowed ? null : { message: "permission denied" },
  }));
  const upsert = vi.fn(async (_row: unknown, _options?: unknown) => ({ error: null }));
  const chain = {
    eq: vi.fn(),
    then: (resolve: (value: unknown) => unknown) => resolve({ error: null }),
  };
  chain.eq.mockReturnValue(chain);
  const update = vi.fn(() => chain);
  const from = vi.fn(() => ({ upsert, update }));
  const upload = vi.fn(async () => ({ error: null }));
  const db = { rpc, from, storage: { from: vi.fn(() => ({ upload })) } };
  return { db: db as unknown as SupabaseClient, rpc, upsert, from, upload };
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.read.mockResolvedValue({ bytes: new Uint8Array([1, 2, 3]), contentType: "image/png" });
  mocks.authorizeRead.mockResolvedValue({ workspaceId: input.workspaceId });
});
describe("preservação autorizada de arquivos Jibble", () => {
  it("permite preservar captura somente depois de autorizar ator, execução e origem", async () => {
    const c = client();
    const result = await preserveJibbleScreenshot(c.db, input);
    expect(result).toEqual({ preserved: true });
    expect(c.rpc).toHaveBeenCalledWith("jibble_import_file_authorize", {
      p_workspace: input.workspaceId,
      p_source: input.sourceId,
      p_run: input.runId,
    });
    expect(c.upload).toHaveBeenCalled();
    expect(c.upsert.mock.calls[0][0]).toMatchObject({
      workspace_id: input.workspaceId,
      source_org_id: input.sourceId,
      status: "preserved",
    });
    expect(JSON.stringify(c.upsert.mock.calls)).not.toContain("DO_NOT_STORE");
  });
  it("recusa preservação sem chave e não inicia download privilegiado", async () => {
    const c = client(false);
    await expect(preserveJibbleScreenshot(c.db, input)).rejects.toThrow("Sem autorização");
    expect(mocks.read).not.toHaveBeenCalled();
    expect(c.from).not.toHaveBeenCalled();
    expect(c.upload).not.toHaveBeenCalled();
  });
  it("recusa deny explícito do banco antes de transferir arquivo", async () => {
    const c = client(false);
    await expect(preserveJibbleScreenshot(c.db, input)).rejects.toThrow("Sem autorização");
    expect(mocks.read).not.toHaveBeenCalled();
    expect(c.upsert).not.toHaveBeenCalled();
  });
  it("recusa execução de outro workspace sem ler ou gravar seu conteúdo", async () => {
    const c = client(false);
    await expect(
      preserveJibbleScreenshot(c.db, {
        ...input,
        workspaceId: "bbbbbbbb-0000-4000-8000-00000000000b",
      }),
    ).rejects.toThrow("Sem autorização");
    expect(c.rpc.mock.calls[0][1]).toHaveProperty(
      "p_workspace",
      "bbbbbbbb-0000-4000-8000-00000000000b",
    );
    expect(mocks.read).not.toHaveBeenCalled();
  });
  it("recusa membro inativo revalidado na fronteira SQL", async () => {
    const c = client(false);
    await expect(preserveJibbleScreenshot(c.db, input)).rejects.toThrow("Sem autorização");
    expect(mocks.read).not.toHaveBeenCalled();
    expect(c.from).not.toHaveBeenCalled();
  });
  it("preserva metadados de falha sem URL ou erro remoto e mantém arquivo pendente", async () => {
    const c = client();
    mocks.read.mockRejectedValue(new Error("https://secret.invalid/?sig=DO_NOT_STORE"));
    expect(await preserveJibbleScreenshot(c.db, input)).toEqual({ preserved: false });
    expect(c.upsert.mock.calls[0][0]).toMatchObject({
      status: "pending",
      storage_path: null,
      sha256: null,
    });
    expect(JSON.stringify(c.upsert.mock.calls)).not.toContain("DO_NOT_STORE");
    expect(c.upload).not.toHaveBeenCalled();
  });

  it("permite consultar todas as versões de arquivos além do limite padrão do PostgREST", async () => {
    const files = Array.from({ length: 1001 }, (_, index) => ({
      id: `file-${index}`,
      title: `Captura ${index}`,
      bytes: 5,
      status: "preserved",
      issue: null,
      content_type: "image/png",
    }));
    const range = vi.fn(async (from: number, to: number) => ({
      data: files.slice(from, to + 1),
      error: null,
    }));
    const chain = { select: vi.fn(), eq: vi.fn(), neq: vi.fn(), order: vi.fn(), range };
    for (const method of [chain.select, chain.eq, chain.neq, chain.order])
      method.mockReturnValue(chain);
    const db = { from: vi.fn(() => chain) } as unknown as SupabaseClient;
    const result = await listJibbleSourceFiles(
      { client: db, workspaceId: input.workspaceId, userId: "active-admin" },
      { sourceId: input.sourceId, externalId: "capture-1" },
    );
    expect(result).toHaveLength(1001);
    expect(result.at(-1)?.id).toBe("file-1000");
    expect(range.mock.calls).toEqual([
      [0, 999],
      [1000, 1999],
    ]);
    expect(chain.eq).toHaveBeenCalledWith("workspace_id", input.workspaceId);
    expect(chain.eq).toHaveBeenCalledWith("source_org_id", input.sourceId);
    expect(mocks.authorizeRead).toHaveBeenCalledOnce();
  });
});
