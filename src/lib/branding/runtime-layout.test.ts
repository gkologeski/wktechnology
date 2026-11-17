// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
const state = vi.hoisted(() => ({
  user: { id: "user-a" } as { id: string } | null,
  workspace: "workspace-a" as string | null,
  layout: "attio",
  colorMode: "light",
  moduleLayout: "classic",
  branding: true,
  onWorkspace: null as null | (() => void),
  pending: null as null | Promise<unknown>,
  unsubscribe: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ useAuth: () => ({ user: state.user }) }));
vi.mock("@/lib/modules/active-module", () => ({ useActiveModule: () => "crm" }));
vi.mock("@/lib/workspace-events", () => ({
  brandingRealtimeFilters: () => ["workspace_id=eq.workspace-a"],
  realtimeRetryDelay: () => 1000,
  onWorkspaceChanged: (callback: () => void) => {
    state.onWorkspace = callback;
    return vi.fn();
  },
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    channel: () => {
      const channel = { on: () => channel, subscribe: () => channel };
      return channel;
    },
    removeChannel: state.unsubscribe,
    from: (table: string) => {
      const result = () =>
        table === "profiles"
          ? { data: { active_workspace_id: state.workspace } }
          : table === "module_branding"
            ? {
                data: [
                  {
                    module_id: "crm",
                    theme: { layout: state.moduleLayout, light: { primary: "module-color" } },
                  },
                ],
              }
            : {
                data: state.branding
                  ? {
                      brand_name: state.workspace,
                      primary_color: "workspace-color",
                      theme: { layout: state.layout, colorMode: state.colorMode },
                    }
                  : null,
              };
      const query = {
        select: () => query,
        eq: () => query,
        limit: () => query,
        maybeSingle: () =>
          table === "workspace_branding" && state.pending
            ? state.pending
            : Promise.resolve(result()),
        then: (resolve: (value: unknown) => void) => Promise.resolve(result()).then(resolve),
      };
      return query;
    },
  },
}));
import { BrandingProvider } from "../branding";
let root: Root;
const flush = async () => {
  await act(async () => {
    await Promise.resolve();
  });
};
const render = async () => {
  await act(async () => {
    root.render(createElement(BrandingProvider, null, createElement("p", null, "workspace")));
  });
};
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  Object.assign(state, {
    user: { id: "user-a" },
    workspace: "workspace-a",
    layout: "attio",
    moduleLayout: "classic",
    colorMode: "light",
    branding: true,
    pending: null,
  });
  localStorage.setItem("wk:branding-cache:v2", JSON.stringify({ theme: { layout: "attio" } }));
  root = createRoot(document.createElement("div"));
});
afterEach(async () => {
  await act(async () => root.unmount());
  localStorage.clear();
  vi.clearAllMocks();
});
describe("workspace layout runtime isolation", () => {
  it("applies only workspace structure while retaining module colors", async () => {
    await render();
    await flush();
    expect(document.documentElement.dataset.workspaceLayout).toBe("attio");
    expect(document.getElementById("wk-branding-theme")?.textContent).toContain(
      "--primary:module-color",
    );
  });
  it("applies the saved dark palette mode and clears it on logout", async () => {
    state.colorMode = "dark";
    await render();
    await flush();
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    state.user = null;
    await render();
    await flush();
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });
  it("clears appearance on logout and ignores the legacy cache", async () => {
    await render();
    state.user = null;
    await render();
    await flush();
    expect(document.documentElement.hasAttribute("data-workspace-layout")).toBe(false);
    expect(document.getElementById("wk-branding-theme")?.textContent).toBe("");
  });
  it("clears the previous workspace immediately and discards late responses", async () => {
    await render();
    await flush();
    let release!: (value: unknown) => void;
    state.pending = new Promise((resolve) => {
      release = resolve;
    });
    await act(async () => {
      state.onWorkspace?.();
    });
    expect(document.documentElement.hasAttribute("data-workspace-layout")).toBe(false);
    state.pending = null;
    state.workspace = "workspace-b";
    state.layout = "classic";
    await act(async () => {
      state.onWorkspace?.();
    });
    await flush();
    expect(document.documentElement.dataset.workspaceLayout).toBe("classic");
    await act(async () => {
      release({ data: { theme: { layout: "attio" } } });
    });
    expect(document.documentElement.dataset.workspaceLayout).toBe("classic");
  });
  it("does not reuse branding after an inaccessible workspace read", async () => {
    await render();
    state.branding = false;
    await act(async () => {
      state.onWorkspace?.();
    });
    await flush();
    expect(document.documentElement.hasAttribute("data-workspace-layout")).toBe(false);
  });
});

// Status and selected-state boundaries must not disappear when cards are flattened.
it("flattens neutral sections only in Essential, preserving alerts and selection", () => {
  const style = document.createElement("style");
  style.textContent = readFileSync("src/styles/workspace-layout.css", "utf8");
  document.head.appendChild(style);
  const rule = Array.from(style.sheet!.cssRules).find(
    (rule) =>
      "selectorText" in rule &&
      String(rule.selectorText).includes(".authenticated-content") &&
      String(rule.selectorText).includes('[data-slot="card"]'),
  ) as CSSStyleRule;
  const scope = document.createElement("section");
  scope.dataset.workspaceLayout = "attio";
  scope.innerHTML =
    '<main class="authenticated-content"><div data-slot="card"></div><div data-slot="card" role="alert"></div><div data-slot="card" class="border-destructive"></div><div data-slot="card" class="bg-warning/10"></div><div data-slot="card" class="border-primary"></div><div data-slot="card" aria-selected="true"></div></main>';
  document.body.appendChild(scope);
  const cards = Array.from(scope.querySelectorAll('[data-slot="card"]'));
  expect(cards[0].matches(rule.selectorText)).toBe(true);
  for (const card of cards.slice(1)) expect(card.matches(rule.selectorText)).toBe(false);
  scope.dataset.workspaceLayout = "classic";
  expect(cards[0].matches(rule.selectorText)).toBe(false);
  scope.remove();
  style.remove();
});

it("opens neutral Dashboard shells without removing field, action or classic boundaries", () => {
  document.documentElement.removeAttribute("data-workspace-layout");
  const style = document.createElement("style");
  style.textContent = readFileSync("src/styles/workspace-layout.css", "utf8");
  document.head.appendChild(style);
  const rule = Array.from(style.sheet!.cssRules).find(
    (rule) => "selectorText" in rule && String(rule.selectorText).includes(".bg-surface-2"),
  ) as CSSStyleRule;
  const scope = document.createElement("section");
  scope.dataset.workspaceLayout = "attio";
  scope.innerHTML =
    '<main class="authenticated-content"><div class="border border-border-subtle bg-surface-2"></div><div class="border border-product-divider bg-product-toolbar"></div><input class="border border-input bg-background" /><div role="button" class="border border-border-subtle bg-surface-2"></div><div aria-selected="true" class="border border-border-subtle bg-surface-2"></div></main>';
  document.body.appendChild(scope);
  const nodes = Array.from(scope.querySelector("main")!.children);
  expect(nodes[0].matches(rule.selectorText)).toBe(true);
  expect(nodes[1].matches(rule.selectorText)).toBe(true);
  for (const node of nodes.slice(2)) expect(node.matches(rule.selectorText)).toBe(false);
  scope.dataset.workspaceLayout = "classic";
  expect(nodes[0].matches(rule.selectorText)).toBe(false);
  expect(nodes[1].matches(rule.selectorText)).toBe(false);
  scope.remove();
  style.remove();
});
