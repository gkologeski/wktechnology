import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const harness = vi.hoisted(() => ({
  channels: [] as Array<{
    handlers: Map<string, (payload: unknown) => void>;
    status: (status: string) => void;
  }>,
  cleanups: [] as Array<() => void>,
  invalidate: vi.fn(),
  remove: vi.fn(),
}));
vi.mock("react", () => ({
  useRef: (current: unknown) => ({ current }),
  useEffect: (effect: () => (() => void) | undefined) => {
    const cleanup = effect();
    if (cleanup) harness.cleanups.push(cleanup);
  },
}));
vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: harness.invalidate }),
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    removeChannel: harness.remove,
    channel: () => {
      const state = {
        handlers: new Map<string, (payload: unknown) => void>(),
        status: (_status: string) => {},
      };
      harness.channels.push(state);
      const channel = {
        on: (event: string, _params: unknown, callback: (payload: unknown) => void) => {
          state.handlers.set(event, callback);
          return channel;
        },
        subscribe: (callback: (status: string) => void) => {
          state.status = callback;
          return channel;
        },
      };
      return channel;
    },
  },
}));
import { useRealtimeInvalidate } from "./use-realtime-invalidate";

beforeEach(() => {
  vi.useFakeTimers();
  harness.channels.length = 0;
  harness.cleanups.length = 0;
  harness.invalidate.mockClear();
  harness.remove.mockClear();
  vi.stubGlobal("window", new EventTarget());
  vi.stubGlobal("BroadcastChannel", undefined);
  const document = Object.assign(new EventTarget(), { hidden: false });
  vi.stubGlobal("document", document);
});
afterEach(() => {
  for (const cleanup of harness.cleanups) cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
const useMount = () => {
  useRealtimeInvalidate([
    { table: "email_threads", filter: "id=eq.A", queryKeys: [["meta", "A"]] },
  ]);
  return harness.channels.at(-1)!;
};
const authorized = (channel: ReturnType<typeof useMount>) =>
  channel.handlers.get("system")!({ extension: "postgres_changes", status: "ok" });

describe("realtime authorization and reconciliation", () => {
  it.each(["socket-first", "postgres-first"])(
    "closes initial read gap only after both confirmations: %s",
    (order) => {
      const channel = useMount();
      if (order === "socket-first") channel.status("SUBSCRIBED");
      else authorized(channel);
      vi.advanceTimersByTime(300);
      expect(harness.invalidate).not.toHaveBeenCalled();
      if (order === "socket-first") authorized(channel);
      else channel.status("SUBSCRIBED");
      vi.advanceTimersByTime(300);
      expect(harness.invalidate).toHaveBeenCalledExactlyOnceWith({ queryKey: ["meta", "A"] });
    },
  );
  it("reconciles again when a closed transport rejoins", () => {
    const channel = useMount();
    channel.status("SUBSCRIBED");
    authorized(channel);
    vi.advanceTimersByTime(300);
    channel.status("CLOSED");
    channel.status("SUBSCRIBED");
    vi.advanceTimersByTime(300);
    expect(harness.invalidate).toHaveBeenCalledTimes(1);
    authorized(channel);
    vi.advanceTimersByTime(300);
    expect(harness.invalidate).toHaveBeenCalledTimes(2);
  });
  it("a refused Postgres subscription cannot become ready from socket status alone", () => {
    const channel = useMount();
    channel.status("SUBSCRIBED");
    channel.handlers.get("system")!({ extension: "postgres_changes", status: "error" });
    vi.advanceTimersByTime(300);
    expect(harness.invalidate).not.toHaveBeenCalled();
    expect(harness.remove).toHaveBeenCalledTimes(1);
  });
  it("cleanup discards queued reconciliation from the previous context", () => {
    const channel = useMount();
    channel.status("SUBSCRIBED");
    authorized(channel);
    harness.cleanups[0]();
    vi.advanceTimersByTime(300);
    expect(harness.invalidate).not.toHaveBeenCalled();
  });
  it("workspace change drops old queued work and ignores late channel callbacks", () => {
    const old = useMount();
    old.status("SUBSCRIBED");
    authorized(old);
    window.dispatchEvent(new Event("techerp:workspace-changed"));
    expect(harness.remove).toHaveBeenCalledTimes(1);
    expect(harness.channels).toHaveLength(2);
    old.status("CHANNEL_ERROR");
    authorized(old);
    vi.advanceTimersByTime(300);
    expect(harness.invalidate).not.toHaveBeenCalled();
    const next = harness.channels[1];
    next.status("SUBSCRIBED");
    authorized(next);
    vi.advanceTimersByTime(300);
    expect(harness.invalidate).toHaveBeenCalledTimes(1);
  });
});
