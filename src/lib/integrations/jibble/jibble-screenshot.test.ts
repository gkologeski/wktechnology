import { describe, expect, it, vi } from "vitest";
import { assertJibbleScreenshotUrl, readJibbleScreenshot } from "./jibble-screenshot";

const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0]);
describe("transferência privada de capturas Jibble", () => {
  it("aceita somente armazenamento HTTPS do Jibble e não encaminha autorização", async () => {
    const fetcher = vi.fn(
      async (_url: string, _init?: RequestInit) =>
        new Response(png, { headers: { "content-type": "image/png" } }),
    );
    const result = await readJibbleScreenshot(
      "https://storage.jibble.io/capture.png?sig=temporary",
      { fetch: fetcher as typeof fetch },
    );
    expect(result).toEqual({ bytes: png, contentType: "image/png" });
    expect(fetcher.mock.calls[0][1]).toMatchObject({
      method: "GET",
      redirect: "error",
      headers: { Accept: "image/png,image/jpeg,image/webp" },
    });
    expect((fetcher.mock.calls[0][1] as RequestInit).headers).not.toHaveProperty("Authorization");
  });
  it("recusa hosts arbitrários, credenciais, IP, portas e redirecionamentos embutidos", () => {
    for (const value of [
      "http://storage.jibble.io/a",
      "https://jibble.io.evil.test/a",
      "https://127.0.0.1/a",
      "https://user:secret@storage.jibble.io/a",
      "https://storage.jibble.io:8080/a",
      "https://identity.prod.jibble.io/a",
      "https://evil.example/a",
    ])
      expect(() => assertJibbleScreenshotUrl(value)).toThrow();
  });
  it("interrompe transferência que excede o limite mesmo sem content-length", async () => {
    const fetcher = vi.fn(async () => new Response(png));
    await expect(
      readJibbleScreenshot("https://storage.jibble.io/a", {
        fetch: fetcher as typeof fetch,
        maxBytes: 4,
      }),
    ).rejects.toThrow("limite");
  });
  it("não guarda HTML disfarçado de screenshot e mantém falha legível", async () => {
    const fetcher = vi.fn(
      async () =>
        new Response("<script>private</script>", { headers: { "content-type": "image/png" } }),
    );
    await expect(
      readJibbleScreenshot("https://storage.jibble.io/a", { fetch: fetcher as typeof fetch }),
    ).rejects.toThrow("não é uma captura");
  });
});
