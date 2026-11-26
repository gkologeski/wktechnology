import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ authorize: vi.fn(), rpc: vi.fn() }));
vi.mock("./import-journey-access.server", () => ({ authorizeImportJourney: m.authorize }));
vi.mock("@/lib/access-control/work-core.server", () => ({ workRpc: m.rpc }));
import {
  formatImportHistory,
  listJourneyEvidence,
  resolveImportSourceName,
} from "./import-journey-evidence.server";

function fixture() {
  const profileRead = vi.fn(async (ids: string[]) => ({
    data: ids.map((id) => ({ id, full_name: `Name ${id}` })),
    error: null as unknown,
  }));
  const filters: unknown[][] = [];
  const record = {
    select: vi.fn(),
    eq: vi.fn(),
    in: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    maybeSingle: vi.fn(async () => ({
      data: { provider: "clockify", label: "Origin name" },
      error: null,
    })),
  };
  for (const fn of [record.select, record.eq, record.in, record.order, record.limit])
    fn.mockImplementation((...args: unknown[]) => {
      filters.push(args);
      return record;
    });
  const db = {
    from: vi.fn((table: string) =>
      table === "profiles"
        ? { select: () => ({ in: (_column: string, ids: string[]) => profileRead(ids) }) }
        : record,
    ),
  } as unknown as SupabaseClient;
  return {
    ctx: { client: db, workspaceId: "workspace-a", userId: "actor-a" },
    profileRead,
    record,
    filters,
  };
}
beforeEach(() => {
  vi.clearAllMocks();
  m.authorize.mockResolvedValue({ workspaceId: "workspace-a" });
  m.rpc.mockResolvedValue({ versions: [], history: [], nextCursor: null });
});
it("lê a página de versões pelo usuário/RLS e retorna o cursor sem carregar os originais em massa", async () => {
  const { ctx } = fixture();
  m.rpc.mockResolvedValue({
    versions: [{ id: "version-50", received_at: "now", payload_hash: "hash" }],
    history: [],
    nextCursor: "version-50",
  });
  expect(
    await listJourneyEvidence(ctx, { id: "record-a", kind: "versions", cursor: "version-100" }),
  ).toEqual({
    versions: [{ id: "version-50", at: "now", hash: "hash" }],
    history: [],
    nextCursor: "version-50",
  });
  expect(m.rpc).toHaveBeenCalledWith(ctx.client, "project_import_evidence_page", {
    p_workspace: "workspace-a",
    p_record: "record-a",
    p_kind: "versions",
    p_cursor: "version-100",
  });
  expect(m.authorize).toHaveBeenCalledWith(ctx.client, ctx.userId, "clockify", false);
});
it("recusa mudança do workspace antes de consultar as evidências", async () => {
  const { ctx } = fixture();
  m.authorize.mockResolvedValue({ workspaceId: "workspace-b" });
  await expect(listJourneyEvidence(ctx, { id: "record-a", kind: "history" })).rejects.toThrow(
    "workspace ativo",
  );
  expect(m.rpc).not.toHaveBeenCalled();
});
it("propaga o bloqueio de cursor de outro registro em vez de fabricar uma página vazia", async () => {
  const { ctx } = fixture();
  m.rpc.mockRejectedValue(new Error("Cursor de evidência indisponível"));
  await expect(
    listJourneyEvidence(ctx, { id: "record-a", kind: "versions", cursor: "foreign" }),
  ).rejects.toThrow("Cursor");
});
it("resolve nomes de atores em lotes de no máximo 100 e identifica o responsável", async () => {
  const { ctx, profileRead } = fixture();
  const rows = Array.from({ length: 205 }, (_, i) => ({
    id: `event-${i}`,
    created_at: "now",
    actor_id: `actor-${i}`,
    assignee_id: null,
    note: "Conferência",
  }));
  const result = await formatImportHistory(ctx, rows);
  expect(profileRead.mock.calls.map(([ids]) => ids.length)).toEqual([100, 100, 5]);
  expect(result.at(-1)?.actor).toBe("Name actor-204");
});
it("usa o identificador histórico quando RLS não libera o nome, mas não oculta falha de consulta", async () => {
  const { ctx, profileRead } = fixture();
  const row = {
    id: "event",
    created_at: "now",
    actor_id: "historical",
    assignee_id: "reviewer",
    note: "Conferência",
  };
  profileRead.mockResolvedValue({ data: [], error: null });
  expect(await formatImportHistory(ctx, [row])).toEqual([
    {
      at: "now",
      actor: "Identidade histórica (historical)",
      note: "Responsável pela conferência: Identidade histórica (reviewer). Conferência",
    },
  ]);
  profileRead.mockResolvedValue({ data: [], error: { message: "timeout" } });
  await expect(formatImportHistory(ctx, [row])).rejects.toThrow("responsáveis");
});
it("resolve o nome da organização somente no mesmo workspace, provedor e origem", async () => {
  const { ctx, filters } = fixture();
  expect(await resolveImportSourceName(ctx, { provider: "clockify", sourceId: "source-a" })).toBe(
    "Origin name",
  );
  expect(filters).toEqual(
    expect.arrayContaining([
      ["workspace_id", "workspace-a"],
      ["provider", "clockify"],
      ["source_id", "source-a"],
      ["entity_type", ["workspace", "organization"]],
    ]),
  );
});
