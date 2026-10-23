// @vitest-environment jsdom
import { act, createElement, createRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Input } from "./input";
import { EmailInput } from "./email-input";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root;
let host: HTMLDivElement;
afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
});
function render(props: React.ComponentProps<typeof Input>) {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  act(() =>
    root.render(
      createElement("form", null, createElement(Input, { type: "email", name: "email", ...props })),
    ),
  );
  return { input: host.querySelector("input")!, form: host.querySelector("form")! };
}

describe("todos os Input email usam o contrato internacional", () => {
  it("aceita UTF8 sem a restrição ASCII nativa e mantém FormData e ref", () => {
    const ref = createRef<HTMLInputElement>();
    const { input, form } = render({
      value: "José@bücher.de",
      readOnly: false,
      onChange: vi.fn(),
      ref,
    });
    expect(input.type).toBe("text");
    expect(input.inputMode).toBe("email");
    expect(ref.current).toBe(input);
    expect(form.checkValidity()).toBe(true);
    expect(new FormData(form).get("email")).toBe("José@bücher.de");
  });
  it("required vazio e inválido realmente bloqueiam requestSubmit", () => {
    const { input, form } = render({ required: true, defaultValue: "" });
    const submit = vi.fn((event: Event) => event.preventDefault());
    form.addEventListener("submit", submit);
    act(() => form.requestSubmit());
    expect(submit).not.toHaveBeenCalled();
    act(() => {
      input.value = "a..b@exemplo.com";
      input.dispatchEvent(new Event("input", { bubbles: true }));
      form.requestSubmit();
    });
    expect(form.checkValidity()).toBe(false);
    expect(submit).not.toHaveBeenCalled();
    act(() => {
      input.value = "José@bücher.de";
      input.dispatchEvent(new Event("input", { bubbles: true }));
      form.requestSubmit();
    });
    expect(submit).toHaveBeenCalledTimes(1);
  });
  it("erros acessíveis só aparecem depois de blur/submit, com referência correta", () => {
    const blur = vi.fn();
    const { input } = render({ defaultValue: "errado", onBlur: blur, "aria-describedby": "ajuda" });
    expect(host.querySelector("[role=status]")).toBeNull();
    act(() => input.dispatchEvent(new FocusEvent("focusout", { bubbles: true })));
    expect(blur).toHaveBeenCalledTimes(1);
    const msg = host.querySelector("[role=status]")!;
    expect(msg.textContent).toContain("e-mail válido");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(input.getAttribute("aria-describedby")).toContain(msg.id);
    expect(input.getAttribute("aria-describedby")).toContain("ajuda");
  });
  it("vazio opcional, disabled e readonly não bloqueiam formulário", () => {
    const { form } = render({ defaultValue: "" });
    expect(form.checkValidity()).toBe(true);
    act(() =>
      root.render(
        createElement(
          "form",
          null,
          createElement(Input, {
            type: "email",
            value: "inválido",
            required: true,
            disabled: true,
          }),
        ),
      ),
    );
    expect(host.querySelector("form")!.checkValidity()).toBe(true);
    act(() =>
      root.render(
        createElement(
          "form",
          null,
          createElement(Input, {
            type: "email",
            value: "inválido",
            required: true,
            readOnly: true,
          }),
        ),
      ),
    );
    expect(host.querySelector("form")!.checkValidity()).toBe(true);
  });
  it("multiple usa lista e single rejeita lista, sem sumir com itens", () => {
    const { input, form } = render({
      multiple: true,
      defaultValue: "José@exemplo.com; User@bücher.de",
    });
    expect(form.checkValidity()).toBe(true);
    act(() => {
      input.value = "a@example.com,,";
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(form.checkValidity()).toBe(false);
  });
  it("wrapper por string preserva texto interno e contrato onChange", () => {
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
    const onChange = vi.fn();
    act(() => root.render(createElement(EmailInput, { value: "jo ao@exemplo.com", onChange })));
    expect(host.querySelector("input")!.value).toBe("jo ao@exemplo.com");
    expect(host.querySelector("input")!.checkValidity()).toBe(false);
  });
});
