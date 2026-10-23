import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  data: undefined as unknown,
  isLoading: false,
  isError: false,
  refetch: vi.fn(),
}));
const mocks = vi.hoisted(() => ({ query: vi.fn(), session: vi.fn() }));
vi.mock("@tanstack/react-query", () => ({
  useQuery: (options: unknown) => {
    mocks.query(options);
    return state;
  },
}));
vi.mock("@tanstack/react-start", () => ({ useServerFn: () => vi.fn() }));
vi.mock("@/lib/modules/module-access.functions", () => ({ getMyModuleAccess: vi.fn() }));
vi.mock("@/lib/modules/licenses.functions", () => ({ getModuleLicenses: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { getSession: mocks.session } },
}));
vi.mock("@/lib/access-control/permissions.functions", () => ({ getMyPermissions: vi.fn() }));
import { Can } from "@/lib/access-control/use-permissions";
import { useModuleAccess } from "./use-module-access";
import { useModuleLicenses } from "./use-module-licenses";
beforeEach(() => {
  vi.clearAllMocks();
  state.data = undefined;
  state.isLoading = false;
  state.isError = false;
});
it.each(["loading", "error", "no-data", "no-workspace"])(
  "module and license queries deny during %s",
  (condition) => {
    state.data = {
      workspaceId: "wk",
      unrestricted: true,
      allowed: ["people"],
      enabled: ["people"],
    };
    if (condition === "loading") state.isLoading = true;
    if (condition === "error") state.isError = true;
    if (condition === "no-data") state.data = undefined;
    if (condition === "no-workspace")
      state.data = { workspaceId: null, unrestricted: true, allowed: ["people"] };
    expect(useModuleAccess().canAccessModule("people")).toBe(false);
    expect(useModuleAccess().soleModule).toBeNull();
    expect(useModuleLicenses().isLicensed("people")).toBe(false);
  },
);
it("a confirmed unrestricted configuration remains supported", () => {
  state.data = { workspaceId: "wk", unrestricted: true, allowed: [], enabled: [] };
  expect(useModuleAccess().canAccessModule("people")).toBe(true);
  expect(useModuleLicenses().isLicensed("people")).toBe(true);
});
it("confirmed restricted configuration only enables allowed modules", () => {
  state.data = { workspaceId: "wk", unrestricted: false, allowed: ["people"], enabled: ["people"] };
  expect(useModuleAccess().canAccessModule("people")).toBe(true);
  expect(useModuleAccess().canAccessModule("finance")).toBe(false);
  expect(useModuleAccess().soleModule).toBe("people");
  expect(useModuleLicenses().isLicensed("finance")).toBe(false);
});
it("missing login session returns a closed configuration", async () => {
  mocks.session.mockResolvedValue({ data: { session: null } });
  useModuleAccess();
  let opts = mocks.query.mock.calls.at(-1)?.[0] as {
    queryFn: () => Promise<{ unrestricted: boolean }>;
  };
  expect((await opts.queryFn()).unrestricted).toBe(false);
  useModuleLicenses();
  opts = mocks.query.mock.calls.at(-1)?.[0] as {
    queryFn: () => Promise<{ unrestricted: boolean }>;
  };
  expect((await opts.queryFn()).unrestricted).toBe(false);
});

it("a generic action Can cannot reuse a cached permission after an error", () => {
  state.data = { workspace_id: "wk", permissions: ["techpeople.people.update.workspace"] };
  let html = renderToStaticMarkup(
    h(Can, {
      permission: "techpeople.people.update.workspace",
      children: h("button", null, "save"),
    }),
  );
  expect(html).toContain("save");
  state.isError = true;
  html = renderToStaticMarkup(
    h(Can, {
      permission: "techpeople.people.update.workspace",
      children: h("button", null, "save"),
    }),
  );
  expect(html).not.toContain("save");
});
