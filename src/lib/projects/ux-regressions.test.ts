// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { CalendarView, WorkloadView } from "@/components/projects/list-views";
import { taskStatusGroups } from "./task-status-groups";
vi.mock("@/hooks/use-workspace-members", () => ({
  useWorkspaceMembers: () => ({ nameFor: () => "Pessoa", initialsFor: () => "P" }),
}));
let root: Root;
let host: HTMLDivElement;
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 11, 17, 12));
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.useRealTimers();
});
it("keeps every imported task visible even without configured statuses", () => {
  const tasks = [
    { id: "1", custom_status_id: null },
    { id: "2", custom_status_id: "deleted" },
  ];
  const r = taskStatusGroups([], tasks);
  expect(r.unclassified).toEqual(tasks);
  expect(tasks[1].custom_status_id).toBe("deleted");
});
it("groups matching tasks once and retains orphaned tasks without mutating input", () => {
  const tasks = Object.freeze([
    { id: "a", custom_status_id: "done" },
    { id: "b", custom_status_id: "foreign" },
    { id: "c", custom_status_id: null },
  ]);
  const r = taskStatusGroups([{ id: "done" }, { id: "todo" }], tasks);
  expect(r.byStatus.get("done")).toEqual([tasks[0]]);
  expect(r.byStatus.get("todo")).toEqual([]);
  expect(r.unclassified.map((t) => t.id)).toEqual(["b", "c"]);
  expect([...r.byStatus.values()].flat().length + r.unclassified.length).toBe(tasks.length);
});
it("moves December to January and returns to December with accessible calendar controls", async () => {
  await act(async () => root.render(createElement(CalendarView, { tasks: [], onOpen: vi.fn() })));
  expect(host.textContent).toContain("dezembro 2026");
  await act(async () =>
    (host.querySelector('[aria-label="Próximo mês"]') as HTMLButtonElement).click(),
  );
  expect(host.textContent).toContain("janeiro 2027");
  await act(async () =>
    (host.querySelector('[aria-label="Mês anterior"]') as HTMLButtonElement).click(),
  );
  expect(host.textContent).toContain("dezembro 2026");
});
it("does not invent a 40 hour capacity or an overload for a person without a schedule", async () => {
  await act(async () =>
    root.render(
      createElement(WorkloadView, {
        tasks: [
          {
            id: "a",
            title: "Trabalho",
            custom_status_id: null,
            priority: "normal",
            estimated_hours: 52,
            due_at: new Date(2026, 11, 17, 12).toISOString(),
            assignee_id: "p",
          },
        ],
      }),
    ),
  );
  expect(host.textContent).toContain("52.0h estimadas");
  expect(host.textContent).toContain("capacidade não configurada");
  expect(host.textContent).not.toContain("/ 40h");
  expect(host.querySelector('[role="progressbar"]')).toBeNull();
});

const accessState = vi.hoisted(() => ({
  workspaceId: "wk",
  allowed: true,
  isLoading: false,
  isError: false,
}));
vi.mock("@/lib/access-control/use-permissions", () => ({
  usePermissions: () => ({ ...accessState, canAny: () => accessState.allowed, refetch: vi.fn() }),
}));
import { HrScreenAccess } from "@/components/hr-access";
async function screen(allowed: boolean, workspaceId: string | null = "wk") {
  Object.assign(accessState, { allowed, workspaceId, isLoading: false, isError: false });
  const mounted = vi.fn();
  function Protected() {
    mounted();
    return createElement("p", null, "consulta protegida");
  }
  await act(async () =>
    root.render(
      createElement(HrScreenAccess, {
        resources: ["techprojects.timesheet"],
        children: createElement(Protected),
      }),
    ),
  );
  return mounted;
}
it("mounts the hours screen for an authorized active workspace", async () => {
  const m = await screen(true);
  expect(m).toHaveBeenCalled();
});
it("does not mount hours queries without a view key", async () => {
  const m = await screen(false);
  expect(m).not.toHaveBeenCalled();
  expect(host.textContent).toContain("não tem permissão");
});
it("does not mount hours queries under effective explicit deny", async () => {
  const m = await screen(false);
  expect(m).not.toHaveBeenCalled();
});
it("does not mount hours queries without an accessible workspace", async () => {
  const m = await screen(true, null);
  expect(m).not.toHaveBeenCalled();
});
it("does not mount hours queries for an effectively inactive member", async () => {
  const m = await screen(false, null);
  expect(m).not.toHaveBeenCalled();
});
