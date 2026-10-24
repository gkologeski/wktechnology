import { beforeEach, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement, type ReactNode } from "react";
const state = vi.hoisted(() => ({ loading: false, error: false, allowed: false, loads: 0 }));
vi.mock("@/lib/access-control/use-permissions", () => ({
  usePermissions: () => ({ isLoading: state.loading, isError: state.error, refetch: vi.fn() }),
}));
vi.mock("@/lib/access-control/use-hr-capabilities", () => ({
  useHrCapabilities: () => ({
    isLoading: false,
    isError: false,
    for: () => ({ can_create_child: state.allowed }),
    refetch: vi.fn(),
  }),
}));
vi.mock("@/components/ui/dialog", () => {
  const Box = ({ children }: { children: ReactNode }) => createElement("div", null, children);
  return { Dialog: Box, DialogContent: Box, DialogHeader: Box, DialogTitle: Box };
});
vi.mock("./hr-access", () => ({
  HrAccessError: () => createElement("p", null, "Access verification failed"),
}));
import { HrActionDialogAccess } from "./hr-action-dialog-access";
function PrivateForm() {
  state.loads++;
  return createElement("input", { value: "Private form", readOnly: true });
}
const render = () =>
  renderToStaticMarkup(
    createElement(HrActionDialogAccess, {
      open: true,
      onOpenChange: () => {},
      resource: "application_scores",
      id: "application",
      title: "Evaluate",
      children: createElement(PrivateForm),
    }),
  );
beforeEach(() => {
  state.loading = false;
  state.error = false;
  state.allowed = false;
  state.loads = 0;
});
it("denied or read-only parent actions never mount the form", () => {
  expect(render()).toContain("permissão");
  expect(state.loads).toBe(0);
});
it("loading permission data cannot mount a previously permitted form", () => {
  state.allowed = true;
  state.loading = true;
  expect(render()).toContain("Verificando acesso");
  expect(state.loads).toBe(0);
});
it("an error blocks stale allowed capability data", () => {
  state.allowed = true;
  state.error = true;
  expect(render()).toContain("verification failed");
  expect(state.loads).toBe(0);
});
it("a permitted actual parent action mounts the requested form", () => {
  state.allowed = true;
  expect(render()).toContain("Private form");
  expect(state.loads).toBe(1);
});
