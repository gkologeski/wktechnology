// @vitest-environment jsdom
import { act, createElement, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  emptyMetaTemplateDraft,
  type MetaTemplate,
  type MetaTemplateContext,
  type MetaTemplateTarget,
} from "@/lib/whatsapp/meta-template-types";

const state = vi.hoisted(() => ({
  permissions: new Set<string>(),
  readOnly: false,
  getContext: vi.fn(),
  list: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  inspect: vi.fn(),
  remove: vi.fn(),
  upload: vi.fn(),
}));
const U = "10000000-0000-4000-8000-000000000001",
  W = "20000000-0000-4000-8000-000000000001";
vi.mock("@/lib/auth", () => ({
  useAuth: () => ({ user: { id: "10000000-0000-4000-8000-000000000001" } }),
}));
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock("@/lib/access-control/use-permissions", () => ({
  usePermissions: () => ({
    isLoading: false,
    isError: false,
    workspaceId: "20000000-0000-4000-8000-000000000001",
    can: (key: string) => state.permissions.has(key),
    canAll: (keys: string[]) => keys.every((key) => state.permissions.has(key)),
    refetch: vi.fn(),
  }),
}));
vi.mock("@/lib/view-as-client", () => ({
  readViewAs: () => (state.readOnly ? { readOnly: true, mode: "role" } : null),
}));
vi.mock("@/lib/whatsapp/meta-template-center.functions", () => ({
  getMetaTemplateContext: state.getContext,
  listMetaTemplates: state.list,
  createMetaTemplate: state.create,
  updateMetaTemplate: state.update,
  inspectMetaTemplateDeletion: state.inspect,
  deleteMetaTemplate: state.remove,
  uploadMetaTemplateSample: state.upload,
}));
vi.mock("@/components/ui/phone-input", () => ({ PhoneInput: () => null }));
import { filterMetaTemplates, MetaTemplateList, MetaTemplatesPage } from "./meta-template-center";
import { MetaTemplateEditor } from "./meta-template-editor";
import { MetaTemplateDetails, MetaTemplatePreview } from "./meta-template-preview";
import { DeliveryModelsPanel } from "@/components/notifications/delivery-models-panel";
import { canViewSalesRoute, salesRouteResources } from "@/lib/access-control/sales-route-map";
import { resourcesForUrl } from "@/lib/menu-resources";

const target: MetaTemplateTarget = {
  id: "cloud:connection1",
  provider: "cloud",
  label: "Conta WK",
  wabaId: "123456789",
  enabled: true,
  numbers: [
    { id: "111111", phone: "+55 48 3000-1000", label: "Teste" },
    { id: "222222", phone: "+55 48 3000-2000", label: "Teste 2" },
  ],
};
const draft = {
  ...emptyMetaTemplateDraft(),
  name: "aviso_atualizacao",
  body: "Olá {{1}}, há uma atualização disponível.",
  bodyExamples: { "1": "Pessoa fictícia" },
};
const item: MetaTemplate = {
  id: "777777",
  name: draft.name,
  language: "pt_BR",
  category: "UTILITY",
  status: "APPROVED",
  parameterFormat: "POSITIONAL",
  components: [{ type: "BODY", text: draft.body }],
  rejectionReason: null,
  fingerprint: "f".repeat(64),
  editable: true,
  editReason: null,
  draft,
};
const caps = { view: true, create: true, update: true, delete: true };
const context: MetaTemplateContext = {
  actor: U,
  workspace: W,
  readOnly: false,
  capabilities: caps,
  targets: [target],
};
let host: HTMLDivElement, root: Root, qc: QueryClient;
beforeEach(() => {
  vi.clearAllMocks();
  state.permissions = new Set([
    "system.channels.view.workspace",
    "system.whatsapp.view.workspace",
    ...["view", "create", "update", "delete"].map(
      (action) => `system.whatsapp_templates.${action}.workspace`,
    ),
  ]);
  state.readOnly = false;
  state.getContext.mockResolvedValue(context);
  state.list.mockResolvedValue({
    target,
    capabilities: caps,
    items: [item],
    nextCursor: null,
    fetchedAt: "2026-11-21T00:00:00Z",
    providerNote: null,
  });
  state.inspect.mockResolvedValue({
    scope: "variant",
    name: item.name,
    language: item.language,
    languages: [item.language],
    variantIds: [item.id],
  });
  state.create.mockResolvedValue({
    success: true,
    id: "888888",
    status: "PENDING",
    message: "Modelo recebido pela Meta.",
  });
  state.update.mockResolvedValue({
    success: true,
    id: item.id,
    status: "PENDING",
    message: "Alteração recebida pela Meta.",
  });
  state.remove.mockResolvedValue({
    success: true,
    id: item.id,
    status: "DELETED",
    message: "Modelo excluído na Meta.",
  });
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
});
afterEach(async () => {
  await act(async () => root.unmount());
  qc.clear();
  host.remove();
  vi.unstubAllGlobals();
});
async function render(node: ReactNode) {
  await act(async () => root.render(createElement(QueryClientProvider, { client: qc }, node)));
}
function button(label: string) {
  return [...document.querySelectorAll<HTMLButtonElement>("button")].find(
    (entry) => entry.getAttribute("aria-label") === label || entry.textContent?.trim() === label,
  )!;
}
async function click(label: string) {
  await act(async () => button(label).click());
}
async function change(id: string, value: string) {
  const element = document.getElementById(id) as
    | HTMLInputElement
    | HTMLSelectElement
    | HTMLTextAreaElement;
  await act(async () => {
    const prototype =
      element instanceof HTMLSelectElement
        ? HTMLSelectElement.prototype
        : element instanceof HTMLTextAreaElement
          ? HTMLTextAreaElement.prototype
          : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, "value")!.set!.call(element, value);
    element.dispatchEvent(
      new Event(element instanceof HTMLSelectElement ? "change" : "input", { bubbles: true }),
    );
  });
}
async function openAccount() {
  await render(createElement(MetaTemplatesPage));
  await vi.waitFor(() => expect(state.getContext).toHaveBeenCalledTimes(1));
  await accountReady();
  await change("meta-template-target", target.id);
  await vi.waitFor(() => expect(document.body.textContent).toContain(item.name));
}
async function accountReady() {
  await vi.waitFor(() => {
    const select = document.getElementById("meta-template-target") as HTMLSelectElement;
    expect(select.disabled).toBe(false);
    expect([...select.options].some((option) => option.value === target.id)).toBe(true);
  });
}
function listProps(change: Record<string, unknown> = {}) {
  return {
    items: [item],
    target,
    pending: false,
    canCreate: false,
    canUpdate: false,
    canDelete: false,
    onDetails: vi.fn(),
    onEdit: vi.fn(),
    onCopy: vi.fn(),
    onDelete: vi.fn(),
    ...change,
  };
}

it("does not query Meta context when the template view key is absent", async () => {
  state.permissions.delete("system.whatsapp_templates.view.workspace");
  await render(createElement(MetaTemplatesPage));
  expect(host.textContent).toContain("Sem permissão");
  expect(state.getContext).not.toHaveBeenCalled();
  expect(state.list).not.toHaveBeenCalled();
});
it("does not query Meta context without the required channel view key", async () => {
  state.permissions.delete("system.channels.view.workspace");
  await render(createElement(MetaTemplatesPage));
  expect(host.textContent).toContain("Sem permissão");
  expect(state.getContext).not.toHaveBeenCalled();
});
it("shows the shared WABA numbers and queries only the account selected by the user", async () => {
  await openAccount();
  expect(host.textContent).toContain("Catálogo compartilhado");
  expect(host.textContent).toContain(target.numbers[0].phone);
  expect(host.textContent).toContain(target.numbers[1].phone);
  expect(state.list).toHaveBeenCalledWith({
    data: { workspaceId: W, targetId: target.id, cursor: undefined },
  });
  expect(state.create).not.toHaveBeenCalled();
});
it("rejects a mismatched context workspace before requesting the provider catalogue", async () => {
  state.getContext.mockResolvedValue({
    ...context,
    workspace: "20000000-0000-4000-8000-000000000099",
  });
  await render(createElement(MetaTemplatesPage));
  await vi.waitFor(() =>
    expect(host.textContent).toContain("Não foi possível confirmar a identidade"),
  );
  expect(state.list).not.toHaveBeenCalled();
  expect(button("Novo modelo").disabled).toBe(true);
});
it("keeps provider failures distinct from an empty catalogue", async () => {
  state.list.mockRejectedValue(Error("Consulta indisponível."));
  await render(createElement(MetaTemplatesPage));
  await vi.waitFor(() => expect(state.getContext).toHaveBeenCalled());
  await accountReady();
  await change("meta-template-target", target.id);
  await vi.waitFor(() =>
    expect(host.textContent).toContain("A falha não significa que a conta está sem modelos."),
  );
  expect(host.textContent).not.toContain("A Meta não retornou modelos");
  expect(button("Novo modelo").disabled).toBe(true);
});
it("keeps template mutations disabled in a read-only view-as session", async () => {
  state.readOnly = true;
  await openAccount();
  expect(button("Novo modelo").disabled).toBe(true);
  expect(button(`Editar ${item.name} ${item.language}`)).toBeUndefined();
  expect(button(`Excluir ${item.name} ${item.language}`)).toBeUndefined();
  expect(state.create).not.toHaveBeenCalled();
});
it("does not retain the previous account rows or draft after changing the selected account", async () => {
  const second = { ...target, id: "cloud:connection2", label: "Outra conta" };
  state.getContext.mockResolvedValue({ ...context, targets: [target, second] });
  state.list.mockImplementation(({ data }: { data: { targetId: string } }) =>
    data.targetId === target.id
      ? Promise.resolve({ target, capabilities: caps, items: [item], nextCursor: null })
      : new Promise(() => {}),
  );
  await openAccount();
  await change("meta-template-target", second.id);
  expect(host.textContent).not.toContain(item.name);
  expect(host.textContent).toContain("Consultando modelos na Meta");
  expect(button("Novo modelo").disabled).toBe(true);
});
it("shows read-only details without exposing mutation controls to a viewer", async () => {
  const props = listProps();
  await render(createElement(MetaTemplateList, props));
  await click(`Conferir ${item.name} ${item.language}`);
  expect(props.onDetails).toHaveBeenCalledWith(item);
  expect(button(`Editar ${item.name} ${item.language}`)).toBeUndefined();
  expect(button(`Excluir ${item.name} ${item.language}`)).toBeUndefined();
  expect(button(`Duplicar ${item.name} ${item.language}`)).toBeUndefined();
});
it("offers a new version instead of in-place editing for a Lovable template", async () => {
  const props = listProps({
    target: { ...target, provider: "lovable" },
    canCreate: true,
    canUpdate: true,
  });
  await render(createElement(MetaTemplateList, props));
  expect(button(`Editar ${item.name} ${item.language}`)).toBeUndefined();
  await click(`Nova versão de ${item.name} ${item.language}`);
  expect(props.onCopy).toHaveBeenCalledWith(item);
  expect(props.onEdit).not.toHaveBeenCalled();
});
it("keeps unsupported advanced components intact and prevents truncating edits or copies", async () => {
  const advanced = {
    ...item,
    draft: null,
    components: [{ type: "CAROUSEL", cards: [{ body: "conteúdo avançado" }] }],
  };
  const props = listProps({ items: [advanced], canCreate: true, canUpdate: true });
  await render(createElement(MetaTemplateList, props));
  expect(button(`Editar ${item.name} ${item.language}`).disabled).toBe(true);
  expect(button(`Duplicar ${item.name} ${item.language}`).disabled).toBe(true);
  await render(createElement(MetaTemplateDetails, { template: advanced }));
  expect(host.textContent).toContain("conteúdo avançado");
  expect(host.textContent).toContain("componentes avançados");
});
it("filters the loaded template content and names without a second command filter", () => {
  const value = {
    ...item,
    name: "aviso_tecnico",
    components: [{ type: "BODY", text: "Atualização de contratação" }],
  };
  expect(
    filterMetaTemplates([value], { search: "ATUALIZACAO", status: "", category: "", language: "" }),
  ).toEqual([value]);
  expect(
    filterMetaTemplates([value], {
      search: "tecnico",
      status: "APPROVED",
      category: "UTILITY",
      language: "pt_BR",
    }),
  ).toEqual([value]);
  expect(
    filterMetaTemplates([value], { search: "", status: "REJECTED", category: "", language: "" }),
  ).toEqual([]);
});
it("requires exact template identity and the explicit all-languages acknowledgement before a legacy deletion", async () => {
  state.getContext.mockResolvedValue({ ...context, targets: [{ ...target, provider: "lovable" }] });
  state.list.mockResolvedValue({
    target: { ...target, provider: "lovable" },
    capabilities: caps,
    items: [item],
    nextCursor: null,
  });
  state.inspect.mockResolvedValue({
    scope: "all_languages",
    name: item.name,
    language: item.language,
    languages: ["pt_BR", "en_US"],
    variantIds: [item.id, "999999"],
  });
  await openAccount();
  await click(`Excluir ${item.name} ${item.language}`);
  await vi.waitFor(() => expect(document.body.textContent).toContain("TODOS os idiomas"));
  expect(button("Excluir modelo na Meta").disabled).toBe(true);
  await change("meta-delete-confirmation", `${item.name} · ${item.language} · ${item.id}`);
  expect(button("Excluir modelo na Meta").disabled).toBe(true);
  const checkbox = document.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
  await act(async () => checkbox.click());
  expect(button("Excluir modelo na Meta").disabled).toBe(false);
  await click("Excluir modelo na Meta");
  await vi.waitFor(() => expect(state.remove).toHaveBeenCalledTimes(1));
  expect(state.remove).toHaveBeenCalledWith({
    data: {
      workspaceId: W,
      targetId: target.id,
      templateId: item.id,
      expectedFingerprint: item.fingerprint,
      name: item.name,
      language: item.language,
      confirmAllLanguages: true,
      expectedVariantIds: [item.id, "999999"],
    },
  });
});
it("does not delete a template when the confirmation is canceled", async () => {
  await openAccount();
  await click(`Excluir ${item.name} ${item.language}`);
  await vi.waitFor(() =>
    expect(document.getElementById("meta-delete-confirmation")).not.toBeNull(),
  );
  await click("Cancelar exclusão");
  expect(state.remove).not.toHaveBeenCalled();
});
it("does not retry a failed create and refreshes the catalogue before another attempt", async () => {
  state.create.mockRejectedValue(Error("Resultado não confirmado pela Meta."));
  await openAccount();
  await click("Novo modelo");
  await change("meta-template-name", "aviso_novo");
  await change("meta-template-body", "Há uma atualização solicitada no TechERP.");
  await click("Criar modelo na Meta");
  await vi.waitFor(() => expect(state.create).toHaveBeenCalledTimes(1));
  await vi.waitFor(() =>
    expect(document.body.textContent).toContain("Confira o catálogo atualizado antes de repetir"),
  );
  expect(state.list.mock.calls.length).toBeGreaterThanOrEqual(2);
  expect(document.body.textContent).not.toContain("Modelo recebido pela Meta.");
});
it("blocks invalid positional variables before submitting the editor", async () => {
  const onSubmit = vi.fn();
  await render(
    createElement(MetaTemplateEditor, {
      initial: { ...draft, body: "Olá {{2}}", bodyExamples: { "2": "Teste" } },
      mode: "create",
      target,
      pending: false,
      canSubmit: true,
      onCancel: vi.fn(),
      onSubmit,
      onUpload: vi.fn(),
    }),
  );
  await click("Criar modelo na Meta");
  expect(onSubmit).not.toHaveBeenCalled();
  expect(host.querySelector('[role="alert"]')).not.toBeNull();
});
it("keeps template name language and parameter format immutable during editing", async () => {
  await render(
    createElement(MetaTemplateEditor, {
      initial: draft,
      mode: "update",
      target,
      pending: false,
      canSubmit: true,
      onCancel: vi.fn(),
      onSubmit: vi.fn(),
      onUpload: vi.fn(),
    }),
  );
  expect((document.getElementById("meta-template-name") as HTMLInputElement).disabled).toBe(true);
  expect((document.getElementById("meta-template-language") as HTMLInputElement).disabled).toBe(
    true,
  );
  expect((document.getElementById("meta-template-format") as HTMLSelectElement).disabled).toBe(
    true,
  );
  expect((document.getElementById("meta-template-body") as HTMLTextAreaElement).disabled).toBe(
    false,
  );
});
it("submits the complete valid definition without sending a WhatsApp message", async () => {
  const onSubmit = vi.fn();
  await render(
    createElement(MetaTemplateEditor, {
      initial: draft,
      mode: "create",
      target,
      pending: false,
      canSubmit: true,
      onCancel: vi.fn(),
      onSubmit,
      onUpload: vi.fn(),
    }),
  );
  await click("Criar modelo na Meta");
  expect(onSubmit).toHaveBeenCalledWith(draft);
  expect(state.create).not.toHaveBeenCalled();
  expect(state.upload).not.toHaveBeenCalled();
});
it("renders template content and samples as text rather than executable HTML", async () => {
  await render(
    createElement(MetaTemplatePreview, {
      draft: {
        ...draft,
        body: "<img src=x onerror=alert(1)> {{1}}",
        bodyExamples: { "1": "<script>teste</script>" },
      },
    }),
  );
  expect(host.querySelector("img")).toBeNull();
  expect(host.querySelector("script")).toBeNull();
  expect(host.textContent).toContain("<script>teste</script>");
});
it("does not read inherited object properties as named variable examples", async () => {
  await render(
    createElement(MetaTemplatePreview, {
      draft: { ...draft, parameterFormat: "NAMED", body: "Olá {{constructor}}", bodyExamples: {} },
    }),
  );
  expect(host.textContent).toContain("{{constructor}}");
  expect(host.textContent).not.toContain("function Object");
});
it("renders the authentication copy-code preset without a free-form message editor", async () => {
  await render(
    createElement(MetaTemplateEditor, {
      initial: { ...draft, category: "AUTHENTICATION" },
      mode: "create",
      target,
      pending: false,
      canSubmit: true,
      onCancel: vi.fn(),
      onSubmit: vi.fn(),
      onUpload: vi.fn(),
    }),
  );
  expect(document.getElementById("meta-template-body")).toBeNull();
  expect(host.textContent).toContain("Copiar código");
  expect(host.textContent).toContain("texto final é definido pela Meta");
});
it("links the notification consumer to the general editor only when separately permitted", async () => {
  const props = { templates: [], loading: false, canRead: true, onRetry: vi.fn() };
  await render(createElement(DeliveryModelsPanel, props));
  expect(host.querySelector('a[href="/settings/whatsapp-templates"]')).toBeNull();
  await render(createElement(DeliveryModelsPanel, { ...props, canManageMetaTemplates: true }));
  expect(host.querySelector('a[href="/settings/whatsapp-templates"]')).not.toBeNull();
});

it("maps the template route to the dedicated workspace-only resource", () => {
  const route = "/settings/whatsapp-templates";
  expect(salesRouteResources(route)).toEqual(["system.whatsapp_templates"]);
  expect(resourcesForUrl(route)).toEqual(["system.whatsapp_templates"]);
  expect(
    canViewSalesRoute(route, new Set(["system.whatsapp_templates.view.workspace"]), true),
  ).toBe(true);
  expect(canViewSalesRoute(route, new Set(["system.whatsapp_templates.view.own"]), true)).toBe(
    false,
  );
  expect(canViewSalesRoute(route, new Set(["system.whatsapp.view.workspace"]), true)).toBe(false);
});
