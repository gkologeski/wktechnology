import { createServer, type IncomingMessage, type Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { assertSafeWebhookUrl, isPrivateAddress } from "./url-guard";
import { signWebhook, verifyWebhook } from "./signing";

vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: {} }));
import { sendWebhook } from "./dispatcher.server";

const publicDns = async () => ["93.184.216.34"];

describe("guarda de destino de webhook (SSRF)", () => {
  it.each([
    "http://example.com/hook",
    "https://localhost/hook",
    "https://127.0.0.1/hook",
    "https://10.1.2.3/hook",
    "https://169.254.169.254/latest/meta-data",
    "https://[::1]/hook",
    "https://user:pass@example.com/hook",
    "https://example.com:22/hook",
    "https://metadata.google.internal/x",
    "https://intranet/hook",
  ])("recusa %s", async (url) => {
    await expect(assertSafeWebhookUrl(url, publicDns)).rejects.toThrow(/recusado/);
  });

  it("recusa host público que resolve para IP privado (rebinding)", async () => {
    await expect(assertSafeWebhookUrl("https://hooks.example.com/x", async () => ["93.184.216.34", "10.0.0.5"])).rejects.toThrow(
      /rede privada/,
    );
  });

  it("aceita HTTPS público", async () => {
    await expect(assertSafeWebhookUrl("https://hooks.example.com/x", publicDns)).resolves.toBeInstanceOf(URL);
  });

  it("classifica faixas privadas e mapeadas", () => {
    expect(isPrivateAddress("192.168.0.1")).toBe(true);
    expect(isPrivateAddress("100.64.0.1")).toBe(true);
    expect(isPrivateAddress("::ffff:127.0.0.1")).toBe(true);
    expect(isPrivateAddress("fd00::1")).toBe(true);
    expect(isPrivateAddress("8.8.8.8")).toBe(false);
  });
});

describe("assinatura com carimbo de tempo", () => {
  it("verifica, recusa corpo alterado e carimbo fora da janela", async () => {
    const h = await signWebhook("whsec_teste", 1_700_000_000, '{"a":1}');
    expect(await verifyWebhook("whsec_teste", h, '{"a":1}', 1_700_000_100)).toBe(true);
    expect(await verifyWebhook("whsec_teste", h, '{"a":2}', 1_700_000_100)).toBe(false);
    expect(await verifyWebhook("whsec_teste", h, '{"a":1}', 1_700_001_000)).toBe(false);
    expect(await verifyWebhook("outro", h, '{"a":1}', 1_700_000_100)).toBe(false);
  });
});

describe("envio para receptor isolado (sem dados reais)", () => {
  let server: Server;
  let port = 0;
  const seen: Array<{ path: string; headers: IncomingMessage["headers"]; body: string }> = [];
  beforeAll(async () => {
    server = createServer((req, res) => {
      let body = "";
      req.on("data", (c) => (body += c));
      req.on("end", () => {
        seen.push({ path: req.url ?? "", headers: req.headers, body });
        if (req.url === "/redirect") {
          res.writeHead(302, { Location: `http://127.0.0.1:${port}/stolen` });
          return res.end();
        }
        res.writeHead(200, { "Content-Type": "text/plain" });
        res.end("ok");
      });
    });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
    port = (server.address() as { port: number }).port;
  });
  afterAll(() => server.close());

  // O guard valida a URL pública; o fetch de teste entrega no receptor local isolado.
  const toLocal: typeof fetch = (input, init) =>
    fetch(String(input).replace("https://receiver.example.test", `http://127.0.0.1:${port}`), init);

  it("entrega assinada com id de evento; receptor valida; nenhuma credencial do sistema é encaminhada", async () => {
    const r = await sendWebhook(
      { url: "https://receiver.example.test/ok", secret: "whsec_iso" },
      { id: "d1", event_id: "11111111-1111-4111-8111-111111111111", event_type: "project.time_entry.created", payload: { entry_id: "e1" } },
      { resolve: publicDns, fetchImpl: toLocal, now: () => 1_700_000_000_000 },
    );
    expect(r.ok).toBe(true);
    const got = seen.find((s) => s.path === "/ok")!;
    expect(got.headers["x-techerp-event-id"]).toBe("11111111-1111-4111-8111-111111111111");
    expect(got.headers.authorization).toBeUndefined();
    expect(await verifyWebhook("whsec_iso", String(got.headers["x-techerp-signature"]), got.body, 1_700_000_010)).toBe(true);
    expect(JSON.parse(got.body)).toMatchObject({ id: "11111111-1111-4111-8111-111111111111", event: "project.time_entry.created" });
  });

  it("não segue redirecionamento (o destino redirecionado nunca recebe a carga)", async () => {
    const r = await sendWebhook(
      { url: "https://receiver.example.test/redirect", secret: "whsec_iso" },
      { id: "d2", event_type: "project.time_entry.created", payload: {} },
      { resolve: publicDns, fetchImpl: toLocal },
    );
    expect(r.ok).toBe(false);
    expect(r.text).toBe("redirect_not_followed");
    expect(seen.some((s) => s.path === "/stolen")).toBe(false);
  });

  it("destino privado é bloqueado antes de qualquer conexão", async () => {
    let called = 0;
    const r = await sendWebhook(
      { url: `https://127.0.0.1:${port}/ok`, secret: "x" },
      { id: "d3", event_type: "e", payload: {} },
      { resolve: publicDns, fetchImpl: (async () => (called++, new Response("ok"))) as typeof fetch },
    );
    expect(called).toBe(0);
    expect(r.text).toMatch(/^blocked_destination/);
  });
});
