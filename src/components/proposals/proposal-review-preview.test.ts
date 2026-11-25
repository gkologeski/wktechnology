// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createNexxusStarterDesign } from "@/lib/proposals/nexxus-starter-template";

const mocks = vi.hoisted(() => ({
  signUrls: vi.fn(),
  listProposals: vi.fn(),
  loadPreviewCtx: vi.fn(),
}));

vi.mock("@tanstack/react-start", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-start")>();
  return { ...actual, useServerFn: (fn: unknown) => fn };
});
vi.mock("@/lib/proposals/proposal-assets.functions", () => ({
  signProposalAssetUrls: mocks.signUrls,
  listProposalsForPreview: mocks.listProposals,
  loadProposalPreviewContext: mocks.loadPreviewCtx,
}));
vi.mock("@/lib/access-control/use-permissions", () => ({
  usePermissions: () => ({ can: () => true }),
}));

import { ProposalReviewPreview } from "./proposal-review-preview";
import {
  buildVisualReviewSrcDoc,
  computeReviewPreviewScale,
} from "@/lib/proposals/visual-renderer";

let host: HTMLDivElement;
let root: Root;
let qc: QueryClient;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.signUrls.mockResolvedValue({});
  mocks.listProposals.mockResolvedValue([]);
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

function renderEl(el: ReturnType<typeof createElement>) {
  return act(async () => {
    root.render(createElement(QueryClientProvider, { client: qc }, el));
  });
}

describe("ProposalReviewPreview", () => {
  it("renderiza texto rico sanitizado quando não há modelo visual", async () => {
    await renderEl(
      createElement(ProposalReviewPreview, {
        design: null,
        body: "<p>Escopo Brooks</p><script>alert(1)</script>",
        context: { companyName: "Brooks" },
      }),
    );
    expect(host.querySelector("iframe")).toBeNull();
    expect(host.textContent).toContain("Escopo Brooks");
    expect(host.innerHTML).not.toContain("<script>");
    expect(host.textContent).not.toContain("Ver em tela cheia");
  });

  it("renderiza iframe sandbox com o layout visual e dados reais da proposta", async () => {
    const design = createNexxusStarterDesign();
    await renderEl(
      createElement(ProposalReviewPreview, {
        design,
        body: "<p>Resumo textual ignorado</p>",
        context: {
          proposalTitle: "CT/Brooks/Sergio/Suporte 18 horas",
          companyName: "Brooks Ambiental",
          contactName: "Sergio",
          total: "R$ 4.500,00",
          validUntil: "27/11/2026",
          contractingName: "GM Kologeski",
          clientLogoUrl: "https://cdn.example.com/brooks.png",
        },
        workspaceLogoUrl: "https://cdn.example.com/wk.png",
        draftLabel: "CT/Brooks/Sergio/Suporte 18 horas",
      }),
    );

    const iframe = host.querySelector("iframe");
    expect(iframe).not.toBeNull();
    expect(iframe?.getAttribute("sandbox")).toBe("");
    const srcDoc = iframe?.getAttribute("srcdoc") ?? "";
    expect(srcDoc).toContain("Brooks Ambiental");
    expect(srcDoc).toContain("R$ 4.500,00");
    expect(srcDoc).toContain("27/11/2026");
    expect(srcDoc).toContain("https://cdn.example.com/wk.png");
    expect(srcDoc).not.toContain("Nexxus Engenharia");
    expect(srcDoc).not.toContain("<script");

    const btn = Array.from(host.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Ver em tela cheia"),
    );
    expect(btn).toBeDefined();
    expect(btn?.disabled).toBe(false);
  });

  it("exibe erro com tentar novamente quando a assinatura de imagem privada falha, sem dados fictícios", async () => {
    const design = createNexxusStarterDesign();
    const page0 = design.pages[0];
    if (!page0) throw new Error("Página inicial ausente");
    page0.elements.push({
      id: "img-private-1",
      type: "image",
      name: "Capa",
      x: 10,
      y: 10,
      w: 50,
      h: 30,
      rotation: 0,
      z: 99,
      style: {},
      props: {
        src: "",
        storagePath: "ws-1/capa.png",
        alt: "Capa privada",
        fit: "contain",
        bindLogo: "none",
      },
    });

    mocks.signUrls.mockRejectedValueOnce(new Error("Sem acesso à imagem"));
    await renderEl(
      createElement(ProposalReviewPreview, {
        design,
        body: "",
        context: { companyName: "Brooks Ambiental" },
      }),
    );
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(host.querySelector("iframe")).toBeNull();
    expect(host.textContent).toContain("Sem acesso à imagem");
    expect(host.textContent).not.toContain("Nexxus Engenharia");

    const retryBtn = Array.from(host.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Tentar novamente"),
    );
    expect(retryBtn).toBeDefined();

    mocks.signUrls.mockResolvedValueOnce({
      "ws-1/capa.png": "https://signed.example.com/capa.png",
    });
    await act(async () => {
      retryBtn?.click();
      await new Promise((r) => setTimeout(r, 0));
    });

    const iframe = host.querySelector("iframe");
    expect(iframe).not.toBeNull();
    expect(iframe?.getAttribute("srcdoc")).toContain("https://signed.example.com/capa.png");
  });

  it("ajusta a escala proporcional à largura do container para retrato e paisagem", () => {
    const portraitNarrow = computeReviewPreviewScale("portrait", 400);
    const portraitWide = computeReviewPreviewScale("portrait", 1200);
    const landscape = computeReviewPreviewScale("landscape", 760);

    expect(portraitNarrow.scale).toBeGreaterThan(0.25);
    expect(portraitNarrow.scale).toBeLessThan(1);
    expect(portraitWide.scale).toBe(1);
    expect(landscape.scale).toBeLessThan(portraitWide.scale);

    const doc = buildVisualReviewSrcDoc(
      createNexxusStarterDesign(),
      { companyName: "Brooks" },
      600,
    );
    expect(doc).toContain("vp-scale-box");
    expect(doc).toContain("Brooks");
  });
});
