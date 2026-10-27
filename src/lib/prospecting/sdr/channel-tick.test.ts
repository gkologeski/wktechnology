import { beforeEach, describe, expect, it, vi } from "vitest";
const spies = vi.hoisted(() => ({ auth: vi.fn(), wa: vi.fn(), service: vi.fn() }));
vi.mock("@tanstack/react-router", () => ({ createFileRoute: () => (options: unknown) => options }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: {} }));
vi.mock("@/lib/cron-auth.server", () => ({ requireCronAuth: spies.auth }));
vi.mock("./worker.server", () => ({ tickSdr: spies.wa }));
vi.mock("./service-worker.server", () => ({ tickServiceAgents: spies.service }));
vi.mock("@/lib/cron-observability.server", () => ({
  runCronWithLogging: async (_name: string, run: () => Promise<unknown>) => {
    try {
      return { status: "success", duration_ms: 1, metrics: await run() };
    } catch (error) {
      return { status: "error", error: (error as Error).message };
    }
  },
}));
import { Route } from "@/routes/api/public/hooks/sdr-tick";
const invoke = () =>
  (Route as any).server.handlers.POST({
    request: new Request("https://app.example/api/public/hooks/sdr-tick", { method: "POST" }),
  });
beforeEach(() => {
  vi.clearAllMocks();
  spies.auth.mockReturnValue(null);
  spies.wa.mockResolvedValue({ claimed: 1 });
  spies.service.mockResolvedValue({ claimed: 2 });
});
describe("authenticated multichannel cron", () => {
  it("runs both queues and preserves WhatsApp metrics", async () => {
    const response = await invoke();
    expect(await response.json()).toMatchObject({
      ok: true,
      claimed: 1,
      email_chat: { claimed: 2 },
    });
  });
  it("starts email/chat while WhatsApp is still waiting", async () => {
    let done!: (value: unknown) => void;
    spies.wa.mockImplementation(
      () =>
        new Promise((resolve) => {
          done = resolve;
        }),
    );
    const result = invoke();
    await vi.waitFor(() => expect(spies.service).toHaveBeenCalledOnce());
    done({ claimed: 0 });
    expect((await result).status).toBe(200);
  });
  it("still processes email/chat when WhatsApp fails", async () => {
    spies.wa.mockRejectedValue(new Error("private provider error"));
    const response = await invoke();
    expect(spies.service).toHaveBeenCalledOnce();
    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain("private provider error");
  });
  it("still processes WhatsApp when email/chat fails", async () => {
    spies.service.mockRejectedValue(new Error("private email error"));
    const response = await invoke();
    expect(spies.wa).toHaveBeenCalledOnce();
    expect(response.status).toBe(500);
  });
  it("does not process any queue without cron authorization", async () => {
    spies.auth.mockReturnValue(new Response("Unauthorized", { status: 401 }));
    expect((await invoke()).status).toBe(401);
    expect(spies.wa).not.toHaveBeenCalled();
    expect(spies.service).not.toHaveBeenCalled();
  });
});
