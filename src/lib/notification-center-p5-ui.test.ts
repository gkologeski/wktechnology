// @vitest-environment jsdom
import { act, createElement, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children?: ReactNode; to: string }) =>
    createElement("a", { href: to }, children),
}));
vi.mock("@/lib/crm", () => ({ formatDateTime: (value: string) => value }));
vi.mock("@/lib/audit-session", () => ({
  beginAuditSession: () => "synthetic-session",
  endAuditSession: () => {},
}));
import { NotificationCenter } from "@/components/notifications/notification-center";
import type { NotificationCenterItem } from "./notification-center";
const row: NotificationCenterItem = {
  id: "11111111-1111-4111-8111-111111111111",
  type: "workflow",
  title: "Contexto autorizado",
  body: "Consulte a origem",
  entity: "deals",
  entity_id: "22222222-2222-4222-8222-222222222222",
  link: "/deals/22222222-2222-4222-8222-222222222222",
  created_at: "2026-11-20T10:00:00Z",
  read_at: null,
  snoozed_until: null,
  moduleKey: "crm",
  event: { eventKey: "legacy.workflow", category: "workflow", moduleKey: null },
};
const callbacks = {
  onFilters: vi.fn(),
  onSelect: vi.fn(),
  onRead: vi.fn(),
  onSnooze: vi.fn(),
  onRetry: vi.fn(),
  onMore: vi.fn(),
  onDismiss: vi.fn(),
};
type Props = Parameters<typeof NotificationCenter>[0];
let root: Root, host: HTMLDivElement;
async function render(patch: Partial<Props> = {}) {
  await act(async () =>
    root.render(
      createElement(NotificationCenter, {
        items: [row],
        filters: { scope: "workspace", status: "all", category: "", module: "", q: "" },
        selectedId: null,
        unread: 1,
        loading: false,
        pending: false,
        hasMore: false,
        loadingMore: false,
        ...callbacks,
        ...patch,
      }),
    ),
  );
}
function button(text: string) {
  return Array.from(document.querySelectorAll("button")).find(
    (item) => item.textContent?.trim() === text,
  );
}
async function click(element: Element | undefined | null) {
  expect(element).toBeDefined();
  await act(async () => element!.dispatchEvent(new MouseEvent("click", { bubbles: true })));
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});
it.each([{ loading: true }, { searchPending: true }, { error: "Falha sintética" }])(
  "hides cached content, action batch and numeric count while unavailable: %j",
  async (patch) => {
    await render({ ...patch, selectedId: row.id, hasMore: true });
    expect(host.textContent).not.toContain(row.title);
    expect(host.textContent).not.toContain("Nenhuma notificação encontrada");
    expect(host.querySelector('[aria-label="Contagem indisponível"]')?.textContent).toBe("…");
    expect(button("Marcar carregadas como lidas")).toBeUndefined();
    expect(button("Carregar anteriores")).toBeUndefined();
    expect(callbacks.onRead).not.toHaveBeenCalled();
  },
);
it("explains pending search without exposing actions against the prior result", async () => {
  await render({ searchPending: true, selectedId: row.id });
  expect(host.querySelector('[role="status"]')?.textContent).toContain("Atualizando a busca");
  expect(button("Marcar como lida")).toBeUndefined();
});
it("legacy history disables content search and clears stale query and module on selection", async () => {
  await render({
    filters: {
      scope: "workspace",
      status: "all",
      category: "workflow",
      module: "crm",
      q: "PRIVATE",
    },
  });
  await click(button("Histórico sem workspace"));
  expect(callbacks.onFilters).toHaveBeenCalledExactlyOnceWith({
    scope: "legacy",
    status: "all",
    category: "workflow",
    module: "",
    q: "",
  });
  await render({
    filters: { scope: "legacy", status: "all", category: "", module: "crm", q: "PRIVATE" },
  });
  expect((host.querySelector("input") as HTMLInputElement).disabled).toBe(true);
  expect((host.querySelector("input") as HTMLInputElement).value).toBe("");
  expect(host.textContent).toContain("busca por conteúdo fica desativada");
});
it("shows a focused authorized item outside the loaded page without inventing a list row", async () => {
  await render({ items: [], selectedId: row.id, focusedItem: row });
  expect(host.querySelector("aside h2")?.textContent).toBe(row.title);
  expect(host.querySelector('[aria-label="Notificações carregadas"]')).toBeNull();
  await click(button("Marcar como lida"));
  expect(callbacks.onRead).toHaveBeenCalledWith([row.id], true);
});
it("focused lookup failure does not expose cached item or allow personal mutations", async () => {
  await render({
    selectedId: row.id,
    items: [],
    focusedItem: row,
    detailError: "Aviso indisponível",
  });
  expect(host.querySelector('aside [role="alert"]')?.textContent).toBe("Aviso indisponível");
  expect(host.querySelector("aside")?.textContent).not.toContain(row.title);
  expect(button("Marcar como lida")).toBeUndefined();
});
it("expired snooze does not present a cancel control as an active deferment", async () => {
  await render({ selectedId: row.id, items: [{ ...row, snoozed_until: "2020-01-01T00:00:00Z" }] });
  expect(button("Cancelar adiamento")).toBeUndefined();
  expect(host.querySelector("aside")?.textContent).not.toContain("Retorno em");
});
it("mobile opens the canonical accessible sheet and restores focus to the originating notification", async () => {
  vi.stubGlobal("matchMedia", () => ({
    matches: true,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  await render();
  const source = host.querySelector(
    '[aria-label="Notificações carregadas"] button',
  ) as HTMLButtonElement;
  await click(source);
  await render({ selectedId: row.id });
  const dialog = document.querySelector('[role="dialog"]');
  expect(dialog).not.toBeNull();
  expect(dialog?.textContent).toContain(row.title);
  expect(document.activeElement?.textContent).toBe("Detalhe da notificação");
  await click(button("Fechar"));
  await vi.waitFor(() => expect(document.activeElement).toBe(source));
  expect(callbacks.onDismiss).toHaveBeenCalledOnce();
});
it("mobile keeps private cached details hidden when revalidation fails", async () => {
  vi.stubGlobal("matchMedia", () => ({
    matches: true,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  await render({ selectedId: row.id });
  await render({ selectedId: row.id, error: "Acesso indisponível" });
  const dialog = document.querySelector('[role="dialog"]');
  expect(dialog?.textContent).toContain("Acesso indisponível");
  expect(dialog?.textContent).not.toContain(row.title);
  expect(button("Marcar como lida")).toBeUndefined();
});

it("mobile preserves the open sheet and focus while background revalidation hides cached content", async () => {
  vi.stubGlobal("matchMedia", () => ({
    matches: true,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  await render({ selectedId: row.id });
  const dialog = document.querySelector('[role="dialog"]');
  const focused = document.activeElement;
  await render({ selectedId: row.id, loading: true });
  expect(document.querySelector('[role="dialog"]')).toBe(dialog);
  expect(dialog?.textContent).toContain("Conferindo acesso ao aviso");
  expect(dialog?.textContent).not.toContain(row.title);
  expect(document.activeElement).toBe(focused);
  await render({ selectedId: row.id });
  expect(document.querySelector('[role="dialog"]')).toBe(dialog);
  expect(dialog?.textContent).toContain(row.title);
  expect(document.activeElement).toBe(focused);
});
