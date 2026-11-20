// @vitest-environment jsdom
import {
  act,
  createElement,
  Fragment,
  useLayoutEffect,
  type ComponentType,
  type ReactNode,
} from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
type NotificationPayload = { new: Record<string, unknown> };
type Subscription = {
  name: string;
  callback?: (payload: NotificationPayload) => void;
  on: ReturnType<typeof vi.fn>;
  subscribe: ReturnType<typeof vi.fn>;
};
const state = vi.hoisted(() => ({
  userId: "user-a",
  getPrefs: vi.fn(),
  updatePrefs: vi.fn(),
  list: vi.fn(),
  mark: vi.fn(),
  markAll: vi.fn(),
  toast: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
  removeChannel: vi.fn(),
  subscriptions: [] as Subscription[],
  audioStarts: 0,
  lateDelivery: null as (() => void) | null,
}));
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => ({ options }),
  Link: ({ children, to }: { children?: ReactNode; to: string }) =>
    createElement("a", { href: to }, children),
}));
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock("@/lib/auth", () => ({ useAuth: () => ({ user: { id: state.userId } }) }));
vi.mock("@/lib/crm", () => ({ formatDateTime: (date: string) => date }));
vi.mock("@/lib/notifications.functions", () => ({
  getMyNotificationPrefs: state.getPrefs,
  updateMyNotificationPrefs: state.updatePrefs,
  listMyNotifications: state.list,
  markNotificationRead: state.mark,
  markAllNotificationsRead: state.markAll,
}));
vi.mock("sonner", () => ({
  toast: { message: state.toast, success: state.success, error: state.error },
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    channel: (name: string) => {
      const subscription: Subscription = {
        name,
        on: vi.fn(),
        subscribe: vi.fn(),
      };
      subscription.on.mockImplementation((_event, _filter, callback) => {
        subscription.callback = callback;
        return subscription;
      });
      subscription.subscribe.mockReturnValue(subscription);
      state.subscriptions.push(subscription);
      return subscription;
    },
    removeChannel: state.removeChannel,
  },
}));
// Keep notification/query behavior real; avoid portal/positioning behavior unrelated to it.
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
  for (let cycle = 0; cycle < 2; cycle++) {
    await act(async () => {
      await new Promise((done) => setTimeout(done, 15));
    });
  }
}
async function render(component: ComponentType) {
  await act(async () => {
    root.render(createElement(QueryClientProvider, { client }, createElement(component)));
  });
  await settle();
}
async function click(element: Element | null) {
  expect(element).not.toBeNull();
  await act(async () => {
    element!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  await settle();
}
function button(text: string) {
  return (
    Array.from(host.querySelectorAll("button")).find(
      (element) => element.textContent?.trim() === text,
    ) ?? null
  );
}
function preference(label: string) {
  const element = Array.from(host.querySelectorAll('[role="switch"]')).find(
    (item) => item.getAttribute("aria-label") === label,
  );
  expect(element, `Preferência ausente: ${label}`).toBeDefined();
  return element!;
}
async function deliver(
  type: string,
  extra: Record<string, unknown> = {},
  subscription = state.subscriptions.at(-1),
) {
  expect(subscription?.callback).toBeTypeOf("function");
  await act(async () => {
    subscription!.callback!({
      new: { type, title: `Aviso ${type}`, body: "Dados sintéticos", ...extra },
    });
  });
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
  state.subscriptions = [];
  state.audioStarts = 0;
  state.lateDelivery = null;
  state.getPrefs.mockResolvedValue({ prefs: normalizeNotificationPrefs({}) });
  state.updatePrefs.mockResolvedValue({ ok: true });
  state.list.mockImplementation(async () => ({
    items: [
      {
        id: `${state.userId}-notice`,
        title: `Histórico ${state.userId}`,
        created_at: "2026-11-20T10:00:00Z",
      },
    ],
    unread: 1,
    nextCursor: null,
  }));
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

describe("sino de notificações com realtime", () => {
  it("aplica o grupo SLA aos aliases e mantém tipos desconhecidos silenciosos", async () => {
    state.getPrefs.mockResolvedValue({
      prefs: normalizeNotificationPrefs({ sla: { inapp: true, sound: false, shake: false } }),
    });
    await render(NotificationsBell);
    for (const type of ["sla.first_response_breach", "sla.resolution_breach", "sla.at_risk"]) {
      await deliver(type);
      expect(state.toast).toHaveBeenLastCalledWith(`Aviso ${type}`, {
        description: "Dados sintéticos",
      });
    }
    expect(state.toast).toHaveBeenCalledTimes(3);
    await deliver("future.unknown");
    expect(state.toast).toHaveBeenCalledTimes(3);
    expect(state.audioStarts).toBe(0);
    expect(host.querySelector(".animate-bell-shake")).toBeNull();
    expect(host.textContent).toContain("Histórico user-a");
  });

  it("aguarda as preferências atuais antes de interromper por um aviso conhecido", async () => {
    const pending = deferred<{ prefs: ReturnType<typeof normalizeNotificationPrefs> }>();
    state.getPrefs.mockReturnValue(pending.promise);
    await render(NotificationsBell);
    await deliver("mention");
    expect(state.toast).not.toHaveBeenCalled();
    expect(state.audioStarts).toBe(0);
    expect(host.querySelector(".animate-bell-shake")).toBeNull();
    await act(async () => {
      pending.resolve({ prefs: normalizeNotificationPrefs({}) });
    });
    await settle();
    await deliver("mention");
    expect(state.toast).toHaveBeenCalledTimes(1);
    expect(state.audioStarts).toBe(1);
    expect(host.querySelector(".animate-bell-shake")).not.toBeNull();
  });

  it("suprime avisos reais de Inbox dentro da Inbox sem silenciar comentários de atividade", async () => {
    window.history.replaceState({}, "", "/inbox/whatsapp");
    state.getPrefs.mockResolvedValue({
      prefs: normalizeNotificationPrefs({ message: { sound: false, shake: false } }),
    });
    await render(NotificationsBell);
    await deliver("message", { entity: "inbox_conversation", link: "/inbox/whatsapp" });
    await deliver("message", { link: "/inbox/email?thread=demo" });
    expect(state.toast).not.toHaveBeenCalled();
    await deliver("message", {
      entity: "activity",
      link: "/deals/demo",
      title: "Comentário na atividade",
    });
    expect(state.toast).toHaveBeenCalledExactlyOnceWith("Comentário na atividade", {
      description: "Dados sintéticos",
    });
    expect(state.audioStarts).toBe(0);
    expect(host.querySelector(".animate-bell-shake")).toBeNull();
  });

  it("troca de usuário sem herdar cache, preferências ou callbacks pendentes da sessão anterior", async () => {
    const pendingB = deferred<{ prefs: ReturnType<typeof normalizeNotificationPrefs> }>();
    state.getPrefs.mockImplementation(() =>
      state.userId === "user-a"
        ? Promise.resolve({ prefs: normalizeNotificationPrefs({}) })
        : pendingB.promise,
    );
    function QueuedProviderDelivery() {
      const identity = state.userId;
      useLayoutEffect(() => {
        state.lateDelivery?.();
      }, [identity]);
      return null;
    }
    function BellWithQueuedDelivery() {
      return createElement(
        Fragment,
        null,
        createElement(NotificationsBell),
        createElement(QueuedProviderDelivery),
      );
    }
    await render(BellWithQueuedDelivery);
    expect(host.textContent).toContain("Histórico user-a");
    const oldSubscription = state.subscriptions.at(-1)!;
    state.lateDelivery = () =>
      oldSubscription.callback!({ new: { type: "mention", title: "Aviso atrasado de A" } });
    state.userId = "user-b";
    await render(BellWithQueuedDelivery);
    expect(state.removeChannel).toHaveBeenCalledWith(oldSubscription);
    expect(host.textContent).toContain("Histórico user-b");
    expect(host.textContent).not.toContain("Histórico user-a");
    expect(state.toast).not.toHaveBeenCalled();
    await deliver("mention");
    expect(state.toast).not.toHaveBeenCalled();
    expect(state.audioStarts).toBe(0);
    await act(async () => {
      pendingB.resolve({
        prefs: normalizeNotificationPrefs({ mention: { sound: false, shake: false } }),
      });
    });
    await settle();
    await deliver("mention", { title: "Aviso atual de B" });
    expect(state.toast).toHaveBeenCalledExactlyOnceWith("Aviso atual de B", {
      description: "Dados sintéticos",
    });
    expect(state.audioStarts).toBe(0);
    expect(host.querySelector(".animate-bell-shake")).toBeNull();
  });
});
