// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ mutation: vi.fn(), allowed: true }));
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: unknown }) => children,
}));
vi.mock("@/lib/audit-session", () => ({
  beginAuditSession: () => "fixture",
  endAuditSession: () => {},
}));
vi.mock("@/components/work-action", () => ({
  useWorkRecordCapability: () => ({ can_update: state.allowed }),
}));
vi.mock("@/hooks/use-workspace-members", () => ({
  useWorkspaceMembers: () => ({ data: [], nameFor: () => "Pessoa" }),
}));
vi.mock("@/lib/projects.functions", () => ({
  updateTask: state.mutation,
  listAllProjectTasks: async () => [],
}));
vi.mock("@/lib/project-list-extras.functions", () => ({
  listTaskFieldReferences: async () => [],
  updateTaskCustomFieldValues: state.mutation,
}));
vi.mock("@/lib/project-tasks-advanced.functions", () => ({
  listChecklist: async () => [],
  listDependencies: async () => [],
  listWorkspaceTaskTags: async () => [],
  addChecklistItem: state.mutation,
  toggleChecklistItem: state.mutation,
  removeChecklistItem: state.mutation,
  addDependency: state.mutation,
  removeDependency: state.mutation,
  updateTaskTags: state.mutation,
}));
import { TaskDetailsSheet } from "@/components/projects/task-details-sheet";
const task = {
  id: "cccccccc-1111-4111-8111-111111111111",
  title: "Tarefa autorizada",
  description: "Descrição autorizada",
  status: "todo",
  priority: "normal",
  due_at: "2026-12-15",
  tags: [],
};
let host: HTMLDivElement, root: Root, client: QueryClient;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  state.allowed = true;
  state.mutation.mockReset().mockResolvedValue({});
});
afterEach(async () => {
  await act(async () => root.unmount());
  client.clear();
  host.remove();
  vi.unstubAllGlobals();
});
async function render(
  revalidating = false,
  current: typeof task | null = task,
  identity = "user-a/workspace-a",
) {
  await act(async () =>
    root.render(
      createElement(
        QueryClientProvider,
        { client },
        createElement(TaskDetailsSheet, {
          key: identity,
          task: current,
          open: Boolean(current),
          showCoreFields: true,
          revalidating,
          onOpenChange: vi.fn(),
        }),
      ),
    ),
  );
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
}
const titleInput = () => document.querySelector<HTMLInputElement>(`#task-${task.id}-title`)!;
async function editTitle(value: string) {
  await act(async () => {
    const input = titleInput();
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
it("keeps the real sheet mounted with neutral status and inert hidden fields while a fresh read is pending", async () => {
  await render();
  await editTitle("Rascunho ainda não gravado");
  const original = titleInput();
  await render(true);
  expect(document.querySelector('[role="dialog"]')).not.toBeNull();
  expect(document.querySelector('[role="dialog"] h2')?.textContent).toBe(
    "Conferindo acesso à tarefa…",
  );
  const fields = document.querySelector<HTMLFieldSetElement>('[role="dialog"] fieldset')!;
  expect(fields.hidden).toBe(true);
  expect(fields.disabled).toBe(true);
  expect(fields.hasAttribute("inert")).toBe(true);
  expect(fields.style.display).toBe("none");
  expect(titleInput()).toBe(original);
  expect(titleInput().value).toBe("Rascunho ainda não gravado");
  await render(false);
  expect(titleInput()).toBe(original);
  expect(titleInput().value).toBe("Rascunho ainda não gravado");
  expect(document.querySelector<HTMLFieldSetElement>("fieldset")!.hidden).toBe(false);
  expect(state.mutation).not.toHaveBeenCalled();
});
it("removes the sheet and its fields when the confirmed task becomes unavailable", async () => {
  await render();
  await editTitle("Rascunho privado");
  await render(true);
  await render(false, null);
  expect(document.querySelector('[role="dialog"]')).toBeNull();
  expect(titleInput()).toBeNull();
  expect(document.body.textContent).not.toContain("Rascunho privado");
  expect(state.mutation).not.toHaveBeenCalled();
});
it("does not carry an unsaved field into another user or workspace at the same task ID", async () => {
  await render();
  await editTitle("Rascunho de outra identidade");
  await render(
    false,
    { ...task, title: "Leitura confirmada na nova identidade" },
    "user-b/workspace-b",
  );
  expect(titleInput().value).toBe("Leitura confirmada na nova identidade");
  expect(state.mutation).not.toHaveBeenCalled();
});
it("shows a civil task deadline and saves a selected calendar day as YYYY-MM-DD without time", async () => {
  await render();
  const due = document.getElementById(`task-${task.id}-due`)!;
  expect(due.textContent).toContain("15/12/2026");
  expect(document.querySelector('[aria-label="Prazo: hora"]')).toBeNull();
  await act(async () => due.click());
  const day = [...document.querySelectorAll<HTMLButtonElement>('[role="grid"] button')].find(
    (button) => button.textContent?.trim() === "16",
  )!;
  expect(day).toBeDefined();
  await act(async () => day.click());
  expect(state.mutation).toHaveBeenCalledExactlyOnceWith({
    data: { id: task.id, patch: { due_at: "2026-12-16" } },
  });
});
