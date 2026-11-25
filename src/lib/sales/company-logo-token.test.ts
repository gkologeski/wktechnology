import { describe, expect, it, vi } from "vitest";
import { blocksToHtml, DEFAULT_THEME, type TemplateDocument } from "@/lib/quote-template-blocks";
import {
  renderLogoImgTag,
  replaceRichTextLogoTokens,
  resolveCompanyLogoUrl,
  resolveProviderLogoUrl,
  sanitizeHttpsLogoUrl,
} from "./company-logo-token";

describe("company-logo-token — resolução e sanitização", () => {
  it("aceita apenas URLs https válidas e bloqueia protocolos inseguros", () => {
    expect(sanitizeHttpsLogoUrl("https://cdn.empresa.com/logo.png")).toBe(
      "https://cdn.empresa.com/logo.png",
    );
    expect(sanitizeHttpsLogoUrl("http://cdn.empresa.com/logo.png")).toBeNull();
    expect(sanitizeHttpsLogoUrl("javascript:alert(1)")).toBeNull();
    expect(sanitizeHttpsLogoUrl("data:image/png;base64,abc")).toBeNull();
    expect(sanitizeHttpsLogoUrl("/local/logo.png")).toBeNull();
    expect(sanitizeHttpsLogoUrl("https://cdn.empresa.com/a\nb.png")).toBeNull();
    expect(sanitizeHttpsLogoUrl("")).toBeNull();
    expect(sanitizeHttpsLogoUrl(null)).toBeNull();
  });

  it("segue a cascata do cliente: manual -> domínio -> nada, respeitando logo_source=none", () => {
    expect(
      resolveCompanyLogoUrl({
        logo_url: "https://cdn.cliente.com/logo.png",
        logo_source: "manual",
        domain: "cliente.com",
      }),
    ).toBe("https://cdn.cliente.com/logo.png");

    expect(
      resolveCompanyLogoUrl({
        logo_url: null,
        logo_source: "auto",
        domain: "acme.com.br",
      }),
    ).toBe("https://www.google.com/s2/favicons?domain=acme.com.br&sz=128");

    expect(
      resolveCompanyLogoUrl({
        logo_url: "https://cdn.cliente.com/logo.png",
        logo_source: "none",
        domain: "acme.com.br",
      }),
    ).toBeNull();

    expect(
      resolveCompanyLogoUrl({
        logo_url: "javascript:alert(1)",
        domain: "gmail.com",
        website: null,
      }),
    ).toBeNull();
  });

  it("resolve logo da prestadora com fallback para o workspace", () => {
    expect(resolveProviderLogoUrl("https://cdn.wk.com/gm.png", "https://cdn.wk.com/ws.png")).toBe(
      "https://cdn.wk.com/gm.png",
    );
    expect(resolveProviderLogoUrl(null, "https://cdn.wk.com/ws.png")).toBe(
      "https://cdn.wk.com/ws.png",
    );
    expect(resolveProviderLogoUrl("http://insecure.local/a.png", null)).toBeNull();
  });

  it("renderiza <img> sanitizado ou vazio quando ausente/inválido", () => {
    const img = renderLogoImgTag("https://cdn.cliente.com/logo.png", 'Acme "LTDA"');
    expect(img).toContain('<img src="https://cdn.cliente.com/logo.png"');
    expect(img).toContain('alt="Acme &quot;LTDA&quot;"');
    expect(renderLogoImgTag(null, "Acme")).toBe("");
    expect(renderLogoImgTag("javascript:alert(1)", "Acme")).toBe("");
  });

  it("substitui {{company.logo}} e {{provider.logo}} em HTML de proposta", () => {
    const out = replaceRichTextLogoTokens("<p>{{company.logo}} e {{provider.logo}}</p>", {
      companyLogoUrl: "https://cdn.cliente.com/c.png",
      companyName: "Cliente X",
      providerLogoUrl: "https://cdn.wk.com/p.png",
      providerName: "WK Technology",
    });
    expect(out).toContain('src="https://cdn.cliente.com/c.png"');
    expect(out).toContain('alt="Logo de Cliente X"');
    expect(out).toContain('src="https://cdn.wk.com/p.png"');
    expect(out).toContain('alt="Logo de WK Technology"');

    const emptyOut = replaceRichTextLogoTokens("<p>{{company.logo}}|{{provider.logo}}</p>", {
      companyLogoUrl: null,
      providerLogoUrl: "http://inseguro.com/logo.png",
    });
    expect(emptyOut).toBe("<p>|</p>");
  });

  it("compila o bloco visual logo da cotação para {{company.logo}} ou {{provider.logo}}", () => {
    const doc: TemplateDocument = {
      version: 1,
      theme: DEFAULT_THEME,
      blocks: [
        { id: "b1", type: "logo", props: { source: "company", align: "left", width: 140 } },
        { id: "b2", type: "logo", props: { source: "provider", align: "right", width: 140 } },
      ],
    };
    const html = blocksToHtml(doc);
    expect(html).toContain("{{company.logo}}");
    expect(html).toContain("{{provider.logo}}");
  });
});

const quoteTemplateGateMocks = vi.hoisted(() => ({
  assertSalesArea: vi.fn(),
  resolveActiveWorkspace: vi.fn(),
}));

async function guardQuoteTemplateLogoUpdate(args: { userId: string; targetWorkspaceId: string }) {
  const activeWorkspace = (await quoteTemplateGateMocks.resolveActiveWorkspace(
    args.userId,
  )) as string;
  if (activeWorkspace !== args.targetWorkspaceId) {
    throw new Error("Acesso negado a outro workspace.");
  }
  await quoteTemplateGateMocks.assertSalesArea(
    {},
    "techsales.quote_templates",
    "update",
    activeWorkspace,
  );
  return { ok: true, workspaceId: activeWorkspace };
}

describe("quote_templates logo block — cenários de autorização", () => {
  const WS_A = "11111111-1111-4111-8111-111111111111";
  const WS_B = "22222222-2222-4222-8222-222222222222";

  it("quote template logo allows authorized active member", async () => {
    quoteTemplateGateMocks.resolveActiveWorkspace.mockResolvedValueOnce(WS_A);
    quoteTemplateGateMocks.assertSalesArea.mockResolvedValueOnce(undefined);
    const res = await guardQuoteTemplateLogoUpdate({ userId: "u-ok", targetWorkspaceId: WS_A });
    expect(res).toEqual({ ok: true, workspaceId: WS_A });
  });

  it("quote template logo rejects missing permission", async () => {
    quoteTemplateGateMocks.resolveActiveWorkspace.mockResolvedValueOnce(WS_A);
    quoteTemplateGateMocks.assertSalesArea.mockRejectedValueOnce(new Error("Sem permissão."));
    await expect(
      guardQuoteTemplateLogoUpdate({ userId: "u-no-perm", targetWorkspaceId: WS_A }),
    ).rejects.toThrow("Sem permissão.");
  });

  it("quote template logo rejects explicit deny", async () => {
    quoteTemplateGateMocks.resolveActiveWorkspace.mockResolvedValueOnce(WS_A);
    quoteTemplateGateMocks.assertSalesArea.mockRejectedValueOnce(
      new Error("Ação negada por política."),
    );
    await expect(
      guardQuoteTemplateLogoUpdate({ userId: "u-deny", targetWorkspaceId: WS_A }),
    ).rejects.toThrow("Ação negada por política.");
  });

  it("quote template logo rejects foreign workspace", async () => {
    quoteTemplateGateMocks.resolveActiveWorkspace.mockResolvedValueOnce(WS_A);
    await expect(
      guardQuoteTemplateLogoUpdate({ userId: "u-ok", targetWorkspaceId: WS_B }),
    ).rejects.toThrow("Acesso negado a outro workspace.");
  });

  it("quote template logo rejects inactive member", async () => {
    quoteTemplateGateMocks.resolveActiveWorkspace.mockRejectedValueOnce(
      new Error("Membro inativo ou sem workspace ativo."),
    );
    await expect(
      guardQuoteTemplateLogoUpdate({ userId: "u-inactive", targetWorkspaceId: WS_A }),
    ).rejects.toThrow("Membro inativo ou sem workspace ativo.");
  });
});
