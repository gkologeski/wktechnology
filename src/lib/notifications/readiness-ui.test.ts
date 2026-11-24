// @vitest-environment jsdom
import { act, createElement, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const W = "aaaaaaaa-1111-4111-8111-111111111111",
  ID = "bbbbbbbb-1111-4111-8111-111111111111",
  OTHER_ID = "cccccccc-1111-4111-8111-111111111111";
const state = vi.hoisted(() => ({
  userId: "actor",
  workspaceId: "aaaaaaaa-1111-4111-8111-111111111111" as string | null,
  loading: false,
  error: false,
  settings: true,
  workflows: true,
  list: vi.fn(),
  inspect: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ useAuth: () => ({ user: { id: state.userId } }) }));
vi.mock("@/lib/access-control/use-permissions", () => ({
  usePermissions: () => ({
    workspaceId: state.workspaceId,
    isLoading: state.loading,
    isError: state.error,
    can: () => state.settings,
    canAny: () => state.workflows,
  }),
}));
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock("@/lib/notification-delivery.functions", () => ({
  listNotificationReadinessWorkflows: (input: unknown) => state.list(input),
  getNotificationReadiness: (input: unknown) => state.inspect(input),
}));
vi.mock("@/lib/crm", () => ({ formatDateTime: (value: string) => value }));
import { NotificationReadinessPanel } from "@/components/notifications/notification-readiness-panel";
import type { NotificationReadinessReport } from "./readiness-types";
let host: HTMLDivElement, root: Root, client: QueryClient;
const report = (id = ID): NotificationReadinessReport => ({
  workspaceId: W,
  checkedAt: "2026-11-20T15:00:00.000Z",
  workflow: {
    id,
    status: "published",
    enabled: false,
    publishedVersion: 4,
    eventKey: "projects.task.overdue",
  },
  checks: [
    {
      code: "published_configuration",
      scope: "workflow",
      status: "observed",
      reason: "published_configuration_valid",
    },
    {
      code: "email_policy",
      scope: "email",
      status: "dependency_blocked",
      reason: "email_disabled",
    },
    {
      code: "live_provider",
      scope: "operation",
      status: "manual_pending",
      reason: "provider_live_manual",
    },
    {
      code: "slack_policy",
      scope: "slack",
      status: "unavailable",
      reason: "channel_access_unavailable",
    },
  ],
  notes: [
    "published_configuration_only",
    "drafts_excluded",
    "no_runtime_execution",
    "no_global_send_readiness",
  ],
  runbookVersion: "p13-v1",
});
const props = () => ({ userId: state.userId, workspaceId: W });
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  state.userId = "actor";
  state.workspaceId = W;
  state.loading = false;
  state.error = false;
  state.settings = true;
  state.workflows = true;
  state.list.mockReset().mockResolvedValue({
    items: [
      { id: ID, name: "Regra com versão publicada" },
      { id: OTHER_ID, name: "Outra regra visível" },
    ],
    truncated: false,
  });
  state.inspect.mockReset().mockResolvedValue(report());
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});
afterEach(async () => {
  await act(async () => root.unmount());
  client.clear();
  host.remove();
  vi.unstubAllGlobals();
});
async function render(node: ReactNode = createElement(NotificationReadinessPanel, props())) {
  await act(async () => {
    root.render(createElement(QueryClientProvider, { client }, node));
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
}
async function choose(id = ID) {
  const select = host.querySelector<HTMLSelectElement>(
    '[aria-label="Regra para conferir preparo"]',
  )!;
  expect(select).toBeTruthy();
  await act(async () => {
    select.value = id;
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
}
const button = (text = "Conferir configuração publicada") =>
  [...host.querySelectorAll("button")].find((node) => node.textContent === text)!;
async function click(text?: string) {
  await act(async () => {
    button(text).click();
  });
  // Commit the requested query before waiting for React Query's notifications.
  // A timer inside the click's act can expire before React runs that effect.
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
}
async function inspect() {
  await choose();
  await click();
}

it("requires explicit selection and request without automatically choosing the first workflow", async () => {
  await render();
  expect(
    host.querySelector<HTMLSelectElement>('[aria-label="Regra para conferir preparo"]')!.value,
  ).toBe("");
  expect(button().disabled).toBe(true);
  expect(state.inspect).not.toHaveBeenCalled();
  await choose();
  expect(state.inspect).not.toHaveBeenCalled();
});
it("loads the explicit current workspace and displays the published report without a readiness verdict", async () => {
  await render();
  await inspect();
  expect(state.inspect).toHaveBeenCalledExactlyOnceWith({
    data: { workspaceId: W, workflowId: ID },
  });
  expect(host.textContent).toContain("versão publicada 4");
  expect(host.textContent).toContain("Rascunhos fora da conferência; compare no editor");
  for (const label of [
    "Configuração consultada",
    "Dependência bloqueada",
    "Verificação manual pendente",
    "Indisponível",
  ])
    expect(host.textContent).toContain(label);
  expect(host.textContent).not.toMatch(/pronto para enviar|envio liberado|piloto aprovado/i);
});
it.each(["settings", "workflows"] as const)(
  "does not query or expose the panel without %s read permission",
  async (permission) => {
    state[permission] = false;
    await render();
    expect(state.list).not.toHaveBeenCalled();
    expect(state.inspect).not.toHaveBeenCalled();
    expect(host.querySelector("select")).toBeNull();
  },
);
it.each(["actor", "workspace", "loading", "error"] as const)(
  "fails closed for mismatched or unconfirmed %s context",
  async (mode) => {
    const expected = props();
    if (mode === "actor") state.userId = "other";
    if (mode === "workspace") state.workspaceId = "other";
    if (mode === "loading") state.loading = true;
    if (mode === "error") state.error = true;
    await render(createElement(NotificationReadinessPanel, expected));
    expect(state.list).not.toHaveBeenCalled();
    expect(state.inspect).not.toHaveBeenCalled();
    expect(host.textContent).toContain("Aguardando confirmação");
  },
);
it("shows the limited authorized list without calling it a complete workspace inventory", async () => {
  state.list.mockResolvedValue({ items: [{ id: ID, name: "Regra visível" }], truncated: true });
  await render();
  expect(host.textContent).toContain("primeiras 100 regras visíveis");
  expect(host.textContent).toContain("inventário completo em Workflows");
  expect(state.inspect).not.toHaveBeenCalled();
});
it("does not expose a warm cached report until a fresh explicit read completes", async () => {
  client.setQueryData(["notification-readiness", "actor", W, ID], {
    ...report(),
    workflow: { ...report().workflow, publishedVersion: 999 },
  });
  let finish!: (value: NotificationReadinessReport) => void;
  state.inspect.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  await render();
  await inspect();
  expect(host.querySelector('[aria-label="Resultado do preparo publicado"]')).toBeNull();
  expect(host.textContent).not.toContain("999");
  await act(async () => {
    finish(report());
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
  expect(host.textContent).toContain("versão publicada 4");
});
it("clears a previous report when choosing another workflow and waits for a new request", async () => {
  await render();
  await inspect();
  expect(host.textContent).toContain("versão publicada 4");
  await choose(OTHER_ID);
  expect(host.querySelector('[aria-label="Resultado do preparo publicado"]')).toBeNull();
  expect(state.inspect).toHaveBeenCalledTimes(1);
});
it("hides a report during revalidation and removes it after the fresh request fails", async () => {
  await render();
  await inspect();
  let fail!: (cause: Error) => void;
  state.inspect.mockImplementation(
    () =>
      new Promise((_, reject) => {
        fail = reject;
      }),
  );
  await act(async () => {
    void client.invalidateQueries({ queryKey: ["notification-readiness", "actor", W, ID] });
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
  expect(host.querySelector('[aria-label="Resultado do preparo publicado"]')).toBeNull();
  await act(async () => {
    fail(new Error("Leitura negada"));
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
  expect(host.textContent).toContain("Nenhum resultado anterior permanece confirmado");
  expect(host.textContent).not.toContain("versão publicada 4");
});
it("hides the report when the fresh workflow list loses access or fails", async () => {
  await render();
  await inspect();
  state.list.mockRejectedValue(new Error("Consulta indisponível"));
  await act(async () => {
    await client.invalidateQueries({ queryKey: ["notification-readiness-workflows", "actor", W] });
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
  expect(host.querySelector('[aria-label="Resultado do preparo publicado"]')).toBeNull();
  expect(host.textContent).toContain("Não foi possível carregar as regras");
});
it("does not project a late old actor response into the new actor's panel", async () => {
  let finish!: (value: NotificationReadinessReport) => void;
  state.inspect.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  await render();
  await inspect();
  state.userId = "second";
  await render();
  await act(async () => {
    finish(report());
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
  expect(host.querySelector('[aria-label="Resultado do preparo publicado"]')).toBeNull();
  expect(
    host.querySelector<HTMLSelectElement>('[aria-label="Regra para conferir preparo"]')!.value,
  ).toBe("");
  expect(client.getQueryData(["notification-readiness", "actor", W, ID])).toEqual(report());
});
it("rejects a response belonging to another workspace without rendering its report", async () => {
  state.inspect.mockResolvedValue({
    ...report(),
    workspaceId: "dddddddd-1111-4111-8111-111111111111",
  });
  await render();
  await inspect();
  expect(host.querySelector('[aria-label="Resultado do preparo publicado"]')).toBeNull();
  expect(host.textContent).toContain("Não foi possível vincular a conferência");
});
it("keeps unpublished workflows unavailable instead of reading a draft as published", async () => {
  state.inspect.mockResolvedValue({
    ...report(),
    workflow: { ...report().workflow, status: "draft", publishedVersion: 0 },
    checks: [
      {
        code: "workflow_publication",
        scope: "workflow",
        status: "dependency_blocked",
        reason: "workflow_not_published",
      },
    ],
  });
  await render();
  await inspect();
  expect(host.textContent).toContain("sem versão publicada");
  expect(host.textContent).toContain("O rascunho não foi usado");
});
it("keeps the pilot and pause instructions manual and preserves fallback and uncertain limits", async () => {
  await render();
  expect(host.textContent).toContain("outras regras publicadas e entregas pendentes");
  expect(host.textContent).toContain("fallback de e-mail explícito");
  expect(host.textContent).toContain("não deve ser reenviado como reversão");
  expect(host.querySelector('[type="checkbox"]')).toBeNull();
  expect(
    [...host.querySelectorAll("button")].some((node) =>
      /enviar teste|ativar|pausar/i.test(node.textContent ?? ""),
    ),
  ).toBe(false);
});

it("does not impose personal WhatsApp consent or phone as a condition for collective Slack or in-app-only rules", async () => {
  state.inspect.mockResolvedValue({
    ...report(),
    workflow: { ...report().workflow, eventKey: null },
    checks: [
      {
        code: "personal_consent",
        scope: "operation",
        status: "manual_pending",
        reason: "recipient_consent_manual",
      },
    ],
  });
  await render();
  await inspect();
  expect(host.textContent).toContain("Preferências e consentimentos por canal");
  expect(host.textContent).toContain("para WhatsApp pessoal, consentimento e telefone atuais");
  expect(host.textContent).toContain("Slack exige revisão do público coletivo");
  expect(host.textContent).not.toContain("telefone atual e preferências de cada destinatário");
});

it.each([
  { name: "an empty authorized list", items: [] },
  {
    name: "another workflow remains visible",
    items: [
      {
        id: OTHER_ID,
        name: "Outra regra visível",
        status: "published",
        enabled: false,
        publishedVersion: 4,
      },
    ],
  },
])(
  "hides a cached report when a fresh successful list removes its workflow: $name",
  async ({ items }) => {
    await render();
    await inspect();
    expect(host.textContent).toContain("versão publicada 4");
    expect(state.inspect).toHaveBeenCalledTimes(1);
    state.list.mockResolvedValue({ items, truncated: false });
    await act(async () => {
      await client.invalidateQueries({
        queryKey: ["notification-readiness-workflows", "actor", W],
      });
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(client.getQueryData(["notification-readiness", "actor", W, ID])).toEqual(report());
    expect(host.querySelector('[aria-label="Resultado do preparo publicado"]')).toBeNull();
    expect(host.textContent).not.toContain("versão publicada 4");
    expect(host.textContent).toContain("Regra selecionada indisponível");
    expect(button().disabled).toBe(true);
    expect(state.inspect).toHaveBeenCalledTimes(1);
    const select = host.querySelector<HTMLSelectElement>(
      '[aria-label="Regra para conferir preparo"]',
    )!;
    expect(select.querySelector<HTMLOptionElement>(`option[value="${ID}"]`)!.disabled).toBe(true);
    expect(Boolean(select.querySelector(`option[value="${OTHER_ID}"]`))).toBe(items.length > 0);
  },
);
