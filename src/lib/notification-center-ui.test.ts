// @vitest-environment jsdom
import { act, createElement, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  NotificationCenter,
  type CenterFilters,
} from "@/components/notifications/notification-center";
import type { NotificationCenterItem } from "./notification-center";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children?: ReactNode; to: string }) =>
    createElement("a", { href: to }, children),
}));
vi.mock("@/lib/crm", () => ({ formatDateTime: (value: string) => value }));
let root: Root;
let host: HTMLDivElement;
const row = (patch: Partial<NotificationCenterItem> = {}): NotificationCenterItem => ({
  id: "00000000-0000-4000-8000-000000000001",
  type: "workflow",
  title: "Uma revisão está disponível",
  body: "Consulte o registro autorizado.",
  entity: "contracts",
  entity_id: "00000000-0000-4000-8000-000000000010",
  link: "/contracts/00000000-0000-4000-8000-000000000010",
  created_at: "2026-11-20T12:00:00Z",
  read_at: null,
  snoozed_until: null,
  moduleKey: null,
  event: { eventKey: "legacy.workflow", category: "workflow", moduleKey: null },
  ...patch,
});
const baseFilters: CenterFilters = {
  scope: "workspace",
  status: "all",
  category: "",
  module: "",
  q: "",
};
const callbacks = {
  onFilters: vi.fn(),
  onSelect: vi.fn(),
  onRead: vi.fn(),
  onSnooze: vi.fn(),
  onRetry: vi.fn(),
  onMore: vi.fn(),
};
type Props = Parameters<typeof NotificationCenter>[0];
async function render(patch: Partial<Props> = {}) {
  await act(async () =>
    root.render(
      createElement(NotificationCenter, {
        items: [row()],
        filters: baseFilters,
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
async function click(text: string) {
  const button = Array.from(host.querySelectorAll("button")).find(
    (item) => item.textContent?.trim() === text,
  );
  expect(button, text).toBeDefined();
  await act(async () => button!.dispatchEvent(new MouseEvent("click", { bubbles: true })));
}
beforeEach(() => {
  vi.clearAllMocks();
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

describe("central de notificações — apresentação e ações pessoais", () => {
  it("usa a identidade visual por tokens, sem copiar branding fixo do protótipo", async () => {
    await render();
    expect(host.querySelector(".bg-primary\\/10")).toBeNull();
    expect(host.querySelector(".bg-background")).not.toBeNull();
    expect(host.querySelector('[style*="#1557"]')).toBeNull();
    expect(host.querySelector("img")).toBeNull();
    expect(host.textContent).not.toContain("WK Technology");
  });
  it("selecionar um aviso não marca leitura nem executa decisão", async () => {
    await render();
    const item = host.querySelector('button[aria-pressed="false"].w-full');
    expect(item).not.toBeNull();
    await act(async () => item!.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(callbacks.onSelect).toHaveBeenCalledExactlyOnceWith(row().id);
    expect(callbacks.onRead).not.toHaveBeenCalled();
    expect(callbacks.onSnooze).not.toHaveBeenCalled();
  });
  it("explica a diferença entre leitura e decisão, sem inventar prazo ou responsável", async () => {
    await render({ selectedId: row().id });
    const detail = host.querySelector('aside[aria-label="Detalhe da notificação"]');
    expect(detail?.textContent).toContain("não conclui a tarefa nem aprova o registro");
    expect(detail?.textContent).not.toContain("Aprovada");
    expect(detail?.textContent).not.toContain("Prazo:");
    expect(detail?.textContent).not.toContain("Por que recebi?");
    expect(detail?.querySelector('a[href^="/contracts/"]')).not.toBeNull();
  });
  it("marca leitura apenas por ação explícita e preserva o estado até a confirmação", async () => {
    await render({ selectedId: row().id });
    await click("Marcar como lida");
    expect(callbacks.onRead).toHaveBeenCalledExactlyOnceWith([row().id], true);
    expect(host.textContent).toContain("Não lida");
    expect(callbacks.onSelect).not.toHaveBeenCalled();
  });
  it("permite retornar a não lida sem alterar a obrigação de origem", async () => {
    await render({ selectedId: row().id, items: [row({ read_at: "2026-11-20T13:00:00Z" })] });
    await click("Marcar não lida");
    expect(callbacks.onRead).toHaveBeenCalledExactlyOnceWith([row().id], false);
  });
  it("limita o lote aos IDs não lidos carregados, no máximo 100", async () => {
    const items = Array.from({ length: 110 }, (_, i) =>
      row({ id: `item-${i}`, read_at: i === 0 ? "2026-11-20T13:00:00Z" : null }),
    );
    await render({ items });
    await click("Marcar carregadas como lidas");
    const [ids, read] = callbacks.onRead.mock.calls[0];
    expect(read).toBe(true);
    expect(ids).toHaveLength(100);
    expect(ids[0]).toBe("item-1");
    expect(ids).not.toContain("item-0");
    expect(ids).not.toContain("item-109");
    expect(host.textContent).toContain("Até 100 avisos carregados");
  });
  it("permite adiar por uma ou 24 horas e cancelar sem decisão implícita", async () => {
    await render({ selectedId: row().id, items: [row({ snoozed_until: "2099-11-20T15:00:00Z" })] });
    await click("Adiar 1 hora");
    await click("Adiar 24 horas");
    await click("Cancelar adiamento");
    expect(callbacks.onSnooze.mock.calls).toEqual([
      [row().id, 60],
      [row().id, 1440],
      [row().id, 0],
    ]);
    expect(callbacks.onRead).not.toHaveBeenCalled();
    expect(host.textContent).toContain("Retorno em");
  });
  it("separa o histórico sem proveniência e não atribui workspace por título ou link", async () => {
    await render({
      filters: { ...baseFilters, scope: "legacy" },
      selectedId: row().id,
      items: [row({ link: null, body: "Aviso pessoal antigo." })],
    });
    expect(host.textContent).toContain("Avisos pessoais antigos sem workspace comprovado");
    expect(host.textContent).toContain("não possui um destino autorizado disponível");
    expect(host.querySelector("aside a")).toBeNull();
  });
  it("exibe falha de leitura como erro recuperável, sem falsa caixa vazia", async () => {
    await render({ error: "Indisponibilidade temporária", items: [] });
    expect(host.querySelector('[role="alert"]')?.textContent).toContain(
      "Não foi possível carregar",
    );
    expect(host.textContent).not.toContain("Nenhuma notificação encontrada");
    await click("Tentar novamente");
    expect(callbacks.onRetry).toHaveBeenCalledOnce();
  });
  it("exibe falha de gravação e impede novas ações enquanto salva", async () => {
    await render({ selectedId: row().id, pending: true, actionError: "Falha ao salvar leitura" });
    expect(host.querySelector('[role="alert"]')?.textContent).toContain("Falha ao salvar leitura");
    const mark = Array.from(host.querySelectorAll("button")).find(
      (item) => item.textContent === "Marcar como lida",
    )!;
    expect(mark.disabled).toBe(true);
  });
  it("mantém filtros controlados sem atribuir módulo ou prioridade pelo título", async () => {
    await render();
    const select = host.querySelectorAll("select")[1];
    await act(async () => {
      select.value = "snoozed";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(callbacks.onFilters).toHaveBeenCalledExactlyOnceWith({
      ...baseFilters,
      status: "snoozed",
    });
    expect(host.textContent).not.toContain("Alta prioridade");
    expect(host.querySelector('[aria-label="Notificações carregadas"]')?.textContent).not.toContain(
      "TechSales",
    );
  });
  it("agrupa os avisos carregados por dia local sem enviar resumo externo", async () => {
    await render({
      items: [row(), row({ id: "second", created_at: "2026-11-21T01:00:00Z" })],
      summary: { mode: "daily", timezone: "America/Sao_Paulo" },
    });
    const groups = host.querySelectorAll('[aria-label="Notificações carregadas"] > section');
    expect(groups).toHaveLength(1);
    expect(groups[0].querySelectorAll("li")).toHaveLength(2);
    expect(host.textContent).not.toContain("enviado");
  });
  it("carrega páginas anteriores sem assumir que todos os avisos foram buscados", async () => {
    await render({ hasMore: true });
    await click("Carregar anteriores");
    expect(callbacks.onMore).toHaveBeenCalledOnce();
    expect(host.textContent).toContain("1 carregadas");
  });
});
