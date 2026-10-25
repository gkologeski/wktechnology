import { describe, expect, it } from "vitest";
import { handleMessagingAction } from "./engine/actions-messaging.server";
import { handleActivityAction } from "./engine/actions-activities.server";
import { workflowEventWorkspace, withWorkflowWorkspace } from "./engine/workspace-payload";

describe("workspace dos jobs de workflow", () => {
  it("grava atividade no workspace da entidade, independentemente do proprietário", async () => {
    let inserted: unknown;
    const client = {
      rpc: async (name: string, args: { p_payload: unknown }) => {
        expect(name).toBe("sales_workflow_record");
        inserted = args.p_payload;
        return { data: { id: "activity" }, error: null };
      },
    };
    await handleActivityAction(
      client as never,
      { type: "create_activity", subject: "Teste", activity_type: "note" },
      {
        workflowId: "workflow-B",
        workspaceId: "tenant-B",
        ownerId: "responsavel-A",
        entity: "leads",
        entityId: "lead-B",
        after: null,
        before: null,
      },
      "now",
    );
    expect(inserted).toMatchObject({
      workspace_id: "tenant-B",
      owner_id: "responsavel-A",
      related_lead_id: "lead-B",
    });
  });
  it("recusa origem ausente e tentativa de substituir o tenant", () => {
    expect(() => withWorkflowWorkspace({ workspaceId: "" }, { subject: "teste" })).toThrow(
      "ausente",
    );
    expect(() =>
      withWorkflowWorkspace({ workspaceId: "tenant-B" }, { workspace_id: "tenant-A" }),
    ).toThrow("destino");
  });
});

describe("origem dos eventos de workflow", () => {
  it("mantém o tenant da entidade mesmo com proprietário de outro workspace", () => {
    expect(
      workflowEventWorkspace({
        workspace_id: "tenant-B",
        after: { workspace_id: "tenant-B", owner_id: "usuario-A" },
      }),
    ).toBe("tenant-B");
  });
  it("recusa evento sem origem e snapshot de outro tenant", () => {
    expect(() => workflowEventWorkspace({ after: { workspace_id: "tenant-B" } })).toThrow("origem");
    expect(() =>
      workflowEventWorkspace({ workspace_id: "tenant-A", after: { workspace_id: "tenant-B" } }),
    ).toThrow("diverge");
  });
  it("aceita retomada com snapshot parcial e tenant explícito", () => {
    expect(
      workflowEventWorkspace({ workspace_id: "tenant-B", after: { onboarded_via: "template" } }),
    ).toBe("tenant-B");
  });
});

describe("cadências respeitam a empresa do fluxo", () => {
  for (const source of ["tenant-B", "tenant-A"]) {
    it(
      source === "tenant-B"
        ? "aceita a cadência da própria empresa"
        : "recusa cadência de outra empresa antes da gravação",
      async () => {
        let inserted: unknown;
        const query = {
          select: () => query,
          eq: () => query,
          maybeSingle: async () => ({ data: { workspace_id: source }, error: null }),
        };
        const client = {
          from: (table: string) =>
            table === "sequences"
              ? query
              : {
                  insert: async (row: unknown) => {
                    inserted = row;
                    return { error: null };
                  },
                },
        };
        const result = handleMessagingAction(
          client as never,
          { type: "add_to_sequence", sequence_id: "sequence" },
          {
            workspaceId: "tenant-B",
            ownerId: "owner-A",
            entity: "leads",
            entityId: "lead-B",
            after: null,
            before: null,
          },
          "now",
        );
        if (source === "tenant-B") {
          await result;
          expect(inserted).toMatchObject({ workspace_id: "tenant-B", entity_id: "lead-B" });
        } else {
          await expect(result).rejects.toThrow("empresa");
          expect(inserted).toBeUndefined();
        }
      },
    );
  }
});
