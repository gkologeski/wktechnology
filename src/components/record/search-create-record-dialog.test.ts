// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({
  workspace: "w",
  actor: "u",
  active: true,
  keys: new Set<string>(),
  readOnly: false,
  props: null as Record<string, unknown> | null,
}));
vi.mock("@/lib/access-control/use-permissions", () => ({
  usePermissions: () => ({
    workspaceId: m.workspace,
    isLoading: false,
    isError: !m.active,
    canAny: (keys: string[]) => keys.some((k) => m.keys.has(k)),
  }),
}));
vi.mock("@/lib/auth", () => ({ useAuth: () => ({ user: { id: m.actor } }) }));
vi.mock("@/lib/view-as-client", () => ({ readViewAs: () => ({ readOnly: m.readOnly }) }));
vi.mock("./quick-create-dialogs", () => ({
  QuickCreateCompanyDialog: (props: Record<string, unknown>) => {
    m.props = props;
    return createElement("div", null, "official company form");
  },
}));
vi.mock("@/components/contacts/create-contact-dialog", () => ({
  CreateContactDialog: (props: Record<string, unknown>) => {
    m.props = props;
    return createElement("div", null, "official contact form");
  },
}));
vi.mock("@/components/projects/quick-create-project-dialog", () => ({
  QuickCreateProjectDialog: (props: Record<string, unknown>) => {
    m.props = props;
    return createElement("div", null, "official project form");
  },
}));
vi.mock("@/components/contracts/contract-wizard", () => ({
  ContractWizard: (props: Record<string, unknown>) => {
    m.props = props;
    return createElement("div", null, "official contract wizard");
  },
}));
import { SearchCreateRecordDialog } from "./search-create-record-dialog";
import { searchCreateResources, type SearchCreateEntity } from "@/lib/search-create-entities";
let host: HTMLDivElement, root: Root;
beforeEach(() => {
  (
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  m.workspace = "w";
  m.actor = "u";
  m.active = true;
  m.readOnly = false;
  m.props = null;
  m.keys = new Set(["techsales.companies.create.own", "techsales.companies.view.own"]);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});
async function render(entity: SearchCreateEntity = "company") {
  await act(async () => {
    root.render(
      createElement(SearchCreateRecordDialog, {
        entity,
        name: "Nome pesquisado",
        workspaceId: "w",
        actorId: "u",
        companyId: "supplier",
        commercialContractId: "sale",
        onClose: vi.fn(),
        onCreated: vi.fn(),
      }),
    );
    await Promise.resolve();
  });
}
it("search creation allows active authorized context", async () => {
  await render();
  expect(host.textContent).toContain("official company");
  expect(m.props?.initialName).toBe("Nome pesquisado");
});
it("search creation rejects missing create permission", async () => {
  m.keys.delete("techsales.companies.create.own");
  await render();
  expect(host.textContent).toBe("");
  expect(m.props).toBeNull();
});
it("search creation rejects effective explicit deny", async () => {
  m.keys = new Set(["techsales.companies.view.own"]);
  await render();
  expect(m.props).toBeNull();
  expect(host.textContent).toBe("");
});
it("search creation rejects foreign workspace context", async () => {
  m.workspace = "other";
  await render();
  expect(host.textContent).toBe("");
  expect(m.props).toBeNull();
});
it("search creation rejects inactive effective access", async () => {
  m.active = false;
  m.keys.clear();
  await render();
  expect(host.textContent).toBe("");
  expect(m.props).toBeNull();
});
it("search creation rejects readonly and changed actor contexts", async () => {
  m.readOnly = true;
  await render();
  expect(m.props).toBeNull();
  m.readOnly = false;
  m.actor = "other";
  await render();
  expect(m.props).toBeNull();
});
it("contact creation is bound to the selected supplier", async () => {
  m.keys = new Set(["techsales.contacts.create.own", "techsales.contacts.view.own"]);
  await render("contact");
  expect(m.props?.fixedCompanyId).toBe("supplier");
  expect(m.props?.initialName).toBe("Nome pesquisado");
});
it("project creation uses the official form and explicit commercial contract context", async () => {
  m.keys = new Set(["techprojects.projects.create.own", "techprojects.projects.view.own"]);
  await render("project");
  expect(m.props?.contractId).toBe("sale");
  expect(m.props?.initialName).toBe("Nome pesquisado");
});
it("commercial contract wizard never defaults the supplier as its customer", async () => {
  m.keys = new Set(["techcontracts.contracts.create.own", "techcontracts.contracts.view.own"]);
  await render("commercial_contract");
  expect(m.props?.source).toMatchObject({ companyId: null, initialKind: "provider" });
  expect(m.props?.onCreated).toBeTypeOf("function");
});
it("purchase contract wizard preserves the supplier and official approval gates", async () => {
  m.keys = new Set(["techcontracts.contracts.create.own", "techcontracts.contracts.view.own"]);
  await render("contract");
  expect(m.props?.source).toMatchObject({ companyId: "supplier", initialKind: "client" });
  expect(searchCreateResources.contract).toBe("techcontracts.contracts");
});
