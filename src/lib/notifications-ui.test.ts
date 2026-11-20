// @vitest-environment jsdom
import { act, createElement, type ComponentType, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
type Subscription = {
  callback?: (payload: { new: Record<string, unknown> }) => void;
  on: ReturnType<typeof vi.fn>;
  subscribe: ReturnType<typeof vi.fn>;
};
const state = vi.hoisted(() => ({
  userId: "user-a",
  workspaceId: "workspace-a",
  contextError: false,
  getPrefs: vi.fn(),
  updatePrefs: vi.fn(),
  centerPrefs: vi.fn(),
  list: vi.fn(),
  mark: vi.fn(),
  toast: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
  removeChannel: vi.fn(),
  subscriptions: [] as Subscription[],
  audioStarts: 0,
  rows: [] as Record<string, unknown>[],
}));
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => ({ options }),
  Link: ({ children, to, onClick }: { children?: ReactNode; to: string; onClick?: () => void }) =>
    createElement("a", { href: to, onClick }, children),
}));
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock("@/lib/auth", () => ({ useAuth: () => ({ user: { id: state.userId } }) }));
vi.mock("@/lib/access-control/use-permissions", () => ({
  usePermissions: () => ({
    workspaceId: state.workspaceId,
    isLoading: false,
    isError: state.contextError,
  }),
}));
vi.mock("@/lib/crm", () => ({ formatDateTime: (date: string) => date }));
vi.mock("@/lib/notifications.functions", () => ({
  getMyNotificationPrefs: state.getPrefs,
  updateMyNotificationPrefs: state.updatePrefs,
}));
vi.mock("@/lib/notification-center.functions", () => ({
  getNotificationCenter: state.list,
  markCenterNotifications: state.mark,
  getCenterPreferences: state.centerPrefs,
}));
vi.mock("sonner", () => ({
  toast: { message: state.toast, success: state.success, error: state.error },
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    channel: () => {
      const sub: Subscription = { on: vi.fn(), subscribe: vi.fn() };
      sub.on.mockImplementation((_event, _filter, cb) => {
        sub.callback = cb;
        return sub;
      });
      sub.subscribe.mockReturnValue(sub);
      state.subscriptions.push(sub);
      return sub;
    },
    removeChannel: state.removeChannel,
  },
}));
vi.mock("@/components/ui/popover", () => ({
  Popover: ({ children }: { children?: ReactNode }) => createElement("div", null, children),
  PopoverTrigger: ({ children }: { children?: ReactNode }) => children,
  PopoverContent: ({ children }: { children?: ReactNode }) => createElement("div", null, children),
}));
vi.mock("@/components/ui/scroll-area", () => ({
  ScrollArea: ({ children }: { children?: ReactNode }) => createElement("div", null, children),
}));
vi.mock("@/components/page-header", () => ({
  PageHeader: ({ title }: { title: string }) => createElement("h1", null, title),
}));
import { NOTIFICATION_CATEGORIES } from "./notification-catalog";
import { normalizeNotificationPrefs } from "./notification-preferences";
import { normalizeCenterSettings } from "./notification-center-preferences";
import { NotificationsBell } from "@/components/notifications-bell";
import { Route } from "@/routes/_authenticated/settings.notifications";
const SettingsPage = (Route.options as { component: ComponentType }).component;
let host: HTMLDivElement;
let root: Root;
let client: QueryClient;
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
async function settle() {
  for (let i = 0; i < 2; i++)
    await act(async () => {
      await new Promise((done) => setTimeout(done, 15));
    });
}
async function render(component: ComponentType) {
  await act(async () =>
    root.render(createElement(QueryClientProvider, { client }, createElement(component))),
  );
  await settle();
}
async function click(element: Element | null) {
  expect(element).not.toBeNull();
  await act(async () => element!.dispatchEvent(new MouseEvent("click", { bubbles: true })));
  await settle();
}
function button(text: string) {
  return (
    Array.from(host.querySelectorAll("button")).find((item) => item.textContent?.trim() === text) ??
    null
  );
}
function preference(label: string) {
  const item = Array.from(host.querySelectorAll('[role="switch"]')).find(
    (item) => item.getAttribute("aria-label") === label,
  );
  expect(item).toBeDefined();
  return item!;
}
function notice(type = "mention", extra: Record<string, unknown> = {}) {
  return {
    id: `notice-${type}`,
    type,
    title: `Autorizado ${type}`,
    body: "Contexto autorizado",
    created_at: "2026-11-20T10:00:00Z",
    read_at: null,
    snoozed_until: null,
    link: null,
    entity: null,
    entity_id: null,
    ...extra,
  };
}
function prefs(settings: unknown = {}, legacy: unknown = {}) {
  return {
    settings: normalizeCenterSettings(settings),
    legacyPrefs: normalizeNotificationPrefs(legacy),
    revision: 0,
  };
}
async function deliver(
  type: string,
  extra: Record<string, unknown> = {},
  authorized = true,
  sub = state.subscriptions.at(-1),
) {
  const row = notice(type, extra);
  if (authorized) state.rows = [row, ...state.rows];
  expect(sub?.callback).toBeTypeOf("function");
  await act(async () =>
    sub!.callback!({
      new: { id: row.id, type, title: "PAYLOAD NÃO CONFIÁVEL", body: "Nunca renderizar" },
    }),
  );
  await settle();
}
class AudioContextStub {
  currentTime = 0;
  destination = {};
  createOscillator() {
    return {
      type: "sine",
      frequency: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
      connect: () => ({ connect: vi.fn() }),
      start: () => state.audioStarts++,
      stop: vi.fn(),
    };
  }
  createGain() {
    return { gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() } };
  }
  async close() {}
}
beforeEach(() => {
  vi.clearAllMocks();
  state.userId = "user-a";
  state.workspaceId = "workspace-a";
  state.contextError = false;
  state.subscriptions = [];
  state.rows = [];
  state.audioStarts = 0;
  state.getPrefs.mockResolvedValue({ prefs: normalizeNotificationPrefs({}) });
  state.updatePrefs.mockResolvedValue({ ok: true });
  state.centerPrefs.mockResolvedValue(prefs());
  state.list.mockImplementation(async () => ({
    items: [
      ...state.rows,
      notice("workflow", {
        id: `${state.userId}:${state.workspaceId}`,
        title: `Histórico ${state.userId}:${state.workspaceId}`,
      }),
    ],
    unread: 1,
    nextCursor: null,
    cutoff: "2026-11-20T12:00:00Z",
  }));
  state.mark.mockResolvedValue({ updated: 1 });
  state.removeChannel.mockResolvedValue("ok");
  vi.stubGlobal("AudioContext", AudioContextStub);
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  window.history.replaceState({}, "", "/");
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  });
});
afterEach(async () => {
  await act(async () => root.unmount());
  client.clear();
  host.remove();
  vi.unstubAllGlobals();
});
describe("preferências pessoais de notificações", () => {
  it("apresenta os treze grupos compartilhados sem reabilitar escolhas falsas e salva apenas o campo alterado", async () => {
    state.getPrefs.mockResolvedValue({
      prefs: normalizeNotificationPrefs({
        mention: { inapp: false, email: false, sound: false, shake: false },
      }),
    });
    await render(SettingsPage);
    expect(NOTIFICATION_CATEGORIES).toHaveLength(13);
    expect(host.querySelectorAll("tbody tr")).toHaveLength(13);
    for (const category of NOTIFICATION_CATEGORIES) {
      for (const channel of ["No app", "E-mail", "Som", "Tremor"]) {
        expect(preference(`${category.label}: ${channel}`)).toBeDefined();
      }
    }
    for (const channel of ["No app", "E-mail", "Som", "Tremor"]) {
      expect(preference(`Menções: ${channel}`).getAttribute("aria-checked")).toBe("false");
    }
    await click(preference("Menções: Som"));
    await click(button("Salvar"));
    expect(state.updatePrefs).toHaveBeenCalledExactlyOnceWith({
      data: { prefs: { mention: { sound: true } } },
    });
    expect(state.success).toHaveBeenCalledWith("Preferências salvas");
  });

  it("mostra recuperação após falha de leitura e permite tentar novamente", async () => {
    state.getPrefs.mockRejectedValueOnce(new Error("Falha sintética"));
    await render(SettingsPage);
    expect(host.querySelector('[role="alert"]')?.textContent).toContain(
      "Não foi possível carregar",
    );
    expect(host.textContent).not.toContain("Carregando preferências");
    expect(state.updatePrefs).not.toHaveBeenCalled();
    await click(button("Tentar novamente"));
    expect(state.getPrefs).toHaveBeenCalledTimes(2);
    expect(host.querySelectorAll("tbody tr")).toHaveLength(13);
    expect(host.querySelector('[role="alert"]')).toBeNull();
  });
});

describe("sino com proveniência e revalidação", () => {
  it("preserva os aliases de SLA sem produzir som quando o grupo está silencioso", async () => {
    state.centerPrefs.mockResolvedValue(
      prefs({}, { sla: { inapp: true, sound: false, shake: false } }),
    );
    await render(NotificationsBell);
    for (const type of ["sla.first_response_breach", "sla.resolution_breach", "sla.at_risk"])
      await deliver(type);
    expect(state.toast).toHaveBeenCalledTimes(3);
    expect(state.audioStarts).toBe(0);
    expect(host.querySelector(".animate-bell-shake")).toBeNull();
  });
  it("consulta apenas o workspace ativo e oferece acesso à central", async () => {
    await render(NotificationsBell);
    expect(state.list).toHaveBeenCalledWith({
      data: {
        workspaceId: "workspace-a",
        scope: "workspace",
        status: "all",
        cursor: undefined,
        cutoff: undefined,
      },
    });
    expect(host.querySelector('a[href="/notifications"]')).not.toBeNull();
    expect(host.textContent).toContain("Histórico user-a:workspace-a");
  });
  it("usa somente o conteúdo revalidado pela API, nunca o payload realtime", async () => {
    await render(NotificationsBell);
    await deliver("mention");
    expect(state.toast).toHaveBeenCalledExactlyOnceWith("Autorizado mention", {
      description: "Contexto autorizado",
    });
    expect(host.textContent).not.toContain("PAYLOAD NÃO CONFIÁVEL");
    expect(state.audioStarts).toBe(1);
  });
  it("não interrompe quando o aviso não pertence ao resultado autorizado", async () => {
    await render(NotificationsBell);
    await deliver("mention", {}, false);
    expect(state.toast).not.toHaveBeenCalled();
    expect(state.audioStarts).toBe(0);
  });
  it("respeita o opt-out de um evento no workspace sem ativar aliases desconhecidos", async () => {
    state.centerPrefs.mockResolvedValue(
      prefs({ eventOverrides: { "legacy.mention": { inapp: false } } }),
    );
    await render(NotificationsBell);
    await deliver("mention");
    await deliver("future.unknown");
    expect(state.toast).not.toHaveBeenCalled();
    expect(state.audioStarts).toBe(0);
  });

  it("revalida opt-out alterado em outra sessão antes de interromper", async () => {
    await render(NotificationsBell);
    state.centerPrefs.mockResolvedValue(
      prefs({ eventOverrides: { "legacy.mention": { inapp: false } } }),
    );
    await deliver("mention");
    expect(state.centerPrefs).toHaveBeenCalledTimes(2);
    expect(state.toast).not.toHaveBeenCalled();
    expect(state.audioStarts).toBe(0);
  });
  it("respeita silêncio e mantém o aviso no histórico", async () => {
    const formatter = new Intl.DateTimeFormat("en-GB", {
      timeZone: "UTC",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });
    const start = formatter.format(new Date());
    const end = formatter.format(new Date(Date.now() + 60 * 60_000));
    state.centerPrefs.mockResolvedValue(
      prefs({ quiet: { enabled: true, timezone: "UTC", start, end } }),
    );
    await render(NotificationsBell);
    await deliver("mention");
    expect(state.toast).not.toHaveBeenCalled();
    expect(state.audioStarts).toBe(0);
    expect(host.textContent).toContain("Autorizado mention");
  });
  it("aguarda as preferências antes de interromper", async () => {
    const pending = deferred<ReturnType<typeof prefs>>();
    state.centerPrefs.mockReturnValue(pending.promise);
    await render(NotificationsBell);
    await deliver("mention");
    expect(state.toast).not.toHaveBeenCalled();
    await act(async () => pending.resolve(prefs()));
    await settle();
    await deliver("assignment");
    expect(state.toast).toHaveBeenCalledTimes(1);
  });
  it("suprime mensagens de Inbox na Inbox sem silenciar comentários", async () => {
    window.history.replaceState({}, "", "/inbox/whatsapp");
    await render(NotificationsBell);
    await deliver("message", {
      id: "inbox-message",
      entity: "inbox_conversation",
      link: "/inbox/whatsapp",
    });
    await deliver("message", {
      id: "activity-message",
      entity: "activity",
      link: "/deals/demo",
      title: "Comentário autorizado",
    });
    expect(state.toast).toHaveBeenCalledExactlyOnceWith("Comentário autorizado", {
      description: "Contexto autorizado",
    });
  });
  it("não usa callbacks nem caches de outro usuário ou workspace", async () => {
    await render(NotificationsBell);
    const oldSub = state.subscriptions.at(-1)!;
    state.userId = "user-b";
    state.workspaceId = "workspace-b";
    await render(NotificationsBell);
    expect(host.textContent).not.toContain("Histórico user-a:workspace-a");
    expect(host.textContent).toContain("Histórico user-b:workspace-b");
    await deliver("mention", {}, false, oldSub);
    expect(state.toast).not.toHaveBeenCalled();
    expect(state.removeChannel).toHaveBeenCalledWith(oldSub);
  });
  it("descarta resposta pendente do contexto anterior", async () => {
    await render(NotificationsBell);
    const pending = deferred<{
      items: ReturnType<typeof notice>[];
      unread: number;
      nextCursor: null;
      cutoff: string;
    }>();
    state.list.mockReturnValueOnce(pending.promise);
    await deliver("mention", {}, false);
    state.workspaceId = "workspace-b";
    await render(NotificationsBell);
    await act(async () =>
      pending.resolve({
        items: [notice("mention")],
        unread: 1,
        nextCursor: null,
        cutoff: "2026-11-20T12:00:00Z",
      }),
    );
    await settle();
    expect(state.toast).not.toHaveBeenCalled();
  });
  it("mostra falha de leitura com repetição, sem simular caixa vazia", async () => {
    state.list.mockRejectedValue(new Error("Banco indisponível"));
    await render(NotificationsBell);
    expect(host.querySelector('[role="alert"]')).not.toBeNull();
    expect(host.textContent).not.toContain("Nenhuma notificação neste workspace");
    expect(button("Tentar novamente")).not.toBeNull();
  });
  it("marca somente IDs carregados com o cutoff e relata falha", async () => {
    state.mark.mockRejectedValue(new Error("Leitura não foi salva"));
    await render(NotificationsBell);
    await click(button("Marcar carregadas"));
    expect(state.mark).toHaveBeenCalledExactlyOnceWith({
      data: {
        workspaceId: "workspace-a",
        ids: ["user-a:workspace-a"],
        read: true,
        cutoff: "2026-11-20T12:00:00Z",
      },
    });
    expect(state.error).toHaveBeenCalledWith("Leitura não foi salva");
    expect(host.textContent).toContain("Histórico user-a:workspace-a");
  });
  it("não consulta avisos enquanto o contexto de permissão está inválido", async () => {
    state.contextError = true;
    await render(NotificationsBell);
    expect(state.list).not.toHaveBeenCalled();
    expect(state.subscriptions).toHaveLength(0);
    expect(host.textContent).toContain("Aguardando acesso ao workspace");
  });
});
