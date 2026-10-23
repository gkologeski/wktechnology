import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  loading: false,
  error: false,
  workspace: "workspace",
  keys: [] as string[],
}));
vi.mock("@/lib/access-control/use-permissions", () => ({
  usePermissions: () => ({
    isLoading: state.loading,
    isError: state.error,
    workspaceId: state.workspace,
    can: (key: string) => state.keys.includes(key),
    refetch: vi.fn(),
  }),
}));
import { WorkspaceSettingsAccess } from "./workspace-settings-access";
const resource = "techfinance.payments_settings";
function render() {
  const children = vi.fn((manage: boolean) =>
    h("p", null, manage ? "editable settings" : "read settings"),
  );
  const html = renderToStaticMarkup(h(WorkspaceSettingsAccess, { resource, children }));
  return { html, children };
}
beforeEach(() => {
  state.loading = false;
  state.error = false;
  state.workspace = "workspace";
  state.keys = [];
});
it("does not mount the loader for direct URL without view", () => {
  state.keys = [resource + ".manage.workspace"];
  expect(render().children).not.toHaveBeenCalled();
});
it("fails closed while loading even with cached grants", () => {
  state.loading = true;
  state.keys = [resource + ".view.workspace"];
  expect(render().children).not.toHaveBeenCalled();
});
it("fails closed after permissions error even with cached grants", () => {
  state.error = true;
  state.keys = [resource + ".view.workspace"];
  const result = render();
  expect(result.children).not.toHaveBeenCalled();
  expect(result.html).toContain("Tentar novamente");
});
it("does not render another workspace's cached settings without active workspace", () => {
  state.workspace = "";
  state.keys = [resource + ".view.workspace"];
  expect(render().children).not.toHaveBeenCalled();
});
it("passes read-only access without manage", () => {
  state.keys = [resource + ".view.workspace"];
  const result = render();
  expect(result.children).toHaveBeenCalledWith(false);
  expect(result.html).toContain("somente para consulta");
});
it("passes edit access only with both grants", () => {
  state.keys = [resource + ".view.workspace", resource + ".manage.workspace"];
  expect(render().children).toHaveBeenCalledWith(true);
});
