import { describe, expect, it } from "vitest";
import { JibbleApiError, JibbleClient } from "./jibble-client";
import {
  buildJibbleUrl,
  isAllowedApiUrl,
  isSafeDownloadUrl,
  monthWindows,
  resolveStatusUrl,
} from "./jibble-urls";

type Call = { url: string; init: RequestInit };

function fakeFetch(handler: (url: string, init: RequestInit, n: number) => Response) {
  const calls: Call[] = [];
  const f = async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return handler(url, init, calls.length);
  };
  return { f, calls };
}

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });

const token = () =>
  json({ access_token: "tok-1", expires_in: 3600, organizationId: "org", personId: "p" });
const creds = { clientId: "client-id-123", clientSecret: "secret-value-xyz" };
const opts = { sleep: async () => {}, minIntervalMs: 0 };

describe("URLs do Jibble", () => {
  it("só aceita hosts oficiais em https", () => {
    expect(isAllowedApiUrl("https://workspace.prod.jibble.io/v1/People")).toBe(true);
    expect(isAllowedApiUrl("http://workspace.prod.jibble.io/v1/People")).toBe(false);
    expect(isAllowedApiUrl("https://evil.example.com/v1/People")).toBe(false);
    expect(isAllowedApiUrl("https://user:pw@workspace.prod.jibble.io/v1/People")).toBe(false);
    expect(isAllowedApiUrl("https://identity.prod.jibble.io/connect/token")).toBe(false);
  });
  it("statusUrl relativo resolve no mesmo host; outro host é bloqueado", () => {
    const base = "https://time-tracking.prod.jibble.io/v1/TimeEntries?$top=1";
    expect(resolveStatusUrl(base, "/v1/AsyncExports(abc)")).toBe(
      "https://time-tracking.prod.jibble.io/v1/AsyncExports(abc)",
    );
    expect(() =>
      resolveStatusUrl(base, "https://workspace.prod.jibble.io/v1/AsyncExports(abc)"),
    ).toThrow();
    expect(() => resolveStatusUrl(base, "/v1/People")).toThrow();
  });
  it("URL de download não pode ser IP, localhost ou http", () => {
    expect(isSafeDownloadUrl("https://bucket.s3.amazonaws.com/x?sig=1")).toBe(true);
    expect(isSafeDownloadUrl("http://bucket.s3.amazonaws.com/x")).toBe(false);
    expect(isSafeDownloadUrl("https://169.254.169.254/latest")).toBe(false);
    expect(isSafeDownloadUrl("https://localhost/x")).toBe(false);
  });
  it("janelas mensais cobrem todo o período", () => {
    const w = monthWindows("2023-11-15", "2024-02-03");
    expect(w.map((x) => x.from)).toEqual(["2023-11-01", "2023-12-01", "2024-01-01", "2024-02-01"]);
    expect(w.at(-1)!.to).toBe("2024-03-01");
  });
});

describe("cliente do Jibble", () => {
  it("token: client_credentials só no corpo do POST; Authorization só nas APIs", async () => {
    const { f, calls } = fakeFetch((url) =>
      url.includes("connect/token") ? token() : json({ value: [{ id: "1" }] }),
    );
    const c = new JibbleClient({ credentials: creds, fetch: f, ...opts });
    await c.page(buildJibbleUrl("workspace", "/v1/People"));
    const [tok, api] = calls;
    expect(tok.init.method).toBe("POST");
    expect(String(tok.init.body)).toContain("grant_type=client_credentials");
    expect(String(tok.init.body)).toContain("client_secret=secret-value-xyz");
    expect(tok.url).not.toContain("secret");
    expect((api.init.headers as Record<string, string>).Authorization).toBe("Bearer tok-1");
    expect(api.url).not.toContain("secret");
    expect(api.init.redirect).toBe("manual");
  });

  it("credencial recusada vira erro sem expor o segredo", async () => {
    const { f } = fakeFetch(() => json({ error: "invalid_client" }, 400));
    const c = new JibbleClient({ credentials: creds, fetch: f, ...opts });
    const err = await c.authenticate().catch((e) => e);
    expect(err).toBeInstanceOf(JibbleApiError);
    expect(err.code).toBe("unauthorized");
    expect(String(err.message)).not.toContain("secret-value-xyz");
  });

  it("reautentica uma vez quando o token expira (401)", async () => {
    let tokens = 0;
    const { f, calls } = fakeFetch((url) => {
      if (url.includes("connect/token")) {
        tokens++;
        return json({ access_token: `tok-${tokens}`, expires_in: 3600 });
      }
      const auth = (calls.at(-1)!.init.headers as Record<string, string>).Authorization;
      return auth === "Bearer tok-1" ? json({}, 401) : json({ value: [] });
    });
    const c = new JibbleClient({ credentials: creds, fetch: f, ...opts });
    const p = await c.page(buildJibbleUrl("workspace", "/v1/Groups"));
    expect(p.items).toEqual([]);
    expect(tokens).toBe(2);
  });

  it("429 respeita Retry-After e 5xx repete com recuo", async () => {
    const slept: number[] = [];
    const { f } = fakeFetch((url, _i, n) => {
      if (url.includes("connect/token")) return token();
      if (n === 2) return json({}, 429, { "retry-after": "2" });
      if (n === 3) return json({}, 502);
      return json({ value: [{ id: "x" }] });
    });
    const c = new JibbleClient({
      credentials: creds,
      fetch: f,
      sleep: async (ms) => void slept.push(ms),
      minIntervalMs: 0,
    });
    const p = await c.page(buildJibbleUrl("workspace", "/v1/Clients"));
    expect(p.items).toHaveLength(1);
    expect(slept[0]).toBe(2000);
    expect(c.retries).toBe(2);
  });

  it("espera longa vira rate_limited com horário de retomada", async () => {
    const { f } = fakeFetch((url) =>
      url.includes("connect/token") ? token() : json({}, 429, { "retry-after": "600" }),
    );
    const c = new JibbleClient({ credentials: creds, fetch: f, ...opts, now: () => 1000 });
    const err = await c.page(buildJibbleUrl("workspace", "/v1/Clients")).catch((e) => e);
    expect(err.code).toBe("rate_limited");
    expect(err.retryAt).toBe(1000 + 600_000);
  });

  it("redirecionamento e nextLink de outro host são bloqueados", async () => {
    const { f } = fakeFetch((url) =>
      url.includes("connect/token")
        ? token()
        : url.includes("Groups")
          ? new Response(null, { status: 302, headers: { location: "https://evil.example.com" } })
          : json({ value: [], "@odata.nextLink": "https://evil.example.com/v1/People?$skip=1" }),
    );
    const c = new JibbleClient({ credentials: creds, fetch: f, ...opts });
    expect((await c.page(buildJibbleUrl("workspace", "/v1/Groups")).catch((e) => e)).code).toBe(
      "redirect_blocked",
    );
    expect((await c.page(buildJibbleUrl("workspace", "/v1/People")).catch((e) => e)).code).toBe(
      "host_blocked",
    );
  });

  it("export assíncrono: 202 → status → 303; download sem Authorization", async () => {
    const { f, calls } = fakeFetch((url) => {
      if (url.includes("connect/token")) return token();
      if (url.includes("/v1/People"))
        return json({ exportId: "e1", statusUrl: "/v1/AsyncExports(e1)" }, 202);
      if (
        url.includes("AsyncExports") &&
        calls.filter((c) => c.url.includes("AsyncExports")).length === 1
      )
        return json({ status: "Processing" });
      if (url.includes("AsyncExports"))
        return new Response(null, {
          status: 303,
          headers: { location: "https://bucket.s3.amazonaws.com/e1?sig=abc" },
        });
      return json({ value: [{ id: "a" }, { id: "b" }] });
    });
    const c = new JibbleClient({ credentials: creds, fetch: f, ...opts });
    const r = await c.collectionAsync(buildJibbleUrl("workspace", "/v1/People"), { pollMs: 0 });
    expect(r).toMatchObject({ mode: "async" });
    expect(r.items).toHaveLength(2);
    const start = calls.find((x) => x.url.includes("/v1/People"))!;
    expect((start.init.headers as Record<string, string>).Prefer).toBe("respond-async");
    const dl = calls.find((x) => x.url.includes("s3.amazonaws.com"))!;
    expect((dl.init.headers as Record<string, string>).Authorization).toBeUndefined();
    expect(calls.some((x) => x.init.method === "DELETE")).toBe(false);
  });

  it("endpoint sem modo assíncrono (200) segue como resposta síncrona", async () => {
    const { f } = fakeFetch((url) =>
      url.includes("connect/token") ? token() : json({ value: [{ id: "t" }] }),
    );
    const c = new JibbleClient({ credentials: creds, fetch: f, ...opts });
    const r = await c.collectionAsync(buildJibbleUrl("timeAttendance", "/v1/TimesheetsSummary"));
    expect(r).toMatchObject({ mode: "sync", items: [{ id: "t" }] });
  });

  it("export com falha é reportado", async () => {
    const { f } = fakeFetch((url) =>
      url.includes("connect/token")
        ? token()
        : url.includes("AsyncExports")
          ? json({ status: "Failed", error: "x" })
          : json({ statusUrl: "/v1/AsyncExports(e2)" }, 202),
    );
    const c = new JibbleClient({ credentials: creds, fetch: f, ...opts });
    expect(
      (await c.collectionAsync(buildJibbleUrl("workspace", "/v1/People")).catch((e) => e)).code,
    ).toBe("export_failed");
  });
});
