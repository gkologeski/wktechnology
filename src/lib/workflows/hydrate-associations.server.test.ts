import { describe, expect, it, vi } from "vitest";
import { hydrateTriggerAssociations } from "./hydrate-associations.server";
import { renderWorkflowTokens } from "./render-tokens";

function privilegedProjectReader() {
  const project = {
    id: "project-1",
    workspace_id: "workspace",
    name: "Delivery",
    status: "active",
    due_at: "2026-12-20",
    planned_hours: 20,
    planned_cost: 75000,
  };
  let selection = "";
  const read = vi.fn(() => ({
    select: (columns: string) => {
      selection = columns;
      return {
        eq: () => ({
          maybeSingle: async () => ({
            data:
              columns === "*"
                ? project
                : Object.fromEntries(
                    Object.entries(project).filter(([name]) => columns.split(",").includes(name)),
                  ),
            error: null,
          }),
        }),
      };
    },
  }));
  return { client: { from: read } as never, read, selection: () => selection };
}

describe("privileged workflow association projection", () => {
  it("resolves project business tokens without selecting or rendering confidential cost", async () => {
    const db = privilegedProjectReader();
    const source = { id: "task-1", project_id: "project-1", title: "Task" };
    const hydrated = await hydrateTriggerAssociations(
      db.client,
      "project_tasks",
      source,
      JSON.stringify({ title: "{{project.name}} {{project.planned_cost}}" }),
    );
    expect(db.read).toHaveBeenCalledExactlyOnceWith("projects");
    expect(db.selection().split(",")).not.toContain("planned_cost");
    expect(
      renderWorkflowTokens(
        "{{project.name}}|{{project.planned_hours}}|{{project.planned_cost}}",
        hydrated,
      ),
    ).toBe("Delivery|20|");
    expect(hydrated?.project).toMatchObject({ name: "Delivery", due_at: "2026-12-20" });
    expect(source).toEqual({ id: "task-1", project_id: "project-1", title: "Task" });
  });

  it("projects an old project source even when no association needs hydration", async () => {
    const db = privilegedProjectReader();
    const source = { name: "Delivery", planned_cost: 75000, planned_hours: 20 };
    expect(await hydrateTriggerAssociations(db.client, "projects", source, "{}")).toEqual({
      name: "Delivery",
      planned_hours: 20,
    });
    expect(db.read).not.toHaveBeenCalled();
    expect(source.planned_cost).toBe(75000);
  });

  it("retains a same-named business value belonging to another module", async () => {
    const db = privilegedProjectReader();
    const source = { description: "Financial planning", planned_cost: 75000 };
    const hydrated = await hydrateTriggerAssociations(db.client, "financial_entries", source, "{}");
    expect(renderWorkflowTokens("{{planned_cost}}", hydrated)).toBe("75000");
    expect(hydrated).toEqual(source);
    expect(db.read).not.toHaveBeenCalled();
  });
});
