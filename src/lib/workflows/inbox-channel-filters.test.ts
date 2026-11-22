// @vitest-environment jsdom
import { act, createElement, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  user: "user-a",
  workspace: "workspace-a",
  allowed: true,
  list: vi.fn(),
}));
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock("@/lib/auth", () => ({ useAuth: () => ({ user: { id: state.user } }) }));
vi.mock("@/lib/access-control/use-permissions", () => ({
  usePermissions: () => ({
    workspaceId: state.workspace,
    isLoading: false,
    isError: false,
    canAny: () => state.allowed,
  }),
}));
vi.mock("./inbox-channels.functions", () => ({
  listWorkflowInboxSources: (input: unknown) => state.list(input),
}));
import { InboxChannelFilters } from "@/components/workflows/builder/inbox-channel-filters";
import type { WorkflowNotificationEventSelection } from "./notification-events";
let root: Root,
  host: HTMLDivElement,
  client: QueryClient,
  current: WorkflowNotificationEventSelection;
const initial: WorkflowNotificationEventSelection = {
  key: "shared.email.message_received",
  channel: "email",
  account_ids: ["saved-account", "available-account"],
};
function Harness({ selection = initial }: { selection?: WorkflowNotificationEventSelection }) {
  const [value, change] = useState(selection);
  current = value;
  return createElement(InboxChannelFilters, { selection: value, onChange: change });
}
async function render(selection = initial) {
  await act(async () =>
    root.render(
      createElement(QueryClientProvider, { client }, createElement(Harness, { selection })),
    ),
  );
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 25));
  });
}
async function remove(id: string) {
  const button = host.querySelector<HTMLButtonElement>(
    `[aria-label="Remover conta indisponível ${id}"]`,
  );
  if (!button) throw new Error("Missing removal control");
  await act(async () => button.click());
}
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  state.user = "user-a";
  state.workspace = "workspace-a";
  state.allowed = true;
  state.list.mockReset().mockImplementation(async () => ({
    workspace_id: state.workspace,
    channel: "email",
    sources: [{ id: "available-account", label: "Conta autorizada" }],
  }));
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  vi.spyOn(window, "confirm").mockReturnValue(false);
});
afterEach(async () => {
  await act(async () => root.unmount());
  client.clear();
  host.remove();
  vi.restoreAllMocks();
});
it("preserves unavailable selection until explicit removal without selecting another account", async () => {
  await render();
  expect(current.account_ids).toEqual(["saved-account", "available-account"]);
  await remove("saved-account");
  expect(current.account_ids).toEqual(["available-account"]);
});
it("requires conscious confirmation before removing the last narrowing account", async () => {
  await render({ ...initial, account_ids: ["saved-account"] });
  await remove("saved-account");
  expect(current.account_ids).toEqual(["saved-account"]);
  vi.mocked(window.confirm).mockReturnValue(true);
  await remove("saved-account");
  expect(current.account_ids).toEqual([]);
});
it("also confirms before unchecking the last available narrowing account", async () => {
  await render({ ...initial, account_ids: ["available-account"] });
  const checkbox = host.querySelector<HTMLButtonElement>(
    '[role="checkbox"][aria-label="Conta autorizada"]',
  );
  if (!checkbox) throw new Error("Missing account checkbox");
  await act(async () => checkbox.click());
  expect(current.account_ids).toEqual(["available-account"]);
  vi.mocked(window.confirm).mockReturnValue(true);
  await act(async () => checkbox.click());
  expect(current.account_ids).toEqual([]);
});
it("revalidates a workspace switch without dropping its saved selection or using foreign metadata", async () => {
  await render();
  state.workspace = "workspace-b";
  state.list.mockResolvedValue({ workspace_id: "workspace-b", channel: "email", sources: [] });
  await render();
  expect(state.list).toHaveBeenCalledTimes(2);
  expect(
    client.getQueryData(["workflow-inbox-sources", "user-a", "workspace-b", "email"]),
  ).toMatchObject({ sources: [] });
  expect(current.account_ids).toEqual(initial.account_ids);
  await remove("available-account");
  expect(current.account_ids).toEqual(["saved-account"]);
});
it("revalidates a user switch and preserves accounts that the new user cannot read", async () => {
  await render();
  state.user = "user-b";
  state.list.mockResolvedValue({ workspace_id: "workspace-a", channel: "email", sources: [] });
  await render();
  expect(state.list).toHaveBeenCalledTimes(2);
  expect(current.account_ids).toEqual(initial.account_ids);
  await remove("available-account");
  expect(current.account_ids).toEqual(["saved-account"]);
});
it("keeps a disconnected account selected through refetch until removal", async () => {
  await render();
  state.list.mockResolvedValue({ workspace_id: "workspace-a", channel: "email", sources: [] });
  await act(async () => {
    await client.invalidateQueries({ queryKey: ["workflow-inbox-sources"] });
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 25));
  });
  expect(current.account_ids).toEqual(initial.account_ids);
  await remove("available-account");
  expect(current.account_ids).toEqual(["saved-account"]);
});
it("does not offer a mutation when permissions are revoked", async () => {
  await render();
  state.allowed = false;
  await render();
  expect(host.querySelector('[aria-label^="Remover conta indisponível"]')).toBeNull();
  expect(current.account_ids).toEqual(initial.account_ids);
});
it.each([
  { workspace_id: "workspace-b", channel: "email" },
  { workspace_id: "workspace-a", channel: "linkedin" },
])("does not render account metadata from a mismatched response", async (response) => {
  state.list.mockResolvedValue({
    ...response,
    sources: [{ id: "foreign-account", label: "Metadado de outra origem" }],
  });
  await render();
  expect(host.textContent).not.toContain("Metadado de outra origem");
  expect(host.querySelector('[role="checkbox"]')).toBeNull();
  expect(current.account_ids).toEqual(initial.account_ids);
});
