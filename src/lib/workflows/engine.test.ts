import { describe, expect, it, vi } from "vitest";

// Business-flow unit tests inject authorization; real RLS is exercised by the isolated worker suite.
vi.mock("./engine/authorization.server", () => ({
  authorizeWorkflowStep: async () => undefined,
  sanitizeWorkflowSnapshot: (value: unknown) => value,
}));
vi.mock("./engine/record-write.server", () => ({
  workflowRecord: async (
    db: any,
    _ctx: unknown,
    table: string,
    operation: string,
    id: string | null,
    payload: Record<string, unknown>,
  ) => {
    const query =
      operation === "create"
        ? db.from(table).insert(payload).select("id").single()
        : operation === "update"
          ? db.from(table).update(payload).eq("id", id)
          : db.from(table).delete().eq("id", id);
    const result = await query;
    if (result.error) throw new Error(result.error.message);
    return result.data ?? { id };
  },
}));

import { runActions } from "./engine.server";
import type { WorkflowAction } from "./types";

function createWorkflowClient() {
  const inserted: Array<Record<string, unknown>> = [];

  const client = {
    from(table: string) {
      if (table === "prospecting_questionnaires") {
        return {
          select: () => ({
            eq: () => ({ maybeSingle: async () => ({ data: { name: "Questionário Padrão" } }) }),
          }),
        };
      }
      if (table === "activities") {
        return {
          insert: (row: Record<string, unknown>) => {
            inserted.push(row);
            return {
              select: () => ({
                single: async () => ({ data: { id: "activity-1" }, error: null }),
              }),
            };
          },
        };
      }
      throw new Error(`Tabela inesperada: ${table}`);
    },
  };

  return { client, inserted };
}

describe("workflow engine survey activity", () => {
  it("cria uma pesquisa pendente vinculada ao lead e registra o passo", async () => {
    const { client, inserted } = createWorkflowClient();
    const action: WorkflowAction = {
      type: "create_survey_activity",
      source: "prospecting_questionnaire",
      source_id: "a117e6fe-82fd-44c7-b621-627beb92457c",
      subject: "Qualificação do lead",
    };

    const result = await runActions(client as never, [action], {
      entity: "leads",
      entityId: "lead-1",
      ownerId: "owner-1",
      workspaceId: "ws-1",
      after: { id: "lead-1" },
      before: null,
    });

    expect(result.hadError).toBe(false);
    expect(inserted).toEqual([
      expect.objectContaining({
        type: "survey",
        completed: false,
        related_lead_id: "lead-1",
        custom_fields: expect.objectContaining({
          survey_source: "prospecting_questionnaire",
          survey_source_id: "a117e6fe-82fd-44c7-b621-627beb92457c",
          survey_status: "pending",
        }),
      }),
    ]);
    expect(result.log[0]).toEqual(
      expect.objectContaining({
        ok: true,
        action: "create_survey_activity",
        action_label: "Criar pesquisa (atividade)",
        step_path: "1",
        detail: expect.objectContaining({ activity_id: "activity-1" }),
      }),
    );
  });

  it("identifica o caminho de um passo com erro dentro de uma ramificação", async () => {
    const action: WorkflowAction = {
      type: "branch_if",
      filters: [],
      then: [
        {
          type: "create_survey_activity",
          source: "prospecting_questionnaire",
          source_id: "a117e6fe-82fd-44c7-b621-627beb92457c",
        },
      ],
      else: [],
    };
    const client = {
      from: () => ({
        select: () => ({
          eq: () => ({ maybeSingle: async () => ({ data: { name: "Questionário Padrão" } }) }),
        }),
        insert: () => ({
          select: () => ({
            single: async () => ({ data: null, error: { message: "Falha ao criar" } }),
          }),
        }),
      }),
    };

    const result = await runActions(client as never, [action], {
      entity: "leads",
      entityId: "lead-1",
      ownerId: "owner-1",
      workspaceId: "ws-1",
      after: { id: "lead-1" },
      before: null,
    });

    expect(result.hadError).toBe(true);
    expect(result.log.at(-1)).toEqual(
      expect.objectContaining({
        ok: false,
        error: "Falha ao criar",
        action_label: "Criar pesquisa (atividade)",
        step_path: "1.then.1",
      }),
    );
  });
});
