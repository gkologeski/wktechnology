import { describe, expect, it, vi } from "vitest";
import { PermissionDeniedError } from "@/lib/access-control/enforce.server";
import {
  runCreateProjectUpdate,
  runGetProjectDelivery,
  runUpdateProjectUpdate,
} from "./delivery.server";

const WORKSPACE_ID = "11111111-1111-4111-8111-111111111111";
const PROJECT_ID = "22222222-2222-4222-8222-222222222222";
const UPDATE_ID = "33333333-3333-4333-8333-333333333333";
const USER_ID = "44444444-4444-4444-8444-444444444444";

type MockOptions = {
  projectVisible?: boolean;
  updateVisible?: boolean;
  allowedKeys?: string[];
  explicitDenyKeys?: string[];
  inactiveMember?: boolean;
};

function makeSupabaseMock(opts: MockOptions) {
  const inserts: Record<string, unknown>[] = [];
  const updates: Record<string, unknown>[] = [];

  const supabase = {
    rpc: vi.fn(async (fn: string, params: Record<string, unknown>) => {
      if (fn !== "user_has_permission") return { data: false, error: null };
      if (opts.inactiveMember) return { data: false, error: null };
      const key = String(params["_permission_key"] ?? "");
      if (opts.explicitDenyKeys?.includes(key)) return { data: false, error: null };
      return { data: Boolean(opts.allowedKeys?.includes(key)), error: null };
    }),
    from: vi.fn((table: string) => {
      if (table === "projects") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () =>
                opts.projectVisible === false
                  ? { data: null, error: null }
                  : {
                      data: {
                        id: PROJECT_ID,
                        workspace_id: WORKSPACE_ID,
                        name: "NEXID",
                        status: "active",
                        progress: 34,
                        due_at: "2026-12-28",
                        contract_id: null,
                        contracts: null,
                      },
                      error: null,
                    },
            }),
          }),
        };
      }

      if (table === "project_updates") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () =>
                opts.updateVisible === false
                  ? { data: null, error: null }
                  : { data: { id: UPDATE_ID, workspace_id: WORKSPACE_ID }, error: null },
            }),
            in: () => ({
              order: () => ({
                limit: async () => ({
                  data: [
                    {
                      id: UPDATE_ID,
                      project_id: PROJECT_ID,
                      kind: "checkpoint",
                      title: "Marco de acompanhamento",
                      summary: null,
                      health: "green",
                      progress_value: "34.30",
                      expected_delivery_date: "2026-12-28",
                      visibility: "commercial",
                      published_at: "2026-11-27T13:00:00Z",
                      author_id: USER_ID,
                      owner_id: USER_ID,
                    },
                  ],
                  error: null,
                }),
              }),
            }),
          }),
          insert: (payload: Record<string, unknown>) => {
            inserts.push(payload);
            return {
              select: () => ({
                single: async () => ({
                  data: {
                    id: UPDATE_ID,
                    project_id: payload["project_id"],
                    kind: "checkpoint",
                    title: payload["title"],
                    summary: payload["summary"] ?? null,
                    health: payload["health"] ?? null,
                    progress_value: payload["progress_value"] ?? null,
                    expected_delivery_date: payload["expected_delivery_date"] ?? null,
                    visibility: payload["visibility"] ?? "commercial",
                    published_at: "2026-11-27T13:15:00Z",
                    author_id: USER_ID,
                    owner_id: USER_ID,
                  },
                  error: null,
                }),
              }),
            };
          },
          update: (payload: Record<string, unknown>) => {
            updates.push(payload);
            return {
              eq: () => ({
                select: () => ({
                  single: async () => ({
                    data: {
                      id: UPDATE_ID,
                      project_id: PROJECT_ID,
                      kind: "checkpoint",
                      title: payload["title"] ?? "Marco de acompanhamento",
                      summary: payload["summary"] ?? null,
                      health: payload["health"] ?? "green",
                      progress_value: payload["progress_value"] ?? null,
                      expected_delivery_date: payload["expected_delivery_date"] ?? null,
                      visibility: payload["visibility"] ?? "commercial",
                      published_at: "2026-11-27T13:20:00Z",
                      author_id: USER_ID,
                      owner_id: USER_ID,
                    },
                    error: null,
                  }),
                }),
              }),
            };
          },
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    }),
  };

  return {
    supabase: supabase as unknown as Parameters<typeof runCreateProjectUpdate>[0],
    inserts,
    updates,
  };
}

describe("project delivery updates authorization and decimal persistence", () => {
  it("allows authorized active member to publish and read decimal progress_value", async () => {
    const { supabase, inserts, updates } = makeSupabaseMock({
      allowedKeys: [
        "techprojects.project_updates.create.own",
        "techprojects.project_updates.update.own",
      ],
    });

    const created = await runCreateProjectUpdate(supabase, USER_ID, {
      projectId: PROJECT_ID,
      title: "Marco de acompanhamento",
      summary: "Resumo",
      health: "green",
      progressPct: 34.3,
      expectedDeliveryDate: "2026-12-28",
      visibility: "commercial",
    });

    expect(inserts).toHaveLength(1);
    expect(inserts[0]?.["progress_value"]).toBe(34.3);
    expect(inserts[0]?.["progress_pct"]).toBeUndefined();
    expect(created.progress_value).toBe(34.3);

    const edited = await runUpdateProjectUpdate(supabase, USER_ID, {
      id: UPDATE_ID,
      progressPct: 34.25,
    });
    expect(updates[0]?.["progress_value"]).toBe(34.25);
    expect(edited.progress_value).toBe(34.25);

    const loaded = await runGetProjectDelivery(supabase, PROJECT_ID);
    expect(loaded.project?.updates[0]?.progress_value).toBe(34.3);
  });

  it("denies publishing project update when create permission is missing", async () => {
    const { supabase, inserts } = makeSupabaseMock({ allowedKeys: [] });
    await expect(
      runCreateProjectUpdate(supabase, USER_ID, {
        projectId: PROJECT_ID,
        title: "Sem permissão",
        progressPct: 34.3,
        visibility: "commercial",
      }),
    ).rejects.toBeInstanceOf(PermissionDeniedError);
    expect(inserts).toHaveLength(0);
  });

  it("respects explicit deny before inserting or updating project update", async () => {
    const { supabase, inserts, updates } = makeSupabaseMock({
      allowedKeys: [
        "techprojects.project_updates.create.own",
        "techprojects.project_updates.update.workspace",
      ],
      explicitDenyKeys: [
        "techprojects.project_updates.create.own",
        "techprojects.project_updates.update.workspace",
      ],
    });
    await expect(
      runCreateProjectUpdate(supabase, USER_ID, {
        projectId: PROJECT_ID,
        title: "Negado",
        progressPct: 34.3,
        visibility: "commercial",
      }),
    ).rejects.toBeInstanceOf(PermissionDeniedError);
    await expect(
      runUpdateProjectUpdate(supabase, USER_ID, {
        id: UPDATE_ID,
        progressPct: 50.5,
      }),
    ).rejects.toBeInstanceOf(PermissionDeniedError);
    expect(inserts).toHaveLength(0);
    expect(updates).toHaveLength(0);
  });

  it("isolates projects and updates from another workspace", async () => {
    const { supabase, inserts, updates } = makeSupabaseMock({
      projectVisible: false,
      updateVisible: false,
      allowedKeys: [
        "techprojects.project_updates.create.own",
        "techprojects.project_updates.update.workspace",
      ],
    });
    await expect(
      runCreateProjectUpdate(supabase, USER_ID, {
        projectId: PROJECT_ID,
        title: "Outro workspace",
        progressPct: 34.3,
        visibility: "commercial",
      }),
    ).rejects.toThrow("Projeto não encontrado.");
    await expect(
      runUpdateProjectUpdate(supabase, USER_ID, {
        id: UPDATE_ID,
        progressPct: 34.3,
      }),
    ).rejects.toThrow("Acompanhamento não encontrado.");
    expect(await runGetProjectDelivery(supabase, PROJECT_ID)).toEqual({ project: null });
    expect(inserts).toHaveLength(0);
    expect(updates).toHaveLength(0);
  });

  it("rejects inactive workspace member before mutating project updates", async () => {
    const { supabase, inserts } = makeSupabaseMock({
      inactiveMember: true,
      allowedKeys: ["techprojects.project_updates.create.own"],
    });
    await expect(
      runCreateProjectUpdate(supabase, USER_ID, {
        projectId: PROJECT_ID,
        title: "Membro inativo",
        progressPct: 34.3,
        visibility: "commercial",
      }),
    ).rejects.toBeInstanceOf(PermissionDeniedError);
    expect(inserts).toHaveLength(0);
  });
});
