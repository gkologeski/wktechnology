// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, it, expect, vi } from "vitest";
const m = vi.hoisted(() => ({
  ws: "w",
  actor: "u",
  active: true,
  readonly: false,
  keys: new Set<string>(),
  load: vi.fn(),
}));
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock("@/lib/contracts.functions", () => ({
  getContract: (...args: unknown[]) => m.load(...args),
}));
vi.mock("@/lib/contracts/import.functions", () => ({
  parseContractPdf: vi.fn(),
  parseContractText: vi.fn(),
}));
vi.mock("@/lib/access-control/use-permissions", () => ({
  usePermissions: () => ({
    workspaceId: m.ws,
    isLoading: false,
    isError: !m.active,
    can: (k: string) => m.keys.has(k),
    canAny: (ks: string[]) => ks.some((k) => m.keys.has(k)),
  }),
}));
vi.mock("@/lib/auth", () => ({ useAuth: () => ({ user: { id: m.actor } }) }));
vi.mock("@/lib/view-as-client", () => ({ readViewAs: () => ({ readOnly: m.readonly }) }));
vi.mock("./preparation-reference-field", () => ({
  PreparationReferenceField: ({ onChange }: { onChange: (id: string) => void }) =>
    createElement("button", { onClick: () => onChange("contract") }, "Select supplier contract"),
}));
import { SupplierDocumentIntake } from "./supplier-document-intake";
import { emptyPreparation } from "@/lib/hiring/requests/types";
let host: HTMLDivElement, root: Root;
const apply = vi.fn(),
  ref = vi.fn();
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  m.ws = "w";
  m.actor = "u";
  m.active = true;
  m.readonly = false;
  m.keys = new Set([
    "techcontracts.contracts.view.own",
    "techcontracts.contracts.create.own",
    "techcontracts.imports.manage.workspace",
  ]);
  m.load.mockReset().mockResolvedValue({
    workspace_id: "w",
    role: "client",
    title: "Documento",
    service_scope: "Escopo",
    monthly_value: 100,
    total_value: 1200,
  });
  apply.mockReset();
  ref.mockReset();
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});
async function render() {
  await act(async () =>
    root.render(
      createElement(SupplierDocumentIntake, {
        form: emptyPreparation("supplier"),
        disabled: false,
        canWriteReference: false,
        onApply: apply,
        onReference: ref,
      }),
    ),
  );
}
async function click(label: string) {
  const b = [...host.querySelectorAll("button")].find((x) => x.textContent === label);
  if (!b) throw Error(label);
  await act(async () => {
    b.click();
    await Promise.resolve();
  });
}
it("document intake offers authorized existing extraction without auto applying", async () => {
  await render();
  expect(host.querySelector("input[type=file]")).not.toBeNull();
  await click("Select supplier contract");
  await click("Revisar dados do contrato");
  expect(host.textContent).toContain("Escopo");
  expect(apply).not.toHaveBeenCalled();
  expect(host.textContent).not.toContain("1200");
  expect(host.textContent).not.toContain("Valor de referência");
});
it("document intake hides AI without import permission", async () => {
  m.keys.delete("techcontracts.imports.manage.workspace");
  await render();
  expect(host.querySelector("input[type=file]")).toBeNull();
});
it("document intake does not enable readonly or inactive writes", async () => {
  m.readonly = true;
  await render();
  expect((host.querySelector("input[type=file]") as HTMLInputElement).disabled).toBe(true);
  m.readonly = false;
  m.active = false;
  await render();
  expect((host.querySelector("input[type=file]") as HTMLInputElement).disabled).toBe(true);
});
it("document intake rejects a foreign workspace and provider contract", async () => {
  m.load.mockResolvedValue({ workspace_id: "foreign", role: "client" });
  await render();
  await click("Select supplier contract");
  await click("Revisar dados do contrato");
  expect(host.textContent).toContain("indisponível neste workspace");
  expect(apply).not.toHaveBeenCalled();
  m.load.mockResolvedValue({ workspace_id: "w", role: "provider" });
  await click("Revisar dados do contrato");
  expect(host.textContent).toContain("indisponível neste workspace");
});
it("document intake discards review after actor or workspace changes", async () => {
  await render();
  await click("Select supplier contract");
  await click("Revisar dados do contrato");
  expect(host.textContent).toContain("Escopo");
  m.actor = "other";
  await render();
  expect(host.textContent).not.toContain("Escopo");
  expect(apply).not.toHaveBeenCalled();
});
