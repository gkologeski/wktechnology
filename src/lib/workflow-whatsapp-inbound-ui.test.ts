// @vitest-environment jsdom
import { act, createElement, useState, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const W = "aaaaaaaa-1111-4111-8111-111111111111";
const OTHER = "bbbbbbbb-2222-4222-8222-222222222222";
const CLOUD = `cloud:${W}`;
const LOVABLE = `lovable:${OTHER}`;
const keys = [
  "system.workflows.view.workspace",
  "system.workflows.manage.workspace",
  "techsales.inbox.whatsapp.view.workspace",
];
const state = vi.hoisted(() => ({
  userId: "user-a",
  workspace: "aaaaaaaa-1111-4111-8111-111111111111" as string | null,
  loading: false,
  error: false,
  permissions: new Set<string>(),
  denied: new Set<string>(),
  list: vi.fn(),
}));
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock("@/lib/auth", () => ({ useAuth: () => ({ user: { id: state.userId }, loading: false }) }));
vi.mock("@/lib/access-control/use-permissions", () => ({
  usePermissions: () => ({
    workspaceId: state.workspace,
    isLoading: state.loading,
    isError: state.error,
    canAny: (items: string[]) =>
      items.some((item) => state.permissions.has(item) && !state.denied.has(item)),
    refetch: vi.fn(),
  }),
}));
vi.mock("@/lib/workflows/whatsapp-inbound.functions", () => ({
  listWorkflowWhatsAppSources: (input: unknown) => state.list(input),
}));
import { WhatsAppInboundFilters } from "@/components/workflows/builder/whatsapp-inbound-filters";
import type { WorkflowNotificationEventSelection } from "./workflows/notification-events";

const data = (workspace_id = W) => ({
  workspace_id,
  sources: [
    {
      id: CLOUD,
      label: "Cloud principal",
      numbers: [{ id: "123456789", label: "Número principal", phone: "+55 48 3012-1055" }],
    },
    {
      id: LOVABLE,
      label: "Lovable Lia",
      numbers: [{ id: "987654321", label: "Lia", phone: "+55 48 6137-0317" }],
    },
  ],
});
let host: HTMLDivElement,
  root: Root,
  client: QueryClient,
  current: WorkflowNotificationEventSelection;
function Harness({
  initial = { key: "shared.message.received" },
}: {
  initial?: WorkflowNotificationEventSelection;
}) {
  const [selection, setSelection] = useState(initial);
  current = selection;
  return createElement(WhatsAppInboundFilters, { selection, onChange: setSelection });
}
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  state.userId = "user-a";
  state.workspace = W;
  state.loading = false;
  state.error = false;
  state.permissions = new Set(keys);
  state.denied = new Set();
  state.list.mockReset().mockResolvedValue(data());
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});
afterEach(async () => {
  await act(async () => root.unmount());
  client.clear();
  host.remove();
});
async function render(node: ReactNode = createElement(Harness)) {
  await act(async () => root.render(createElement(QueryClientProvider, { client }, node)));
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 5));
  });
}
async function click(label: string) {
  await act(async () =>
    host.querySelector<HTMLButtonElement>(`[role="checkbox"][aria-label="${label}"]`)!.click(),
  );
}

it("loads only authorized business-account metadata with a user and workspace cache key", async () => {
  await render();
  expect(state.list).toHaveBeenCalledWith({ data: {} });
  expect(host.textContent).toContain("Cloud principal");
  expect(host.textContent).toContain("Lovable Lia");
  expect(host.textContent).toContain("qualquer conta e número autorizado");
  expect(host.textContent).toContain("não o telefone do cliente");
  expect(client.getQueryData(["workflow-whatsapp-sources", "user-a", W])).toEqual(data());
  expect(current).toEqual({ key: "shared.message.received" });
});

it("supports selecting multiple accounts and numbers as an explicit intersection", async () => {
  await render();
  await click("Conta Cloud principal");
  await click("Conta Lovable Lia");
  await click("Número +55 48 3012-1055 · Cloud principal");
  await click("Número +55 48 6137-0317 · Lovable Lia");
  expect(current).toEqual({
    key: "shared.message.received",
    source_keys: [CLOUD, LOVABLE],
    phone_number_ids: ["123456789", "987654321"],
  });
});

it("preserves narrowing number filters when the account selection changes instead of broadening silently", async () => {
  await render(
    createElement(Harness, {
      initial: {
        key: "shared.message.received",
        source_keys: [CLOUD],
        phone_number_ids: ["123456789"],
      },
    }),
  );
  await click("Conta Cloud principal");
  await click("Conta Lovable Lia");
  expect(current.phone_number_ids).toEqual(["123456789"]);
  expect(host.textContent).toContain("fora das contas marcadas");
  expect(host.textContent).toContain("A seleção não é ampliada automaticamente");
  await click("Remover número indisponível 123456789");
  expect(current.phone_number_ids).toEqual([]);
});

it("keeps saved unavailable accounts visible for explicit removal without selecting another origin", async () => {
  const missing = `cloud:cccccccc-3333-4333-8333-333333333333`;
  await render(
    createElement(Harness, {
      initial: {
        key: "shared.message.received",
        source_keys: [missing],
        phone_number_ids: ["555555555"],
      },
    }),
  );
  expect(host.textContent).toContain("Conta salva indisponível");
  expect(current.source_keys).toEqual([missing]);
  expect(current.phone_number_ids).toEqual(["555555555"]);
  expect(host.querySelectorAll('[role="checkbox"][aria-checked="true"]')).toHaveLength(2);
});

it("does not query account metadata without the source read key", async () => {
  state.permissions.delete("techsales.inbox.whatsapp.view.workspace");
  await render();
  expect(state.list).not.toHaveBeenCalled();
  expect(host.textContent).toContain("Sem permissão");
  expect(host.textContent).not.toContain("Cloud principal");
});

it("honors an effective deny even while other workflow grants remain", async () => {
  state.denied.add("techsales.inbox.whatsapp.view.workspace");
  await render();
  expect(state.list).not.toHaveBeenCalled();
  expect(host.querySelectorAll('[role="checkbox"]')).toHaveLength(0);
});

it("does not reveal a response from another workspace", async () => {
  state.list.mockResolvedValue({
    ...data(OTHER),
    issues: ["lovable_unavailable", "lovable_unmapped"],
  });
  await render();
  expect(host.querySelector('[role="alert"]')?.textContent).toContain("confirmar o workspace");
  expect(host.textContent).not.toContain("Cloud principal");
  expect(host.textContent).not.toContain("confirmar a conexão Lovable");
  expect(host.textContent).not.toContain("confirmar um vínculo único");
  expect(host.querySelectorAll('[role="checkbox"]')).toHaveLength(0);
});

it("does not query when the active membership context is absent", async () => {
  state.workspace = null;
  await render();
  expect(state.list).not.toHaveBeenCalled();
  expect(host.textContent).not.toContain("Cloud principal");
});

it("distinguishes a consultation failure from an empty catalogue and retains saved filters", async () => {
  state.list.mockRejectedValue(new Error("source unavailable"));
  await render(
    createElement(Harness, { initial: { key: "shared.message.received", source_keys: [CLOUD] } }),
  );
  expect(host.querySelector('[role="alert"]')?.textContent).toContain("Não foi possível consultar");
  expect(host.textContent).toContain("filtros salvos foram preservados");
  expect(host.textContent).not.toContain("Nenhuma conta WhatsApp disponível");
  expect(current.source_keys).toEqual([CLOUD]);
});

it("does not reuse another user's cached account metadata before a fresh consultation", async () => {
  client.setQueryData(["workflow-whatsapp-sources", "user-a", W], data());
  state.userId = "user-b";
  state.list.mockImplementation(() => new Promise(() => {}));
  await render();
  expect(host.textContent).not.toContain("Cloud principal");
  expect(host.textContent).toContain("Consultando contas e números autorizados");
  expect(client.getQueryState(["workflow-whatsapp-sources", "user-b", W])?.status).toBe("pending");
});

it("keeps confirmed Cloud sources available when Lovable verification is unavailable", async () => {
  state.list.mockResolvedValue({
    workspace_id: W,
    sources: [data().sources[0]],
    issues: ["lovable_unavailable"],
  });
  await render();
  expect(host.querySelector('[role="alert"]')?.textContent).toContain(
    "Não foi possível confirmar a conexão Lovable. As conexões Cloud API confirmadas continuam disponíveis.",
  );
  expect(
    host.querySelector('[role="checkbox"][aria-label="Conta Cloud principal"]'),
  ).not.toBeNull();
  expect(host.textContent).toContain("+55 48 3012-1055");
  expect(host.textContent).not.toContain("Lovable Lia");
  expect(host.textContent).not.toContain("Nenhuma conta WhatsApp disponível");
  expect(current).toEqual({ key: "shared.message.received" });
  expect(
    [...host.querySelectorAll("button")].some(
      (button) => button.textContent === "Tentar confirmar conexão Lovable",
    ),
  ).toBe(true);
});

it("preserves unavailable saved Lovable filters and reloads the binding only on explicit retry", async () => {
  state.list
    .mockResolvedValueOnce({
      workspace_id: W,
      sources: [data().sources[0]],
      issues: ["lovable_unmapped"],
    })
    .mockResolvedValue({ ...data(), issues: [] });
  const selection = {
    key: "shared.message.received" as const,
    source_keys: [LOVABLE],
    phone_number_ids: ["987654321"],
  };
  await render(createElement(Harness, { initial: selection }));
  expect(host.textContent).toContain(
    "Não foi possível confirmar um vínculo único da conexão Lovable com um canal de atendimento. Revise o canal antes de usá-lo nesta regra.",
  );
  expect(host.textContent).toContain("Cloud principal");
  expect(host.textContent).toContain("Conta salva indisponível");
  expect(host.textContent).toContain("A seleção não é ampliada automaticamente");
  expect(current).toEqual(selection);
  expect(state.list).toHaveBeenCalledTimes(1);
  const retry = [...host.querySelectorAll("button")].find(
    (button) => button.textContent === "Tentar confirmar conexão Lovable",
  )!;
  await act(async () => {
    retry.click();
    await new Promise((resolve) => setTimeout(resolve, 5));
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 5));
  });
  expect(state.list).toHaveBeenCalledTimes(2);
  expect(host.textContent).toContain("Lovable Lia");
  expect(host.textContent).not.toContain("Conta salva indisponível");
  expect(host.textContent).not.toContain("Não foi possível confirmar um vínculo único");
  expect(current).toEqual(selection);
});
