import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  loading: false,
  error: false,
  workspace: "wk",
  keys: [] as string[],
  recordLoading: false,
  recordError: false,
  view: false,
}));
vi.mock("@/lib/access-control/use-permissions", () => ({
  usePermissions: () => ({
    isLoading: state.loading,
    isError: state.error,
    workspaceId: state.workspace,
    canAny: (keys: string[]) => keys.some((k) => state.keys.includes(k)),
    refetch: vi.fn(),
  }),
}));
vi.mock("@/lib/access-control/use-hr-capabilities", () => ({
  useHrCapabilities: () => ({
    isLoading: state.recordLoading,
    isError: state.recordError,
    for: () => ({ can_view: state.view }),
    refetch: vi.fn(),
  }),
}));
import { HrScreenAccess, HrRecordAccess } from "./hr-access";
function render(record = false) {
  const loader = vi.fn(() => h("p", null, "private data loader"));
  const child = h(loader);
  const html = renderToStaticMarkup(
    record
      ? h(HrRecordAccess, { resource: "people", id: "row", children: child })
      : h(HrScreenAccess, { resources: ["techpeople.people"], children: child }),
  );
  return { html, loader };
}
beforeEach(() =>
  Object.assign(state, {
    loading: false,
    error: false,
    workspace: "wk",
    keys: [],
    recordLoading: false,
    recordError: false,
    view: false,
  }),
);
it("blocks direct URL before mounting any data loader", () => {
  state.keys = ["techpeople.people.update.workspace"];
  expect(render().loader).not.toHaveBeenCalled();
});
it.each(["own", "team", "workspace"])("accepts an effective view.%s key", (scope) => {
  state.keys = [`techpeople.people.view.${scope}`];
  expect(render().loader).toHaveBeenCalledOnce();
});
it.each(["loading", "error"] as const)("cached grants cannot bypass %s", (field) => {
  state.keys = ["techpeople.people.view.workspace"];
  state[field] = true;
  expect(render().loader).not.toHaveBeenCalled();
});
it("needs the selected workspace even with cached view", () => {
  state.keys = ["techpeople.people.view.workspace"];
  state.workspace = "";
  expect(render().loader).not.toHaveBeenCalled();
});
it("blocks a row outside the actual own/team relationship", () => {
  expect(render(true).loader).not.toHaveBeenCalled();
});
it("mounts detail only after the database authorizes its row", () => {
  state.view = true;
  expect(render(true).loader).toHaveBeenCalledOnce();
});
it.each(["recordLoading", "recordError"] as const)(
  "cached row access fails closed on %s",
  (field) => {
    state.view = true;
    state[field] = true;
    expect(render(true).loader).not.toHaveBeenCalled();
  },
);
it("offers retry after authorization service failure", () => {
  state.error = true;
  expect(render().html).toContain("Tentar novamente");
});
