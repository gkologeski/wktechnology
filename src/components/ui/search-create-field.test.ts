// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { SearchCreateField } from "./search-create-field";
let host: HTMLDivElement, root: Root;
beforeEach(() => {
  (
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});
const base = () => ({
  label: "Empresa",
  text: "Nova empresa",
  selectedId: null,
  options: [
    { id: "one", label: "Empresa A" },
    { id: "two", label: "Empresa B" },
  ],
  loading: false,
  searched: true,
  onTextChange: vi.fn(),
  onPick: vi.fn(),
  onClear: vi.fn(),
  onCreate: vi.fn(),
  onRetry: vi.fn(),
});
async function render(props: ReturnType<typeof base> & { error?: string; disabled?: boolean }) {
  await act(async () => root.render(createElement(SearchCreateField, props)));
}
it("selects the existing canonical ID instead of creating a duplicate", async () => {
  const p = base();
  await render(p);
  await act(async () =>
    host.querySelector("[role=option]")!.dispatchEvent(new MouseEvent("click", { bubbles: true })),
  );
  expect(p.onPick).toHaveBeenCalledWith({ id: "one", label: "Empresa A" });
  expect(p.onCreate).not.toHaveBeenCalled();
});
it("keyboard selection returns the active result and prevents form submit", async () => {
  const p = base();
  await render(p);
  const input = host.querySelector("input")!;
  for (let i = 0; i < 2; i++)
    await act(async () =>
      input.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true, cancelable: true }),
      ),
    );
  const enter = new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true });
  await act(async () => input.dispatchEvent(enter));
  expect(enter.defaultPrevented).toBe(true);
  expect(p.onPick).toHaveBeenCalledWith({ id: "two", label: "Empresa B" });
});
it("escape dismisses suggestions without closing the surrounding form", async () => {
  const p = base();
  await render(p);
  const parent = vi.fn();
  document.body.addEventListener("keydown", parent);
  await act(async () =>
    host
      .querySelector("input")!
      .dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }),
      ),
  );
  document.body.removeEventListener("keydown", parent);
  expect(parent).not.toHaveBeenCalled();
  expect(host.querySelector("[role=listbox]")).toBeNull();
});
it("creation requires explicit click and preserves the typed name for the official form", async () => {
  const p = { ...base(), options: [], text: "  Nome novo  " };
  await render(p);
  expect(p.onCreate).not.toHaveBeenCalled();
  const create = [...host.querySelectorAll("button")].find((x) =>
    x.textContent?.startsWith("Criar"),
  )!;
  await act(async () => create.click());
  expect(p.onCreate).toHaveBeenCalledWith("Nome novo");
  expect(p.onPick).not.toHaveBeenCalled();
});
it("does not offer creation for an existing exact name", async () => {
  const p = { ...base(), text: "empresa a" };
  await render(p);
  expect(host.textContent).not.toContain("Criar empresa");
});
it("query failure never masquerades as missing record and offers retry instead of creation", async () => {
  const p = { ...base(), options: [], error: "Falha de consulta" };
  await render(p);
  expect(host.querySelector("[role=alert]")?.textContent).toContain("Falha");
  expect(host.textContent).not.toContain("Nenhum resultado");
  expect(host.textContent).not.toContain("Criar empresa");
  await act(async () =>
    [...host.querySelectorAll("button")].find((x) => x.textContent === "Tentar novamente")!.click(),
  );
  expect(p.onRetry).toHaveBeenCalledOnce();
});
it("loading hides stale suggestions and creation", async () => {
  const p = { ...base(), loading: true };
  await render(p);
  expect(host.querySelector("[role=listbox]")).toBeNull();
  expect(host.querySelector("[role=status]")?.textContent).toContain("Buscando");
  expect(host.textContent).not.toContain("Criar empresa");
});
it("disabled mode exposes no mutation affordances", async () => {
  const p = { ...base(), disabled: true };
  await render(p);
  expect(host.querySelector("input")?.disabled).toBe(true);
  expect(host.querySelector("[role=listbox]")).toBeNull();
  expect(host.textContent).not.toContain("Criar empresa");
  expect(host.querySelector("button")).toBeNull();
});
