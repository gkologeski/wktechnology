import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  VISUAL_DESIGN_MAX_BYTES,
  collectVisualStoragePaths,
  createBlankVisualDesign,
  createDefaultElement,
  parseVisualDesign,
  tryParseVisualDesign,
} from "./visual-design";
import { createNexxusStarterDesign } from "./nexxus-starter-template";
import { createConsultoriaStarterDesign } from "./consultoria-starter-template";
import {
  extractPlainSummaryFromDesign,
  renderVisualDesignPagesHtml,
  renderVisualDesignPrintDocument,
} from "./visual-renderer";
import {
  alignSelectedElements,
  cloneElementsWithOffset,
  computeSnapGuides,
  duplicatePage,
  expandGroupSelection,
  reorderLayer,
} from "@/components/proposals/visual-editor/visual-editor-state";
import { isValidWorkspaceAssetPath, slugifyProposalAssetName } from "./proposal-assets.server";

const assetMocks = vi.hoisted(() => ({
  resolveActiveWorkspace: vi.fn(),
  assertSalesArea: vi.fn(),
  assertSalesRecord: vi.fn(),
  createSignedUploadUrl: vi.fn(),
  createSignedUrls: vi.fn(),
}));

vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    let validator: ((d: unknown) => unknown) | undefined;
    const chain = {
      middleware() {
        return chain;
      },
      inputValidator(fn: (d: unknown) => unknown) {
        validator = fn;
        return chain;
      },
      handler(fn: (args: { data: unknown; context: unknown }) => unknown) {
        return async (args: { data?: unknown; context: unknown }) => {
          const parsed = validator ? validator(args.data) : args.data;
          return fn({ data: parsed, context: args.context });
        };
      },
    };
    return chain;
  },
}));

vi.mock("@/lib/access-control/sales-permission.middleware", () => ({
  requireSalesPermission: () => ({}),
}));

vi.mock("@/lib/access-control/sales-core.server", () => ({
  assertSalesArea: assetMocks.assertSalesArea,
  assertSalesRecord: assetMocks.assertSalesRecord,
}));

vi.mock("@/lib/active-workspace.server", () => ({
  resolveActiveWorkspace: assetMocks.resolveActiveWorkspace,
}));

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    storage: {
      from: () => ({
        createSignedUploadUrl: assetMocks.createSignedUploadUrl,
        createSignedUrls: assetMocks.createSignedUrls,
      }),
    },
  },
}));

import { createProposalAssetUpload, signProposalAssetUrls } from "./proposal-assets.functions";

type FnCall = (args: {
  data?: unknown;
  context: { supabase: unknown; userId: string };
}) => Promise<unknown>;

describe("visual-design schema e template editorial", () => {
  it("cria design em branco válido e parseia sem perdas", () => {
    const blank = createBlankVisualDesign();
    const parsed = parseVisualDesign(blank);
    expect(parsed.version).toBe(1);
    expect(parsed.orientation).toBe("portrait");
    expect(parsed.pages).toHaveLength(1);
  });

  it("gera modelo editorial Nexxus de 5 páginas com tabela dinâmica e mestre", () => {
    const design = createNexxusStarterDesign({
      primaryColor: "#2563EB",
      legalEntityName: "WK Technology",
    });
    const parsed = parseVisualDesign(design);
    expect(parsed.pages).toHaveLength(5);
    expect(parsed.master.enabled).toBe(true);
    expect(parsed.master.skipFirstPage).toBe(true);
    const hasDynamicTable = parsed.pages.some((p) =>
      p.elements.some((e) => e.type === "table" && e.binding === "items"),
    );
    expect(hasDynamicTable).toBe(true);
  });

  it("gera modelo visual Consultoria de 6 páginas preservando variáveis, tabela dinâmica e condições", () => {
    const design = createConsultoriaStarterDesign({
      primaryColor: "#2563EB",
      legalEntityName: "WK Technology",
    });
    const parsed = parseVisualDesign(design);
    expect(parsed.pages).toHaveLength(6);
    expect(parsed.master.enabled).toBe(true);
    expect(parsed.master.skipFirstPage).toBe(true);
    expect(parsed.pages.map((p) => p.name)).toEqual([
      "01 / Capa",
      "02 / Diagnóstico",
      "03 / Metodologia",
      "04 / Entregáveis",
      "05 / Cronograma e Equipe",
      "06 / Investimento",
    ]);

    const allText = parsed.pages
      .flatMap((p) => p.elements)
      .map((e) => {
        if (e.type === "text" || e.type === "heading") return e.props.text;
        if (e.type === "price_card") {
          return [e.props.eyebrow, e.props.title, e.props.price, e.props.subtitle].join(" ");
        }
        return "";
      })
      .join("\n");

    for (const variable of [
      "{{company.name}}",
      "{{contact.name}}",
      "{{deal.name}}",
      "{{counterparty.name}}",
      "{{signer.full_name}}",
      "{{valid_until}}",
      "{{total}}",
      "{{payment_terms_summary}}",
    ]) {
      expect(allText).toContain(variable);
    }

    const hasDynamicTable = parsed.pages.some((p) =>
      p.elements.some((e) => e.type === "table" && e.binding === "items"),
    );
    expect(hasDynamicTable).toBe(true);

    const html = renderVisualDesignPagesHtml(parsed, {
      companyName: "Cliente Exemplo Ltda",
      contactName: "Ana Paula",
      signerFullName: "Carlos Signatário",
      dealName: "Consultoria Arquitetura",
      total: "R$ 24.000,00",
      validUntil: "30/12/2026",
      paymentMethod: "Boleto bancário",
      paymentTermsSummary: "Entrada 50% + saldo em 30 dias",
      items: [{ id: "1", name: "Consultoria (100 h)", billing: "R$ 24.000,00" }],
    });
    expect(html).toContain("Cliente Exemplo Ltda");
    expect(html).toContain("Carlos Signatário");
    expect(html).toContain("Consultoria (100 h)");
    expect(html).toContain("Entrada 50% + saldo em 30 dias");
    expect(html).not.toContain("{{counterparty.name}}");
    expect(html).not.toContain("{{signer.full_name}}");
  });

  it("suporta bindLogo='client' e variáveis {{company.logo}}/{{provider.logo}} no renderizador visual", () => {
    const design = createBlankVisualDesign();
    const clientImg = createDefaultElement("image", 210, 297, 1, design.brandKit);
    const textWithLogos = createDefaultElement("text", 210, 297, 2, design.brandKit);
    if (clientImg.type !== "image" || textWithLogos.type !== "text") {
      throw new Error("Elementos inválidos no teste");
    }
    design.pages[0]!.elements = [
      { ...clientImg, props: { ...clientImg.props, bindLogo: "client", alt: "Logo cliente" } },
      { ...textWithLogos, props: { text: "Logos: {{company.logo}} {{provider.logo}}" } },
    ];
    const parsed = parseVisualDesign(design);

    const withLogos = renderVisualDesignPagesHtml(parsed, {
      companyName: "Cliente Alpha",
      clientLogoUrl: "https://cdn.alpha.com/logo.png",
      contractingName: "WK Technology",
      contractingLogoUrl: "https://cdn.wk.com/logo.png",
    });
    expect(withLogos).toContain('src="https://cdn.alpha.com/logo.png"');
    expect(withLogos).toContain('src="https://cdn.wk.com/logo.png"');

    const withoutClientLogo = renderVisualDesignPagesHtml(parsed, {
      companyName: "Cliente Sem Logo",
      clientLogoUrl: null,
      contractingName: "WK Technology",
      contractingLogoUrl: "http://inseguro.local/logo.png",
    });
    expect(withoutClientLogo).not.toContain("<img");
    expect(withoutClientLogo).not.toContain("WK Technology");
  });

  it("rejeita JSON acima de 500 KB e cores inválidas", () => {
    const huge = {
      ...createBlankVisualDesign(),
      extra: "x".repeat(VISUAL_DESIGN_MAX_BYTES + 100),
    };
    expect(() => parseVisualDesign(huge)).toThrow(/500 KB/);
    expect(tryParseVisualDesign({ version: 1, pages: [] })).toBeNull();
  });

  it("coleta storagePaths de imagens nas páginas e na página mestre", () => {
    const design = createBlankVisualDesign();
    const img = createDefaultElement("image", 210, 297, 2, design.brandKit);
    if (img.type === "image") {
      img.props.storagePath = "ws-1/capa.png";
      design.pages[0]!.elements.push(img);
    }
    design.brandKit.logoStoragePath = "ws-1/logo.png";
    expect(collectVisualStoragePaths(design)).toEqual(["ws-1/logo.png", "ws-1/capa.png"]);
  });
});

describe("visual-renderer", () => {
  it("interpola variáveis, escapa XSS, preenche tabela dinâmica e respeita página mestre", () => {
    const design = createNexxusStarterDesign();
    const html = renderVisualDesignPagesHtml(design, {
      companyName: 'Cliente <script>alert("xss")</script> LTDA',
      total: "R$ 44.370,00",
      items: [
        { id: "1", name: "Squad 150h", billing: "R$ 25.500,00" },
        { id: "2", name: "Aditivo 111h", billing: "R$ 18.870,00" },
      ],
    });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("R$ 44.370,00");
    expect(html).toContain("Squad 150h");
    expect(html).toContain("Aditivo 111h");
    expect(html).toContain("02");

    const printDoc = renderVisualDesignPrintDocument(design, { companyName: "NEXID" });
    expect(printDoc).toContain("@page { size: 210mm 297mm; margin: 0; }");
    expect(printDoc).toContain("NEXID");

    const summary = extractPlainSummaryFromDesign(design);
    expect(summary).toContain("<h2>");
  });
});

describe("visual-editor-state (snap, camadas, grupos e páginas)", () => {
  it("calcula snap magnético com o centro horizontal da página", () => {
    const snap = computeSnapGuides({ x: 54.4, y: 40, w: 100, h: 20 }, [], 210, 297);
    // centro do elemento (104.4) aproxima do centro da página (105) -> x = 55
    expect(snap.x).toBe(55);
    expect(snap.guides.some((g) => g.orientation === "vertical" && g.posMm === 105)).toBe(true);
  });

  it("reordena camadas, alinha, expande grupos, clona e duplica página", () => {
    const blank = createBlankVisualDesign();
    const a = createDefaultElement("rect", 210, 297, 1, blank.brandKit);
    const b = createDefaultElement("rect", 210, 297, 2, blank.brandKit);
    a.groupId = "grp_1";
    b.groupId = "grp_1";

    expect(expandGroupSelection([a, b], [a.id]).sort()).toEqual([a.id, b.id].sort());

    const reordered = reorderLayer([a, b], [a.id], "front");
    const zA = reordered.find((x) => x.id === a.id)!.z;
    const zB = reordered.find((x) => x.id === b.id)!.z;
    expect(zA).toBeGreaterThan(zB);

    const aligned = alignSelectedElements([a], [a.id], "centerX", 210, 297);
    expect(aligned[0]!.x).toBe(Math.round(((210 - a.w) / 2) * 10) / 10);

    const clones = cloneElementsWithOffset([a, b], 6, 10);
    expect(clones).toHaveLength(2);
    expect(clones[0]!.id).not.toBe(a.id);
    expect(clones[0]!.groupId).toBe(clones[1]!.groupId);
    expect(clones[0]!.groupId).not.toBe("grp_1");

    const pageCopy = duplicatePage(blank.pages[0]!, 1);
    expect(pageCopy.id).not.toBe(blank.pages[0]!.id);
  });
});

describe("proposal-assets segurança e 5 cenários de permissão", () => {
  const WS_A = "11111111-1111-4111-8111-111111111111";
  const WS_B = "22222222-2222-4222-8222-222222222222";

  beforeEach(() => {
    vi.clearAllMocks();
    assetMocks.resolveActiveWorkspace.mockResolvedValue(WS_A);
    assetMocks.assertSalesArea.mockResolvedValue(undefined);
    assetMocks.createSignedUploadUrl.mockResolvedValue({
      data: { token: "tok-123" },
      error: null,
    });
    assetMocks.createSignedUrls.mockImplementation(async (paths: string[]) => ({
      data: paths.map((p) => ({ path: p, signedUrl: `https://signed.local/${p}` })),
      error: null,
    }));
  });

  it("sanitiza nomes de arquivo e impede path traversal ou outro workspace", () => {
    expect(slugifyProposalAssetName("Foto Capa Proposta (1).PNG")).toBe("Foto-Capa-Proposta-1.png");
    expect(isValidWorkspaceAssetPath(`${WS_A}/img.png`, WS_A)).toBe(true);
    expect(isValidWorkspaceAssetPath(`${WS_B}/img.png`, WS_A)).toBe(false);
    expect(isValidWorkspaceAssetPath(`${WS_A}/../${WS_B}/img.png`, WS_A)).toBe(false);
  });

  it("1. permitido: gera upload assinado no prefixo do workspace ativo", async () => {
    const res = (await (createProposalAssetUpload as unknown as FnCall)({
      data: { filename: "capa.png", mime: "image/png", size_bytes: 12000 },
      context: { supabase: {}, userId: "u-ok" },
    })) as { bucket: string; path: string; token: string };
    expect(res.bucket).toBe("proposal-assets");
    expect(res.path.startsWith(`${WS_A}/`)).toBe(true);
    expect(res.token).toBe("tok-123");
  });

  it("2. sem chave de permissão: bloqueia upload sem chamar storage", async () => {
    assetMocks.assertSalesArea.mockRejectedValue(new Error("Sem permissão."));
    await expect(
      (createProposalAssetUpload as unknown as FnCall)({
        data: { filename: "capa.png", mime: "image/png", size_bytes: 1000 },
        context: { supabase: {}, userId: "u-no-perm" },
      }),
    ).rejects.toThrow("Sem permissão.");
    expect(assetMocks.createSignedUploadUrl).not.toHaveBeenCalled();
  });

  it("3. deny explícito: bloqueia assinatura de URLs", async () => {
    assetMocks.assertSalesArea.mockRejectedValueOnce(new Error("Ação negada por política."));
    await expect(
      (signProposalAssetUrls as unknown as FnCall)({
        data: { paths: [`${WS_A}/img.png`] },
        context: { supabase: {}, userId: "u-deny" },
      }),
    ).rejects.toThrow("Ação negada por política.");
    expect(assetMocks.createSignedUrls).not.toHaveBeenCalled();
  });

  it("4. outro workspace: ignora paths estrangeiros e não gera URL assinada", async () => {
    const res = (await (signProposalAssetUrls as unknown as FnCall)({
      data: { paths: [`${WS_B}/secreto.png`, `${WS_A}/ok.png`] },
      context: { supabase: {}, userId: "u-ok" },
    })) as Record<string, string>;
    expect(res[`${WS_B}/secreto.png`]).toBeUndefined();
    expect(res[`${WS_A}/ok.png`]).toBe(`https://signed.local/${WS_A}/ok.png`);
  });

  it("5. membro inativo: bloqueia antes de acessar storage", async () => {
    assetMocks.resolveActiveWorkspace.mockRejectedValueOnce(
      new Error("Membro inativo ou sem workspace ativo."),
    );
    await expect(
      (createProposalAssetUpload as unknown as FnCall)({
        data: { filename: "capa.png", mime: "image/png", size_bytes: 1000 },
        context: { supabase: {}, userId: "u-inactive" },
      }),
    ).rejects.toThrow("Membro inativo ou sem workspace ativo.");
    expect(assetMocks.createSignedUploadUrl).not.toHaveBeenCalled();
  });
});
