import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  initialCollectCursor,
  taskPageComplete,
  flattenClickUpPages,
  clickUpTaskIssues,
  mergeClickUpTaskObservation,
  contextualClickUpObservation,
} from "./clickup-collection";
import { collectClickUpPage } from "./clickup-collection.server";
import {
  clickUpGet,
  readClickUpAttachment,
  assertClickUpAttachmentUrl,
} from "./clickup-api.server";
import { getSources, saveSources, collectStep } from "./clickup-import.server";
import { listClickUpSourceFiles, getClickUpSourceFileUrl } from "./clickup-files.server";
import { taskPayload } from "./clickup-plan";

const mocks = vi.hoisted(() => ({
  preserve: vi.fn(async () => undefined),
  admin: { rpc: vi.fn(), from: vi.fn() },
}));
vi.mock("@/lib/projects/imports/import-preservation.server", () => ({
  preserveImportRecords: mocks.preserve,
}));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: mocks.admin }));
vi.mock("./clickup-connection.server", () => ({
  getClickUpCredential: vi.fn(async () => "test-only-credential"),
}));

const WS = "00000000-0000-4000-8000-000000000001";
const USER = "00000000-0000-4000-8000-000000000002";
const RUN = "00000000-0000-4000-8000-000000000003";
const request = vi.fn();
function fakeClient(allowed = true, rows: Record<string, unknown[]> = {}) {
  const calls: { fn: string; args: unknown }[] = [];
  const rpc = vi.fn(async (fn: string, args: unknown) => {
    calls.push({ fn, args });
    return { data: fn === "clickup_import_access" ? allowed : null, error: null };
  });
  const client = {
    rpc,
    from: vi.fn((table: string) => {
      const q: Record<string, unknown> = {};
      for (const method of ["select", "eq", "order", "limit", "gt", "range", "in"])
        q[method] = vi.fn(() => q);
      q["maybeSingle"] = vi.fn(async () => ({ data: rows[table]?.[0] ?? null, error: null }));
      q["then"] = (resolve: (value: unknown) => unknown) =>
        Promise.resolve({ data: rows[table] ?? [], error: null }).then(resolve);
      return q;
    }),
  };
  return { client: client as unknown as SupabaseClient, calls, rpc };
}
const ctx = (client: SupabaseClient) => ({ client, workspaceId: WS, userId: USER });
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.admin.from.mockImplementation(() => {
    const chain: Record<string, unknown> = {};
    for (const key of ["select", "eq", "in"]) chain[key] = () => chain;
    chain["then"] = (resolve: (value: unknown) => unknown) =>
      Promise.resolve({ data: [], error: null }).then(resolve);
    return chain;
  });
  vi.stubEnv("CLICKUP_API_TOKEN", "test-only-credential");
  vi.stubGlobal("fetch", request);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("coleta integral ClickUp", () => {
  it("mantém respostas originais protegidas e apenas o DTO necessário no checkpoint", () => {
    const team = {
      id: "11",
      name: "WK",
      secret: "provider-extra",
      members: [
        { user: { id: 12, username: "Pessoa", avatar: "https://example.com/?token=signed" } },
      ],
    };
    const cursor = initialCollectCursor([team]);
    expect(cursor.teams).toEqual([
      { id: "11", name: "WK", members: [{ user: { id: 12, username: "Pessoa" } }] },
    ]);
    expect(JSON.stringify(cursor)).not.toContain("signed");
    const raw = {
      id: "comment",
      task_id: "native-value",
      document_id: "native-doc",
      _source_observation: "native",
    };
    expect(contextualClickUpObservation(raw, { taskId: "parent" })).toEqual({
      id: "comment",
      _source_observation: { payload: raw, context: { taskId: "parent" } },
    });
  });
  it("não interpreta last_page ausente em página cheia como fim do histórico", () => {
    expect(taskPageComplete(100)).toBe(false);
    expect(taskPageComplete(100, false)).toBe(false);
    expect(taskPageComplete(100, true)).toBe(true);
    expect(taskPageComplete(37)).toBe(true);
  });
  it("consulta espaços ativos e arquivados sem excluir organizações por nome", async () => {
    const c = { ...initialCollectCursor([{ id: "11", name: "CS" }]), phase: "hierarchy" as const };
    request.mockImplementation(async () => json({ spaces: [] }));
    const db = fakeClient();
    await collectClickUpPage(ctx(db.client), RUN, c);
    await collectClickUpPage(ctx(db.client), RUN, c);
    expect(
      request.mock.calls.map((a) => new URL(String(a[0])).searchParams.get("archived")),
    ).toEqual(["false", "true"]);
    expect(c.phase).toBe("tasks");
    expect(mocks.preserve).toHaveBeenCalledWith(
      mocks.admin,
      expect.objectContaining({ provider: "clickup", sourceId: "11" }),
    );
  });
  it("retoma organização e pessoas se a inicialização cair após gravar apenas a organização", async () => {
    const c = initialCollectCursor([{ id: "11", name: "WK" }]);
    const authorized = {
      id: "11",
      name: "WK",
      members: [{ user: { id: 12, username: "Historical person", email: "person@example.test" } }],
    };
    request.mockImplementation(async () =>
      json({
        teams: [authorized, { id: "99", name: "Other tenant", members: [{ user: { id: 99 } }] }],
      }),
    );
    mocks.preserve
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("Storage interrupted"));
    await expect(collectClickUpPage(ctx(fakeClient().client), RUN, c)).rejects.toThrow(
      "Storage interrupted",
    );
    expect(c.phase).toBe("organizations");
    expect(c.organizationIndex).toBe(0);
    await collectClickUpPage(ctx(fakeClient().client), RUN, c);
    expect(c.phase).toBe("hierarchy");
    expect(c.organizationIndex).toBe(1);
    expect(
      mocks.preserve.mock.calls.map(
        (call) => (call as unknown as [unknown, { sourceId: string }])[1].sourceId,
      ),
    ).toEqual(["11", "11", "11", "11"]);
    expect(mocks.preserve).toHaveBeenLastCalledWith(
      mocks.admin,
      expect.objectContaining({
        sourceId: "11",
        records: [
          expect.objectContaining({
            entity: "person",
            externalId: "12",
            payload: authorized.members[0]!.user,
          }),
        ],
      }),
    );
    expect(c.teams?.[0]?.members?.[0]?.user?.id).toBe(12);
  });
  it("catálogo inicial indisponível fica como lacuna e não é considerado uma organização vazia", async () => {
    const c = initialCollectCursor([{ id: "11", name: "WK" }]);
    request.mockResolvedValue(json({ teams: [{ id: "99", name: "Another source" }] }));
    await collectClickUpPage(ctx(fakeClient().client), RUN, c);
    expect(c.phase).toBe("hierarchy");
    expect(c.gaps).toEqual([expect.objectContaining({ entity: "organizations", sourceId: "11" })]);
    expect(mocks.preserve).not.toHaveBeenCalled();
  });
  it("preserva lançamentos malformados antes da normalização operacional", async () => {
    const c = {
      ...initialCollectCursor([{ id: "11", name: "WK" }]),
      phase: "tasks" as const,
      lists: ["22"],
      listTeams: { "22": "11" },
    };
    const bad = { name: "Registro sem ID", due_date: "impossível", assignees: "inválido" };
    request.mockResolvedValue(
      json({ tasks: [bad, { id: "t1", name: "Boa", list: { id: "22" }, assignees: [] }] }),
    );
    const db = fakeClient();
    await collectClickUpPage(ctx(db.client), RUN, c);
    const input = mocks.preserve.mock.calls[0] as unknown as [
      unknown,
      { records: { payload: unknown; status: string; issues: string[] }[] },
    ];
    expect(input[1].records[0]).toMatchObject({ payload: bad, status: "pending" });
    expect(input[1].records[0]!.issues).toContain("invalid_source_date");
    const stage = db.calls.find((a) => a.fn === "clickup_import_stage")!;
    expect(stage.args).toMatchObject({ p_tasks: [{ id: "t1" }] });
    expect(c.archived).toBe(true);
  });
  it("uma página cheia sem last_page continua na mesma lista", async () => {
    const c = {
      ...initialCollectCursor([{ id: "11", name: "WK" }]),
      phase: "tasks" as const,
      lists: ["22"],
      listTeams: { "22": "11" },
    };
    request.mockResolvedValue(
      json({
        tasks: Array.from({ length: 100 }, (_, i) => ({
          id: `t${i}`,
          name: "Tarefa",
          list: { id: "22" },
        })),
      }),
    );
    await collectClickUpPage(ctx(fakeClient().client), RUN, c);
    expect(c.page).toBe(1);
    expect(c.index).toBe(0);
    expect(c.archived).toBe(false);
  });
  it("inclui tarefas em múltiplas listas e preserva os dois vínculos de origem", async () => {
    const c = {
      ...initialCollectCursor([{ id: "11", name: "WK" }]),
      phase: "tasks" as const,
      lists: ["22"],
      listTeams: { "22": "11" },
    };
    request.mockResolvedValue(
      json({ tasks: [{ id: "task1", name: "Tarefa compartilhada", list: { id: "home" } }] }),
    );
    await collectClickUpPage(ctx(fakeClient().client), RUN, c);
    expect(new URL(String(request.mock.calls[0]![0])).searchParams.get("include_timl")).toBe(
      "true",
    );
    expect(mocks.preserve).toHaveBeenCalledWith(
      mocks.admin,
      expect.objectContaining({
        records: [
          expect.objectContaining({ entity: "task_list_membership", externalId: "task1:22" }),
        ],
      }),
    );
  });
  it("não presume vazio quando a origem nega o acesso a um tipo de registro", async () => {
    const c = {
      ...initialCollectCursor([{ id: "11", name: "WK" }]),
      phase: "related" as const,
      relatedTask: { id: "t1", teamId: "11" },
      relatedStage: "comments" as const,
    };
    request.mockResolvedValue(json({ error: "private" }, 403));
    await collectClickUpPage(ctx(fakeClient().client), RUN, c);
    expect(c.gaps).toEqual([
      expect.objectContaining({ entity: "comments", sourceId: "11", subjectId: "t1" }),
    ]);
    expect(c.relatedStage).toBe("attachments");
    expect(c.phase).not.toBe("done");
  });
  it("pagina comentários com data e identificador em conjunto", async () => {
    const c = {
      ...initialCollectCursor([{ id: "11", name: "WK" }]),
      phase: "related" as const,
      relatedTask: { id: "t1", teamId: "11" },
      relatedStage: "comments" as const,
    };
    request.mockResolvedValueOnce(
      json({
        comments: Array.from({ length: 25 }, (_, i) => ({
          id: String(100 - i),
          date: String(1000 - i),
        })),
      }),
    );
    await collectClickUpPage(ctx(fakeClient().client), RUN, c);
    request.mockResolvedValueOnce(json({ comments: [] }));
    await collectClickUpPage(ctx(fakeClient().client), RUN, c);
    const query = new URL(String(request.mock.calls[1]![0])).searchParams;
    expect(query.get("start_id")).toBe("76");
    expect(query.get("start")).toBe("976");
  });
  it("consulta histórico de horas desde epoch e de cada participante, não só os últimos 30 dias", async () => {
    const c = {
      ...initialCollectCursor(
        [{ id: "11", name: "WK", members: [{ user: { id: 12 } }, { user: { id: 13 } }] }],
        123456,
      ),
      phase: "time" as const,
    };
    request.mockImplementation(async () => json({ data: [] }));
    await collectClickUpPage(ctx(fakeClient().client), RUN, c);
    await collectClickUpPage(ctx(fakeClient().client), RUN, c);
    const queries = request.mock.calls.map((a) => new URL(String(a[0])).searchParams);
    expect(queries.map((q) => q.get("assignee"))).toEqual(["12", "13"]);
    expect(
      queries.every(
        (q) =>
          q.get("start_date") === "-8640000000000000" && q.get("end_date") === "8640000000000000",
      ),
    ).toBe(true);
  });
  it("preserva horas inválidas sem criar apontamentos nem liberar financeiro", async () => {
    const c = {
      ...initialCollectCursor([{ id: "11", name: "WK", members: [{ user: { id: 12 } }] }]),
      phase: "time" as const,
    };
    const db = fakeClient();
    request.mockResolvedValue(json({ data: [{ id: "timer1", duration: "-100", start: "123" }] }));
    await collectClickUpPage(ctx(db.client), RUN, c);
    expect(mocks.preserve).toHaveBeenCalledWith(
      mocks.admin,
      expect.objectContaining({
        records: [
          expect.objectContaining({
            entity: "time_entry",
            status: "pending",
            issues: ["invalid_or_running_duration"],
          }),
        ],
      }),
    );
    expect(db.calls.map((call) => call.fn)).toEqual(["clickup_import_access"]);
  });
  it("inclui subpáginas com conteúdo próprio e mantém a árvore do documento", () => {
    const tree = [
      {
        id: "p1",
        content: "pai",
        pages: [{ id: "p2", content: "filho", pages: [{ id: "p3", content: "neto" }] }],
      },
    ];
    const flat = flattenClickUpPages(tree);
    expect(flat.map((p) => p["id"])).toEqual(["p1", "p2", "p3"]);
    expect(flat[0]).toEqual(tree[0]);
  });
  it("campos inválidos ficam auditáveis e não derrubam a conversão de toda a página", () => {
    const bad = { id: "t1", name: null, assignees: "inválido", due_date: 1e30 };
    expect(clickUpTaskIssues(bad)).toContain("invalid_source_date");
    expect(taskPayload(bad as never)).toMatchObject({
      title: "(sem título)",
      due_at: null,
      assignees: [],
    });
    expect(taskPayload({ id: "t2", description: "x".repeat(25000) }).description).toHaveLength(
      25000,
    );
  });
  it("uma tarefa em várias listas usa somente sua lista principal na aplicação operacional", async () => {
    const c = {
      ...initialCollectCursor([{ id: "11", name: "WK" }]),
      phase: "tasks" as const,
      lists: ["extra", "home"],
      listTeams: { extra: "11", home: "11" },
    };
    request.mockResolvedValue(
      json({ tasks: [{ id: "task1", name: "Multilist", list: { id: "home" } }] }),
    );
    const db = fakeClient();
    await collectClickUpPage(ctx(db.client), RUN, c);
    const stage = db.calls.find((call) => call.fn === "clickup_import_stage");
    expect(stage!.args).toMatchObject({ p_tasks: [{ id: "task1", list_ext_id: "home" }] });
  });
  it("lista principal não autorizada mantém a tarefa pendente em vez de escolher a última lista", async () => {
    const c = {
      ...initialCollectCursor([{ id: "11", name: "WK" }]),
      phase: "tasks" as const,
      lists: ["extra"],
      listTeams: { extra: "11" },
    };
    request.mockResolvedValue(
      json({ tasks: [{ id: "task1", name: "Multilist", list: { id: "outside" } }] }),
    );
    const db = fakeClient();
    await collectClickUpPage(ctx(db.client), RUN, c);
    expect(db.calls.some((call) => call.fn === "clickup_import_stage")).toBe(false);
    expect(mocks.preserve).toHaveBeenCalledWith(
      mocks.admin,
      expect.objectContaining({
        records: [
          expect.objectContaining({
            entity: "task",
            status: "pending",
            issues: ["home_list_not_collected"],
          }),
        ],
      }),
    );
  });
  it("lista e detalhe compartilham uma identidade sem alternar a projeção a cada reimportação", () => {
    const listing = { id: "task1", name: "Original", list: { id: "home" } };
    const detail = {
      ...listing,
      description: "Complete",
      custom_fields: [{ id: "field", value: 25 }],
    };
    const first = mergeClickUpTaskObservation(null, listing, "list", "extra");
    const complete = mergeClickUpTaskObservation(first, detail, "detail");
    const reimport = mergeClickUpTaskObservation(complete, listing, "list", "extra");
    expect(reimport).toEqual(complete);
    expect(reimport["_source_observations"]).toEqual({ lists: { extra: listing }, detail });
    expect(reimport["name"]).toBe("Original");
  });
  it("datas futuras ou anteriores a 1970 continuam preservadas, mesmo se forem erros de lançamento", async () => {
    const c = {
      ...initialCollectCursor([{ id: "11", name: "WK", members: [{ user: { id: 12 } }] }]),
      phase: "time" as const,
    };
    const rows = [
      { id: "future", start: Date.UTC(2050, 0, 1), duration: 0 },
      { id: "past", start: Date.UTC(1960, 0, 1), duration: 60 },
    ];
    request.mockResolvedValue(json({ data: rows }));
    await collectClickUpPage(ctx(fakeClient().client), RUN, c);
    expect(mocks.preserve).toHaveBeenCalledWith(
      mocks.admin,
      expect.objectContaining({
        records: rows.map((payload) => expect.objectContaining({ payload })),
      }),
    );
  });
  it("faixa integral recusada vira lacuna e fallback não comprova integralidade", async () => {
    const c = {
      ...initialCollectCursor([{ id: "11", name: "WK", members: [{ user: { id: 12 } }] }]),
      phase: "time" as const,
    };
    request
      .mockResolvedValueOnce(json({ error: "range unsupported" }, 400))
      .mockResolvedValueOnce(json({ data: [] }));
    await collectClickUpPage(ctx(fakeClient().client), RUN, c);
    expect(c.timeRangeIndex).toBe(1);
    expect(c.gaps).toContainEqual(expect.objectContaining({ entity: "time_entry_date_range" }));
    await collectClickUpPage(ctx(fakeClient().client), RUN, c);
    expect(c.gaps!.length).toBeGreaterThan(0);
    expect(c.timeAcceptedRanges?.["11"]).toBe(1);
  });
  it("identificadores de horas ausentes mantêm observações distintas na mesma página", async () => {
    const c = {
      ...initialCollectCursor([{ id: "11", name: "WK", members: [{ user: { id: 12 } }] }]),
      phase: "time" as const,
    };
    request.mockResolvedValue(json({ data: [{ duration: 0 }, { duration: 0 }] }));
    await collectClickUpPage(ctx(fakeClient().client), RUN, c);
    const rows = (
      mocks.preserve.mock.calls[0] as unknown as [
        unknown,
        { records: { observationKey: string }[] },
      ]
    )[1].records;
    expect(rows.map((r) => r.observationKey)).toEqual(["time:12:0", "time:12:1"]);
  });
});

describe("fontes ClickUp vinculadas ao workspace", () => {
  it("retorna origens disponíveis sem selecionar todas automaticamente", async () => {
    request.mockResolvedValue(
      json({
        teams: [
          { id: "11", name: "WK" },
          { id: "99", name: "Outra organização" },
        ],
      }),
    );
    const result = await getSources(ctx(fakeClient().client));
    expect(result.available).toHaveLength(2);
    expect(result.selectedIds).toEqual([]);
  });
  it("recusa origem que não pertence às organizações disponíveis na credencial", async () => {
    request.mockResolvedValue(json({ teams: [{ id: "11", name: "WK" }] }));
    const db = fakeClient();
    await expect(saveSources(ctx(db.client), ["99"])).rejects.toThrow(/não está disponível/);
    expect(db.calls.map((c) => c.fn)).not.toContain("clickup_import_sources_set");
  });
  it("cursor enviado pelo navegador não pode inventar conclusão da coleta", async () => {
    const cursor = initialCollectCursor([{ id: "11", name: "WK" }]);
    const db = fakeClient(true, {
      clickup_import_runs: [
        {
          id: RUN,
          collect_cursor: cursor,
          collect_revision: 1,
          source_team_ids: ["11"],
          status: "collecting",
        },
      ],
      clickup_import_source_bindings: [{ team_id: "11" }],
    });
    request.mockImplementation(async () =>
      json({ teams: [{ id: "11", name: "WK", members: [] }] }),
    );
    mocks.admin.rpc.mockResolvedValue({ data: 2, error: null });
    const result = await collectStep(ctx(db.client), RUN, { ...cursor, phase: "done" });
    expect(result.done).toBe(false);
    expect(result.cursor.phase).toBe("hierarchy");
  });
});

describe("ClickUp — arquivos e fronteira externa", () => {
  it("nunca envia a chave ClickUp ao CDN de anexos", async () => {
    request.mockResolvedValue(
      new Response(new Uint8Array([1, 2, 3]), { headers: { "content-type": "application/pdf" } }),
    );
    const file = await readClickUpAttachment(
      "https://attachments-public.clickup.com/example.pdf?signature=temporary",
    );
    expect(file.bytes).toEqual(new Uint8Array([1, 2, 3]));
    expect(request.mock.calls[0]![1]).toMatchObject({
      method: "GET",
      redirect: "error",
      headers: { accept: "application/octet-stream" },
    });
    expect(request.mock.calls[0]![1].headers).not.toHaveProperty("Authorization");
  });
  it("nega downloads arbitrários ou com credenciais embutidas antes de consultar rede", () => {
    for (const url of [
      "http://attachments-public.clickup.com/x",
      "https://127.0.0.1/x",
      "https://user:pass@attachments.clickup.com/x",
      "https://attachments-public.clickup.com.evil.test/x",
    ])
      expect(() => assertClickUpAttachmentUrl(url)).toThrow();
    expect(request).not.toHaveBeenCalled();
  });
  it("não segue redirecionamento fornecido por arquivo da origem", async () => {
    request.mockRejectedValue(new TypeError("redirect mode is set to error"));
    await expect(readClickUpAttachment("https://attachments.clickup.com/x")).rejects.toThrow();
    expect(request.mock.calls[0]![1].redirect).toBe("error");
  });
  it("limite de conteúdo aborta a transferência em vez de declarar arquivo preservado", async () => {
    request.mockResolvedValue(
      new Response(new Uint8Array([1, 2, 3]), { headers: { "content-length": "100" } }),
    );
    await expect(readClickUpAttachment("https://attachments.clickup.com/x", 2)).rejects.toThrow(
      /limite/,
    );
  });
  it("recusa arquivo sem permissão antes de consultar armazenamento", async () => {
    const db = fakeClient(false);
    await expect(getClickUpSourceFileUrl(ctx(db.client), { id: RUN })).rejects.toThrow(
      /Sem permissão/,
    );
    await expect(
      listClickUpSourceFiles(ctx(db.client), { sourceId: "11", externalId: "file1" }),
    ).rejects.toThrow(/Sem permissão/);
    expect(db.client.from).not.toHaveBeenCalled();
    expect(request).not.toHaveBeenCalled();
  });
  it("API nunca expõe corpo privado de erro ou token ao usuário", async () => {
    request.mockResolvedValue(
      json({ secret: "sensitive-body", url: "https://private.test/?token=secret" }, 500),
    );
    await expect(clickUpGet("/team", {}, 2, "test-only-credential")).rejects.toThrow(
      "ClickUp respondeu 500.",
    );
    try {
      await clickUpGet("/team", {}, 2, "test-only-credential");
    } catch (error) {
      expect(String(error)).not.toMatch(/sensitive-body|private\.test|secret/);
    }
  });
});
