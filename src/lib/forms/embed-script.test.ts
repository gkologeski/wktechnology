import { describe, expect, it, vi } from "vitest";
import { JSDOM } from "jsdom";
import { buildFormEmbedScript, normalizeTurnstileSiteKey } from "./embed-script";

const FORM = {
  id: "f1",
  name: "Contato",
  slug: "contato",
  fields: [{ key: "email", label: "E-mail", type: "email", required: true }],
  success_message: "Obrigado",
  display_mode: "inline",
  popup_config: {},
};

async function mountEmbed(opts: { siteKey: string | null; token: string }) {
  const dom = new JSDOM(`<!doctype html><body><div data-lovable-form="contato"></div></body>`, {
    runScripts: "outside-only",
    url: "https://www.wktechnology.com.br/contato.html",
  });
  const win = dom.window;
  const winExtra = win as unknown as { turnstile?: unknown; fetch: typeof fetch };
  const posts: Array<Record<string, unknown>> = [];
  const render = vi.fn(() => "w1");
  const reset = vi.fn();
  winExtra.turnstile = { render, getResponse: () => opts.token, reset };
  winExtra.fetch = vi.fn(async (_url: unknown, init?: RequestInit) => {
    if (init?.method === "POST") {
      posts.push(JSON.parse(String(init.body)) as Record<string, unknown>);
      return new Response(JSON.stringify({ ok: true, message: "Obrigado" }), { status: 200 });
    }
    return new Response(JSON.stringify(FORM), { status: 200 });
  }) as unknown as typeof fetch;
  win.eval(buildFormEmbedScript("https://app.example", opts.siteKey));
  // Aguarda o formulário montar (DOMContentLoaded + busca do formulário).
  for (let i = 0; i < 50 && !win.document.querySelector("form"); i++) {
    await new Promise((r) => setTimeout(r, 20));
  }
  await new Promise((r) => setTimeout(r, 50));
  const doc = win.document;
  const submit = async () => {
    (doc.querySelector('input[name="email"]') as HTMLInputElement).value = "a@b.com";
    const form = doc.querySelector("form")!;
    form.dispatchEvent(new win.Event("submit", { cancelable: true }));
    await new Promise((r) => setTimeout(r, 50));
  };
  return { doc, posts, render, reset, submit };
}

describe("script de incorporação de formulários", () => {
  it("renderiza o Turnstile com a chave pública e envia o token", async () => {
    const m = await mountEmbed({ siteKey: "0xSITE", token: "tok-123" });
    expect(m.render).toHaveBeenCalledWith(expect.anything(), { sitekey: "0xSITE" });
    await m.submit();
    expect(m.posts).toHaveLength(1);
    expect(m.posts[0]["cf-turnstile-response"]).toBe("tok-123");
    expect(m.posts[0].email).toBe("a@b.com");
  });

  it("não envia enquanto a verificação não foi concluída", async () => {
    const m = await mountEmbed({ siteKey: "0xSITE", token: "" });
    expect(m.render).toHaveBeenCalled();
    await m.submit();
    expect(m.posts).toHaveLength(0);
  });

  it("sem chave configurada não renderiza o widget", async () => {
    const m = await mountEmbed({ siteKey: null, token: "x" });
    expect(m.doc.querySelector("form")).not.toBeNull();
    expect(m.render).not.toHaveBeenCalled();
  });
});

describe("normalizeTurnstileSiteKey", () => {
  it("aceita chave válida e recusa vazia ou com caracteres inválidos", () => {
    expect(normalizeTurnstileSiteKey(" 0x4AAA_b-1 ")).toBe("0x4AAA_b-1");
    expect(normalizeTurnstileSiteKey("")).toBeNull();
    expect(normalizeTurnstileSiteKey(undefined)).toBeNull();
    expect(normalizeTurnstileSiteKey("abc'</script>")).toBeNull();
  });
});
