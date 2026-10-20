import { describe, expect, it, vi } from "vitest";
import {
  formSubmitCorsHeaders,
  getVisitorIp,
  TURNSTILE_VERIFY_URL,
  verifyTurnstileToken,
} from "./public-submit-guard.server";

const okFetch = (payload: unknown) =>
  vi.fn(async () => new Response(JSON.stringify(payload), { status: 200 })) as unknown as typeof fetch;

describe("verifyTurnstileToken", () => {
  it("envia secret, response e remoteip para o siteverify", async () => {
    const fetchImpl = okFetch({ success: true });
    const r = await verifyTurnstileToken("tok", "1.2.3.4", { secret: "s3", fetchImpl });
    expect(r.success).toBe(true);
    const [url, init] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe(TURNSTILE_VERIFY_URL);
    const body = init.body as URLSearchParams;
    expect(body.get("secret")).toBe("s3");
    expect(body.get("response")).toBe("tok");
    expect(body.get("remoteip")).toBe("1.2.3.4");
  });

  it("recusa quando a Cloudflare não devolve success: true", async () => {
    const r = await verifyTurnstileToken("tok", null, {
      secret: "s",
      fetchImpl: okFetch({ success: false, "error-codes": ["invalid-input-response"] }),
    });
    expect(r).toEqual({ success: false, errorCodes: ["invalid-input-response"] });
  });

  it("recusa sem token, sem consultar a Cloudflare", async () => {
    const fetchImpl = okFetch({ success: true });
    expect((await verifyTurnstileToken("", null, { secret: "s", fetchImpl })).success).toBe(false);
    expect((await verifyTurnstileToken(undefined, null, { secret: "s", fetchImpl })).success).toBe(
      false,
    );
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("recusa (falha fechada) em erro de rede", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("offline");
    }) as unknown as typeof fetch;
    expect((await verifyTurnstileToken("tok", null, { secret: "s", fetchImpl })).success).toBe(
      false,
    );
  });

  it("recusa quando o segredo não está configurado", async () => {
    const fetchImpl = okFetch({ success: true });
    const r = await verifyTurnstileToken("tok", null, { secret: "", fetchImpl });
    expect(r.success).toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe("getVisitorIp", () => {
  it("prioriza cf-connecting-ip", () => {
    const h = new Headers({ "cf-connecting-ip": "9.9.9.9", "x-forwarded-for": "1.1.1.1" });
    expect(getVisitorIp(h)).toBe("9.9.9.9");
  });
  it("usa o primeiro IP de x-forwarded-for", () => {
    expect(getVisitorIp(new Headers({ "x-forwarded-for": " 1.1.1.1 , 2.2.2.2" }))).toBe("1.1.1.1");
  });
});

describe("formSubmitCorsHeaders", () => {
  it("libera somente www.wktechnology.com.br e wktechnology.com.br em HTTPS", () => {
    expect(formSubmitCorsHeaders("https://www.wktechnology.com.br")["Access-Control-Allow-Origin"]).toBe(
      "https://www.wktechnology.com.br",
    );
    expect(formSubmitCorsHeaders("https://wktechnology.com.br")["Access-Control-Allow-Origin"]).toBe(
      "https://wktechnology.com.br",
    );
    expect(formSubmitCorsHeaders("https://evil.example")["Access-Control-Allow-Origin"]).toBeUndefined();
    expect(formSubmitCorsHeaders("http://wktechnology.com.br")["Access-Control-Allow-Origin"]).toBeUndefined();
    expect(formSubmitCorsHeaders(null)["Access-Control-Allow-Origin"]).toBeUndefined();
  });
});
