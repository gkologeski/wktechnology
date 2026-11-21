// @vitest-environment jsdom
import { act, createElement, type ComponentType, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const W = "aaaaaaaa-1111-4111-8111-111111111111";
const P = "bbbbbbbb-1111-4111-8111-111111111111";
const T = "cccccccc-1111-4111-8111-111111111111";
const M = "dddddddd-1111-4111-8111-111111111111";
const state = vi.hoisted(() => ({
  userId: "user",
  workspaceId: "aaaaaaaa-1111-4111-8111-111111111111" as string | null,
  view: true,
  create: false,
  record: true,
  permissionError: false,
  search: {} as Record<string, Record<string, unknown>>,
  task: vi.fn(),
  list: vi.fn(),
  project: vi.fn(),
  milestones: vi.fn(),
  mutation: vi.fn(),
}));
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: (path: string) => (options: unknown) => ({
    options,
    useSearch: () => state.search[path] ?? {},
    useParams: () => ({ id: "bbbbbbbb-1111-4111-8111-111111111111" }),
    useNavigate:
      () =>
      ({ search }: { search: (previous: Record<string, unknown>) => Record<string, unknown> }) => {
        state.search[path] = search(state.search[path] ?? {});
      },
  }),
  Link: ({ children, to }: { children: ReactNode; to: string }) =>
    createElement("a", { href: to }, children),
}));
vi.mock("@/lib/auth", () => ({ useAuth: () => ({ user: { id: state.userId } }) }));
vi.mock("@/lib/access-control/use-permissions", () => ({
  usePermissions: () => ({
    workspaceId: state.workspaceId,
    isLoading: false,
    isError: state.permissionError,
    can: () => false,
    canAny: () => state.view,
    permissions: new Set(),
    refetch: vi.fn(),
  }),
}));
vi.mock("@/lib/access-control/use-hr-capabilities", () => ({ useHrCapabilities: () => ({}) }));
vi.mock("@/lib/access-control/use-work-capabilities", () => ({
  useWorkCapabilities: () => ({
    isLoading: false,
    isError: false,
    for: () => ({ can_view: state.record, can_update: false, can_delete: false }),
  }),
}));
vi.mock("@/components/work-action", () => ({
  WorkAction: ({ children }: { children: ReactNode }) => (state.create ? children : null),
  WorkCapabilityScope: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("@/lib/audit-session", () => ({
  beginAuditSession: () => "fixture",
  endAuditSession: () => {},
  touchAuditSession: () => {},
}));
vi.mock("@/lib/projects.functions", () => ({
  getProjectTaskById: (input: unknown) => state.task(input),
  listAllProjectTasks: (input: unknown) => state.list(input),
  listAllProjectTaskIds: async () => [],
  getProject: (input: unknown) => state.project(input),
  listMilestones: (input: unknown) => state.milestones(input),
  listTasks: async () => [],
  listTimeEntries: async () => [],
  listMembers: async () => [],
  getTimeActionCapabilities: async () => ({}),
  getProjectFinancials: async () => ({}),
  updateProject: state.mutation,
  createTask: state.mutation,
  updateTask: state.mutation,
  deleteTask: state.mutation,
  createMilestone: state.mutation,
  completeMilestone: state.mutation,
  deleteMilestone: state.mutation,
  logTime: state.mutation,
  deleteTimeEntry: state.mutation,
  addMember: state.mutation,
  removeMember: state.mutation,
}));
vi.mock("@/lib/projects/billing.functions", () => ({ getProfitability: async () => ({}) }));
vi.mock("@/hooks/use-workspace-members", () => ({
  useWorkspaceMembers: () => ({ members: [], nameFor: () => "Pessoa" }),
}));
vi.mock("@/components/projects/project-origin-card", () => ({ ProjectOriginCard: () => null }));
vi.mock("@/components/projects/task-details-sheet", () => ({
  TaskDetailsSheet: ({ task, open }: { task: { title: string } | null; open: boolean }) =>
    open && task ? createElement("aside", { "aria-label": "Ficha autorizada" }, task.title) : null,
}));
vi.mock("@/components/projects/task-core-fields", () => ({
  TASK_STATUS_LABEL: {
    todo: "A fazer",
    doing: "Em execução",
    review: "Em revisão",
    done: "Concluída",
  },
}));
vi.mock("@/components/grid/use-grid-selection", () => ({
  useGridSelection: () => ({ hasSelection: false, isSelected: () => false }),
}));
vi.mock("@/hooks/use-grid-filters", () => ({
  useGridFilters: (_: unknown, rows: unknown[]) => ({ filtered: rows }),
}));
vi.mock("@/components/grid/grid-list-shell", () => ({
  GridListShell: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("@/components/grid/grid-list-toolbar", () => ({ GridListToolbar: () => null }));
vi.mock("@/components/grid/grid-bulk-bar", () => ({ GridBulkBar: () => null }));
vi.mock("@/components/kanban/kanban-board", () => ({ KanbanBoard: () => null }));

import { Route as TasksRoute } from "@/routes/_authenticated/projects.tasks";
import { Route as ProjectRoute } from "@/routes/_authenticated/projects.$id";
type TestRoute = {
  options: {
    component: ComponentType;
    validateSearch: (search: Record<string, unknown>) => Record<string, unknown>;
  };
};
const tasks = TasksRoute as unknown as TestRoute;
const project = ProjectRoute as unknown as TestRoute;
const taskPath = "/_authenticated/projects/tasks";
const projectPath = "/_authenticated/projects/$id";
let host: HTMLDivElement, root: Root, client: QueryClient;
const task = {
  id: T,
  title: "Tarefa além da primeira página",
  status: "todo",
  project_id: P,
  projects: { id: P, name: "Projeto demonstrativo" },
};
const milestone = {
  id: M,
  name: "Marco demonstrativo",
  due_at: "2026-12-15",
  status: "pending",
  billable: false,
  bill_amount: null,
};
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
  Object.assign(state, {
    userId: "user",
    workspaceId: W,
    view: true,
    create: false,
    record: true,
    permissionError: false,
    search: {},
  });
  state.task.mockReset().mockResolvedValue(task);
  state.list.mockReset().mockResolvedValue([]);
  state.project
    .mockReset()
    .mockResolvedValue({ id: P, name: "Projeto demonstrativo", status: "active" });
  state.milestones.mockReset().mockResolvedValue([milestone]);
  state.mutation.mockReset();
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
});
afterEach(async () => {
  await act(async () => root.unmount());
  client.clear();
  host.remove();
  vi.unstubAllGlobals();
});
async function render(route: TestRoute) {
  await act(async () =>
    root.render(
      createElement(QueryClientProvider, { client }, createElement(route.options.component)),
    ),
  );
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
}
function direct(route: TestRoute, path: string, url: string) {
  state.search[path] = route.options.validateSearch(
    Object.fromEntries(new URL(url, "https://local.invalid").searchParams),
  );
}
it("opens an authorized task by direct URL even when the filtered page has no rows", async () => {
  direct(tasks, taskPath, `/projects/tasks?taskId=${T}`);
  await render(tasks);
  expect(state.task).toHaveBeenCalledExactlyOnceWith({ data: { id: T } });
  expect(host.querySelector('[aria-label="Ficha autorizada"]')?.textContent).toBe(task.title);
  expect(state.mutation).not.toHaveBeenCalled();
});
it.each(["no view permission", "effective deny", "inactive membership"])(
  "does not request a direct-link task with %s",
  async () => {
    state.view = false;
    direct(tasks, taskPath, `/projects/tasks?taskId=${T}`);
    await render(tasks);
    expect(state.task).not.toHaveBeenCalled();
    expect(state.list).not.toHaveBeenCalled();
    expect(host.textContent).toContain("não tem permissão");
  },
);
it("does not request task content without an active workspace", async () => {
  state.workspaceId = null;
  direct(tasks, taskPath, `/projects/tasks?taskId=${T}`);
  await render(tasks);
  expect(state.task).not.toHaveBeenCalled();
});
it("hides the previous task during a workspace change and after the new workspace refuses it", async () => {
  direct(tasks, taskPath, `/projects/tasks?taskId=${T}`);
  await render(tasks);
  expect(host.textContent).toContain(task.title);
  state.workspaceId = "eeeeeeee-1111-4111-8111-111111111111";
  state.task.mockResolvedValue(null);
  await render(tasks);
  expect(host.querySelector("aside")).toBeNull();
  expect(host.textContent).toContain("indisponível ou você não tem acesso");
});
it("does not show cached task content while a fresh lookup is pending or after failure", async () => {
  direct(tasks, taskPath, `/projects/tasks?taskId=${T}`);
  client.setQueryData(["project_tasks", "user", W, "detail", T], task);
  let reject!: (cause: Error) => void;
  state.task.mockImplementation(
    () =>
      new Promise((_, fail) => {
        reject = fail;
      }),
  );
  await render(tasks);
  expect(host.querySelector("aside")).toBeNull();
  expect(host.textContent).not.toContain(task.title);
  await act(async () => reject(new Error("Falha de leitura")));
  await render(tasks);
  expect(host.querySelector("aside")).toBeNull();
  expect(host.textContent).toContain("Não foi possível conferir a tarefa");
});
it("clears task data when the user identity changes in the same workspace", async () => {
  direct(tasks, taskPath, `/projects/tasks?taskId=${T}`);
  await render(tasks);
  state.userId = "second";
  state.task.mockResolvedValue(null);
  await render(tasks);
  expect(host.querySelector("aside")).toBeNull();
  expect(host.textContent).not.toContain(task.title);
});
it("rejects malformed task and milestone URL IDs without creating arbitrary selections", () => {
  expect(
    tasks.options.validateSearch({ taskId: "other&redirect=external" }).taskId,
  ).toBeUndefined();
  expect(project.options.validateSearch({ tab: "unknown", milestoneId: "not-a-uuid" })).toEqual({
    tab: "tasks",
    milestoneId: undefined,
  });
});
it("opens the authorized Marcos tab from its URL and highlights the exact milestone without mutating it", async () => {
  direct(project, projectPath, `/projects/${P}?tab=milestones&milestoneId=${M}`);
  await render(project);
  expect(host.querySelector('[role="tab"][data-state="active"]')?.textContent).toBe("Marcos");
  const selected = host.querySelector('tr[aria-current="true"]');
  expect(selected?.textContent).toContain(milestone.name);
  expect(selected?.textContent).toContain("Marco do aviso");
  expect(state.milestones).toHaveBeenCalledExactlyOnceWith({ data: { projectId: P } });
  expect(state.mutation).not.toHaveBeenCalled();
});
it("does not query project or milestone content when the parent record is unauthorized", async () => {
  state.record = false;
  direct(project, projectPath, `/projects/${P}?tab=milestones&milestoneId=${M}`);
  await render(project);
  expect(state.project).not.toHaveBeenCalled();
  expect(state.milestones).not.toHaveBeenCalled();
  expect(host.textContent).toContain("sem permissão de consulta");
});
it("does not highlight a guessed milestone absent from the authorized project", async () => {
  state.milestones.mockResolvedValue([]);
  direct(project, projectPath, `/projects/${P}?tab=milestones&milestoneId=${M}`);
  await render(project);
  expect(host.querySelector('tr[aria-current="true"]')).toBeNull();
  expect(host.textContent).toContain("O marco do link está indisponível");
  expect(state.mutation).not.toHaveBeenCalled();
});
it("keeps project and milestone calendar dates on15/12 instead of shifting them to the previous day in São Paulo", async () => {
  state.project.mockResolvedValue({
    id: P,
    name: "Projeto demonstrativo",
    status: "active",
    starts_at: "2026-12-15",
    due_at: "2026-12-15",
  });
  direct(project, projectPath, `/projects/${P}?tab=milestones&milestoneId=${M}`);
  await render(project);
  expect(host.textContent).toContain("Início: 15/12/2026");
  expect(host.textContent).toContain("Prazo: 15/12/2026");
  expect(host.querySelector('tr[aria-current="true"]')?.textContent).toContain("15/12/2026");
  expect(host.querySelector('tr[aria-current="true"]')?.textContent).not.toContain("14/12/2026");
});
it("keeps a task deadline on15/12 in the real list instead of showing the previous day", async () => {
  state.list.mockResolvedValue([{ ...task, due_at: "2026-12-15" }]);
  direct(tasks, taskPath, "/projects/tasks");
  await render(tasks);
  expect(host.querySelector("tbody")?.textContent).toContain("15/12/2026");
  expect(host.querySelector("tbody")?.textContent).not.toContain("14/12/2026");
});
it("preserves an unsaved milestone dialog through background revalidation while hiding stale controls", async () => {
  state.create = true;
  direct(project, projectPath, `/projects/${P}?tab=milestones&milestoneId=${M}`);
  await render(project);
  await act(async () =>
    [...host.querySelectorAll("button")]
      .find((button) => button.textContent?.includes("Novo marco"))!
      .click(),
  );
  const input = document.querySelector<HTMLInputElement>('[role="dialog"] input')!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(
      input,
      "Marco em preparação",
    );
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  let finish!: (data: unknown) => void;
  state.project.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  await act(async () => {
    void client.refetchQueries({ queryKey: ["project", P, "user", W], exact: true });
    await new Promise((resolve) => setTimeout(resolve, 15));
  });
  expect(host.querySelector("[inert][hidden]")).not.toBeNull();
  expect(document.querySelector('[role="dialog"]')).toBeNull();
  await act(async () => finish({ id: P, name: "Projeto demonstrativo", status: "active" }));
  await render(project);
  expect(document.querySelector<HTMLInputElement>('[role="dialog"] input')?.value).toBe(
    "Marco em preparação",
  );
  state.project.mockRejectedValueOnce(new Error("Leitura interrompida"));
  await act(async () => {
    await client.refetchQueries({ queryKey: ["project", P, "user", W], exact: true });
  });
  await render(project);
  expect(host.querySelector("[inert][hidden]")).not.toBeNull();
  expect(document.querySelector('[role="dialog"]')).toBeNull();
  expect(host.textContent).toContain("Não foi possível conferir o projeto");
  expect(state.mutation).not.toHaveBeenCalled();
});
