// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { it, expect, vi, beforeEach, afterEach } from "vitest";
const m = vi.hoisted(() => ({
  search: vi.fn(),
  create: vi.fn(),
  view: true,
  createAllowed: true,
  readonly: false,
}));
vi.mock("@tanstack/react-start", () => ({ useServerFn: (f: unknown) => f }));
vi.mock("@/lib/contracts/signer-contacts.functions", () => ({
  searchSignerContacts: m.search,
  createSignerContact: m.create,
}));
vi.mock("@/lib/access-control/use-permissions", () => ({
  usePermissions: () => ({
    workspaceId: "w",
    canAny: (keys: string[]) => (keys[0].includes(".create.") ? m.createAllowed : m.view),
  }),
}));
vi.mock("@/lib/view-as-client", () => ({ readViewAs: () => ({ readOnly: m.readonly }) }));
import { SignerContactPicker } from "./signer-contact-picker";
let host: HTMLDivElement, root: Root, q: QueryClient;
beforeEach(() => {
  vi.clearAllMocks();
  m.view = true;
  m.createAllowed = true;
  m.readonly = false;
  m.search.mockResolvedValue([]);
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  q = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
});
afterEach(async () => {
  await act(async () => root.unmount());
  q.clear();
  host.remove();
});
async function render(value: null | { id: string; name: string; email: string } = null) {
  await act(async () =>
    root.render(
      createElement(
        QueryClientProvider,
        { client: q },
        createElement(SignerContactPicker, { role: "TESTEMUNHA 1", value, onChange: vi.fn() }),
      ),
    ),
  );
}
async function type(text: string) {
  const input = host.querySelector("input")!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, text);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await new Promise((r) => setTimeout(r, 30));
  });
  await act(async () => {
    await new Promise((r) => setTimeout(r, 30));
  });
}
it("shows the selected contact identity instead of a free-text signer", async () => {
  await render({ id: "c", name: "Pessoa fixture", email: "pessoa@example.test" });
  expect(host.textContent).toContain("pessoa@example.test");
  expect(host.querySelector("input")).toBeNull();
});
it("offers contact creation inside the search when permitted", async () => {
  await render();
  await type("Pessoa Nova");
  expect(host.textContent).toContain("Cadastrar contato nesta busca");
  expect(m.search).toHaveBeenCalled();
  expect(m.create).not.toHaveBeenCalled();
});
it("hides inline creation without contact create permission", async () => {
  m.createAllowed = false;
  await render();
  await type("Pessoa Nova");
  expect(host.textContent).not.toContain("Cadastrar contato nesta busca");
});
it("does not search or create without contact view permission", async () => {
  m.view = false;
  await render();
  expect(host.querySelector("input")?.disabled).toBe(true);
  expect(m.search).not.toHaveBeenCalled();
});
it("prevents edits in readonly sessions", async () => {
  m.readonly = true;
  await render();
  expect(host.querySelector("input")?.disabled).toBe(true);
  expect(m.create).not.toHaveBeenCalled();
});
